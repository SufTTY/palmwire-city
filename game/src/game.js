// The Game: builds the city and every system, owns the update order of a frame, and draws
// the crowd. Everything else talks to the rest of the game through this object.
import * as THREE from 'three';
import { EventBus } from './core/events.js';
import { Settings } from './core/settings.js';
import { Input } from './core/input.js';
import { createRenderer, createCamera, bindResize } from './render/renderSetup.js';
import { CameraRig } from './render/cameraRig.js';
import { CityLayout } from './world/cityLayout.js';
import { StaticColliders } from './world/collision.js';
import { BuildingMeshes } from './world/buildings.js';
import { RoadMeshes } from './world/roads.js';
import { Water } from './world/water.js';
import { Sky } from './world/sky.js';
import { Backdrop } from './world/backdrop.js';
import { Props } from './world/props.js';
import { Landmarks } from './world/landmarks.js';
import { RoadGraph } from './world/roadGraph.js';
import { DayCycle } from './world/dayCycle.js';
import { HumanRenderer } from './actors/humanRenderer.js';
import { VehicleManager } from './actors/vehicleManager.js';
import { TrafficSystem } from './actors/traffic.js';
import { PedestrianSystem } from './actors/pedestrians.js';
import { PoliceSystem } from './actors/police.js';
import { GangSystem } from './actors/gangs.js';
import { PlayerController } from './actors/player.js';
import { CombatSystem } from './combat/combat.js';
import { Pickups } from './combat/pickups.js';
import { Effects } from './fx/effects.js';
import { WantedSystem } from './gameplay/wanted.js';
import { Markers } from './gameplay/markers.js';
import { Progression } from './gameplay/progression.js';
import { CrewSystem } from './gameplay/crew.js';
import { Garage } from './gameplay/garage.js';
import { SaveGame } from './gameplay/saveGame.js';
import { RespawnSystem } from './gameplay/respawn.js';
import { MissionEngine } from './gameplay/missions.js';
import { AudioEngine } from './audio/audioEngine.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { MapScreen } from './ui/mapScreen.js';
import { GarageMenu } from './ui/garageMenu.js';
import { WeaponWheel } from './ui/weaponWheel.js';
import { landmarkDoor, PIER_X, BEACH_Z0 } from './config.js';

export class Game {
  constructor(canvas, params) {
    this.params = params;
    this.seed = Number(params.get('seed') || 1);
    this.shotMode = !!params.get('shot');
    this.paused = true;
    this.frozen = false;
    this.time = 0;
    this.events = new EventBus();
    this.settings = new Settings();
    this.input = new Input(canvas);
    this.renderer = createRenderer(canvas, { shadows: this.settings.get('shadows') });
    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.scene.add(this.camera);
    bindResize(this.renderer, this.camera);

    // world
    this.layout = new CityLayout(this.seed);
    this.colliders = new StaticColliders();
    this.buildings = new BuildingMeshes(this); this.buildings.build();
    this.roads = new RoadMeshes(this); this.roads.build();
    this.water = new Water(this);
    this.sky = new Sky(this);
    this.backdrop = new Backdrop(this);
    this.props = new Props(this); this.props.build();
    this.landmarks = new Landmarks(this); this.landmarks.build();
    this.roadGraph = new RoadGraph(this);
    this.day = new DayCycle(this, 17.4);

    // actors and systems
    this.humanRenderer = new HumanRenderer(this.scene);
    this.fx = new Effects(this);
    this.markers = new Markers(this);
    this.combat = new CombatSystem(this);
    this.vehicles = new VehicleManager(this);
    const home = landmarkDoor('safehouse');
    this.progression = new Progression(this);
    this.player = new PlayerController(this, home.x + 9, home.z);
    this.cameraRig = new CameraRig(this);
    this.traffic = new TrafficSystem(this);
    this.peds = new PedestrianSystem(this);
    this.gangs = new GangSystem(this);
    this.police = new PoliceSystem(this);
    this.wanted = new WantedSystem(this);
    this.pickups = new Pickups(this);
    this.crew = new CrewSystem(this);
    this.garage = new Garage(this);
    this.saveGame = new SaveGame(this);
    this.respawn = new RespawnSystem(this);
    this.missions = new MissionEngine(this);
    this.audio = new AudioEngine(this);

    // interface
    this.hud = new Hud(this, document.getElementById('hud'));
    const overlay = document.getElementById('overlay');
    this.ui = {
      menus: new Menus(this, document.getElementById('menus')),
      mapScreen: new MapScreen(this, document.getElementById('menus')),
      garageMenu: new GarageMenu(this, document.getElementById('menus')),
      weaponWheel: new WeaponWheel(this, overlay),
    };
    this.saveGame.init();
    this.garage.init();
    this.wireEvents();
    this.applyShadowSetting();
    this._humans = [];
  }

  wireEvents() {
    const ev = this.events;
    ev.on('vehicleCrash', (e) => {
      const pv = this.player.human.vehicle;
      this.audio.sfx.crash(e.impact, e.x, e.z);
      this.fx.particles.sparks(e.x, 0.8, e.z, Math.min(20, Math.floor(e.impact)));
      if (pv && (e.a === pv || e.b === pv)) this.cameraRig.shake(Math.min(1, e.impact / 18));
    });
    ev.on('vehicleImpact', (e) => {
      this.audio.sfx.crash(e.impact * 0.7, e.x, e.z);
      if (e.vehicle === this.player.human.vehicle) this.cameraRig.shake(Math.min(0.8, e.impact / 20));
    });
    ev.on('gunshot', (e) => this.traffic.panicNear(e.x, e.z, 60));
    ev.on('death', (e) => {
      const h = e.human;
      if (h.role === 'cop' || h.role === 'gang') this.progression.addXP(h.role === 'gang' ? 12 : 5);
    });
    this.input.onLockChange = (locked) => {
      if (!locked && this.ui.menus.state === 'playing' && !this.shotMode && !this.ui.mapScreen.open && !this.ui.garageMenu.open) this.ui.menus.showPause();
    };
  }

  applyShadowSetting() {
    const on = !!this.settings.get('shadows');
    this.renderer.shadowMap.enabled = on;
    this.day.sun.castShadow = on;
    this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }

  /** Everyone who can be shot, run over or drawn. */
  allHumans() {
    const a = this._humans;
    a.length = 0;
    a.push(this.player.human);
    for (const h of this.peds.list) a.push(h);
    for (const h of this.police.officers) a.push(h);
    for (const h of this.gangs.list) a.push(h);
    return a;
  }

  startPlaying(load) {
    const loaded = load && this.saveGame.load();
    this.ui.menus.clear();
    this.ui.menus.state = 'playing';
    this.paused = false;
    this.cameraRig.override = null;
    this.cameraRig.first = true;
    this.cameraRig.yaw = Math.PI;
    this.hud.show(true);
    this.audio.radio.menuMode = false;
    this.input.requestLock();
    if (!loaded) {
      this.hud.dialogue.queue([['sol', 'Palmwire. Four years and it still smells like sunscreen and gasoline.'], ['vee', '(text) Come by the laundromat, baby. Suds & Sons. Don\'t make me come find you.']]);
      this.hud.notify('Story mission available: follow the yellow diamond on the radar', 'info');
    } else {
      this.hud.notify('Welcome back to Palmwire, Sol', 'save');
    }
    this.hud.notify('Press M for the map, Esc to pause', 'info');
  }

  /** Slow aerial orbit behind the title screen. */
  titleCamera(dt) {
    this.titleT = (this.titleT || 0) + dt * 0.03;
    const cx = 300, cz = 860;
    const pos = new THREE.Vector3(cx + Math.sin(this.titleT) * 260, 75, cz + Math.cos(this.titleT) * 200 + 60);
    this.cameraRig.override = { pos, look: new THREE.Vector3(PIER_X + 60, 30, BEACH_Z0 - 220) };
  }

  update(dt) {
    const input = this.input;
    this.ui.menus.update();
    if (this.ui.menus.state === 'title') {
      this.titleCamera(dt);
      this.day.update(dt * 0.2, this.camera.position);
      this.cameraRig.update(0.016);
      this.water.update(dt); this.sky.update(); this.landmarks.update(dt);
      return;
    }
    this.ui.mapScreen.update();
    if (this.paused || this.frozen) { this.renderOnlyUpdate(dt); return; }
    this.ui.weaponWheel.update();
    const scale = this.respawn.update(dt) * this.ui.weaponWheel.timeScale;
    const sdt = dt * scale;
    this.time += sdt;
    this.step(sdt);
    if (input.wasPressed('Enter') || input.wasPressed('KeyE')) this.hud.dialogue.skip();
  }

  /** One simulation step of the whole world. */
  step(sdt) {
    this.roadGraph.update(sdt);
    this.player.update(sdt);
    this.crew.update(sdt);
    this.traffic.update(sdt);
    this.police.update(sdt);
    this.peds.update(sdt);
    this.gangs.update(sdt);
    this.vehicles.update(sdt);
    this.wanted.update(sdt);
    this.missions.update(sdt);
    this.pickups.update(sdt);
    this.garage.update(sdt);
    this.saveGame.update(sdt);
    this.cameraRig.update(sdt);
    this.day.update(sdt, this.player.focus);
    this.water.update(sdt);
    this.sky.update();
    this.landmarks.update(sdt);
    this.markers.update(sdt);
    this.fx.update(sdt);
    this.drawHumans();
    this.hud.update(sdt);
    this.audio.update(sdt);
  }

  renderOnlyUpdate(dt) {
    this.water.update(this.frozen ? 0 : 0);
    this.sky.update();
    this.hud.dialogue.update(0);
    this.audio.update(dt);
  }

  drawHumans() {
    const r = this.humanRenderer, cam = this.camera.position;
    r.begin();
    for (const h of this.allHumans()) {
      if (h.vehicle && !h.vehicle.type.bike) continue;
      if ((h.pos.x - cam.x) ** 2 + (h.pos.z - cam.z) ** 2 > 150 * 150) continue;
      if (h.vehicle) {
        const v = h.vehicle;
        const y = h.pos.y; h.pos.y = 0.3;
        h.lean = 0; h.yaw = v.yaw;
        r.draw(h);
        h.pos.y = y;
        continue;
      }
      r.draw(h);
    }
    r.end();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
