// Places the city's props: palms and shade trees, street lamps on every block, rooftop and
// beach billboards, the Coral Strand boardwalk with umbrellas and lifeguard towers, the
// lighthouse, dock cranes, park gazebo and radio mast, and sailboats bobbing in Pelican Bay.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { makeRng } from '../core/rng.js';
import {
  CELL, HALF_ROAD, CURB_Y, CITY, BEACH_END, QUAY_END, POINT_END,
} from './cityLayout.js';
import {
  palmGeometry, shadeTreeGeometry, streetLampGeometry, lampBulbGeometry, umbrellaGeometry,
  lifeguardTowerGeometry, sailboatGeometry, craneGeometry, lighthouseGeometry,
} from './propModels.js';

const dummy = new THREE.Object3D();

function instanced(geo, mat, transforms, { shadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, transforms.length));
  transforms.forEach((t, k) => {
    dummy.position.set(t[0], t[1], t[2]);
    dummy.rotation.set(t[5] || 0, t[3] || 0, t[6] || 0);
    const s = t[4] || 1;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
  });
  mesh.count = transforms.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function buildProps(scene, layout, tex, colliders, spots) {
  const rng = makeRng(31337);
  const group = new THREE.Group();
  group.name = 'props';
  const vc = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...extra });
  const foliage = vc({ side: THREE.DoubleSide, roughness: 0.9 });

  // --- Palms ------------------------------------------------------------------------------
  const palms = spots.palms.map(([x, z]) => [x, CURB_Y, z, rng() * 6.28, rng.range(0.85, 1.25)]);
  const sidewalkPalm = (x, z) => palms.push([x, CURB_Y, z, rng() * 6.28, rng.range(0.9, 1.2)]);
  // Coral Strand boulevard: palms on both sidewalks of the two beach avenues
  for (const gi of [13, 14]) {
    for (let z = 20; z < CITY - 10; z += 18) {
      if (Math.abs((z % CELL) - 0) < 10 || Math.abs((z % CELL) - CELL) < 10) continue;
      sidewalkPalm(gi * CELL - HALF_ROAD - 1.6, z);
      sidewalkPalm(gi * CELL + HALF_ROAD + 1.6, z + 9);
    }
  }
  // beach sand rows
  for (let z = 10; z < POINT_END - 20; z += 22) {
    palms.push([CITY + 18, 0.05, z + rng.range(-3, 3), rng() * 6.28, rng.range(1, 1.35)]);
    if (rng.chance(0.6)) palms.push([BEACH_END - 12 + rng.range(-4, 4), 0.05, z + 11, rng() * 6.28, rng.range(0.9, 1.3)]);
  }
  // park, outskirts and quay edges
  for (let k = 0; k < 40; k++) palms.push([rng.range(-60, -14), 0.05, rng.range(0, QUAY_END - 20), rng() * 6.28, rng.range(0.9, 1.3)]);
  const palmGeos = [palmGeometry(3), palmGeometry(8)];
  palmGeos.forEach((g, gi) => {
    const subset = palms.filter((_, k) => k % 2 === gi);
    group.add(instanced(g, foliage, subset));
  });
  for (const p of palms) colliders.addCircle(p[0], p[2], 0.35, 9);

  // --- Shade trees (gardens + park) -----------------------------------------------------------
  const trees = spots.trees.map(([x, z]) => [x, CURB_Y, z, rng() * 6.28, rng.range(0.8, 1.2)]);
  for (let k = 0; k < 140; k++) {
    const x = rng.range(16, 3 * CELL - 16), z = rng.range(16, 3 * CELL - 16);
    if (Math.hypot(x - layout.park.cx, z - layout.park.cz) < 14) continue;
    trees.push([x, layout.groundHeight(x, z) - 0.1, z, rng() * 6.28, rng.range(0.9, 1.5)]);
  }
  group.add(instanced(shadeTreeGeometry(5), vc({ flatShading: true }), trees));
  for (const t of trees) colliders.addCircle(t[0], t[2], 0.4, 6);

  // --- Street lamps on every road segment ---------------------------------------------------
  const lamps = [];
  for (const s of layout.segments) {
    if (s.bridge) continue;
    const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
    const off = HALF_ROAD + 0.6;
    if (s.axis === 'h') {
      lamps.push([mx - 18, CURB_Y, mz - off, 0]);
      lamps.push([mx + 18, CURB_Y, mz + off, Math.PI]);
    } else {
      lamps.push([mx - off, CURB_Y, mz + 18, Math.PI / 2]);
      lamps.push([mx + off, CURB_Y, mz - 18, -Math.PI / 2]);
    }
  }
  const lampsOnLand = lamps.filter((l) => layout.surfaceAt(l[0], l[2]).type === 'walk');
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd28a, emissiveIntensity: 0.1 });
  group.add(instanced(streetLampGeometry(), vc({ metalness: 0.4, roughness: 0.5 }), lampsOnLand));
  group.add(instanced(lampBulbGeometry(), lampMat, lampsOnLand, { shadow: false }));
  for (const l of lampsOnLand) colliders.addCircle(l[0], l[2], 0.2, 7);

  // --- Billboards ---------------------------------------------------------------------------
  const boardMat = new THREE.MeshStandardMaterial({ map: tex.billboards, emissiveMap: tex.billboards, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.6 });
  const frame = new MeshBuilder();
  const faces = new MeshBuilder();
  const boards = spots.billboards.slice();
  for (let z = 60; z < CITY; z += 2 * CELL) boards.push({ x: CITY + 12, y: 0.05, z, rotY: -Math.PI / 2, w: 14, ad: rng.int(0, 3), poles: true });
  boards.push({ x: 8 * CELL + 30, y: 0.15, z: CITY + 14, rotY: Math.PI, w: 16, ad: 3, poles: true });
  for (const bb of boards) {
    const h = bb.w * 0.5;
    const cs = Math.cos(bb.rotY), sn = Math.sin(bb.rotY);
    const lift = bb.poles ? 6 : 1.2;
    const cy = bb.y + lift + h / 2;
    frame.box(bb.x - sn * 0.2, cy, bb.z - cs * 0.2, bb.w + 0.6, h + 0.6, 0.3, 0x2b2f36, { rotY: bb.rotY });
    for (const side of [-1, 1]) {
      const px = bb.x + cs * side * bb.w * 0.3, pz = bb.z - sn * side * bb.w * 0.3;
      frame.box(px - sn * 0.4, bb.y + lift / 2 + 0.2, pz - cs * 0.4, 0.35, lift + 0.4, 0.35, 0x50565e);
      if (bb.poles) colliders.addCircle(px, pz, 0.35, lift);
    }
    const hw = bb.w / 2, hh = h / 2;
    // front face, and a different ad on the back so no board shows a blank slab
    for (const side of [1, -1]) {
      const ad = side > 0 ? bb.ad : (bb.ad + 1) % 4;
      const u0 = (ad % 2) * 0.5, v0 = ad < 2 ? 0.5 : 0;
      const off = side > 0 ? 0.05 : -0.45;
      const P = (lx, ly) => [bb.x + side * lx * cs + off * sn, cy + ly, bb.z - side * lx * sn + off * cs];
      faces.quad([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)], [side * sn, 0, side * cs], [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v0 + 0.5], [u0, v0 + 0.5]], 0xffffff);
    }
  }
  group.add(new THREE.Mesh(frame.build(), vc({ metalness: 0.3 })));
  const faceMesh = new THREE.Mesh(faces.build(), boardMat);
  group.add(faceMesh);

  // --- Coral Strand boardwalk, umbrellas, towels and lifeguard towers -----------------------------
  const wood = new MeshBuilder();
  const bwX = CITY + HALF_ROAD + 7;
  wood.box(bwX, 0.25, (POINT_END - 20) / 2, 6, 0.4, POINT_END - 20, 0xffffff, { uv: [4, 4] });
  // marina jetties on the bay's west shore
  for (let k = 0; k < 3; k++) {
    const z = 10 * CELL + 30 + k * 60;
    wood.box(9 * CELL - HALF_ROAD + 14, -0.2, z, 28, 0.4, 3, 0xffffff, { uv: [4, 4] });
  }
  group.add(new THREE.Mesh(wood.build(), new THREE.MeshStandardMaterial({ map: tex.wood, vertexColors: true, roughness: 0.9 })));
  const umbrellaColors = [0xff5a5f, 0x1fb5a8, 0xffc23d, 0xff7ab8, 0x3d7dd8];
  umbrellaColors.forEach((c, k) => {
    const list = [];
    for (let z = 20 + k * 9; z < POINT_END - 30; z += 46) {
      const x = rng.range(CITY + 26, BEACH_END - 8);
      list.push([x, 0.05, z + rng.range(-4, 4), rng() * 6, 1, rng.range(-0.15, 0.15)]);
    }
    group.add(instanced(umbrellaGeometry(c), vc({ side: THREE.DoubleSide }), list));
  });
  const towels = new MeshBuilder();
  for (let k = 0; k < 70; k++) {
    towels.box(rng.range(CITY + 24, BEACH_END - 4), 0.07, rng.range(10, POINT_END - 30), 1, 0.03, 2, rng.pick(umbrellaColors), { rotY: rng.range(-0.4, 0.4) });
  }
  group.add(new THREE.Mesh(towels.build(), vc()));
  const towers = [];
  for (let z = 90; z < POINT_END - 60; z += 220) towers.push([BEACH_END - 16, 0.05, z, -Math.PI / 2]);
  group.add(instanced(lifeguardTowerGeometry(), vc(), towers));
  for (const t of towers) colliders.addBox(t[0] - 1.4, t[2] - 1.4, t[0] + 1.4, t[2] + 1.4, 5);

  // --- Lighthouse on the point ------------------------------------------------------------
  const lh = new THREE.Mesh(lighthouseGeometry(), vc());
  const lhPos = new THREE.Vector3(CITY + 24, 0.05, POINT_END - 20);
  lh.position.copy(lhPos);
  lh.castShadow = true;
  group.add(lh);
  colliders.addCircle(lhPos.x, lhPos.z, 5.5, 30);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 2.6, 12), new THREE.MeshStandardMaterial({ color: 0xfff4c0, emissive: 0xffe08a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }));
  lampRoom.position.set(lhPos.x, lhPos.y + 27, lhPos.z);
  group.add(lampRoom);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -30, 0);
  beam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group();
  beamPivot.position.copy(lampRoom.position);
  beamPivot.add(beam);
  group.add(beamPivot);

  // --- Saltworks Docks cranes -------------------------------------------------------------
  const cranes = [];
  for (const [x, c] of [[90, 0xf06a2a], [250, 0x2f7ad8], [430, 0xf06a2a], [600, 0xe8c12a]]) {
    const m = new THREE.Mesh(craneGeometry(c), vc({ metalness: 0.3, roughness: 0.6 }));
    m.position.set(x, CURB_Y, QUAY_END - 8);
    m.castShadow = true;
    group.add(m);
    cranes.push(m);
    for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) colliders.addBox(x + dx - 0.6, QUAY_END - 8 + dz - 0.6, x + dx + 0.6, QUAY_END - 8 + dz + 0.6, 28);
  }

  // --- Crestline Park: gazebo and radio mast on the hill ---------------------------------------
  const parkB = new MeshBuilder();
  const top = layout.park.h + CURB_Y;
  const gx = layout.park.cx - 4, gz = layout.park.cz + 4;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    parkB.box(gx + Math.sin(a) * 3, top + 1.4, gz + Math.cos(a) * 3, 0.25, 2.8, 0.25, 0xffffff);
  }
  parkB.cylinder(gx, top - 0.2, gz, 3.6, 3.6, 0.3, 12, 0xd8d0c0, { cap: true });
  parkB.geometry(new THREE.ConeGeometry(4, 2, 6), new THREE.Matrix4().makeTranslation(gx, top + 3.8, gz), 0x2f8f8a);
  const mx = layout.park.cx + 8, mz = layout.park.cz - 6;
  parkB.box(mx, top + 20, mz, 1.6, 40, 1.6, 0xd84a3a, { taperX: 0.25, taperZ: 0.25 });
  for (let y = 4; y < 38; y += 8) parkB.box(mx, top + y, mz, 2.2 - y * 0.04, 0.3, 2.2 - y * 0.04, 0xf2f2f2);
  group.add(new THREE.Mesh(parkB.build(), vc()));
  colliders.addCircle(gx, gz, 3.4, top + 4);
  colliders.addCircle(mx, mz, 1.2, top + 40);
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  mastLight.position.set(mx, top + 40.4, mz);
  group.add(mastLight);

  // --- Sailboats in Pelican Bay -------------------------------------------------------------
  const boats = [];
  const boatSpots = [[9.6, 10.6], [10.4, 11.2], [11.6, 10.5], [12.3, 11.3], [10.2, 13.2], [11.4, 13.5], [12.4, 12.8], [9.5, 13.6], [12.6, 14.6], [10.6, 14.9]];
  boatSpots.forEach(([bi, bj], k) => {
    const m = new THREE.Mesh(sailboatGeometry(100 + k), vc({ side: THREE.DoubleSide }));
    m.position.set(bi * CELL, -1.4, bj * CELL);
    m.rotation.y = rng() * 6.28;
    m.castShadow = true;
    group.add(m);
    boats.push({ mesh: m, phase: rng() * 6.28, baseY: -1.4 });
    colliders.addCircle(m.position.x, m.position.z, 3, 3);
  });

  scene.add(group);

  return {
    group, lampMat, boardMat, beam, lampRoom, mastLight,
    lighthouse: lhPos,
    update(dt, time, night) {
      for (const b of boats) {
        b.mesh.position.y = b.baseY + Math.sin(time * 0.9 + b.phase) * 0.25;
        b.mesh.rotation.z = Math.sin(time * 0.7 + b.phase) * 0.05;
        b.mesh.rotation.x = Math.sin(time * 0.6 + b.phase * 2) * 0.03;
      }
      beamPivot.rotation.y = time * 0.8;
      beam.material.opacity = 0.18 * night;
      lampMat.emissiveIntensity = 0.1 + 2.6 * night;
      boardMat.emissiveIntensity = 0.12 + 0.7 * night;
      lampRoom.material.emissiveIntensity = 0.4 + 2 * night;
      mastLight.visible = Math.sin(time * 3) > 0;
    },
  };
}
