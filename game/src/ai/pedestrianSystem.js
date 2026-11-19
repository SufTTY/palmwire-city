// Pedestrians: dressed for their district, they stroll the sidewalk ring of their block, cross
// at the corners, stop to idle, dodge speeding cars, and scatter (or cower) when guns go off
// or someone drops nearby. Spawned out of sight around the player and recycled far away.
import { Character } from '../entities/character.js';
import { civilianLook } from '../entities/characterLooks.js';
import { HALF_ROAD } from '../world/cityLayout.js';

const RING = 2; // sidewalk centre line, metres inside the block edge

class Pedestrian extends Character {
  constructor(G, x, z, look) {
    super(G, look, { faction: 'civ', health: 60, x, z });
    this.state = 'walk';
    this.block = null;
    this.corner = 0;
    this.dir = G.rng() < 0.5 ? 1 : -1;
    this.target = null;
    this.timer = 0;
    this.walkSpeed = 1.2 + G.rng() * 0.6;
    this.threat = null;
    this.deadT = 0;
  }

  corners() {
    const b = this.block;
    return [[b.x0 + RING, b.z0 + RING], [b.x1 - RING, b.z0 + RING], [b.x1 - RING, b.z1 - RING], [b.x0 + RING, b.z1 - RING]];
  }

  attachToBlock(layout) {
    const i = Math.floor(this.pos.x / layout.CELL), j = Math.floor(this.pos.z / layout.CELL);
    const b = layout.blockAt(i, j);
    if (!b || b.type === 'water') { this.block = null; return; }
    this.block = b;
    const cs = this.corners();
    let best = 0, bd = Infinity;
    cs.forEach((c, k) => {
      const d = Math.hypot(c[0] - this.pos.x, c[1] - this.pos.z);
      if (d < bd) { bd = d; best = k; }
    });
    this.corner = best;
    this.target = cs[best];
  }

  panic(from, seconds = 8) {
    if (!this.alive) return;
    this.threat = { x: from.x, z: from.z };
    if (this.state !== 'flee' && this.state !== 'cower' && this.G.rng() < 0.2 && Math.hypot(from.x - this.pos.x, from.z - this.pos.z) < 14) {
      this.state = 'cower';
      this.timer = 2 + this.G.rng() * 2;
      if (this.G.audio && this.G.rng() < 0.5) this.G.audio.sfx.scream(this.pos);
      return;
    }
    if (this.state !== 'flee' && this.G.audio && this.G.rng() < 0.25) this.G.audio.sfx.scream(this.pos);
    this.state = 'flee';
    this.timer = seconds;
  }

  think(dt) {
    const G = this.G;
    if (!this.alive) return;
    if (this.state === 'cower') {
      this.pose = 'cower';
      this.steer(0, 0, 10, dt);
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'flee'; this.timer = 6; }
      return;
    }
    this.pose = 'idle';
    if (this.state === 'flee' && this.threat) {
      let dx = this.pos.x - this.threat.x, dz = this.pos.z - this.threat.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const sp = 5.6;
      this.steer(dx * sp, dz * sp, 6, dt);
      this.faceToward(Math.atan2(dx, dz), 8, dt);
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'walk'; this.attachToBlock(G.layout); }
      return;
    }
    if (this.state === 'idle') {
      this.steer(0, 0, 8, dt);
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'walk';
      return;
    }
    if (!this.block || !this.target) { this.attachToBlock(G.layout); if (!this.block) return; }
    const dx = this.target[0] - this.pos.x, dz = this.target[1] - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) {
      this.arrive();
      return;
    }
    this.steer((dx / d) * this.walkSpeed, (dz / d) * this.walkSpeed, 5, dt);
    this.faceToward(Math.atan2(dx, dz), 6, dt);
  }

  arrive() {
    const G = this.G;
    if (this.crossing) {
      this.crossing = false;
      this.attachToBlock(G.layout);
      return;
    }
    if (G.rng() < 0.1) { this.state = 'idle'; this.timer = 2 + G.rng() * 5; }
    // sometimes cross the street to the neighbouring block
    if (G.rng() < 0.22) {
      const [cx, cz] = this.target;
      const b = this.block;
      const sx = Math.sign(cx - (b.x0 + b.x1) / 2), sz = Math.sign(cz - (b.z0 + b.z1) / 2);
      const horizontal = G.rng() < 0.5;
      const tx = horizontal ? cx + sx * (2 * RING + 2 * HALF_ROAD) : cx;
      const tz = horizontal ? cz : cz + sz * (2 * RING + 2 * HALF_ROAD);
      const surf = G.layout.surfaceAt(tx, tz);
      if (surf.type === 'walk') {
        this.target = [tx, tz];
        this.crossing = true;
        return;
      }
    }
    this.corner = (this.corner + this.dir + 4) % 4;
    this.target = this.corners()[this.corner];
  }
}

export class PedestrianSystem {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.max = 28;
    this.timer = 0;
    G.events.on('shotFired', (e) => this.panicAround(e.pos, e.isPlayer ? 45 : 30));
    G.events.on('explosion', (e) => this.panicAround(e.pos, 60));
    G.events.on('characterKilled', (e) => this.panicAround(e.victim.pos, 20));
    G.events.on('pedHitByCar', (e) => this.panicAround(e.victim.pos, 18));
  }

  panicAround(pos, radius) {
    for (const p of this.list) {
      if (!p.alive) continue;
      if (Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < radius) p.panic(pos, 6 + this.G.rng() * 6);
    }
  }

  spawnPed(x, z, look) {
    const p = new Pedestrian(this.G, x, z, look);
    p.attachToBlock(this.G.layout);
    this.list.push(p);
    return p;
  }

  trySpawn() {
    const G = this.G;
    const L = G.layout;
    const pp = G.player.pos;
    for (let tries = 0; tries < 6; tries++) {
      const a = G.rng() * Math.PI * 2, r = 45 + G.rng() * 85;
      const bi = Math.floor((pp.x + Math.cos(a) * r) / L.CELL), bj = Math.floor((pp.z + Math.sin(a) * r) / L.CELL);
      const b = L.blockAt(bi, bj);
      if (!b || b.type === 'water') continue;
      const edge = Math.floor(G.rng() * 4), t = G.rng();
      const x = edge % 2 === 0 ? b.x0 + RING + t * (b.x1 - b.x0 - 2 * RING) : edge === 1 ? b.x1 - RING : b.x0 + RING;
      const z = edge % 2 === 1 ? b.z0 + RING + t * (b.z1 - b.z0 - 2 * RING) : edge === 0 ? b.z0 + RING : b.z1 - RING;
      if (Math.hypot(x - pp.x, z - pp.z) < 38) continue;
      this.spawnPed(x, z, civilianLook(G.rng, b.type));
      return;
    }
  }

  update(dt) {
    const G = this.G;
    this.timer -= dt;
    const alive = this.list.filter((p) => p.alive).length;
    if (this.timer <= 0 && alive < this.max) {
      this.timer = 0.25;
      this.trySpawn();
    }
    const pp = G.player.pos;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const p = this.list[k];
      const d = Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z);
      if (!p.alive) p.deadT += dt;
      if (d > 170 || (!p.alive && p.deadT > 45) || p.removed) {
        p.remove();
        this.list.splice(k, 1);
        continue;
      }
      // dodge cars bearing down on them
      if (p.alive && p.state === 'walk') {
        for (const v of G.vehicles.list) {
          if (v.absSpeed < 9) continue;
          const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
          const dd = Math.hypot(dx, dz);
          if (dd > 12) continue;
          if ((dx * v.vx + dz * v.vz) / (dd * v.absSpeed) > 0.8) { p.panic(v.pos, 2.5); break; }
        }
      }
      p.think(dt);
      p.physics(dt);
    }
  }
}
