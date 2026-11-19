// The Palmwire City Police Department's response: cruisers that route along the road graph to
// the player's last known position and ram at close range, officers who jump out to arrest or
// shoot, roadblocks from three stars, the helicopter from four, and the arrest ("cuffed")
// check. Units peel off and despawn once the stars are gone.
import { Character } from '../entities/character.js';
import { copLook } from '../entities/characterLooks.js';
import { PoliceHeli } from './policeHeli.js';
import { angleDiff, clamp } from '../core/mathUtil.js';
import { HALF_ROAD } from '../world/cityLayout.js';

const CARS_FOR_STARS = [0, 1, 2, 3, 4, 5];

export class PoliceSystem {
  constructor(G, network) {
    this.G = G;
    this.net = network;
    this.cars = [];
    this.officers = [];
    this.heli = new PoliceHeli(G);
    this.spawnTimer = 0;
    this.roadblockTimer = 12;
    this.bustT = 0;
  }

  makeOfficer(x, z) {
    const o = new Character(this.G, copLook(this.G.rng), { faction: 'cop', health: 90, x, z });
    o.setWeapon('pistol');
    o.ai = { cooldown: 1 + this.G.rng(), strafe: 1, strafeT: 0, idleT: 0 };
    o.armour = 20;
    this.officers.push(o);
    return o;
  }

  spawnCruiser(x, z, heading, { parked = false } = {}) {
    const G = this.G;
    const v = G.vehicles.spawn('police', { x, z, heading, mode: parked ? 'parked' : 'physics' });
    v.sirenOn = true;
    v.persistent = false;
    v.ai = { waypoint: null, current: null, stuckT: 0, reverseT: 0, deployed: parked };
    v.crew = 2;
    this.cars.push(v);
    return v;
  }

  trySpawnCruiser() {
    const G = this.G;
    const p = G.player.pos;
    const spot = this.net.randomLaneSpot(G.rng, p.x, p.z, 90, 190, 30);
    if (!spot) return;
    const v = this.spawnCruiser(spot.x, spot.z, Math.atan2(spot.link.dx, spot.link.dz));
    v.vx = Math.sin(v.heading) * 10;
    v.vz = Math.cos(v.heading) * 10;
  }

  /** Two cruisers across the road a couple of blocks ahead of the player, officers behind. */
  placeRoadblock() {
    const G = this.G;
    const pv = G.player.vehicle;
    const p = G.player.pos;
    const hx = pv ? pv.fx : Math.sin(G.player.char.heading), hz = pv ? pv.fz : Math.cos(G.player.char.heading);
    const ahead = { x: p.x + hx * 140, z: p.z + hz * 140 };
    const n = this.net.nearestNode(ahead.x, ahead.z);
    if (!n || Math.hypot(n.x - p.x, n.z - p.z) < 70) return;
    // block the approach the player is most likely to use
    let best = n.links[0], bd = -Infinity;
    for (const l of n.links) {
      const s = -(l.dx * hx + l.dz * hz);
      if (s > bd) { bd = s; best = l; }
    }
    const cx = n.x + best.dx * (HALF_ROAD + 10), cz = n.z + best.dz * (HALF_ROAD + 10);
    const across = Math.atan2(-best.dz, best.dx);
    for (const s of [-1, 1]) {
      const x = cx - best.dz * s * 3.2, z = cz + best.dx * s * 3.2;
      this.spawnCruiser(x, z, across + (s > 0 ? 0.2 : -0.2), { parked: true });
    }
    for (const s of [-1, 1]) this.makeOfficer(cx + best.dx * 4 - best.dz * s * 4, cz + best.dz * 4 + best.dx * s * 4);
    if (G.hud) G.hud.notify('Roadblock ahead!');
  }

  update(dt) {
    const G = this.G;
    const stars = G.wanted.stars;
    const p = G.player.pos;
    const active = this.cars.filter((v) => !v.isWreck && v.mode === 'physics').length;
    this.spawnTimer -= dt;
    if (stars > 0 && active < CARS_FOR_STARS[stars] && this.spawnTimer <= 0) {
      this.spawnTimer = 5 - stars * 0.6;
      this.trySpawnCruiser();
    }
    if (stars >= 3) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0 && G.player.vehicle) {
        this.roadblockTimer = 28 - stars * 2;
        this.placeRoadblock();
      }
    }
    if (stars >= 4 && !this.heli.active) this.heli.activate(p);
    if (stars < 3 && this.heli.active && !G.wanted.locked) this.heli.deactivate();
    this.heli.update(dt);

    for (let k = this.cars.length - 1; k >= 0; k--) {
      const v = this.cars[k];
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      if (v.removed || (d > 280 && v !== G.player.vehicle) || (stars === 0 && d > 140 && v !== G.player.vehicle)) {
        this.cars.splice(k, 1);
        if (!v.removed && v !== G.player.vehicle) G.vehicles.remove(v);
        continue;
      }
      if (v === G.player.vehicle) { v.sirenOn = false; this.cars.splice(k, 1); continue; }
      if (v.isWreck) continue;
      v.sirenOn = stars > 0;
      if (v.mode === 'physics' && v.ai) this.driveCruiser(v, dt, stars);
    }
    for (let k = this.officers.length - 1; k >= 0; k--) {
      const o = this.officers[k];
      const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
      if (o.removed || d > 180 || (!o.alive && (o.deathT > 40)) || (stars === 0 && d > 90)) {
        o.remove();
        this.officers.splice(k, 1);
        continue;
      }
      this.thinkOfficer(o, dt, stars);
      o.physics(dt);
    }
    this.checkArrest(dt, stars);
  }

  driveCruiser(v, dt, stars) {
    const G = this.G;
    const c = v.controls;
    if (stars === 0) {
      c.throttle = 0.4; c.brake = 0; c.steer = 0; c.handbrake = false;
      return;
    }
    const pl = G.player;
    const goal = G.wanted.seen ? pl.pos : G.wanted.lastSeen;
    const dx = goal.x - v.pos.x, dz = goal.z - v.pos.z;
    const d = Math.hypot(dx, dz);
    // deploy officers when the suspect is on foot nearby
    if (!pl.vehicle && d < 16 && !v.ai.deployed) {
      c.throttle = 0; c.brake = 1; c.steer = 0;
      if (v.absSpeed < 2) {
        v.ai.deployed = true;
        for (let k = 0; k < v.crew; k++) {
          const side = k === 0 ? 1 : -1;
          this.makeOfficer(v.pos.x + Math.cos(v.heading) * side * 1.8, v.pos.z - Math.sin(v.heading) * side * 1.8);
        }
      }
      return;
    }
    if (v.ai.deployed) {
      c.throttle = 0; c.brake = 1;
      if (pl.vehicle && d > 30) v.ai.deployed = false; // suspect drove off: give chase again (crew stays)
      return;
    }
    let aimX = goal.x, aimZ = goal.z;
    if (d > 50) {
      const here = this.net.nearestNode(v.pos.x, v.pos.z);
      const there = this.net.nearestNode(goal.x, goal.z);
      if (!v.ai.waypoint || Math.hypot(v.ai.waypoint.x - v.pos.x, v.ai.waypoint.z - v.pos.z) < 10) {
        const from = v.ai.waypoint || here;
        v.ai.waypoint = this.net.node(this.net.nextToward(from.id, there.id));
      }
      // cruisers run down the middle of the road with sirens on, junction to junction
      aimX = v.ai.waypoint.x;
      aimZ = v.ai.waypoint.z;
    } else {
      v.ai.waypoint = null;
      const tv = pl.vehicle;
      if (tv) { aimX += tv.vx * 0.6; aimZ += tv.vz * 0.6; }
    }
    const want = Math.atan2(aimX - v.pos.x, aimZ - v.pos.z);
    const err = angleDiff(v.heading, want);
    const sp = v.speed;
    if (v.ai.reverseT > 0) {
      v.ai.reverseT -= dt;
      c.throttle = 0; c.brake = 1; c.steer = clamp(err * 2, -1, 1); c.handbrake = false;
      return;
    }
    c.steer = clamp(-err * 2.2, -1, 1);
    const cap = v.T.maxSpeed * (0.62 + stars * 0.07);
    const sharp = Math.abs(err) > 0.7 && sp > 16;
    c.throttle = sharp || sp > cap ? 0 : 1;
    c.brake = sharp ? 0.6 : 0;
    c.handbrake = Math.abs(err) > 1.3 && sp > 10;
    if (Math.abs(err) > 2.4 && sp < 6) { c.throttle = 0; c.brake = 1; c.steer = -c.steer; }
    // stuck against something: back up
    if (c.throttle > 0 && Math.abs(sp) < 1.2) v.ai.stuckT += dt; else v.ai.stuckT = 0;
    if (v.ai.stuckT > 1.4) { v.ai.stuckT = 0; v.ai.reverseT = 1.3; }
  }

  thinkOfficer(o, dt, stars) {
    const G = this.G;
    if (!o.alive) return;
    const pl = G.player;
    const target = pl.char;
    const tp = pl.pos;
    const dx = tp.x - o.pos.x, dz = tp.z - o.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (stars === 0 || !target.alive) {
      o.pose = 'idle';
      o.steer(0, 0, 6, dt);
      return;
    }
    const los = d < 60 && G.colliders.lineOfSight(o.pos.x, o.pos.y + 1.6, o.pos.z, tp.x, tp.y + 1.3, tp.z);
    o.faceToward(Math.atan2(dx, dz), 9, dt);
    const nx = dx / d, nz = dz / d;
    const shooting = stars >= 2 || pl.char.model.weapon && pl.char.model.weapon !== 'fists' && pl.aiming;
    if (!los || d > (shooting ? 18 : 2)) {
      const run = d > 12 ? 5.2 : 3.4;
      o.steer(nx * run, nz * run, 6, dt);
      o.pose = 'idle';
    } else {
      o.ai.strafeT -= dt;
      if (o.ai.strafeT <= 0) { o.ai.strafeT = 1.5 + G.rng() * 2; o.ai.strafe = -o.ai.strafe; }
      o.steer(-nz * o.ai.strafe * 1.8, nx * o.ai.strafe * 1.8, 6, dt);
      o.pose = shooting ? 'aim' : 'idle';
    }
    o.ai.cooldown -= dt;
    if (shooting && los && d < 40 && o.ai.cooldown <= 0) {
      o.ai.cooldown = 0.9 + G.rng() * 0.9 - stars * 0.08;
      G.combat.npcFire(o, target, stars >= 4 ? 'smg' : 'pistol', 0.35 + stars * 0.08);
    }
  }

  /** Cuffed: an officer is right on top of a slow-moving player (or their stopped car). */
  checkArrest(dt, stars) {
    const G = this.G;
    const pl = G.player;
    if (stars === 0 || !pl.char.alive || G.wanted.locked) { this.bustT = 0; return; }
    let close = false;
    for (const o of this.officers) {
      if (!o.alive) continue;
      const d = Math.hypot(o.pos.x - pl.pos.x, o.pos.z - pl.pos.z);
      if (!pl.vehicle && d < 2.2 && pl.char.speed < 2.6) close = true;
      if (pl.vehicle && d < 3.6 && pl.vehicle.absSpeed < 1 && stars <= 3) close = true;
    }
    if (pl.vehicle && pl.vehicle.absSpeed < 0.8 && stars <= 2) {
      for (const v of this.cars) if (!v.isWreck && v.pos.distanceTo(pl.pos) < 6) close = true;
    }
    this.bustT = close ? this.bustT + dt : Math.max(0, this.bustT - dt * 2);
    if (this.bustT > (pl.vehicle ? 2.4 : 1.4)) {
      this.bustT = 0;
      G.respawn.busted();
    }
  }

  clearAll() {
    for (const v of this.cars) if (v !== this.G.player.vehicle) this.G.vehicles.remove(v);
    this.cars.length = 0;
    for (const o of this.officers) o.remove();
    this.officers.length = 0;
    this.heli.deactivate();
  }
}
