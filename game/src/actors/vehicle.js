// One vehicle: arcade driving physics (engine, brakes, reverse, grip with handbrake drifts,
// nitro), damage and fire, siren lights, and the visual sync of body roll and spinning wheels.
import * as THREE from 'three';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { buildVehicleModel } from './vehicleModels.js';
import { clamp, damp } from '../core/mathUtil.js';

let nextVehicleId = 1;

export class Vehicle {
  constructor(game, typeKey, { x = 0, z = 0, yaw = 0, paint = null } = {}) {
    this.game = game;
    this.id = nextVehicleId++;
    this.typeKey = typeKey;
    this.type = VEHICLE_TYPES[typeKey];
    this.paint = paint ?? this.type.paints[0];
    this.model = buildVehicleModel(typeKey, this.type, this.paint);
    this.root = this.model.root;
    game.scene.add(this.root);
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.yawRate = 0;
    this.steerAngle = 0;
    this.health = this.type.hp;
    this.maxHealth = this.type.hp;
    this.driver = null;        // Human driving it (player or NPC)
    this.ai = null;            // AI controller (traffic, police, race)
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
    this.radius = this.type.wid / 2 + 0.05;
    this.halfLen = this.type.len / 2;
    this.mass = this.type.mass;
    this.skidding = false;
    this.slip = 0;
    this.siren = false;
    this.flashT = 0;
    this.destroyed = false;
    this.burning = 0;
    this.lastHitBy = null;
    this.roll = 0; this.pitch = 0;
    this.prevVf = 0;
    this.parked = false;
    this.persistent = false;   // mission / player cars survive despawn sweeps
    this.upgrades = null;      // garage perks when the player drives
    this.horn = false;
    this.nitro = 0;
    this.syncModel(0);
  }

  get forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }
  get right() { return { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) }; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get forwardSpeed() { const f = this.forward; return this.vel.x * f.x + this.vel.z * f.z; }
  get isPolice() { return !!this.type.police; }
  get kmh() { return Math.abs(this.forwardSpeed) * 3.6; }

  /** The two collision circle centres along the body. */
  circles() {
    const f = this.forward, o = Math.max(0, this.halfLen - this.radius);
    return [
      { x: this.pos.x + f.x * o, z: this.pos.z + f.z * o },
      { x: this.pos.x - f.x * o, z: this.pos.z - f.z * o },
    ];
  }

  stats() {
    const t = this.type, u = this.upgrades;
    return {
      maxSpeed: t.maxSpeed * (u ? 1 + u.engine * 0.07 : 1),
      accel: t.accel * (u ? 1 + u.engine * 0.1 : 1),
      grip: t.grip * (u ? 1 + u.tires * 0.08 : 1),
      armor: u ? 1 - u.armor * 0.15 : 1,
    };
  }

  update(dt) {
    if (this.destroyed) { this.vel.multiplyScalar(Math.exp(-2 * dt)); this.pos.addScaledVector(this.vel, dt); this.syncModel(dt); return; }
    const c = this.controls, t = this.type, s = this.stats();
    if (!this.driver && !this.ai) { c.throttle = 0; c.brake = 0; c.steer = 0; c.handbrake = true; c.boost = false; }
    const f = this.forward, r = this.right;
    let vf = this.vel.x * f.x + this.vel.z * f.z;
    let vr = this.vel.x * r.x + this.vel.z * r.z;
    const maxSpeed = s.maxSpeed * (c.boost ? 1.3 : 1) * (this.health < this.maxHealth * 0.2 ? 0.7 : 1);

    // engine and brakes along the heading
    let a = 0;
    if (c.throttle > 0) {
      if (vf < -0.5) a += t.brake * c.throttle;
      else a += s.accel * c.throttle * Math.max(0, 1 - Math.pow(Math.max(0, vf) / maxSpeed, 2)) * (c.boost ? 1.8 : 1);
    }
    if (c.brake > 0) {
      if (vf > 0.5) a -= t.brake * c.brake;
      else if (vf > -12) a -= s.accel * 0.55 * c.brake;
    }
    if (c.handbrake) a -= Math.sign(vf) * Math.min(Math.abs(vf) / Math.max(dt, 1e-3), 7);
    if (c.throttle === 0 && c.brake === 0) a -= Math.sign(vf) * Math.min(Math.abs(vf) / Math.max(dt, 1e-3), 1.2);
    a -= vf * Math.abs(vf) * 0.0016;
    vf += a * dt;

    // steering: yaw rate from a bicycle model, softened at speed
    const steerTarget = c.steer * t.steer / (1 + Math.abs(vf) / 22);
    this.steerAngle = damp(this.steerAngle, steerTarget, 10, dt);
    const wheelBase = t.len * 0.6;
    let targetRate = (vf / wheelBase) * Math.tan(this.steerAngle);
    if (c.handbrake && Math.abs(vf) > 4) targetRate *= 1.65;
    this.yawRate = damp(this.yawRate, targetRate, c.handbrake ? 5 : 9, dt);
    // world velocity before the turn
    const vx = f.x * vf + r.x * vr, vz = f.z * vf + r.z * vr;
    this.yaw -= this.yawRate * dt;

    // re-express in the new frame and bleed lateral slip according to grip
    const f2 = this.forward, r2 = this.right;
    vf = vx * f2.x + vz * f2.z;
    vr = vx * r2.x + vz * r2.z;
    let grip = c.handbrake ? 1.3 : s.grip;
    if (Math.abs(vr) > 6 && !c.handbrake) grip *= 0.55; // sustained drift once broken loose
    if (t.bike) grip *= 1.2;
    vr *= Math.exp(-grip * dt);
    this.slip = Math.abs(vr);
    this.skidding = Math.abs(vr) > 3.2 || (c.handbrake && Math.abs(vf) > 7) || (c.brake > 0 && vf > 18);
    this.vel.x = f2.x * vf + r2.x * vr;
    this.vel.z = f2.z * vf + r2.z * vr;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.longAccel = (vf - this.prevVf) / Math.max(dt, 1e-3);
    this.prevVf = vf;

    if (this.health <= 0 && !this.destroyed) {
      this.burning += dt;
      if (this.burning > 4.5) this.explode();
    }
    this.syncModel(dt);
  }

  /** Bounce off a surface with normal n (unit); returns the impact speed. */
  bounce(nx, nz, restitution = 0.25) {
    const vn = this.vel.x * nx + this.vel.z * nz;
    if (vn >= 0) return 0;
    this.vel.x -= (1 + restitution) * vn * nx;
    this.vel.z -= (1 + restitution) * vn * nz;
    // lose some speed along the wall too
    this.vel.multiplyScalar(0.92);
    return -vn;
  }

  damage(amount, by = null) {
    if (this.destroyed) return;
    const s = this.stats();
    this.health -= amount * s.armor;
    if (by) this.lastHitBy = by;
    if (this.health <= 0) { this.health = 0; }
  }

  repair() { this.health = this.maxHealth; this.burning = 0; }

  explode() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.health = 0;
    this.model.paintMesh.material = this.game.vehicles.burntMaterial;
    this.vel.y = 0;
    this.game.events.emit('explosion', { x: this.pos.x, y: 1, z: this.pos.z, radius: 9, source: this.lastHitBy, vehicle: this });
  }

  syncModel(dt) {
    const root = this.root;
    root.position.set(this.pos.x, this.pos.y, this.pos.z);
    root.rotation.y = this.yaw;
    const vf = this.forwardSpeed;
    if (dt > 0) {
      const lat = this.yawRate * vf;
      if (this.type.bike) {
        this.roll = damp(this.roll, clamp(lat * 0.045, -0.7, 0.7), 6, dt);
        this.model.body.rotation.z = this.roll;
      } else {
        this.roll = damp(this.roll, clamp(-lat * 0.006, -0.08, 0.08), 6, dt);
        this.pitch = damp(this.pitch, clamp(-(this.longAccel || 0) * 0.004, -0.05, 0.05), 6, dt);
        this.model.body.rotation.z = this.roll;
        this.model.body.rotation.x = this.pitch;
      }
      for (const w of this.model.wheels) {
        w.mesh.rotation.x += (vf * dt) / this.type.wheelR;
        if (w.front) w.pivot.rotation.y = this.steerAngle * -1;
      }
      if (this.model.bars) {
        const b = this.model.bars;
        if (this.siren) {
          this.flashT += dt;
          const on = Math.floor(this.flashT * 6) % 2 === 0;
          b.l.material = on ? b.mats.barRed : b.mats.barOff;
          b.r.material = on ? b.mats.barOffB : b.mats.barBlue;
        } else {
          b.l.material = b.mats.barOff; b.r.material = b.mats.barOffB;
        }
      }
    }
  }

  /** Where a person stands when getting out (driver side). */
  exitPoint() {
    const r = this.right;
    const d = this.type.wid / 2 + 0.9;
    return { x: this.pos.x - r.x * d, z: this.pos.z - r.z * d };
  }

  dispose() {
    this.game.scene.remove(this.root);
  }
}
