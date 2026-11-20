// Weapon definitions (slots 1-5) and the player's arsenal: ammo, reloads, unlocks.

export const WEAPONS = [
  { id: 'fist', slot: 1, name: 'Fists', melee: true, damage: 22, rate: 0.42, range: 1.8, unlockRank: 0, icon: '✊' },
  { id: 'pistol', slot: 2, name: 'Kestrel 9', damage: 28, rate: 0.26, mag: 12, spread: 0.012, range: 140, recoil: 0.035, pellets: 1, auto: false, unlockRank: 0, startAmmo: 72, sound: 'pistol', icon: 'P' },
  { id: 'smg', slot: 3, name: 'Hornet SMG', damage: 15, rate: 0.075, mag: 30, spread: 0.032, range: 110, recoil: 0.012, pellets: 1, auto: true, unlockRank: 2, startAmmo: 180, sound: 'smg', icon: 'S' },
  { id: 'shotgun', slot: 4, name: 'Breaker 12', damage: 13, rate: 0.85, mag: 6, spread: 0.085, range: 45, recoil: 0.1, pellets: 9, auto: false, unlockRank: 3, startAmmo: 36, sound: 'shotgun', icon: 'G' },
  { id: 'carbine', slot: 5, name: 'Tidewater C7', damage: 31, rate: 0.11, mag: 30, spread: 0.014, range: 180, recoil: 0.016, pellets: 1, auto: true, unlockRank: 5, startAmmo: 150, sound: 'rifle', icon: 'R' },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export class Arsenal {
  constructor() {
    this.current = 'fist';
    this.owned = { fist: true, pistol: true };
    this.ammo = {};
    for (const w of WEAPONS) if (!w.melee) this.ammo[w.id] = { mag: w.mag, reserve: w.id === 'pistol' ? w.startAmmo : 0 };
    this.cooldown = 0;
    this.reloading = 0;
  }

  get weapon() { return WEAPON_BY_ID[this.current]; }

  unlockFor(rank) {
    const fresh = [];
    for (const w of WEAPONS) {
      if (!this.owned[w.id] && rank >= w.unlockRank) {
        this.owned[w.id] = true;
        this.ammo[w.id].reserve += w.startAmmo;
        fresh.push(w);
      }
    }
    return fresh;
  }

  select(id) {
    if (!this.owned[id] || this.current === id) return false;
    this.current = id;
    this.reloading = 0;
    this.cooldown = Math.max(this.cooldown, 0.25);
    return true;
  }

  selectSlot(slot) {
    const w = WEAPONS.find((x) => x.slot === slot);
    return w ? this.select(w.id) : false;
  }

  cycle(dir) {
    const owned = WEAPONS.filter((w) => this.owned[w.id]);
    const i = owned.findIndex((w) => w.id === this.current);
    this.select(owned[(i + dir + owned.length) % owned.length].id);
  }

  addAmmo(id, n) { if (this.ammo[id]) this.ammo[id].reserve += n; }

  /** Returns true if a shot can be fired now (and consumes a round). */
  tryFire() {
    const w = this.weapon;
    if (this.cooldown > 0 || this.reloading > 0) return false;
    if (w.melee) { this.cooldown = w.rate; return true; }
    const a = this.ammo[w.id];
    if (a.mag <= 0) { this.startReload(); return false; }
    a.mag--;
    this.cooldown = w.rate;
    if (a.mag === 0) this.startReload();
    return true;
  }

  startReload() {
    const w = this.weapon;
    if (w.melee) return;
    const a = this.ammo[w.id];
    if (a.mag >= w.mag || a.reserve <= 0 || this.reloading > 0) return;
    this.reloading = w.id === 'shotgun' ? 1.6 : 1.2;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const w = this.weapon, a = this.ammo[w.id];
        if (a) { const n = Math.min(w.mag - a.mag, a.reserve); a.mag += n; a.reserve -= n; }
      }
    }
  }

  serialize() { return { current: this.current, owned: this.owned, ammo: this.ammo }; }
  load(d) {
    if (!d) return;
    Object.assign(this.owned, d.owned || {});
    for (const [k, v] of Object.entries(d.ammo || {})) if (this.ammo[k]) Object.assign(this.ammo[k], v);
    if (this.owned[d.current]) this.current = d.current;
  }
}
