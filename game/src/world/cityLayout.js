// The plan of Palmwire City as pure data: a 14x14 grid of blocks split into districts, the road
// network between them (with a bridge over Pelican Bay), the coastline, and queries that tell any
// system what surface lies under a point and how high the ground is there.

export const N = 14;            // blocks per side
export const CELL = 80;         // metres between road centre lines
export const ROAD_W = 12;
export const HALF_ROAD = 6;
export const SIDEWALK = 4;
export const LANE_OFF = 3;      // lane centre offset from the road centre line
export const CURB_Y = 0.15;     // sidewalk / lot height
export const WATER_Y = -1.1;
export const CITY = N * CELL;   // 1120 m
export const BEACH_END = CITY + 56;  // x where the ocean starts (east coast)
export const QUAY_END = CITY + 22;   // z where the ocean starts (south quay)
export const POINT_END = CITY + 70;  // south tip of the lighthouse point
export const BRIDGE_ROW = 12;   // the road row that crosses the bay as a bridge

export const DISTRICT_NAMES = {
  downtown: 'Halcyon Downtown',
  midtown: 'Mirador',
  residential: 'Seagrass Heights',
  beach: 'Coral Strand',
  industrial: 'Saltworks Docks',
  park: 'Crestline Park',
  water: 'Pelican Bay',
  ocean: 'Open Water',
  shore: 'Coral Strand',
  outland: 'Palmwire Outskirts',
};

const PARK_CX = 1.5 * CELL;
const PARK_CZ = 1.5 * CELL;
const HILL_R = 96;
const HILL_H = 16;

/** Which district a block belongs to (blocks outside the grid are outland, shore or ocean). */
export function districtOf(i, j) {
  if (i < 0 || j < 0) return 'outland';
  if (i >= N) return 'shore';
  if (j >= N) return i >= 9 && i <= 12 ? 'ocean' : 'shore';
  if (i <= 2 && j <= 2) return 'park';
  if (i >= 9 && i <= 12 && j >= 10) return 'water';
  if (i === 13) return 'beach';
  if (j >= 11 && i <= 8) return 'industrial';
  if (i >= 5 && i <= 8 && j >= 4 && j <= 7) return 'downtown';
  if (j <= 2 || i <= 2) return 'residential';
  return 'midtown';
}

const isWet = (d) => d === 'water' || d === 'ocean';

export function parkHillHeight(x, z) {
  const r = Math.hypot(x - PARK_CX, z - PARK_CZ);
  if (r >= HILL_R) return 0;
  return HILL_H * 0.5 * (1 + Math.cos((Math.PI * r) / HILL_R));
}

export function createCityLayout() {
  // Road segments: hEdges[j][i] joins node (i,j)-(i+1,j); vEdges[i][j] joins (i,j)-(i,j+1).
  // 0 = none, 1 = road, 2 = bridge.
  const hEdges = [];
  for (let j = 0; j <= N; j++) {
    hEdges.push([]);
    for (let i = 0; i < N; i++) {
      const a = districtOf(i, j - 1);
      const b = districtOf(i, j);
      let e = 1;
      if (a === 'park' && b === 'park') e = 0;
      else if (isWet(a) && isWet(b)) e = j === BRIDGE_ROW ? 2 : 0;
      hEdges[j].push(e);
    }
  }
  const vEdges = [];
  for (let i = 0; i <= N; i++) {
    vEdges.push([]);
    for (let j = 0; j < N; j++) {
      const a = districtOf(i - 1, j);
      const b = districtOf(i, j);
      let e = 1;
      if (a === 'park' && b === 'park') e = 0;
      else if (isWet(a) && isWet(b)) e = 0;
      vEdges[i].push(e);
    }
  }
  const hEdge = (i, j) => (j >= 0 && j <= N && i >= 0 && i < N ? hEdges[j][i] : 0);
  const vEdge = (i, j) => (i >= 0 && i <= N && j >= 0 && j < N ? vEdges[i][j] : 0);

  // Intersections and their links (the graph traffic, police and GPS use).
  const nodeId = (i, j) => j * (N + 1) + i;
  const nodes = new Array((N + 1) * (N + 1)).fill(null);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const links = [];
      const add = (ti, tj, e, dx, dz) => {
        if (e) links.push({ to: nodeId(ti, tj), dx, dz, bridge: e === 2 });
      };
      add(i + 1, j, hEdge(i, j), 1, 0);
      add(i - 1, j, hEdge(i - 1, j), -1, 0);
      add(i, j + 1, vEdge(i, j), 0, 1);
      add(i, j - 1, vEdge(i, j - 1), 0, -1);
      if (!links.length) continue;
      nodes[nodeId(i, j)] = {
        id: nodeId(i, j), i, j, x: i * CELL, z: j * CELL, links,
        bridge: links.every((l) => l.bridge),
      };
    }
  }
  const nodeList = nodes.filter(Boolean);

  // Segment list (each once) for building road meshes.
  const segments = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) {
    if (hEdges[j][i]) segments.push({ axis: 'h', i, j, bridge: hEdges[j][i] === 2, x0: i * CELL, z0: j * CELL, x1: (i + 1) * CELL, z1: j * CELL });
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    if (vEdges[i][j]) segments.push({ axis: 'v', i, j, bridge: false, x0: i * CELL, z0: j * CELL, x1: i * CELL, z1: (j + 1) * CELL });
  }

  // Blocks (the land between roads).
  const blocks = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const type = districtOf(i, j);
    blocks.push({
      i, j, type,
      x0: i * CELL + HALF_ROAD, z0: j * CELL + HALF_ROAD,
      x1: (i + 1) * CELL - HALF_ROAD, z1: (j + 1) * CELL - HALF_ROAD,
      cx: (i + 0.5) * CELL, cz: (j + 0.5) * CELL,
    });
  }
  const blockAt = (i, j) => (i >= 0 && j >= 0 && i < N && j < N ? blocks[j * N + i] : null);

  const ROAD = { type: 'road', h: 0, bridge: false };
  const BRIDGE = { type: 'road', h: 0, bridge: true };
  const WATER = { type: 'water', h: WATER_Y };
  const SAND = { type: 'sand', h: 0.05 };
  const QUAY = { type: 'quay', h: CURB_Y };
  const GRASS = { type: 'grass', h: 0.05 };
  const WALK = { type: 'walk', h: CURB_Y };
  const LOT = { type: 'lot', h: CURB_Y };

  /** What is underfoot at (x, z): road, walk, lot, park, sand, quay, grass or water, and its height. */
  function surfaceAt(x, z) {
    const gi = Math.round(x / CELL);
    const gj = Math.round(z / CELL);
    const dx = Math.abs(x - gi * CELL);
    const dz = Math.abs(z - gj * CELL);
    if (dx <= HALF_ROAD && dz <= HALF_ROAD) {
      const n = gi >= 0 && gj >= 0 && gi <= N && gj <= N ? nodes[nodeId(gi, gj)] : null;
      if (n) return n.bridge ? BRIDGE : ROAD;
    }
    if (dx <= HALF_ROAD) {
      const e = vEdge(gi, Math.floor(z / CELL));
      if (e) return ROAD;
    }
    if (dz <= HALF_ROAD) {
      const e = hEdge(Math.floor(x / CELL), gj);
      if (e) return e === 2 ? BRIDGE : ROAD;
    }
    const bi = Math.floor(x / CELL);
    const bj = Math.floor(z / CELL);
    const d = districtOf(bi, bj);
    if (d === 'outland') return GRASS;
    if (d === 'shore' || d === 'ocean') {
      if (x > BEACH_END) return WATER;
      if (x >= 13 * CELL - HALF_ROAD) return z > POINT_END ? WATER : SAND;
      if (d === 'ocean') return WATER;
      if (x > CITY) return SAND;
      return z > QUAY_END ? WATER : QUAY;
    }
    if (d === 'water') return WATER;
    if (d === 'park') {
      const lo = HALF_ROAD + SIDEWALK;
      const hi = 3 * CELL - HALF_ROAD - SIDEWALK;
      if (x < lo || z < lo || x > hi || z > hi) return WALK;
      return { type: 'park', h: CURB_Y + parkHillHeight(x, z) };
    }
    const lx = x - bi * CELL;
    const lz = z - bj * CELL;
    const e = HALF_ROAD + SIDEWALK;
    if (lx < e || lz < e || lx > CELL - e || lz > CELL - e) return WALK;
    return LOT;
  }

  const groundHeight = (x, z) => surfaceAt(x, z).h;
  const isWaterAt = (x, z) => surfaceAt(x, z).type === 'water';

  function districtAt(x, z) {
    const d = districtOf(Math.floor(x / CELL), Math.floor(z / CELL));
    return d;
  }

  return {
    N, CELL, hEdges, vEdges, hEdge, vEdge, nodes, nodeList, nodeId, segments, blocks, blockAt,
    surfaceAt, groundHeight, isWaterAt, districtAt, parkHillHeight,
    park: { cx: PARK_CX, cz: PARK_CZ, r: HILL_R, h: HILL_H },
  };
}
