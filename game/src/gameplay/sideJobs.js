// Repeatable side activities: three street races, courier runs against the clock,
// Sunshade Cab fares, and the Rustline rampage.
import { raceStart, RACE_ROUTES } from './races.js';
import { landmarkDoor, BLOCK, LANDMARKS } from '../config.js';

const DROPS = Object.keys(LANDMARKS).map((k) => landmarkDoor(k))
  .concat([{ x: 4 * BLOCK + 32, z: 2 * BLOCK - 7.5 }, { x: 1 * BLOCK + 32, z: 13 * BLOCK - 7.5 }, { x: 11 * BLOCK + 7.5, z: 3 * BLOCK + 32 }, { x: 6 * BLOCK + 32, z: 12 * BLOCK + 7.5 }]);

function pickDrops(g, n, from) {
  const pool = DROPS.filter((d) => Math.hypot(d.x - from.x, d.z - from.z) > 150);
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

const racePayout = (g, v) => {
  const place = v.racePlace || 4;
  return { cash: [0, 1200, 500, 200, 50][place] ?? 50, xp: [0, 220, 120, 60, 20][place] ?? 20 };
};

function raceJob(key) {
  return {
    id: 'race-' + key, kind: 'race', kindLabel: 'STREET RACE', passLabel: 'RACE FINISHED', title: RACE_ROUTES[key].name, short: RACE_ROUTES[key].name,
    district: key === 'sunline' ? 'beach' : key === 'glasswater' ? 'downtown' : 'canal', needVehicle: true,
    requires: (g) => g.progression.missionsDone.includes('m3') || key === 'glasswater',
    startPos: () => raceStart(key),
    reward: racePayout,
    stages: [{ type: 'race', text: 'Finish ahead of the pack', route: key, pace: key === 'canal' ? 33 : 31 }],
    onComplete: (g, v) => { if (v.racePlace === 1) g.progression.stats.racesWon++; g.hud.notify('Finished ' + ['', '1st', '2nd', '3rd', '4th'][v.racePlace] + ' in ' + v.raceTime.toFixed(1) + ' s', 'info'); },
  };
}

export const SIDE_JOBS = [
  raceJob('sunline'),
  raceJob('glasswater'),
  raceJob('canal'),
  {
    id: 'courier', kind: 'job', kindLabel: 'COURIER RUN', title: 'Mango Mobile Express', short: 'Courier Run', district: 'midtown', needVehicle: true,
    startPos: () => ({ x: 4 * BLOCK + 32, z: 8 * BLOCK - 7.5 }),
    onStart: (g, v) => { v.drops = pickDrops(g, 3, g.player.focus); },
    reward: { cash: 900, xp: 140 },
    stages: [0, 1, 2].map((i) => ({
      type: 'goto', text: 'Deliver parcel ' + (i + 1) + ' of 3', needVehicle: true, radius: 3,
      pos: (g, v) => v.drops[i] || DROPS[i], timer: (g, v) => 30 + Math.hypot((v.drops[i] || DROPS[i]).x - g.player.focus.x, (v.drops[i] || DROPS[i]).z - g.player.focus.z) / 9,
      dialogue: i === 0 ? [['pixel', 'Phones, chargers, "phones." Don\'t ask, just drive.']] : null,
    })),
    onComplete: (g) => { g.progression.stats.jobsDone++; },
  },
  {
    id: 'taxi', kind: 'job', kindLabel: 'CAB FARES', title: 'Sunshade Cab Shift', short: 'Taxi Fares', district: 'beach',
    startPos: () => ({ x: 3 * BLOCK + 20, z: 14 * BLOCK - 7.5 }),
    onStart: (g, v) => { const d = pickDrops(g, 2, g.player.focus); v.pick = { x: 3 * BLOCK + 40, z: 14 * BLOCK + 3 }; v.drop = d[0]; v.drop2 = d[1]; },
    reward: { cash: 750, xp: 120 },
    stages: [
      { type: 'enterVehicle', text: 'Get in the Sunshade Cab', as: 'cab', spawn: () => ({ type: 'cab', x: 3 * BLOCK + 30, z: 14 * BLOCK - 4.95, yaw: -Math.PI / 2 }) },
      { type: 'goto', text: 'Take the fare where they\'re going', useVehicle: 'cab', radius: 3, stopRequired: true, pos: (g, v) => v.drop, timer: 75,
        dialogue: [['sol', 'Where to?'], ['vee', '(on the radio) Don\'t talk to the customers, Sol. You frighten them.']] },
      { type: 'goto', text: 'Second fare — they\'re late for a flight', useVehicle: 'cab', radius: 3, stopRequired: true, pos: (g, v) => v.drop2, timer: 70 },
    ],
    onComplete: (g) => { g.progression.stats.jobsDone++; },
  },
  {
    id: 'rampage', kind: 'rampage', kindLabel: 'RAMPAGE', passLabel: 'RAMPAGE CLEARED', title: 'Rustline Rampage', short: 'Rampage', district: 'docks',
    requires: (g) => g.progression.missionsDone.includes('m2'),
    startPos: () => ({ x: 11 * BLOCK + 32, z: 4 * BLOCK - 7.5 }),
    onStart: (g) => { g.player.arsenal.owned.smg = true; g.player.arsenal.addAmmo('smg', 150); g.player.arsenal.select('smg'); },
    reward: { cash: 1500, xp: 260 },
    stages: [
      { type: 'kill', text: 'Drop 10 Harbor Kings before time runs out', timer: 90, spawn: () => ({ x: 12 * BLOCK + 32, z: 3 * BLOCK + 32, n: 10, faction: 'kings', weapon: ['pistol', 'smg'], spread: 18, alerted: true, skill: 0.35 }) },
    ],
  },
];
