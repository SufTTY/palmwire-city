// Owns every vehicle: spawns parked cars in lots and driveways near the player (and recycles
// them when far away), steps physics, resolves car-vs-car and car-vs-person collisions
// (people get thrown, cars get dented), and finds the nearest car to enter or steal.
import { Vehicle } from './vehicle.js';
import { PARKED_TYPES } from './vehicleTypes.js';
import { hash2 } from '../core/rng.js';

const PARK_NEAR = 150;
const PARK_FAR = 200;

export class VehicleManager {
  constructor(G, parkingSpots) {
    this.G = G;
    this.list = [];
    this.spots = parkingSpots.map((s, k) => ({ ...s, k, vehicle: null, cooldown: 0 }));
    this.spotTimer = 0;
  }

  spawn(type, opts) {
    const v = new Vehicle(this.G, type, opts);
    this.list.push(v);
    return v;
  }

  remove(v) {
    v.remove();
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    for (const s of this.spots) if (s.vehicle === v) s.vehicle = null;
  }

  /** Nearest vehicle the player could get into. */
  findEnterable(pos, maxDist = 4.2) {
    let best = null, bd = maxDist;
    for (const v of this.list) {
      if (v.isWreck || v.inWater || v.removed) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) - v.T.wid * 0.4;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  managePark(dt) {
    this.spotTimer -= dt;
    if (this.spotTimer > 0) return;
    this.spotTimer = 0.5;
    const p = this.G.player.pos;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (s.vehicle) {
        const v = s.vehicle;
        if (v.removed) { s.vehicle = null; continue; }
        if (v.mode !== 'parked') { s.vehicle = null; s.cooldown = 60; continue; }
        if (d > PARK_FAR && !v.persistent) { this.remove(v); s.vehicle = null; }
      } else if (d < PARK_NEAR && d > 25) {
        s.cooldown -= 0.5;
        if (s.cooldown > 0) continue;
        if (hash2(s.k, 3, 11) < 0.25) continue; // some bays stay empty
        const type = PARKED_TYPES[Math.floor(hash2(s.k, 1, 7) * PARKED_TYPES.length)];
        const T = this.spawn(type, { x: s.x, z: s.z, heading: s.heading, mode: 'parked' });
        s.vehicle = T;
      }
    }
  }

  update(dt) {
    const G = this.G;
    this.managePark(dt);
    for (const v of this.list) {
      v.physics(dt);
      v.update(dt);
    }
    this.collideVehicles();
    this.collideCharacters(dt);
    // recycle abandoned cars far away
    const p = G.player.pos;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const v = this.list[k];
      if (v.removed) { this.list.splice(k, 1); continue; }
      if (v.persistent || v.driver || v.mode === 'rail' || v === G.player.vehicle) continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      if (d > 320 || (v.isWreck && v.wreckT > 40 && d > 60)) this.remove(v);
    }
  }

  updateVisuals(dt, camPos) {
    for (const v of this.list) v.updateVisual(dt, camPos);
  }

  collideVehicles() {
    const L = this.list;
    for (let a = 0; a < L.length; a++) {
      const A = L[a];
      for (let b = a + 1; b < L.length; b++) {
        const B = L[b];
        const dx = A.pos.x - B.pos.x, dz = A.pos.z - B.pos.z;
        const rr = A.radius + B.radius;
        if (dx * dx + dz * dz > rr * rr) continue;
        if (A.mode === 'parked' && B.mode === 'parked') continue;
        if (A.mode === 'rail' && B.mode === 'rail') continue;
        let best = null;
        for (const ca of A.circles()) for (const cb of B.circles()) {
          const ex = ca[0] - cb[0], ez = ca[1] - cb[1];
          const d = Math.hypot(ex, ez), r = ca[2] + cb[2];
          if (d < r && (!best || r - d > best.depth)) best = { nx: d > 1e-4 ? ex / d : 1, nz: d > 1e-4 ? ez / d : 0, depth: r - d };
        }
        if (!best) continue;
        this.resolvePair(A, B, best);
      }
    }
  }

  resolvePair(A, B, c) {
    const G = this.G;
    const relV = (A.vx - B.vx) * c.nx + (A.vz - B.vz) * c.nz;
    // rail traffic and parked cars become physical when struck
    for (const v of [A, B]) {
      if (v.mode === 'rail' && Math.abs(relV) > 2.5 && G.traffic) G.traffic.release(v, true);
      if (v.mode === 'parked' && Math.abs(relV) > 1) v.mode = 'physics';
    }
    const imA = A.mode === 'rail' ? 0 : 1 / A.T.mass;
    const imB = B.mode === 'rail' ? 0 : 1 / B.T.mass;
    const sum = imA + imB || 1;
    A.pos.x += c.nx * c.depth * (imA / sum);
    A.pos.z += c.nz * c.depth * (imA / sum);
    B.pos.x -= c.nx * c.depth * (imB / sum);
    B.pos.z -= c.nz * c.depth * (imB / sum);
    if (relV < 0) {
      const j = (-(1.3) * relV) / sum;
      A.vx += c.nx * j * imA; A.vz += c.nz * j * imA;
      B.vx -= c.nx * j * imB; B.vz -= c.nz * j * imB;
      A.angVel += (G.rng() - 0.5) * Math.min(2, -relV * 0.08);
      B.angVel += (G.rng() - 0.5) * Math.min(2, -relV * 0.08);
      if (-relV > 4) {
        A.onImpact(-relV, B);
        B.onImpact(-relV, A);
      }
    }
  }

  collideCharacters(dt) {
    const G = this.G;
    for (const ch of G.characters) {
      if (ch.inVehicle || ch.removed) continue;
      for (const v of this.list) {
        const dx = ch.pos.x - v.pos.x, dz = ch.pos.z - v.pos.z;
        if (dx * dx + dz * dz > (v.radius + 1) ** 2) continue;
        if (Math.abs(ch.pos.y - v.pos.y) > 2) continue;
        for (const [cx, cz, r] of v.circles()) {
          const ex = ch.pos.x - cx, ez = ch.pos.z - cz;
          const d = Math.hypot(ex, ez), rr = r + ch.radius;
          if (d >= rr) continue;
          const nx = d > 1e-4 ? ex / d : 1, nz = d > 1e-4 ? ez / d : 0;
          const sp = v.absSpeed;
          const closing = v.vx * nx + v.vz * nz; // how fast the car moves toward the person
          if (sp > 4 && closing > 2 && ch.alive && ch.knockT <= 0) {
            const dmg = sp * sp * 0.55;
            ch.knockback(v.vx * 0.8 + nx * 3, v.vz * 0.8 + nz * 3, 3 + sp * 0.18);
            ch.takeDamage(dmg, { attacker: v.driver, type: 'vehicle', vehicle: v });
            G.events.emit('pedHitByCar', { victim: ch, vehicle: v, driver: v.driver, speed: sp });
            v.vx *= 0.92; v.vz *= 0.92;
          } else {
            ch.pos.x += nx * (rr - d);
            ch.pos.z += nz * (rr - d);
          }
          break;
        }
      }
    }
    void dt;
  }
}
