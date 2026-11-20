// Deterministic screenshot scenes selected with ?shot=NAME&seed=N. Each one stages a moment
// that shows many systems at once, simulates a few seconds with a fixed step, then freezes.
//   chase    — golden-hour police chase on Sunline Blvd with the air unit (cover)
//   foot     — on-foot shootout in Calle Mango with fleeing pedestrians
//   race     — mid-race on the Sunline Sprint, checkpoint stage change
//   map      — the map / progression screen
//   overview — free aerial view of the city
import * as THREE from 'three';
import { AIDriver } from '../actors/aiDriver.js';
import { CITY } from '../config.js';
import { wrapAngle, clamp } from '../core/mathUtil.js';

const STEP = 1 / 30;

function progressState(g, { missions = 6, xp = 3400, cash = 24850, crew = true } = {}) {
  const pr = g.progression;
  pr.missionsDone = g.missions.story.slice(0, missions).map((m) => m.id);
  pr.xp = xp; pr.cash = cash;
  if (crew) pr.crew = { driver: true, mechanic: true, lookout: true };
  pr.garage = { engine: 2, tires: 2, armor: 1 };
  pr.standing = { park: 22, residential: 64, downtown: 48, midtown: 57, beach: 81, canal: 35, docks: 41 };
  pr.stats = { kills: 87, carsStolen: 46, racesWon: 5, jobsDone: 9, evaded: 14, busted: 2, wasted: 3 };
  pr.sideDone = { 'race-sunline': 2, 'race-glasswater': 3, courier: 4, taxi: 5, rampage: 1 };
  g.player.arsenal.unlockFor(pr.rank);
}

/** Lane-keeping autopilot for the player's car during warm-up. */
function laneAutopilot(targetYaw, laneAxis, laneValue, speed) {
  return (v) => {
    const c = v.controls;
    const off = laneAxis === 'z' ? v.pos.z - laneValue : v.pos.x - laneValue;
    const r = v.right;
    const offRight = laneAxis === 'z' ? off * r.z : off * r.x; // metres right of the lane centre
    const yawErr = wrapAngle(targetYaw - v.yaw) + clamp(offRight * 0.08, -0.3, 0.3);
    c.steer = clamp(-yawErr * 2.5, -1, 1);
    c.throttle = v.forwardSpeed < speed ? 1 : 0;
    c.brake = 0; c.handbrake = false;
  };
}

function spawnPursuer(g, x, z, yaw, tactic, flank) {
  const slot = { x, z, yaw, a: undefined, b: undefined };
  const u = g.police.spawnCruiser(slot);
  u.ai = new AIDriver(g, u.vehicle, { nextNode: g.police.routeToPlayer, cruise: 30, obeySignals: false, caution: 0.2 });
  u.ai.reanchor();
  u.vehicle.vel.set(Math.sin(yaw) * 28, 0, Math.cos(yaw) * 28);
  u.tactic = tactic; u.flank = flank;
  return u;
}

export const SCENES = {
  chase(g) {
    progressState(g, { missions: 7, xp: 5200 });
    g.day.hour = 18.45; g.day.frozen = true;
    // eastbound on Sunline Blvd, running away from the sunset with the department behind
    const laneZ = CITY + 3;
    const x0 = 250;
    const v = g.vehicles.spawn('stingline', { x: x0, z: laneZ, yaw: Math.PI / 2, paint: 0xff006e });
    g.player.placeInVehicle(v);
    v.vel.set(29, 0, 0);
    g.player.autopilot = laneAutopilot(Math.PI / 2, 'z', laneZ, 30);
    g.missions.forceStart('m8', 3);
    g.wanted.setStars(4);
    g.wanted.minStars = 4;
    g.police.heli.activate(true, { x: x0, z: 860 });
    g.police.heli.pos.set(x0 + 20, 36, 880);
    spawnPursuer(g, x0 - 16, laneZ, Math.PI / 2, 'RAMMING', 0);
    spawnPursuer(g, x0 - 30, CITY - 2.5, Math.PI / 2, 'FLANKING', 1);
    spawnPursuer(g, x0 - 52, laneZ, Math.PI / 2, 'PURSUIT', -1);
    spawnPursuer(g, x0 - 75, CITY - 3, Math.PI / 2, 'PURSUIT', 1);
    // traffic on both sides of the boulevard
    for (const [x, z, yaw] of [[x0 + 120, CITY - 3, -Math.PI / 2], [x0 + 60, laneZ, Math.PI / 2], [x0 + 175, CITY - 3, -Math.PI / 2], [x0 + 140, laneZ, Math.PI / 2], [x0 - 110, CITY - 3, -Math.PI / 2]]) {
      const a = g.roadGraph.nearestNode(x - Math.sin(yaw) * 40, CITY), b = g.roadGraph.nearestNode(x + Math.sin(yaw) * 40, CITY);
      const car = g.traffic.spawnAt({ x, z, yaw, a: a === b ? a - 15 : a, b });
      car.vel.set(Math.sin(yaw) * 12, 0, 0);
    }
    g.crew.cooldowns = { driver: 0, mechanic: 18, lookout: 41 };
    g.cameraRig.lastMouse = -100;
    return {
      warm: 2.4,
      after: () => {
        g.hud.clearBanners();
        g.hud.dialogue.show('pixel', 'Every cop in Palmwire is on you. I\'ll jam what I can — floor it to the pier!', 99);
        // camera ahead of the car on the city side, looking back toward the sunset and the pursuit
        g.cameraRig.yaw = Math.PI / 2 + 0.62; g.cameraRig.pitch = 0.17; g.cameraRig.dist = 8.6;
        g.cameraRig.smoothTarget.copy(g.cameraRig.target);
        g.cameraRig.update(0);
        // the air unit hangs over the pursuit, beam on the car
        const heli = g.police.heli;
        heli.pos.set(v.pos.x - 44, 13, v.pos.z + 18);
        heli.spotTarget.set(v.pos.x - 2, 0, v.pos.z);
        heli.angle = Math.atan2(heli.pos.z - v.pos.z, heli.pos.x - v.pos.x);
        heli.update(0.0001);
        heli.pos.set(v.pos.x - 44, 13, v.pos.z + 18);
        heli.root.position.copy(heli.pos);
        heli.root.updateMatrixWorld(true);
        heli.update(0);
      },
    };
  },

  foot(g) {
    progressState(g, { missions: 6, xp: 4100 });
    g.day.hour = 16.9; g.day.frozen = true;
    // standing in the middle of Hibiscus St, looking north up the road at Kroll's crew
    const px = 578.5, pz = 614;
    g.player.human.pos.set(px, 0, pz);
    g.player.human.yaw = Math.PI;
    g.player.arsenal.select('smg');
    g.missions.forceStart('m7', 1);
    const crew = g.gangs.list.filter((h) => h.tag && h.tag.startsWith('m-m7'));
    crew.forEach((h, i) => { h.pos.set(570 + (i % 3) * 5, 0, 588 - Math.floor(i / 3) * 6); h.alerted = true; });
    if (crew[0]) { crew[0].pos.set(574, 0, 596); crew[0].damage(500, g.player.human, 'bullet'); }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 568.6 : 584.4;
      g.peds.spawnAt(side + (i % 3) - 1, 598 + i * 1.6, { flee: { x: 576, z: 590 } });
    }
    g.wanted.setStars(2);
    // a sedan burning across the lanes as cover
    const wreck = g.vehicles.spawn('meridian', { x: 579, z: 597, yaw: 1.25, paint: 0x1d3557 });
    wreck.health = 0; wreck.burning = 0; wreck.persistent = true;
    const parked = g.vehicles.spawn('pipit', { x: 571.5, z: 622, yaw: 0, paint: 0x48cae4 });
    parked.parked = true;
    g.cameraRig.yaw = -0.18; // camera south of Sol, looking north up the street
    g.cameraRig.pitch = 0.12;
    return {
      warm: 2.6,
      after: () => {
        g.hud.clearBanners();
        g.hud.dialogue.show('kroll', 'Arroyo? You should have stayed in Ohio.', 99);
        g.player.aiming = true;
        g.player.human.pose = 'aim';
        g.cameraRig.update(0);
        const w = g.player.arsenal.weapon;
        g.player.shoot(w);
        g.player.human.pose = 'aim';
        g.fx.update(0.001);
        g.drawHumans();
      },
    };
  },

  race(g) {
    progressState(g, { missions: 2, xp: 900, cash: 3120 });
    g.day.hour = 17.9; g.day.frozen = true;
    const v = g.vehicles.spawn('hammerhead', { x: 70, z: CITY, yaw: Math.PI / 2, paint: 0xff6d00 });
    g.player.placeInVehicle(v);
    g.missions.forceStart('m3', 1);
    const st = g.missions.stage._state;
    st.countdown = 0;
    for (const r of st.rivals) { r.ai.raceCruise += 3; r.ai.cruise = r.ai.raceCruise; }
    g.player.autopilot = laneAutopilot(Math.PI / 2, 'z', CITY + 3, 21);
    g.cameraRig.yaw = -Math.PI / 2 + 0.38;
    g.cameraRig.pitch = 0.16;
    g.cameraRig.lastMouse = -100;
    return {
      warm: 4.4,
      after: () => {
        g.hud.clearBanners();
        g.hud.stageBanner('CHECKPOINT ' + (st.cp + 1) + '/' + st.cps.length, 'Sunline Sprint · keep it flat out to Coralline Ave');
        g.hud.timers.stagebanner = 99;
        g.hud.dialogue.show('tavo', 'You drive like my abuela — if my abuela stole rockets!', 99);
        g.cameraRig.yaw = -Math.PI / 2 + 0.38; g.cameraRig.update(0);
      },
    };
  },

  map(g) {
    progressState(g, { missions: 5, xp: 3600, cash: 18420 });
    g.day.hour = 18.2; g.day.frozen = true;
    g.player.human.pos.set(470, 0.15, 770);
    g.wanted.setStars(0);
    return { warm: 0.6, after: () => { g.ui.mapScreen.show(); } };
  },

  overview(g) {
    g.day.hour = Number(g.params.get('hour') || 18.2); g.day.frozen = true;
    g.player.human.pos.set(300, 0, 880);
    return {
      warm: 1.5,
      after: () => {
        g.cameraRig.override = { pos: new THREE.Vector3(120, 95, 1060), look: new THREE.Vector3(430, 30, 560) };
        g.cameraRig.update(0);
      },
    };
  },
};

/** Builds the requested scene, simulates the warm-up and freezes the world. */
export function runScene(g, name) {
  const scene = SCENES[name] || SCENES.overview;
  g.ui.menus.state = 'playing';
  g.paused = false;
  g.hud.show(true);
  const plan = scene(g);
  const steps = Math.round((plan.warm || 1) / STEP);
  for (let i = 0; i < steps; i++) {
    g.time += STEP;
    g.step(STEP);
  }
  g.player.autopilot = null;
  if (plan.after) plan.after();
  g.hud.update(0);
  g.drawHumans();
  g.frozen = true;
  g.render();
  const info = g.renderer.info.render;
  document.body.dataset.stats = `calls=${info.calls} tris=${info.triangles} cars=${g.vehicles.list.length} peds=${g.peds.list.length}`;
  document.title = 'Palmwire City — ' + name;
}
