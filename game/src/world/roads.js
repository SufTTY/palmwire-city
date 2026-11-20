// Ground of the city: asphalt grid with lane markings and crosswalks, raised sidewalks and lot
// surfaces per block, the outer land, the sloping beach, the canal walls and its bridges.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { asphaltTexture, sidewalkTexture, groundTexture } from './textures.js';
import {
  BLOCK, GRID, CITY, ROAD_HALF, WALK, CANAL_COL, SIDEWALK_Y, BEACH_Z0, SHORE_Z, EAST_SHORE_X, WATER_Y,
} from '../config.js';

const LOT_GROUND = { park: 'grass', residential: 'grass', downtown: 'plaza', midtown: 'plaza', beach: 'sand', docks: 'concrete' };

export class RoadMeshes {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'ground';
  }

  build() {
    this.buildAsphalt();
    this.buildMarkings();
    this.buildBlocks();
    this.buildOuterGround();
    this.buildCanal();
    this.game.scene.add(this.group);
  }

  mesh(gb, material, { shadow = true } = {}) {
    const m = new THREE.Mesh(gb.build(), material);
    m.receiveShadow = shadow;
    this.group.add(m);
    return m;
  }

  buildAsphalt() {
    const gb = new GeometryBuilder();
    const ext0 = -ROAD_HALF, ext1 = CITY + ROAD_HALF;
    for (let k = 0; k <= GRID; k++) {
      const c = k * BLOCK;
      gb.box(ext0, -0.3, c - ROAD_HALF, ext1, 0, c + ROAD_HALF, 0xffffff, { sides: false, topScale: 8 });
      gb.box(c - ROAD_HALF, -0.3, ext0, c + ROAD_HALF, 0, ext1, 0xffffff, { sides: false, topScale: 8 });
    }
    this.mesh(gb, new THREE.MeshStandardMaterial({ map: asphaltTexture(), vertexColors: true, roughness: 0.92 }));
  }

  buildMarkings() {
    const gb = new GeometryBuilder();
    const Y = 0.025, yellow = 0xf2c230, white = 0xf4f4f0;
    const strip = (x0, z0, x1, z1, color) => gb.quad([x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0], color, undefined, [0, 1, 0]);
    for (let k = 0; k <= GRID; k++) {
      const c = k * BLOCK;
      for (let s = 0; s < GRID; s++) {
        const a = s * BLOCK + ROAD_HALF + WALK + 2, b = (s + 1) * BLOCK - ROAD_HALF - WALK - 2;
        // dashed centre lines
        for (let t = a; t < b - 2; t += 6) {
          strip(t, c - 0.12, t + 3, c + 0.12, yellow);
          strip(c - 0.12, t, c + 0.12, t + 3, yellow);
        }
        // solid edge lines
        strip(a - 2, c - ROAD_HALF + 0.4, b + 2, c - ROAD_HALF + 0.55, white);
        strip(a - 2, c + ROAD_HALF - 0.55, b + 2, c + ROAD_HALF - 0.4, white);
        strip(c - ROAD_HALF + 0.4, a - 2, c - ROAD_HALF + 0.55, b + 2, white);
        strip(c + ROAD_HALF - 0.55, a - 2, c + ROAD_HALF - 0.4, b + 2, white);
      }
    }
    // crosswalks and stop lines at every intersection approach
    for (let i = 0; i <= GRID; i++) {
      for (let j = 0; j <= GRID; j++) {
        const x = i * BLOCK, z = j * BLOCK;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx * BLOCK, nz = z + dz * BLOCK;
          if (nx < 0 || nz < 0 || nx > CITY || nz > CITY) continue;
          const d0 = ROAD_HALF + 0.6, d1 = ROAD_HALF + WALK;
          for (let o = -ROAD_HALF + 0.6; o < ROAD_HALF - 0.6; o += 1.2) {
            if (dx) strip(Math.min(x + dx * d0, x + dx * d1), z + o, Math.max(x + dx * d0, x + dx * d1), z + o + 0.6, white);
            else strip(x + o, Math.min(z + dz * d0, z + dz * d1), x + o + 0.6, Math.max(z + dz * d0, z + dz * d1), white);
          }
          // stop line across the inbound lane (right-hand traffic: inbound lane is on the left of outbound)
          const sd = ROAD_HALF + WALK + 0.6;
          if (dx === 1) strip(x + sd, z - ROAD_HALF + 0.5, x + sd + 0.5, z, white);
          if (dx === -1) strip(x - sd - 0.5, z, x - sd, z + ROAD_HALF - 0.5, white);
          if (dz === 1) strip(x, z + sd, x + ROAD_HALF - 0.5, z + sd + 0.5, white);
          if (dz === -1) strip(x - ROAD_HALF + 0.5, z - sd - 0.5, x, z - sd, white);
        }
      }
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh(gb, mat);
  }

  buildBlocks() {
    const { layout } = this.game;
    const walks = new GeometryBuilder();
    const lots = {};
    for (const block of layout.blocks) {
      const r = layout.blockRect(block.bx, block.bz);
      if (block.district === 'canal') {
        // promenade ring around the water
        const w = WALK;
        walks.box(r.x0, -0.6, r.z0, r.x0 + w, SIDEWALK_Y, r.z1, 0xffffff, { topScale: 4, uScale: 4, vScale: 4 });
        walks.box(r.x1 - w, -0.6, r.z0, r.x1, SIDEWALK_Y, r.z1, 0xffffff, { topScale: 4, uScale: 4, vScale: 4 });
        walks.box(r.x0 + w, -0.6, r.z0, r.x1 - w, SIDEWALK_Y, r.z0 + w, 0xffffff, { topScale: 4, uScale: 4, vScale: 4 });
        walks.box(r.x0 + w, -0.6, r.z1 - w, r.x1 - w, SIDEWALK_Y, r.z1, 0xffffff, { topScale: 4, uScale: 4, vScale: 4 });
        continue;
      }
      walks.box(r.x0, -0.2, r.z0, r.x1, SIDEWALK_Y, r.z1, 0xffffff, { topScale: 4, uScale: 4, vScale: 4 });
      const kind = block.plaza ? 'plaza' : (LOT_GROUND[block.district] || 'plaza');
      if (!lots[kind]) lots[kind] = new GeometryBuilder();
      const L = layout.lotRect(block.bx, block.bz);
      lots[kind].box(L.x0, SIDEWALK_Y, L.z0, L.x1, SIDEWALK_Y + 0.02, L.z1, 0xffffff, { sides: false, topScale: kind === 'grass' ? 12 : 8 });
    }
    this.mesh(walks, new THREE.MeshStandardMaterial({ map: sidewalkTexture(), vertexColors: true, roughness: 0.95 }));
    for (const [kind, gb] of Object.entries(lots)) {
      this.mesh(gb, new THREE.MeshStandardMaterial({ map: groundTexture(kind), vertexColors: true, roughness: 1 }));
    }
  }

  buildOuterGround() {
    const grass = new GeometryBuilder();
    const cx0 = CANAL_COL * BLOCK + ROAD_HALF, cx1 = (CANAL_COL + 1) * BLOCK - ROAD_HALF;
    const Y = -0.05, FAR = 2600;
    // north strip, west strip, and the narrow land rims around the grid
    grass.box(-FAR, Y - 0.1, -FAR, EAST_SHORE_X, Y, -ROAD_HALF, 0xc8d6a0, { sides: false, topScale: 24 });
    grass.box(-FAR, Y - 0.1, -ROAD_HALF, -ROAD_HALF, Y, BEACH_Z0, 0xc8d6a0, { sides: false, topScale: 24 });
    grass.box(CITY + ROAD_HALF, Y - 0.1, -ROAD_HALF, EAST_SHORE_X, Y, BEACH_Z0, 0xb0aba0, { sides: false, topScale: 24 });
    this.mesh(grass, new THREE.MeshStandardMaterial({ map: groundTexture('grass'), vertexColors: true, roughness: 1 }));

    // beach: flat sand then a slope under the water line (west of the canal mouth)
    const sand = new GeometryBuilder();
    const slope = (x0, x1) => {
      sand.box(x0, Y - 0.1, BEACH_Z0, x1, Y, SHORE_Z - 12, 0xffffff, { sides: false, topScale: 10 });
      sand.quad([x0, WATER_Y - 2.5, SHORE_Z + 40], [x1, WATER_Y - 2.5, SHORE_Z + 40], [x1, Y, SHORE_Z - 12], [x0, Y, SHORE_Z - 12], 0xe6d3a4,
        [[x0 / 10, 0], [x1 / 10, 0], [x1 / 10, 5], [x0 / 10, 5]]);
    };
    slope(-FAR, cx0);
    this.mesh(sand, new THREE.MeshStandardMaterial({ map: groundTexture('sand'), vertexColors: true, roughness: 1 }));

    // docks quay south and east of the canal: concrete slab with a wall down to the water
    const quay = new GeometryBuilder();
    quay.box(cx1, WATER_Y - 3, BEACH_Z0 - 1, EAST_SHORE_X, Y, SHORE_Z - 40, 0x9c978d, { topScale: 12, uScale: 6, vScale: 6 });
    quay.box(CITY + ROAD_HALF, WATER_Y - 3, -ROAD_HALF, EAST_SHORE_X, Y, BEACH_Z0, 0x9c978d, { topScale: 12, uScale: 6, vScale: 6, top: false });
    this.mesh(quay, new THREE.MeshStandardMaterial({ map: groundTexture('concrete'), vertexColors: true, roughness: 1 }));
  }

  buildCanal() {
    const gb = new GeometryBuilder();
    const x0 = CANAL_COL * BLOCK + ROAD_HALF + WALK, x1 = (CANAL_COL + 1) * BLOCK - ROAD_HALF - WALK;
    const wall = 0x8f8778, deep = WATER_Y - 3;
    // continuous side walls along the whole canal
    gb.quad([x0, deep, -ROAD_HALF], [x0, deep, SHORE_Z], [x0, 0, SHORE_Z], [x0, 0, -ROAD_HALF], wall);
    gb.quad([x1, deep, SHORE_Z], [x1, deep, -ROAD_HALF], [x1, 0, -ROAD_HALF], [x1, 0, SHORE_Z], wall);
    gb.quad([x0, deep, -ROAD_HALF], [x1, deep, -ROAD_HALF], [x1, 0, -ROAD_HALF], [x0, 0, -ROAD_HALF], wall);
    // bridge decks (beams under each crossing road) and railings
    const rail = 0xe9e4d8;
    for (let k = 0; k <= GRID; k++) {
      const z = k * BLOCK;
      const zA = z - ROAD_HALF - WALK, zB = z + ROAD_HALF + WALK;
      gb.box(x0, -1.2, zA, x1, -0.3, zB, 0xb9b1a2, { bottom: true });
      // arches below
      for (const t of [0.25, 0.5, 0.75]) {
        const x = x0 + (x1 - x0) * t;
        gb.box(x - 0.8, deep, zA + 1, x + 0.8, -1.2, zB - 1, 0xa39b8c);
      }
      for (const zr of [zA, zB]) {
        gb.box(x0, SIDEWALK_Y, zr - 0.12, x1, SIDEWALK_Y + 1.0, zr + 0.12, rail);
        for (let x = x0; x <= x1; x += 4) gb.box(x - 0.2, SIDEWALK_Y, zr - 0.2, x + 0.2, SIDEWALK_Y + 1.2, zr + 0.2, rail);
      }
    }
    // promenade railings along the water
    for (let bz = 0; bz < GRID; bz++) {
      const za = bz * BLOCK + ROAD_HALF + WALK, zb = (bz + 1) * BLOCK - ROAD_HALF - WALK;
      gb.box(x0 - 0.1, SIDEWALK_Y, za, x0 + 0.1, SIDEWALK_Y + 1.0, zb, rail);
      gb.box(x1 - 0.1, SIDEWALK_Y, za, x1 + 0.1, SIDEWALK_Y + 1.0, zb, rail);
      this.game.colliders.add(x0, za, x1, zb, 0.5, 'water');
    }
    // the canal mouth opens to the sea south of Sunline Blvd
    const cx0 = CANAL_COL * BLOCK + ROAD_HALF, cx1 = (CANAL_COL + 1) * BLOCK - ROAD_HALF;
    this.game.colliders.add(cx0, BEACH_Z0 + WALK, cx1, SHORE_Z + 60, 0.5, 'water');
    gb.quad([cx0, deep, SHORE_Z], [cx0, deep, BEACH_Z0 + WALK], [cx0, 0, BEACH_Z0 + WALK], [cx0, 0, SHORE_Z], wall);
    this.mesh(gb, new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
}
