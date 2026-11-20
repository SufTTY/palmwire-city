// Instanced street furniture and greenery: palms, shade trees, street lamps with night-time
// light pools, traffic signals, benches, beach umbrellas and shipping container stacks.
import * as THREE from 'three';
import { frondTexture, softDotTexture, containerTexture } from './textures.js';
import { Rng } from '../core/rng.js';
import { BLOCK, GRID, CITY, ROAD_HALF, WALK, SIDEWALK_Y, BEACH_Z0, SHORE_Z, CANAL_COL, PIER_X } from '../config.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();

function crownGeometry() {
  // eight drooping fronds merged into one geometry
  const positions = [], uvs = [], indices = [];
  const segs = 6, len = 5.2, width = 1.5;
  for (let f = 0; f < 9; f++) {
    const ang = (f / 9) * Math.PI * 2 + (f % 2) * 0.2;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const base = positions.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const r = t * len;
      const y = 0.5 * t - 2.4 * t * t + (f % 3) * 0.12;
      for (const side of [-1, 1]) {
        const w = side * width * 0.5 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.9 + 0.1);
        positions.push(ca * r - sa * w, y, sa * r + ca * w);
        uvs.push(t, side < 0 ? 0 : 1);
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export class Props {
  constructor(game) {
    this.game = game;
    this.rng = new Rng(game.layout.seed * 5 + 9);
    this.palms = [];
    this.trees = [];
    this.lamps = [];
    this.lights = []; // traffic signal heads { x, z, axis }
    this.benches = [];
    this.group = new THREE.Group();
    this.group.name = 'props';
  }

  build() {
    this.placeAll();
    this.buildPalms();
    this.buildTrees();
    this.buildLamps();
    this.buildTrafficLights();
    this.buildBenches();
    this.buildBeach();
    this.buildContainers();
    this.game.scene.add(this.group);
  }

  placeAll() {
    const { layout } = this.game;
    const rng = this.rng;
    const curb = ROAD_HALF + 0.9;
    for (let k = 0; k <= GRID; k++) {
      for (let s = 0; s < GRID; s++) {
        const a = s * BLOCK + ROAD_HALF + WALK + 3, b = (s + 1) * BLOCK - ROAD_HALF - WALK - 3;
        const c = k * BLOCK;
        // lamps along every road, alternating sides
        this.lamps.push({ x: (a + b) / 2, z: c + (s % 2 ? curb : -curb), yaw: s % 2 ? Math.PI : 0, axis: 'x' });
        this.lamps.push({ x: c + (s % 2 ? -curb : curb), z: (a + b) / 2, yaw: s % 2 ? -Math.PI / 2 : Math.PI / 2, axis: 'z' });
        // palms on boulevards and the beach road, trees on residential streets
        const boulevard = k === 5 || k === GRID || k === 8;
        for (let t = a; t <= b; t += 11) {
          for (const side of [-1, 1]) {
            if (k === GRID && side === 1) continue;
            if (k === 0 && side === -1) continue;
            const pz = c + side * curb, px = t;
            const qx = c + side * curb, qz = t;
            const dE = layout.districtKeyAt(px, pz), dN = layout.districtKeyAt(qx, qz);
            if (boulevard || dE === 'beach') this.palms.push({ x: px, z: pz, y: SIDEWALK_Y, s: rng.range(0.9, 1.25) });
            else if ((dE === 'residential' || dE === 'park') && rng.chance(0.6)) this.trees.push({ x: px, z: pz, y: SIDEWALK_Y, s: rng.range(0.8, 1.2) });
            if (boulevard || dN === 'beach') this.palms.push({ x: qx, z: qz, y: SIDEWALK_Y, s: rng.range(0.9, 1.25) });
            else if ((dN === 'residential' || dN === 'park') && rng.chance(0.6)) this.trees.push({ x: qx, z: qz, y: SIDEWALK_Y, s: rng.range(0.8, 1.2) });
          }
        }
      }
    }
    // signals at intersections inside the grid
    for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) {
      const x = i * BLOCK, z = j * BLOCK, o = ROAD_HALF + 0.7;
      if (i > 0 && i < GRID && j > 0 && j < GRID && i !== CANAL_COL + 1 && (i + j) % 1 === 0) {
        this.lights.push({ x: x + o, z: z + o, axis: 'z', yaw: Math.PI });
        this.lights.push({ x: x - o, z: z - o, axis: 'z', yaw: 0 });
        this.lights.push({ x: x - o, z: z + o, axis: 'x', yaw: Math.PI / 2 });
        this.lights.push({ x: x + o, z: z - o, axis: 'x', yaw: -Math.PI / 2 });
      }
    }
    // lot greenery
    for (const block of layout.blocks) {
      const L = layout.lotRect(block.bx, block.bz);
      if (block.park) {
        for (let n = 0; n < 16; n++) this.trees.push({ x: rng.range(L.x0 + 2, L.x1 - 2), z: rng.range(L.z0 + 2, L.z1 - 2), y: SIDEWALK_Y, s: rng.range(1, 1.6) });
        for (let n = 0; n < 4; n++) this.benches.push({ x: rng.range(L.x0 + 4, L.x1 - 4), z: rng.range(L.z0 + 4, L.z1 - 4), yaw: rng.pick([0, Math.PI / 2]) });
      } else if (block.district === 'residential') {
        for (let n = 0; n < 3; n++) {
          const x = rng.range(L.x0 + 1, L.x1 - 1), z = rng.range(L.z0 + 1, L.z1 - 1);
          if (!this.game.colliders.pointInside(x, z) && !this.game.colliders.pointInside(x + 2, z + 2) && !this.game.colliders.pointInside(x - 2, z - 2)) this.trees.push({ x, z, y: SIDEWALK_Y, s: rng.range(0.7, 1.1) });
        }
      } else if (block.plaza || block.district === 'downtown') {
        this.benches.push({ x: (L.x0 + L.x1) / 2, z: L.z1 + 1.2, yaw: 0 });
      }
    }
    // beach palms on the sand
    for (let x = -60; x < CANAL_COL * BLOCK; x += rng.range(12, 22)) {
      this.palms.push({ x, z: BEACH_Z0 + rng.range(18, 34), y: 0, s: rng.range(1.0, 1.4) });
    }
  }

  addCollider(x, z, r, h) { this.game.colliders.add(x - r, z - r, x + r, z + r, h, 'prop'); }

  buildPalms() {
    const n = this.palms.length;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 9, 7, 4);
    trunkGeo.translate(0, 4.5, 0);
    // gentle curve along the trunk
    const tp = trunkGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + (y / 9) * (y / 9) * 0.9); }
    trunkGeo.computeVertexNormals();
    const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a48 }), n);
    const crown = new THREE.InstancedMesh(crownGeometry(), new THREE.MeshLambertMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide }), n);
    this.palms.forEach((p, i) => {
      const yaw = this.rng.range(0, Math.PI * 2);
      Q.setFromEuler(E.set(0, yaw, 0));
      M.compose(P.set(p.x, p.y, p.z), Q, S.set(p.s, p.s, p.s));
      trunk.setMatrixAt(i, M);
      const top = new THREE.Vector3(0.9 * p.s, 9 * p.s, 0).applyQuaternion(Q);
      M.compose(P.set(p.x + top.x, p.y + top.y, p.z + top.z), Q, S.set(p.s, p.s, p.s));
      crown.setMatrixAt(i, M);
      if (p.y > 0) this.addCollider(p.x, p.z, 0.35, 9);
    });
    trunk.castShadow = crown.castShadow = true;
    this.group.add(trunk, crown);
  }

  buildTrees() {
    const n = this.trees.length;
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 3, 6); trunkGeo.translate(0, 1.5, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(2.4, 0); canopyGeo.translate(0, 4.2, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4f35 }), n);
    const canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
    const col = new THREE.Color();
    this.trees.forEach((t, i) => {
      Q.setFromEuler(E.set(0, this.rng.range(0, 6.28), 0));
      M.compose(P.set(t.x, t.y, t.z), Q, S.set(t.s, t.s * this.rng.range(0.9, 1.2), t.s));
      trunk.setMatrixAt(i, M); canopy.setMatrixAt(i, M);
      canopy.setColorAt(i, col.setHSL(0.24 + this.rng.range(-0.04, 0.05), 0.45, 0.32 + this.rng.range(-0.05, 0.06)));
      this.addCollider(t.x, t.z, 0.3, 4);
    });
    trunk.castShadow = canopy.castShadow = true;
    this.group.add(trunk, canopy);
  }

  buildLamps() {
    const n = this.lamps.length;
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7, 6); poleGeo.translate(0, 3.5, 0);
    const armGeo = new THREE.BoxGeometry(0.1, 0.1, 2.0); armGeo.translate(0, 6.9, -0.9);
    const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.9); headGeo.translate(0, 6.8, -1.8);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4146 });
    this.lampHeadMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const pole = new THREE.InstancedMesh(poleGeo, poleMat, n);
    const arm = new THREE.InstancedMesh(armGeo, poleMat, n);
    const head = new THREE.InstancedMesh(headGeo, this.lampHeadMaterial, n);
    // night light pools on the ground
    const poolGeo = new THREE.PlaneGeometry(9, 9); poolGeo.rotateX(-Math.PI / 2);
    this.poolMaterial = new THREE.MeshBasicMaterial({ map: softDotTexture(), color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMaterial, n);
    this.lamps.forEach((l, i) => {
      Q.setFromEuler(E.set(0, l.yaw, 0));
      M.compose(P.set(l.x, SIDEWALK_Y, l.z), Q, S.set(1, 1, 1));
      pole.setMatrixAt(i, M); arm.setMatrixAt(i, M); head.setMatrixAt(i, M);
      const off = new THREE.Vector3(0, 0, -2.2).applyQuaternion(Q);
      M.compose(P.set(l.x + off.x, 0.06, l.z + off.z), Q, S.set(1, 1, 1));
      pools.setMatrixAt(i, M);
      this.addCollider(l.x, l.z, 0.2, 7);
    });
    pole.castShadow = true;
    pools.renderOrder = 2;
    this.group.add(pole, arm, head, pools);
  }

  buildTrafficLights() {
    const n = this.lights.length;
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 4.6, 6); poleGeo.translate(0, 2.3, 0);
    const boxGeo = new THREE.BoxGeometry(0.42, 1.2, 0.35); boxGeo.translate(0, 4.2, 0.1);
    const lampGeo = new THREE.BoxGeometry(0.3, 0.3, 0.06); lampGeo.translate(0, 4.2, 0.3);
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x23272b });
    this.signalMaterials = {
      x: new THREE.MeshBasicMaterial({ color: 0x30ff60, toneMapped: false }),
      z: new THREE.MeshBasicMaterial({ color: 0xff3020, toneMapped: false }),
    };
    const pole = new THREE.InstancedMesh(poleGeo, darkMat, n);
    const box = new THREE.InstancedMesh(boxGeo, darkMat, n);
    const lx = this.lights.filter((l) => l.axis === 'x'), lz = this.lights.filter((l) => l.axis === 'z');
    const lampX = new THREE.InstancedMesh(lampGeo, this.signalMaterials.x, lx.length);
    const lampZ = new THREE.InstancedMesh(lampGeo, this.signalMaterials.z, lz.length);
    let ix = 0, iz = 0;
    this.lights.forEach((l, i) => {
      Q.setFromEuler(E.set(0, l.yaw, 0));
      M.compose(P.set(l.x, SIDEWALK_Y, l.z), Q, S.set(1, 1, 1));
      pole.setMatrixAt(i, M); box.setMatrixAt(i, M);
      if (l.axis === 'x') lampX.setMatrixAt(ix++, M); else lampZ.setMatrixAt(iz++, M);
      this.addCollider(l.x, l.z, 0.15, 4.6);
    });
    this.group.add(pole, box, lampX, lampZ);
  }

  /** Called by the road graph when signal phases change. */
  setSignalColors(stateX, stateZ) {
    const col = { green: 0x30ff60, yellow: 0xffc020, red: 0xff3020 };
    this.signalMaterials.x.color.setHex(col[stateX]);
    this.signalMaterials.z.color.setHex(col[stateZ]);
  }

  buildBenches() {
    const n = this.benches.length;
    const geo = new THREE.BoxGeometry(2, 0.5, 0.6); geo.translate(0, 0.45, 0);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x8a5a3a }), n);
    this.benches.forEach((b, i) => {
      Q.setFromEuler(E.set(0, b.yaw, 0));
      M.compose(P.set(b.x, SIDEWALK_Y, b.z), Q, S.set(1, 1, 1));
      inst.setMatrixAt(i, M);
    });
    this.group.add(inst);
  }

  buildBeach() {
    const rng = this.rng;
    const umbrellas = [];
    for (let x = -40; x < CANAL_COL * BLOCK - 10; x += rng.range(7, 13)) {
      if (Math.abs(x - PIER_X) < 10) continue;
      umbrellas.push({ x, z: BEACH_Z0 + rng.range(40, SHORE_Z - BEACH_Z0 - 18) });
    }
    const n = umbrellas.length;
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5); poleGeo.translate(0, 1.3, 0);
    const topGeo = new THREE.ConeGeometry(1.6, 0.6, 8); topGeo.translate(0, 2.5, 0);
    const towelGeo = new THREE.BoxGeometry(0.9, 0.03, 1.9); towelGeo.translate(1.4, 0.02, 0);
    const pole = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0xeeeeee }), n);
    const top = new THREE.InstancedMesh(topGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    const towel = new THREE.InstancedMesh(towelGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    const palette = [0xff5a5f, 0xffb400, 0x00a699, 0x3d9be9, 0xff7eb6, 0xffffff, 0x7bd389];
    const col = new THREE.Color();
    umbrellas.forEach((u, i) => {
      Q.setFromEuler(E.set(0, rng.range(0, 6.28), rng.range(-0.1, 0.1)));
      M.compose(P.set(u.x, 0, u.z), Q, S.set(1, 1, 1));
      pole.setMatrixAt(i, M); top.setMatrixAt(i, M); towel.setMatrixAt(i, M);
      top.setColorAt(i, col.setHex(rng.pick(palette)));
      towel.setColorAt(i, col.setHex(rng.pick(palette)));
    });
    top.castShadow = true;
    this.group.add(pole, top, towel);
  }

  buildContainers() {
    const { layout } = this.game;
    const rng = this.rng;
    const boxes = [];
    for (const block of layout.blocks) {
      if (!block.containers) continue;
      const L = layout.lotRect(block.bx, block.bz);
      const z0 = block.landmark ? L.z0 + 26 : L.z0 + 32;
      for (let x = L.x0 + 2; x < L.x1 - 13; x += 13.5) {
        for (let z = z0; z < L.z1 - 3; z += 3.2) {
          const stack = rng.int(1, 3);
          for (let s = 0; s < stack; s++) boxes.push({ x: x + 6, z: z + 1.3, y: s * 2.6, color: rng.pick([0xc0392b, 0x2471a3, 0xd68910, 0x1e8449, 0x7d3c98, 0xa04000, 0x5d6d7e]) });
          this.game.colliders.add(x, z, x + 12, z + 2.5, stack * 2.6, 'container');
        }
      }
    }
    const geo = new THREE.BoxGeometry(12, 2.6, 2.5); geo.translate(0, 1.3, 0);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: containerTexture() }), boxes.length);
    const col = new THREE.Color();
    boxes.forEach((b, i) => {
      M.compose(P.set(b.x, b.y, b.z), Q.identity(), S.set(1, 1, 1));
      inst.setMatrixAt(i, M);
      inst.setColorAt(i, col.setHex(b.color));
    });
    inst.castShadow = inst.receiveShadow = true;
    this.group.add(inst);
    void CITY;
  }

  setNightFactor(f) {
    this.lampHeadMaterial.emissiveIntensity = f * 2.0;
    this.poolMaterial.opacity = f * 0.55;
  }
}
