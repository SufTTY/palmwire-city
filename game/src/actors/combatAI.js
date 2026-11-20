// Behaviour for armed people on foot (police officers and gang crews): close to a firing
// range, strafe, take shots with skill-based spread when they have line of sight, or move
// in to make an arrest.
import * as THREE from 'three';
import { WEAPON_BY_ID } from '../combat/weapons.js';
import { yawTo } from '../core/mathUtil.js';

const o = new THREE.Vector3(), d = new THREE.Vector3();

export class CombatAI {
  constructor(game, human, { weapon = 'pistol', skill = 0.5, damageMul = 0.45, range = [7, 16], arrest = false } = {}) {
    this.game = game;
    this.h = human;
    this.weapon = WEAPON_BY_ID[weapon];
    this.skill = skill;
    this.damageMul = damageMul;
    this.range = range;
    this.arrest = arrest;
    this.cooldown = 1 + Math.random();
    this.burst = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 2;
    this.active = true;
    this.goal = null;      // optional point to hold (cover spot)
    human.gun = !this.weapon.melee;
    human.gunLong = weapon === 'smg' || weapon === 'carbine' || weapon === 'shotgun';
    human.twoHanded = human.gunLong;
  }

  update(dt, target) {
    const g = this.game, h = this.h;
    if (!h.alive) return;
    if (h.updateDown(dt)) { h.pose = 'down'; return; }
    if (!target || !target.alive) { h.locomote(dt, 0, 0); h.pose = 'idle'; return; }
    const tp = target.vehicle ? target.vehicle.pos : target.pos;
    const dx = tp.x - h.pos.x, dz = tp.z - h.pos.z;
    const dist = Math.hypot(dx, dz);
    const nx = dx / (dist || 1), nz = dz / (dist || 1);
    const los = !g.colliders.blocked(h.pos.x, h.pos.z, tp.x, tp.z, 1.5);
    let mx = 0, mz = 0, speed = 0;
    const [near, far] = this.arrest ? [1.2, 2] : this.range;
    if (!los || dist > far) { mx = nx; mz = nz; speed = 5.2; }
    else if (dist < near) { mx = -nx; mz = -nz; speed = 3; }
    else if (!this.arrest) {
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) { this.strafe *= -1; this.strafeTimer = 1.5 + Math.random() * 2; }
      mx = -nz * this.strafe; mz = nx * this.strafe; speed = 2.2;
    }
    if (this.goal && Math.hypot(this.goal.x - h.pos.x, this.goal.z - h.pos.z) > 1.5 && dist > near) {
      const gx = this.goal.x - h.pos.x, gz = this.goal.z - h.pos.z, gl = Math.hypot(gx, gz);
      mx = gx / gl; mz = gz / gl; speed = 5;
    }
    const face = yawTo(h.pos.x, h.pos.z, tp.x, tp.z);
    const shooting = los && dist < this.weapon.range * 0.8 && !this.arrest;
    h.locomote(dt, mx * speed, mz * speed, shooting || dist < 20 ? face : null, 10);
    h.pose = shooting ? 'aim' : speed > 4 ? 'run' : speed > 0.3 ? 'walk' : 'idle';
    if (this.arrest) { h.pose = dist < 6 ? 'aim' : h.pose; return; }
    if (!shooting) return;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    // fire, in short bursts for automatics
    const w = this.weapon;
    o.set(h.pos.x + Math.sin(h.yaw) * 0.7, h.pos.y + 1.45, h.pos.z + Math.cos(h.yaw) * 0.7);
    const aimY = target.vehicle ? 0.9 : 1.2;
    d.set(tp.x - o.x, tp.y + aimY - o.y, tp.z - o.z).normalize();
    const moving = target.vehicle ? Math.min(1, target.vehicle.speed / 20) : Math.min(1, target.speed / 6);
    const spreadMul = 2.6 - this.skill * 1.8 + moving * 1.2 + dist / 40;
    g.combat.fire(h, w, o, d, { spreadMul, damageMul: this.damageMul });
    g.audio && g.audio.sfx.gun(w.sound, h.pos.x, h.pos.z);
    if (w.auto) {
      this.burst++;
      this.cooldown = this.burst % 5 === 0 ? 0.9 + Math.random() : w.rate * 1.5;
    } else {
      this.cooldown = w.rate + 0.5 + Math.random() * (1.4 - this.skill);
    }
  }
}
