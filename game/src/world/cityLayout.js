// The deterministic plan of Palmwire City: blocks, districts, building footprints and
// geography queries (which street, which district, is this water). Pure data, no meshes.
import {
  BLOCK, GRID, CITY, ROAD_HALF, WALK, CANAL_COL, LANDMARKS, EW_STREETS, NS_STREETS,
  DISTRICTS, districtOfBlock, BEACH_Z0, SHORE_Z, EAST_SHORE_X, PIER_X, PIER_END_Z,
} from '../config.js';
import { Rng } from '../core/rng.js';

const PASTELS = [0xf4c9b8, 0xf7e1a8, 0xb9e3d6, 0xf2b5c8, 0xc8dcf0, 0xfbe7d2, 0xd9f0c0, 0xffd6a5, 0xe9c6f2];
const CONCRETE = [0xd8d2c4, 0xc9c3b5, 0xe6dfcf, 0xbfb6a6, 0xd0c8bc, 0xeadbc8];
const GLASS = [0x9fc4d8, 0x8fb8cf, 0xa9c9d6, 0xb4d2dc, 0x89aec8];
const WAREHOUSE = [0x9a8f84, 0xa7744c, 0x6f8a96, 0x8d9a7a, 0xb59d6a];

export class CityLayout {
  constructor(seed) {
    this.seed = seed;
    this.rng = new Rng(seed * 977 + 13);
    this.blocks = [];
    this.buildings = [];   // { x0,z0,x1,z1,y0,h, style, color, roof, bx, bz, landmark }
    this.landmarkOf = {};
    for (const [key, l] of Object.entries(LANDMARKS)) this.landmarkOf[l.bx + ',' + l.bz] = key;
    this.generate();
  }

  blockRect(bx, bz) {
    return { x0: bx * BLOCK + ROAD_HALF, z0: bz * BLOCK + ROAD_HALF, x1: (bx + 1) * BLOCK - ROAD_HALF, z1: (bz + 1) * BLOCK - ROAD_HALF };
  }
  lotRect(bx, bz) {
    const r = this.blockRect(bx, bz);
    return { x0: r.x0 + WALK, z0: r.z0 + WALK, x1: r.x1 - WALK, z1: r.z1 - WALK };
  }

  generate() {
    for (let bx = 0; bx < GRID; bx++) {
      for (let bz = 0; bz < GRID; bz++) {
        const district = districtOfBlock(bx, bz);
        const block = { bx, bz, district, landmark: this.landmarkOf[bx + ',' + bz] || null, plaza: false };
        this.blocks.push(block);
        const rng = this.rng.fork(bx * 101 + bz * 7 + 3);
        if (district === 'canal') continue;
        if (block.landmark) { this.planLandmark(block, rng); continue; }
        this[`plan_${district}`](block, rng);
      }
    }
  }

  addBuilding(b) { this.buildings.push(b); return b; }

  plan_downtown(block, rng) {
    const L = this.lotRect(block.bx, block.bz);
    if (rng.chance(0.18)) { block.plaza = true; this.addTower(block, rng, L.x0 + 10, L.z0 + 4, L.x1 - 10, L.z0 + 22, rng.range(30, 60)); return; }
    if (rng.chance(0.5)) {
      this.addTower(block, rng, L.x0 + 1, L.z0 + 1, L.x1 - 1, L.z1 - 1, rng.range(70, 150));
    } else {
      const mid = (L.x0 + L.x1) / 2;
      this.addTower(block, rng, L.x0 + 1, L.z0 + 1, mid - 1, L.z1 - 1, rng.range(45, 120));
      this.addTower(block, rng, mid + 1, L.z0 + 1, L.x1 - 1, L.z1 - 1, rng.range(35, 100));
    }
  }

  addTower(block, rng, x0, z0, x1, z1, h) {
    const glass = rng.chance(0.6);
    const style = glass ? 'glass' : 'concrete';
    const color = glass ? rng.pick(GLASS) : rng.pick(CONCRETE);
    const podium = rng.range(8, 13);
    this.addBuilding({ x0, z0, x1, z1, y0: 0, h: podium, style: 'concrete', color: rng.pick(CONCRETE), roof: 'flat', bx: block.bx, bz: block.bz });
    const inset = Math.min((x1 - x0), (z1 - z0)) * rng.range(0.12, 0.22);
    const t = this.addBuilding({ x0: x0 + inset, z0: z0 + inset, x1: x1 - inset, z1: z1 - inset, y0: podium, h: h - podium, style, color, roof: 'flat', bx: block.bx, bz: block.bz, tower: true });
    if (h > 70 && rng.chance(0.7)) {
      const i2 = (t.x1 - t.x0) * 0.2;
      this.addBuilding({ x0: t.x0 + i2, z0: t.z0 + i2, x1: t.x1 - i2, z1: t.z1 - i2, y0: h, h: rng.range(8, 20), style, color, roof: rng.chance(0.4) ? 'spire' : 'flat', bx: block.bx, bz: block.bz });
    }
  }

  plan_midtown(block, rng) {
    const L = this.lotRect(block.bx, block.bz);
    const nx = rng.chance(0.6) ? 2 : 1, nz = rng.chance(0.6) ? 2 : 1;
    const w = (L.x1 - L.x0) / nx, d = (L.z1 - L.z0) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (nx * nz > 2 && rng.chance(0.12)) continue; // parking gap
      const style = rng.chance(0.55) ? 'stucco' : 'concrete';
      this.addBuilding({
        x0: L.x0 + i * w + 1, z0: L.z0 + j * d + 1, x1: L.x0 + (i + 1) * w - 1, z1: L.z0 + (j + 1) * d - 1,
        y0: 0, h: rng.range(9, 30), style, color: style === 'stucco' ? rng.pick(PASTELS) : rng.pick(CONCRETE),
        roof: 'flat', awning: rng.chance(0.7), bx: block.bx, bz: block.bz,
      });
    }
  }

  plan_residential(block, rng) {
    const L = this.lotRect(block.bx, block.bz);
    if (rng.chance(0.3)) {
      this.addBuilding({ x0: L.x0 + 4, z0: L.z0 + 6, x1: L.x1 - 4, z1: L.z1 - 6, y0: 0, h: rng.range(12, 20), style: 'stucco', color: rng.pick(PASTELS), roof: 'flat', bx: block.bx, bz: block.bz });
      return;
    }
    const w = (L.x1 - L.x0) / 2, d = (L.z1 - L.z0) / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const cx = L.x0 + (i + 0.5) * w, cz = L.z0 + (j + 0.5) * d;
      const hw = rng.range(6, 8), hd = rng.range(5.5, 7.5);
      this.addBuilding({ x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd, y0: 0, h: rng.range(5, 7.5), style: 'house', color: rng.pick(PASTELS), roof: 'pitched', bx: block.bx, bz: block.bz });
    }
  }

  plan_beach(block, rng) {
    const L = this.lotRect(block.bx, block.bz);
    if (rng.chance(0.55)) {
      this.addBuilding({ x0: L.x0 + 3, z0: L.z0 + 4, x1: L.x1 - 3, z1: L.z1 - 8, y0: 0, h: rng.range(16, 42), style: 'hotel', color: rng.pick(PASTELS), roof: 'flat', awning: true, bx: block.bx, bz: block.bz });
    } else {
      const mid = (L.x0 + L.x1) / 2;
      this.addBuilding({ x0: L.x0 + 1, z0: L.z0 + 2, x1: mid - 2, z1: L.z1 - 6, y0: 0, h: rng.range(10, 26), style: 'hotel', color: rng.pick(PASTELS), roof: 'flat', awning: true, bx: block.bx, bz: block.bz });
      this.addBuilding({ x0: mid + 2, z0: L.z0 + 2, x1: L.x1 - 1, z1: L.z1 - 6, y0: 0, h: rng.range(8, 20), style: 'stucco', color: rng.pick(PASTELS), roof: 'flat', awning: true, bx: block.bx, bz: block.bz });
    }
  }

  plan_docks(block, rng) {
    const L = this.lotRect(block.bx, block.bz);
    block.containers = true;
    if (rng.chance(0.75)) {
      const z1 = L.z0 + rng.range(22, 30);
      this.addBuilding({ x0: L.x0 + 2, z0: L.z0 + 2, x1: L.x1 - 2, z1, y0: 0, h: rng.range(9, 14), style: 'warehouse', color: rng.pick(WAREHOUSE), roof: 'flat', bx: block.bx, bz: block.bz });
    }
  }

  plan_park(block) { block.park = true; }

  planLandmark(block, rng) {
    const key = block.landmark;
    const L = this.lotRect(block.bx, block.bz);
    const base = { bx: block.bx, bz: block.bz, landmark: key, y0: 0, roof: 'flat' };
    switch (key) {
      case 'vellTower':
        this.addBuilding({ ...base, x0: L.x0, z0: L.z0, x1: L.x1, z1: L.z1, h: 14, style: 'concrete', color: 0xe8e0cc });
        this.addBuilding({ ...base, x0: L.x0 + 7, z0: L.z0 + 7, x1: L.x1 - 7, z1: L.z1 - 7, y0: 14, h: 176, style: 'glass', color: 0xe6c27a, tower: true });
        this.addBuilding({ ...base, x0: L.x0 + 13, z0: L.z0 + 13, x1: L.x1 - 13, z1: L.z1 - 13, y0: 190, h: 22, style: 'glass', color: 0xe6c27a, roof: 'spire' });
        break;
      case 'garage':
        this.addBuilding({ ...base, x0: L.x0 + 2, z0: L.z0 + 2, x1: L.x1 - 2, z1: L.z0 + 26, h: 9, style: 'warehouse', color: 0x8c5a3c, awning: true });
        block.forecourt = true;
        break;
      case 'police':
        this.addBuilding({ ...base, x0: L.x0 + 2, z0: L.z0 + 2, x1: L.x1 - 2, z1: L.z1 - 10, h: 16, style: 'concrete', color: 0xd9dde4 });
        break;
      case 'hospital':
        this.addBuilding({ ...base, x0: L.x0 + 2, z0: L.z0 + 2, x1: L.x1 - 2, z1: L.z1 - 8, h: 22, style: 'concrete', color: 0xf2f2ee });
        break;
      case 'docksHQ':
        this.addBuilding({ ...base, x0: L.x0 + 2, z0: L.z0 + 2, x1: L.x1 - 14, z1: L.z0 + 22, h: 11, style: 'warehouse', color: 0x7a3e22 });
        block.containers = true;
        break;
      case 'safehouse':
        this.addBuilding({ ...base, x0: L.x0 + 4, z0: L.z0 + 4, x1: L.x1 - 4, z1: L.z1 - 8, h: 15, style: 'stucco', color: 0xf6c1cf, awning: true });
        break;
      default:
        this.addBuilding({ ...base, x0: L.x0 + 3, z0: L.z0 + 3, x1: L.x1 - 3, z1: L.z1 - 8, h: rng.range(9, 13), style: 'stucco', color: rng.pick(PASTELS), awning: true });
    }
  }

  // ---- geography queries -------------------------------------------------------------
  blockAt(x, z) {
    const bx = Math.floor(x / BLOCK), bz = Math.floor(z / BLOCK);
    if (bx < 0 || bz < 0 || bx >= GRID || bz >= GRID) return null;
    return this.blocks[bx * GRID + bz];
  }
  districtKeyAt(x, z) {
    if (z > CITY) return x > CANAL_COL * BLOCK ? 'docks' : 'beach';
    if (x > CITY) return 'docks';
    const b = this.blockAt(Math.max(0, x), Math.max(0, z));
    return b ? b.district : 'park';
  }
  districtNameAt(x, z) { return DISTRICTS[this.districtKeyAt(x, z)].name; }

  /** Nearest named street to a point (whichever grid line is closer). */
  streetAt(x, z) {
    const ix = Math.round(x / BLOCK), iz = Math.round(z / BLOCK);
    const dx = Math.abs(x - ix * BLOCK), dz = Math.abs(z - iz * BLOCK);
    if (z > CITY + 30) return x > PIER_X - 8 && x < PIER_X + 8 ? 'Sunset Pier' : 'Coral Beach';
    if (dz <= dx) return EW_STREETS[Math.max(0, Math.min(GRID, iz))];
    return NS_STREETS[Math.max(0, Math.min(GRID, ix))];
  }

  isOnRoad(x, z) {
    if (x < -ROAD_HALF || z < -ROAD_HALF || x > CITY + ROAD_HALF || z > CITY + ROAD_HALF) return false;
    const mx = ((x % BLOCK) + BLOCK) % BLOCK, mz = ((z % BLOCK) + BLOCK) % BLOCK;
    return mx < ROAD_HALF || mx > BLOCK - ROAD_HALF || mz < ROAD_HALF || mz > BLOCK - ROAD_HALF;
  }

  /** True where a person or car would be in the water. */
  isWater(x, z) {
    if (x > PIER_X - 6 && x < PIER_X + 6 && z > BEACH_Z0 && z < PIER_END_Z) return false;
    if (z > SHORE_Z) return true;
    if (x > EAST_SHORE_X && z > -40) return true;
    const bx = Math.floor(x / BLOCK);
    if (bx === CANAL_COL && z > -ROAD_HALF) {
      const mz = ((z % BLOCK) + BLOCK) % BLOCK;
      const onBridge = mz < ROAD_HALF + WALK || mz > BLOCK - ROAD_HALF - WALK;
      const lx = x - bx * BLOCK;
      const onBank = lx < ROAD_HALF + WALK || lx > BLOCK - ROAD_HALF - WALK;
      if (z > CITY + ROAD_HALF) return true; // canal mouth opens onto the sea
      return !onBridge && !onBank;
    }
    return false;
  }

  /** Clamp a position to the playable land area. */
  worldBounds() { return { x0: -150, z0: -150, x1: EAST_SHORE_X - 1, z1: SHORE_Z - 1 }; }

  /** Pedestrian sidewalk loop for a block: a rectangle in the middle of the sidewalk. */
  sidewalkLoop(bx, bz) {
    const r = this.blockRect(bx, bz);
    const o = WALK / 2;
    return { x0: r.x0 + o, z0: r.z0 + o, x1: r.x1 - o, z1: r.z1 - o };
  }
}
