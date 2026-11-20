// Static world colliders (building footprints, walls, posts) in a uniform grid, with circle
// push-out for movers and 2D ray casts for bullets, cameras and police line of sight.

const CELL = 16;

export class StaticColliders {
  constructor() {
    this.boxes = [];        // { x0, z0, x1, z1, h, kind }
    this.cells = new Map(); // "cx,cz" -> [index]
    this.stamp = 0;
    this.marks = [];
  }

  add(x0, z0, x1, z1, h = 100, kind = 'building') {
    const id = this.boxes.length;
    this.boxes.push({ x0, z0, x1, z1, h, kind });
    this.marks.push(0);
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const k = cx + ',' + cz;
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k).push(id);
      }
    }
    return id;
  }

  /** Calls fn(box) once for each collider overlapping the rectangle. */
  forEachIn(x0, z0, x1, z1, fn) {
    this.stamp++;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const list = this.cells.get(cx + ',' + cz);
        if (!list) continue;
        for (const id of list) {
          if (this.marks[id] === this.stamp) continue;
          this.marks[id] = this.stamp;
          fn(this.boxes[id]);
        }
      }
    }
  }

  /**
   * Pushes a circle out of every collider it overlaps. Returns the summed push normal
   * { x, z, hit } so vehicles can bounce off walls.
   */
  resolveCircle(pos, r, y = 0) {
    const out = { x: 0, z: 0, hit: false };
    this.forEachIn(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (b) => {
      if (y > b.h) return;
      const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
      const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        // centre inside the box: push out along the shallowest axis
        const l = pos.x - b.x0, rr = b.x1 - pos.x, t = pos.z - b.z0, bb = b.z1 - pos.z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) { dx = -1; dz = 0; d = -l; } else if (m === rr) { dx = 1; dz = 0; d = -rr; }
        else if (m === t) { dx = 0; dz = -1; d = -t; } else { dx = 0; dz = 1; d = -bb; }
        const push = r - d;
        pos.x += dx * push; pos.z += dz * push;
        out.x += dx; out.z += dz; out.hit = true;
        return;
      }
      const push = r - d;
      dx /= d; dz /= d;
      pos.x += dx * push; pos.z += dz * push;
      out.x += dx; out.z += dz; out.hit = true;
    });
    if (out.hit) { const l = Math.hypot(out.x, out.z) || 1; out.x /= l; out.z /= l; }
    return out;
  }

  /**
   * Distance along (dx,dz) (unit) to the first collider taller than y, or maxDist.
   * solidOnly skips thin props (palms, lamp posts) for cameras and line of sight.
   */
  raycast(ox, oz, dx, dz, maxDist, y = 1.5, solidOnly = false) {
    let best = maxDist;
    const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
    this.forEachIn(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), (b) => {
      if (y > b.h) return;
      if (solidOnly && b.kind === 'prop') return;
      let tmin = 0, tmax = best;
      if (Math.abs(dx) < 1e-8) { if (ox < b.x0 || ox > b.x1) return; }
      else {
        let t1 = (b.x0 - ox) / dx, t2 = (b.x1 - ox) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      }
      if (Math.abs(dz) < 1e-8) { if (oz < b.z0 || oz > b.z1) return; }
      else {
        let t1 = (b.z0 - oz) / dz, t2 = (b.z1 - oz) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      }
      if (tmin <= tmax && tmin < best) best = tmin;
    });
    return best;
  }

  /** True when a straight line between two points is blocked by a building. */
  blocked(ax, az, bx, bz, y = 1.6) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return false;
    return this.raycast(ax, az, dx / len, dz / len, len, y, true) < len - 0.5;
  }

  pointInside(x, z, y = 0) {
    let inside = false;
    this.forEachIn(x, z, x, z, (b) => { if (y <= b.h && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) inside = true; });
    return inside;
  }
}
