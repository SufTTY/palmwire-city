// Accumulates boxes, cylinders, roofs and arbitrary geometry into ONE vertex-coloured buffer, so
// a whole chunk of city (or a whole car body) is a single draw call.
import * as THREE from 'three';

const tmpColor = new THREE.Color();
function rgbOf(c) {
  if (c instanceof THREE.Color) return [c.r, c.g, c.b];
  if (Array.isArray(c)) return c;
  tmpColor.set(c);
  return [tmpColor.r, tmpColor.g, tmpColor.b];
}

// Face table for an axis-aligned box: normal, u tangent, v tangent, and which half-size each uses.
const FACES = {
  px: { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], hn: 0, hu: 2, hv: 1 },
  nx: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], hn: 0, hu: 2, hv: 1 },
  pz: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], hn: 2, hu: 0, hv: 1 },
  nz: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], hn: 2, hu: 0, hv: 1 },
  py: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], hn: 1, hu: 0, hv: 2 },
  ny: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], hn: 1, hu: 0, hv: 2 },
};
const SIDES = ['px', 'nx', 'pz', 'nz'];
const ALL = ['px', 'nx', 'pz', 'nz', 'py', 'ny'];

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }
  get vertexCount() { return this.pos.length / 3; }
  get empty() { return this.idx.length === 0; }

  vertex(x, y, z, nx, ny, nz, u, v, rgb) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(rgb[0], rgb[1], rgb[2]);
  }

  /** Four corners in counter-clockwise order seen from the front. */
  quad(p, n, uvs, color) {
    const rgb = rgbOf(color);
    const b = this.vertexCount;
    for (let k = 0; k < 4; k++) this.vertex(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], rgb);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  tri(p, n, color, uvs = [[0, 0], [1, 0], [0.5, 1]]) {
    const rgb = rgbOf(color);
    const b = this.vertexCount;
    for (let k = 0; k < 3; k++) this.vertex(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], rgb);
    this.idx.push(b, b + 1, b + 2);
  }

  /**
   * Box centred at (cx, cy, cz). opts.faces: 'all' | 'sides' | 'top' | array of face keys.
   * opts.uv: [metresPerU, metresPerV] for world-scaled UVs (facades), else 0..1 per face.
   * opts.rotY rotates the box about its centre. opts.taper narrows the top face (cabins).
   */
  box(cx, cy, cz, sx, sy, sz, color, opts = {}) {
    const faces = opts.faces === 'sides' ? SIDES : opts.faces === 'top' ? ['py'] : Array.isArray(opts.faces) ? opts.faces : ALL;
    const rgb = rgbOf(color);
    const half = [sx / 2, sy / 2, sz / 2];
    const rot = opts.rotY || 0;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const taperX = opts.taperX ?? 1, taperZ = opts.taperZ ?? 1;
    const uvScale = opts.uv;
    const vBase = opts.vBase ?? (cy - half[1]);
    const uBase = opts.uBase ?? 0;
    for (const key of faces) {
      const f = FACES[key];
      const hn = half[f.hn], hu = half[f.hu], hv = half[f.hv];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const b = this.vertexCount;
      for (const [su, sv] of corners) {
        let x = f.n[0] * hn + f.u[0] * hu * su + f.v[0] * hv * sv;
        let y = f.n[1] * hn + f.u[1] * hu * su + f.v[1] * hv * sv;
        let z = f.n[2] * hn + f.u[2] * hu * su + f.v[2] * hv * sv;
        if (y > 0) { x *= taperX; z *= taperZ; }
        const wx = x * cs + z * sn, wz = -x * sn + z * cs;
        const nx = f.n[0] * cs + f.n[2] * sn, nz = -f.n[0] * sn + f.n[2] * cs;
        let u, v;
        if (uvScale) {
          u = uBase + ((su + 1) * hu) / uvScale[0];
          v = key === 'py' || key === 'ny' ? ((sv + 1) * hv) / uvScale[1] : (cy + y - vBase) / uvScale[1] + (vBase / uvScale[1]);
        } else {
          u = (su + 1) / 2;
          v = (sv + 1) / 2;
        }
        this.vertex(cx + wx, cy + y, cz + wz, nx, f.n[1], nz, u, v, rgb);
      }
      this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }

  /** Vertical cylinder / cone frustum from y0 up h, radii r0 (bottom) and r1 (top). */
  cylinder(cx, y0, cz, r0, r1, h, segs, color, opts = {}) {
    const rgb = rgbOf(color);
    const uvs = opts.uv;
    const slope = (r0 - r1) / h;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2, a1 = ((s + 1) / segs) * Math.PI * 2;
      const b = this.vertexCount;
      const pts = [[a0, r0, 0], [a1, r0, 0], [a1, r1, h], [a0, r1, h]];
      for (const [a, r, y] of pts) {
        const nx = Math.sin(a), nz = Math.cos(a);
        const nl = Math.hypot(1, slope);
        const u = uvs ? (a * r0) / uvs[0] : a / (Math.PI * 2);
        const v = uvs ? y / uvs[1] : y / h;
        this.vertex(cx + nx * r, y0 + y, cz + nz * r, nx / nl, slope / nl, nz / nl, u, v, rgb);
      }
      this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      if (opts.cap && r1 > 0) {
        this.tri([[cx, y0 + h, cz], [cx + Math.sin(a0) * r1, y0 + h, cz + Math.cos(a0) * r1], [cx + Math.sin(a1) * r1, y0 + h, cz + Math.cos(a1) * r1]], [0, 1, 0], color);
      }
    }
  }

  /** Gable roof over an sx-by-sz footprint at y0, ridge along local x, rotated by rotY. */
  gableRoof(cx, y0, cz, sx, sz, h, color, rotY = 0) {
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    const P = (x, y, z) => [cx + x * cs + z * sn, y0 + y, cz - x * sn + z * cs];
    const R = (x, y, z) => [x * cs + z * sn, y, -x * sn + z * cs];
    const hx = sx / 2, hz = sz / 2;
    const sl = Math.hypot(hz, h);
    const nf = R(0, hz / sl, h / sl), nb = R(0, hz / sl, -h / sl);
    this.quad([P(-hx, 0, hz), P(hx, 0, hz), P(hx, h, 0), P(-hx, h, 0)], nf, [[0, 0], [sx / 4, 0], [sx / 4, sl / 4], [0, sl / 4]], color);
    this.quad([P(hx, 0, -hz), P(-hx, 0, -hz), P(-hx, h, 0), P(hx, h, 0)], nb, [[0, 0], [sx / 4, 0], [sx / 4, sl / 4], [0, sl / 4]], color);
    this.tri([P(hx, 0, hz), P(hx, 0, -hz), P(hx, h, 0)], R(1, 0, 0), color);
    this.tri([P(-hx, 0, -hz), P(-hx, 0, hz), P(-hx, h, 0)], R(-1, 0, 0), color);
  }

  /** Append any BufferGeometry transformed by a Matrix4, painted one colour. */
  geometry(geom, matrix, color) {
    const rgb = rgbOf(color);
    const g = geom.index ? geom.toNonIndexed() : geom;
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    const b = this.vertexCount;
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).applyMatrix4(matrix);
      w.fromBufferAttribute(n, k).applyMatrix3(nm).normalize();
      this.vertex(v.x, v.y, v.z, w.x, w.y, w.z, t ? t.getX(k) : 0, t ? t.getY(k) : 0, rgb);
      this.idx.push(b + k);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
