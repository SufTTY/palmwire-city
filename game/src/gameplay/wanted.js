// The five-star wanted level: crimes raise heat when witnessed, police sightings refresh the
// last known position, and breaking line of sight outside the search circle lets it cool off.

const CRIME_HEAT = {
  theft: 0.6, carjack: 1.05, gunfire: 0.7, assault: 0.5, pedHit: 0.7, pedKill: 1.1,
  copHurt: 1.2, copKill: 1.7, copcar: 1.4, explosion: 1.0, gangKill: 0.25, missionHeat: 0,
};

export class WantedSystem {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.seen = false;
    this.unseenTime = 0;
    this.lkp = { x: 0, z: 0 };
    this.jam = 0;            // lookout ability: police radios scrambled
    this.lastGunfireCrime = -10;
    this.minStars = 0;       // missions can force a floor
    this.flash = 0;
    this.status = '';
    this.evadedFlash = 0;
    const ev = game.events;
    ev.on('crime', (c) => this.crime(c.type, c.x, c.z, c.force));
    ev.on('gunshot', (e) => {
      if (!e.shooter || e.shooter.role !== 'player') return;
      if (this.game.time - this.lastGunfireCrime > 4) { this.lastGunfireCrime = this.game.time; this.crime('gunfire', e.x, e.z); }
    });
    ev.on('humanShot', (e) => {
      if (!e.shooter || e.shooter.role !== 'player') return;
      const r = e.human.role;
      if (r === 'cop') this.crime(e.killed ? 'copKill' : 'copHurt', e.human.pos.x, e.human.pos.z, true);
      else if (r === 'ped') this.crime(e.killed ? 'pedKill' : 'assault', e.human.pos.x, e.human.pos.z);
      else if (r === 'gang' && e.killed) this.crime('gangKill', e.human.pos.x, e.human.pos.z);
    });
    ev.on('humanHitByVehicle', (e) => {
      if (!e.driver || e.driver.role !== 'player') return;
      const r = e.human.role;
      if (r === 'cop') this.crime(e.killed ? 'copKill' : 'copHurt', e.human.pos.x, e.human.pos.z, true);
      else if (r === 'ped') this.crime(e.killed ? 'pedKill' : 'pedHit', e.human.pos.x, e.human.pos.z);
    });
    ev.on('vehicleCrash', (e) => {
      const pv = this.game.player.human.vehicle;
      if (!pv || e.impact < 8) return;
      const other = e.a === pv ? e.b : e.b === pv ? e.a : null;
      if (other && other.isPolice) this.crime('copHurt', other.pos.x, other.pos.z, true);
    });
  }

  get stars() {
    if (this.heat <= 0.05) return 0;
    return Math.max(1, Math.min(5, Math.floor(this.heat + 0.35)));
  }

  /** Is there a witness: police in sight, or civilians nearby? */
  witnessed(x, z) {
    const g = this.game;
    if (g.police.anyUnitSees(x, z, 70)) return true;
    let civ = 0;
    for (const p of g.peds.list) if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 32) civ++;
    return civ > 0;
  }

  crime(type, x, z, force = false) {
    const add = CRIME_HEAT[type] ?? 0.5;
    if (!add) return;
    if (!force && !this.witnessed(x, z)) return;
    const before = this.stars;
    this.heat = Math.min(5, this.heat + add * (this.heat >= 3 ? 0.6 : 1));
    this.lkp = { x, z };
    this.seen = true;
    this.unseenTime = 0;
    if (this.stars > before) {
      this.flash = 1.5;
      this.game.events.emit('wantedUp', { stars: this.stars });
    }
  }

  /** Force a level (missions, screenshots). */
  setStars(n) {
    this.heat = n;
    const f = this.game.player.focus;
    this.lkp = { x: f.x, z: f.z };
    this.seen = true;
    this.unseenTime = 0;
  }

  clear() { this.heat = 0; this.seen = false; this.unseenTime = 0; }

  get searchRadius() { return 70 + this.stars * 28; }

  update(dt) {
    const g = this.game;
    this.flash = Math.max(0, this.flash - dt);
    this.evadedFlash = Math.max(0, this.evadedFlash - dt);
    this.jam = Math.max(0, this.jam - dt);
    if (this.heat < this.minStars) this.setStars(this.minStars);
    if (this.stars === 0) { this.status = ''; return; }
    const f = g.player.focus;
    const sees = this.jam <= 0 && g.police.anyUnitSees(f.x, f.z, g.police.heliActive ? 150 : 85);
    if (sees) {
      this.seen = true;
      this.unseenTime = 0;
      this.lkp = { x: f.x, z: f.z };
    } else {
      this.seen = false;
      this.unseenTime += dt;
      const outside = Math.hypot(f.x - this.lkp.x, f.z - this.lkp.z) > this.searchRadius;
      const need = (outside ? 5 : 14) + this.stars * (outside ? 1.8 : 3);
      if (this.unseenTime > need && this.minStars === 0) {
        this.heat = 0;
        this.unseenTime = 0;
        this.evadedFlash = 3;
        g.events.emit('evaded', {});
      }
    }
    if (this.jam > 0) this.status = 'RADIO JAMMED';
    else if (this.seen) this.status = g.police.heliActive ? 'IN SIGHT · AIR UNIT DEPLOYED' : 'IN SIGHT';
    else this.status = g.police.heliActive ? 'SEARCHING · AIR UNIT DEPLOYED' : 'SEARCHING';
  }

  serialize() { return {}; }
}
