// A person in the world (player, pedestrian, cop or gang member): movement with collision,
// ground following, jumping and swimming, health and armour, getting knocked down by cars,
// dying, and driving the procedural animation. AI or the player controller decides intent.
import * as THREE from 'three';
import { buildCharacterModel, animateCharacter, setCharacterWeapon } from './characterModel.js';
import { WATER_Y } from '../world/cityLayout.js';

const GRAVITY = 18;

export class Character {
  constructor(G, look, { faction = 'civ', health = 100, x = 0, z = 0, heading = 0 } = {}) {
    this.G = G;
    this.model = buildCharacterModel(look);
    G.scene.add(this.model.root);
    this.pos = new THREE.Vector3(x, G.layout.groundHeight(x, z), z);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = heading;
    this.radius = 0.35;
    this.height = 1.9;
    this.health = health;
    this.maxHealth = health;
    this.armour = 0;
    this.alive = true;
    this.faction = faction;
    this.phase = 0;
    this.pose = 'idle';
    this.aimPitch = 0;
    this.punchT = 0;
    this.knockT = 0;
    this.deathT = 0;
    this.hurtT = 0;
    this.inWater = false;
    this.onGround = true;
    this.inVehicle = null;
    this.removed = false;
    this.lastAttacker = null;
    G.characters.push(this);
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z); }
  setWeapon(kind) { setCharacterWeapon(this.model, kind); }

  /** Ease the horizontal velocity toward a desired one. */
  steer(dvx, dvz, accel, dt) {
    if (this.knockT > 0 || !this.alive) return;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (dvx - this.vel.x) * k;
    this.vel.z += (dvz - this.vel.z) * k;
  }

  faceToward(angle, rate, dt) {
    let d = angle - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (1 - Math.exp(-rate * dt));
  }

  jump(v = 5.4) {
    if (this.onGround && !this.inWater && this.knockT <= 0) {
      this.vy = v;
      this.onGround = false;
      return true;
    }
    return false;
  }

  physics(dt) {
    if (this.inVehicle) return;
    const G = this.G;
    if (this.knockT > 0) this.knockT -= dt;
    if (!this.alive) {
      this.vel.multiplyScalar(Math.exp(-4 * dt));
    }
    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.z * dt;
    const r = G.colliders.resolveCircle(nx, nz, this.radius, this.pos.y + 0.6);
    if (r.hit) {
      nx = r.x;
      nz = r.z;
      const vn = this.vel.x * r.nx + this.vel.z * r.nz;
      if (vn < 0) { this.vel.x -= vn * r.nx; this.vel.z -= vn * r.nz; }
    }
    this.pos.x = nx;
    this.pos.z = nz;
    const surf = G.layout.surfaceAt(nx, nz);
    this.inWater = surf.type === 'water';
    const gh = this.inWater ? WATER_Y - 0.3 : surf.h;
    if (this.pos.y > gh + 0.02 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      this.onGround = false;
    }
    if (this.pos.y <= gh) {
      if (this.vy < -14 && this.alive) this.takeDamage((-this.vy - 14) * 6, { type: 'fall' });
      this.pos.y = this.inWater ? Math.min(gh, this.pos.y + 3 * dt) : gh;
      if (!this.inWater || this.pos.y >= gh - 0.01) this.vy = 0;
      this.onGround = true;
    } else if (this.pos.y - gh < 0.25 && this.vy <= 0) {
      this.pos.y = gh; // walk down curbs and slopes without a hop
      this.vy = 0;
      this.onGround = true;
    }
  }

  takeDamage(amount, info = {}) {
    if (!this.alive || amount <= 0) return;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, amount * 0.75);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.hurtT = 0.25;
    this.lastAttacker = info.attacker || null;
    this.G.events.emit('characterHurt', { victim: this, ...info });
    if (this.onHurt) this.onHurt(info);
    if (this.health <= 0) this.die(info);
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.deathT = 0;
    this.setWeapon(null);
    const G = this.G;
    if (G.fx) G.fx.marks.bloodPool(this.pos.x, this.pos.y, this.pos.z);
    G.events.emit('characterKilled', { victim: this, attacker: info.attacker || null, weapon: info.weapon || info.type || null });
  }

  /** Thrown by a car or explosion. */
  knockback(vx, vz, vy) {
    this.vel.set(vx, 0, vz);
    this.vy = vy;
    this.knockT = 1.1;
    this.onGround = false;
  }

  updateModel(dt, camPos) {
    const root = this.model.root;
    const far = camPos && (Math.abs(camPos.x - this.pos.x) > 170 || Math.abs(camPos.z - this.pos.z) > 170);
    const v = this.inVehicle;
    if (v && v.T.bike && !v.isWreck) {
      // riders stay visible, seated on the bike and leaning with it
      root.visible = !far;
      root.position.set(v.pos.x, v.pos.y + 0.12, v.pos.z);
      root.position.x -= Math.sin(v.heading) * 0.35;
      root.position.z -= Math.cos(v.heading) * 0.35;
      root.rotation.set(0, v.heading, 0);
      root.rotateZ(v.roll);
      animateCharacter(this.model, 'ride', 0, 0);
      return;
    }
    root.visible = !v && !far;
    if (!root.visible) return;
    root.position.copy(this.pos);
    root.rotation.set(0, this.heading, 0);
    if (!this.alive) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT * 2.6);
      root.rotation.x = -(Math.PI / 2) * (t * t * (3 - 2 * t));
      root.position.y += 0.14 * t;
      return;
    }
    if (this.knockT > 0) {
      root.rotation.x = -Math.min(1.5, (1.1 - this.knockT) * 4);
      root.position.y += 0.15;
      return;
    }
    this.phase += this.speed * dt * 1.7;
    if (this.punchT > 0) this.punchT = Math.max(0, this.punchT - dt * 3);
    const pose = this.inWater ? 'swim' : this.pose;
    if (this.inWater) this.phase += dt * 3;
    animateCharacter(this.model, pose, this.speed, this.phase, this.aimPitch, Math.sin(this.punchT * Math.PI));
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.G.scene.remove(this.model.root);
    const list = this.G.characters;
    const i = list.indexOf(this);
    if (i >= 0) list.splice(i, 1);
  }
}
