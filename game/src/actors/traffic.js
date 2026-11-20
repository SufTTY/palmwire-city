// Civilian traffic: keeps a capped population of AI cars driving the lanes around the
// player, spawning them out of sight and retiring them when far away or wrecked.
import { AIDriver } from './aiDriver.js';
import { pickCivilianType } from './vehicleTypes.js';
import { randomLook } from './human.js';
import { Rng } from '../core/rng.js';

export class TrafficSystem {
  constructor(game, { cap = 22 } = {}) {
    this.game = game;
    this.cap = cap;
    this.rng = new Rng(game.seed * 7 + 2);
    this.cars = [];
    this.spawnTimer = 0;
  }

  nextRandom = (prev, cur) => this.game.roadGraph.randomNext(prev, cur, this.rng);

  /** Spawn one AI car on a lane slot. */
  spawnAt(slot, typeKey = null) {
    const g = this.game;
    const type = typeKey || pickCivilianType(this.rng);
    const v = g.vehicles.spawn(type, { x: slot.x, z: slot.z, yaw: slot.yaw });
    const ai = new AIDriver(g, v, { a: slot.a, b: slot.b, nextNode: this.nextRandom, cruise: this.rng.range(10.5, 14.5) });
    v.npcDriver = randomLook(this.rng);
    const f = v.forward;
    v.vel.set(f.x * ai.cruise * 0.7, 0, f.z * ai.cruise * 0.7);
    v.traffic = true;
    this.cars.push(v);
    return v;
  }

  visibleFromCamera(p) {
    const cam = this.game.camera;
    const dx = p.x - cam.position.x, dz = p.z - cam.position.z;
    const d = Math.hypot(dx, dz);
    const fwdX = -Math.sin(this.game.cameraRig.yaw), fwdZ = -Math.cos(this.game.cameraRig.yaw);
    return (dx * fwdX + dz * fwdZ) / (d || 1) > 0.5 && d < 160;
  }

  update(dt) {
    const g = this.game;
    const focus = g.player.focus;
    // retire cars that left the area, were abandoned, or got wrecked
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const v = this.cars[i];
      const d = Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z);
      const hijacked = v.driver === g.player.human || !v.ai;
      if (hijacked) { this.cars.splice(i, 1); v.traffic = false; continue; }
      if (d > 270 || (v.destroyed && d > 80) || (v.ai && v.ai.stuck > 0 && d > 120 && !this.visibleFromCamera(v.pos))) {
        this.cars.splice(i, 1);
        if (!v.persistent) g.vehicles.remove(v);
        continue;
      }
      if (v.ai && !v.destroyed) v.ai.update(dt);
    }
    this.spawnTimer -= dt;
    if (this.cars.length < this.cap && this.spawnTimer <= 0) {
      this.spawnTimer = 0.25;
      const avoid = (p) => {
        if (this.visibleFromCamera(p) && Math.hypot(p.x - focus.x, p.z - focus.z) < 120) return true;
        for (const o of g.vehicles.list) if (Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 12) return true;
        return false;
      };
      const slot = g.roadGraph.spawnSlot(focus.x, focus.z, this.rng, 70, 210, avoid);
      if (slot) this.spawnAt(slot);
    }
  }

  /** Make nearby drivers floor it (gunfire, explosions, police chases). */
  panicNear(x, z, radius) {
    for (const v of this.cars) {
      if (v.ai && Math.hypot(v.pos.x - x, v.pos.z - z) < radius) v.ai.panic = 6;
    }
  }

  /** Called when the player drags the driver out. */
  release(v) {
    const i = this.cars.indexOf(v);
    if (i >= 0) this.cars.splice(i, 1);
    if (v.ai) v.ai = null;
    v.traffic = false;
  }
}
