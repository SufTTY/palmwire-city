// "Last Tide" - the Palmwire City story in seven missions. Rae Solano comes home to find
// Marrow Company's Victor Hale buying up Coral Strand with bribes while the Gullcrest Kings
// do his collecting. Auntie Coral (Suds & Sons) and Dex (Rust & Chrome) give the jobs.
import { talk, getCar, spawnCar, enterCar, goTo, killSquad, reachWanted, loseWanted, chaseCar, checkpoints, run } from './missionStages.js';
import { CELL, HALF_ROAD } from '../world/cityLayout.js';

const L = (key, what = 'door') => (G) => G.landmarks[key][what];
const at = (x, z, heading = 0) => ({ x, z, heading });
// open yards south of the warehouses in the Saltworks blocks
const DOCKS_HANGOUT = at(5.5 * CELL + 18, 13.75 * CELL);
const WAREHOUSE = at(1.5 * CELL, 12.75 * CELL);
const MARINA = at(9 * CELL - HALF_ROAD - 2, 10 * CELL + 30);

export const STORY = [
  {
    id: 'm1', title: 'Homecoming', giver: 'coral', marker: L('laundromat'),
    reward: { cash: 500, respect: 60 },
    stages: () => [
      talk([
        ['coral', 'Rae Solano. Three years and not one postcard.'],
        ['rae', 'They don\'t sell postcards upstate, Auntie.'],
        ['coral', 'Palmwire changed while you were gone. Marrow Company is buying Coral Strand one bribe at a time, and the Gullcrest Kings collect for them.'],
        ['coral', 'First things first. Dex is waiting at Rust & Chrome down in the Saltworks. Borrow a car - nobody on this street will report it.'],
      ]),
      getCar('Get a car  (walk up to one and press F)'),
      goTo(L('garage', 'parking'), { text: 'Drive to Rust & Chrome Garage', inVehicle: true, timeLimit: 200, radius: 7, stop: true }),
      talk([
        ['dex', 'Look what the tide dragged in! Still drive like your hair\'s on fire?'],
        ['rae', 'Only when somebody\'s chasing me.'],
        ['dex', 'Then you\'re gonna love this town again. I\'ve got work with your name on it whenever you want it.'],
      ]),
    ],
  },
  {
    id: 'm2', title: 'Paint Job', giver: 'dex', marker: L('garage'),
    reward: { cash: 1500, respect: 90, unlock: 'armour' },
    stages: () => [
      talk([
        ['dex', 'A Marrow Company VP parks his Vireo GT outside the Coral Strand hotels like he owns the beach.'],
        ['dex', 'Bring it here in one piece and I\'ll turn it into three pieces worth more than the whole.'],
        ['rae', 'Define "one piece".'],
        ['dex', 'Keep it above half, wheelman. And keep the cops off my roller door.'],
      ]),
      spawnCar('vireo', 'sports', at(13.5 * CELL + 22, 5.5 * CELL, Math.PI), { paint: 0xffd400 }),
      enterCar('vireo', 'Steal the Vireo GT at Coral Strand'),
      goTo(L('garage', 'parking'), {
        vehicleTag: 'vireo', backText: 'Get back in the Vireo GT', text: 'Deliver the Vireo GT to Rust & Chrome (keep it above 50%)',
        minHealth: 0.5, stop: true, radius: 7, needNoWanted: true, timeLimit: 300,
        call: [
          ['dex', 'I can hear that engine from here. Easy on the paint - every dent comes out of your cut!'],
          ['rae', 'Relax. I\'m taking the scenic route over the bridge.'],
        ],
      }),
      talk([
        ['dex', 'Not a scratch! Well. Not many scratches.'],
        ['dex', 'Coral called, by the way. Something about the laundromat. She sounded... polite. That\'s never good.'],
      ]),
    ],
  },
  {
    id: 'm3', title: 'Hard Rinse', giver: 'coral', marker: L('laundromat'),
    reward: { cash: 2000, respect: 120 },
    stages: () => [
      talk([
        ['coral', 'Mari Quintero\'s Kings came in this morning. Said Suds & Sons pays "protection" now. To Victor Hale.'],
        ['rae', 'And you said?'],
        ['coral', 'I said I\'d send my niece. They drink at the old fish market in the Saltworks. Show them what a rinse cycle is.'],
        ['coral', 'Take the Hornet. Bring it back clean.'],
      ]),
      run((G) => G.prog.unlock('smg')),
      goTo(DOCKS_HANGOUT, { text: 'Go to the Kings\' hangout at the Saltworks Docks', radius: 28 }),
      killSquad(DOCKS_HANGOUT, 6, { text: 'Take out the Gullcrest Kings', weapons: ['pistol', 'pistol', 'smg'], radius: 9 }),
      talk([
        ['mari', 'You just started a war you can\'t afford, Solano.'],
        ['rae', 'Put it on Hale\'s tab.'],
      ]),
      goTo(L('laundromat'), { text: 'Return to Suds & Sons', radius: 4, needNoWanted: true }),
    ],
  },
  {
    id: 'm4', title: 'Heat Check', giver: 'dex', marker: L('garage'),
    reward: { cash: 1800, respect: 120 },
    stages: () => [
      talk([
        ['dex', 'Hale\'s people listen to every PCPD channel. I want to hear what they hear.'],
        ['dex', 'Get the cops riled - two stars - then shake them. My scanner records the whole chase.'],
        ['rae', 'You want me to get chased. For science.'],
        ['dex', 'For science and eighteen hundred bucks.'],
      ]),
      reachWanted(2, 'Raise a 2-star wanted level'),
      loseWanted('Lose the cops'),
      goTo(L('garage', 'parking'), { text: 'Return to Rust & Chrome', radius: 7 }),
      talk([
        ['dex', 'Got it. Every unit, every channel. One name keeps coming up: Detective Lena Brooks.'],
        ['dex', 'She\'s been asking about you, Rae. Asking nice. That\'s never good either.'],
      ]),
    ],
  },
  {
    id: 'm5', title: 'Courier Run', giver: 'coral', marker: L('laundromat'),
    reward: { cash: 2500, respect: 150 },
    stages: () => [
      talk([
        ['coral', 'A friend at the Pelican Bay marina is holding copies of Marrow Company\'s land deeds. Forged ones.'],
        ['coral', 'Pick them up and drop a copy with three people Hale can\'t buy. Before his people work out where they went.'],
      ]),
      goTo(MARINA, { text: 'Collect the deeds at the Pelican Bay marina', radius: 4 }),
      checkpoints(() => [at(5.1 * CELL, 9.5 * CELL), at(11.5 * CELL, 7.1 * CELL), at(13.9 * CELL, 2.5 * CELL)], { text: 'Deliver the copies', timeLimit: 210, radius: 5, color: 0x3ddc84 }),
      talk([['coral', 'A reporter, a judge and a priest. Victor will hear about it by supper. Good work, baby.']]),
    ],
  },
  {
    id: 'm6', title: 'Hale\'s Ledger', giver: 'coral', marker: L('laundromat'),
    reward: { cash: 4000, respect: 200, unlock: 'shotgun' },
    stages: () => [
      talk([
        ['coral', 'Hale\'s accountant is moving the real ledger tonight. A Coastline Van, leaving the Halcyon towers right now.'],
        ['coral', 'Every bribe and every forged deed on the Strand is in that book. Stop that van.'],
        ['rae', 'Stop it gently?'],
        ['coral', 'Did I say gently?'],
      ]),
      chaseCar('van', at(6 * CELL, 5 * CELL - 3, -Math.PI / 2), { waitText: 'Intercept the accountant\'s van in Halcyon', text: 'Wreck the accountant\'s van', paint: 0x2a2d34, speed: 0.95 }),
      goTo((G, ctx) => ctx.vars.target.pos.clone(), { text: 'Grab the ledger from the wreck', radius: 3.5, color: 0x3ddc84 }),
      goTo(L('laundromat'), { text: 'Bring the ledger to Coral', radius: 4, needNoWanted: true }),
      talk([
        ['coral', 'Read it and weep, Victor.'],
        ['coral', 'He\'ll come for all of us now. Take the Breaker - for when he comes to call.'],
      ]),
    ],
  },
  {
    id: 'm7', title: 'Last Tide', giver: 'coral', marker: L('laundromat'),
    reward: { cash: 10000, respect: 400 },
    final: true,
    stages: () => [
      talk([
        ['dex', 'Hale\'s crew is loading the Saltworks warehouse. Guns, cash, the whole operation.'],
        ['coral', 'Detective Brooks raids it at dawn. Unless it\'s already over when she gets there.'],
        ['rae', 'So we light the match.'],
        ['coral', 'And then you run, baby. Like the old days.'],
      ]),
      goTo(WAREHOUSE, { text: 'Go to the Marrow Company warehouse', radius: 30 }),
      killSquad(WAREHOUSE, 6, { suits: true, text: 'Wipe out Hale\'s muscle', weapons: ['smg', 'pistol'], health: 90, accuracy: 0.5, radius: 10 }),
      killSquad(WAREHOUSE, 4, { suits: true, text: 'Reinforcements! Finish them', weapons: ['shotgun', 'smg'], health: 90, alerted: true, radius: 14 }),
      run((G) => G.wanted.setStars(4)),
      talk([
        ['brooks', 'PCPD! Rae Solano, step away from the fire and get on the ground!'],
        ['rae', 'Not tonight, detective.'],
      ]),
      loseWanted('Escape the PCPD'),
      goTo(L('safehouse'), { text: 'Lay low at Seagrass Apartments', radius: 4 }),
      talk([
        ['coral', 'The ledger led the morning news. Hale is in cuffs, the Kings scattered, and the Strand stays ours.'],
        ['dex', 'So. You staying this time?'],
        ['rae', 'Somebody has to drive this city home.'],
      ]),
    ],
  },
];
