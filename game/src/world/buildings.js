// Turns the building footprints of the city plan into merged, textured meshes (one per
// facade style per city chunk), adds rooftop clutter, awnings and landmark signs, and
// registers every footprint as a static collider.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { facadeTextures, signTexture } from './textures.js';
import { LANDMARKS } from '../config.js';
import { Rng } from '../core/rng.js';

const CHUNK_BLOCKS = 4;
const STYLE_SCALE = {
  glass: [16, 14], concrete: [16, 14], stucco: [16, 14], hotel: [16, 14], warehouse: [24, 14], house: [12, 14],
};
const ROOF_UV = [0.01, 0.99];
const AWNING_COLORS = [0xe94f37, 0x2a9d8f, 0xf4a259, 0x3d5a80, 0xe76f51, 0x8ab17d, 0xf2cc8f];

export class BuildingMeshes {
  constructor(game) {
    this.game = game;
    this.materials = {};
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.windowMaterials = [];
  }

  material(style) {
    if (this.materials[style]) return this.materials[style];
    const { map, emissive } = facadeTextures(style);
    const m = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0,
      vertexColors: true, roughness: style === 'glass' ? 0.32 : 0.85, metalness: style === 'glass' ? 0.25 : 0.0,
    });
    this.windowMaterials.push(m);
    this.materials[style] = m;
    return m;
  }

  build() {
    const { layout, colliders, scene } = this.game;
    const chunks = new Map();
    const detail = new GeometryBuilder();
    const rng = new Rng(layout.seed * 3 + 1);
    const getChunk = (b, style) => {
      const k = Math.floor(b.bx / CHUNK_BLOCKS) + ',' + Math.floor(b.bz / CHUNK_BLOCKS) + ',' + style;
      if (!chunks.has(k)) chunks.set(k, { style, gb: new GeometryBuilder() });
      return chunks.get(k).gb;
    };

    for (const b of layout.buildings) {
      const style = b.style;
      const [us, vs] = STYLE_SCALE[style];
      const gb = getChunk(b, style);
      const top = b.y0 + b.h;
      gb.box(b.x0, b.y0, b.z0, b.x1, top, b.z1, b.color, { uScale: us, vScale: vs, roofUV: ROOF_UV });
      if (b.y0 === 0) colliders.add(b.x0, b.z0, b.x1, b.z1, top, 'building');
      this.addRoofDetail(detail, b, rng);
      if (b.awning) this.addAwnings(detail, b, rng);
    }

    for (const { style, gb } of chunks.values()) {
      const mesh = new THREE.Mesh(gb.build(), this.material(style));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const detailMesh = new THREE.Mesh(detail.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    detailMesh.castShadow = true;
    detailMesh.receiveShadow = true;
    this.group.add(detailMesh);
    this.addLandmarkSigns();
    scene.add(this.group);
  }

  addRoofDetail(gb, b, rng) {
    const top = b.y0 + b.h;
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (b.roof === 'pitched') {
      gb.box(b.x0 - 0.4, top, b.z0 - 0.4, b.x1 + 0.4, top + 0.25, b.z1 + 0.4, 0xb5654a);
      gb.gable(b.x0 - 0.4, b.z0 - 0.4, b.x1 + 0.4, b.z1 + 0.4, top + 0.25, 2.6, rng.pick([0xb5654a, 0xa04f3c, 0x8a6d5a, 0xc47a52]));
      // porch and door
      const cx = (b.x0 + b.x1) / 2;
      gb.box(cx - 1, 0, b.z1, cx + 1, 2.2, b.z1 + 0.08, 0x5a3c28);
      return;
    }
    if (b.roof === 'spire') {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      gb.box(cx - 0.6, top, cz - 0.6, cx + 0.6, top + 26, cz + 0.6, 0xcfd3d6);
      gb.box(cx - 0.25, top + 26, cz - 0.25, cx + 0.25, top + 30, cz + 0.25, 0xff3030);
      return;
    }
    // parapet
    const p = 0.4;
    gb.box(b.x0, top, b.z0, b.x1, top + 1.0, b.z0 + p, 0xb8b2a6);
    gb.box(b.x0, top, b.z1 - p, b.x1, top + 1.0, b.z1, 0xb8b2a6);
    gb.box(b.x0, top, b.z0, b.x0 + p, top + 1.0, b.z1, 0xb8b2a6);
    gb.box(b.x1 - p, top, b.z0, b.x1, top + 1.0, b.z1, 0xb8b2a6);
    gb.box(b.x0 + p, top, b.z0 + p, b.x1 - p, top + 0.08, b.z1 - p, 0x6d6a66);
    const n = Math.min(4, Math.floor((w * d) / 120) + 1);
    for (let i = 0; i < n; i++) {
      const x = rng.range(b.x0 + 2, b.x1 - 4), z = rng.range(b.z0 + 2, b.z1 - 4);
      if (rng.chance(0.3) && b.style !== 'glass') {
        // water tank on legs
        gb.box(x, top, z, x + 0.3, top + 2, z + 0.3, 0x5b4a3a);
        gb.box(x + 2, top, z + 2, x + 2.3, top + 2, z + 2.3, 0x5b4a3a);
        gb.box(x - 0.3, top + 2, z - 0.3, x + 2.6, top + 4.5, z + 2.6, 0x8b6b4a);
      } else {
        gb.box(x, top, z, x + rng.range(1.5, 3.5), top + rng.range(1, 2.2), z + rng.range(1.5, 3), 0xa9aaa6);
      }
    }
    if (b.tower && rng.chance(0.5)) {
      // helipad ring or crown lights
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      gb.box(cx - 4, top + 0.1, cz - 4, cx + 4, top + 0.2, cz + 4, 0x3a3d40);
      gb.box(cx - 2, top + 0.2, cz - 0.3, cx + 2, top + 0.25, cz + 0.3, 0xf2f2f2);
    }
  }

  addAwnings(gb, b, rng) {
    // awnings along the street-facing south and north sides at ground floor
    const color = rng.pick(AWNING_COLORS);
    const y = 3.2;
    for (let x = b.x0 + 1; x < b.x1 - 3; x += 5) {
      const c = (Math.floor((x - b.x0) / 5) % 2) ? color : 0xf6f0e2;
      gb.hexa([
        [x, y, b.z1], [x + 4, y, b.z1], [x + 4, y - 0.8, b.z1 + 1.8], [x, y - 0.8, b.z1 + 1.8],
        [x, y + 0.08, b.z1], [x + 4, y + 0.08, b.z1], [x + 4, y - 0.72, b.z1 + 1.8], [x, y - 0.72, b.z1 + 1.8],
      ], c);
    }
    // shopfront glass band
    gb.box(b.x0 + 0.5, 0.2, b.z1, b.x1 - 0.5, 2.9, b.z1 + 0.06, 0x2e4c5c);
  }

  addLandmarkSigns() {
    for (const [key, l] of Object.entries(LANDMARKS)) {
      const bld = this.game.layout.buildings.find((b) => b.landmark === key && b.y0 === 0);
      if (!bld) continue;
      const tex = signTexture(l.sign, l.color);
      const w = Math.min(14, bld.x1 - bld.x0 - 2);
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
      const y = Math.min(bld.h - 1.5, 7.5);
      sign.position.set((bld.x0 + bld.x1) / 2, y, bld.z1 + 0.12);
      this.group.add(sign);
      if (key === 'vellTower') {
        const big = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), mat);
        big.position.set((bld.x0 + bld.x1) / 2, 170, bld.z1 - 6.8);
        this.group.add(big);
      }
    }
  }

  /** Night-time window glow: 0 = day, 1 = full night. */
  setNightFactor(f) {
    for (const m of this.windowMaterials) m.emissiveIntensity = f * 1.1;
  }
}
