// One vehicle: arcade driving physics (engine, brakes, reverse, lateral grip, handbrake drifts,
// speed-sensitive steering, inertia), collisions with the static city, sinking in the sea,
// damage, smoke, fire and explosion, plus visual body roll, wheel steer/spin, brake lights,
// headlight glow and the police lightbar. Traffic AI moves "rail" cars along lanes instead.
import * as THREE from 'three';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { buildVehicleModel, setWrecked } from './vehicleModel.js';
import { clamp, damp } from '../core/mathUtil.js';
import { WATER_Y } from '../world/cityLayout.js';

let nextId = 1;

export class Vehicle {
  constructor(G, typeKey, { x = 0, z = 0, heading = 0, paint = null, mode = 'parked' } = {}) {
    this.G = G;
    this.id = nextId++;
    this.type = typeKey;
    this.T = VEHICLE_TYPES[typeKey];
    this.paint = paint ?? this.T.paints[Math.floor(G.rng() * this.T.paints.length)];
    this.model = buildVehicleModel(typeKey, this.paint);
    G.scene.add(this.model.root);
    this.pos = new THREE.Vector3(x, G.layout.groundHeight(x, z), z);
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.angVel = 0;
    this.steerAngle = 0;
    this.health = this.T.health;
    this.maxHealth = this.T.health;
    this.mode = mode;            // 'parked' | 'rail' | 'physics' | 'wreck'
    this.driver = null;          // Character (AI) or the player's character
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.rail = null;
    this.sirenOn = false;
    this.lightPhase = G.rng() * 10;
    this.burnT = 0;
    this.sinkT = 0;
    this.inWater = false;
    this.skid = 0;
    this.prevVf = 0;
    this.roll = 0;
    this.pitch = 0;
    this.persistent = false;
    this.tag = null;
    this.removed = false;
    this.lastHitBy = null;
    this.hitCooldown = 0;
    this.wheelPrev = [new THREE.Vector3(), new THREE.Vector3()];
    this.radius = Math.max(this.T.len, this.T.wid) / 2;
  }

  get fx() { return Math.sin(this.heading); }
  get fz() { return Math.cos(this.heading); }
  get speed() { return this.vx * this.fx + this.vz * this.fz; }
  get absSpeed() { return Math.hypot(this.vx, this.vz); }
  get isWreck() { return this.mode === 'wreck'; }
  get occupied() { return !!this.driver; }

  /** Collision circles along the body: [x, z, r] in world space. */
  circles() {
    const T = this.T;
    const r = T.wid / 2;
    if (T.bike) return [[this.pos.x, this.pos.z, 0.6]];
    const off = (T.len / 2 - r) ;
    const out = [];
    for (const k of [-1, 0, 1]) out.push([this.pos.x + this.fx * off * k, this.pos.z + this.fz * off * k, r]);
    return out;
  }

  setRailPose(x, z, heading, speed) {
    this.pos.x = x;
    this.pos.z = z;
    this.heading = heading;
    this.vx = Math.sin(heading) * speed;
    this.vz = Math.cos(heading) * speed;
    this.pos.y = this.G.layout.groundHeight(x, z);
  }

  physics(dt) {
    if (this.mode !== 'physics') return;
    const G = this.G, T = this.T, c = this.controls;
    const fx = this.fx, fz = this.fz, rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;
    const surf = G.layout.surfaceAt(this.pos.x, this.pos.z);
    const offroad = surf.type === 'sand' || surf.type === 'grass' || surf.type === 'park';
    const dead = this.inWater || this.health <= 0;

    if (!dead) {
      if (c.throttle > 0) {
        const top = T.maxSpeed * (offroad ? 0.7 : 1);
        if (vf < -0.5) vf += T.brake * c.throttle * dt;
        else vf += T.accel * c.throttle * dt * clamp(1 - vf / top, 0, 1) ** 0.6;
      }
      if (c.brake > 0) {
        if (vf > 0.8) vf -= T.brake * c.brake * dt;
        else vf = Math.max(-T.maxSpeed * 0.3, vf - T.accel * 0.7 * c.brake * dt);
      }
    }
    // rolling resistance and air drag
    const roll = (c.throttle > 0 ? 0.6 : 2.2) + (offroad ? 3 : 0);
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), roll * dt);
    vf -= vf * Math.abs(vf) * 0.0009 * dt * 10;
    if (c.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    if (dead) vf *= Math.exp(-1.5 * dt);
    // lateral grip (drift when handbraking or overspeeding a corner)
    const grip = c.handbrake ? 1.1 : T.grip * (offroad ? 0.55 : 1);
    vr *= Math.exp(-grip * dt);
    this.skid = Math.abs(vr) > 3.2 || (c.handbrake && Math.abs(vf) > 6) ? Math.min(1, Math.abs(vr) / 8 + 0.3) : 0;
    if (c.throttle > 0 && vf < 8 && vf >= 0 && T.accel > 14 && !dead) this.skid = Math.max(this.skid, 0.4); // burnout

    // steering
    const steerLimit = T.steer / (1 + Math.abs(vf) / 26);
    this.steerAngle = damp(this.steerAngle, c.steer * steerLimit, 9, dt);
    const wheelbase = T.len * 0.62;
    let yaw = -(vf * Math.tan(this.steerAngle)) / wheelbase;
    if (c.handbrake && Math.abs(vf) > 4) yaw *= 1.6;
    this.angVel = damp(this.angVel, yaw, c.handbrake ? 4 : 7, dt);

    this.vx = fx * vf + rx * vr;
    this.vz = fz * vf + rz * vr;
    this.heading += this.angVel * dt;
    this.prevVf = vf;

    this.integrate(dt, surf);
  }

  integrate(dt, surf) {
    const G = this.G;
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    // static collisions
    let best = null;
    for (const [cx, cz, r] of this.circles()) {
      const res = G.colliders.resolveCircle(cx, cz, r, this.pos.y + 0.6);
      if (res.hit) {
        const dx = res.x - cx, dz = res.z - cz;
        if (!best || res.depth > best.depth) best = { dx, dz, nx: res.nx, nz: res.nz, depth: res.depth, ox: cx - this.pos.x, oz: cz - this.pos.z };
      }
    }
    if (best) {
      this.pos.x += best.dx;
      this.pos.z += best.dz;
      const vn = this.vx * best.nx + this.vz * best.nz;
      if (vn < 0) {
        this.vx -= 1.35 * vn * best.nx;
        this.vz -= 1.35 * vn * best.nz;
        this.vx *= 0.85;
        this.vz *= 0.85;
        const torque = (best.ox * best.nz - best.oz * best.nx) * vn * 0.08;
        this.angVel += clamp(torque, -2, 2);
        if (-vn > 4) this.onImpact(-vn, null);
      }
    }
    // ground and water
    surf = surf || G.layout.surfaceAt(this.pos.x, this.pos.z);
    this.inWater = surf.type === 'water';
    const gh = this.inWater ? WATER_Y - 1.0 : surf.h;
    if (this.pos.y > gh + 0.05) {
      this.vy -= 18 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y < gh) { this.pos.y = gh; this.vy = 0; }
    } else {
      this.pos.y = this.inWater ? Math.max(gh, this.pos.y - dt * 0.8) : gh;
      this.vy = 0;
    }
    if (this.inWater) {
      this.sinkT += dt;
      this.vx *= Math.exp(-1.2 * dt);
      this.vz *= Math.exp(-1.2 * dt);
      if (this.sinkT > 0.4 && this.G.fx && Math.random() < 0.3) this.G.fx.particles.splash(this.pos.x, WATER_Y + 0.2, this.pos.z);
    } else this.sinkT = 0;
  }

  onImpact(speed, other) {
    if (this.hitCooldown > 0) return;
    this.hitCooldown = 0.25;
    const dmg = (speed - 3) * 14;
    this.damage(dmg, { type: 'crash', attacker: other && other.driver ? other.driver : null });
    this.G.events.emit('vehicleImpact', { vehicle: this, speed, other });
  }

  damage(amount, info = {}) {
    if (this.mode === 'wreck' || amount <= 0) return;
    this.health -= amount;
    if (info.attacker) this.lastHitBy = info.attacker;
    if (this.health <= 0) {
      this.health = 0;
      if (info.type === 'crash' && amount < 200) this.burnT = Math.max(this.burnT, 0.01); // catches fire, then blows
      else this.explode(info);
    }
  }

  explode(info = {}) {
    if (this.mode === 'wreck') return;
    const G = this.G;
    this.mode = 'wreck';
    this.health = 0;
    this.sirenOn = false;
    setWrecked(this.model);
    this.vy = 6;
    this.angVel += (G.rng() - 0.5) * 3;
    G.events.emit('vehicleDestroyed', { vehicle: this, attacker: info.attacker || this.lastHitBy || null });
    if (G.combat) G.combat.explosion(this.pos.clone().setY(this.pos.y + 1), 8, 140, info.attacker || this.lastHitBy || null, this);
    this.wreckT = 0;
  }

  update(dt) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const G = this.G;
    if (this.mode === 'wreck') {
      this.wreckT = (this.wreckT || 0) + dt;
      this.vx *= Math.exp(-2 * dt);
      this.vz *= Math.exp(-2 * dt);
      this.angVel *= Math.exp(-2 * dt);
      this.heading += this.angVel * dt;
      this.integrate(dt);
      if (this.wreckT < 25 && G.fx && Math.random() < dt * 14) {
        G.fx.particles.smoke(this.pos.x, this.pos.y + 1.4, this.pos.z, 1.2, 0.18);
        if (this.wreckT < 10) G.fx.particles.fire(this.pos.x + (Math.random() - 0.5), this.pos.y + 1.1, this.pos.z + (Math.random() - 0.5), 0.9);
      }
      return;
    }
    // burning: smoke when hurt, fire when critical, explode after a fuse
    const hp = this.health / this.maxHealth;
    if (G.fx && hp < 0.45 && Math.random() < dt * (hp < 0.2 ? 18 : 6)) {
      const hx = this.pos.x + this.fx * this.T.len * 0.38, hz = this.pos.z + this.fz * this.T.len * 0.38;
      G.fx.particles.smoke(hx, this.pos.y + this.T.hgt * 0.8, hz, 0.6, hp < 0.2 ? 0.35 : 0.6);
      if (hp < 0.2) G.fx.particles.fire(hx, this.pos.y + this.T.hgt * 0.7, hz, 0.5);
    }
    if (hp < 0.12 && this.burnT === 0) this.burnT = 0.01;
    if (this.burnT > 0) {
      this.burnT += dt;
      if (this.burnT > 6) this.explode({ attacker: this.lastHitBy });
    }
  }

  updateVisual(dt, camPos) {
    const m = this.model;
    const far = camPos && (Math.abs(camPos.x - this.pos.x) > 260 || Math.abs(camPos.z - this.pos.z) > 260);
    m.root.visible = !far;
    if (far) return;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.heading;
    const vf = this.speed;
    const T = this.T;
    // body roll and pitch
    const targetRoll = T.bike ? clamp(this.angVel * vf * 0.05, -0.7, 0.7) : clamp(-this.angVel * vf * 0.012, -0.09, 0.09);
    this.roll = damp(this.roll, targetRoll, 6, dt);
    const accel = this.mode === 'physics' ? (vf - (this.lastVf ?? vf)) / Math.max(dt, 1e-3) : 0;
    this.lastVf = vf;
    this.pitch = damp(this.pitch, clamp(-accel * 0.004, -0.05, 0.05), 5, dt);
    m.body.rotation.set(this.pitch, 0, this.roll);
    if (this.mode === 'wreck') m.body.rotation.set(0.05, 0, 0.08);
    if (this.inWater) m.body.rotation.x = Math.min(0.25, this.sinkT * 0.1);
    for (const w of m.wheels) {
      if (w.front) w.pivot.rotation.y = -this.steerAngle;
      w.mesh.rotation.x += (vf / T.wheelR) * dt;
    }
    if (T.bike) m.root.rotation.z = 0;
    const braking = this.mode !== 'wreck' && (this.controls.brake > 0 && vf > 0.5 || (this.mode === 'rail' && this.rail && this.rail.braking));
    const night = this.G.sky ? this.G.sky.night : 0;
    m.tailMat.emissiveIntensity = this.mode === 'wreck' ? 0 : braking ? 2.4 : 0.3 + night * 0.9;
    const glow = night > 0.35 && this.mode !== 'wreck' && this.mode !== 'parked';
    for (const g of m.glows) g.visible = glow;
    if (m.lightbar) {
      const on = this.sirenOn && this.mode !== 'wreck';
      this.lightPhase += dt * 9;
      const a = Math.sin(this.lightPhase) > 0;
      m.lightbar.red.color.setHex(on && a ? 0xff3040 : 0x401010);
      m.lightbar.blue.color.setHex(on && !a ? 0x4070ff : 0x101040);
      m.lightbar.gr.visible = on && a;
      m.lightbar.gb.visible = on && !a;
    }
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.G.scene.remove(this.model.root);
    this.model.tailMat.dispose();
  }
}
