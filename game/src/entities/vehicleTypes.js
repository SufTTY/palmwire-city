// The vehicles of Palmwire City (all original makes): body proportions, handling and paint.
// maxSpeed in m/s, accel in m/s^2, grip = lateral damping, steer = max wheel angle (rad).

export const VEHICLE_TYPES = {
  hatch: {
    name: 'Pelican Hatch', style: 'hatch', len: 3.9, wid: 1.78, hgt: 1.45, wheelR: 0.33,
    maxSpeed: 38, accel: 10, brake: 22, grip: 8.5, steer: 0.62, mass: 1000, health: 800,
    paints: [0xf25c54, 0x5bc0be, 0xf7d94c, 0xf2f2f2, 0x7bd389, 0xff9f68], traffic: 4,
  },
  sedan: {
    name: 'Seabright Sedan', style: 'sedan', len: 4.7, wid: 1.9, hgt: 1.45, wheelR: 0.36,
    maxSpeed: 44, accel: 10.5, brake: 24, grip: 8, steer: 0.55, mass: 1350, health: 950,
    paints: [0x2d3142, 0xbfc0c0, 0x4f6d7a, 0x8c1c13, 0xe8e8e8, 0x1b4965], traffic: 5,
  },
  muscle: {
    name: 'Thunderhead SS', style: 'muscle', len: 4.8, wid: 1.95, hgt: 1.3, wheelR: 0.38,
    maxSpeed: 54, accel: 15, brake: 24, grip: 6.8, steer: 0.55, mass: 1500, health: 1000,
    paints: [0xff8c1a, 0x111111, 0xc1121f, 0x1d6fd8, 0xf4d35e], traffic: 1,
  },
  pickup: {
    name: 'Mesquite Pickup', style: 'pickup', len: 5.2, wid: 2.05, hgt: 1.85, wheelR: 0.44,
    maxSpeed: 40, accel: 10, brake: 20, grip: 7.5, steer: 0.5, mass: 1900, health: 1300,
    paints: [0x8d6a4a, 0x2a4d69, 0xd9d9d9, 0x6b8f71, 0xb23a48], traffic: 2,
  },
  sports: {
    name: 'Vireo GT', style: 'sports', len: 4.4, wid: 1.98, hgt: 1.15, wheelR: 0.36,
    maxSpeed: 64, accel: 19, brake: 30, grip: 9.5, steer: 0.52, mass: 1300, health: 850,
    paints: [0xffd400, 0xe63946, 0x2ec4b6, 0xff4fa3, 0xf8f8f8], traffic: 1,
  },
  van: {
    name: 'Coastline Van', style: 'van', len: 5.0, wid: 2.05, hgt: 2.2, wheelR: 0.38,
    maxSpeed: 34, accel: 8, brake: 18, grip: 7, steer: 0.5, mass: 2100, health: 1400,
    paints: [0xf2f2f2, 0x9ad1d4, 0xffcf56, 0xf28482], traffic: 2,
  },
  taxi: {
    name: 'Palmwire Cab', style: 'sedan', len: 4.7, wid: 1.9, hgt: 1.45, wheelR: 0.36,
    maxSpeed: 42, accel: 10.5, brake: 24, grip: 8, steer: 0.55, mass: 1350, health: 950,
    paints: [0x2bb3a6], taxi: true, traffic: 2,
  },
  police: {
    name: 'PCPD Interceptor', style: 'sedan', len: 4.9, wid: 1.95, hgt: 1.5, wheelR: 0.37,
    maxSpeed: 52, accel: 14, brake: 28, grip: 8.6, steer: 0.55, mass: 1600, health: 1200,
    paints: [0xf4f4f4], police: true, traffic: 0,
  },
  bike: {
    name: 'Wasp 250', style: 'bike', len: 2.1, wid: 0.7, hgt: 1.1, wheelR: 0.33,
    maxSpeed: 50, accel: 16, brake: 26, grip: 9, steer: 0.6, mass: 220, health: 450,
    paints: [0xe63946, 0x111111, 0x1d6fd8, 0xffd400], bike: true, traffic: 0,
  },
};

export const TRAFFIC_TYPES = Object.entries(VEHICLE_TYPES).flatMap(([k, t]) => Array(t.traffic).fill(k));
export const PARKED_TYPES = ['hatch', 'sedan', 'sedan', 'muscle', 'pickup', 'sports', 'van', 'bike', 'hatch', 'bike'];
