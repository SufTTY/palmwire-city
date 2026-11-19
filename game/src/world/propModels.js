// Procedural low-poly prop geometries (built once, instanced many times): palm trees, round
// shade trees, street lamps, beach umbrellas, lifeguard towers, sailboats and harbour cranes.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { makeRng } from '../core/rng.js';

/** Curved trunk with ring scars, eight drooping fronds and a coconut cluster. */
export function palmGeometry(seed = 1) {
  const rng = makeRng(seed);
  const b = new MeshBuilder();
  const H = 8.5, segs = 7;
  const bend = rng.range(0.6, 1.4);
  const at = (t) => [Math.sin(t * 1.4) * bend * t, t * H];
  for (let s = 0; s < segs; s++) {
    const t0 = s / segs, t1 = (s + 1) / segs;
    const [x0, y0] = at(t0), [x1, y1] = at(t1);
    const r0 = 0.3 - t0 * 0.12, r1 = 0.3 - t1 * 0.12;
    const tmp = new MeshBuilder();
    tmp.cylinder(0, 0, 0, r0, r1, y1 - y0, 7, s % 2 ? 0x8a6a48 : 0x7a5c3e);
    const geo = tmp.build();
    const m = new THREE.Matrix4().makeShear(0, 0, (x1 - x0) / (y1 - y0), 0, 0, 0).premultiply(new THREE.Matrix4().makeTranslation(x0, y0, 0));
    b.geometry(geo, m, s % 2 ? 0x8a6a48 : 0x76583a);
  }
  const [tx, ty] = at(1);
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const dx = Math.sin(a), dz = Math.cos(a);
    const px = -dz, pz = dx;
    const L = rng.range(3.6, 4.6), droop = rng.range(1.6, 2.6);
    const col = rng.pick([0x3f8f3a, 0x4a9c3f, 0x357f34, 0x5aa846]);
    const steps = 5;
    let prev = null;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const cx = tx + dx * L * t, cz = dz * L * t;
      const cy = ty + 0.5 * t - droop * t * t;
      const w = 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08));
      const cur = {
        c: [cx, cy, cz],
        l: [cx + px * w, cy - 0.25 * w, cz + pz * w],
        r: [cx - px * w, cy - 0.25 * w, cz - pz * w],
      };
      if (prev) {
        b.quad([prev.c, cur.c, cur.l, prev.l], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
        b.quad([prev.r, cur.r, cur.c, prev.c], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
      }
      prev = cur;
    }
  }
  const nut = new THREE.IcosahedronGeometry(0.22, 0);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7;
    b.geometry(nut, new THREE.Matrix4().makeTranslation(tx + Math.sin(a) * 0.3, ty - 0.25, Math.cos(a) * 0.3), 0x6b4a22);
  }
  return b.build();
}

export function shadeTreeGeometry(seed = 2) {
  const rng = makeRng(seed);
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 0.32, 0.22, 3.2, 6, 0x6e5238);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const greens = [0x4f8a3a, 0x5d9a42, 0x467d34];
  for (let k = 0; k < 4; k++) {
    const s = rng.range(1.6, 2.3);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(rng.range(-0.9, 0.9), 3.6 + rng.range(0, 1.6), rng.range(-0.9, 0.9)),
      new THREE.Quaternion(), new THREE.Vector3(s, s * 0.85, s));
    b.geometry(blob, m, greens[k % 3]);
  }
  return b.build();
}

/** Lamp post with an arm reaching over the road (+z is toward the road). */
export function streetLampGeometry() {
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 0.14, 0.1, 7.2, 6, 0x4a5058);
  b.box(0, 7.1, 1.2, 0.14, 0.14, 2.5, 0x4a5058);
  b.box(0, 6.95, 2.4, 0.5, 0.22, 0.9, 0x3a3f46);
  return b.build();
}
export function lampBulbGeometry() {
  const b = new MeshBuilder();
  b.box(0, 6.82, 2.4, 0.42, 0.05, 0.8, 0xffffff);
  return b.build();
}

export function umbrellaGeometry(color) {
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 0.05, 0.05, 2.4, 5, 0xeeeeee);
  const cone = new THREE.ConeGeometry(1.6, 0.6, 8, 1, true);
  b.geometry(cone, new THREE.Matrix4().makeTranslation(0, 2.45, 0), color);
  return b.build();
}

export function lifeguardTowerGeometry() {
  const b = new MeshBuilder();
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) b.box(x, 1.3, z, 0.18, 2.6, 0.18, 0xf2f2ee);
  b.box(0, 2.7, 0, 3, 0.2, 3, 0xd9d2c5);
  b.box(0, 3.8, 0, 2.6, 2, 2.6, 0xff7a3d);
  b.box(0, 3.95, 1.31, 2.0, 0.9, 0.04, 0x26323c);
  b.box(0, 5.0, 0, 3.2, 0.25, 3.2, 0xfafafa);
  b.box(0, 1.3, 2.4, 1.0, 0.12, 2.6, 0xd9d2c5, { rotY: 0 });
  return b.build();
}

export function sailboatGeometry(seed) {
  const rng = makeRng(seed);
  const b = new MeshBuilder();
  const hull = rng.pick([0xffffff, 0x1d3f6e, 0xf2eee4]);
  b.box(0, 0.4, 0, 2.6, 1.0, 9, hull, { taperX: 1.15 });
  b.box(0, 0.95, -0.6, 2.2, 0.15, 6.5, 0xb88a5a);
  b.box(0, 1.4, -1.6, 1.6, 0.8, 2.6, 0xf0f0f0);
  b.cylinder(0, 0.9, 1.0, 0.08, 0.06, 11, 5, 0xdddddd);
  const sail = rng.pick([0xfaf6ea, 0xffe2c4, 0xf8f8f8]);
  b.tri([[0, 2.0, 1.1], [0, 11.5, 1.1], [0, 2.0, -3.5]], [1, 0, 0], sail);
  b.tri([[0, 2.0, -3.5], [0, 11.5, 1.1], [0, 2.0, 1.1]], [-1, 0, 0], sail);
  b.tri([[0, 2.0, 1.3], [0, 9.5, 1.15], [0, 2.0, 4.2]], [1, 0, 0], rng.pick([0xff6a4a, 0x2bb3c0, 0xffc040]));
  b.tri([[0, 2.0, 4.2], [0, 9.5, 1.15], [0, 2.0, 1.3]], [-1, 0, 0], 0xffffff);
  return b.build();
}

/** Ship-to-shore gantry crane; the boom reaches toward +z (the water). */
export function craneGeometry(color = 0xf06a2a) {
  const b = new MeshBuilder();
  for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) b.box(x, 14, z, 1.2, 28, 1.2, color);
  b.box(0, 28.5, 0, 14, 1.4, 9.2, color);
  b.box(-6, 6, 0, 1, 1, 9, color);
  b.box(6, 6, 0, 1, 1, 9, color);
  b.box(-3, 30, 8, 1.4, 1.4, 40, color);
  b.box(3, 30, 8, 1.4, 1.4, 40, color);
  b.box(0, 30, -12, 7.4, 2.4, 4, 0x555b63);
  b.box(0, 27, 10, 3, 2.4, 3, 0xfafafa);
  b.box(0, 34, -2, 1, 8, 1, color);
  return b.build();
}

export function lighthouseGeometry() {
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 5.5, 5.5, 1.2, 12, 0xbfb8aa);
  const bands = 6;
  for (let k = 0; k < bands; k++) {
    const y0 = 1.2 + k * 4, r0 = 4 - k * 0.22, r1 = 4 - (k + 1) * 0.22;
    b.cylinder(0, y0, 0, r0, r1, 4, 14, k % 2 ? 0xd8322a : 0xf7f4ee);
  }
  b.cylinder(0, 25.2, 0, 3.6, 3.6, 0.4, 14, 0x2a2e33, { cap: true });
  b.cylinder(0, 28.4, 0, 2.2, 0.2, 2.4, 10, 0xd8322a, { cap: true });
  return b.build();
}
