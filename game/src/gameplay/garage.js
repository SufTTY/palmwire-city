// Okonkwo Auto Works: drive into the forecourt to open the garage, buy engine, tyre and
// armour upgrades, repair, and respray (a fresh paint job also cools a low wanted level).
import { paintMaterial } from '../actors/vehicleModels.js';

export const GARAGE_SPOT = { x: 544, z: 622 };
export const RESPRAY_COLORS = [0xe63946, 0xff9f1c, 0xffd60a, 0x2ec4b6, 0x3a86ff, 0x9b5de5, 0xff4fa3, 0xf8f9fa, 0x14213d, 0x111111];

export class Garage {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.marker = null;
    this.wasInside = false;
  }

  get unlocked() { return this.game.progression.missionsDone.includes('m1'); }

  init() {
    this.marker = this.game.markers.add('cylinder', GARAGE_SPOT.x, GARAGE_SPOT.z, { color: 'garage', radius: 3.2, height: 2 });
  }

  update() {
    const g = this.game, v = g.player.human.vehicle;
    const inside = v && Math.hypot(v.pos.x - GARAGE_SPOT.x, v.pos.z - GARAGE_SPOT.z) < 5 && v.speed < 3;
    if (inside && !this.wasInside && !g.missions.active) {
      if (!this.unlocked) g.hud.hintOnce('garage-locked', 'Grease isn\'t open for business yet — talk to Auntie Vee');
      else this.show();
    }
    this.wasInside = inside;
  }

  show() {
    this.open = true;
    this.game.ui.garageMenu.show();
  }

  close() { this.open = false; }

  repairCost(v) { return Math.round((1 - v.health / v.maxHealth) * 300); }

  repair() {
    const g = this.game, v = g.player.human.vehicle;
    if (!v) return false;
    const c = this.repairCost(v);
    if (!g.progression.canAfford(c)) return false;
    g.progression.addCash(-c, false);
    v.repair();
    return true;
  }

  respray(color) {
    const g = this.game, v = g.player.human.vehicle;
    if (!v || !g.progression.canAfford(150)) return false;
    g.progression.addCash(-150, false);
    v.paint = color;
    v.model.paintMesh.material = paintMaterial(color);
    if (g.wanted.stars > 0 && g.wanted.stars <= 2 && !g.wanted.seen) { g.wanted.clear(); g.hud.notify('Fresh paint — the cops lost your description', 'info'); }
    return true;
  }
}
