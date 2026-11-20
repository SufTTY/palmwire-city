// Tyre marks left on the asphalt while drifting or braking hard: a ring buffer of dark quads.
import * as THREE from 'three';

const MAX = 1600;

export class SkidMarks {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 4 * 3);
    const idx = new Uint16Array(MAX * 6);
    for (let i = 0; i < MAX; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.geo = geo;
    this.cursor = 0;
    this.last = new Map(); // key -> {x,z}
  }

  /** Continue a mark for one wheel (key) at (x,z); breaks the strip when not called. */
  mark(key, x, z, width = 0.28) {
    const prev = this.last.get(key);
    this.last.set(key, { x, z, t: performance.now() });
    if (!prev || performance.now() - prev.t > 120) return;
    const dx = x - prev.x, dz = z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05 || len > 4) return;
    const nx = -dz / len * width / 2, nz = dx / len * width / 2;
    const y = 0.035;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos.set([prev.x - nx, y, prev.z - nz, prev.x + nx, y, prev.z + nz, x + nx, y, z + nz, x - nx, y, z - nz], i * 12);
    this.geo.attributes.position.needsUpdate = true;
  }
}
