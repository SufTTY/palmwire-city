// Seeded random numbers: every random choice in Palmwire City goes through one of these,
// so a given seed always builds the same city and the screenshot scenes are repeatable.

/** mulberry32: small, fast, good enough for procedural content. */
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const rng = function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  rng.chance = (p) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  rng.fork = () => makeRng(Math.floor(rng() * 4294967296));
  return rng;
}

/** Stable hash of two integers and a seed, in [0, 1). */
export function hash2(i, j, seed = 0) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
