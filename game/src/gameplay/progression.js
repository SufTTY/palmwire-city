// Money, respect and rank, standing in each district, garage upgrade levels, unlocked crew
// and completed missions: everything that persists between sessions.
import { DISTRICTS } from '../config.js';

export const RANKS = [
  { xp: 0, title: 'Fresh Off The Bus' },
  { xp: 300, title: 'Street Runner' },
  { xp: 800, title: 'Hustler' },
  { xp: 1600, title: 'Wheelman' },
  { xp: 2800, title: 'Enforcer' },
  { xp: 4400, title: 'Lieutenant' },
  { xp: 6500, title: 'Boss of the Strip' },
  { xp: 9500, title: 'Palmwire Legend' },
];

export const UPGRADES = {
  engine: { name: 'Engine Tune', desc: '+7% top speed, +10% acceleration per level', cost: [900, 1800, 3200] },
  tires: { name: 'Track Tyres', desc: '+8% grip per level for tighter drifts', cost: [700, 1400, 2600] },
  armor: { name: 'Plated Body', desc: '-15% collision and gunfire damage per level', cost: [1000, 2000, 3500] },
};

export class Progression {
  constructor(game) {
    this.game = game;
    this.cash = 350;
    this.xp = 0;
    this.standing = Object.fromEntries(Object.keys(DISTRICTS).map((k) => [k, 0]));
    this.garage = { engine: 0, tires: 0, armor: 0 };
    this.crew = { driver: false, mechanic: false, lookout: false };
    this.missionsDone = [];
    this.sideDone = {};
    this.stats = { kills: 0, carsStolen: 0, racesWon: 0, jobsDone: 0, evaded: 0, busted: 0, wasted: 0 };
    this.safehouse = false;
    const ev = game.events;
    ev.on('death', (e) => { if (e.attacker && e.attacker.role === 'player') this.stats.kills++; });
    ev.on('enteredVehicle', () => { this.stats.carsStolen++; });
    ev.on('evaded', () => { this.stats.evaded++; this.addXP(25 * Math.max(1, this.game.wanted.lastStars || 1)); });
  }

  get rank() {
    let r = 0;
    for (let i = 0; i < RANKS.length; i++) if (this.xp >= RANKS[i].xp) r = i;
    return r;
  }
  get rankTitle() { return RANKS[this.rank].title; }
  get rankProgress() {
    const r = this.rank;
    if (r >= RANKS.length - 1) return 1;
    return (this.xp - RANKS[r].xp) / (RANKS[r + 1].xp - RANKS[r].xp);
  }
  get respectLabel() { return Math.floor(this.xp).toLocaleString('en-US') + ' RP'; }

  addCash(n, notify = true) {
    this.cash = Math.max(0, this.cash + n);
    if (notify && n) this.game.hud && this.game.hud.cashPop(n);
  }

  addXP(n, district = null) {
    const before = this.rank;
    this.xp += n;
    if (district && this.standing[district] !== undefined) this.standing[district] = Math.min(100, this.standing[district] + Math.round(n / 12));
    const after = this.rank;
    if (after > before) {
      const fresh = this.game.player.arsenal.unlockFor(after);
      this.game.events.emit('rankUp', { rank: after, title: RANKS[after].title, weapons: fresh });
    }
  }

  canAfford(n) { return this.cash >= n; }

  buyUpgrade(key) {
    const lvl = this.garage[key];
    const cost = UPGRADES[key].cost[lvl];
    if (cost === undefined || this.cash < cost) return false;
    this.cash -= cost;
    this.garage[key]++;
    return true;
  }

  serialize() {
    return { cash: this.cash, xp: this.xp, standing: this.standing, garage: this.garage, crew: this.crew, missionsDone: this.missionsDone, sideDone: this.sideDone, stats: this.stats };
  }
  load(d) {
    if (!d) return;
    this.cash = d.cash ?? this.cash; this.xp = d.xp ?? 0;
    Object.assign(this.standing, d.standing || {});
    Object.assign(this.garage, d.garage || {});
    Object.assign(this.crew, d.crew || {});
    this.missionsDone = d.missionsDone || [];
    this.sideDone = d.sideDone || {};
    Object.assign(this.stats, d.stats || {});
  }
}
