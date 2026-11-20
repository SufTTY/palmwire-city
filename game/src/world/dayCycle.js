// Time of day: moves the sun (setting over the ocean to the south-west), tints sky, fog and
// lights through morning, noon, golden hour and night, and switches city lights on.
import * as THREE from 'three';
import { clamp, smoothstep, lerp } from '../core/mathUtil.js';

const KEYS = [
  // hour, zenith, horizon, sun colour, sun intensity, hemi intensity, fog far
  { h: 0,    zenith: 0x060a1c, horizon: 0x1a2240, sun: 0x8090c0, si: 0.12, hi: 0.26, fog: 650 },
  { h: 5,    zenith: 0x0b1430, horizon: 0x2c3358, sun: 0x8090c0, si: 0.14, hi: 0.3, fog: 650 },
  { h: 6.5,  zenith: 0x4a6fa8, horizon: 0xffb38a, sun: 0xffb27a, si: 1.6, hi: 0.8, fog: 800 },
  { h: 9,    zenith: 0x3d84d6, horizon: 0xcfe3f2, sun: 0xfff1da, si: 2.6, hi: 1.0, fog: 1100 },
  { h: 13,   zenith: 0x2f7ad8, horizon: 0xd8ecf6, sun: 0xfffaf0, si: 3.0, hi: 1.05, fog: 1200 },
  { h: 16.5, zenith: 0x3b78c8, horizon: 0xf4dcb4, sun: 0xffe2b0, si: 2.8, hi: 0.95, fog: 1050 },
  { h: 18.2, zenith: 0x3d64a8, horizon: 0xffb070, sun: 0xffa050, si: 2.6, hi: 0.8, fog: 900 },
  { h: 19.4, zenith: 0x2a3a78, horizon: 0xff7a50, sun: 0xff6a3a, si: 1.3, hi: 0.55, fog: 750 },
  { h: 20.5, zenith: 0x0e1638, horizon: 0x3a3060, sun: 0x8090c0, si: 0.18, hi: 0.32, fog: 650 },
  { h: 24,   zenith: 0x060a1c, horizon: 0x1a2240, sun: 0x8090c0, si: 0.12, hi: 0.26, fog: 650 },
];

const c1 = new THREE.Color(), c2 = new THREE.Color();
function mixKey(a, b, t, field, out) { return out.copy(c1.setHex(a[field])).lerp(c2.setHex(b[field]), t); }

export class DayCycle {
  constructor(game, hour = 17.6) {
    this.game = game;
    this.hour = hour;
    this.speed = 1 / 75;   // game hours per real second
    this.frozen = false;
    this.night = 0;
    const { scene } = game;
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 10; sc.far = 700;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x8a7a5a, 1.0);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xffd7a8, 60, 1000);
    this.zenith = new THREE.Color(); this.horizon = new THREE.Color(); this.sunColor = new THREE.Color();
    this.sunDir = new THREE.Vector3();
    this.focus = new THREE.Vector3();
  }

  get clockText() {
    const h = Math.floor(this.hour) % 24, m = Math.floor((this.hour % 1) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  sample() {
    const h = this.hour % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    mixKey(a, b, t, 'zenith', this.zenith);
    mixKey(a, b, t, 'horizon', this.horizon);
    mixKey(a, b, t, 'sun', this.sunColor);
    return { si: lerp(a.si, b.si, t), hi: lerp(a.hi, b.hi, t), fog: lerp(a.fog, b.fog, t) };
  }

  update(dt, focus) {
    if (!this.frozen) this.hour = (this.hour + dt * this.speed) % 24;
    if (focus) this.focus.copy(focus);
    const k = this.sample();
    // sun path: rises in the north-east, sets in the south-west over the sea
    const dayT = (this.hour - 6) / 13.5; // 0 at sunrise, 1 at sunset
    const elev = Math.sin(clamp(dayT, -0.2, 1.2) * Math.PI) * 1.05;
    const azim = lerp(2.4, -0.95, clamp(dayT, 0, 1));
    const isDay = dayT > -0.02 && dayT < 1.02;
    if (isDay) {
      this.sunDir.set(Math.sin(azim) * Math.cos(elev), Math.max(0.04, Math.sin(elev)), Math.cos(azim) * Math.cos(elev)).normalize();
    } else {
      this.sunDir.set(-0.3, 0.7, -0.4).normalize(); // moon
    }
    this.night = 1 - smoothstep(0.0, 0.08, Math.min(dayT + 0.03, 1.03 - dayT));
    this.night = clamp(this.night, 0, 1);

    this.sun.color.copy(this.sunColor);
    this.sun.intensity = k.si;
    this.sun.position.copy(this.focus).addScaledVector(this.sunDir, 350);
    this.sun.target.position.copy(this.focus);
    this.hemi.intensity = k.hi;
    this.hemi.color.copy(this.zenith).lerp(new THREE.Color(0xffffff), 0.5);
    this.hemi.groundColor.setHex(0x7a6a50).lerp(this.horizon, 0.3);

    const fog = this.game.scene.fog;
    fog.color.copy(this.horizon).lerp(this.zenith, 0.3).lerp(c2.setHex(0xc8d4e0), 0.25 * (1 - this.night));
    fog.far = k.fog * 1.9 * (this.game.settings ? this.game.settings.get('drawDistance') : 1);
    fog.near = 160;

    const g = this.game;
    if (g.sky) g.sky.setColors({ zenith: this.zenith, horizon: this.horizon, sunDir: this.sunDir, sunColor: this.sunColor, night: this.night });
    if (g.water) g.water.setLighting(this.sunDir, this.sunColor, c1.copy(this.horizon).lerp(this.zenith, 0.4), clamp(k.si / 2.6, 0.12, 1));
    if (g.buildings) g.buildings.setNightFactor(Math.max(this.night, smoothstep(0.82, 1.0, dayT) * 0.35) * 0.6);
    if (g.props) g.props.setNightFactor(Math.max(this.night, smoothstep(0.9, 1.0, dayT) * 0.5));
    if (g.landmarks) g.landmarks.setNightFactor(this.night);
    if (g.renderer) g.renderer.toneMappingExposure = lerp(1.0, 1.15, this.night);
  }
}
