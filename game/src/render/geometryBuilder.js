// Accumulates boxes, wedges and quads into one merged BufferGeometry with vertex colours and
// world-scaled UVs, so a whole district (or a whole car body) is a single draw call.
import * as THREE from 'three';

const tmpColor = new THREE.Color();

export class GeometryBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = [];
  }
  get vertexCount() { return this.pos.length / 3; }

  /** Adds a quad p0..p3 (counter-clockwise seen from the front) with uv per corner. */
  quad(p0, p1, p2, p3, color, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]], normal = null) {
    const base = this.vertexCount;
    let n = normal;
    if (!n) {
      const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
      const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
      n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
    }
    tmpColor.set(color);
    for (const [i, p] of [p0, p1, p2, p3].entries()) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Axis-aligned box. opts.uScale/vScale map metres to texture repeats on the sides,
   * opts.roofUV pins the top face to one texel, opts.topScale tiles the top in world space,
   * opts.bottom adds a bottom face, opts.sides=false skips walls.
   */
  box(x0, y0, z0, x1, y1, z1, color, opts = {}) {
    const us = opts.uScale || 0, vs = opts.vScale || 0;
    const side = (a, b, len) => {
      if (!us) return [[0, 0], [1, 0], [1, 1], [0, 1]];
      const u0 = a / us, u1 = (a + len) / us, v0 = y0 / vs, v1 = y1 / vs;
      return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    };
    if (opts.sides !== false) {
      // +z face
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, side(x0, 0, x1 - x0), [0, 0, 1]);
      // -z face
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, side(-x1, 0, x1 - x0), [0, 0, -1]);
      // +x face
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, side(-z1, 0, z1 - z0), [1, 0, 0]);
      // -x face
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, side(z0, 0, z1 - z0), [-1, 0, 0]);
    }
    if (opts.top !== false) {
      let uvs;
      if (opts.roofUV) { const [u, v] = opts.roofUV; uvs = [[u, v], [u, v], [u, v], [u, v]]; }
      else if (opts.topScale) { const s = opts.topScale; uvs = [[x0 / s, -z1 / s], [x1 / s, -z1 / s], [x1 / s, -z0 / s], [x0 / s, -z0 / s]]; }
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], opts.topColor ?? color, uvs, [0, 1, 0]);
    }
    if (opts.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, undefined, [0, -1, 0]);
  }

  /**
   * General hexahedron from 8 corners: bottom (0..3) then top (4..7), each ring ordered
   * (-x,-z), (+x,-z), (+x,+z), (-x,+z). Used for tapered car cabins and bonnets.
   */
  hexa(c, color, opts = {}) {
    const [b0, b1, b2, b3, t0, t1, t2, t3] = c;
    this.quad(b3, b2, t2, t3, opts.frontColor ?? color);  // +z
    this.quad(b1, b0, t0, t1, opts.backColor ?? color);   // -z
    this.quad(b2, b1, t1, t2, opts.sideColor ?? color);   // +x
    this.quad(b0, b3, t3, t0, opts.sideColor ?? color);   // -x
    this.quad(t3, t2, t1, t0, opts.topColor ?? color);    // top
    if (opts.bottom) this.quad(b0, b1, b2, b3, color);
  }

  /** Gabled roof along the longer axis of the footprint. */
  gable(x0, z0, x1, z1, y, rise, color) {
    const alongX = (x1 - x0) >= (z1 - z0);
    if (alongX) {
      const zm = (z0 + z1) / 2;
      this.quad([x0, y, z1], [x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], color);
      this.quad([x1, y, z0], [x0, y, z0], [x0, y + rise, zm], [x1, y + rise, zm], color);
      this.tri([x0, y, z0], [x0, y, z1], [x0, y + rise, zm], color);
      this.tri([x1, y, z1], [x1, y, z0], [x1, y + rise, zm], color);
    } else {
      const xm = (x0 + x1) / 2;
      this.quad([x1, y, z1], [x1, y, z0], [xm, y + rise, z0], [xm, y + rise, z1], color);
      this.quad([x0, y, z0], [x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], color);
      this.tri([x0, y, z1], [x1, y, z1], [xm, y + rise, z1], color);
      this.tri([x1, y, z0], [x0, y, z0], [xm, y + rise, z0], color);
    }
  }

  tri(p0, p1, p2, color) {
    const base = this.vertexCount;
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
    tmpColor.set(color);
    for (const p of [p0, p1, p2]) {
      this.pos.push(...p); this.nor.push(...n); this.uv.push(0.01, 0.99); this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
