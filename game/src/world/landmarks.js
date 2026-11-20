// One-off set pieces: the boardwalk and Sunset Pier with its Ferris wheel, lifeguard huts,
// dockside gantry cranes and the billboards for Palmwire's invented brands.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { billboardTexture, groundTexture } from './textures.js';
import { Rng } from '../core/rng.js';
import { BLOCK, CITY, BEACH_Z0, SHORE_Z, PIER_X, PIER_END_Z, CANAL_COL, EAST_SHORE_X, WATER_Y, BRANDS, ROAD_HALF } from '../config.js';

export class Landmarks {
  constructor(game) {
    this.game = game;
    this.rng = new Rng(game.layout.seed * 11 + 5);
    this.group = new THREE.Group();
    this.group.name = 'landmarks';
    this.wheel = null;
    this.billboards = [];
  }

  build() {
    this.buildBoardwalkAndPier();
    this.buildFerrisWheel();
    this.buildLifeguardHuts();
    this.buildCranes();
    this.buildBillboards();
    this.game.scene.add(this.group);
  }

  buildBoardwalkAndPier() {
    const wood = new GeometryBuilder();
    const z0 = BEACH_Z0 + 4, z1 = BEACH_Z0 + 11;
    wood.box(-80, -0.2, z0, CANAL_COL * BLOCK, 0.12, z1, 0xffffff, { topScale: 6, uScale: 6, vScale: 6 });
    wood.box(PIER_X - 5, -0.4, z1, PIER_X + 5, 0.12, PIER_END_Z, 0xffffff, { topScale: 6, uScale: 6, vScale: 6 });
    wood.box(PIER_X - 16, -0.4, PIER_END_Z - 40, PIER_X + 16, 0.12, PIER_END_Z, 0xffffff, { topScale: 6, uScale: 6, vScale: 6 });
    this.addMesh(wood, new THREE.MeshLambertMaterial({ map: groundTexture('wood'), vertexColors: true }));

    const posts = new GeometryBuilder();
    for (let z = SHORE_Z - 20; z < PIER_END_Z; z += 8) {
      for (const x of [PIER_X - 4.6, PIER_X + 4.6]) posts.box(x - 0.25, WATER_Y - 3, z - 0.25, x + 0.25, 0, z + 0.25, 0x5a4330);
    }
    // railings
    for (const x of [PIER_X - 5, PIER_X + 5]) posts.box(x - 0.08, 0.12, BEACH_Z0 + 11, x + 0.08, 1.1, PIER_END_Z - 40, 0xf2ead8);
    posts.box(PIER_X - 16, 0.12, PIER_END_Z - 0.2, PIER_X + 16, 1.1, PIER_END_Z, 0xf2ead8);
    // snack kiosk on the pier
    posts.box(PIER_X + 6, 0.12, PIER_END_Z - 36, PIER_X + 14, 3.2, PIER_END_Z - 28, 0xf7d6e0);
    posts.box(PIER_X + 5.5, 3.2, PIER_END_Z - 36.5, PIER_X + 14.5, 3.6, PIER_END_Z - 27.5, 0x2bb5a3);
    this.addMesh(posts, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.game.colliders.add(PIER_X + 6, PIER_END_Z - 36, PIER_X + 14, PIER_END_Z - 28, 3.2, 'building');
  }

  buildFerrisWheel() {
    const g = new THREE.Group();
    const cx = PIER_X - 6, cz = PIER_END_Z - 18, R = 16, H = R + 3;
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf2f0ea });
    for (const s of [-1, 1]) for (const dz of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, H + 1, 0.5), legMat);
      leg.position.set(cx + s * 6, (H + 1) / 2 * 0.98, cz + dz);
      leg.rotation.z = -s * 0.32;
      g.add(leg);
    }
    const wheel = new THREE.Group();
    wheel.position.set(cx, H, cz);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xff5fa8, emissiveIntensity: 0.15 });
    for (const dz of [-1.2, 1.2]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 6, 48), rimMat);
      rim.position.z = dz;
      wheel.add(rim);
    }
    const spokeGeo = new THREE.BoxGeometry(0.15, R * 2, 0.15);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(spokeGeo, legMat);
      sp.rotation.z = (i / 8) * Math.PI;
      wheel.add(sp);
    }
    this.gondolas = [];
    const colors = [0xff5a5f, 0xffb400, 0x00a699, 0x3d9be9, 0xff7eb6, 0x7bd389];
    for (let i = 0; i < 12; i++) {
      const gon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.8), new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
      gon.userData.angle = (i / 12) * Math.PI * 2;
      wheel.add(gon);
      this.gondolas.push(gon);
    }
    g.add(wheel);
    this.wheel = wheel;
    this.wheelRadius = R;
    this.group.add(g);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  buildLifeguardHuts() {
    const gb = new GeometryBuilder();
    const colors = [0xff8fab, 0x7fd1ae, 0xffc857, 0x6ec5ff];
    let i = 0;
    for (let x = 40; x < CANAL_COL * BLOCK - 40; x += 150) {
      const z = SHORE_Z - 30, c = colors[i++ % colors.length];
      for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) gb.box(x + dx - 0.12, 0, z + dz - 0.12, x + dx + 0.12, 2.4, z + dz + 0.12, 0xf0e8da);
      gb.box(x - 1.8, 2.4, z - 1.8, x + 1.8, 4.6, z + 1.8, c);
      gb.box(x - 2.1, 4.6, z - 2.1, x + 2.1, 4.9, z + 2.1, 0xffffff);
      gb.box(x - 0.5, 0, z + 1.8, x + 0.5, 2.4, z + 3.4, 0xd9c7a8);
    }
    this.addMesh(gb, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
  }

  buildCranes() {
    const gb = new GeometryBuilder();
    const yellow = 0xe8a317, red = 0xc0392b;
    for (const [k, z] of [[0, 260], [1, 470], [2, 690]].map(([a, b]) => [a, b])) {
      const x = EAST_SHORE_X - 6, c = k === 1 ? red : yellow;
      for (const dz of [-6, 6]) for (const dx of [-5, 5]) gb.box(x + dx - 0.6, 0, z + dz - 0.6, x + dx + 0.6, 36, z + dz + 0.6, c);
      gb.box(x - 5.6, 30, z - 6.6, x + 5.6, 33, z + 6.6, c);
      gb.box(x - 40, 36, z - 1.2, x + 46, 38.4, z + 1.2, c);
      gb.box(x - 3, 38.4, z - 2, x + 3, 44, z + 2, 0xf2f2f2);
      gb.box(x + 18, 30, z - 0.5, x + 19, 36, z + 0.5, 0x333333);
      this.game.colliders.add(x - 6, z - 7, x + 6, z + 7, 3, 'prop');
    }
    this.addMesh(gb, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
  }

  buildBillboards() {
    const { layout } = this.game;
    const rng = this.rng;
    const frames = new GeometryBuilder();
    const spots = [];
    // roadside billboards along Sunline Blvd facing the street, plus rooftop boards
    for (let i = 0; i < 6; i++) spots.push({ x: 60 + i * 100, y: 9, z: BEACH_Z0 + 15, yaw: Math.PI, w: 12, h: 6, pole: true });
    const roofs = layout.buildings.filter((b) => b.y0 === 0 && !b.tower && b.h > 10 && b.h < 34 && b.roof === 'flat' && b.style !== 'warehouse');
    for (let i = 0; i < 14 && roofs.length; i++) {
      const b = roofs.splice(Math.floor(rng.float() * roofs.length), 1)[0];
      spots.push({ x: (b.x0 + b.x1) / 2, y: b.h + 4.5, z: (b.z0 + b.z1) / 2, yaw: rng.pick([0, Math.PI / 2, -Math.PI / 2]), w: 12, h: 6, roofY: b.h });
    }
    spots.forEach((s, i) => {
      const brand = BRANDS[i % BRANDS.length];
      const mat = new THREE.MeshLambertMaterial({ map: billboardTexture(brand, i + 3), emissive: 0xffffff, emissiveMap: billboardTexture(brand, i + 3), emissiveIntensity: 0.05 });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
      board.position.set(s.x, s.y, s.z);
      board.rotation.y = s.yaw;
      board.castShadow = true;
      this.group.add(board);
      this.billboards.push(board);
      // frame behind the board
      const back = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.4, s.h + 0.4, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b2f33 }));
      back.position.copy(board.position);
      back.rotation.y = s.yaw;
      back.translateZ(-0.2);
      this.group.add(back);
      const base = s.pole ? 0 : s.roofY;
      const dir = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
      for (const side of [-1, 1]) {
        const px = s.x + dir.x * side * s.w * 0.3, pz = s.z + dir.z * side * s.w * 0.3;
        frames.box(px - 0.2, base, pz - 0.2, px + 0.2, s.y - s.h / 2, pz + 0.2, 0x3a3f44);
      }
    });
    this.addMesh(frames, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
    void CITY; void ROAD_HALF;
  }

  addMesh(gb, mat, shadow = false) {
    const m = new THREE.Mesh(gb.build(), mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  update(dt) {
    if (!this.wheel) return;
    this.wheel.rotation.z += dt * 0.08;
    const R = this.wheelRadius;
    for (const g of this.gondolas) {
      const a = g.userData.angle;
      g.position.set(Math.cos(a) * R, Math.sin(a) * R - 1, 0);
      g.rotation.z = -this.wheel.rotation.z;
    }
  }

  setNightFactor(f) {
    for (const b of this.billboards) b.material.emissiveIntensity = 0.05 + f * 0.7;
  }
}
