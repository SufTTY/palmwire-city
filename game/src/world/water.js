// The bay, the open ocean and the canal: one large animated water surface with rolling
// swells, a Fresnel sky reflection and a sun glint, fogged like the rest of the scene.
import * as THREE from 'three';
import { WATER_Y, CITY } from '../config.js';

const vertexShader = /* glsl */`
  uniform float uTime;
  varying vec3 vWorld;
  varying float vWave;
  #include <fog_pars_vertex>
  float waveH(vec2 p, float t) {
    return sin(p.x * 0.045 + t * 0.9) * 0.35 + sin(p.y * 0.06 - t * 1.1) * 0.28 + sin((p.x + p.y) * 0.11 + t * 1.7) * 0.12;
  }
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float h = waveH(world.xz, uTime);
    world.y += h;
    vWave = h;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */`
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  varying vec3 vWorld;
  varying float vWave;
  #include <fog_pars_fragment>
  vec2 grad(vec2 p, float t) {
    float dx = cos(p.x * 0.045 + t * 0.9) * 0.35 * 0.045 + cos((p.x + p.y) * 0.11 + t * 1.7) * 0.12 * 0.11;
    float dz = cos(p.y * 0.06 - t * 1.1) * 0.28 * 0.06 + cos((p.x + p.y) * 0.11 + t * 1.7) * 0.12 * 0.11;
    // fine ripples
    dx += sin(p.x * 0.9 + p.y * 0.4 + t * 3.1) * 0.05 + sin(p.x * 2.3 - t * 4.0) * 0.025;
    dz += sin(p.y * 0.8 - p.x * 0.3 + t * 2.7) * 0.05 + sin(p.y * 2.1 + t * 3.6) * 0.025;
    return vec2(dx, dz);
  }
  void main() {
    vec2 g = grad(vWorld.xz, uTime);
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 base = mix(uDeep, uShallow, clamp(vWave * 0.8 + 0.45, 0.0, 1.0));
    vec3 col = mix(base, uSkyColor, clamp(fres * 0.85 + 0.08, 0.0, 1.0));
    vec3 h = normalize(uSunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 220.0) * 6.0 + pow(max(dot(n, h), 0.0), 24.0) * 0.25;
    col += uSunColor * spec * smoothstep(-0.05, 0.12, uSunDir.y);
    float crest = smoothstep(0.45, 0.7, vWave);
    col = mix(col, vec3(0.92, 0.95, 0.96), crest * 0.25);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class Water {
  constructor(game) {
    this.game = game;
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.3, 0.5, 0.4).normalize() },
        uSunColor: { value: new THREE.Color(1, 0.85, 0.6) },
        uSkyColor: { value: new THREE.Color(0.6, 0.75, 0.9) },
        uDeep: { value: new THREE.Color(0x0b4f6c) },
        uShallow: { value: new THREE.Color(0x1f9aa8) },
      },
    ]);
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, fog: true });
    const geo = new THREE.PlaneGeometry(5200, 5200, 160, 160);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(CITY / 2, WATER_Y, CITY / 2 + 600);
    this.mesh.receiveShadow = false;
    game.scene.add(this.mesh);
  }

  update(dt) { this.uniforms.uTime.value += dt; }

  setLighting(sunDir, sunColor, skyColor) {
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunColor.value.copy(sunColor);
    this.uniforms.uSkyColor.value.copy(skyColor);
  }
}
