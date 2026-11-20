// GPU point-sprite particles in two pools (additive for fire and sparks, alpha-blended for
// smoke, dust and blood) with simple CPU physics: velocity, gravity, drag, growth, fade.
import * as THREE from 'three';

const vertexShader = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(400.0, aSize * uScale / max(0.5, -mv.z));
    vAlpha = aAlpha * (1.0 - smoothstep(250.0, 400.0, -mv.z));
    vColor = aColor;
  }
`;
const fragmentShader = /* glsl */`
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = vAlpha * (1.0 - smoothstep(0.15, 0.5, d));
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

class ParticlePool {
  constructor(scene, size, additive) {
    this.size = size;
    this.pos = new Float32Array(size * 3);
    this.col = new Float32Array(size * 3);
    this.sz = new Float32Array(size);
    this.alpha = new Float32Array(size);
    this.vel = new Float32Array(size * 3);
    this.life = new Float32Array(size);
    this.maxLife = new Float32Array(size);
    this.grow = new Float32Array(size);
    this.grav = new Float32Array(size);
    this.drag = new Float32Array(size);
    this.a0 = new Float32Array(size);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
    this.geo = geo;
  }

  emit(x, y, z, vx, vy, vz, color, size, life, { grow = 0, grav = 0, drag = 0, alpha = 1 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.size;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = typeof color === 'number' ? new THREE.Color(color) : color;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.sz[i] = size; this.life[i] = life; this.maxLife[i] = life;
    this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = alpha;
    this.alpha[i] = alpha;
  }

  update(dt, scale) {
    this.uniforms.uScale.value = scale;
    for (let i = 0; i < this.size; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.02, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.sz[i] += this.grow[i] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.5);
    }
    for (const n of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[n].needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.glow = new ParticlePool(scene, 1600, true);
    this.soft = new ParticlePool(scene, 2400, false);
    this.tmp = new THREE.Color();
  }
  r(a) { return (Math.random() - 0.5) * 2 * a; }

  smoke(x, y, z, size = 1, color = 0x777777) {
    this.soft.emit(x + this.r(0.3), y, z + this.r(0.3), this.r(0.6), 1.2 + Math.random(), this.r(0.6), color, size, 2.2 + Math.random(), { grow: 1.6, drag: 0.6, alpha: 0.45, grav: -0.3 });
  }
  tyreSmoke(x, z) {
    this.soft.emit(x + this.r(0.2), 0.3, z + this.r(0.2), this.r(1), 0.6, this.r(1), 0xdedad4, 0.8, 1.4, { grow: 2.2, drag: 1.2, alpha: 0.32 });
  }
  dust(x, y, z, color = 0xd8d0c0) {
    for (let i = 0; i < 5; i++) this.soft.emit(x, y, z, this.r(1.5), Math.random() * 2, this.r(1.5), color, 0.25, 0.5, { grow: 0.8, grav: 3, drag: 2, alpha: 0.7 });
    this.glow.emit(x, y, z, 0, 0, 0, 0xffe0a0, 0.25, 0.06);
  }
  blood(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) this.soft.emit(x, y, z, this.r(2), Math.random() * 2.5, this.r(2), 0x8a0a0a, 0.18 + Math.random() * 0.15, 0.6, { grav: 9, drag: 1, alpha: 0.95 });
  }
  sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) this.glow.emit(x, y, z, this.r(5), Math.random() * 4, this.r(5), 0xffc060, 0.12, 0.35 + Math.random() * 0.3, { grav: 12, drag: 1 });
  }
  fire(x, y, z, size = 0.6) {
    const c = this.tmp.setHSL(0.05 + Math.random() * 0.07, 1, 0.55);
    this.glow.emit(x + this.r(0.4), y, z + this.r(0.4), this.r(0.4), 1.5 + Math.random() * 1.5, this.r(0.4), c, size * (1 + Math.random()), 0.6 + Math.random() * 0.4, { grow: -0.5, drag: 0.5 });
  }
  muzzle(x, y, z, dx, dy, dz) {
    for (let i = 0; i < 4; i++) this.glow.emit(x + dx * i * 0.12, y + dy * i * 0.12, z + dz * i * 0.12, dx * 3, dy * 3, dz * 3, 0xffd27a, 0.5 - i * 0.08, 0.05);
  }
  explosion(x, y, z, radius) {
    for (let i = 0; i < 70; i++) {
      const c = this.tmp.setHSL(0.03 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.2);
      this.glow.emit(x, y, z, this.r(radius * 1.6), Math.random() * radius * 1.4, this.r(radius * 1.6), c, 1.5 + Math.random() * 2.5, 0.5 + Math.random() * 0.6, { grow: 2, drag: 2.5, grav: -1 });
    }
    for (let i = 0; i < 40; i++) this.soft.emit(x + this.r(2), y + Math.random() * 2, z + this.r(2), this.r(4), 2 + Math.random() * 4, this.r(4), 0x2a2a2a, 2 + Math.random() * 2, 3 + Math.random() * 2, { grow: 2.5, drag: 1.2, alpha: 0.6, grav: -0.4 });
    this.sparks(x, y, z, 40);
  }
  /** Glowing beads along a bullet path so shots read even in a still frame. */
  streak(a, b, color = 0xffe6a8) {
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const t = 0.08 + (i / n) * 0.5;
      this.glow.emit(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, 0, 0, 0, color, 0.16 - i * 0.015, 0.07);
    }
  }
  checkpointSparkle(x, y, z, color) {
    for (let i = 0; i < 24; i++) this.glow.emit(x + this.r(3), y + Math.random() * 3, z + this.r(3), this.r(2), 2 + Math.random() * 3, this.r(2), color, 0.4, 1.0, { grav: 2, drag: 1 });
  }

  update(dt, camera, height) {
    const scale = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.glow.update(dt, scale);
    this.soft.update(dt, scale);
  }
}
