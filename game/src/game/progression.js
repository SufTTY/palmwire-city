// Money, respect and rank, unlocks earned through the story, and lifetime stats.

export const RANKS = [
  { at: 0, title: 'Nobody' },
  { at: 100, title: 'Street Rat' },
  { at: 300, title: 'Wheelman' },
  { at: 650, title: 'Fixer' },
  { at: 1100, title: 'Shot Caller' },
  { at: 1800, title: 'Tide Queen' },
];

export class Progression {
  constructor(G) {
    this.G = G;
    this.cash = 500;
    this.respect = 0;
    this.completed = new Set();
    this.unlocks = { smg: false, shotgun: false, armour: false, garageCar: false };
    this.stats = { kills: 0, carsStolen: 0, missions: 0, sideJobs: 0, bestRace: null };
    G.events.on('characterKilled', (e) => {
      if (e.attacker === G.player.char) this.stats.kills++;
    });
    G.events.on('playerEnteredVehicle', () => { this.stats.carsStolen++; });
  }

  get rankIndex() {
    let r = 0;
    RANKS.forEach((k, i) => { if (this.respect >= k.at) r = i; });
    return r;
  }
  get rank() { return RANKS[this.rankIndex].title; }
  get nextRank() { return RANKS[this.rankIndex + 1] || null; }

  addCash(n, reason) {
    this.cash = Math.max(0, Math.round(this.cash + n));
    if (this.G.hud) this.G.hud.cashPopup(n, reason);
  }

  addRespect(n) {
    const before = this.rankIndex;
    this.respect += n;
    if (this.rankIndex > before && this.G.hud) this.G.hud.notify(`Rank up: ${this.rank}`, 4);
  }

  unlock(key) {
    if (this.unlocks[key]) return;
    this.unlocks[key] = true;
    const G = this.G;
    const names = { smg: 'Hornet SMG added to your arsenal', shotgun: 'Breaker 12 shotgun added to your arsenal', armour: 'Body armour now restocks at the safehouse', garageCar: 'A Vireo GT now waits outside the safehouse' };
    if (G.hud) G.hud.notify(names[key] || key, 5);
    if (key === 'smg') G.player.giveWeapon('smg', 150);
    if (key === 'shotgun') G.player.giveWeapon('shotgun', 30);
  }

  serialize() {
    return {
      cash: this.cash, respect: this.respect, completed: [...this.completed], unlocks: { ...this.unlocks }, stats: { ...this.stats },
    };
  }

  load(d) {
    if (!d) return;
    this.cash = d.cash ?? 500;
    this.respect = d.respect ?? 0;
    this.completed = new Set(d.completed || []);
    Object.assign(this.unlocks, d.unlocks || {});
    Object.assign(this.stats, d.stats || {});
  }
}
