// Hitscan gunfire for everyone (player, police, gangs): spread, ray tests against people,
// vehicles, buildings and the ground, damage with headshots, tracers, muzzle flashes,
// impacts, plus melee punches and explosion damage.
import * as THREE from 'three';

const tmpDir = new THREE.Vector3();

export class CombatSystem {
  constructor(game) {
    this.game = game;
    game.events.on('explosion', (e) => this.explosion(e));
  }

  /** Ray vs a standing (or fallen) person. Returns distance or Infinity. */
  rayHuman(o, d, h, maxDist) {
    const top = h.alive && h.downTimer <= 0 ? 1.85 : 0.5;
    const r = 0.38;
    const px = h.pos.x - o.x, pz = h.pos.z - o.z;
    const dd = d.x * d.x + d.z * d.z;
    if (dd < 1e-6) return Infinity;
    const t = (px * d.x + pz * d.z) / dd;
    if (t < 0 || t > maxDist) return Infinity;
    const cx = d.x * t - px, cz = d.z * t - pz;
    if (cx * cx + cz * cz > r * r) return Infinity;
    const y = o.y + d.y * t - h.pos.y;
    if (y < 0 || y > top) return Infinity;
    return t;
  }

  /** Ray vs a vehicle's oriented box. */
  rayVehicle(o, d, v, maxDist) {
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
    const ox = o.x - v.pos.x, oz = o.z - v.pos.z;
    // world -> local (inverse yaw rotation): local x = right-ish, local z = forward
    const lx = ox * c - oz * s, lz = ox * s + oz * c;
    const dx = d.x * c - d.z * s, dz = d.x * s + d.z * c;
    const ly = o.y - v.pos.y, dy = d.y;
    const hw = v.type.wid / 2, hl = v.type.len / 2, hh = v.type.hgt;
    let t0 = 0, t1 = maxDist;
    for (const [oo, dd, lo, hi] of [[lx, dx, -hw, hw], [ly, dy, 0, hh], [lz, dz, -hl, hl]]) {
      if (Math.abs(dd) < 1e-8) { if (oo < lo || oo > hi) return Infinity; continue; }
      let a = (lo - oo) / dd, b = (hi - oo) / dd;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return Infinity;
    }
    return t0;
  }

  /**
   * Fires a weapon. shooter: Human; origin: muzzle-ish point; aim: unit direction.
   * opts: { spreadMul, ignore (Set of humans), vehicleIgnore }
   */
  fire(shooter, w, origin, aim, opts = {}) {
    const g = this.game;
    const pellets = w.pellets || 1;
    let anyHit = false;
    for (let p = 0; p < pellets; p++) {
      const spread = w.spread * (opts.spreadMul ?? 1);
      tmpDir.set(aim.x + (Math.random() - 0.5) * 2 * spread, aim.y + (Math.random() - 0.5) * 2 * spread, aim.z + (Math.random() - 0.5) * 2 * spread).normalize();
      const res = this.trace(origin, tmpDir, w.range, shooter, opts.vehicleIgnore);
      const end = { x: origin.x + tmpDir.x * res.dist, y: origin.y + tmpDir.y * res.dist, z: origin.z + tmpDir.z * res.dist };
      if (p < 3 || Math.random() < 0.3) {
        g.fx.tracers.add(origin, end, shooter && shooter.role === 'player' ? 0xfff0b0 : 0xffd080);
        g.fx.particles.streak(origin, end);
      }
      if (res.human) {
        const head = end.y - res.human.pos.y > 1.55;
        const dmg = w.damage * (head ? 2.2 : 1) * (opts.damageMul ?? 1);
        const killed = res.human.damage(dmg, shooter, 'bullet');
        g.fx.particles.blood(end.x, end.y, end.z, head ? 14 : 8);
        if (res.human.role === 'player') g.cameraRig.shake(0.25);
        g.events.emit('humanShot', { human: res.human, shooter, killed, head });
        anyHit = true;
      } else if (res.vehicle) {
        res.vehicle.damage(w.damage * 0.35, shooter);
        g.fx.particles.sparks(end.x, end.y, end.z, 6);
        g.events.emit('vehicleShot', { vehicle: res.vehicle, shooter });
      } else if (res.dist < w.range) {
        g.fx.particles.dust(end.x, end.y, end.z, res.ground ? 0xb0a080 : 0xd8d0c0);
      }
    }
    g.fx.muzzle(origin, aim, shooter && shooter.role === 'player');
    g.events.emit('gunshot', { x: origin.x, z: origin.z, shooter, weapon: w.id, radius: 45 });
    return anyHit;
  }

  /** Nearest thing hit along a ray. */
  trace(o, d, maxDist, shooter, vehicleIgnore) {
    const g = this.game;
    let best = { dist: maxDist, human: null, vehicle: null, ground: false };
    const horiz = Math.hypot(d.x, d.z);
    if (horiz > 1e-4) {
      const wall = g.colliders.raycast(o.x, o.z, d.x / horiz, d.z / horiz, maxDist * horiz, o.y) / horiz;
      if (wall < best.dist) best.dist = wall;
    }
    if (d.y < -1e-4) {
      const tg = -o.y / d.y;
      if (tg < best.dist) { best.dist = tg; best.ground = true; }
    }
    for (const h of g.allHumans()) {
      if (h === shooter || h.vehicle) continue;
      const t = this.rayHuman(o, d, h, best.dist);
      if (t < best.dist) best = { dist: t, human: h, vehicle: null, ground: false };
    }
    for (const v of g.vehicles.list) {
      if (v === vehicleIgnore) continue;
      if (Math.hypot(v.pos.x - o.x, v.pos.z - o.z) > best.dist + 4) continue;
      const t = this.rayVehicle(o, d, v, best.dist);
      if (t < best.dist) {
        best = { dist: t, human: null, vehicle: v, ground: false };
        // occupants can be hit through the glass
        if (v.driver && Math.random() < 0.3 && t > 0) best.occupant = v.driver;
      }
    }
    if (best.occupant && best.occupant !== shooter) { best.human = best.occupant; best.vehicle = null; }
    return best;
  }

  /** A punch in front of the attacker. */
  melee(attacker, w) {
    const g = this.game;
    const fx = Math.sin(attacker.yaw), fz = Math.cos(attacker.yaw);
    let target = null, bd = w.range;
    for (const h of g.allHumans()) {
      if (h === attacker || !h.alive || h.vehicle) continue;
      const dx = h.pos.x - attacker.pos.x, dz = h.pos.z - attacker.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bd || (dx * fx + dz * fz) / (d || 1) < 0.4) continue;
      bd = d; target = h;
    }
    if (target) {
      const killed = target.damage(w.damage, attacker, 'melee');
      target.knockDown(fx * 3, fz * 3, killed ? 0 : 1.2);
      g.fx.particles.blood(target.pos.x, 1.5, target.pos.z, 4);
      g.audio && g.audio.sfx.punch();
      g.events.emit('humanShot', { human: target, shooter: attacker, killed, melee: true });
    }
    return target;
  }

  explosion(e) {
    const g = this.game;
    g.fx.explosion(e.x, e.y ?? 1, e.z, e.radius);
    g.vehicles.applyExplosion(e.x, e.z, e.radius * 1.3, e.source);
    for (const h of g.allHumans()) {
      if (h.vehicle && h.vehicle !== e.vehicle) continue;
      const d = Math.hypot(h.pos.x - e.x, h.pos.z - e.z);
      if (d > e.radius) continue;
      const k = 1 - d / e.radius;
      const nx = (h.pos.x - e.x) / (d || 1), nz = (h.pos.z - e.z) / (d || 1);
      if (h.vehicle === e.vehicle && h.vehicle) {
        if (h.role === 'player') g.player.exitVehicle(true);
      }
      h.damage(110 * k, e.source, 'explosion');
      h.knockDown(nx * 9 * k, nz * 9 * k, 2.5);
    }
    const pd = Math.hypot(g.player.focus.x - e.x, g.player.focus.z - e.z);
    g.cameraRig.shake(Math.max(0, 1.2 - pd / 60));
  }
}
