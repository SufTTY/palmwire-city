// Gunfire, fists and explosions for everyone: hitscan rays against people (body + head),
// vehicles (oriented boxes) and the static city, with tracers, muzzle flashes, sparks,
// blood, sounds and the events the wanted level and missions listen to.
import * as THREE from 'three';
import { WEAPONS } from './weaponDefs.js';

const tmp = new THREE.Vector3();

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : -1;
}

function rayVehicle(o, d, v) {
  const cs = Math.cos(-v.heading), sn = Math.sin(-v.heading);
  const px = o.x - v.pos.x, py = o.y - v.pos.y, pz = o.z - v.pos.z;
  const lx = px * cs + pz * sn, lz = -px * sn + pz * cs;
  const dx = d.x * cs + d.z * sn, dz = -d.x * sn + d.z * cs;
  const T = v.T;
  const lo = [-T.wid / 2, 0.2, -T.len / 2], hi = [T.wid / 2, T.hgt, T.len / 2];
  const O = [lx, py, lz], D = [dx, d.y, dz];
  let tmin = 0, tmax = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(D[k]) < 1e-9) { if (O[k] < lo[k] || O[k] > hi[k]) return -1; continue; }
    let t1 = (lo[k] - O[k]) / D[k], t2 = (hi[k] - O[k]) / D[k];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

export class CombatSystem {
  constructor(G) {
    this.G = G;
  }

  /** First thing a ray hits: { kind, obj, point, dist, normal, headshot } (kind null = nothing). */
  raycast(origin, dir, range, ignore = null) {
    const G = this.G;
    let best = { kind: null, obj: null, dist: range, headshot: false, normal: null };
    const stat = G.colliders.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range);
    if (stat) best = { kind: 'static', obj: null, dist: stat.t, normal: new THREE.Vector3(...stat.n) };
    // ground plane
    if (dir.y < -1e-3) {
      const tg = (G.layout.groundHeight(origin.x, origin.z) - origin.y) / dir.y;
      if (tg > 0 && tg < best.dist) best = { kind: 'ground', obj: null, dist: tg, normal: new THREE.Vector3(0, 1, 0) };
    }
    for (const c of G.characters) {
      if (c === ignore || c.inVehicle || c.removed || !c.alive) continue;
      const dx = c.pos.x - origin.x, dz = c.pos.z - origin.z;
      if (dx * dx + dz * dz > (best.dist + 2) ** 2) continue;
      const tb = raySphere(origin, dir, c.pos.x, c.pos.y + 1.15, c.pos.z, 0.42);
      const th = raySphere(origin, dir, c.pos.x, c.pos.y + 1.76, c.pos.z, 0.2);
      if (th >= 0 && th < best.dist && (tb < 0 || th <= tb)) best = { kind: 'character', obj: c, dist: th, headshot: true };
      else if (tb >= 0 && tb < best.dist) best = { kind: 'character', obj: c, dist: tb, headshot: false };
    }
    for (const v of G.vehicles.list) {
      if (ignore && (ignore.inVehicle === v)) continue;
      const dx = v.pos.x - origin.x, dz = v.pos.z - origin.z;
      if (dx * dx + dz * dz > (best.dist + 5) ** 2) continue;
      const t = rayVehicle(origin, dir, v);
      if (t >= 0 && t < best.dist) best = { kind: 'vehicle', obj: v, dist: t, headshot: false };
    }
    best.point = origin.clone().addScaledVector(dir, best.dist);
    return best;
  }

  /** Fire a weapon from muzzle position along dir (already aimed). */
  fire(shooter, muzzle, dir, weaponKey, { isPlayer = false, aimOrigin = null } = {}) {
    const G = this.G;
    const W = WEAPONS[weaponKey];
    const pellets = W.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      d.x += (G.rng() - 0.5) * 2 * W.spread;
      d.y += (G.rng() - 0.5) * 2 * W.spread;
      d.z += (G.rng() - 0.5) * 2 * W.spread;
      d.normalize();
      const from = aimOrigin || muzzle;
      const hit = this.raycast(from, d, W.range, shooter);
      const end = hit.point;
      if (p < 3) G.fx.tracer(muzzle, end, isPlayer ? 0xfff0b0 : 0xffc890);
      this.applyHit(hit, W, shooter, d, isPlayer);
    }
    G.fx.particles.muzzle(muzzle.x, muzzle.y, muzzle.z, dir);
    G.fx.flash(muzzle);
    if (G.audio) G.audio.sfx.gunshot(weaponKey, muzzle, isPlayer);
    G.events.emit('shotFired', { shooter, pos: muzzle.clone(), isPlayer, weapon: weaponKey });
  }

  applyHit(hit, W, shooter, dir, isPlayer) {
    const G = this.G;
    if (hit.kind === 'character') {
      const dmg = W.damage * (hit.headshot ? 2.5 : 1);
      hit.obj.takeDamage(dmg, { attacker: shooter, weapon: W.key, dir, headshot: hit.headshot });
      G.fx.particles.blood(hit.point.x, hit.point.y, hit.point.z, dir);
      if (isPlayer) G.events.emit('playerHitMarker', { kill: !hit.obj.alive, headshot: hit.headshot });
      hit.obj.vel.x += dir.x * 1.5;
      hit.obj.vel.z += dir.z * 1.5;
    } else if (hit.kind === 'vehicle') {
      hit.obj.damage(W.damage * 0.8, { attacker: shooter, type: 'bullet' });
      const occupant = hit.obj.driver;
      if (occupant && occupant.alive && occupant !== shooter && G.rng() < 0.35) occupant.takeDamage(W.damage * 0.45, { attacker: shooter, weapon: W.key });
      G.fx.particles.sparks(hit.point.x, hit.point.y, hit.point.z, 6);
      if (hit.obj.mode === 'rail' && G.traffic) G.traffic.release(hit.obj, true);
      if (isPlayer) G.events.emit('playerHitMarker', { kill: false, vehicle: true });
    } else if (hit.kind) {
      G.fx.particles.sparks(hit.point.x, hit.point.y, hit.point.z, 4);
      G.fx.particles.dust(hit.point.x, hit.point.y, hit.point.z);
    }
  }

  /** A punch: hits the nearest person in front within reach. */
  melee(attacker) {
    const G = this.G;
    const W = WEAPONS.fists;
    const fx = Math.sin(attacker.heading), fz = Math.cos(attacker.heading);
    let target = null, bd = W.range;
    for (const c of G.characters) {
      if (c === attacker || !c.alive || c.inVehicle) continue;
      const dx = c.pos.x - attacker.pos.x, dz = c.pos.z - attacker.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bd || d < 0.01) continue;
      if ((dx * fx + dz * fz) / d < 0.5) continue;
      bd = d;
      target = c;
    }
    attacker.punchT = 1;
    if (G.audio) G.audio.sfx.whoosh(attacker.pos);
    if (!target) return false;
    target.takeDamage(W.damage, { attacker, weapon: 'fists' });
    target.vel.x += fx * 3;
    target.vel.z += fz * 3;
    if (target.health < 30 && target.alive && G.rng() < 0.5) target.knockback(fx * 4, fz * 4, 2);
    if (G.audio) G.audio.sfx.punch(target.pos);
    G.events.emit('meleeHit', { attacker, victim: target });
    return true;
  }

  /** NPC shot at a target character, with distance- and motion-based inaccuracy. */
  npcFire(shooter, target, weaponKey, accuracy = 0.5) {
    const muzzle = shooter.pos.clone().add(tmp.set(Math.sin(shooter.heading) * 0.5, 1.45, Math.cos(shooter.heading) * 0.5));
    const aim = target.inVehicle ? target.inVehicle.pos.clone().setY(target.inVehicle.pos.y + 1) : target.pos.clone().setY(target.pos.y + 1.2);
    const dist = muzzle.distanceTo(aim);
    const moving = target.inVehicle ? target.inVehicle.absSpeed : target.speed;
    const miss = (1 - accuracy) * 0.07 + dist * 0.0012 + moving * 0.004;
    const dir = aim.sub(muzzle).normalize();
    dir.x += (this.G.rng() - 0.5) * miss * 2;
    dir.y += (this.G.rng() - 0.5) * miss * 2;
    dir.z += (this.G.rng() - 0.5) * miss * 2;
    dir.normalize();
    this.fire(shooter, muzzle, dir, weaponKey, { isPlayer: false });
  }

  explosion(pos, radius, damage, attacker, source) {
    const G = this.G;
    G.fx.explosion(pos);
    if (G.audio) G.audio.sfx.explosion(pos);
    for (const c of G.characters.slice()) {
      if (c.inVehicle) continue;
      const d = c.pos.distanceTo(pos);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const dx = c.pos.x - pos.x, dz = c.pos.z - pos.z, l = Math.hypot(dx, dz) || 1;
      c.takeDamage(damage * f, { attacker, type: 'explosion' });
      c.knockback((dx / l) * 9 * f, (dz / l) * 9 * f, 4 + 4 * f);
    }
    for (const v of G.vehicles.list) {
      if (v === source || v.isWreck) continue;
      const d = v.pos.distanceTo(pos);
      if (d > radius * 1.2) continue;
      const f = 1 - d / (radius * 1.2);
      v.damage(damage * 4 * f, { attacker, type: 'explosion' });
      const dx = v.pos.x - pos.x, dz = v.pos.z - pos.z, l = Math.hypot(dx, dz) || 1;
      if (v.mode === 'rail' && G.traffic) G.traffic.release(v, true);
      if (v.mode !== 'rail') { v.vx += (dx / l) * 8 * f; v.vz += (dz / l) * 8 * f; if (v.mode === 'parked') v.mode = 'physics'; }
    }
    // an occupant of the exploding vehicle dies with it
    if (source && source.driver && source.driver.alive) source.driver.takeDamage(1000, { attacker, type: 'explosion' });
    G.events.emit('explosion', { pos, attacker });
  }
}
