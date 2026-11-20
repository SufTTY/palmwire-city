// A person in the world: position, facing, health and armour, locomotion with collision
// against buildings and water, a walk-cycle phase, knock-downs and death.
import * as THREE from 'three';
import { SIDEWALK_Y, BEACH_Z0, CITY, PIER_X } from '../config.js';
import { dampAngle } from '../core/mathUtil.js';

/** Height of the walkable surface: road, kerb, sand, boardwalk or pier deck. */
export function groundHeight(layout, x, z) {
  if (layout.isOnRoad(x, z)) return 0;
  if (z > BEACH_Z0) {
    if (z < BEACH_Z0 + 11 && x < 640) return 0.12;             // boardwalk
    if (Math.abs(x - PIER_X) < 16 && z > BEACH_Z0 + 11) return 0.12; // pier
    return -0.05;
  }
  if (x < 0 || z < 0 || x > CITY) return -0.05;
  return SIDEWALK_Y;
}

let nextId = 1;

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4226, 0xd9a066];
const HAIRS = [0x2a1a10, 0x4a2e1a, 0x0f0f0f, 0xc9a35a, 0x7a3b1c, 0x9a9a9a, 0x3a2a20];
const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xf7fff7, 0x1a535c, 0xff9f1c, 0x2ec4b6, 0xe71d36, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xfee440, 0xffffff, 0x8ac926];
const PANTS = [0x2b2d42, 0x3d405b, 0x8d99ae, 0x6b705c, 0x1d3557, 0xa68a64, 0x222222, 0xe9d8a6];

export function randomLook(rng) {
  return {
    skin: rng.pick(SKINS), hair: rng.pick(HAIRS), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    cap: rng.chance(0.2) ? rng.pick(SHIRTS) : null,
  };
}

export class Human {
  constructor(game, { x = 0, z = 0, yaw = 0, role = 'ped', look, health = 100 } = {}) {
    this.game = game;
    this.id = nextId++;
    this.role = role;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.look = look;
    this.health = health;
    this.maxHealth = health;
    this.armour = 0;
    this.alive = true;
    this.radius = 0.38;
    this.phase = Math.random() * 6;
    this.stride = 0;
    this.pose = 'idle';
    this.aimPitch = 0;
    this.gun = false;
    this.gunLong = false;
    this.twoHanded = false;
    this.vehicle = null;
    this.downTimer = 0;
    this.deadTime = 0;
    this.vy = 0;
    this.grounded = true;
    this.lastAttacker = null;
    this.hitFlash = 0;
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  /**
   * Accelerates toward a desired horizontal velocity and moves with collision.
   * faceYaw: optional yaw to face (aiming) instead of the movement direction.
   */
  locomote(dt, wantX, wantZ, faceYaw = null, accel = 12) {
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wantX - this.vel.x) * k;
    this.vel.z += (wantZ - this.vel.z) * k;
    this.moveWithCollision(dt);
    const sp = this.speed;
    if (faceYaw !== null) this.yaw = dampAngle(this.yaw, faceYaw, 18, dt);
    else if (sp > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
    this.phase += dt * (sp * 1.9 + 0.001);
    this.stride = Math.min(1.0, sp / 6) * 0.9;
  }

  moveWithCollision(dt) {
    const g = this.game;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    g.colliders.resolveCircle(this.pos, this.radius, this.pos.y);
    if (g.layout.isWater(this.pos.x, this.pos.z)) { this.pos.x = ox; this.pos.z = oz; this.vel.x *= -0.2; this.vel.z *= -0.2; }
    const b = g.layout.worldBounds();
    this.pos.x = Math.max(b.x0, Math.min(b.x1, this.pos.x));
    this.pos.z = Math.max(b.z0, Math.min(b.z1, this.pos.z));
    // vertical: jump arc and kerb height
    const groundY = groundHeight(g.layout, this.pos.x, this.pos.z);
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= groundY) { this.pos.y = groundY; this.vy = 0; this.grounded = true; }
    } else {
      this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * 20);
    }
  }

  /** Applies damage, armour first. Returns true if this hit killed. */
  damage(amount, attacker = null, kind = 'bullet') {
    if (!this.alive) return false;
    this.lastAttacker = attacker;
    this.hitFlash = 0.15;
    if (this.armour > 0 && kind !== 'fall') {
      const absorbed = Math.min(this.armour, amount * 0.7);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    if (this.health <= 0) { this.health = 0; this.die(attacker, kind); return true; }
    return false;
  }

  die(attacker, kind) {
    this.alive = false;
    this.pose = 'dead';
    this.deadTime = 0;
    this.vel.set(0, 0, 0);
    this.game.events.emit('death', { human: this, attacker, kind });
  }

  /** Knocked over by a car or explosion; gets up after a while if still alive. */
  knockDown(vx, vz, seconds = 2.0) {
    this.vel.x = vx; this.vel.z = vz;
    this.downTimer = seconds;
  }

  updateDown(dt) {
    if (this.downTimer <= 0) return false;
    this.downTimer -= dt;
    this.vel.multiplyScalar(Math.exp(-3 * dt));
    this.moveWithCollision(dt);
    return true;
  }

  /** Data for the instanced renderer. */
  renderState() {
    return this;
  }
}
