// Assembles the static world of Palmwire City in build order: layout, textures, colliders,
// ground and roads, buildings, props, traffic signals, ocean, sky and landmarks.
import { createCityLayout } from './cityLayout.js';
import { createTextures } from './textures.js';
import { StaticColliders } from './colliders.js';
import { buildGround } from './groundBuilder.js';
import { buildBuildings } from './buildingsBuilder.js';
import { buildProps } from './propsBuilder.js';
import { buildOcean } from './oceanWater.js';
import { SkySystem } from './skyAndLighting.js';
import { TrafficSignals } from './trafficSignals.js';
import { resolveLandmarks } from './landmarks.js';

export function buildCityWorld(G) {
  const t0 = performance.now();
  const layout = createCityLayout();
  const tex = createTextures();
  const colliders = new StaticColliders();
  G.layout = layout;
  G.colliders = colliders;
  buildGround(G.scene, layout, tex, colliders);
  const spots = buildBuildings(G.scene, layout, tex, colliders);
  G.props = buildProps(G.scene, layout, tex, colliders, spots);
  G.signals = new TrafficSignals(G.scene, layout, colliders);
  G.ocean = buildOcean(G.scene);
  G.sky = new SkySystem(G.scene, G.renderer, { shadows: G.settings.shadows });
  G.landmarks = resolveLandmarks(layout);
  G.buildingMaterials = spots.mats;
  G.parkingSpots = spots.parking;
  G.buildTime = performance.now() - t0;
  return { layout, colliders, spots };
}

/** Night lighting for building windows (called every frame with the sky's night factor). */
export function updateCityLights(G) {
  const n = G.sky.night;
  const mats = G.buildingMaterials;
  for (const k of ['stucco', 'glass', 'hotel', 'house', 'warehouse']) mats[k].emissiveIntensity = n * 1.25;
}
