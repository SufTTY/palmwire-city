// WASTED and BUSTED: slow-motion fade, the consequence (hospital bill or confiscated
// weapons and a fine), then a respawn at St. Marisol Medical or Precinct 3.
import { landmarkDoor } from '../config.js';

export class RespawnSystem {
  constructor(game) {
    this.game = game;
    this.active = null;   // { kind, t }
    game.events.on('death', (e) => { if (e.human.role === 'player') this.begin('wasted'); });
    game.events.on('busted', () => this.begin('busted'));
  }

  begin(kind) {
    if (this.active) return;
    const g = this.game;
    this.active = { kind, t: 0 };
    g.player.controlsLocked = true;
    g.hud.deathScreen(kind);
    g.audio && g.audio.sfx.wasted();
    if (kind === 'busted') g.player.human.pose = 'hands';
  }

  finish() {
    const g = this.game, p = g.player, kind = this.active.kind;
    if (p.human.vehicle) p.exitVehicle(false);
    const fee = Math.min(g.progression.cash, kind === 'wasted' ? 250 : 400);
    g.progression.addCash(-fee, false);
    let lost = '';
    if (kind === 'busted') {
      for (const id of Object.keys(p.arsenal.ammo)) { p.arsenal.ammo[id].reserve = Math.floor(p.arsenal.ammo[id].reserve * 0.3); }
      lost = ' · ammo confiscated';
      g.progression.stats.busted++;
    } else g.progression.stats.wasted++;
    const door = landmarkDoor(kind === 'wasted' ? 'hospital' : 'police');
    p.human.pos.set(door.x, 0.15, door.z + 1);
    p.human.alive = true;
    p.human.health = 100;
    p.human.armour = 0;
    p.human.pose = 'idle';
    p.human.downTimer = 0;
    p.human.vel.set(0, 0, 0);
    p.controlsLocked = false;
    p.arsenal.select('fist');
    g.wanted.clear();
    g.police.clearAll();
    g.hud.hideDeathScreen();
    g.hud.notify((kind === 'wasted' ? 'Hospital bill' : 'Bail and fines') + ': -$' + fee + lost, 'warn');
    g.cameraRig.first = true;
    this.active = null;
  }

  update(dt) {
    if (!this.active) return 1;
    this.active.t += dt;
    if (this.active.t > 4.2) this.finish();
    return this.active && this.active.t < 2.5 ? 0.35 : 1; // time scale for slow motion
  }
}
