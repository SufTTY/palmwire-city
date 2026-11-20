// Bullet tracers: a ring buffer of short-lived glowing line segments.
import * as THREE from 'three';

const N = 96;

export class Tracers {
  constructor(scene) {
    this.pos = new Float32Array(N * 6);
    this.col = new Float32Array(N * 6);
    this.base = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.geo = geo;
    scene.add(this.lines);
    this.c = new THREE.Color();
  }

  add(a, b, color = 0xffe0a0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % N;
    // start the visible streak a little in front of the muzzle
    const sx = a.x + (b.x - a.x) * 0.08, sy = a.y + (b.y - a.y) * 0.08, sz = a.z + (b.z - a.z) * 0.08;
    this.pos.set([sx, sy, sz, b.x, b.y, b.z], i * 6);
    this.c.setHex(color);
    this.base.set([this.c.r, this.c.g, this.c.b], i * 3);
    this.life[i] = 0.09;
  }

  update(dt) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] > 0) this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / 0.09);
      for (let v = 0; v < 2; v++) {
        const f = v === 0 ? k * 0.3 : k;
        this.col[i * 6 + v * 3] = this.base[i * 3] * f;
        this.col[i * 6 + v * 3 + 1] = this.base[i * 3 + 1] * f;
        this.col[i * 6 + v * 3 + 2] = this.base[i * 3 + 2] * f;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
