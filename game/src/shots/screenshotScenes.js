// Deterministic screenshot scenes (?shot=<name>&seed=<n>): each stages real game systems -
// the player, traffic, pedestrians, police, missions, HUD - at a fixed time of day, then the
// main loop simulates a fixed number of frames and renders one frame.
//   overview  golden-hour drive up Coral Strand with the skyline, HUD and GPS
//   chase     four-star police chase at dusk: cruisers, helicopter searchlight, traffic
//   street    on-foot shootout with the Gullcrest Kings in Mirador, fleeing pedestrians
//   mission   "Paint Job" in progress on the Pelican Bay bridge, phone call from Dex
//   title     the title screen
import * as THREE from 'three';
import { CELL, HALF_ROAD } from '../world/cityLayout.js';
import { STORY } from '../game/storyMissions.js';
import { civilianLook } from '../entities/characterLooks.js';

function startPlay(G) {
  G.state = 'play';
  G.hud.setVisible(true);
  G.menus.clear();
  G.cam.override = null;
  G.prog.cash = 12450;
  G.prog.respect = 340;
}

function pinVehicle(v, x, z, heading, speed) {
  v.pos.x = x;
  v.pos.z = z;
  v.heading = heading;
  v.vx = Math.sin(heading) * speed;
  v.vz = Math.cos(heading) * speed;
  v.angVel = 0;
}

function driveIn(G, type, x, z, heading, speed, paint) {
  const v = G.vehicles.spawn(type, { x, z, heading, mode: 'physics', paint });
  v.persistent = true;
  G.player.enterVehicle(v);
  pinVehicle(v, x, z, heading, speed);
  return v;
}

/** Traffic car on the lane leaving junction (i, j) in direction (dx, dz), `along` metres out. */
function traffic(G, i, j, dx, dz, along, type) {
  const n = G.roads.node(G.layout.nodeId(i, j));
  if (!n) return null;
  const link = n.links.find((l) => l.dx === dx && l.dz === dz);
  if (!link) return null;
  const p = G.roads.lanePoint(n, link, along);
  return G.traffic.spawnAt({ node: n, link, along, x: p.x, z: p.z }, type);
}

function ped(G, x, z, heading, district = 'midtown') {
  const p = G.peds.spawnPed(x, z, civilianLook(G.rng, district));
  p.heading = heading;
  return p;
}

const SCENES = {
  overview(G) {
    startPlay(G);
    G.sky.setTime(17.25);
    const x = 14 * CELL + 3, z = 8.2 * CELL;
    const v = driveIn(G, 'sports', x, z, Math.PI, 24, 0xffd400);
    for (const [j, a, t] of [[8, 30, 'sedan'], [7, 50, 'van'], [6, 20, 'taxi'], [5, 40, 'hatch']]) traffic(G, 14, j, 0, -1, a, t);
    for (const [j, a, t] of [[6, 30, 'pickup'], [7, 10, 'sedan'], [4, 40, 'hatch']]) traffic(G, 14, j, 0, 1, a, t);
    for (const [j, a, t] of [[6, 30, 'sedan'], [5, 50, 'taxi'], [7, 20, 'muscle']]) traffic(G, 13, j, 0, 1, a, t);
    for (let k = 0; k < 10; k++) ped(G, 14 * CELL + HALF_ROAD + 2 + (k % 3) * 9, z - 30 - k * 14, G.rng() * 6, 'beach');
    for (let k = 0; k < 6; k++) ped(G, 14 * CELL - HALF_ROAD - 2, z - 20 - k * 18, Math.PI, 'beach');
    G.radio.index = 1;
    G.hud.showRadio('WAVE 88.1 — Neon Tide');
    return {
      frames: 100,
      pin(k) { pinVehicle(v, x, z - k * 0.05, Math.PI, 24); },
      final() {
        G.hud.setObjective('Meet Auntie Coral at Suds & Sons');
        G.hud.showRadio('WAVE 88.1 — Neon Tide');
      },
      camera() {
        G.cam.override = { pos: new THREE.Vector3(v.pos.x + 6.5, 7.5, v.pos.z + 17), look: new THREE.Vector3(v.pos.x - 16, 4, v.pos.z - 50), fov: 64 };
        G.cam.update(0, null);
      },
    };
  },

  chase(G) {
    startPlay(G);
    G.sky.setTime(18.45);
    const z = 5 * CELL - 3;
    const x = 7.1 * CELL;
    const v = driveIn(G, 'muscle', x, z, -Math.PI / 2, 30, 0xff8c1a);
    G.wanted.setStars(4, true);
    const cops = [[x + 10, z + 3.2, 0.12], [x + 19, z - 1.4, -0.08], [x + 31, z + 1.8, 0.06]].map(([cx, cz, dh]) => {
      const c = G.police.spawnCruiser(cx, cz, -Math.PI / 2 + dh);
      c.persistent = true;
      return { c, cx, cz, dh };
    });
    G.police.heli.activate(v.pos);
    G.police.heli.pos.set(x + 20, 40, z + 18);
    traffic(G, 6, 5, 1, 0, 30, 'sedan');
    traffic(G, 6, 5, 1, 0, 60, 'van');
    traffic(G, 7, 5, -1, 0, 50, 'hatch');
    traffic(G, 7, 4, 0, 1, 40, 'taxi');
    for (let k = 0; k < 8; k++) ped(G, x - 30 + k * 9, z - 9 + (k % 2) * 0, 0, 'downtown');
    return {
      frames: 110,
      pin(k) {
        pinVehicle(v, x, z, -Math.PI / 2 + 0.16, 30);
        v.skid = 0.8;
        v.steerAngle = 0.35;
        for (const o of cops) { pinVehicle(o.c, o.cx, o.cz, -Math.PI / 2 + o.dh, 29); o.c.sirenOn = true; }
        if (k % 2 === 0) {
          const back = v.T.len * 0.34;
          for (const s of [-1, 1]) G.fx.particles.tireSmoke(v.pos.x + back, 0, v.pos.z + s * 0.85);
        }
        G.police.heli.angle = 0.6;
      },
      final() {
        // the drift that got us here
        for (const s of [-1, 1]) {
          let px = x + 4, pz = z + s * 0.8;
          for (let k = 1; k < 40; k++) {
            const nx = x + 4 + k * 0.9, nz = z + s * 0.8 + Math.sin(k * 0.09) * 2.5 * (k / 40);
            G.fx.marks.skid(px, pz, nx, nz, 0, 0.3);
            px = nx; pz = nz;
          }
        }
        G.hud.setObjective('Escape the PCPD');
        G.hud.notify('Roadblock ahead!', 5);
      },
      camera() {
        G.cam.override = { pos: new THREE.Vector3(x - 11, 2.6, z - 5.5), look: new THREE.Vector3(x + 14, 1.8, z + 0.8), fov: 62 };
        G.cam.update(0, null);
      },
    };
  },

  street(G) {
    startPlay(G);
    G.sky.setTime(16.2);
    const px = 11 * CELL - 2, pz = 5.6 * CELL;
    const p = G.player;
    p.char.pos.set(px, 0, pz);
    p.char.heading = 0.08;
    p.giveWeapon('smg', 90);
    p.selectWeapon('pistol');
    p.controlsLocked = true;
    p.aiming = true;
    p.char.health = 64;
    p.char.armour = 45;
    G.wanted.setStars(2, true);
    const squad = G.gangs.spawnSquad({ x: px + 1, z: pz + 17 }, 4, { weapons: ['pistol', 'smg'], radius: 5, alerted: true });
    const gangSpots = [[px - 3, pz + 15], [px + 4.5, pz + 19], [px - 0.5, pz + 22], [px + 1.5, pz + 13]];
    squad.members.forEach((m, i) => { m.pos.set(gangSpots[i][0], 0, gangSpots[i][1]); m.heading = Math.PI; });
    const wreck = G.vehicles.spawn('sedan', { x: px + 4, z: pz + 9, heading: 0.5, mode: 'physics', paint: 0x8c1c13 });
    wreck.health = wreck.maxHealth * 0.12;
    traffic(G, 11, 6, 0, -1, 40, 'van');
    traffic(G, 11, 5, 0, 1, 50, 'hatch');
    const fleeing = [];
    for (let k = 0; k < 7; k++) {
      const q = ped(G, px - 8.5 + (k % 2) * 17, pz - 4 + k * 3.5, Math.PI, 'midtown');
      fleeing.push(q);
    }
    const cop = G.police.spawnCruiser(px + 3, pz - 30, 0.1);
    cop.ai.deployed = true;
    return {
      frames: 90,
      pin(k) {
        p.char.pos.set(px, G.layout.groundHeight(px, pz), pz);
        p.char.vel.set(0, 0, 0);
        p.char.heading = 0.08;
        p.char.pose = 'aim';
        p.aiming = true;
        G.cam.yaw = 0.08;
        G.cam.pitch = 0.06;
        squad.members.forEach((m, i) => {
          if (!m.alive) return;
          m.pos.x = gangSpots[i][0]; m.pos.z = gangSpots[i][1];
          m.cooldown = 99;
        });
        pinVehicle(wreck, px + 4, pz + 9, 0.5, 0);
        if (k === 30) squad.members[3].takeDamage(500, { attacker: p.char, weapon: 'pistol' });
        fleeing.forEach((q, i) => { if (q.alive) q.panic({ x: px + 2, z: pz + 16 }, 8); if (i % 3 === 0) { q.state = 'cower'; q.timer = 5; } });
      },
      final() {
        const muzzle = new THREE.Vector3(px + Math.sin(0.08) * 0.75 - 0.33, 1.6, pz + 0.75);
        const target = squad.members[0];
        const dir = target.pos.clone().setY(1.3).sub(muzzle).normalize();
        G.combat.fire(p.char, muzzle, dir, 'pistol', { isPlayer: true });
        G.combat.npcFire(squad.members[1], p.char, 'smg', 0.2);
        G.combat.npcFire(squad.members[2], p.char, 'pistol', 0.2);
        G.fx.update(0.016);
        G.hud.setObjective('Take out the Gullcrest Kings (1/6)');
      },
    };
  },

  mission(G) {
    startPlay(G);
    G.sky.setTime(17.5);
    G.prog.completed.add('m1');
    const def = STORY.find((m) => m.id === 'm2');
    G.missions.start(def);
    G.dialogue.close();
    G.missions.advance(); // spawn the Vireo
    const vireo = G.missions.active.ctx.vars.vireo;
    const x = 11.8 * CELL, z = 12 * CELL - 3;
    vireo.mode = 'physics';
    G.player.enterVehicle(vireo);
    pinVehicle(vireo, x, z, -Math.PI / 2, 26);
    G.missions.advance(); // enter-car stage
    G.missions.advance(); // delivery stage with Dex on the phone
    traffic(G, 12, 12, -1, 0, 50, 'sedan');
    traffic(G, 11, 12, 1, 0, 30, 'van');
    traffic(G, 10, 12, 1, 0, 40, 'hatch');
    return {
      frames: 90,
      pin() { pinVehicle(vireo, x, z, -Math.PI / 2, 26); },
      final() {
        G.dialogue.showInstant([
          ['dex', 'I can hear that engine from here. Easy on the paint - every dent comes out of your cut!'],
        ], 0, { lock: false });
      },
      camera() {
        G.cam.override = { pos: new THREE.Vector3(x + 10, 3.6, z + 2.2), look: new THREE.Vector3(x - 30, 6, z - 2), fov: 64 };
        G.cam.update(0, null);
      },
    };
  },

  title(G) {
    G.session.showTitle();
    return { frames: 30 };
  },
};

export function setupShotScene(G, name) {
  const fn = SCENES[name] || SCENES.overview;
  return fn(G);
}
