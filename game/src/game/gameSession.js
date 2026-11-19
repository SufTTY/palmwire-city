// Session flow: the title screen fly-over, starting a new game or continuing a save, pausing
// (Esc, M or losing mouse capture) and resuming.
import * as THREE from 'three';
import { loadGame } from './saveGame.js';
import { CELL } from '../world/cityLayout.js';

export class GameSession {
  constructor(G) {
    this.G = G;
    this.flyT = 0;
  }

  showTitle() {
    const G = this.G;
    G.state = 'title';
    G.hud.setVisible(false);
    G.menus.showTitle();
    G.player.char.model.root.visible = false;
    G.player.char.pos.set(6.5 * CELL, 0.15, 5.5 * CELL);
    G.sky.setTime(17.3);
  }

  /** Slow orbit over Halcyon downtown, used behind the title menu. */
  updateFlyover(dt) {
    const G = this.G;
    this.flyT += dt * 0.035;
    const c = new THREE.Vector3(7.5 * CELL, 20, 6 * CELL);
    const r = 340;
    const pos = new THREE.Vector3(c.x + Math.cos(this.flyT) * r, 95 + Math.sin(this.flyT * 0.7) * 15, c.z + Math.sin(this.flyT) * r);
    G.cam.override = { pos, look: c, fov: 55 };
  }

  begin(fromSave) {
    const G = this.G;
    G.audio.init();
    G.menus.clear();
    G.cam.override = null;
    const L = G.landmarks;
    const p = G.player;
    p.char.pos.set(L.safehouse.door.x, L.safehouse.door.y, L.safehouse.door.z + 2);
    p.char.heading = 0;
    p.char.model.root.visible = true;
    if (fromSave) {
      const d = loadGame();
      if (d) {
        G.prog.load(d.progression);
        G.sky.setTime(d.tod ?? 16.5);
        if (d.player) {
          p.char.health = d.player.health || 100;
          p.char.armour = d.player.armour || 0;
          Object.assign(p.inventory, d.player.inventory || {});
          p.selectWeapon(d.player.weapon || 'pistol');
        }
        G.hud.notify(`Welcome back, Rae. ${G.prog.completed.size} jobs done.`, 4);
      }
    } else {
      G.sky.setTime(16.4);
      G.hud.notify('Palmwire City. Three years gone, and the sun still sets over the Strand.', 5);
      G.hud.notify('Auntie Coral is waiting at Suds & Sons — follow the purple GPS route.', 6);
    }
    // a ride outside the safehouse
    const ride = G.vehicles.spawn(G.prog.unlocks.garageCar ? 'sports' : 'hatch', { x: L.safehouse.parking.x, z: L.safehouse.parking.z, heading: Math.PI / 2, mode: 'parked', paint: 0xf25c54 });
    ride.owned = true;
    G.state = 'play';
    G.hud.setVisible(true);
    G.radio.playTitleTheme(false);
    G.cam.snapBehind();
    G.input.requestLock();
  }

  pause() {
    const G = this.G;
    if (G.state !== 'play' && G.state !== 'cutscene') return;
    G.prevState = G.state;
    G.state = 'paused';
    G.menus.showPause();
    G.input.releaseLock();
    if (G.audio.world) G.audio.setHorn(false);
  }

  resume() {
    const G = this.G;
    if (G.state !== 'paused') return;
    G.state = G.prevState || 'play';
    G.menus.clear();
    G.input.requestLock();
  }

  quitToTitle() {
    window.location.reload();
  }
}
