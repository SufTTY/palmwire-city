// Things to pick up: dropped cash, ammo boxes, health and armour, and mission packages.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

const KIND_STYLE = {
  cash: { color: 0x3ddc84, size: [0.45, 0.2, 0.3] },
  ammo: { color: 0xd4a017, size: [0.5, 0.3, 0.35] },
  health: { color: 0xff3b3b, size: [0.45, 0.45, 0.45] },
  armour: { color: 0x3b8bff, size: [0.55, 0.4, 0.2] },
  package: { color: 0xffc83d, size: [0.6, 0.45, 0.45] },
};

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.time = 0;
    this.geos = {};
    this.mats = {};
    for (const [k, s] of Object.entries(KIND_STYLE)) {
      this.geos[k] = new THREE.BoxGeometry(...s.size);
      this.mats[k] = new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 0.6, roughness: 0.4 });
    }
    game.events.on('death', (e) => {
      const h = e.human;
      if (h.role === 'player') return;
      if (h.role === 'ped' && Math.random() < 0.55) this.spawn('cash', h.pos.x + 0.5, h.pos.z, { amount: 10 + Math.floor(Math.random() * 50) });
      if (h.role === 'cop' || h.role === 'gang') {
        if (Math.random() < 0.7) this.spawn('ammo', h.pos.x + 0.4, h.pos.z + 0.3, { amount: 1 });
        if (Math.random() < 0.4) this.spawn('cash', h.pos.x - 0.4, h.pos.z, { amount: 40 + Math.floor(Math.random() * 80) });
      }
    });
  }

  spawn(kind, x, z, data = {}) {
    const mesh = new THREE.Mesh(this.geos[kind], this.mats[kind]);
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = true;
    this.game.scene.add(mesh);
    const p = { kind, x, z, mesh, data, life: data.permanent ? Infinity : 45 };
    this.list.push(p);
    return p;
  }

  remove(p) {
    this.game.scene.remove(p.mesh);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  collect(p) {
    const g = this.game, pl = g.player;
    switch (p.kind) {
      case 'cash': g.progression.addCash(p.data.amount, false); g.hud.pickupText('+$' + p.data.amount); break;
      case 'ammo': {
        const owned = WEAPONS.filter((w) => !w.melee && pl.arsenal.owned[w.id]);
        for (const w of owned) pl.arsenal.addAmmo(w.id, Math.ceil(w.mag * 0.6));
        g.hud.pickupText('Ammo'); break;
      }
      case 'health': pl.human.health = Math.min(100, pl.human.health + 40); g.hud.pickupText('+Health'); break;
      case 'armour': pl.human.armour = Math.min(100, pl.human.armour + 50); g.hud.pickupText('+Armour'); break;
      case 'package': g.events.emit('packageCollected', { pickup: p }); g.hud.pickupText(p.data.label || 'Package'); break;
      default: break;
    }
    g.audio && g.audio.sfx.pickup();
    this.remove(p);
  }

  update(dt) {
    this.time += dt;
    const h = this.game.player.human;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.remove(p); continue; }
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.6 + Math.sin(this.time * 3 + i) * 0.12;
      const reach = h.vehicle ? 2.6 : 1.4;
      const pos = h.vehicle ? h.vehicle.pos : h.pos;
      if (h.alive && Math.hypot(pos.x - p.x, pos.z - p.z) < reach && (!h.vehicle || p.kind === 'package' || p.kind === 'cash')) this.collect(p);
    }
  }
}
