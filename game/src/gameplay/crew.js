// Sol's crew and their abilities on hotkeys: Tavo's nitro run (Z), Grease's patch job (X)
// and Pixel's police scanner jam (C), each on its own cooldown.

export const CREW = {
  driver: { member: 'tavo', key: 'KeyZ', label: 'Z', role: 'DRIVER', ability: 'Nitro Run', cooldown: 25, icon: '⚡' },
  mechanic: { member: 'grease', key: 'KeyX', label: 'X', role: 'MECHANIC', ability: 'Patch Job', cooldown: 40, icon: '🔧' },
  lookout: { member: 'pixel', key: 'KeyC', label: 'C', role: 'LOOKOUT', ability: 'Scanner Jam', cooldown: 70, icon: '📡' },
};

export class CrewSystem {
  constructor(game) {
    this.game = game;
    this.cooldowns = { driver: 0, mechanic: 0, lookout: 0 };
  }

  unlocked(slot) { return this.game.progression.crew[slot]; }

  use(slot) {
    const g = this.game, def = CREW[slot];
    if (!this.unlocked(slot)) { g.hud.notify(def.role + ' not in your crew yet', 'warn'); return; }
    if (this.cooldowns[slot] > 0) return;
    const v = g.player.human.vehicle;
    if (slot === 'driver') {
      if (!v) { g.hud.notify('Nitro Run needs a vehicle', 'warn'); return; }
      v.nitro = 6;
      g.hud.say('tavo', 'Punch it, Sol! Bottles are open!');
    } else if (slot === 'mechanic') {
      if (v) { v.repair(); g.hud.say('grease', 'Duct tape and prayer. She\'ll hold.'); }
      else { g.player.human.armour = Math.min(100, g.player.human.armour + 50); g.hud.say('grease', 'Vest\'s patched. Try not to get shot this time.'); }
    } else if (slot === 'lookout') {
      if (g.wanted.stars === 0) { g.hud.notify('No heat to jam', 'warn'); return; }
      g.wanted.jam = 8;
      g.wanted.heat = Math.max(0.4, g.wanted.heat - 1);
      g.wanted.seen = false;
      g.hud.say('pixel', 'Looping their dispatch with a polka station. You\'ve got eight seconds.');
    }
    this.cooldowns[slot] = def.cooldown;
    g.audio && g.audio.sfx.ability();
  }

  update(dt) {
    const input = this.game.input;
    for (const slot of Object.keys(CREW)) {
      this.cooldowns[slot] = Math.max(0, this.cooldowns[slot] - dt);
      if (input.wasPressed(CREW[slot].key)) this.use(slot);
    }
  }
}
