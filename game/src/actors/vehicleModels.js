// Procedural low-poly car models: each shape (hatch, sedan, coupe, sports, pickup, van, bike)
// is assembled from tapered boxes into four merged parts (paint, glass+trim, lights, wheels)
// and cached per vehicle type so every car of a kind shares geometry.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';

const geoCache = new Map();
const paintCache = new Map();
let shared = null;

function sharedMaterials() {
  if (shared) return shared;
  shared = {
    detail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.4 }),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    wheel: new THREE.MeshLambertMaterial({ vertexColors: true }),
    barRed: new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false }),
    barBlue: new THREE.MeshBasicMaterial({ color: 0x1050ff, toneMapped: false }),
    barOff: new THREE.MeshLambertMaterial({ color: 0x331018 }),
    barOffB: new THREE.MeshLambertMaterial({ color: 0x101833 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.35, metalness: 0.2 }),
    taxiSign: new THREE.MeshBasicMaterial({ color: 0xfff3b0, toneMapped: false }),
  };
  return shared;
}

export function paintMaterial(hex) {
  if (!paintCache.has(hex)) paintCache.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.32, metalness: 0.35 }));
  return paintCache.get(hex);
}

const GLASS = 0x22313d, TRIM = 0x1a1c1f, CHROME = 0xbfc5ca, HEAD = 0xfff4d6, TAIL = 0xff2030;

function profile(t) {
  const { len: L, hgt: H, wheelR: R } = t;
  const p = { c: R * 0.55, bodyTop: H * 0.58, cab: [-L * 0.28, L * 0.17], top: [-L * 0.2, L * 0.05], noseDrop: 0.12 };
  switch (t.shape) {
    case 'hatch': p.cab = [-L * 0.44, L * 0.14]; p.top = [-L * 0.42, L * 0.0]; break;
    case 'coupe': p.bodyTop = H * 0.56; p.cab = [-L * 0.24, L * 0.1]; p.top = [-L * 0.16, -L * 0.02]; break;
    case 'sports': p.bodyTop = H * 0.5; p.cab = [-L * 0.22, L * 0.14]; p.top = [-L * 0.13, -L * 0.01]; p.noseDrop = 0.2; break;
    case 'pickup': p.bodyTop = H * 0.56; p.cab = [-L * 0.06, L * 0.2]; p.top = [-L * 0.05, L * 0.12]; break;
    case 'van': p.bodyTop = H * 0.45; p.cab = [-L * 0.5, L * 0.3]; p.top = [-L * 0.5, L * 0.2]; p.noseDrop = 0.05; break;
    default: break;
  }
  return p;
}

function buildCar(t) {
  const { len: L, wid: W, hgt: H, wheelR: R } = t;
  const p = profile(t);
  const paint = new GeometryBuilder(), paint2 = new GeometryBuilder(), detail = new GeometryBuilder(), lights = new GeometryBuilder();
  const hw = W / 2, hl = L / 2, c = p.c, bt = p.bodyTop;
  // lower body with a slightly lower nose
  paint.hexa([
    [-hw, c, -hl], [hw, c, -hl], [hw, c, hl], [-hw, c, hl],
    [-hw, bt, -hl + 0.05], [hw, bt, -hl + 0.05], [hw, bt - p.noseDrop, hl - 0.05], [-hw, bt - p.noseDrop, hl - 0.05],
  ], 0xffffff);
  // wheel arch shadows
  for (const zs of [-1, 1]) for (const xs of [-1, 1]) {
    const zc = zs * (hl - R - 0.4);
    detail.box(xs * hw - (xs > 0 ? 0.02 : -0.02) - 0.01, c, zc - R * 1.1, xs * hw + 0.01 * xs, c + R * 1.05, zc + R * 1.1, TRIM, {});
  }
  // cabin: glass with a painted roof
  const ih = hw - 0.06, th = hw - 0.24;
  const [c0, c1] = p.cab, [t0, t1] = p.top;
  detail.hexa([
    [-ih, bt, c0], [ih, bt, c0], [ih, bt - p.noseDrop * 0.6, c1], [-ih, bt - p.noseDrop * 0.6, c1],
    [-th, H - 0.06, t0], [th, H - 0.06, t0], [th, H - 0.06, t1], [-th, H - 0.06, t1],
  ], GLASS);
  paint.hexa([
    [-th, H - 0.06, t0], [th, H - 0.06, t0], [th, H - 0.06, t1], [-th, H - 0.06, t1],
    [-th + 0.04, H, t0 + 0.04], [th - 0.04, H, t0 + 0.04], [th - 0.04, H, t1 - 0.04], [-th + 0.04, H, t1 - 0.04],
  ], 0xffffff);
  // pillars
  for (const xs of [-1, 1]) {
    detail.box(xs * ih - 0.04, bt, (c0 + t0) / 2 - 0.05, xs * ih + 0.04, H - 0.06, (c0 + t0) / 2 + 0.05, TRIM);
  }
  // bumpers, grille, mirrors
  detail.box(-hw - 0.02, c - 0.02, hl - 0.05, hw + 0.02, c + 0.28, hl + 0.12, TRIM);
  detail.box(-hw - 0.02, c - 0.02, -hl - 0.12, hw + 0.02, c + 0.28, -hl + 0.05, TRIM);
  detail.box(-hw * 0.45, c + 0.32, hl - 0.04, hw * 0.45, bt - p.noseDrop - 0.08, hl + 0.02, 0x2a2d31);
  for (const xs of [-1, 1]) detail.box(xs * (hw + 0.14) - 0.08, bt - 0.02, c1 - 0.25, xs * (hw + 0.14) + 0.08, bt + 0.12, c1 - 0.05, TRIM);
  // lights
  for (const xs of [-1, 1]) {
    lights.box(xs * (hw - 0.3) - 0.2, bt - p.noseDrop - 0.24, hl - 0.02, xs * (hw - 0.3) + 0.2, bt - p.noseDrop - 0.08, hl + 0.04, HEAD);
    lights.box(xs * (hw - 0.25) - 0.2, bt - 0.26, -hl - 0.04, xs * (hw - 0.25) + 0.2, bt - 0.1, -hl + 0.02, TAIL);
  }
  // shape extras
  if (t.shape === 'sports') {
    paint.box(-hw + 0.1, bt + 0.25, -hl + 0.05, hw - 0.1, bt + 0.32, -hl + 0.45, 0xffffff);
    for (const xs of [-1, 1]) detail.box(xs * (hw - 0.3) - 0.04, bt, -hl + 0.15, xs * (hw - 0.3) + 0.04, bt + 0.25, -hl + 0.3, TRIM);
  }
  if (t.shape === 'coupe') {
    paint.box(-0.35, bt - p.noseDrop, hl * 0.35, 0.35, bt - p.noseDrop + 0.12, hl * 0.75, 0xffffff);
    detail.box(-hw + 0.15, bt - 0.2, -hl - 0.05, hw - 0.15, bt - 0.05, -hl + 0.01, CHROME);
  }
  if (t.shape === 'pickup') {
    const b0 = -hl + 0.1, b1 = p.cab[0] - 0.05;
    paint.box(-hw, bt, b0, -hw + 0.1, bt + 0.45, b1, 0xffffff);
    paint.box(hw - 0.1, bt, b0, hw, bt + 0.45, b1, 0xffffff);
    paint.box(-hw, bt, b0 - 0.1, hw, bt + 0.45, b0, 0xffffff);
    detail.box(-hw + 0.1, bt - 0.02, b0, hw - 0.1, bt + 0.02, b1, 0x2b2b2b);
  }
  if (t.shape === 'van') {
    detail.box(-hw - 0.01, bt + 0.15, -hl * 0.4, -hw + 0.02, H - 0.25, hl * 0.25, GLASS);
    paint.box(-hw, H - 0.06, -hl, hw, H, p.top[1], 0xffffff);
  }
  return { paint, paint2, detail, lights };
}

function buildBike(t) {
  const { len: L, wheelR: R } = t;
  const hl = L / 2;
  const paint = new GeometryBuilder(), detail = new GeometryBuilder(), lights = new GeometryBuilder(), paint2 = new GeometryBuilder();
  paint.hexa([
    [-0.18, 0.65, -0.1], [0.18, 0.65, -0.1], [0.16, 0.6, 0.55], [-0.16, 0.6, 0.55],
    [-0.15, 0.95, -0.05], [0.15, 0.95, -0.05], [0.12, 0.9, 0.45], [-0.12, 0.9, 0.45],
  ], 0xffffff);
  paint.box(-0.12, 0.55, -hl + 0.15, 0.12, 0.85, -0.2, 0xffffff);
  detail.box(-0.14, 0.88, -0.65, 0.14, 0.98, -0.05, 0x1a1a1a);         // seat
  detail.box(-0.1, 0.3, -0.3, 0.1, 0.62, 0.4, 0x3a3a3a);                // engine
  detail.box(-0.05, R, hl - R - 0.05, 0.05, 1.05, hl - R + 0.05, CHROME); // fork
  detail.box(-0.38, 1.02, hl - R - 0.12, 0.38, 1.06, hl - R - 0.06, TRIM); // bars
  lights.box(-0.09, 0.85, hl - R + 0.05, 0.09, 1.0, hl - R + 0.14, HEAD);
  lights.box(-0.07, 0.75, -hl + 0.05, 0.07, 0.83, -hl + 0.12, TAIL);
  return { paint, paint2, detail, lights };
}

function wheelGeometry(R, width) {
  const tire = new THREE.CylinderGeometry(R, R, width, 14);
  tire.rotateZ(Math.PI / 2);
  const colors = [];
  const pos = tire.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getY(i), pos.getZ(i));
    const isCap = Math.abs(Math.abs(pos.getX(i)) - width / 2) < 1e-3 && r < R * 0.99;
    const c = isCap ? 0.75 : 0.08;
    colors.push(c, c, c * 1.02);
  }
  tire.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return tire;
}

function typeGeometry(key, t) {
  if (geoCache.has(key)) return geoCache.get(key);
  const parts = t.bike ? buildBike(t) : buildCar(t);
  const g = {
    paint: parts.paint.build(),
    detail: parts.detail.build(),
    lights: parts.lights.build(),
    wheel: wheelGeometry(t.wheelR, t.bike ? 0.16 : 0.26),
    bar: null,
  };
  if (t.police) {
    const bar = new GeometryBuilder();
    bar.box(-0.55, t.hgt, -0.12, -0.05, t.hgt + 0.14, 0.12, 0xffffff);
    g.barL = bar.build();
    const bar2 = new GeometryBuilder();
    bar2.box(0.05, t.hgt, -0.12, 0.55, t.hgt + 0.14, 0.12, 0xffffff);
    g.barR = bar2.build();
    const doors = new GeometryBuilder();
    const hw = t.wid / 2 + 0.012, p = profile(t);
    doors.box(-hw, p.c + 0.25, -t.len * 0.25, hw, p.bodyTop - 0.05, t.len * 0.2, 0xffffff, { top: false });
    g.doors = doors.build();
  }
  if (t.taxi) {
    const s = new GeometryBuilder();
    s.box(-0.35, t.hgt, -0.15, 0.35, t.hgt + 0.25, 0.15, 0xffffff);
    g.sign = s.build();
  }
  geoCache.set(key, g);
  return g;
}

/** Builds the scene graph for one vehicle. Returns { root, body, wheels[], bar, paintMesh }. */
export function buildVehicleModel(key, t, paintHex) {
  const m = sharedMaterials();
  const g = typeGeometry(key, t);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paintMesh = new THREE.Mesh(g.paint, paintMaterial(paintHex));
  paintMesh.castShadow = true;
  body.add(paintMesh);
  body.add(new THREE.Mesh(g.detail, m.detail));
  body.add(new THREE.Mesh(g.lights, m.lights));
  const out = { root, body, wheels: [], paintMesh, bars: null };
  if (g.doors) body.add(new THREE.Mesh(g.doors, m.white));
  if (g.sign) body.add(new THREE.Mesh(g.sign, m.taxiSign));
  if (g.barL) {
    const l = new THREE.Mesh(g.barL, m.barRed), r = new THREE.Mesh(g.barR, m.barBlue);
    body.add(l, r);
    out.bars = { l, r, mats: m };
  }
  const R = t.wheelR;
  const positions = t.bike
    ? [[0, t.len / 2 - R - 0.05, true], [0, -t.len / 2 + R + 0.05, false]]
    : [[-(t.wid / 2 - 0.2), t.len / 2 - R - 0.4, true], [t.wid / 2 - 0.2, t.len / 2 - R - 0.4, true],
       [-(t.wid / 2 - 0.2), -(t.len / 2 - R - 0.4), false], [t.wid / 2 - 0.2, -(t.len / 2 - R - 0.4), false]];
  for (const [x, z, front] of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(x, R, z);
    const w = new THREE.Mesh(g.wheel, m.wheel);
    pivot.add(w);
    root.add(pivot);
    out.wheels.push({ pivot, mesh: w, front });
  }
  return out;
}
