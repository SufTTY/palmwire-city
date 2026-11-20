// Shared AI driving: follows lane waypoints through the road graph with pure-pursuit
// steering, slows for corners, stops at red signals and for whatever is ahead, recovers
// when stuck, and can switch to direct pursuit of a target (police rams, chases).
import { STOP_DIST } from '../world/roadGraph.js';
import { BLOCK } from '../config.js';
import { clamp, wrapAngle } from '../core/mathUtil.js';

export class AIDriver {
  /**
   * opts.nextNode(prev, cur) -> node id: route policy (random, toward target, race list)
   * opts.cruise: desired speed m/s; opts.obeySignals; opts.caution (0..1 obstacle braking)
   */
  constructor(game, vehicle, { a, b, nextNode, cruise = 12, obeySignals = true, caution = 1 } = {}) {
    this.game = game;
    this.v = vehicle;
    this.nextNode = nextNode;
    this.cruise = cruise;
    this.obeySignals = obeySignals;
    this.caution = caution;
    this.queue = [];
    this.prev = a;
    this.cur = b;
    this.stuck = 0;
    this.reverse = 0;
    this.direct = null;        // {x,z} target for direct pursuit
    this.directSpeed = 30;
    this.panic = 0;
    this.blockedBy = null;
    this.stopped = false;
    vehicle.ai = this;
    if (a !== undefined && b !== undefined) {
      const along = this.projectAlong(a, b);
      this.queue.push({ ...game.roadGraph.lanePoint(a, b, Math.min(BLOCK - STOP_DIST, along + 6)) });
      this.extend();
    }
  }

  projectAlong(a, b) {
    const pa = this.game.roadGraph.pos(a), d = this.game.roadGraph.dir(a, b);
    return (this.v.pos.x - pa.x) * d.x + (this.v.pos.z - pa.z) * d.z;
  }

  /** Re-anchor on the nearest road segment (after pursuit or a crash). */
  reanchor() {
    const rg = this.game.roadGraph;
    const v = this.v;
    const n = rg.nearestNode(v.pos.x, v.pos.z);
    const f = v.forward;
    let best = null, bd = -2;
    for (const m of rg.neighbors(n)) {
      const d = rg.dir(n, m);
      const dot = d.x * f.x + d.z * f.z;
      if (dot > bd) { bd = dot; best = m; }
    }
    // decide whether we are before or after node n on that axis
    const d = rg.dir(n, best);
    const pn = rg.pos(n);
    const ahead = (v.pos.x - pn.x) * d.x + (v.pos.z - pn.z) * d.z;
    this.queue.length = 0;
    if (ahead >= 0) { this.prev = n; this.cur = best; }
    else {
      const [i, j] = rg.ij(n);
      const back = rg.valid(i - d.x, j - d.z) ? rg.id(i - d.x, j - d.z) : best;
      this.prev = back; this.cur = n;
    }
    const along = this.projectAlong(this.prev, this.cur);
    this.queue.push(rg.lanePoint(this.prev, this.cur, clamp(along + 8, STOP_DIST, BLOCK - STOP_DIST)));
    this.extend();
  }

  extend() {
    const rg = this.game.roadGraph;
    let guard = 0;
    while (this.queue.length < 10 && guard++ < 6) {
      const next = this.nextNode(this.prev, this.cur);
      const stopPt = rg.lanePoint(this.prev, this.cur, BLOCK - STOP_DIST);
      const turn = rg.turnPoints(this.prev, this.cur, next);
      this.queue.push({ x: stopPt.x, z: stopPt.z, stop: rg.axisOf(this.prev, this.cur) });
      for (const p of turn.curve) this.queue.push({ x: p.x, z: p.z, inTurn: true });
      this.queue.push({ x: turn.pOut.x, z: turn.pOut.z });
      this.prev = this.cur;
      this.cur = next;
    }
  }

  /** Speed limit from things in front of us. */
  obstacleLimit(desired) {
    const g = this.game, v = this.v, f = v.forward;
    let limit = desired;
    const check = (x, z, rad, isPerson) => {
      const dx = x - v.pos.x, dz = z - v.pos.z;
      const along = dx * f.x + dz * f.z;
      if (along < 0 || along > 26) return;
      const lat = Math.abs(dx * f.z - dz * f.x);
      if (lat > 1.9 + rad) return;
      const gap = along - v.halfLen - rad - (isPerson ? 2 : 1.5);
      limit = Math.min(limit, Math.max(0, gap * 0.85));
      if (gap < 3) this.blockedBy = isPerson ? 'person' : 'car';
    };
    for (const o of g.vehicles.list) {
      if (o === v) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
      if (dx * dx + dz * dz > 900) continue;
      check(o.pos.x, o.pos.z, o.halfLen * 0.8, false);
    }
    const p = g.player;
    if (!p.human.vehicle && p.human.alive) check(p.human.pos.x, p.human.pos.z, 0.5, true);
    // pedestrians crossing (police in a hurry and racers don't wait for them)
    if (this.caution >= 0.9) {
      for (const h of g.peds.list) {
        if (!h.alive) continue;
        const dx = h.pos.x - v.pos.x, dz = h.pos.z - v.pos.z;
        if (dx * dx + dz * dz < 700) check(h.pos.x, h.pos.z, 0.4, true);
      }
    }
    return limit * this.caution + desired * (1 - this.caution);
  }

  update(dt) {
    const v = this.v, g = this.game;
    const c = v.controls;
    if (v.destroyed || v.health <= 0) { c.throttle = 0; c.brake = 1; c.steer = 0; return; }
    this.blockedBy = null;
    let tx, tz, desired;
    if (this.direct) {
      tx = this.direct.x; tz = this.direct.z;
      desired = this.directSpeed;
    } else {
      // drop reached waypoints
      while (this.queue.length) {
        const w = this.queue[0];
        const dx = w.x - v.pos.x, dz = w.z - v.pos.z;
        const d = Math.hypot(dx, dz);
        const behind = dx * v.forward.x + dz * v.forward.z < 0;
        if (d < 3.5 || (behind && d < 9)) this.queue.shift(); else break;
      }
      if (this.queue.length < 8) this.extend();
      const look = 5 + v.speed * 0.45;
      let target = this.queue[0];
      for (const w of this.queue) {
        target = w;
        if (Math.hypot(w.x - v.pos.x, w.z - v.pos.z) >= look) break;
      }
      tx = target.x; tz = target.z;
      desired = this.cruise;
      // corner speed: look at the bend a little further on
      const far = this.queue[Math.min(this.queue.length - 1, 4)];
      const bend = Math.abs(wrapAngle(Math.atan2(far.x - v.pos.x, far.z - v.pos.z) - v.yaw));
      if (this.queue.slice(0, 5).some((w) => w.inTurn)) desired = Math.min(desired, Math.max(7, this.cruise * (1 - bend * 0.55)));
      // signals
      if (this.obeySignals) {
        const sw = this.queue.slice(0, 3).find((w) => w.stop);
        if (sw) {
          const d = Math.hypot(sw.x - v.pos.x, sw.z - v.pos.z);
          const state = g.roadGraph.phase[sw.stop];
          if (state === 'red' || (state === 'yellow' && d > 14)) {
            desired = Math.min(desired, Math.max(0, (d - 2.5) * 0.7));
            if (d < 4) desired = 0;
          }
        }
      }
      if (this.panic > 0) { this.panic -= dt; desired = Math.max(desired, this.cruise * 1.6); }
    }
    desired = this.obstacleLimit(desired);

    // steering toward target
    const want = Math.atan2(tx - v.pos.x, tz - v.pos.z);
    const diff = wrapAngle(want - v.yaw);
    const fwd = v.forwardSpeed;
    if (this.reverse > 0) {
      this.reverse -= dt;
      c.throttle = 0; c.brake = 1; c.steer = clamp(diff * 2, -1, 1); c.handbrake = false;
      return;
    }
    c.steer = clamp(-diff * 2.2, -1, 1);
    c.handbrake = this.direct ? Math.abs(diff) > 1.1 && fwd > 12 : false;
    if (fwd < desired - 0.4) { c.throttle = clamp((desired - fwd) * 0.35 + 0.25, 0, 1); c.brake = 0; }
    else if (fwd > desired + 0.8) { c.throttle = 0; c.brake = clamp((fwd - desired) * 0.3, 0.1, 1); }
    else { c.throttle = 0.15; c.brake = 0; }
    if (desired < 0.3 && fwd < 0.6) { c.throttle = 0; c.brake = 0.4; }
    this.stopped = desired < 0.3;

    // stuck: pushing but not moving, and nothing legitimately in front
    if (c.throttle > 0.3 && Math.abs(fwd) < 0.6 && !this.blockedBy) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 1.6) { this.stuck = 0; this.reverse = 1.3; }
  }
}
