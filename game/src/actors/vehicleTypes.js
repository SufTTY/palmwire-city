// The original vehicles of Palmwire City: dimensions, handling and paint palettes.
// Speeds in m/s, accel in m/s^2, grip is the lateral damping rate.

export const VEHICLE_TYPES = {
  pipit: {
    name: 'Pipit Hatch', shape: 'hatch', len: 3.9, wid: 1.78, hgt: 1.45, wheelR: 0.33,
    maxSpeed: 39, accel: 10, brake: 22, grip: 7.6, steer: 0.62, mass: 1100, hp: 100,
    paints: [0xe63946, 0x48cae4, 0xffb703, 0x90be6d, 0xf1faee, 0xff8fab], weight: 4,
  },
  meridian: {
    name: 'Meridian Sedan', shape: 'sedan', len: 4.7, wid: 1.86, hgt: 1.45, wheelR: 0.35,
    maxSpeed: 45, accel: 10.5, brake: 22, grip: 7.4, steer: 0.56, mass: 1450, hp: 110,
    paints: [0x1d3557, 0xadb5bd, 0x343a40, 0x6a040f, 0xf8f9fa, 0x2a9d8f], weight: 5,
  },
  hammerhead: {
    name: 'Hammerhead GT', shape: 'coupe', len: 4.8, wid: 1.95, hgt: 1.32, wheelR: 0.37,
    maxSpeed: 54, accel: 14, brake: 21, grip: 6.4, steer: 0.55, mass: 1600, hp: 115,
    paints: [0xff6d00, 0x0a9396, 0x9d0208, 0x111111, 0xffd60a], weight: 2,
  },
  mesquite: {
    name: 'Mesquite Pickup', shape: 'pickup', len: 5.3, wid: 2.0, hgt: 1.9, wheelR: 0.43,
    maxSpeed: 41, accel: 9.5, brake: 19, grip: 7.0, steer: 0.52, mass: 2100, hp: 140,
    paints: [0x8d0801, 0x386641, 0xdda15e, 0x5c677d, 0xf2e8cf], weight: 3,
  },
  stingline: {
    name: 'Stingline RS', shape: 'sports', len: 4.45, wid: 1.98, hgt: 1.16, wheelR: 0.36,
    maxSpeed: 66, accel: 17, brake: 26, grip: 9.2, steer: 0.55, mass: 1350, hp: 95,
    paints: [0xff006e, 0xfb5607, 0x3a86ff, 0xffbe0b, 0x06d6a0, 0xf8f8f8], weight: 1,
  },
  dockrunner: {
    name: 'Dockrunner Van', shape: 'van', len: 5.1, wid: 2.05, hgt: 2.35, wheelR: 0.38,
    maxSpeed: 34, accel: 7.5, brake: 17, grip: 6.8, steer: 0.5, mass: 2500, hp: 150,
    paints: [0xf8f9fa, 0x219ebc, 0xe9c46a, 0x6c757d], weight: 2,
  },
  wasp: {
    name: 'Wasp 250', shape: 'bike', len: 2.1, wid: 0.75, hgt: 1.1, wheelR: 0.34,
    maxSpeed: 52, accel: 15, brake: 24, grip: 8.5, steer: 0.6, mass: 220, hp: 60, bike: true,
    paints: [0xffd60a, 0xe63946, 0x3a86ff, 0x111111], weight: 1,
  },
  cab: {
    name: 'Sunshade Cab', shape: 'sedan', len: 4.7, wid: 1.86, hgt: 1.45, wheelR: 0.35,
    maxSpeed: 43, accel: 10, brake: 22, grip: 7.4, steer: 0.56, mass: 1450, hp: 110, taxi: true,
    paints: [0xffc300], weight: 2,
  },
  interceptor: {
    name: 'PCPD Interceptor', shape: 'sedan', len: 4.9, wid: 1.92, hgt: 1.48, wheelR: 0.36,
    maxSpeed: 58, accel: 15, brake: 25, grip: 8.6, steer: 0.58, mass: 1700, hp: 160, police: true,
    paints: [0x14213d], weight: 0,
  },
};

export const CIVILIAN_TYPES = Object.entries(VEHICLE_TYPES).filter(([, t]) => t.weight > 0);

export function pickCivilianType(rng) {
  const total = CIVILIAN_TYPES.reduce((s, [, t]) => s + t.weight, 0);
  let r = rng.float() * total;
  for (const [key, t] of CIVILIAN_TYPES) { r -= t.weight; if (r <= 0) return key; }
  return 'meridian';
}
