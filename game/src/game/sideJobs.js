// Repeatable side activities: the Sunset Sprint street race over the bay bridge, Palmwire Cab
// fares, and the Kings' Turf rampage. Built from the same stages as the story.
import { goTo, killSquad, checkpoints, run, spawnCar, talk } from './missionStages.js';
import { CELL, CITY, HALF_ROAD } from '../world/cityLayout.js';
import { formatTimer } from '../core/mathUtil.js';

const node = (i, j) => ({ x: i * CELL, z: j * CELL });
const RACE_START = { x: CITY + 9, z: 2.5 * CELL };
const CAB_STAND = { x: 8 * CELL + HALF_ROAD + 3, z: 3.5 * CELL };
const TURF = { x: 4 * CELL + 9, z: 8.5 * CELL }; // Mirador sidewalk; waves arrive along the streets

export const SIDE_JOBS = [
  {
    id: 'race', title: 'Sunset Sprint', giver: 'race', side: true, marker: () => RACE_START, blip: 'flag',
    requires: ['m1'], inVehicle: true,
    reward: { cash: 800, respect: 30 },
    stages: () => [
      talk([['dex', 'Sunset Sprint: down the Strand, over the bay bridge and back up Mirador. Ninety seconds. Go!']]),
      checkpoints(() => [node(14, 4), node(14, 8), node(13, 11), node(13, 12), node(11, 12), node(9, 12), node(9, 9), node(11, 9), node(12, 6), node(14, 5)], { text: 'Sunset Sprint', timeLimit: 95, inVehicle: true, radius: 7 }),
      run((G, ctx) => {
        const t = ctx.vars.elapsed;
        const best = G.prog.stats.bestRace;
        if (!best || t < best) { G.prog.stats.bestRace = t; G.hud.notify(`New best time ${formatTimer(t)}!`, 4); }
        const bonus = Math.max(0, Math.round((95 - t) * 20));
        if (bonus) G.prog.addCash(bonus, 'time bonus');
      }),
    ],
  },
  {
    id: 'taxi', title: 'Palmwire Cab Fares', giver: 'taxi', side: true, marker: () => CAB_STAND, blip: 'taxi',
    requires: ['m1'],
    reward: { cash: 0, respect: 25 },
    stages: (G) => {
      const out = [spawnCar('cab', 'taxi', { x: CAB_STAND.x + 4, z: CAB_STAND.z + 6, heading: Math.PI })];
      let from = CAB_STAND;
      for (let k = 0; k < 3; k++) {
        const pick = G.roads.randomLaneSpot(G.rng, from.x, from.z, 150, 420, 60) || { x: 6 * CELL, z: 6 * CELL - 3 };
        const drop = G.roads.randomLaneSpot(G.rng, pick.x, pick.z, 200, 500, 60) || { x: 10 * CELL, z: 9 * CELL - 3 };
        const dist = Math.hypot(drop.x - pick.x, drop.z - pick.z);
        out.push(goTo({ x: pick.x, z: pick.z }, { vehicleTag: 'cab', backText: 'Get in the Palmwire Cab', text: `Pick up fare ${k + 1} of 3`, radius: 5, stop: true, color: 0x2bb3a6 }));
        out.push(goTo({ x: drop.x, z: drop.z }, { vehicleTag: 'cab', text: `Drive fare ${k + 1} to the destination`, radius: 6, stop: true, timeLimit: Math.round(dist / 11 + 25) }));
        out.push(run((GG) => GG.prog.addCash(Math.round(150 + dist * 0.8), 'fare')));
        from = drop;
      }
      return out;
    },
  },
  {
    id: 'rampage', title: 'Kings\' Turf', giver: 'rampage', side: true, marker: () => TURF, blip: 'skull',
    requires: ['m3'],
    reward: { cash: 1200, respect: 60 },
    stages: () => [
      run((G) => {
        G.player.giveWeapon('smg', 120);
        G.player.selectWeapon('smg');
        G.hud.notify('RAMPAGE: clear the Kings off this corner!', 4);
      }),
      killSquad({ x: 4 * CELL, z: 8.5 * CELL + 20 }, 6, { text: 'Rampage: wave 1', alerted: true, radius: 12, timeLimit: 70, weapons: ['pistol'] }),
      killSquad({ x: 4.5 * CELL, z: 9 * CELL }, 6, { text: 'Rampage: wave 2', alerted: true, radius: 12, timeLimit: 70, weapons: ['pistol', 'smg'] }),
    ],
  },
];
