// The hills that wrap Palmwire City to the north and west, with scrub trees and the big
// PALMWIRE letters on the slope above Verde Heights.
import * as THREE from 'three';
import { hillSignTexture } from './textures.js';
import { hash2 } from '../core/rng.js';
import { BEACH_Z0, EAST_SHORE_X } from '../config.js';

function valueNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * s(xf) + (c - a) * s(zf) + (a - b - c + d) * s(xf) * s(zf);
}

export function hillHeight(x, z) {
  const d = Math.max(-140 - x, -140 - z);
  if (d <= 0) return -8;
  if (z > BEACH_Z0 + 40 || x > EAST_SHORE_X + 80) return -8;
  let n = 0, amp = 1, f = 1 / 260;
  for (let o = 0; o < 4; o++) { n += valueNoise(x * f, z * f, 11 + o) * amp; amp *= 0.5; f *= 2.1; }
  const rise = Math.min(1, d / 320);
  return rise * rise * (3 - 2 * rise) * (60 + n * 190);
}

export class Backdrop {
  constructor(game) {
    this.game = game;
    const size = 3600, seg = 140;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(450, 0, 450);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const low = new THREE.Color(0x6f9a45), mid = new THREE.Color(0xa59b62), high = new THREE.Color(0x8c7f5c);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = hillHeight(x, z);
      pos.setY(i, h);
      const t = Math.max(0, Math.min(1, h / 180));
      c.copy(low).lerp(mid, Math.min(1, t * 1.6)).lerp(high, Math.max(0, t - 0.6));
      const jitter = 0.92 + hash2(i, 7, 3) * 0.12;
      colors[i * 3] = c.r * jitter; colors[i * 3 + 1] = c.g * jitter; colors[i * 3 + 2] = c.b * jitter;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = false;
    game.scene.add(mesh);

    this.addScrub();
    this.addSign();
  }

  addScrub() {
    const count = 700;
    const geo = new THREE.ConeGeometry(4, 12, 6);
    geo.translate(0, 6, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3f6b32 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < count * 4 && n < count; i++) {
      const x = -1200 + hash2(i, 1, 5) * 2400, z = -1200 + hash2(i, 2, 5) * 2200;
      const h = hillHeight(x, z);
      if (h < 12) continue;
      const k = 0.6 + hash2(i, 3, 5) * 1.0;
      m.compose(p.set(x, h - 1, z), q, s.set(k, k * (0.8 + hash2(i, 4, 5) * 0.6), k));
      inst.setMatrixAt(n++, m);
    }
    inst.count = n;
    this.game.scene.add(inst);
  }

  addSign() {
    const x = 330, z = -420;
    const h = hillHeight(x, z);
    const mat = new THREE.MeshBasicMaterial({ map: hillSignTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, fog: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(220, 34), mat);
    sign.position.set(x, h + 16, z);
    sign.rotation.x = -0.25;
    this.game.scene.add(sign);
  }
}
