// Spinning pickups: health, body armour, ammo and dropped cash. Fixed pickups respawn a minute
// after being taken; cash dropped by the fallen fades after half a minute.
import * as THREE from 'three';
import { MeshBuilder } from '../world/meshBuilder.js';
import { makeGlowSprite } from '../entities/vehicleModel.js';
import { CELL } from '../world/cityLayout.js';

const KINDS = {
  health: { color: 0x3ddc84, glow: 0x3ddc84 },
  armour: { color: 0x3d8bff, glow: 0x5aa0ff },
  ammo: { color: 0xd9b23a, glow: 0xffd060 },
  cash: { color: 0x58c75a, glow: 0x9dff8a },
};

function pickupGeometry(kind) {
  const b = new MeshBuilder();
  if (kind === 'health') {
    b.box(0, 0, 0, 0.7, 0.22, 0.22, 0x3ddc84);
    b.box(0, 0, 0, 0.22, 0.7, 0.22, 0x3ddc84);
  } else if (kind === 'armour') {
    b.box(0, 0, 0, 0.55, 0.65, 0.2, 0x2f6fd8);
    b.box(0, 0.25, 0, 0.6, 0.12, 0.22, 0x1d4a9a);
  } else if (kind === 'ammo') {
    b.box(0, 0, 0, 0.6, 0.35, 0.35, 0x6b6b3a);
    b.box(0, 0.19, 0, 0.62, 0.06, 0.37, 0xd9b23a);
  } else {
    b.box(0, 0, 0, 0.55, 0.12, 0.3, 0x4fae52);
    b.box(0, 0.12, 0, 0.55, 0.12, 0.3, 0x58c75a);
    b.box(0, 0.06, 0, 0.12, 0.26, 0.31, 0xf4f4e8);
  }
  return b.build();
}

export class PickupSystem {
  constructor(G) {
    this.G = G;
    this.items = [];
    this.geos = {};
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0x222222 });
    const L = G.landmarks;
    const fixed = [
      ['health', L.hospital.door.x + 4, L.hospital.door.z + 2],
      ['armour', L.police.door.x - 4, L.police.door.z + 2],
      ['ammo', L.garage.door.x + 5, L.garage.door.z + 2],
      ['health', L.safehouse.door.x - 3, L.safehouse.door.z + 1.5],
      // on sidewalks: 0.1 of a cell = 8 m from the road centre line
      ['health', 7.5 * CELL, 5.1 * CELL], ['ammo', 6.1 * CELL, 8.5 * CELL], ['armour', 4.5 * CELL, 12.1 * CELL],
      ['health', 13.9 * CELL, 9.5 * CELL], ['ammo', 10.1 * CELL, 2.5 * CELL], ['health', 2.1 * CELL, 9.5 * CELL],
      ['ammo', 8.5 * CELL, 13.1 * CELL], ['armour', 12.5 * CELL, 4.1 * CELL],
    ];
    for (const [k, x, z] of fixed) this.spawn(k, x, z, { respawn: 60 });
  }

  spawn(kind, x, z, { respawn = 0, amount = 0, ttl = 0 } = {}) {
    const G = this.G;
    if (!this.geos[kind]) this.geos[kind] = pickupGeometry(kind);
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(this.geos[kind], this.mat);
    mesh.position.y = 0.8;
    group.add(mesh);
    const glow = makeGlowSprite(KINDS[kind].glow, 1.8);
    glow.position.y = 0.8;
    group.add(glow);
    const y = G.layout.groundHeight(x, z);
    group.position.set(x, y, z);
    G.scene.add(group);
    const item = { kind, x, z, group, mesh, respawn, amount, ttl, active: true, timer: 0, phase: Math.random() * 6 };
    this.items.push(item);
    return item;
  }

  dropCash(x, z, amount) {
    this.spawn('cash', x, z, { amount, ttl: 30 });
  }

  collect(item) {
    const G = this.G;
    const p = G.player;
    const ch = p.char;
    if (item.kind === 'health') {
      if (ch.health >= ch.maxHealth) return false;
      ch.health = Math.min(ch.maxHealth, ch.health + 50);
      G.hud.notify('+50 health');
    } else if (item.kind === 'armour') {
      if (ch.armour >= 100) return false;
      ch.armour = 100;
      G.hud.notify('Body armour');
    } else if (item.kind === 'ammo') {
      const w = p.weapon === 'fists' ? 'pistol' : p.weapon;
      const amt = { pistol: 24, smg: 60, shotgun: 12 }[w];
      p.inventory[w].reserve += amt;
      G.hud.notify(`+${amt} ${w === 'pistol' ? 'Vesper 9' : w === 'smg' ? 'Hornet SMG' : 'Breaker 12'} rounds`);
    } else if (item.kind === 'cash') {
      G.prog.addCash(item.amount, 'pickup');
      G.audio && G.audio.sfx.cash();
      return true;
    }
    G.audio && G.audio.sfx.pickup();
    return true;
  }

  update(dt, time) {
    const G = this.G;
    const pp = G.player.pos;
    const range = G.player.vehicle ? 2.6 : 1.4;
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      if (!it.active) {
        it.timer -= dt;
        if (it.timer <= 0) { it.active = true; it.group.visible = true; }
        continue;
      }
      it.mesh.rotation.y = time * 2 + it.phase;
      it.mesh.position.y = 0.8 + Math.sin(time * 3 + it.phase) * 0.12;
      if (it.ttl) {
        it.ttl -= dt;
        if (it.ttl <= 0) { this.remove(k); continue; }
      }
      if (Math.hypot(pp.x - it.x, pp.z - it.z) < range && G.player.alive && (it.kind === 'cash' || !G.player.vehicle || it.kind === 'health')) {
        if (!this.collect(it)) continue;
        if (it.respawn) {
          it.active = false;
          it.timer = it.respawn;
          it.group.visible = false;
        } else this.remove(k);
      }
    }
  }

  remove(k) {
    const it = this.items[k];
    this.G.scene.remove(it.group);
    this.items.splice(k, 1);
  }
}
