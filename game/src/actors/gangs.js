// Hostile crews for missions and rampages: the Harbor Kings of the docks and Vell Coastal's
// private security. They idle until they spot the player or hear shots, then fight.
import { Human } from './human.js';
import { CombatAI } from './combatAI.js';

export const FACTIONS = {
  kings: { name: 'Harbor Kings', looks: [0xc0602a, 0xd9822b, 0x8c3b1e], pants: 0x2b2b2b, cap: 0x1e1e1e },
  vell: { name: 'Vell Security', looks: [0x15171c, 0x22252c], pants: 0x101114, cap: null },
  saints: { name: 'Neon Saints', looks: [0xb45cf0, 0x6a2fd0], pants: 0x1a1030, cap: 0xff4fa3 },
};

export class GangSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    game.events.on('gunshot', (e) => {
      for (const h of this.list) if (h.alive && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 45) h.alerted = true;
    });
    game.events.on('humanShot', (e) => { if (e.human.role === 'gang') this.alertGroup(e.human.tag); });
  }

  spawnCrew(x, z, n, { faction = 'kings', weapon = 'pistol', tag = 'mission', health = 80, spread = 6, skill = 0.45, alerted = false } = {}) {
    const f = FACTIONS[faction];
    const crew = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * spread * (0.4 + (i % 2) * 0.6), pz = z + Math.sin(a) * spread * (0.4 + (i % 2) * 0.6);
      const look = { skin: [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69, 0x6b4226][i % 5], hair: 0x111111, shirt: f.looks[i % f.looks.length], pants: f.pants, cap: f.cap };
      const h = new Human(this.game, { x: px, z: pz, role: 'gang', look, health });
      h.faction = faction;
      h.tag = tag;
      h.alerted = alerted;
      h.yaw = a + Math.PI;
      const w = Array.isArray(weapon) ? weapon[i % weapon.length] : weapon;
      h.combat = new CombatAI(this.game, h, { weapon: w, skill, damageMul: 0.42, range: [8, 18] });
      this.list.push(h);
      crew.push(h);
    }
    return crew;
  }

  alertGroup(tag) { for (const h of this.list) if (h.tag === tag) h.alerted = true; }

  aliveWithTag(tag) { return this.list.filter((h) => h.tag === tag && h.alive); }

  clear(tag = null) { this.list = this.list.filter((h) => (tag ? h.tag !== tag : false)); }

  update(dt) {
    const g = this.game, player = g.player.human;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      if (!h.alive) {
        h.deadTime += dt;
        if (h.deadTime > 40 && Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z) > 50) this.list.splice(i, 1);
        continue;
      }
      if (!h.alerted) {
        const d = Math.hypot(h.pos.x - g.player.focus.x, h.pos.z - g.player.focus.z);
        if (d < 24 && !g.colliders.blocked(h.pos.x, h.pos.z, g.player.focus.x, g.player.focus.z)) h.alerted = true;
        h.locomote(dt, 0, 0);
        h.pose = 'idle';
        h.phase += dt;
        continue;
      }
      h.combat.update(dt, player);
    }
  }
}
