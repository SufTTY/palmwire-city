// The drivable road network: grid intersections as nodes, lane geometry for right-hand
// traffic, the shared traffic-signal cycle, and breadth-first routing for police and AI.
import { BLOCK, GRID, CITY, LANE, ROAD_HALF, WALK } from '../config.js';

const CYCLE = 18;        // seconds for a full signal cycle
const GREEN = 7.5;       // green time per axis (then 1.5 s amber)
export const STOP_DIST = ROAD_HALF + WALK + 1.4; // distance from node centre to the stop line

export class RoadGraph {
  constructor(game) {
    this.game = game;
    this.n = GRID + 1;
    this.time = 0;
    this.phase = { x: 'green', z: 'red' };
  }

  id(i, j) { return i * this.n + j; }
  ij(id) { return [Math.floor(id / this.n), id % this.n]; }
  pos(id) { const [i, j] = this.ij(id); return { x: i * BLOCK, z: j * BLOCK }; }
  valid(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n; }

  neighbors(id) {
    const [i, j] = this.ij(id);
    const out = [];
    if (this.valid(i + 1, j)) out.push(this.id(i + 1, j));
    if (this.valid(i - 1, j)) out.push(this.id(i - 1, j));
    if (this.valid(i, j + 1)) out.push(this.id(i, j + 1));
    if (this.valid(i, j - 1)) out.push(this.id(i, j - 1));
    return out;
  }

  nearestNode(x, z) {
    const i = Math.max(0, Math.min(GRID, Math.round(x / BLOCK)));
    const j = Math.max(0, Math.min(GRID, Math.round(z / BLOCK)));
    return this.id(i, j);
  }

  /** Unit direction from node a to node b. */
  dir(a, b) {
    const pa = this.pos(a), pb = this.pos(b);
    return { x: Math.sign(pb.x - pa.x), z: Math.sign(pb.z - pa.z) };
  }

  /** Right-hand vector for a travel direction (forward = (dx,dz)). */
  static right(d) { return { x: -d.z, z: d.x }; }

  /** Lane centre point at distance `along` from node a toward b. */
  lanePoint(a, b, along) {
    const pa = this.pos(a), d = this.dir(a, b);
    const r = { x: -d.z, z: d.x };
    return { x: pa.x + d.x * along + r.x * LANE, z: pa.z + d.z * along + r.z * LANE };
  }

  /**
   * Points for driving from a through b to c: the end of lane a→b at the stop line, a
   * curve through the intersection, and the start of lane b→c.
   */
  turnPoints(a, b, c) {
    const pIn = this.lanePoint(a, b, BLOCK - STOP_DIST);
    const pOut = this.lanePoint(b, c, STOP_DIST);
    const dIn = this.dir(a, b);
    let ctrl;
    const dOut = this.dir(b, c);
    if (dIn.x === dOut.x && dIn.z === dOut.z) ctrl = { x: (pIn.x + pOut.x) / 2, z: (pIn.z + pOut.z) / 2 };
    else if (dIn.x !== 0) ctrl = { x: pOut.x, z: pIn.z };
    else ctrl = { x: pIn.x, z: pOut.z };
    const pts = [];
    for (let k = 1; k <= 5; k++) {
      const t = k / 6, u = 1 - t;
      pts.push({ x: u * u * pIn.x + 2 * u * t * ctrl.x + t * t * pOut.x, z: u * u * pIn.z + 2 * u * t * ctrl.z + t * t * pOut.z });
    }
    return { pIn, curve: pts, pOut };
  }

  /** Axis a vehicle travelling from a to b uses at the next signal: 'x' or 'z'. */
  axisOf(a, b) { return this.dir(a, b).x !== 0 ? 'x' : 'z'; }

  canGo(axis) { return this.phase[axis] === 'green'; }

  /** Random onward node that is not a U-turn (unless a dead end). */
  randomNext(prev, cur, rng) {
    const opts = this.neighbors(cur).filter((n) => n !== prev);
    if (!opts.length) return prev;
    // prefer going straight a bit more often
    if (prev !== undefined && prev !== null) {
      const d = this.dir(prev, cur);
      const [i, j] = this.ij(cur);
      const straight = this.id(i + d.x, j + d.z);
      if (this.valid(i + d.x, j + d.z) && rng.chance(0.45)) return straight;
    }
    return opts[Math.floor(rng.float() * opts.length)];
  }

  /** Breadth-first route of node ids from start to goal (grid, so BFS = shortest). */
  route(start, goal, maxLen = 60) {
    if (start === goal) return [start];
    const prev = new Map([[start, -1]]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      for (const n of this.neighbors(cur)) {
        if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
      }
    }
    if (!prev.has(goal)) return [start];
    const path = [];
    for (let c = goal; c !== -1; c = prev.get(c)) path.push(c);
    path.reverse();
    return path.slice(0, maxLen);
  }

  /** Random lane position on a road segment near a point, for spawning cars. */
  spawnSlot(x, z, rng, minD, maxD, avoid) {
    for (let tries = 0; tries < 30; tries++) {
      const ang = rng.float() * Math.PI * 2, d = rng.range(minD, maxD);
      const a = this.nearestNode(x + Math.sin(ang) * d, z + Math.cos(ang) * d);
      const nbs = this.neighbors(a);
      const b = nbs[Math.floor(rng.float() * nbs.length)];
      const along = rng.range(STOP_DIST + 4, BLOCK - STOP_DIST - 6);
      const p = this.lanePoint(a, b, along);
      if (p.x < 0 || p.z < 0 || p.x > CITY || p.z > CITY) continue;
      const dd = Math.hypot(p.x - x, p.z - z);
      if (dd < minD || dd > maxD) continue;
      if (avoid && avoid(p)) continue;
      const d2 = this.dir(a, b);
      return { a, b, along, x: p.x, z: p.z, yaw: Math.atan2(d2.x, d2.z) };
    }
    return null;
  }

  update(dt) {
    this.time = (this.time + dt) % CYCLE;
    const t = this.time;
    const half = CYCLE / 2;
    const xState = t < GREEN ? 'green' : t < half ? 'yellow' : 'red';
    const zState = t < half ? 'red' : t < half + GREEN ? 'green' : 'yellow';
    if (xState !== this.phase.x || zState !== this.phase.z) {
      this.phase.x = xState; this.phase.z = zState;
      if (this.game.props) this.game.props.setSignalColors(xState, zState);
    }
  }
}
