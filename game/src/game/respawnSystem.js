// What happens when it goes wrong: FLATLINED (killed - wake up at Palmwire General minus the
// hospital bill) or CUFFED (arrested - released from the Mirador precinct minus a bribe and
// most of your ammo). Either one fails the active mission and clears the wanted level.

export class RespawnSystem {
  constructor(G) {
    this.G = G;
    this.timer = 0;
    this.kind = null;
    G.events.on('characterKilled', (e) => {
      if (e.victim === G.player.char && !this.kind) this.flatlined();
    });
  }

  flatlined() {
    const G = this.G;
    this.kind = 'dead';
    this.timer = 4.5;
    G.state = 'dead';
    G.timeScale = 0.35;
    G.hud.showBigMessage('FLATLINED', 'dead', 'Hospital bill: $' + Math.min(G.prog.cash, 300));
    if (G.missions) G.missions.fail('You were flatlined');
    if (G.player.vehicle) G.player.exitVehicle(false);
  }

  busted() {
    const G = this.G;
    if (this.kind) return;
    this.kind = 'busted';
    this.timer = 4.5;
    G.state = 'busted';
    G.timeScale = 0.5;
    const fine = Math.max(100, Math.floor(G.prog.cash * 0.1));
    G.hud.showBigMessage('CUFFED', 'busted', `Bail and "fees": $${Math.min(G.prog.cash, fine)}  ·  weapons confiscated`);
    if (G.missions) G.missions.fail('You got cuffed');
    if (G.player.vehicle) {
      G.player.vehicle.controls.throttle = 0;
    }
    this.fine = fine;
  }

  update(dt) {
    if (!this.kind) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const G = this.G;
    const p = G.player;
    const L = G.landmarks;
    if (p.vehicle) p.exitVehicle(false);
    const spot = this.kind === 'dead' ? L.hospital.door : L.police.door;
    if (this.kind === 'dead') G.prog.addCash(-Math.min(G.prog.cash, 300), 'hospital');
    else {
      G.prog.addCash(-Math.min(G.prog.cash, this.fine), 'bail');
      for (const k of ['smg', 'shotgun']) { p.inventory[k].reserve = 0; p.inventory[k].mag = 0; }
      p.inventory.pistol.reserve = Math.min(p.inventory.pistol.reserve, 24);
    }
    const ch = p.char;
    ch.alive = true;
    ch.health = ch.maxHealth;
    ch.armour = 0;
    ch.knockT = 0;
    ch.deathT = 0;
    ch.vel.set(0, 0, 0);
    ch.pos.set(spot.x, spot.y, spot.z + 3);
    ch.heading = 0;
    ch.model.root.rotation.set(0, 0, 0);
    p.selectWeapon('fists');
    G.wanted.clear();
    G.police.clearAll();
    G.gangs.clear();
    G.timeScale = 1;
    G.state = 'play';
    G.cam.snapBehind();
    G.hud.hideBigMessage();
    G.sky.setTime(G.sky.tod + 2);
    this.kind = null;
  }
}
