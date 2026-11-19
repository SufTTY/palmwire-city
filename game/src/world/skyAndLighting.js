// Day/night cycle: a shader sky dome with sun disc, glow, drifting clouds and stars; the sun
// light (with a shadow box that follows the player), hemisphere fill, fog, and an environment
// map baked from the sky so car paint and glass towers reflect the sunset. The sun sets over
// the ocean to the east of Coral Strand, so golden hour lights the beach head-on.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/mathUtil.js';

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uGround;
uniform float uNight;
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uGround, smoothstep(0.0, -0.08, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 5.0) * 0.28 + pow(sd, 48.0) * 0.6);
  col += uSunColor * smoothstep(0.99935, 0.9997, sd) * 8.0;
  // clouds on a virtual plane
  if (h > 0.01) {
    vec2 uv = d.xz / (h + 0.08) * 1.4 + vec2(uTime * 0.004, uTime * 0.002);
    float c = smoothstep(0.52, 0.85, fbm(uv));
    vec3 cloudCol = mix(vec3(1.0), uSunColor * 1.2 + uHorizon * 0.4, 0.55);
    cloudCol = mix(cloudCol, vec3(0.12, 0.13, 0.2), uNight * 0.85);
    col = mix(col, cloudCol, c * 0.75 * smoothstep(0.01, 0.12, h));
  }
  // stars
  float star = step(0.9965, hash(floor(d.xz / (h + 0.2) * 220.0))) * smoothstep(0.05, 0.3, h);
  col += vec3(star) * uNight * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Palette keyed by sun elevation (sin of the sun angle).
const KEYS = [
  { s: -0.5, zen: 0x03050f, hor: 0x111a33, sun: 0x8090c0, si: 0.25, hemi: 0.22, fog: 0x0e1424, fogFar: 650 },
  { s: -0.15, zen: 0x0f1636, hor: 0x56406e, sun: 0x8c90c8, si: 0.3, hemi: 0.3, fog: 0x2a2640, fogFar: 750 },
  { s: 0.0, zen: 0x2a3c78, hor: 0xff8656, sun: 0xff6a3a, si: 1.3, hemi: 0.5, fog: 0xd88a6e, fogFar: 950 },
  { s: 0.14, zen: 0x3f72b8, hor: 0xffbf86, sun: 0xffa865, si: 2.6, hemi: 0.7, fog: 0xeec3a0, fogFar: 1150 },
  { s: 0.4, zen: 0x3a86d4, hor: 0xc9e3f2, sun: 0xffefd8, si: 3.0, hemi: 0.85, fog: 0xc8dff0, fogFar: 1300 },
  { s: 1.0, zen: 0x2f7fd0, hor: 0xbfe0f4, sun: 0xfff6e8, si: 3.2, hemi: 0.95, fog: 0xc6def0, fogFar: 1400 },
];

function samplePalette(s) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let k = 0; k < KEYS.length - 1; k++) {
    if (s >= KEYS[k].s && s <= KEYS[k + 1].s) { a = KEYS[k]; b = KEYS[k + 1]; break; }
  }
  if (s < KEYS[0].s) b = a;
  const t = a === b ? 0 : clamp((s - a.s) / (b.s - a.s), 0, 1);
  const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    zen: c(a.zen, b.zen), hor: c(a.hor, b.hor), sun: c(a.sun, b.sun), fog: c(a.fog, b.fog),
    si: lerp(a.si, b.si, t), hemi: lerp(a.hemi, b.hemi, t), fogFar: lerp(a.fogFar, b.fogFar, t),
  };
}

export class SkySystem {
  constructor(scene, renderer, { shadows = true } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.tod = 17.2;
    this.sunDir = new THREE.Vector3(1, 0.3, 0.2).normalize();
    this.sunColor = new THREE.Color();
    this.zenith = new THREE.Color();
    this.horizon = new THREE.Color();
    this.night = 0;
    this.lastEnvTod = -99;

    this.uniforms = {
      uSunDir: { value: this.sunDir }, uZenith: { value: this.zenith }, uHorizon: { value: this.horizon },
      uSunColor: { value: this.sunColor }, uGround: { value: new THREE.Color(0x2a3a44) }, uNight: { value: 0 }, uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcdcff, 0x9a8a70, 0.8);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xc6def0, 120, 1300);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
    this.envScene.add(this.envDome);
  }

  setTime(hours) {
    this.tod = ((hours % 24) + 24) % 24;
  }

  /** Sun angle: 0 at 06:00 (rising over the western hills), PI at 18:00 (setting over the sea). */
  computeSun() {
    const a = ((this.tod - 6) / 12) * Math.PI;
    const s = Math.sin(a);
    const dir = new THREE.Vector3(-Math.cos(a), Math.max(s, -1) * 0.92, 0.38);
    if (s < -0.05) dir.set(Math.cos(a) * 0.6, Math.max(0.25, -s), -0.4); // moon
    return { dir: dir.normalize(), s };
  }

  update(dt, time, focus, camera, timeScale = 1) {
    this.tod = (this.tod + (dt * timeScale) / 60) % 24; // one game minute per real second
    const { dir, s } = this.computeSun();
    this.sunDir.copy(dir);
    const p = samplePalette(s);
    this.zenith.copy(p.zen);
    this.horizon.copy(p.hor);
    this.sunColor.copy(p.sun);
    this.night = smoothstep(0.06, -0.18, s);
    this.uniforms.uNight.value = this.night;
    this.uniforms.uTime.value = time;
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.si;
    this.hemi.intensity = p.hemi;
    this.hemi.color.copy(p.zen).lerp(new THREE.Color(0xffffff), 0.45);
    this.hemi.groundColor.set(0x8a7a62).multiplyScalar(0.4 + 0.6 * (1 - this.night));
    this.scene.fog.color.copy(p.fog);
    this.scene.fog.far = p.fogFar;
    this.scene.fog.near = 60;
    this.dome.position.copy(camera.position);
    this.dome.scale.setScalar(camera.far * 0.9 / 100);

    // shadow box follows the focus point, snapped to texels to avoid shimmering
    const texel = 260 / 2048;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + dir.x * 400, dir.y * 400, fz + dir.z * 400);
    this.sun.target.updateMatrixWorld();

    if (Math.abs(this.tod - this.lastEnvTod) > 0.5) this.refreshEnvironment();
  }

  refreshEnvironment() {
    this.lastEnvTod = this.tod;
    const old = this.envRT;
    this.envDome.position.set(0, 0, 0);
    this.envDome.scale.setScalar(1);
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 500);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.55 + 0.25 * (1 - this.night);
    if (old) old.dispose();
  }
}
