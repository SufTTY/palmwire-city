// Ties the visual effects together: bullet tracers, the muzzle-flash light, explosions
// (fireball, light pulse, scorch, screen shake), tyre skid marks and smoke from drifting
// cars, and the camera-shake budget the camera rig reads.
import * as THREE from 'three';
import { Particles } from './particles.js';
import { GroundMarks } from './groundMarks.js';

const MAX_TRACERS = 48;

export class EffectsSystem {
  constructor(G) {
    this.G = G;
    const scene = G.scene;
    this.particles = new Particles(scene);
    this.marks = new GroundMarks(scene);
    this.shakeAmount = 0;

    this.tracerPos = new Float32Array(MAX_TRACERS * 6);
    this.tracerLife = new Float32Array(MAX_TRACERS);
    this.tracerCol = new Float32Array(MAX_TRACERS * 6);
    const g = new THREE.BufferGeometry();
    this.tracerAttr = new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.tracerColAttr = new THREE.BufferAttribute(this.tracerCol, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.tracerAttr);
    g.setAttribute('color', this.tracerColAttr);
    this.tracers = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    this.tracerNext = 0;

    this.flashLight = new THREE.PointLight(0xffc070, 0, 14, 2);
    scene.add(this.flashLight);
    this.boomLight = new THREE.PointLight(0xff8a3a, 0, 45, 1.6);
    scene.add(this.boomLight);
  }

  shake(a) { this.shakeAmount = Math.min(1.5, this.shakeAmount + a); }

  tracer(from, to, color = 0xfff0b0) {
    const k = this.tracerNext;
    this.tracerNext = (k + 1) % MAX_TRACERS;
    // draw only the far 85% of the path so it reads as a streak leaving the muzzle
    const sx = from.x + (to.x - from.x) * 0.06, sy = from.y + (to.y - from.y) * 0.06, sz = from.z + (to.z - from.z) * 0.06;
    this.tracerPos.set([sx, sy, sz, to.x, to.y, to.z], k * 6);
    const c = new THREE.Color(color);
    this.tracerCol.set([c.r, c.g, c.b, c.r * 0.4, c.g * 0.4, c.b * 0.4], k * 6);
    this.tracerLife[k] = 0.07;
  }

  flash(pos) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 30;
  }

  explosion(pos) {
    this.particles.explosion(pos.x, pos.y, pos.z);
    this.boomLight.position.copy(pos).y += 2;
    this.boomLight.intensity = 400;
    this.marks.scorch(pos.x, this.G.layout.groundHeight(pos.x, pos.z), pos.z);
    const d = this.G.camera.position.distanceTo(pos);
    this.shake(Math.max(0, 1.2 - d / 60));
  }

  /** Skid marks, tyre smoke and dust for every moving physics vehicle. */
  vehicleEffects(dt) {
    for (const v of this.G.vehicles.list) {
      if (v.mode !== 'physics' || v.inWater) continue;
      const skidding = v.skid > 0 && v.absSpeed > 2;
      const fx = v.fx, fz = v.fz, rx = -fz, rz = fx;
      const back = -v.T.len * 0.34, side = v.T.bike ? 0 : v.T.wid / 2 - 0.15;
      const wheels = v.T.bike ? [[0, back]] : [[side, back], [-side, back]];
      wheels.forEach(([sx, sz], k) => {
        const x = v.pos.x + rx * sx + fx * sz, z = v.pos.z + rz * sx + fz * sz;
        const prev = v.wheelPrev[k];
        if (skidding && prev.lengthSq() > 0) {
          this.marks.skid(prev.x, prev.z, x, z, v.pos.y, v.T.bike ? 0.18 : 0.3);
          if (Math.random() < dt * 30 * v.skid) this.particles.tireSmoke(x, v.pos.y, z);
        }
        if (skidding) prev.set(x, 0, z);
        else prev.set(0, 0, 0);
      });
    }
  }

  update(dt) {
    this.particles.update(dt);
    this.marks.update(dt);
    this.vehicleEffects(dt);
    let any = false;
    for (let k = 0; k < MAX_TRACERS; k++) {
      if (this.tracerLife[k] <= 0) continue;
      this.tracerLife[k] -= dt;
      if (this.tracerLife[k] <= 0) this.tracerPos.fill(0, k * 6, k * 6 + 6);
      any = true;
    }
    if (any) {
      this.tracerAttr.needsUpdate = true;
      this.tracerColAttr.needsUpdate = true;
    }
    this.flashLight.intensity *= Math.exp(-30 * dt);
    this.boomLight.intensity *= Math.exp(-5 * dt);
    this.shakeAmount *= Math.exp(-4 * dt);
  }
}
