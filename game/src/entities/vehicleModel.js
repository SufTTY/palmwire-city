// Builds vehicle meshes from boxes: one merged, vertex-coloured body per (type, paint), four
// steerable spinning wheels, headlight / brake-light meshes, glow sprites, and for police
// cruisers a flashing red-blue lightbar. Each car is a handful of draw calls.
import * as THREE from 'three';
import { MeshBuilder } from '../world/meshBuilder.js';
import { VEHICLE_TYPES } from './vehicleTypes.js';

const GLASS = 0x1c2733;
const TRIM = 0x22252a;
const CHROME = 0xb9bec4;
const bodyCache = new Map();
let wheelGeo = null, bikeWheelGeo = null, glowTex = null;

export const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12, envMapIntensity: 1.0 });
const wreckMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.95, metalness: 0.1 });
const wheelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const headMaterial = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2cc, emissiveIntensity: 0.6 });

function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
export function makeGlowSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}

function buildWheelGeometry(r, w) {
  const b = new MeshBuilder();
  const tire = new THREE.CylinderGeometry(r, r, w, 14);
  tire.rotateZ(Math.PI / 2);
  b.geometry(tire, new THREE.Matrix4(), 0x1a1a1a);
  const hub = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10);
  hub.rotateZ(Math.PI / 2);
  b.geometry(hub, new THREE.Matrix4(), CHROME);
  return b.build();
}

function buildBody(type, paint) {
  const T = VEHICLE_TYPES[type];
  const b = new MeshBuilder();
  const { len: L, wid: W, hgt: H, wheelR: r } = T;
  const lowY = r * 0.55;
  if (T.style === 'bike') {
    b.box(0, 0.62, 0.05, 0.22, 0.28, 1.2, TRIM);
    b.box(0, 0.86, 0.25, 0.36, 0.26, 0.6, paint);
    b.box(0, 0.86, -0.4, 0.3, 0.12, 0.7, 0x151515);
    b.box(0, 0.7, -0.75, 0.25, 0.2, 0.5, paint);
    b.box(0, 0.72, 0.85, 0.08, 0.7, 0.08, CHROME, { rotY: 0 });
    b.box(0, 1.08, 0.72, 0.7, 0.05, 0.05, TRIM);
    b.box(0, 0.45, -0.3, 0.12, 0.12, 0.8, CHROME);
    return b.build();
  }
  const lowerH = T.style === 'van' ? H * 0.78 - lowY : H * 0.5 - lowY + 0.05;
  const lowerTop = lowY + lowerH;
  const stripe = T.style === 'muscle' ? (paint === 0xffffff || paint === 0xf4d35e ? 0x111111 : 0xf8f8f8) : null;
  const twoTone = T.police ? 0x111418 : null;
  // lower body
  b.box(0, lowY + lowerH / 2, 0, W, lowerH, L, twoTone ?? paint);
  if (twoTone) b.box(0, lowerTop - 0.12, 0, W + 0.01, 0.24, L * 0.5, paint);
  // bumpers, grille, skirts
  b.box(0, lowY + 0.12, L / 2 + 0.03, W * 0.98, 0.26, 0.12, TRIM);
  b.box(0, lowY + 0.12, -L / 2 - 0.03, W * 0.98, 0.26, 0.12, TRIM);
  b.box(0, lowY + lowerH * 0.55, L / 2 + 0.02, W * 0.5, lowerH * 0.35, 0.06, 0x111111);
  b.box(0, lowY + 0.05, 0, W + 0.02, 0.1, L * 0.62, TRIM);
  if (T.police) b.box(0, lowY + 0.3, L / 2 + 0.18, W * 0.7, 0.4, 0.12, 0x111111);
  // cabin
  let cabL, cabZ, cabH;
  switch (T.style) {
    case 'hatch': cabL = L * 0.58; cabZ = -L * 0.12; cabH = H - lowerTop; break;
    case 'muscle': cabL = L * 0.4; cabZ = -L * 0.1; cabH = H - lowerTop; break;
    case 'sports': cabL = L * 0.42; cabZ = -L * 0.06; cabH = H - lowerTop; break;
    case 'pickup': cabL = L * 0.3; cabZ = L * 0.05; cabH = H - lowerTop; break;
    case 'van': cabL = L * 0.8; cabZ = -L * 0.08; cabH = H - lowerTop; break;
    default: cabL = L * 0.46; cabZ = -L * 0.05; cabH = H - lowerTop;
  }
  const taperZ = T.style === 'van' ? 0.92 : T.style === 'sports' ? 0.55 : 0.72;
  b.box(0, lowerTop + cabH / 2, cabZ, W * 0.9, cabH, cabL, GLASS, { taperX: 0.86, taperZ });
  b.box(0, lowerTop + cabH + 0.03, cabZ - (T.style === 'van' ? 0 : 0.02), W * 0.9 * 0.86, 0.07, cabL * taperZ, twoTone ? paint : paint);
  // pillars (paint strips on the cabin sides)
  b.box(W * 0.43, lowerTop + cabH * 0.45, cabZ, 0.04, cabH * 0.9, 0.14, paint);
  b.box(-W * 0.43, lowerTop + cabH * 0.45, cabZ, 0.04, cabH * 0.9, 0.14, paint);
  // mirrors
  b.box(W / 2 + 0.08, lowerTop + 0.1, cabZ + cabL * 0.45, 0.14, 0.1, 0.16, paint);
  b.box(-W / 2 - 0.08, lowerTop + 0.1, cabZ + cabL * 0.45, 0.14, 0.1, 0.16, paint);
  if (T.style === 'pickup') {
    const bedZ = -L * 0.27, bedL = L * 0.42;
    b.box(0, lowerTop + 0.25, bedZ, W, 0.5, 0.08, paint);
    b.box(W / 2 - 0.04, lowerTop + 0.25, bedZ + bedL / 2 - 0.2, 0.08, 0.5, bedL, paint);
    b.box(-W / 2 + 0.04, lowerTop + 0.25, bedZ + bedL / 2 - 0.2, 0.08, 0.5, bedL, paint);
    b.box(0, lowerTop + 0.25, -L / 2 + 0.05, W, 0.5, 0.08, paint);
    b.box(0, lowerTop + 0.02, bedZ + 0.6, W * 0.9, 0.04, bedL, 0x2a2a2a);
  }
  if (T.style === 'muscle') {
    b.box(0, lowerTop + 0.08, L * 0.28, 0.6, 0.14, 0.7, TRIM);
    for (const s of [-0.22, 0.22]) b.box(s, lowerTop + 0.005, 0, 0.18, 0.01, L * 0.98, stripe);
    for (const s of [-0.22, 0.22]) b.box(s, H + 0.035, cabZ, 0.18, 0.01, cabL * taperZ, stripe);
  }
  if (T.style === 'sports') {
    b.box(0, lowerTop + 0.32, -L / 2 + 0.25, W * 0.9, 0.05, 0.35, TRIM);
    for (const s of [-1, 1]) b.box(s * W * 0.38, lowerTop + 0.16, -L / 2 + 0.3, 0.05, 0.3, 0.1, TRIM);
  }
  if (T.style === 'van') {
    b.box(0, lowerTop - 0.45, -0.3, W + 0.01, 0.12, L * 0.6, 0xff7a3d);
  }
  if (T.taxi) {
    b.box(0, H + 0.2, cabZ, 0.7, 0.28, 0.3, 0xffe066);
    b.box(0, lowY + lowerH * 0.55, 0, W + 0.02, 0.18, L * 0.6, 0x1a1a1a);
  }
  return b.build();
}

/** Small emissive boxes: headlights (front) and tail lights (rear). */
function buildLightGeometry(T, front) {
  const b = new MeshBuilder();
  const { len: L, wid: W, hgt: H, wheelR: r } = T;
  const y = T.style === 'bike' ? 0.95 : r * 0.55 + (T.style === 'van' ? H * 0.5 : H * 0.36);
  if (T.style === 'bike') {
    if (front) b.box(0, y, 0.95, 0.18, 0.14, 0.06, 0xffffff);
    else b.box(0, 0.78, -1.02, 0.18, 0.08, 0.04, 0xffffff);
    return b.build();
  }
  const z = front ? L / 2 + 0.02 : -L / 2 - 0.02;
  for (const s of [-1, 1]) b.box(s * W * 0.36, y, z, W * 0.2, 0.13, 0.05, 0xffffff);
  return b.build();
}

export function buildVehicleModel(typeKey, paint) {
  const T = VEHICLE_TYPES[typeKey];
  const key = `${typeKey}:${paint}`;
  if (!bodyCache.has(key)) {
    bodyCache.set(key, { body: buildBody(typeKey, paint), head: buildLightGeometry(T, true), tail: buildLightGeometry(T, false) });
  }
  const geos = bodyCache.get(key);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bodyMesh = new THREE.Mesh(geos.body, bodyMaterial);
  bodyMesh.castShadow = true;
  body.add(bodyMesh);
  const head = new THREE.Mesh(geos.head, headMaterial);
  body.add(head);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x9a1010, emissive: 0xff1a1a, emissiveIntensity: 0.4 });
  const tail = new THREE.Mesh(geos.tail, tailMat);
  body.add(tail);

  if (!wheelGeo) {
    wheelGeo = buildWheelGeometry(0.36, 0.26);
    bikeWheelGeo = buildWheelGeometry(0.33, 0.12);
  }
  const wheels = [];
  const r = T.wheelR;
  const sx = T.wid / 2 - 0.12;
  const axle = T.len * 0.34;
  const spots = T.bike ? [[0, axle * 1.25, true], [0, -axle * 1.25, false]] : [[sx, axle, true], [-sx, axle, true], [sx, -axle, false], [-sx, -axle, false]];
  for (const [x, z, front] of spots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const m = new THREE.Mesh(T.bike ? bikeWheelGeo : wheelGeo, wheelMaterial);
    m.scale.setScalar(r / (T.bike ? 0.33 : 0.36));
    m.castShadow = false;
    pivot.add(m);
    root.add(pivot);
    wheels.push({ pivot, mesh: m, front, x, z });
  }

  const glows = [];
  for (const s of T.bike ? [0] : [-1, 1]) {
    const g = makeGlowSprite(0xfff1d0, 1.6);
    g.position.set(s * T.wid * 0.36, r * 0.55 + T.hgt * 0.36, T.len / 2 + 0.3);
    g.visible = false;
    body.add(g);
    glows.push(g);
  }

  let lightbar = null;
  if (T.police) {
    const red = new THREE.MeshBasicMaterial({ color: 0xff2030 });
    const blue = new THREE.MeshBasicMaterial({ color: 0x2050ff });
    const y = T.hgt + 0.12;
    const mr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), red);
    const mb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), blue);
    mr.position.set(-0.3, y, -T.len * 0.05);
    mb.position.set(0.3, y, -T.len * 0.05);
    body.add(mr, mb);
    const gr = makeGlowSprite(0xff2030, 3.2), gb = makeGlowSprite(0x3060ff, 3.2);
    gr.position.copy(mr.position); gb.position.copy(mb.position);
    body.add(gr, gb);
    lightbar = { red, blue, gr, gb };
  }
  return { root, body, bodyMesh, wheels, tailMat, glows, lightbar };
}

export function setWrecked(model) {
  model.bodyMesh.material = wreckMaterial;
  model.tailMat.emissiveIntensity = 0;
  for (const g of model.glows) g.visible = false;
}
