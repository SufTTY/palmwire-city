// Palmwire City - entry point. Creates the renderer and the shared game object (G), builds the
// city and every system, wires events between them, and runs the main loop. ?shot=<name>
// renders a deterministic screenshot scene instead of the title screen.
import * as THREE from 'three';
import { makeRng } from './core/rng.js';
import { Input } from './core/input.js';
import { EventBus } from './core/events.js';
import { buildCityWorld, updateCityLights } from './world/cityWorld.js';
import { RoadNetwork } from './ai/roadNetwork.js';
import { VehicleManager } from './entities/vehicleManager.js';
import { PlayerController } from './entities/playerController.js';
import { TrafficSystem } from './ai/trafficSystem.js';
import { PedestrianSystem } from './ai/pedestrianSystem.js';
import { GangSystem } from './ai/gangSystem.js';
import { PoliceSystem } from './ai/policeSystem.js';
import { CombatSystem } from './combat/combatSystem.js';
import { EffectsSystem } from './fx/effectsSystem.js';
import { CameraRig } from './game/cameraRig.js';
import { WantedLevel } from './game/wantedLevel.js';
import { Progression } from './game/progression.js';
import { PickupSystem } from './game/pickups.js';
import { RespawnSystem } from './game/respawnSystem.js';
import { MissionEngine } from './game/missionEngine.js';
import { GameSession } from './game/gameSession.js';
import { loadSettings } from './game/saveGame.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { DialogueBox } from './ui/dialogueBox.js';
import { AudioEngine } from './audio/audioEngine.js';
import { SoundEffects } from './audio/soundEffects.js';
import { WorldSounds } from './audio/worldSounds.js';
import { Radio } from './audio/radioStations.js';
import { setupShotScene } from './shots/screenshotScenes.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);
if (shotName) Math.random = makeRng(seed * 7919 + 13); // repeatable effects in screenshot scenes

function createRenderer(canvas, settings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!shotName });
  renderer.setPixelRatio(shotName ? 1 : Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function boot() {
  const canvas = document.getElementById('game');
  const settings = loadSettings();
  const renderer = createRenderer(canvas, settings);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.3, 2600);
  const G = {
    renderer, scene, camera, settings,
    rng: makeRng(seed),
    events: new EventBus(),
    characters: [],
    time: 0,
    timeScale: 1,
    state: 'loading',
    shotMode: !!shotName,
  };
  window.__palmwire = G;
  G.input = new Input(canvas);
  buildCityWorld(G);
  G.roads = new RoadNetwork(G.layout);
  G.fx = new EffectsSystem(G);
  G.combat = new CombatSystem(G);
  G.vehicles = new VehicleManager(G, G.parkingSpots);
  const door = G.landmarks.safehouse.door;
  G.player = new PlayerController(G, door.x, door.z + 2);
  G.prog = new Progression(G);
  G.wanted = new WantedLevel(G);
  G.traffic = new TrafficSystem(G, G.roads, G.signals);
  G.peds = new PedestrianSystem(G);
  G.gangs = new GangSystem(G);
  G.police = new PoliceSystem(G, G.roads);
  G.cam = new CameraRig(G, camera);
  G.hud = new HUD(G);
  G.dialogue = new DialogueBox(G);
  G.pickups = new PickupSystem(G);
  G.respawn = new RespawnSystem(G);
  G.missions = new MissionEngine(G);
  G.audio = new AudioEngine(G);
  G.audio.sfx = new SoundEffects(G.audio);
  G.audio.world = new WorldSounds(G, G.audio);
  G.radio = new Radio(G, G.audio);
  G.session = new GameSession(G);
  G.menus = new Menus(G, {
    onNewGame: () => G.session.begin(false),
    onContinue: () => G.session.begin(true),
    onResume: () => G.session.resume(),
    onQuit: () => G.session.quitToTitle(),
  });
  G.setShadows = (on) => {
    renderer.shadowMap.enabled = on;
    G.sky.sun.castShadow = on;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  };
  wireEvents(G);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
  G.input.onLockChange = (locked) => {
    if (!locked && (G.state === 'play' || G.state === 'cutscene') && !G.shotMode) G.session.pause();
  };
  canvas.addEventListener('click', () => {
    if (G.state === 'play') { G.input.requestLock(); G.audio.init(); }
  });
  document.getElementById('loading').classList.add('hidden');

  if (shotName) {
    runShot(G, shotName);
    return;
  }
  G.radio.playTitleTheme(true);
  G.session.showTitle();
  document.addEventListener('click', () => {
    if (G.state === 'title') { G.audio.init(); G.radio.ensureRunning(); }
  }, { once: true });
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(G, dt);
    render(G);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Cross-system reactions that do not belong to any one system. */
function wireEvents(G) {
  G.events.on('vehicleImpact', (e) => {
    if (G.audio.ready && e.speed > 5) G.audio.sfx.crash(e.vehicle.pos, Math.min(1, e.speed / 20));
  });
  G.events.on('characterKilled', (e) => {
    const v = e.victim;
    if (v.faction === 'civ' && G.rng() < 0.4) G.pickups.dropCash(v.pos.x + 0.6, v.pos.z, 20 + Math.floor(G.rng() * 60));
    if (v.faction === 'gang' && G.rng() < 0.6) G.pickups.dropCash(v.pos.x + 0.6, v.pos.z, 50 + Math.floor(G.rng() * 100));
  });
  G.events.on('vehicleDestroyed', (e) => {
    if (e.attacker === G.player.char) G.fx.shake(0.4);
  });
}

function step(G, rawDt) {
  const input = G.input;
  if (input.pressed('Escape') && G.state === 'paused') G.session.resume();
  else if ((input.pressed('Escape') || input.pressed('KeyM')) && (G.state === 'play' || G.state === 'cutscene')) G.session.pause();
  const dt = rawDt * (G.state === 'paused' ? 0 : G.timeScale);
  G.time += dt;
  const live = G.state === 'play' || G.state === 'cutscene' || G.state === 'dead' || G.state === 'busted';
  if (G.state === 'title') {
    G.session.updateFlyover(rawDt);
    G.player.char.pos.set(7.5 * 80, 0.15, 6 * 80);
  }
  if (live || G.state === 'title') {
    if (live) {
      G.dialogue.update(dt, input);
      G.player.update(dt, input);
    }
    G.traffic.update(dt);
    G.peds.update(dt);
    G.gangs.update(dt);
    G.police.update(dt);
    G.vehicles.update(dt);
    if (live) {
      G.player.char.physics(dt);
      G.wanted.update(dt);
      G.missions.update(dt, input);
      G.pickups.update(dt, G.time);
      G.respawn.update(rawDt);
    }
  }
  G.fx.update(dt);
  G.sky.update(dt, G.time, G.player.pos, G.camera, G.state === 'paused' ? 0 : 1);
  G.ocean.update(G.time, G.sky);
  G.props.update(dt, G.time, G.sky.night);
  G.signals.update(G.time);
  updateCityLights(G);
  G.cam.update(rawDt, G.state === 'play' || G.state === 'dead' || G.state === 'busted' ? input : null);
  const camPos = G.camera.position;
  for (const c of G.characters) c.updateModel(dt, camPos);
  G.vehicles.updateVisuals(dt, camPos);
  if (G.state !== 'title') G.hud.update(rawDt);
  if (G.audio.ready) G.audio.world.update(rawDt);
  input.endFrame();
}

function render(G) {
  const h = G.renderer.domElement.clientHeight || window.innerHeight;
  G.fx.particles.setScale(h / (2 * Math.tan((G.camera.fov * Math.PI) / 360)));
  G.renderer.render(G.scene, G.camera);
}

function runShot(G, name) {
  const scene = setupShotScene(G, name);
  const total = scene.frames || 90;
  const dt = 1 / 60;
  for (let k = 0; k < total; k++) {
    if (scene.pin) scene.pin(k, total);
    step(G, dt);
  }
  if (scene.pin) scene.pin(total, total);
  if (scene.final) scene.final();
  G.cam.update(0, null);
  if (scene.camera) scene.camera();
  G.hud.update(0.0001);
  render(G);
  document.title = 'shot-ready';
  const errs = window.__errors;
  if (errs.length) document.getElementById('errlog').textContent = errs.join('\n');
  // keep presenting the same frozen frame so the screenshot always has it
  const hold = () => { render(G); requestAnimationFrame(hold); };
  requestAnimationFrame(hold);
}

try {
  boot();
} catch (err) {
  window.__errors.push('boot: ' + (err && err.stack ? err.stack : err));
  document.getElementById('errlog').textContent = window.__errors.join('\n');
  console.error(err);
}
