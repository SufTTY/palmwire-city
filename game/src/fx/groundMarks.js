// Marks left on the ground: tyre skid strips from drifting and braking (a ring buffer of quads
// in one mesh), blood pools under the fallen and scorch marks under explosions.
import * as THREE from 'three';

const MAX_QUADS = 1600;

export class GroundMarks {
  constructor(scene) {
    this.pos = new Float32Array(MAX_QUADS * 4 * 3);
    const idx = new Uint16Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    }
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.next = 0;
    this.count = 0;

    this.pools = [];
    const poolGeo = new THREE.CircleGeometry(1, 14);
    poolGeo.rotateX(-Math.PI / 2);
    for (let k = 0; k < 28; k++) {
      const m = new THREE.Mesh(poolGeo, new THREE.MeshStandardMaterial({ color: 0x4a0508, roughness: 0.2, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
      m.visible = false;
      scene.add(m);
      this.pools.push({ mesh: m, t: 0, max: 1 });
    }
    this.poolNext = 0;
  }

  /** One skid quad from point a to b (both at road height y), w metres wide. */
  skid(ax, az, bx, bz, y, w = 0.28) {
    const dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz);
    if (l < 0.05 || l > 3) return;
    const px = (-dz / l) * w * 0.5, pz = (dx / l) * w * 0.5;
    const q = this.next;
    const o = q * 12;
    const yy = y + 0.02;
    this.pos.set([ax + px, yy, az + pz, bx + px, yy, bz + pz, bx - px, yy, bz - pz, ax - px, yy, az - pz], o);
    this.next = (this.next + 1) % MAX_QUADS;
    this.count = Math.min(MAX_QUADS, this.count + 1);
    this.attr.needsUpdate = true;
  }

  bloodPool(x, y, z, size = 1) {
    const p = this.pools[this.poolNext];
    this.poolNext = (this.poolNext + 1) % this.pools.length;
    p.mesh.material.color.setHex(0x4a0508);
    p.mesh.position.set(x, y + 0.03, z);
    p.mesh.scale.setScalar(0.1);
    p.mesh.visible = true;
    p.t = 0;
    p.max = size * (0.9 + Math.random() * 0.4);
  }

  scorch(x, y, z) {
    const p = this.pools[this.poolNext];
    this.poolNext = (this.poolNext + 1) % this.pools.length;
    p.mesh.material.color.setHex(0x0d0c0c);
    p.mesh.position.set(x, y + 0.03, z);
    p.mesh.visible = true;
    p.t = 10;
    p.max = 4;
    p.mesh.scale.setScalar(4);
  }

  update(dt) {
    for (const p of this.pools) {
      if (!p.mesh.visible || p.t >= 3) continue;
      p.t += dt;
      p.mesh.scale.setScalar(Math.min(p.max, 0.1 + p.t * 0.6));
    }
  }
}
