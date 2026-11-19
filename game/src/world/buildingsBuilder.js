// Fills every block with district-appropriate architecture: glass towers downtown, pastel deco
// low-rises in Mirador, bungalows in Seagrass Heights, hotels on Coral Strand and warehouses
// with container stacks at the Saltworks Docks. Geometry is merged per 4x4-block chunk and per
// material; footprints become colliders; parking bays, tree spots and billboard spots are
// returned for the prop and vehicle builders.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { makeRng } from '../core/rng.js';
import { SIDEWALK, CURB_Y, CELL } from './cityLayout.js';
import { LANDMARKS, makeSignMaterial } from './landmarks.js';

const PASTELS = [0xf7c6c7, 0xf9e0b0, 0xbfe7d6, 0xc9d7f2, 0xf4b7a3, 0xe8d1f0, 0xfff1c9, 0xa8e0e0, 0xffffff, 0xf2a7b5, 0xd6f0b8];
const BRIGHT = [0xff5a5f, 0x1fb5a8, 0xffb400, 0x3d7dd8, 0xff7ab8, 0x52c46b];
const GLASS_TINTS = [0xffffff, 0xd8f0ff, 0xc6e6ea, 0xe0e4ff, 0xcfe0d8];
const CONTAINER = [0xb5442e, 0x2f6aa8, 0x2f8a5a, 0xe08a26, 0x1c8c8f, 0x7a4fa0, 0xd9cfc0];
const FACADE_UV = [28, 28];
const CHUNK = 4;

export function buildBuildings(scene, layout, tex, colliders) {
  const rng = makeRng(777);
  const group = new THREE.Group();
  group.name = 'buildings';
  const chunks = new Map();
  const chunkOf = (b) => {
    const k = `${Math.floor(b.i / CHUNK)},${Math.floor(b.j / CHUNK)}`;
    if (!chunks.has(k)) chunks.set(k, {});
    return chunks.get(k);
  };
  const out = { parking: [], trees: [], palms: [], billboards: [], pools: [] };

  for (const b of layout.blocks) {
    if (b.type === 'water' || b.type === 'park') continue;
    const ch = chunkOf(b);
    const get = (k) => ch[k] || (ch[k] = new MeshBuilder());
    const lot = { x0: b.x0 + SIDEWALK, z0: b.z0 + SIDEWALK, x1: b.x1 - SIDEWALK, z1: b.z1 - SIDEWALK };
    const landmark = Object.values(LANDMARKS).find((L) => L.block[0] === b.i && L.block[1] === b.j);
    const ctx = { b, lot, get, rng, colliders, out };
    if (landmark) buildLandmark(ctx, landmark, group);
    else if (b.type === 'downtown') buildDowntown(ctx);
    else if (b.type === 'midtown') buildMidtown(ctx);
    else if (b.type === 'residential') buildResidential(ctx);
    else if (b.type === 'beach') buildBeachfront(ctx);
    else if (b.type === 'industrial') buildIndustrial(ctx);
  }

  const mats = createBuildingMaterials(tex);
  for (const ch of chunks.values()) {
    for (const [k, builder] of Object.entries(ch)) {
      if (builder.empty) continue;
      const mesh = new THREE.Mesh(builder.build(), mats[k]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  scene.add(group);
  return { group, mats, ...out };
}

function createBuildingMaterials(tex) {
  const facade = (k, extra = {}) => new THREE.MeshStandardMaterial({
    map: tex.facades[k].map, emissiveMap: tex.facades[k].emissive, emissive: 0xffd9a0, emissiveIntensity: 0,
    vertexColors: true, roughness: 0.82, metalness: 0, ...extra,
  });
  return {
    stucco: facade('stucco'),
    glass: facade('glass', { roughness: 0.18, metalness: 0.55, emissive: 0xfff0d0 }),
    hotel: facade('hotel'),
    house: facade('house'),
    warehouse: facade('warehouse', { roughness: 0.6, metalness: 0.2 }),
    roof: new THREE.MeshStandardMaterial({ map: tex.roof, vertexColors: true, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }),
    tile: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }),
  };
}

/** A box-shaped building: facade walls, roof slab and a collider. */
function addBuilding(ctx, x0, z0, x1, z1, h, facade, tint, opts = {}) {
  const { get, colliders } = ctx;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0;
  const y0 = opts.y0 ?? CURB_Y;
  get(facade).box(cx, y0 + h / 2, cz, sx, h, sz, tint, { uv: FACADE_UV, faces: 'sides', uBase: ((cx * 0.37 + cz * 0.11) % 1 + 1) % 1 });
  get('roof').box(cx, y0 + h + 0.05, cz, sx, 0.1, sz, 0xd8d2c8, { uv: [6, 6], faces: 'top' });
  // parapet
  if (!opts.noParapet) {
    const p = 0.5, t = 0.35, trimC = opts.parapet ?? 0xf3efe7;
    get('trim').box(cx, y0 + h + p / 2, z0 + t / 2, sx, p, t, trimC);
    get('trim').box(cx, y0 + h + p / 2, z1 - t / 2, sx, p, t, trimC);
    get('trim').box(x0 + t / 2, y0 + h + p / 2, cz, t, p, sz, trimC);
    get('trim').box(x1 - t / 2, y0 + h + p / 2, cz, t, p, sz, trimC);
  }
  if (!opts.noCollider) colliders.addBox(x0, z0, x1, z1, y0 + h);
  return { cx, cz, sx, sz, top: y0 + h };
}

function rooftopClutter(ctx, x0, z0, x1, z1, top) {
  const { rng, get } = ctx;
  const n = rng.int(1, 4);
  for (let k = 0; k < n; k++) {
    const w = rng.range(2, 4.5), d = rng.range(2, 4);
    const x = rng.range(x0 + w, x1 - w), z = rng.range(z0 + d, z1 - d);
    get('trim').box(x, top + 0.8, z, w, 1.6, d, rng.pick([0xbfc3c7, 0xd5d0c6, 0x9aa0a6]));
  }
}

function buildDowntown(ctx) {
  const { lot, rng, b, get, out } = ctx;
  const dc = Math.hypot(b.cx - 6.5 * CELL, b.cz - 5.5 * CELL);
  const baseH = 70 + 110 * Math.max(0, 1 - dc / 260);
  const split = rng.pick(['one', 'two', 'two', 'four']);
  const parcels = splitLot(lot, split === 'one' ? 1 : 2, split === 'four' ? 2 : 1, rng.chance(0.5));
  for (const p of parcels) {
    const m = rng.range(2, 4);
    const x0 = p.x0 + m, z0 = p.z0 + m, x1 = p.x1 - m, z1 = p.z1 - m;
    const h = Math.max(28, baseH * rng.range(0.45, 1.05) * (split === 'four' ? 0.7 : 1));
    const glassy = rng.chance(0.65);
    const facade = glassy ? 'glass' : 'stucco';
    const tint = glassy ? rng.pick(GLASS_TINTS) : rng.pick(PASTELS);
    if (h > 70 && rng.chance(0.6)) {
      // stepped tower: podium, shaft, crown
      const podium = rng.range(10, 16);
      addBuilding(ctx, x0, z0, x1, z1, podium, 'stucco', rng.pick(PASTELS), { noCollider: true });
      const s1 = 0.12 * (x1 - x0), s2 = 0.12 * (z1 - z0);
      addBuilding(ctx, x0 + s1, z0 + s2, x1 - s1, z1 - s2, h * 0.75 - podium, facade, tint, { y0: CURB_Y + podium, noCollider: true });
      const t1 = 0.25 * (x1 - x0), t2 = 0.25 * (z1 - z0);
      const top = addBuilding(ctx, x0 + t1, z0 + t2, x1 - t1, z1 - t2, h * 0.25, facade, tint, { y0: CURB_Y + h * 0.75, noCollider: true });
      ctx.colliders.addBox(x0, z0, x1, z1, CURB_Y + podium);
      ctx.colliders.addBox(x0 + s1, z0 + s2, x1 - s1, z1 - s2, CURB_Y + h);
      get('trim').box(top.cx, top.top + 6, top.cz, 0.6, 12, 0.6, 0xdddddd);
      get('trim').box(top.cx, top.top + 12.3, top.cz, 0.9, 0.6, 0.9, 0xff3030);
    } else {
      const bld = addBuilding(ctx, x0, z0, x1, z1, h, facade, tint);
      rooftopClutter(ctx, x0, z0, x1, z1, bld.top);
      if (rng.chance(0.3)) {
        // helipad
        get('trim').box(bld.cx, bld.top + 0.25, bld.cz, Math.min(14, bld.sx - 3), 0.3, Math.min(14, bld.sz - 3), 0x50565c);
        get('trim').box(bld.cx, bld.top + 0.42, bld.cz, 1.2, 0.05, 6, 0xffffff);
      }
    }
    // ground-floor lobby glazing band
    get('trim').box((x0 + x1) / 2, CURB_Y + 2.2, (z0 + z1) / 2, x1 - x0 + 0.3, 0.5, z1 - z0 + 0.3, 0x2b2f36);
  }
  // street-level palms along the plaza
  for (let k = 0; k < 4; k++) out.palms.push([lot.x0 + 2 + (k % 2) * (lot.x1 - lot.x0 - 4), lot.z0 + 2 + Math.floor(k / 2) * (lot.z1 - lot.z0 - 4)]);
}

function buildMidtown(ctx) {
  const { lot, rng, get, out } = ctx;
  const parcels = splitLot(lot, 2, 2, false);
  let parkingDone = false;
  for (const p of parcels) {
    if (!parkingDone && rng.chance(0.22)) {
      parkingDone = true;
      addParkingLot(ctx, p);
      continue;
    }
    const m = 1.5;
    const x0 = p.x0 + m, z0 = p.z0 + m, x1 = p.x1 - m, z1 = p.z1 - m;
    const h = rng.range(9, 34);
    const tint = rng.pick(PASTELS);
    const bld = addBuilding(ctx, x0, z0, x1, z1, h, 'stucco', tint, { parapet: rng.pick([0xffffff, 0xf8efe0, rng.pick(BRIGHT)]) });
    // awnings and a deco cornice
    const aw = rng.pick(BRIGHT);
    get('trim').box(bld.cx, CURB_Y + 3.6, bld.cz, bld.sx + 2.2, 0.25, bld.sz + 2.2, aw);
    get('trim').box(bld.cx, CURB_Y + 1.6, bld.cz, bld.sx + 0.1, 3.2, bld.sz + 0.1, 0x30363e);
    if (h > 18) get('trim').box(bld.cx, bld.top - 1.2, bld.cz, bld.sx + 0.6, 0.8, bld.sz + 0.6, 0xffffff);
    rooftopClutter(ctx, x0, z0, x1, z1, bld.top);
    if (h > 14 && rng.chance(0.35)) {
      const side = rng.int(0, 1);
      out.billboards.push({ x: bld.cx, y: bld.top + 1, z: side ? z1 - 2 : z0 + 2, rotY: side ? 0 : Math.PI, w: Math.min(16, bld.sx - 2), ad: rng.int(0, 3) });
    }
  }
}

function buildResidential(ctx) {
  const { lot, rng, get, out } = ctx;
  const parcels = splitLot(lot, 3, 2, rng.chance(0.5));
  for (const p of parcels) {
    const pw = p.x1 - p.x0, pd = p.z1 - p.z0;
    const w = Math.min(pw - 4, rng.range(9, 13)), d = Math.min(pd - 6, rng.range(9, 13));
    const cx = (p.x0 + p.x1) / 2 + rng.range(-1, 1), cz = (p.z0 + p.z1) / 2;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const h = rng.chance(0.4) ? 7 : 4;
    const tint = rng.pick(PASTELS);
    const pitched = rng.chance(0.65);
    const bld = addBuilding(ctx, x0, z0, x1, z1, h, 'house', tint, { noParapet: pitched, parapet: 0xffffff });
    if (pitched) {
      get('tile').gableRoof(bld.cx, bld.top, bld.cz, w + 1, d + 1, rng.range(2, 3.2), rng.pick([0xc0603c, 0xb05238, 0x8a8f96, 0xd27a4a]), w > d ? 0 : Math.PI / 2);
    }
    // driveway + parked car spot, pool, garden trees
    const dz = p.z1 - 2.5;
    if (rng.chance(0.55)) out.parking.push({ x: Math.min(p.x1 - 2.5, x1 + 2), z: (z1 + p.z1) / 2, heading: Math.PI / 2 * (rng.chance(0.5) ? 1 : -1), district: 'residential' });
    if (rng.chance(0.25) && pw > 16) {
      get('trim').box(cx, CURB_Y + 0.06, (z0 + p.z0) / 2 - 0.5, 6, 0.1, Math.max(2, z0 - p.z0 - 2), 0x2ec4d6);
    }
    if (rng.chance(0.7)) out.trees.push([p.x0 + 1.5, dz]);
    if (rng.chance(0.4)) out.palms.push([p.x1 - 1.5, p.z0 + 1.5]);
  }
}

function buildBeachfront(ctx) {
  const { lot, rng, get, out } = ctx;
  const n = rng.chance(0.5) ? 1 : 2;
  const parcels = splitLot(lot, 1, n, false);
  for (const p of parcels) {
    const x0 = p.x0 + 4, x1 = p.x1 - 10, z0 = p.z0 + 3, z1 = p.z1 - 3;
    const h = rng.range(16, 46);
    const bld = addBuilding(ctx, x0, z0, x1, z1, h, 'hotel', rng.pick(PASTELS), { parapet: rng.pick(BRIGHT) });
    get('trim').box(bld.cx, bld.top - 0.4, bld.cz, bld.sx + 0.8, 0.8, bld.sz + 0.8, 0xffffff);
    // rooftop pool
    get('trim').box(bld.cx, bld.top + 0.12, bld.cz, bld.sx * 0.5, 0.15, bld.sz * 0.4, 0x35d0e0);
    out.palms.push([p.x1 - 4, p.z0 + 3], [p.x1 - 4, (p.z0 + p.z1) / 2], [p.x1 - 4, p.z1 - 3]);
    if (h > 24) out.billboards.push({ x: bld.cx, y: bld.top + 1, z: z0 + 2, rotY: Math.PI, w: Math.min(14, bld.sx - 2), ad: rng.int(0, 3) });
    out.parking.push({ x: p.x1 - 6, z: (p.z0 + p.z1) / 2 + 5, heading: 0, district: 'beach' });
  }
}

function buildIndustrial(ctx) {
  const { lot, rng, get, colliders, out } = ctx;
  const wx1 = lot.x0 + rng.range(30, 40);
  const z1 = lot.z0 + rng.range(26, 36);
  addBuilding(ctx, lot.x0 + 2, lot.z0 + 2, wx1, z1, rng.range(8, 14), 'warehouse', rng.pick([0xc9d6e0, 0xe0c7a8, 0xd0d0d0, 0xb7cbb8]), { parapet: 0x8a8f96 });
  // container stacks
  for (let row = 0; row < 3; row++) {
    const x = wx1 + 4 + row * 3.2;
    if (x + 1.4 > lot.x1 - 1) break;
    const zz0 = lot.z0 + 3;
    const stack = rng.int(1, 3);
    for (let s = 0; s < stack; s++) {
      get('warehouse').box(x, CURB_Y + 1.3 + s * 2.6, zz0 + 6.1, 2.5, 2.6, 12.2, rng.pick(CONTAINER), { uv: FACADE_UV });
    }
    colliders.addBox(x - 1.25, zz0, x + 1.25, zz0 + 12.2, CURB_Y + stack * 2.6);
  }
  // tanks
  if (rng.chance(0.6)) {
    const tx = lot.x1 - 7, tz = lot.z1 - 8;
    get('trim').cylinder(tx, CURB_Y, tz, 5, 5, 9, 16, 0xe8e6e0, { cap: true });
    colliders.addCircle(tx, tz, 5, 9);
  }
  out.parking.push({ x: lot.x0 + 8, z: lot.z1 - 6, heading: Math.PI / 2, district: 'industrial' });
  out.parking.push({ x: lot.x0 + 20, z: lot.z1 - 6, heading: -Math.PI / 2, district: 'industrial' });
}

function buildLandmark(ctx, L, group) {
  const { b, get, out } = ctx;
  const x0 = b.x0 + 8, x1 = b.x1 - 8, z0 = b.z0 + 8, z1 = b.z0 + 36;
  const bld = addBuilding(ctx, x0, z0, x1, z1, L.h, L.facade, L.tint, { parapet: 0xffffff });
  get('trim').box(bld.cx, CURB_Y + 3.4, z1 + 1.2, bld.sx * 0.6, 0.25, 2.6, 0x30363e);
  get('trim').box(bld.cx, CURB_Y + 1.5, z1 + 0.05, 3, 3, 0.2, 0x1b2026);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(22, bld.sx - 2), 4.1), makeSignMaterial(L));
  sign.position.set(bld.cx, CURB_Y + 6.2, z1 + 0.08);
  group.add(sign);
  out.parking.push({ x: b.cx + 12, z: b.z1 - 12, heading: Math.PI / 2, district: 'landmark' });
  out.parking.push({ x: b.cx - 12, z: b.z1 - 12, heading: Math.PI / 2, district: 'landmark' });
  out.palms.push([x0 - 2, z1 + 3], [x1 + 2, z1 + 3]);
}

function addParkingLot(ctx, p) {
  const { get, out, rng } = ctx;
  get('trim').box((p.x0 + p.x1) / 2, CURB_Y + 0.03, (p.z0 + p.z1) / 2, p.x1 - p.x0 - 1, 0.04, p.z1 - p.z0 - 1, 0x3b3d42);
  for (let x = p.x0 + 3; x < p.x1 - 2; x += 3.2) {
    get('trim').box(x, CURB_Y + 0.06, p.z0 + 4, 0.15, 0.02, 5, 0xe8e4d8);
    if (rng.chance(0.5)) out.parking.push({ x: x + 1.6, z: p.z0 + 4, heading: 0, district: 'lot' });
  }
}

/** Split a lot into nx * nz parcels, optionally swapping the axes. */
function splitLot(lot, nx, nz, swap) {
  if (swap) [nx, nz] = [nz, nx];
  const out = [];
  const w = (lot.x1 - lot.x0) / nx, d = (lot.z1 - lot.z0) / nz;
  for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
    out.push({ x0: lot.x0 + a * w, z0: lot.z0 + c * d, x1: lot.x0 + (a + 1) * w, z1: lot.z0 + (c + 1) * d });
  }
  return out;
}
