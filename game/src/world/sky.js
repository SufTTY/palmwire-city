// Gradient sky dome with a sun disc, stars at night, and a camera-space sun glare with
// lens ghosts that only shows when the sun is on screen and not hidden behind a tower.
import * as THREE from 'three';
import { softDotTexture } from './textures.js';

const skyVertex = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // keep on the far plane
  }
`;
const skyFragment = /* glsl */`
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
    col = mix(col, uGround, smoothstep(0.0, -0.15, h));
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 900.0) * 18.0 + pow(s, 60.0) * 0.55 + pow(s, 6.0) * 0.22);
    // warm band around the horizon on the sun side
    col += uSunColor * 0.25 * pow(s, 2.0) * (1.0 - smoothstep(0.0, 0.35, abs(h)));
    if (uNight > 0.01 && h > 0.0) {
      vec3 cell = floor(d * 380.0);
      float st = step(0.9975, hash(cell));
      col += vec3(st) * uNight * 0.9;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Sky {
  constructor(game) {
    this.game = game;
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x3a7bd5) },
      uHorizon: { value: new THREE.Color(0xffd7a8) },
      uGround: { value: new THREE.Color(0x8aa0a8) },
      uSunDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.8, 0.5) },
      uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: skyVertex, fragmentShader: skyFragment,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    game.scene.add(this.dome);

    // sun glare sprite placed far along the sun direction (occluded by buildings)
    const dot = softDotTexture();
    this.glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.glare.scale.set(900, 900, 1);
    game.scene.add(this.glare);

    // lens ghosts live in camera space
    this.ghosts = [];
    const ghostColors = [0xffb070, 0x80c8ff, 0xffe0a0, 0xff80c0];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: ghostColors[i], transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
      s.renderOrder = 50;
      game.camera.add(s);
      this.ghosts.push(s);
    }
    this.sunNdc = new THREE.Vector3();
    this.glareStrength = 1;
  }

  setColors({ zenith, horizon, sunDir, sunColor, night }) {
    this.uniforms.uZenith.value.copy(zenith);
    this.uniforms.uHorizon.value.copy(horizon);
    this.uniforms.uGround.value.copy(horizon).multiplyScalar(0.7);
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunColor.value.copy(sunColor);
    this.uniforms.uNight.value = night;
    this.glareStrength = Math.max(0, 1 - night * 1.5) * (sunDir.y > -0.05 ? 1 : 0);
  }

  update() {
    const cam = this.game.camera;
    this.dome.position.copy(cam.position);
    const sd = this.uniforms.uSunDir.value;
    this.glare.position.copy(cam.position).addScaledVector(sd, 3000);
    this.glare.material.opacity = 0.55 * this.glareStrength;
    // ghosts: from the sun's screen position mirrored through the centre
    this.sunNdc.copy(this.glare.position).project(cam);
    const onScreen = this.sunNdc.z < 1 && Math.abs(this.sunNdc.x) < 1.2 && Math.abs(this.sunNdc.y) < 1.2;
    const blocked = onScreen ? this.sunBlocked() : true;
    const vis = onScreen && !blocked ? this.glareStrength : 0;
    const fovY = THREE.MathUtils.degToRad(cam.fov);
    const dist = 10;
    const hh = Math.tan(fovY / 2) * dist, hw = hh * cam.aspect;
    const steps = [0.35, -0.2, -0.55, -0.9];
    this.ghosts.forEach((g, i) => {
      const t = steps[i];
      g.position.set(this.sunNdc.x * t * hw, this.sunNdc.y * t * hh, -dist);
      const s = [1.6, 0.7, 1.1, 2.2][i];
      g.scale.set(s, s, 1);
      g.material.opacity = vis * [0.18, 0.22, 0.16, 0.1][i];
      g.visible = vis > 0.01;
    });
  }

  /** Cheap occlusion test: is a building between the camera and the sun? */
  sunBlocked() {
    const cam = this.game.camera.position;
    const sd = this.uniforms.uSunDir.value;
    const horiz = Math.hypot(sd.x, sd.z) || 1;
    const dx = sd.x / horiz, dz = sd.z / horiz;
    const dist = this.game.colliders.raycast(cam.x, cam.z, dx, dz, 400, 0);
    if (dist >= 400) return false;
    const hitY = cam.y + (sd.y / horiz) * dist;
    // approximate: tall buildings block a low sun
    let tallest = 0;
    const px = cam.x + dx * (dist + 1), pz = cam.z + dz * (dist + 1);
    this.game.colliders.forEachIn(px - 1, pz - 1, px + 1, pz + 1, (b) => { tallest = Math.max(tallest, b.h); });
    return hitY < tallest;
  }
}
