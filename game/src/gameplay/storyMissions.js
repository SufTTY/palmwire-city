// "Saltwater Ledger": the eight-mission story. Sol Arroyo comes home to find developer
// Marcus Vell squeezing the Coral Strip with a bought cop and the Harbor Kings' muscle.
import { landmarkDoor, PIER_X, PIER_END_Z } from '../config.js';
import { raceStart } from './races.js';

const door = (k) => landmarkDoor(k);
const at = (x, z) => ({ x, z });

export const STORY = [
  {
    id: 'm1', number: 1, kind: 'story', title: 'Homecoming', giver: 'vee', district: 'residential',
    startPos: () => door('vee'),
    reward: { cash: 600, xp: 180 },
    stages: [
      { type: 'goto', text: 'Hear Auntie Vee out inside Suds & Sons', pos: () => ({ x: door('vee').x, z: door('vee').z - 1 }), radius: 1.8,
        dialogue: [['vee', 'Four years upstate and you walk in like it\'s Tuesday. Sit. Fold something.'], ['vee', 'Vell Coastal wants the whole Coral Strip. People who say no get visits.'], ['sol', 'And you want me driving again.'], ['vee', 'I want you driving well. Grab a car, see Grease.']] },
      { type: 'enterVehicle', text: 'Take a car off the street (F)', dialogue: [['vee', 'Nothing flashy. Well... nothing too flashy.']] },
      { type: 'goto', text: 'Drive to Okonkwo Auto Works on Hibiscus St', pos: () => at(544, 622), radius: 3, needVehicle: true, stopRequired: true,
        dialogue: [['grease', 'Sol Arroyo! They said you were dead. Or in Ohio. Same thing.']] },
    ],
    outro: [['grease', 'Bring me anything with four wheels and cash, I\'ll make it fast. Garage is yours.']],
    onComplete: (g) => { g.progression.crew.mechanic = true; g.hud.notify('Crew unlocked: Grease (Mechanic) — press X', 'crew'); g.hud.notify('Okonkwo Auto Works garage is open for upgrades', 'info'); },
  },
  {
    id: 'm2', number: 2, kind: 'story', title: 'Low Tide', giver: 'vee', district: 'docks',
    startPos: () => door('vee'),
    reward: { cash: 1400, xp: 320 },
    stages: [
      { type: 'goto', text: 'Head to Berth 9 at the Rustline Docks', pos: () => at(796, 452), radius: 4,
        dialogue: [['vee', 'The Harbor Kings keep Vell\'s shipping manifests at Berth 9. Paper trail, Sol.'], ['sol', 'Paper burns. Why do we want it?'], ['vee', 'Because it says who got paid.']] },
      { type: 'kill', text: 'Take out the Harbor Kings lookouts', spawn: () => ({ x: 800, z: 454, n: 4, faction: 'kings', weapon: 'pistol', alerted: true }),
        dialogue: [['drey', 'Whoever you are, you picked the wrong pier.']] },
      { type: 'collect', text: 'Grab the shipping manifest', pos: () => at(822, 441), label: 'Shipping manifest' },
      { type: 'lose', text: 'Lose the cops', stars: 2, dialogue: [['dispatch', 'Shots fired, Rustline Docks. All units respond.']] },
      { type: 'goto', text: 'Bring the manifest back to Auntie Vee', pos: () => door('vee'), radius: 2.5 },
    ],
    outro: [['vee', 'Look at that. "Consulting fees — D. Kroll." Our lieutenant is a consultant.']],
  },
  {
    id: 'm3', number: 3, kind: 'story', title: 'Shore Thing', giver: 'tavo', district: 'beach',
    startPos: () => door('vee'),
    reward: { cash: 1600, xp: 360 },
    stages: [
      { type: 'goto', text: 'Meet Tavo at the Sunline Blvd start line', pos: () => raceStart('sunline'), radius: 4, needVehicle: true,
        dialogue: [['vee', 'You need a wheelman who isn\'t you. Tavo races the Strip every sunset.'], ['tavo', 'The famous Sol Arroyo. Beat me and I\'m in. Lose and you buy tacos for a year.']] },
      { type: 'race', text: 'Win the Sunline Sprint', route: 'sunline', mustWin: true, pace: 30 },
      { type: 'goto', text: 'Cool off at Okonkwo Auto Works', pos: () => at(544, 622), radius: 3, needVehicle: true,
        dialogue: [['tavo', 'Okay, okay. You still got it. Call me when you need a fast exit.']] },
    ],
    onComplete: (g) => { g.progression.crew.driver = true; g.hud.notify('Crew unlocked: Tavo (Driver) — press Z for Nitro Run', 'crew'); },
  },
  {
    id: 'm4', number: 4, kind: 'story', title: 'Paper Palms', giver: 'vee', district: 'downtown',
    startPos: () => door('vee'),
    reward: { cash: 2200, xp: 420 },
    stages: [
      { type: 'goto', text: 'Stake out Vell Coastal Tower', pos: () => at(416, 326), radius: 5, needVehicle: true,
        dialogue: [['vee', 'Vell moves deeds by courier van. Old school. Hard to hack, easy to rob.']] },
      { type: 'chase', text: 'Wreck Vell\'s courier van', spawn: () => ({ x: 430, z: 322, type: 'dockrunner', speed: 21, toughness: 1.2, paint: 0x15171c }),
        dialogue: [['vell', 'Route the van through the canal. And tell security to earn their salary.']] },
      { type: 'collect', text: 'Grab the deed papers from the wreck', pos: (g, v) => v.wreckPos || at(430, 322), label: 'Deed papers' },
      { type: 'goto', text: 'Get the deeds to Vee before they\'re missed', pos: () => door('vee'), radius: 3, timer: 120,
        dialogue: [['vee', 'Clock\'s ticking, baby. Two minutes.']] },
    ],
    outro: [['vee', 'Forty storefronts on the Strip, all signed over under "duress." Lovely word.']],
  },
  {
    id: 'm5', number: 5, kind: 'story', title: 'Badge Money', giver: 'pixel', district: 'midtown',
    startPos: () => door('pixel'),
    reward: { cash: 2600, xp: 460 },
    stages: [
      { type: 'goto', text: 'Meet Pixel inside the Static Arcade', pos: () => ({ x: door('pixel').x, z: door('pixel').z - 1 }), radius: 1.8,
        dialogue: [['pixel', 'Kroll\'s cruiser has a dash computer. I want it. You want it. Bring me the car.'], ['sol', 'Steal a cop car. Sure. Classic.']] },
      { type: 'enterVehicle', text: 'Steal the PCPD cruiser outside Precinct 3', as: 'cruiser', spawn: () => ({ type: 'interceptor', x: 360, z: 699.1, yaw: -Math.PI / 2 }) },
      { type: 'goto', text: 'Drive the cruiser to Berth 9 for Pixel', pos: () => at(796, 452), radius: 4, useVehicle: 'cruiser', wanted: 2 },
      { type: 'lose', text: 'Lose the heat', stars: 2 },
    ],
    outro: [['pixel', 'Downloading... oh, Lieutenant. You keep receipts. I\'m in your crew now, Sol.']],
    onComplete: (g) => { g.progression.crew.lookout = true; g.hud.notify('Crew unlocked: Pixel (Lookout) — press C to jam police radios', 'crew'); },
  },
  {
    id: 'm6', number: 6, kind: 'story', title: 'Neon Static', giver: 'pixel', district: 'downtown',
    startPos: () => door('vee'),
    reward: { cash: 3200, xp: 520 },
    stages: [
      { type: 'goto', text: 'Plant relay 1 on Solano St', pos: () => at(327.5, 199.5), radius: 3, timer: 75,
        dialogue: [['pixel', 'Three relays and I can push Kroll\'s receipts onto every billboard in Glasswater.']] },
      { type: 'goto', text: 'Plant relay 2 on Tradewind St', pos: () => at(455.5, 376.5), radius: 3, timer: 60 },
      { type: 'goto', text: 'Plant relay 3 on Flamingo Way', pos: () => at(568.5, 519.5), radius: 3, timer: 60 },
      { type: 'survive', text: 'Defend Pixel\'s uplink at the Static Arcade', pos: () => door('pixel'), radius: 12, timer: 50, timerSucceeds: true, waves: 4, per: 3, faction: 'vell',
        dialogue: [['pixel', 'Uploading. Vell\'s goons are coming — keep them off the door!'], ['vell', 'Find that arcade. Unplug everyone in it.']] },
    ],
    outro: [['pixel', 'Every screen downtown just said "ASK KROLL WHO PAYS HIM." Art.']],
  },
  {
    id: 'm7', number: 7, kind: 'story', title: 'Kroll\'s Due', giver: 'vee', district: 'midtown',
    startPos: () => door('vee'),
    reward: { cash: 4200, xp: 640 },
    stages: [
      { type: 'goto', text: 'Crash Kroll\'s meeting on Kestrel Ave', pos: () => at(586, 600), radius: 5,
        dialogue: [['vee', 'Kroll\'s meeting Vell\'s people in a parking lot. Cops love a parking lot.']] },
      { type: 'kill', text: 'Take out Kroll\'s private security', spawn: () => ({ x: 596, z: 606, n: 6, faction: 'vell', weapon: ['smg', 'pistol'], alerted: true, skill: 0.5 }),
        dialogue: [['kroll', 'Arroyo? You should have stayed in Ohio.']] },
      { type: 'chase', text: 'Run Kroll\'s cruiser off the road', spawn: () => ({ x: 640, z: 600, type: 'interceptor', speed: 25, toughness: 1.5 }), wanted: 3 },
      { type: 'lose', text: 'Shake the whole department', stars: 4 },
    ],
    outro: [['dispatch', 'Lieutenant Kroll is... in custody? Repeat, Kroll is in custody.'], ['vee', 'One down. Now the man with the tower.']],
  },
  {
    id: 'm8', number: 8, kind: 'story', title: 'Last Tide', giver: 'vee', district: 'beach',
    startPos: () => door('vee'),
    reward: { cash: 10000, xp: 1500 },
    stages: [
      { type: 'goto', text: 'Storm the plaza of Vell Coastal Tower', pos: () => at(416, 318), radius: 5,
        dialogue: [['vee', 'The master ledger is in Vell\'s lobby safe. Tonight it walks out the front door.'], ['tavo', 'I\'ve got the boat. Sunset Pier. Don\'t be late.']] },
      { type: 'kill', text: 'Fight through Vell Security', spawn: () => ({ x: 416, z: 320, n: 8, faction: 'vell', weapon: ['smg', 'pistol', 'shotgun'], alerted: true, skill: 0.55, spread: 10 }),
        dialogue: [['vell', 'This city is a view and I own it. You\'re a smudge on the glass.']] },
      { type: 'collect', text: 'Take the master ledger', pos: () => at(420, 313.5), label: 'Master ledger' },
      { type: 'goto', text: 'Escape to the end of Sunset Pier', pos: () => at(PIER_X, PIER_END_Z - 26), radius: 4, wanted: 4, dialogue: [['pixel', 'Every cop in Palmwire is on you. I\'ll jam what I can.']] },
      { type: 'survive', text: 'Hold the pier until Tavo\'s boat arrives', pos: () => at(PIER_X, PIER_END_Z - 22), radius: 14, timer: 40, timerSucceeds: true, waves: 3, per: 3, faction: 'vell' },
    ],
    outro: [['tavo', 'Get in! Next stop: anywhere that isn\'t here!'], ['vee', 'Ledger\'s on every desk at the Courier-Gazette by morning. Welcome home, Sol.']],
    onComplete: (g) => { g.wanted.clear(); g.hud.notify('THE END — Palmwire is still yours to roam', 'crew'); },
  },
];
