// Road-graph queries shared by traffic, police pursuit and the GPS route: nearest junction,
// lane positions (right-hand traffic), turn curves through junctions and breadth-first routes.
import { CELL, HALF_ROAD, LANE_OFF, N } from '../world/cityLayout.js';

export class RoadNetwork {
  constructor(layout) {
    this.layout = layout;
    this.nodes = layout.nodes;
    this.nodeList = layout.nodeList;
    this.routeCache = new Map();
  }

  node(id) { return this.nodes[id]; }

  nearestNode(x, z) {
    const gi = Math.round(x / CELL), gj = Math.round(z / CELL);
    let best = null, bd = Infinity;
    for (let r = 0; r <= 3 && !best; r++) {
      for (let a = gi - r; a <= gi + r; a++) for (let c = gj - r; c <= gj + r; c++) {
        if (a < 0 || c < 0 || a > N || c > N) continue;
        const n = this.nodes[this.layout.nodeId(a, c)];
        if (!n) continue;
        const d = Math.hypot(n.x - x, n.z - z);
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best;
  }

  /** Point in the right-hand lane of the road leaving node `n` along link `l`, `along` metres out. */
  lanePoint(n, l, along) {
    return { x: n.x + l.dx * along - l.dz * LANE_OFF, z: n.z + l.dz * along + l.dx * LANE_OFF };
  }

  /** The link at node `to` that leads back to `from` (for reversing direction). */
  linkBetween(fromId, toId) {
    const n = this.nodes[fromId];
    return n ? n.links.find((l) => l.to === toId) : null;
  }

  /**
   * Quadratic curve through junction `n` from the incoming direction (dx, dz) to outgoing link `out`.
   * Returns [p0, p1, p2] with p0 at the stop line and p2 where the next lane begins.
   */
  turnCurve(n, inDx, inDz, out) {
    const p0 = { x: n.x - inDx * HALF_ROAD - inDz * LANE_OFF, z: n.z - inDz * HALF_ROAD + inDx * LANE_OFF };
    const p2 = this.lanePoint(n, out, HALF_ROAD);
    let p1;
    if (out.dx === inDx && out.dz === inDz) p1 = { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 };
    else if (out.dx === -inDx && out.dz === -inDz) p1 = { x: n.x + inDx * HALF_ROAD, z: n.z + inDz * HALF_ROAD };
    else p1 = { x: n.x - inDz * LANE_OFF - out.dz * LANE_OFF, z: n.z + inDx * LANE_OFF + out.dx * LANE_OFF };
    return [p0, p1, p2];
  }

  /** Next node on a shortest route from node a toward node b (BFS, cached per target). */
  nextToward(aId, bId) {
    if (aId === bId) return bId;
    let parent = this.routeCache.get(bId);
    if (!parent) {
      parent = new Map();
      parent.set(bId, -1);
      const q = [bId];
      while (q.length) {
        const cur = q.shift();
        for (const l of this.nodes[cur].links) {
          if (!parent.has(l.to)) { parent.set(l.to, cur); q.push(l.to); }
        }
      }
      this.routeCache.set(bId, parent);
    }
    const p = parent.get(aId);
    return p === undefined || p === -1 ? bId : p;
  }

  /** Whole route as a list of nodes from a to b. */
  route(aId, bId, max = 80) {
    const out = [this.nodes[aId]];
    let cur = aId;
    for (let k = 0; k < max && cur !== bId; k++) {
      const nx = this.nextToward(cur, bId);
      if (nx === cur) break;
      cur = nx;
      out.push(this.nodes[cur]);
    }
    return out;
  }

  /** A random road point (in a lane) between minD and maxD metres from (x, z). */
  randomLaneSpot(rng, x, z, minD, maxD, tries = 20) {
    for (let k = 0; k < tries; k++) {
      const n = this.nodeList[Math.floor(rng() * this.nodeList.length)];
      const l = n.links[Math.floor(rng() * n.links.length)];
      const along = HALF_ROAD + 4 + rng() * (CELL - HALF_ROAD * 2 - 12);
      const p = this.lanePoint(n, l, along);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d >= minD && d <= maxD) return { node: n, link: l, along, x: p.x, z: p.z };
    }
    return null;
  }
}

export function bezier(p, t) {
  const u = 1 - t;
  return {
    x: u * u * p[0].x + 2 * u * t * p[1].x + t * t * p[2].x,
    z: u * u * p[0].z + 2 * u * t * p[1].z + t * t * p[2].z,
  };
}
export function bezierTangent(p, t) {
  const u = 1 - t;
  return {
    x: 2 * u * (p[1].x - p[0].x) + 2 * t * (p[2].x - p[1].x),
    z: 2 * u * (p[1].z - p[0].z) + 2 * t * (p[2].z - p[1].z),
  };
}
export function bezierLength(p) {
  let len = 0, prev = p[0];
  for (let k = 1; k <= 8; k++) {
    const q = bezier(p, k / 8);
    len += Math.hypot(q.x - prev.x, q.z - prev.z);
    prev = q;
  }
  return Math.max(len, 0.01);
}
