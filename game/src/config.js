// City dimensions, district definitions and the street names of Palmwire City.

export const BLOCK = 64;          // metres between road centre lines
export const GRID = 14;           // blocks per side
export const CITY = BLOCK * GRID; // 896 m
export const ROAD_HALF = 6;       // half road width (two lanes)
export const WALK = 3;            // sidewalk width
export const LANE = 3;            // lane centre offset from road centre
export const CANAL_COL = 10;      // block column that is the Saltwater Canal
export const SIDEWALK_Y = 0.15;
export const BEACH_Z0 = CITY + ROAD_HALF;  // sand starts here
export const SHORE_Z = CITY + 92;          // waterline on the south beach
export const EAST_SHORE_X = CITY + 14;     // quay edge of the docks
export const WATER_Y = -1.6;
export const PIER_X = 300;
export const PIER_END_Z = SHORE_Z + 150;

export const DISTRICTS = {
  park:        { name: 'Verde Heights',   ground: 0x5f9a3c, standing: 'Verde Locals' },
  residential: { name: 'Palm Court',      ground: 0x77a64a, standing: 'Palm Court Block' },
  downtown:    { name: 'Glasswater',      ground: 0xb9b4aa, standing: 'Glasswater Money' },
  midtown:     { name: 'Calle Mango',     ground: 0xc9b79a, standing: 'Mango Merchants' },
  beach:       { name: 'Coral Strip',     ground: 0xd9c49a, standing: 'Coral Strip Crowd' },
  canal:       { name: 'Saltwater Canal', ground: 0xa9a59a, standing: 'Canal Boatmen' },
  docks:       { name: 'Rustline Docks',  ground: 0x8d877c, standing: 'Harbor Kings' },
};

export function districtOfBlock(bx, bz) {
  if (bx === CANAL_COL) return 'canal';
  if (bx > CANAL_COL) return 'docks';
  if (bz >= 12) return 'beach';
  if (bx <= 2 && bz <= 2) return 'park';
  if (bx <= 3) return 'residential';
  if (bx >= 4 && bx <= 8 && bz >= 2 && bz <= 7) return 'downtown';
  return 'midtown';
}

// Street names: index i is the road on grid line i.
export const EW_STREETS = [
  'Crestline Dr', 'Verde Rd', 'Juniper St', 'Halcyon Ave', 'Tradewind St', 'Marquee Blvd', 'Citrine St',
  'Sabal Ave', 'Flamingo Way', 'Lantana St', 'Breaker St', 'Seagrape Ave', 'Driftwood Rd', 'Coralline Ave', 'Sunline Blvd',
];
export const NS_STREETS = [
  'Agave St', 'Ibis Ave', 'Coquina St', 'Palisade Ave', 'Solano St', 'Broadwire Ave', 'Monarch St',
  'Kestrel Ave', 'Hibiscus St', 'Tidewater Ave', 'Canal West', 'Canal East', 'Rustline Rd', 'Gantry St', 'Harbor Edge',
];

// Named places used by the story and side jobs. door = marker spot on the sidewalk in front.
export const LANDMARKS = {
  vee:       { bx: 2, bz: 6,  name: 'Suds & Sons Laundromat', sign: 'SUDS & SONS', color: '#3fb8c9' },
  garage:    { bx: 8, bz: 9,  name: 'Okonkwo Auto Works',     sign: 'OKONKWO AUTO', color: '#f0a020' },
  safehouse: { bx: 1, bz: 10, name: 'Palm Court Apartments',  sign: 'PALM COURT', color: '#e86f9a' },
  vellTower: { bx: 6, bz: 4,  name: 'Vell Coastal Tower',     sign: 'VELL COASTAL', color: '#d4b05a' },
  police:    { bx: 5, bz: 10, name: 'PCPD Precinct 3',        sign: 'PCPD', color: '#3b6fd6' },
  hospital:  { bx: 3, bz: 8,  name: 'St. Marisol Medical',    sign: 'ST. MARISOL', color: '#e24b4b' },
  docksHQ:   { bx: 12, bz: 6, name: 'Harbor Kings Yard',      sign: 'BERTH 9', color: '#c0602a' },
  pixel:     { bx: 7, bz: 11, name: 'Static Arcade',          sign: 'STATIC ARCADE', color: '#b45cf0' },
};

export function landmarkDoor(key) {
  const l = LANDMARKS[key];
  return { x: l.bx * BLOCK + BLOCK / 2, z: (l.bz + 1) * BLOCK - ROAD_HALF - WALK / 2 };
}

export const BRANDS = [
  { name: 'SALTLINE', tag: 'cola that tastes like summer', bg: '#e8443a', fg: '#fff6e0' },
  { name: 'PELICAN AIR', tag: 'fly the coast', bg: '#1d6fb8', fg: '#ffe9a8' },
  { name: 'GLOWTAN', tag: 'SPF 90 · stay golden', bg: '#ff9a3c', fg: '#3a1d0e' },
  { name: 'MANGO MOBILE', tag: 'signal like sunshine', bg: '#ffd23f', fg: '#2a2a2a' },
  { name: 'VELL COASTAL', tag: 'own the view', bg: '#1e2a38', fg: '#d4b05a' },
  { name: 'SUNNYBURGER', tag: 'double stack · triple sun', bg: '#f6c445', fg: '#b2261c' },
  { name: 'TIDE & KICKS', tag: 'sneakers for sand', bg: '#2bb5a3', fg: '#ffffff' },
  { name: 'WAVE 88', tag: 'the sound of palmwire', bg: '#ff4fa3', fg: '#1b0b2e' },
];
