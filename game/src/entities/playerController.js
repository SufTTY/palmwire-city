// Rae Solano, controlled by the player: camera-relative running, sprinting and jumping on foot,
// aiming and firing (recoil, reloads, ammo), punching, getting into parked cars or yanking
// drivers out of traffic, and driving (throttle, brake/reverse, steering, handbrake, horn, radio).
import * as THREE from 'three';
import { Character } from './character.js';
import { PLAYER_LOOK } from './characterLooks.js';
import { WEAPONS, WEAPON_ORDER } from '../combat/weaponDefs.js';

export class PlayerController {
  constructor(G, x, z, heading = 0) {
    this.G = G;
    this.char = new Character(G, PLAYER_LOOK, { faction: 'player', health: 100, x, z, heading });
    this.char.radius = 0.38;
    this.vehicle = null;
    this.inventory = {
      fists: { owned: true, mag: 0, reserve: 0 },
      pistol: { owned: true, mag: 12, reserve: 48 },
      smg: { owned: false, mag: 0, reserve: 0 },
      shotgun: { owned: false, mag: 0, reserve: 0 },
    };
    this.weapon = 'pistol';
    this.cooldown = 0;
    this.reloadT = 0;
    this.aiming = false;
    this.controlsLocked = false;
    this.char.setWeapon('pistol');
    G.events.on('vehicleImpact', (e) => {
      if (e.vehicle === this.vehicle && this.vehicle.T.bike && e.speed > 11) this.exitVehicle(true);
      if (e.vehicle === this.vehicle && e.speed > 7) G.fx.shake(Math.min(1, e.speed / 25));
    });
  }

  get pos() { return this.vehicle ? this.vehicle.pos : this.char.pos; }
  get alive() { return this.char.alive; }
  get weaponDef() { return WEAPONS[this.weapon]; }

  giveWeapon(key, ammo) {
    const slot = this.inventory[key];
    const fresh = !slot.owned;
    slot.owned = true;
    slot.reserve += ammo;
    if (fresh) {
      slot.mag = Math.min(WEAPONS[key].mag, slot.reserve);
      slot.reserve -= slot.mag;
    }
  }

  selectWeapon(key) {
    if (!this.inventory[key].owned || this.weapon === key) return;
    this.weapon = key;
    this.reloadT = 0;
    this.char.setWeapon(key);
    if (this.G.hud) this.G.hud.weaponChanged();
  }

  cycleWeapon(dir) {
    const owned = WEAPON_ORDER.filter((k) => this.inventory[k].owned);
    const i = owned.indexOf(this.weapon);
    this.selectWeapon(owned[(i + dir + owned.length) % owned.length]);
  }

  update(dt, input) {
    const G = this.G;
    if (!this.char.alive) {
      if (this.vehicle) { this.vehicle.controls.throttle = 0; this.vehicle.controls.handbrake = true; }
      return;
    }
    if (this.controlsLocked) {
      if (this.vehicle) Object.assign(this.vehicle.controls, { throttle: 0, brake: 0.6, steer: 0, handbrake: false });
      else this.char.steer(0, 0, 8, dt);
      if (this.vehicle) this.char.pos.copy(this.vehicle.pos);
      return;
    }
    if (this.vehicle) this.drive(dt, input);
    else this.onFoot(dt, input);
  }

  drive(dt, input) {
    const G = this.G;
    const v = this.vehicle;
    const c = v.controls;
    c.throttle = input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0;
    c.brake = input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0;
    c.steer = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    c.steer = Math.max(-1, Math.min(1, c.steer));
    c.handbrake = input.isDown('Space');
    if (G.audio) G.audio.setHorn(input.isDown('KeyH'), v.pos);
    if (input.pressed('KeyQ') && G.radio) G.radio.next(-1);
    if (input.pressed('KeyE') && G.radio) G.radio.next(1);
    this.char.pos.copy(v.pos);
    this.char.heading = v.heading;
    if (v.inWater && v.sinkT > 1.5) this.exitVehicle(false);
    else if (input.pressed('KeyF')) {
      if (v.absSpeed < 9 || v.isWreck) this.exitVehicle(false);
      else if (v.absSpeed >= 9) this.exitVehicle(true);
    }
    if (v.isWreck && v.wreckT > 1.5 && this.char.alive) this.exitVehicle(false);
  }

  onFoot(dt, input) {
    const G = this.G;
    const ch = this.char;
    const cam = G.cam;
    this.aiming = input.mouseHeld(2) && this.weapon !== 'fists';
    ch.pose = this.aiming ? 'aim' : 'idle';
    const f = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
    const s = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const rx = -fz, rz = fx;
    let mx = fx * f + rx * s, mz = fz * f + rz * s;
    const ml = Math.hypot(mx, mz);
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = this.aiming ? 2.6 : sprint ? 7.4 : 4.4;
    if (ml > 0.01) { mx /= ml; mz /= ml; }
    ch.steer(mx * speed * Math.min(1, ml), mz * speed * Math.min(1, ml), ch.inWater ? 3 : 9, dt);
    if (ch.inWater) { ch.vel.multiplyScalar(0.6); }
    const firing = input.mouseHeld(0);
    if (this.aiming || (firing && this.weapon !== 'fists')) ch.faceToward(cam.yaw, 18, dt);
    else if (ml > 0.01) ch.faceToward(Math.atan2(mx, mz), 10, dt);
    ch.aimPitch = this.aiming ? -cam.pitch * 0.8 : 0;
    if (input.pressed('Space')) ch.jump();

    // weapons
    if (input.wheel) this.cycleWeapon(input.wheel > 0 ? 1 : -1);
    WEAPON_ORDER.forEach((k, i) => { if (input.pressed('Digit' + (i + 1))) this.selectWeapon(k); });
    const W = this.weaponDef;
    const slot = this.inventory[this.weapon];
    this.cooldown -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = W.mag - slot.mag;
        const take = Math.min(need, slot.reserve);
        slot.mag += take;
        slot.reserve -= take;
      }
    }
    if (input.pressed('KeyR') && !W.melee && slot.mag < W.mag && slot.reserve > 0 && this.reloadT <= 0) this.startReload();
    const trigger = W.auto ? input.mouseHeld(0) : input.mouseClicked(0);
    if (trigger && this.cooldown <= 0 && this.reloadT <= 0 && !ch.inWater) {
      if (W.melee) {
        this.cooldown = W.rate;
        G.combat.melee(ch);
      } else if (slot.mag > 0) {
        this.cooldown = W.rate;
        slot.mag--;
        this.shoot(W);
        if (slot.mag === 0 && slot.reserve > 0) this.startReload();
      } else if (input.mouseClicked(0) && G.audio) G.audio.sfx.dryFire();
    }

    // vehicles
    if (input.pressed('KeyF')) {
      const v = G.vehicles.findEnterable(ch.pos);
      if (v) this.enterVehicle(v);
    }
  }

  startReload() {
    this.reloadT = this.weaponDef.reload;
    if (this.G.audio) this.G.audio.sfx.reload();
  }

  shoot(W) {
    const G = this.G;
    const ch = this.char;
    const cam = G.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    // find what the crosshair is over, then fire from the gun toward that point
    const aimHit = G.combat.raycast(cam.position.clone().addScaledVector(dir, 2.5), dir, 200, ch);
    const hx = Math.sin(ch.heading), hz = Math.cos(ch.heading);
    const muzzle = new THREE.Vector3(ch.pos.x + hx * 0.75 - hz * 0.33, ch.pos.y + 1.45, ch.pos.z + hz * 0.75 + hx * 0.33);
    const shotDir = aimHit.point.clone().sub(muzzle).normalize();
    G.combat.fire(ch, muzzle, shotDir, W.key, { isPlayer: true });
    G.cam.kick(W.recoil);
    G.fx.shake(W.shake);
  }

  enterVehicle(v) {
    const G = this.G;
    if (v.isWreck) return;
    if (v.mode === 'rail') {
      G.traffic.carjack(v);
      G.wanted.report('carjack', v.pos);
      if (G.hud) G.hud.notify('Carjacked a ' + v.T.name);
    } else if (v.T.police && v.crew > 0 && v.ai && !v.ai.deployed) {
      for (let k = 0; k < v.crew; k++) G.police.makeOfficer(v.pos.x + Math.cos(v.heading) * 2.5 * (k ? 1 : -1), v.pos.z - Math.sin(v.heading) * 2.5 * (k ? 1 : -1));
      v.crew = 0;
      G.wanted.add(6, 2, v.pos);
    } else if (v.mode === 'parked' && !v.owned) {
      G.wanted.report('steal', v.pos);
      if (G.audio && G.rng() < 0.3) G.audio.sfx.carAlarm(v.pos);
    }
    if (v.T.police) {
      const i = G.police.cars.indexOf(v);
      if (i >= 0) G.police.cars.splice(i, 1);
      v.ai = null;
    }
    v.mode = 'physics';
    v.driver = this.char;
    v.driverKind = null;
    v.owned = true;
    this.char.inVehicle = v;
    this.char.vel.set(0, 0, 0);
    this.vehicle = v;
    this.char.setWeapon(null);
    if (v.T.bike) this.char.model.root.visible = true;
    G.events.emit('playerEnteredVehicle', { vehicle: v });
    if (G.radio) G.radio.onEnterVehicle(v);
  }

  exitVehicle(bail) {
    const G = this.G;
    const v = this.vehicle;
    if (!v) return;
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
    const off = v.T.wid / 2 + 0.75;
    let x = v.pos.x + lx * off, z = v.pos.z + lz * off;
    if (v.inWater) { x = v.pos.x; z = v.pos.z; }
    const fix = G.colliders.resolveCircle(x, z, 0.4, v.pos.y + 0.5);
    this.char.pos.set(fix.x, v.pos.y + 0.3, fix.z);
    this.char.inVehicle = null;
    this.char.heading = v.heading;
    v.driver = null;
    Object.assign(v.controls, { throttle: 0, brake: 0, steer: 0, handbrake: true });
    this.vehicle = null;
    this.char.setWeapon(this.weapon);
    if (G.audio) G.audio.setHorn(false);
    if (bail) {
      this.char.knockback(v.vx * 0.6 + lx * 3, v.vz * 0.6 + lz * 3, 3.5);
      this.char.takeDamage(Math.min(40, v.absSpeed * 1.5), { type: 'fall' });
    }
    G.events.emit('playerExitedVehicle', { vehicle: v });
    if (G.radio) G.radio.onExitVehicle();
  }
}
