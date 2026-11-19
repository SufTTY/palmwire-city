// GPU point-sprite particles in two pools (additive for fire, sparks and muzzle flashes;
// alpha-blended for smoke, dust, blood and spray). Soft round sprites drawn in the shader,
// fog-aware, sized in world units.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
uniform float uScale;
varying vec4 vColor;
#include <fog_pars_vertex>
void main() {
  vColor = aColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const fragmentShader = /* glsl */ `
varying vec4 vColor;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = vColor.a * (1.0 - smoothstep(0.35, 1.0, d));
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <fog_fragment>
}`;

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 4);
    this.s = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('aColor', this.colAttr);
    this.geo.setAttribute('aSize', this.sizeAttr);
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 400 } }]);
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
    let i = this.n;
    if (i >= this.max) i = Math.floor(Math.random() * this.max);
    else this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.c[i * 4 + 3] = a;
    this.a0[i] = a;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  update(dt) {
    let k = 0;
    while (k < this.n) {
      this.life[k] -= dt;
      if (this.life[k] <= 0) {
        this.n--;
        this.copy(this.n, k);
        continue;
      }
      const t = 1 - this.life[k] / this.maxLife[k];
      const dk = Math.exp(-this.drag[k] * dt);
      this.v[k * 3] *= dk; this.v[k * 3 + 2] *= dk;
      this.v[k * 3 + 1] = this.v[k * 3 + 1] * dk - this.grav[k] * dt;
      this.p[k * 3] += this.v[k * 3] * dt;
      this.p[k * 3 + 1] += this.v[k * 3 + 1] * dt;
      this.p[k * 3 + 2] += this.v[k * 3 + 2] * dt;
      this.s[k] = this.s0[k] + (this.s1[k] - this.s0[k]) * t;
      this.c[k * 4 + 3] = this.a0[k] * (1 - t) * Math.min(1, t * 8 + 0.3);
      k++;
    }
    this.geo.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  copy(from, to) {
    if (from === to) return;
    for (let a = 0; a < 3; a++) { this.p[to * 3 + a] = this.p[from * 3 + a]; this.v[to * 3 + a] = this.v[from * 3 + a]; }
    for (let a = 0; a < 4; a++) this.c[to * 4 + a] = this.c[from * 4 + a];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from]; this.s[to] = this.s[from];
    this.a0[to] = this.a0[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
  }
}

export class Particles {
  constructor(scene) {
    this.add = new Pool(scene, 900, true);
    this.alpha = new Pool(scene, 1400, false);
  }
  setScale(s) {
    this.add.uniforms.uScale.value = s;
    this.alpha.uniforms.uScale.value = s;
  }
  update(dt) {
    this.add.update(dt);
    this.alpha.update(dt);
  }
  r(a) { return (Math.random() - 0.5) * a; }

  smoke(x, y, z, size = 1, shade = 0.5) {
    const g = 0.25 + shade * 0.6;
    this.alpha.emit(x + this.r(0.4), y, z + this.r(0.4), this.r(0.8), 1.4 + Math.random(), this.r(0.8), 2.5 + Math.random() * 1.5, size, size * 4, g, g, g * 1.02, 0.5, -0.1, 0.4);
  }
  tireSmoke(x, y, z) {
    this.alpha.emit(x, y + 0.2, z, this.r(1.5), 0.6 + Math.random() * 0.5, this.r(1.5), 1.4 + Math.random() * 0.6, 0.7, 3.4, 0.9, 0.9, 0.92, 0.35, -0.05, 0.8);
  }
  fire(x, y, z, size = 1) {
    this.add.emit(x, y, z, this.r(0.6), 2 + Math.random() * 1.5, this.r(0.6), 0.45 + Math.random() * 0.4, size * 1.4, size * 0.3, 1, 0.45 + Math.random() * 0.3, 0.1, 0.9, -0.5, 0.5);
  }
  sparks(x, y, z, n = 6) {
    for (let k = 0; k < n; k++) {
      this.add.emit(x, y, z, this.r(9), Math.random() * 5, this.r(9), 0.2 + Math.random() * 0.25, 0.14, 0.05, 1, 0.85, 0.4, 1, 14, 0.5);
    }
  }
  blood(x, y, z, dir) {
    for (let k = 0; k < 8; k++) {
      this.alpha.emit(x, y, z, dir.x * 2.5 + this.r(2), 0.5 + Math.random() * 1.5, dir.z * 2.5 + this.r(2), 0.4 + Math.random() * 0.3, 0.18, 0.12, 0.55, 0.02, 0.03, 0.95, 9, 0.5);
    }
  }
  dust(x, y, z) {
    for (let k = 0; k < 3; k++) this.alpha.emit(x, y, z, this.r(1.5), Math.random() * 1.2, this.r(1.5), 0.6 + Math.random() * 0.4, 0.25, 0.9, 0.75, 0.7, 0.6, 0.6, 0.5, 1.5);
  }
  splash(x, y, z) {
    for (let k = 0; k < 4; k++) this.alpha.emit(x + this.r(1.5), y, z + this.r(1.5), this.r(2), 2 + Math.random() * 3, this.r(2), 0.6, 0.3, 0.8, 0.92, 0.96, 1, 0.7, 9, 0.2);
  }
  muzzle(x, y, z, d) {
    for (let k = 0; k < 4; k++) {
      const s = k * 0.12;
      this.add.emit(x + d.x * s, y + d.y * s, z + d.z * s, d.x * 4, d.y * 4, d.z * 4, 0.05, 0.55 - k * 0.1, 0.2, 1, 0.85, 0.45, 1, 0, 0);
    }
    this.alpha.emit(x, y, z, d.x * 1.5, 0.4, d.z * 1.5, 0.6, 0.15, 0.7, 0.8, 0.8, 0.8, 0.25, -0.2, 1);
  }
  explosion(x, y, z) {
    for (let k = 0; k < 45; k++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2, sp = 4 + Math.random() * 9;
      this.add.emit(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp, 0.5 + Math.random() * 0.6, 3.5, 1.2, 1, 0.5 + Math.random() * 0.3, 0.12, 1, -1, 2.5);
    }
    for (let k = 0; k < 30; k++) this.sparks(x, y, z, 1);
    for (let k = 0; k < 24; k++) {
      this.alpha.emit(x + this.r(3), y + Math.random() * 2, z + this.r(3), this.r(5), 2 + Math.random() * 3, this.r(5), 2.5 + Math.random() * 2, 2.5, 8, 0.16, 0.15, 0.15, 0.75, -0.3, 1.2);
    }
  }
}
