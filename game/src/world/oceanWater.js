// The ocean and Pelican Bay: one large plane with a custom shader - rolling swell in the
// vertex stage, analytic wave normals, sky reflection with Fresnel, a hot sun glitter path,
// and surf foam along the Coral Strand shoreline. Fog-aware so it melts into the horizon.
import * as THREE from 'three';
import { CITY, WATER_Y, BEACH_END, POINT_END } from './cityLayout.js';

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += sin(wp.x * 0.045 + uTime * 0.7) * 0.14 + sin(wp.z * 0.06 - uTime * 0.55) * 0.11;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uNight;
uniform vec2 uShore;
varying vec3 vWorld;
#include <fog_pars_fragment>

vec2 waveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = normalize(vec2(1.0, 0.35)); g += d1 * cos(dot(d1, p) * 0.11 + t * 1.0) * 0.11 * 0.32;
  vec2 d2 = normalize(vec2(-0.45, 1.0)); g += d2 * cos(dot(d2, p) * 0.23 + t * 1.4) * 0.23 * 0.15;
  vec2 d3 = normalize(vec2(0.7, -0.8)); g += d3 * cos(dot(d3, p) * 0.53 + t * 2.1) * 0.53 * 0.06;
  vec2 d4 = normalize(vec2(-1.0, -0.25)); g += d4 * cos(dot(d4, p) * 1.17 + t * 3.0) * 1.17 * 0.025;
  vec2 d5 = normalize(vec2(0.2, 1.0)); g += d5 * cos(dot(d5, p) * 2.3 + t * 3.7) * 2.3 * 0.012;
  return g;
}

void main() {
  vec2 g = waveGrad(vWorld.xz, uTime);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uHorizonColor, uSkyColor, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 body = mix(uDeep, uShallow, 0.35 + 0.25 * sin(vWorld.x * 0.01 + vWorld.z * 0.013));
  vec3 col = mix(body, sky, clamp(fres * 1.15, 0.0, 1.0));
  float sd = max(dot(R, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 400.0) * 6.0 + pow(sd, 40.0) * 0.35) * (1.0 - uNight);
  // surf foam along the beach and around the point
  float shoreX = uShore.x + 3.0 + sin(vWorld.z * 0.08 + uTime * 0.9) * 1.6;
  float foamE = (1.0 - smoothstep(0.0, 2.6, abs(vWorld.x - shoreX))) * step(vWorld.z, uShore.y + 6.0);
  float shoreZ = uShore.y + 3.0 + sin(vWorld.x * 0.08 + uTime * 0.9) * 1.4;
  float foamS = (1.0 - smoothstep(0.0, 2.4, abs(vWorld.z - shoreZ))) * step(${(13 * 80 - 16).toFixed(1)}, vWorld.x) * step(vWorld.x, uShore.x + 8.0);
  float foam = max(foamE, foamS) * (0.55 + 0.45 * sin(vWorld.x * 1.3 + vWorld.z * 0.7 + uTime * 2.0));
  col = mix(col, vec3(0.95, 0.97, 0.98) * (1.0 - 0.7 * uNight), clamp(foam, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildOcean(scene) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(1, 0.3, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.8, 0.6) },
      uSkyColor: { value: new THREE.Color(0.3, 0.5, 0.8) },
      uHorizonColor: { value: new THREE.Color(0.9, 0.8, 0.7) },
      uDeep: { value: new THREE.Color(0x0b4f6c) },
      uShallow: { value: new THREE.Color(0x1d8fa0) },
      uNight: { value: 0 },
      uShore: { value: new THREE.Vector2(BEACH_END, POINT_END) },
    },
  ]);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: true });
  const geo = new THREE.PlaneGeometry(6000, 6000, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(CITY / 2, WATER_Y, CITY / 2);
  mesh.name = 'ocean';
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh,
    update(time, sky) {
      uniforms.uTime.value = time;
      uniforms.uSunDir.value.copy(sky.sunDir);
      uniforms.uSunColor.value.copy(sky.sunColor);
      uniforms.uSkyColor.value.copy(sky.zenith);
      uniforms.uHorizonColor.value.copy(sky.horizon);
      uniforms.uNight.value = sky.night;
      uniforms.uDeep.value.setRGB(0.012, 0.11, 0.18).lerp(new THREE.Color(0.004, 0.012, 0.03), sky.night);
      uniforms.uShallow.value.setRGB(0.03, 0.32, 0.38).lerp(new THREE.Color(0.01, 0.03, 0.06), sky.night);
    },
  };
}
