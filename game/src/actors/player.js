// The player, Sol Arroyo: walking, sprinting and jumping relative to the camera, aiming and
// shooting with recoil, punching, getting in and out of cars (including dragging drivers
// out), driving with handbrake and horn, and drive-by shooting from the window.
import * as THREE from 'three';
import { Human } from './human.js';
import { Arsenal, WEAPON_BY_ID } from '../combat/weapons.js';

export const SOL_LOOK = { skin: 0xc98d5a, hair: 0x1b120c, shirt: 0x17a8a0, sleeve: 0x17a8a0, pants: 0x2a2f45, cap: null };

const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3();

export class PlayerController {
  constructor(game, x, z) {
    this.game = game;
    this.human = new Human(game, { x, z, role: 'player', look: { ...SOL_LOOK }, health: 100 });
    this.human.armour = 25;
    this.arsenal = new Arsenal();
    this.aiming = false;
    this.focus = new THREE.Vector3(x, 0, z);
    this.sinceHurt = 10;
    this.lastHealth = 100;
    this.punchT = 0;
    this.controlsLocked = false;
  }

  get vehicle() { return this.human.vehicle; }

  update(dt) {
    const g = this.game, h = this.human, input = g.input;
    this.arsenal.update(dt);
    if (h.health < this.lastHealth) this.sinceHurt = 0;
    this.lastHealth = h.health;
    this.sinceHurt += dt;
    if (h.alive && this.sinceHurt > 6 && h.health < 50) h.health = Math.min(50, h.health + dt * 2);

    if (!h.alive || this.controlsLocked) {
      if (h.vehicle) { const c = h.vehicle.controls; c.throttle = 0; c.brake = 0.5; c.steer = 0; }
      if (!h.alive) h.pose = 'dead';
      this.updateFocus();
      return;
    }
    if (input.locked || g.shotMode) g.cameraRig.handleMouse(input, g.settings.get('sensitivity'));

    // weapon selection (wheel UI may also call arsenal.select)
    for (let s = 1; s <= 5; s++) if (input.wasPressed('Digit' + s)) this.arsenal.selectSlot(s);
    if (input.wheel) this.arsenal.cycle(input.wheel > 0 ? 1 : -1);
    if (input.wasPressed('KeyR') && !h.vehicle) this.arsenal.startReload();

    if (input.wasPressed('KeyF')) {
      if (h.vehicle) this.exitVehicle(false);
      else this.tryEnterVehicle();
    }
    if (h.vehicle) this.drive(dt);
    else this.onFoot(dt);
    this.updateFocus();
  }

  updateFocus() {
    const h = this.human;
    if (h.vehicle) this.focus.copy(h.vehicle.pos); else this.focus.copy(h.pos);
  }

  onFoot(dt) {
    const g = this.game, h = this.human, input = g.input;
    if (h.updateDown(dt)) { h.pose = 'down'; return; }
    const w = this.arsenal.weapon;
    this.aiming = input.buttons[2] && !w.melee;
    const camYaw = g.cameraRig.lookYaw;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const mf = input.axis('KeyS', 'KeyW'), mr = input.axis('KeyA', 'KeyD');
    let mx = fx * mf + rx * mr, mz = fz * mf + rz * mr;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    const sprint = input.isDown('ShiftLeft') && !this.aiming;
    const speed = this.aiming ? 2.6 : sprint ? 7.6 : 4.2;
    const firing = !w.melee && (w.auto ? input.buttons[0] : input.clicked[0]);
    const wantsFace = this.aiming || firing;
    h.locomote(dt, mx * speed, mz * speed, wantsFace ? camYaw : null, 14);
    if (input.wasPressed('Space') && h.grounded) { h.vy = 6.2; h.grounded = false; }

    // pose and aim pitch
    const aimDir = tmpD.copy(g.cameraRig.aimPoint).sub(tmpO.set(h.pos.x, h.pos.y + 1.5, h.pos.z)).normalize();
    h.aimPitch = -Math.asin(Math.max(-0.9, Math.min(0.9, aimDir.y)));
    h.gun = !w.melee;
    h.gunLong = w.id === 'carbine' || w.id === 'shotgun';
    h.twoHanded = h.gunLong || w.id === 'smg';
    this.punchT = Math.max(0, this.punchT - dt);
    if (this.punchT > 0) { h.pose = 'punch'; h.punch = Math.sin((this.punchT / 0.3) * Math.PI); }
    else if (wantsFace) h.pose = 'aim';
    else h.pose = h.speed > 5.5 ? 'run' : h.speed > 0.4 ? 'walk' : 'idle';

    if (w.melee) {
      if (input.clicked[0] && this.arsenal.tryFire()) {
        this.punchT = 0.3;
        h.yaw = camYaw;
        g.combat.melee(h, w);
      }
      return;
    }
    if (firing && this.arsenal.tryFire()) this.shoot(w);
    else if (firing && this.arsenal.ammo[w.id].mag === 0 && this.arsenal.ammo[w.id].reserve === 0 && input.clicked[0]) {
      g.audio && g.audio.sfx.dryFire();
    }
  }

  muzzleOrigin(out) {
    const h = this.human;
    const f = { x: Math.sin(h.yaw), z: Math.cos(h.yaw) }, r = { x: -Math.cos(h.yaw), z: Math.sin(h.yaw) };
    return out.set(h.pos.x + f.x * 0.75 - r.x * 0.33, h.pos.y + 1.45, h.pos.z + f.z * 0.75 - r.z * 0.33);
  }

  shoot(w) {
    const g = this.game, h = this.human;
    h.yaw = g.cameraRig.lookYaw;
    const origin = this.muzzleOrigin(tmpO);
    const dir = tmpD.copy(g.cameraRig.aimPoint).sub(origin).normalize();
    g.combat.fire(h, w, origin, dir, { spreadMul: this.aiming ? 0.7 : 1.4 });
    g.cameraRig.pitch -= w.recoil * (0.6 + Math.random() * 0.6);
    g.cameraRig.yaw += (Math.random() - 0.5) * w.recoil * 0.6;
    g.cameraRig.shake(w.recoil * 2.5);
    g.audio && g.audio.sfx.gun(w.sound);
    h.pose = 'shoot';
  }

  drive(dt) {
    const g = this.game, h = this.human, v = h.vehicle, input = g.input, c = v.controls;
    if (this.autopilot) this.autopilot(v, dt);
    else {
      c.throttle = input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0;
      c.brake = input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0;
      c.steer = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
      c.handbrake = input.isDown('Space');
    }
    c.boost = v.nitro > 0;
    if (v.nitro > 0) {
      v.nitro -= dt;
      const f = v.forward;
      if (Math.random() < dt * 30) g.fx.particles.fire(v.pos.x - f.x * v.halfLen, 0.5, v.pos.z - f.z * v.halfLen, 0.35);
    }
    v.horn = input.isDown('KeyH');
    if (input.wasPressed('KeyQ')) g.audio && g.audio.radio.next();
    if (v.isPolice && input.wasPressed('KeyG')) v.siren = !v.siren;
    h.pos.copy(v.pos);
    h.yaw = v.yaw;
    h.pose = v.type.bike ? 'ride' : 'sit';
    // drive-by: pistol or SMG out of the window toward the crosshair
    const w = this.arsenal.weapon;
    const canShoot = w.id === 'pistol' || w.id === 'smg';
    if (canShoot && (w.auto ? input.buttons[0] : input.clicked[0]) && this.arsenal.tryFire()) {
      const origin = tmpO.set(v.pos.x, v.pos.y + v.type.hgt * 0.85, v.pos.z);
      const dir = tmpD.copy(g.cameraRig.aimPoint).sub(origin).normalize();
      origin.addScaledVector(dir, v.type.wid * 0.7);
      g.combat.fire(h, w, origin, dir, { spreadMul: 1.6, vehicleIgnore: v });
      g.cameraRig.shake(w.recoil * 2);
      g.audio && g.audio.sfx.gun(w.sound);
    }
    if (v.destroyed) this.exitVehicle(true);
  }

  tryEnterVehicle() {
    const g = this.game, h = this.human;
    const v = g.vehicles.nearestEnterable(h.pos.x, h.pos.z, 3.2);
    if (!v || v.driver === h) return false;
    const npc = v.npcDriver || (v.driver && v.driver !== h ? v.driver : null);
    if (v.isPolice && v.police && v.police.officers && v.police.officers.some((o) => o.alive && o.inCar)) return false;
    if (npc) {
      // drag the driver out; they run for it
      const ex = v.exitPoint();
      g.peds.spawnAt(ex.x, ex.z, { look: v.npcDriver || undefined, flee: { x: h.pos.x, z: h.pos.z } });
      v.npcDriver = null;
      if (v.driver && v.driver !== h) v.driver = null;
      g.events.emit('crime', { type: 'carjack', x: v.pos.x, z: v.pos.z });
    } else if (v.parked && !v.stolenOnce) {
      g.events.emit('crime', { type: 'theft', x: v.pos.x, z: v.pos.z });
    } else if (v.isPolice) {
      g.events.emit('crime', { type: 'copcar', x: v.pos.x, z: v.pos.z });
    }
    v.stolenOnce = true;
    g.traffic.release(v);
    if (v.police) g.police.abandonVehicle(v);
    v.ai = null;
    v.parked = false;
    v.driver = h;
    v.upgrades = g.progression.garage;
    h.vehicle = v;
    h.pose = 'sit';
    this.aiming = false;
    g.cameraRig.yaw = v.yaw + Math.PI;
    g.events.emit('enteredVehicle', { vehicle: v });
    g.audio && g.audio.sfx.door();
    return true;
  }

  exitVehicle(forced) {
    const g = this.game, h = this.human, v = h.vehicle;
    if (!v) return;
    const fast = v.speed > 12;
    const ex = v.exitPoint();
    h.pos.set(ex.x, 0, ex.z);
    g.colliders.resolveCircle(h.pos, 0.5);
    h.vel.set(v.vel.x * 0.6, 0, v.vel.z * 0.6);
    h.vehicle = null;
    v.driver = null;
    v.controls.throttle = 0; v.controls.handbrake = true;
    v.horn = false;
    h.pose = 'idle';
    if (fast || forced) { h.knockDown(h.vel.x, h.vel.z, 1.2); if (fast) h.damage(Math.min(25, v.speed), null, 'fall'); }
    g.events.emit('exitedVehicle', { vehicle: v });
    g.audio && g.audio.sfx.door();
  }

  /** Put the player into a vehicle directly (story setup, screenshots). */
  placeInVehicle(v) {
    const h = this.human;
    if (h.vehicle) this.exitVehicle(false);
    v.npcDriver = null;
    v.ai = null;
    v.driver = h; h.vehicle = v; v.parked = false;
    v.upgrades = this.game.progression.garage;
    this.game.traffic.release(v);
    h.pos.copy(v.pos);
    this.updateFocus();
  }

  get weaponInfo() {
    const w = this.arsenal.weapon;
    return { w, ammo: this.arsenal.ammo[w.id] || null, def: WEAPON_BY_ID[w.id] };
  }
}
