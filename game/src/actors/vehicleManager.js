// Owns every vehicle: spawning and despawning, kerbside parked cars, physics stepping, and
// collisions against buildings, other vehicles and people (with damage, crimes and sparks).
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { pickCivilianType, VEHICLE_TYPES } from './vehicleTypes.js';
import { Rng, hash2 } from '../core/rng.js';
import { BLOCK, GRID, ROAD_HALF, WALK, CITY } from '../config.js';

const PARK_OFFSET = ROAD_HALF - 1.05;

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.rng = new Rng(game.seed * 13 + 1);
    this.burntMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1715, roughness: 1 });
    this.parkedSlots = this.planParkedSlots();
    this.activeSlots = new Map(); // slot index -> vehicle
    this.slotCheck = 0;
  }

  spawn(typeKey, opts = {}) {
    const t = VEHICLE_TYPES[typeKey];
    const paint = opts.paint ?? t.paints[Math.floor(this.rng.float() * t.paints.length)];
    const v = new Vehicle(this.game, typeKey, { ...opts, paint });
    this.list.push(v);
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    if (v.slot !== undefined) this.activeSlots.delete(v.slot);
    v.dispose();
  }

  planParkedSlots() {
    const slots = [];
    for (let k = 0; k <= GRID; k++) {
      for (let s = 0; s < GRID; s++) {
        for (let n = 0; n < 3; n++) {
          const h = hash2(k * 31 + s, n, 77);
          if (h > 0.34) continue;
          const along = s * BLOCK + ROAD_HALF + WALK + 6 + n * 14 + hash2(k, s + n, 5) * 4;
          const side = hash2(k, s, n + 9) < 0.5 ? -1 : 1;
          const horiz = hash2(s, k, n + 3) < 0.5;
          const x = horiz ? along : k * BLOCK + side * PARK_OFFSET;
          const z = horiz ? k * BLOCK + side * PARK_OFFSET : along;
          if (x < 2 || z < 2 || x > CITY - 2 || z > CITY - 2) continue;
          // face along traffic on that side (right-hand traffic)
          const yaw = horiz ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
          slots.push({ x, z, yaw, type: pickCivilianType(new Rng(Math.floor(h * 1e6) + 3)) });
        }
      }
    }
    return slots;
  }

  /** Keep kerbside cars around the player, created and removed by distance. */
  updateParked(focus) {
    this.slotCheck -= 1;
    if (this.slotCheck > 0) return;
    this.slotCheck = 20;
    const near = 170, far = 230;
    this.parkedSlots.forEach((s, i) => {
      const d = Math.hypot(s.x - focus.x, s.z - focus.z);
      const v = this.activeSlots.get(i);
      if (!v && d < near) {
        if (this.game.layout.isWater(s.x, s.z)) return;
        const nv = this.spawn(s.type, { x: s.x, z: s.z, yaw: s.yaw });
        nv.parked = true; nv.slot = i;
        this.activeSlots.set(i, nv);
      } else if (v && d > far && !v.persistent && !v.driver) {
        this.remove(v);
      }
    });
  }

  nearestEnterable(x, z, maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const v of this.list) {
      if (v.destroyed) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z) - v.radius;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  update(dt) {
    const g = this.game;
    for (const v of this.list) v.update(dt);
    this.collideStatic();
    this.collideVehicles();
    this.collideHumans();
    // fire and smoke on wrecks and badly damaged cars
    for (const v of this.list) {
      if (v.destroyed) {
        v.wreckTime = (v.wreckTime || 0) + dt;
        if (v.wreckTime < 12 && Math.random() < dt * 12) g.fx.particles.fire(v.pos.x, 1.2, v.pos.z, 0.5);
        if (Math.random() < dt * 6) g.fx.particles.smoke(v.pos.x, 1.8, v.pos.z, 1.0, 0x222222);
      } else if (v.health < v.maxHealth * 0.3) {
        const f = v.forward;
        if (Math.random() < dt * (v.health <= 0 ? 20 : 7)) g.fx.particles.smoke(v.pos.x + f.x * v.halfLen * 0.7, 1.1, v.pos.z + f.z * v.halfLen * 0.7, 0.5, v.health <= 0 ? 0x2a2a2a : 0x8a8a8a);
        if (v.health <= 0 && Math.random() < dt * 14) g.fx.particles.fire(v.pos.x + f.x * v.halfLen * 0.6, 1.0, v.pos.z + f.z * v.halfLen * 0.6, 0.3);
      }
    }
    // remove old wrecks far from the player
    const p = g.player.focus;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v.destroyed && v.wreckTime > 30 && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) > 60 && !v.persistent) this.remove(v);
    }
    this.updateParked(p);
  }

  collideStatic() {
    const g = this.game;
    const b = g.layout.worldBounds();
    for (const v of this.list) {
      if (v.speed < 0.01 && v.parked) continue;
      for (const c of v.circles()) {
        const p = { x: c.x, z: c.z };
        const n = g.colliders.resolveCircle(p, v.radius, 0.3);
        if (n.hit) {
          v.pos.x += p.x - c.x; v.pos.z += p.z - c.z;
          const impact = v.bounce(n.x, n.z, 0.2);
          if (impact > 7) {
            v.damage((impact - 7) * 2.2);
            g.events.emit('vehicleImpact', { vehicle: v, impact, x: c.x, z: c.z });
          }
          // spin a little when clipping a corner
          v.yawRate += (n.x * v.forward.z - n.z * v.forward.x) * impact * 0.02;
        }
      }
      v.pos.x = Math.max(b.x0, Math.min(b.x1, v.pos.x));
      v.pos.z = Math.max(b.z0, Math.min(b.z1 - 25, v.pos.z));
    }
  }

  collideVehicles() {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx0 = b.pos.x - a.pos.x, dz0 = b.pos.z - a.pos.z;
        const reach = a.halfLen + b.halfLen;
        if (dx0 * dx0 + dz0 * dz0 > reach * reach) continue;
        const ca = a.circles(), cb = b.circles();
        for (const p of ca) for (const q of cb) {
          const dx = q.x - p.x, dz = q.z - p.z;
          const rr = a.radius + b.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
          const ma = a.parked && a.speed < 0.5 ? a.mass * 1.5 : a.mass, mb = b.parked && b.speed < 0.5 ? b.mass * 1.5 : b.mass;
          const wa = mb / (ma + mb), wb = ma / (ma + mb);
          a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa;
          b.pos.x += nx * pen * wb; b.pos.z += nz * pen * wb;
          const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
          if (rv < 0) {
            const jImp = -(1.3) * rv / (1 / ma + 1 / mb);
            a.vel.x -= (jImp / ma) * nx; a.vel.z -= (jImp / ma) * nz;
            b.vel.x += (jImp / mb) * nx; b.vel.z += (jImp / mb) * nz;
            const impact = -rv;
            if (impact > 4) {
              a.parked = false; b.parked = false;
              a.damage((impact - 4) * 1.6 * (mb / ma), b.driver); b.damage((impact - 4) * 1.6 * (ma / mb), a.driver);
              a.yawRate += (Math.random() - 0.5) * impact * 0.08;
              b.yawRate += (Math.random() - 0.5) * impact * 0.08;
              this.game.events.emit('vehicleCrash', { a, b, impact, x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 });
            }
          }
        }
      }
    }
  }

  collideHumans() {
    const g = this.game;
    const humans = g.allHumans();
    for (const v of this.list) {
      const sp = v.speed;
      for (const h of humans) {
        if (h.vehicle || h.pos.y > 2.5) continue;
        const dx0 = h.pos.x - v.pos.x, dz0 = h.pos.z - v.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > (v.halfLen + 1) * (v.halfLen + 1)) continue;
        for (const c of v.circles()) {
          const dx = h.pos.x - c.x, dz = h.pos.z - c.z;
          const rr = v.radius + h.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
          h.pos.x += nx * (rr - d); h.pos.z += nz * (rr - d);
          if (sp > 4.5 && h.alive && h.downTimer <= 0) {
            const dmg = sp * 3.2;
            h.knockDown(v.vel.x * 0.7 + nx * 3, v.vel.z * 0.7 + nz * 3, 2.2);
            const killed = h.damage(dmg, v.driver, 'vehicle');
            g.fx.particles.blood(h.pos.x, 1.0, h.pos.z, 8);
            g.events.emit('humanHitByVehicle', { human: h, vehicle: v, driver: v.driver, killed });
            v.vel.multiplyScalar(0.93);
          }
          break;
        }
      }
    }
  }

  /** Damage cars caught in an explosion and fling them. */
  applyExplosion(x, z, radius, source) {
    for (const v of this.list) {
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d > radius) continue;
      const k = 1 - d / radius;
      v.damage(160 * k, source);
      const nx = (v.pos.x - x) / (d || 1), nz = (v.pos.z - z) / (d || 1);
      v.vel.x += nx * 12 * k; v.vel.z += nz * 12 * k;
      v.yawRate += (Math.random() - 0.5) * 3 * k;
      v.parked = false;
    }
  }
}
