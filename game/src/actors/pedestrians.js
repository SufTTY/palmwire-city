// Pedestrians: a capped crowd that strolls the sidewalk loops and the beach boardwalk,
// crosses at corners, idles and chats, and scatters from gunfire, bodies and fast cars.
import { Human, randomLook } from './human.js';
import { Rng } from '../core/rng.js';
import { BLOCK, GRID, BEACH_Z0, CANAL_COL } from '../config.js';

export class PedestrianSystem {
  constructor(game, { cap = 38 } = {}) {
    this.game = game;
    this.cap = cap;
    this.rng = new Rng(game.seed * 3 + 11);
    this.list = [];
    this.spawnTimer = 0;
    game.events.on('gunshot', (e) => this.alarm(e.x, e.z, e.radius || 35));
    game.events.on('explosion', (e) => this.alarm(e.x, e.z, 50));
    game.events.on('death', (e) => { if (e.human.role !== 'player') this.alarm(e.human.pos.x, e.human.pos.z, 18); });
  }

  loopFor(x, z) {
    if (z > BEACH_Z0 && x < CANAL_COL * BLOCK) {
      // the boardwalk strip as a long thin loop
      const cx = Math.max(-40, Math.min(600, x));
      return { x0: cx - 60, z0: BEACH_Z0 + 5.5, x1: cx + 60, z1: BEACH_Z0 + 9.5 };
    }
    const bx = Math.max(0, Math.min(GRID - 1, Math.floor(x / BLOCK)));
    const bz = Math.max(0, Math.min(GRID - 1, Math.floor(z / BLOCK)));
    return this.game.layout.sidewalkLoop(bx, bz);
  }

  corners(L) { return [[L.x0, L.z0], [L.x1, L.z0], [L.x1, L.z1], [L.x0, L.z1]]; }

  spawnAt(x, z, opts = {}) {
    const h = new Human(this.game, { x, z, role: 'ped', look: opts.look || randomLook(this.rng), health: 60 });
    const L = this.loopFor(x, z);
    h.ai = { mode: 'walk', loop: L, corner: this.rng.int(0, 3), dir: this.rng.sign(), speed: this.rng.range(1.2, 1.8), timer: 0, from: null };
    this.snapToLoop(h);
    if (opts.flee) this.flee(h, opts.flee.x, opts.flee.z, 8);
    this.list.push(h);
    return h;
  }

  snapToLoop(h) {
    const L = h.ai.loop;
    const cs = this.corners(L);
    let best = 0, bd = Infinity;
    cs.forEach(([cx, cz], i) => { const d = Math.hypot(cx - h.pos.x, cz - h.pos.z); if (d < bd) { bd = d; best = i; } });
    h.ai.corner = best;
  }

  flee(h, fx, fz, seconds) {
    if (!h.alive) return;
    h.ai.mode = 'flee';
    h.ai.timer = seconds;
    h.ai.from = { x: fx, z: fz };
  }

  /** Everyone within radius panics: cower if very close, otherwise run. */
  alarm(x, z, radius) {
    for (const h of this.list) {
      if (!h.alive) continue;
      const d = Math.hypot(h.pos.x - x, h.pos.z - z);
      if (d < radius) {
        if (d < 6 && this.rng.chance(0.35)) { h.ai.mode = 'cower'; h.ai.timer = this.rng.range(2, 4); }
        else this.flee(h, x, z, this.rng.range(5, 9));
      }
    }
  }

  randomSidewalkPoint(focus, minD, maxD) {
    for (let i = 0; i < 20; i++) {
      const ang = this.rng.float() * Math.PI * 2, d = this.rng.range(minD, maxD);
      const x = focus.x + Math.sin(ang) * d, z = focus.z + Math.cos(ang) * d;
      const L = this.loopFor(x, z);
      const cs = this.corners(L);
      const k = this.rng.int(0, 3), k2 = (k + 1) % 4, t = this.rng.float();
      const px = cs[k][0] + (cs[k2][0] - cs[k][0]) * t, pz = cs[k][1] + (cs[k2][1] - cs[k][1]) * t;
      if (this.game.layout.isWater(px, pz) || this.game.colliders.pointInside(px, pz)) continue;
      if (Math.hypot(px - focus.x, pz - focus.z) < minD) continue;
      return { x: px, z: pz };
    }
    return null;
  }

  update(dt) {
    const g = this.game;
    const focus = g.player.focus;
    const pv = g.player.human.vehicle;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      const d = Math.hypot(h.pos.x - focus.x, h.pos.z - focus.z);
      if (d > 160 || (!h.alive && (h.deadTime += dt) > 25)) { this.list.splice(i, 1); continue; }
      if (!h.alive) continue;
      if (h.updateDown(dt)) { h.pose = 'down'; h.fall = 1; continue; }
      // dodge the player's car when it's coming at speed
      if (pv && pv.speed > 9) {
        const dx = h.pos.x - pv.pos.x, dz = h.pos.z - pv.pos.z;
        const dd = Math.hypot(dx, dz);
        if (dd < 14 && (dx * pv.vel.x + dz * pv.vel.z) > 0) {
          const side = (dx * pv.vel.z - dz * pv.vel.x) > 0 ? 1 : -1;
          if (h.ai.mode !== 'flee') this.flee(h, h.pos.x - pv.vel.z * side, h.pos.z + pv.vel.x * side, 3);
        }
      }
      this.think(h, dt);
    }
    // keep the crowd topped up
    this.spawnTimer -= dt;
    const cap = g.player.human.vehicle ? Math.floor(this.cap * 0.75) : this.cap;
    if (this.list.length < cap && this.spawnTimer <= 0) {
      this.spawnTimer = 0.15;
      const p = this.randomSidewalkPoint(focus, 35, 120);
      if (p) {
        const h = this.spawnAt(p.x, p.z);
        if (this.rng.chance(0.15)) { h.ai.mode = 'idle'; h.ai.timer = this.rng.range(4, 12); }
      }
    }
  }

  think(h, dt) {
    const ai = h.ai;
    if (ai.mode === 'cower') {
      ai.timer -= dt;
      h.pose = 'cower';
      h.locomote(dt, 0, 0);
      if (ai.timer <= 0) this.flee(h, ai.from ? ai.from.x : h.pos.x + 1, ai.from ? ai.from.z : h.pos.z, 5);
      return;
    }
    if (ai.mode === 'flee') {
      ai.timer -= dt;
      let dx = h.pos.x - ai.from.x, dz = h.pos.z - ai.from.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const sp = 5.6;
      h.locomote(dt, dx * sp, dz * sp, null, 8);
      h.pose = 'run';
      if (ai.timer <= 0) { ai.mode = 'walk'; ai.loop = this.loopFor(h.pos.x, h.pos.z); this.snapToLoop(h); }
      return;
    }
    if (ai.mode === 'idle') {
      ai.timer -= dt;
      h.locomote(dt, 0, 0);
      h.pose = 'idle';
      if (ai.timer <= 0) ai.mode = 'walk';
      return;
    }
    // walking the loop
    const cs = this.corners(ai.loop);
    const [tx, tz] = cs[ai.corner];
    const dx = tx - h.pos.x, dz = tz - h.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) {
      if (this.rng.chance(0.12)) {
        // cross to the neighbouring block's sidewalk
        const ox = Math.sign(tx - (ai.loop.x0 + ai.loop.x1) / 2), oz = Math.sign(tz - (ai.loop.z0 + ai.loop.z1) / 2);
        const horiz = this.rng.chance(0.5);
        const nx = h.pos.x + (horiz ? ox * 15 : 0), nz = h.pos.z + (horiz ? 0 : oz * 15);
        if (!this.game.layout.isWater(nx, nz)) { ai.loop = this.loopFor(nx, nz); this.snapToLoop(h); return; }
      }
      if (this.rng.chance(0.08)) { ai.mode = 'idle'; ai.timer = this.rng.range(2, 6); }
      ai.corner = (ai.corner + ai.dir + 4) % 4;
      return;
    }
    h.locomote(dt, (dx / d) * ai.speed, (dz / d) * ai.speed, null, 6);
    h.pose = 'walk';
  }
}
