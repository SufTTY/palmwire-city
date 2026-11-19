// Builds the ground of Palmwire City: block pads with sidewalks, district lots, asphalt roads and
// intersections, the cable-stayed Pelican Bay bridge, beaches sloping into the sea, the quay,
// Crestline Park's hill and the distant hills that frame the skyline.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { makeRng } from '../core/rng.js';
import {
  CELL, HALF_ROAD, SIDEWALK, CURB_Y, CITY, BEACH_END, QUAY_END, POINT_END, N, parkHillHeight,
} from './cityLayout.js';

const LOT_MATERIAL = {
  downtown: 'plaza', midtown: 'concrete', residential: 'grass', beach: 'plaza', industrial: 'concrete',
};
const LOT_TINT = {
  downtown: 0xffffff, midtown: 0xe8e2d8, residential: 0xffffff, beach: 0xfff1e0, industrial: 0x9c968c,
};

function standard(map, opts = {}) {
  return new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, metalness: 0, ...opts });
}

export function buildGround(scene, layout, tex, colliders) {
  const rng = makeRng(4242);
  const group = new THREE.Group();
  group.name = 'ground';
  const mats = {
    sidewalk: standard(tex.sidewalk),
    grass: standard(tex.grass),
    sand: standard(tex.sand),
    plaza: standard(tex.plaza),
    concrete: standard(tex.concrete),
    road: standard(tex.road, { roughness: 0.85 }),
    intersection: standard(tex.intersection, { roughness: 0.85 }),
    bridge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }),
  };
  const B = {};
  const builder = (k) => B[k] || (B[k] = new MeshBuilder());

  // --- Block pads and lots ---------------------------------------------------------------------
  for (const b of layout.blocks) {
    if (b.type === 'water' || b.type === 'park') continue;
    const sx = b.x1 - b.x0, sz = b.z1 - b.z0;
    builder('sidewalk').box(b.cx, (CURB_Y - 4) / 2, b.cz, sx, 4 + CURB_Y, sz, 0xffffff, { uv: [8, 8], faces: ['px', 'nx', 'pz', 'nz', 'py'] });
    const lm = LOT_MATERIAL[b.type];
    const ls = 8 * (lm === 'grass' ? 2 : 1);
    builder(lm).box(b.cx, CURB_Y + 0.01, b.cz, sx - SIDEWALK * 2, 0.02, sz - SIDEWALK * 2, LOT_TINT[b.type], { uv: [ls, ls], faces: 'top' });
  }
  // Crestline Park: one pad for the 3x3 park blocks plus a displaced hill mesh.
  {
    const p0 = HALF_ROAD, p1 = 3 * CELL - HALF_ROAD;
    const c = (p0 + p1) / 2, s = p1 - p0;
    builder('sidewalk').box(c, (CURB_Y - 4) / 2, c, s, 4 + CURB_Y, s, 0xffffff, { uv: [8, 8], faces: ['px', 'nx', 'pz', 'nz', 'py'] });
    const inner = s - SIDEWALK * 2;
    const hill = new THREE.PlaneGeometry(inner, inner, 56, 56);
    hill.rotateX(-Math.PI / 2);
    const pos = hill.attributes.position;
    const uv = hill.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + c, z = pos.getZ(k) + c;
      pos.setY(k, CURB_Y + 0.02 + parkHillHeight(x, z));
      uv.setXY(k, x / 16, z / 16);
    }
    hill.translate(c, 0, c);
    hill.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3).fill(1);
    hill.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const hillMesh = new THREE.Mesh(hill, mats.grass);
    hillMesh.receiveShadow = true;
    group.add(hillMesh);
  }

  // --- Roads -----------------------------------------------------------------------------------
  const roadB = builder('road');
  for (const s of layout.segments) {
    const len = CELL - HALF_ROAD * 2;
    const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
    const vl = len / 24;
    if (s.axis === 'h') {
      const xa = s.x0 + HALF_ROAD, xb = s.x1 - HALF_ROAD;
      roadB.quad([[xa, 0, mz + HALF_ROAD], [xb, 0, mz + HALF_ROAD], [xb, 0, mz - HALF_ROAD], [xa, 0, mz - HALF_ROAD]], [0, 1, 0], [[0, 0], [0, vl], [1, vl], [1, 0]], 0xffffff);
    } else {
      const za = s.z0 + HALF_ROAD, zb = s.z1 - HALF_ROAD;
      roadB.quad([[mx - HALF_ROAD, 0, zb], [mx + HALF_ROAD, 0, zb], [mx + HALF_ROAD, 0, za], [mx - HALF_ROAD, 0, za]], [0, 1, 0], [[0, vl], [1, vl], [1, 0], [0, 0]], 0xffffff);
    }
    if (s.bridge) addBridgeSpan(builder('bridge'), colliders, s, rng);
    else builder('concrete').box(mx, -2.01, mz, s.axis === 'h' ? len : HALF_ROAD * 2, 4, s.axis === 'h' ? HALF_ROAD * 2 : len, 0x8f8a82, { uv: [8, 8], faces: 'sides' });
  }
  for (const n of layout.nodeList) {
    const straightH = n.links.length === 2 && n.links.every((l) => l.dz === 0);
    const straightV = n.links.length === 2 && n.links.every((l) => l.dx === 0);
    const x = n.x, z = n.z, h = HALF_ROAD;
    if (straightH) roadB.quad([[x - h, 0, z + h], [x + h, 0, z + h], [x + h, 0, z - h], [x - h, 0, z - h]], [0, 1, 0], [[0, 0], [0, 0.5], [1, 0.5], [1, 0]], 0xffffff);
    else if (straightV) roadB.quad([[x - h, 0, z + h], [x + h, 0, z + h], [x + h, 0, z - h], [x - h, 0, z - h]], [0, 1, 0], [[0, 0.5], [1, 0.5], [1, 0], [0, 0]], 0xffffff);
    else builder('intersection').quad([[x - h, 0, z + h], [x + h, 0, z + h], [x + h, 0, z - h], [x - h, 0, z - h]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], 0xffffff);
    if (n.bridge) {
      const bb = builder('bridge');
      bb.box(x, -0.5, z, h * 2, 0.98, h * 2, 0xd9d2c5);
      addBridgeRails(bb, colliders, x - h, x + h, z, 'h');
    } else {
      builder('concrete').box(x, -2.01, z, h * 2, 4, h * 2, 0x8f8a82, { uv: [8, 8], faces: 'sides' });
    }
  }
  addBridgePylon(builder('bridge'), colliders, 11 * CELL, 12 * CELL);

  // --- Coast: beach, point, quay, outskirts ----------------------------------------------------
  const sandB = builder('sand');
  const eastX0 = CITY + HALF_ROAD;
  sandB.box((eastX0 + BEACH_END) / 2, -1.975, (POINT_END - HALF_ROAD) / 2, BEACH_END - eastX0, 4.05, POINT_END + HALF_ROAD, 0xffffff, { uv: [16, 16], faces: ['py', 'nz'] });
  const pointX0 = 13 * CELL - HALF_ROAD;
  sandB.box((pointX0 + eastX0) / 2, -1.975, (CITY + HALF_ROAD + POINT_END) / 2, eastX0 - pointX0, 4.05, POINT_END - CITY - HALF_ROAD, 0xffffff, { uv: [16, 16], faces: ['py', 'nx'] });
  // sloping shoreline into the water
  const slope = (pts) => sandB.quad(pts, [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0xe6d2a8);
  slope([[BEACH_END, 0.05, POINT_END], [BEACH_END + 14, -2.4, POINT_END + 14], [BEACH_END + 14, -2.4, -HALF_ROAD - 40], [BEACH_END, 0.05, -HALF_ROAD - 40]]);
  slope([[pointX0, 0.05, POINT_END], [pointX0 - 10, -2.4, POINT_END + 14], [BEACH_END + 14, -2.4, POINT_END + 14], [BEACH_END, 0.05, POINT_END]]);
  builder('concrete').box((9 * CELL - HALF_ROAD - HALF_ROAD) / 2, (CURB_Y - 4) / 2, (CITY + HALF_ROAD + QUAY_END) / 2, 9 * CELL, 4 + CURB_Y, QUAY_END - CITY - HALF_ROAD, 0xb3ada3, { uv: [8, 8], faces: ['py', 'pz', 'px'] });
  const g = builder('grass');
  const north = { x0: -900, x1: BEACH_END, z0: -900, z1: -HALF_ROAD };
  const west = { x0: -900, x1: -HALF_ROAD, z0: -HALF_ROAD, z1: QUAY_END };
  for (const r of [north, west]) {
    g.box((r.x0 + r.x1) / 2, -1.975, (r.z0 + r.z1) / 2, r.x1 - r.x0, 4.05, r.z1 - r.z0, 0xd0d6a0, { uv: [16, 16], faces: ['py', 'px', 'pz'] });
  }

  for (const [k, b] of Object.entries(B)) {
    if (b.empty) continue;
    const mesh = new THREE.Mesh(b.build(), mats[k]);
    mesh.receiveShadow = true;
    mesh.castShadow = k === 'bridge';
    mesh.name = 'ground-' + k;
    group.add(mesh);
  }
  group.add(buildBackdropHills(rng));
  scene.add(group);
  return { group, mats };
}

function addBridgeRails(b, colliders, xa, xb, z, axis) {
  for (const side of [-1, 1]) {
    const rz = z + side * (HALF_ROAD - 0.25);
    b.box((xa + xb) / 2, 0.55, rz, xb - xa, 1.1, 0.35, 0xf2efe8);
    b.box((xa + xb) / 2, -0.95, rz, xb - xa, 0.3, 1.2, 0xb8b2a6);
    if (colliders) colliders.addBox(xa, rz - 0.3, xb, rz + 0.3, 1.2, -2);
  }
  void axis;
}

function addBridgeSpan(b, colliders, s, rng) {
  const xa = s.x0 + HALF_ROAD, xb = s.x1 - HALF_ROAD, z = s.z0;
  b.box((xa + xb) / 2, -0.5, z, xb - xa, 0.98, HALF_ROAD * 2, 0xd9d2c5);
  addBridgeRails(b, colliders, xa, xb, z, 'h');
  for (let x = s.x0 + 20; x < s.x1; x += 40) {
    b.box(x, -4, z, 2.4, 7, 7, 0xc9c1b2);
    b.box(x, -7, z, 3.4, 1, 8, 0x8a8478);
  }
  void rng;
}

/** The A-frame pylon and fanned cables at the middle of the Pelican Bay bridge. */
function addBridgePylon(b, colliders, x, z) {
  const H = 58;
  const legs = [-1, 1];
  for (const s of legs) {
    const lz = z + s * (HALF_ROAD + 1.4);
    b.box(x, H / 2 - 2, lz, 2.6, H + 4, 2.2, 0xf4efe6, { taperZ: 0.4 });
    colliders.addBox(x - 1.3, lz - 1.1, x + 1.3, lz + 1.1, H);
  }
  b.box(x, H - 4, z, 2.4, 3, HALF_ROAD * 2 + 4, 0xf4efe6);
  b.box(x, H + 2, z, 1.4, 10, 1.4, 0xff5a3c);
  // cables: thin slanted boxes from the pylon top to the deck edges
  const top = new THREE.Vector3(x, H - 2, z);
  for (const s of legs) {
    for (let k = 1; k <= 6; k++) {
      for (const dir of [-1, 1]) {
        const end = new THREE.Vector3(x + dir * k * 14, 1.1, z + s * (HALF_ROAD - 0.3));
        const mid = top.clone().add(end).multiplyScalar(0.5);
        const len = top.distanceTo(end);
        const m = new THREE.Matrix4().lookAt(top, end, new THREE.Vector3(0, 1, 0));
        m.setPosition(mid);
        const geo = new THREE.BoxGeometry(0.18, 0.18, len);
        b.geometry(geo, m, 0xe9e4da);
      }
    }
  }
}

/** Low green-gold hills around the north and west horizon. */
function buildBackdropHills(rng) {
  const b = new MeshBuilder();
  const cone = new THREE.ConeGeometry(1, 1, 7, 1);
  cone.translate(0, 0.5, 0);
  const place = (x, z) => {
    const r = rng.range(120, 260), h = rng.range(40, 120);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, -2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 6, 0)), new THREE.Vector3(r, h, r * rng.range(0.7, 1.2)));
    b.geometry(cone, m, rng.pick([0x7f8f55, 0x8e9a5c, 0x9a925a, 0x6f8250]));
  };
  for (let k = 0; k < 14; k++) place(rng.range(-700, CITY + 100), rng.range(-750, -420));
  for (let k = 0; k < 10; k++) place(rng.range(-750, -420), rng.range(-500, CITY));
  const mesh = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  mesh.name = 'backdrop-hills';
  void N;
  return mesh;
}
