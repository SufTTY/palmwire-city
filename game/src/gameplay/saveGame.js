// Save and continue through localStorage, plus the Palm Court safehouse: walk into the
// door marker to save, heal and sleep until the next morning or golden hour.
import { landmarkDoor } from '../config.js';

const KEY = 'palmwire-save-v1';

export class SaveGame {
  constructor(game) {
    this.game = game;
    this.door = landmarkDoor('safehouse');
    this.marker = null;
    this.inside = false;
    this.lastSaved = null;
  }

  init() {
    this.marker = this.game.markers.add('cylinder', this.door.x, this.door.z, { color: 'save', radius: 1.6, height: 2.5 });
  }

  static exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  snapshot() {
    const g = this.game, p = g.player.human;
    return {
      version: 1,
      savedAt: Date.now(),
      hour: g.day.hour,
      pos: { x: p.pos.x, z: p.pos.z },
      health: p.health, armour: p.armour,
      progression: g.progression.serialize(),
      arsenal: g.player.arsenal.serialize(),
    };
  }

  save(silent = false) {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
      this.lastSaved = Date.now();
      if (!silent) this.game.hud.notify('Game saved', 'save');
      return true;
    } catch (e) {
      this.game.hud.notify('Could not save: storage is unavailable', 'warn');
      return false;
    }
  }

  autosave() { if (!this.game.shotMode) this.save(true); }

  load() {
    let d;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d) return false;
    const g = this.game;
    g.progression.load(d.progression);
    g.player.arsenal.load(d.arsenal);
    g.player.arsenal.unlockFor(g.progression.rank);
    g.player.human.pos.set(d.pos.x, 0, d.pos.z);
    g.player.human.health = d.health ?? 100;
    g.player.human.armour = d.armour ?? 0;
    if (typeof d.hour === 'number') g.day.hour = d.hour;
    return true;
  }

  wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  update() {
    const g = this.game, h = g.player.human;
    const d = Math.hypot(h.pos.x - this.door.x, h.pos.z - this.door.z);
    const now = d < 1.8 && !h.vehicle && h.alive && g.wanted.stars === 0 && !g.missions.active;
    if (now && !this.inside) {
      h.health = 100;
      g.day.hour = g.day.hour > 6 && g.day.hour < 17 ? 17.5 : 8;
      this.save(true);
      g.hud.resultBanner('SAFEHOUSE', 'Game saved · rested until ' + g.day.clockText, '#7fb2ff');
    }
    if (d < 1.8 && g.wanted.stars > 0 && !this.inside) g.hud.hintOnce('safe-heat', 'Lose the cops before using the safehouse');
    this.inside = d < 1.8;
  }
}
