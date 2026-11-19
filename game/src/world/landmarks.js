// Named places of Palmwire City: the safehouse, the mission givers' businesses, the precinct and
// the hospital. Each sits on a fixed block with its own painted sign and a door marker on the
// south sidewalk.
import * as THREE from 'three';
import { CELL } from './cityLayout.js';

export const LANDMARKS = {
  safehouse: { name: 'Seagrass Apartments', block: [6, 1], sign: 'SEAGRASS APTS', bg: '#1d6f73', fg: '#fff6e0', facade: 'hotel', tint: 0xf6d7b0, h: 22 },
  laundromat: { name: 'Suds & Sons Laundromat', block: [10, 6], sign: 'SUDS & SONS', bg: '#f25c8a', fg: '#ffffff', facade: 'stucco', tint: 0xbfe7d6, h: 11 },
  garage: { name: 'Rust & Chrome Garage', block: [3, 12], sign: 'RUST & CHROME', bg: '#2b2b30', fg: '#ffb43a', facade: 'warehouse', tint: 0xc6b49a, h: 10 },
  police: { name: 'PCPD Mirador Precinct', block: [10, 3], sign: 'PCPD  PRECINCT 4', bg: '#173a7a', fg: '#ffffff', facade: 'stucco', tint: 0xdfe6ee, h: 16 },
  hospital: { name: 'Palmwire General', block: [3, 6], sign: 'PALMWIRE GENERAL', bg: '#ffffff', fg: '#d9293b', facade: 'stucco', tint: 0xf4f4f0, h: 26 },
};

/** Door, parking and footprint for each landmark, in world coordinates. */
export function resolveLandmarks(layout) {
  const out = {};
  for (const [key, L] of Object.entries(LANDMARKS)) {
    const b = layout.blockAt(L.block[0], L.block[1]);
    const lotZ1 = b.z1 - 4;
    out[key] = {
      key, ...L, blockRef: b,
      footprint: { x0: b.x0 + 8, x1: b.x1 - 8, z0: b.z0 + 8, z1: b.z0 + 36 },
      door: new THREE.Vector3(b.cx, 0.15, b.z0 + 38.5),
      parking: new THREE.Vector3(b.cx + 12, 0.15, lotZ1 - 8),
      street: new THREE.Vector3(b.cx, 0, (L.block[1] + 1) * CELL - 3),
      // westbound lane of the road south of the block (right-hand traffic)
      streetHeading: -Math.PI / 2,
    };
  }
  return out;
}

export function makeSignMaterial(L) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = L.bg;
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = L.fg;
  g.lineWidth = 4;
  g.strokeRect(6, 6, 500, 84);
  g.fillStyle = L.fg;
  g.font = '900 54px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(L.sign, 256, 50, 480);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
}
