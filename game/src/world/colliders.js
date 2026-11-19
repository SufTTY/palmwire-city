// Static collision world: axis-aligned boxes (buildings, containers, railings) and upright
// circles (palms, lamp posts) in a spatial hash, with circle push-out and 3D ray casts for
// bullets, line of sight and the camera.

const CELL = 16;

export class StaticColliders {
  constructor() {
    this.boxes = [];     // {x0,z0,x1,z1,y0,y1}
    this.circles = [];   // {x,z,r,y1}
    this.grid = new Map();
    this.stamp = 0;
  }

  key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  insert(item, x0, z0, x1, z1) {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const k = this.key(cx, cz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(item);
      }
    }
  }

  addBox(x0, z0, x1, z1, y1 = 100, y0 = -5) {
    const b = { kind: 'box', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1, mark: 0 };
    this.boxes.push(b);
    this.insert(b, b.x0, b.z0, b.x1, b.z1);
    return b;
  }

  addCircle(x, z, r, y1 = 6) {
    const c = { kind: 'circle', x, z, r, y1, mark: 0 };
    this.circles.push(c);
    this.insert(c, x - r, z - r, x + r, z + r);
    return c;
  }

  /** Items whose cells overlap the square around (x, z). */
  query(x, z, r, out = []) {
    this.stamp++;
    out.length = 0;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const list = this.grid.get(this.key(cx, cz));
        if (!list) continue;
        for (const it of list) {
          if (it.mark === this.stamp) continue;
          it.mark = this.stamp;
          out.push(it);
        }
      }
    }
    return out;
  }

  /**
   * Push a circle (x, z, r) at height y out of everything it overlaps.
   * Returns { x, z, hit, nx, nz } with the push direction of the deepest contact.
   */
  resolveCircle(x, z, r, y = 0.5) {
    const res = { x, z, hit: false, nx: 0, nz: 0, depth: 0 };
    const items = this.query(x, z, r + 1, this._tmp || (this._tmp = []));
    for (let pass = 0; pass < 2; pass++) {
      for (const it of items) {
        if (y > it.y1 || (it.y0 !== undefined && y < it.y0 - 1)) continue;
        if (it.kind === 'box') {
          const px = Math.max(it.x0, Math.min(res.x, it.x1));
          const pz = Math.max(it.z0, Math.min(res.z, it.z1));
          let dx = res.x - px, dz = res.z - pz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          let nx, nz, depth;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            nx = dx / d; nz = dz / d; depth = r - d;
          } else {
            // centre inside the box: push out along the shallowest side
            const l = res.x - it.x0, rr = it.x1 - res.x, t = res.z - it.z0, bb = it.z1 - res.z;
            const m = Math.min(l, rr, t, bb);
            if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
            depth = m + r;
          }
          res.x += nx * depth; res.z += nz * depth;
          if (depth > res.depth) { res.depth = depth; res.nx = nx; res.nz = nz; }
          res.hit = true;
        } else {
          const dx = res.x - it.x, dz = res.z - it.z;
          const rr = r + it.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          const depth = rr - d;
          res.x += (dx / d) * depth; res.z += (dz / d) * depth;
          if (depth > res.depth) { res.depth = depth; res.nx = dx / d; res.nz = dz / d; }
          res.hit = true;
        }
      }
    }
    return res;
  }

  /**
   * Ray cast from origin (ox,oy,oz) along unit dir up to maxDist. Returns distance and normal of
   * the first static surface, or null. Walks the grid cells along the ray's ground track.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    this.stamp++;
    let best = maxDist, bestN = null;
    const step = CELL * 0.5;
    const hlen = Math.hypot(dx, dz);
    const n = Math.ceil(((hlen * maxDist) / step)) + 1;
    for (let s = 0; s <= n; s++) {
      const t = Math.min(maxDist, (s * step) / Math.max(hlen, 1e-6));
      if (t > best + CELL) break;
      const px = ox + dx * t, pz = oz + dz * t;
      const list = this.grid.get(this.key(Math.floor(px / CELL), Math.floor(pz / CELL)));
      if (list) {
        for (const it of list) {
          if (it.mark === this.stamp) continue;
          it.mark = this.stamp;
          const hit = it.kind === 'box' ? rayBox(ox, oy, oz, dx, dy, dz, it) : rayCylinder(ox, oy, oz, dx, dy, dz, it);
          if (hit && hit.t < best) { best = hit.t; bestN = hit.n; }
        }
      }
      // also check the neighbouring cells the ray may clip
      for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const l2 = this.grid.get(this.key(Math.floor(px / CELL) + ex, Math.floor(pz / CELL) + ez));
        if (!l2) continue;
        for (const it of l2) {
          if (it.mark === this.stamp) continue;
          it.mark = this.stamp;
          const hit = it.kind === 'box' ? rayBox(ox, oy, oz, dx, dy, dz, it) : rayCylinder(ox, oy, oz, dx, dy, dz, it);
          if (hit && hit.t < best) { best = hit.t; bestN = hit.n; }
        }
      }
      if (hlen < 1e-6) break;
    }
    return bestN ? { t: best, n: bestN } : null;
  }

  /** True when nothing static blocks the segment between two points. */
  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.2);
  }
}

function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity, n = null;
  const axes = [[ox, dx, b.x0, b.x1, [-1, 0, 0], [1, 0, 0]], [oy, dy, b.y0, b.y1, [0, -1, 0], [0, 1, 0]], [oz, dz, b.z0, b.z1, [0, 0, -1], [0, 0, 1]]];
  for (const [o, d, lo, hi, nlo, nhi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    let n1 = nlo, n2 = nhi;
    if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
    if (t1 > tmin) { tmin = t1; n = n1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (!n) return null; // origin inside
  return { t: tmin, n };
}

function rayCylinder(ox, oy, oz, dx, dy, dz, c) {
  const fx = ox - c.x, fz = oz - c.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz);
  const cc = fx * fx + fz * fz - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = oy + dy * t;
  if (y > c.y1 || y < -1) return null;
  const hx = fx + dx * t, hz = fz + dz * t;
  const l = Math.hypot(hx, hz) || 1;
  return { t, n: [hx / l, 0, hz / l] };
}
