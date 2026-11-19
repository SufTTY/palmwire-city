// Ambient traffic: cars that follow their lane along the road graph, turn through junctions on
// smooth curves, stop at red lights, queue behind each other, brake (and honk) for people and
// the player, and get "released" into full physics when hit, shot or carjacked - at which
// point the driver bails out and runs.
import { HALF_ROAD, CELL } from '../world/cityLayout.js';
import { bezier, bezierTangent, bezierLength } from './roadNetwork.js';
import { TRAFFIC_TYPES } from '../entities/vehicleTypes.js';
import { civilianLook } from '../entities/characterLooks.js';

export class TrafficSystem {
  constructor(G, network, signals) {
    this.G = G;
    this.net = network;
    this.signals = signals;
    this.cars = [];
    this.max = 24;
    this.spawnTimer = 0;
    this.bailouts = [];
  }

  laneCurve(node, link) {
    const a = this.net.lanePoint(node, link, HALF_ROAD);
    const b = this.net.lanePoint(node, link, CELL - HALF_ROAD);
    return [a, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, b];
  }

  spawnAt(spot, type) {
    const G = this.G;
    const T = type || TRAFFIC_TYPES[Math.floor(G.rng() * TRAFFIC_TYPES.length)];
    const heading = Math.atan2(spot.link.dx, spot.link.dz);
    const v = G.vehicles.spawn(T, { x: spot.x, z: spot.z, heading, mode: 'rail' });
    const curve = this.laneCurve(spot.node, spot.link);
    v.rail = {
      node: spot.node, link: spot.link, phase: 'lane', curve, len: bezierLength(curve),
      t: spot.along - HALF_ROAD, speed: 9, cruise: 10 + G.rng() * 4, braking: false, blockedT: 0,
    };
    v.driverKind = 'traffic';
    this.cars.push(v);
    return v;
  }

  trySpawn() {
    const G = this.G;
    const p = G.player.pos;
    const spot = this.net.randomLaneSpot(G.rng, p.x, p.z, 70, 210);
    if (!spot) return;
    for (const v of G.vehicles.list) if (Math.hypot(v.pos.x - spot.x, v.pos.z - spot.z) < 14) return;
    this.spawnAt(spot);
  }

  /** Detach a car from its lane: it becomes a free physics body; the driver may flee. */
  release(v, panic) {
    if (v.mode !== 'rail') return;
    v.mode = 'physics';
    v.rail = null;
    v.controls.throttle = 0;
    v.controls.brake = 0.4;
    v.controls.steer = 0;
    const i = this.cars.indexOf(v);
    if (i >= 0) this.cars.splice(i, 1);
    if (v.driverKind === 'traffic' && panic) this.bailouts.push({ v, t: 1.2 + this.G.rng() * 1.5 });
  }

  /** The player yanks the driver out: spawns them beside the door, running. */
  carjack(v) {
    this.release(v, false);
    return this.ejectDriver(v);
  }

  ejectDriver(v) {
    if (v.driverKind !== 'traffic') return null;
    v.driverKind = null;
    const G = this.G;
    const side = -1;
    const x = v.pos.x + Math.cos(v.heading) * side * -(v.T.wid / 2 + 0.9);
    const z = v.pos.z - Math.sin(v.heading) * side * -(v.T.wid / 2 + 0.9);
    if (!G.peds) return null;
    const ped = G.peds.spawnPed(x, z, civilianLook(G.rng, 'midtown'));
    ped.panic(v.pos, 10);
    return ped;
  }

  update(dt) {
    const G = this.G;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.cars.length < this.max) {
      this.spawnTimer = 0.35;
      this.trySpawn();
    }
    for (let k = this.bailouts.length - 1; k >= 0; k--) {
      const b = this.bailouts[k];
      b.t -= dt;
      if (b.t <= 0) {
        this.bailouts.splice(k, 1);
        if (!b.v.removed && b.v !== G.player.vehicle && b.v.mode !== 'wreck') this.ejectDriver(b.v);
      }
    }
    const p = G.player.pos;
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const v = this.cars[k];
      if (v.removed || v.mode !== 'rail') { this.cars.splice(k, 1); continue; }
      if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) > 260) {
        this.cars.splice(k, 1);
        G.vehicles.remove(v);
        continue;
      }
      this.drive(v, dt);
    }
  }

  drive(v, dt) {
    const G = this.G;
    const r = v.rail;
    let target = r.cruise;
    const fx = v.fx, fz = v.fz;
    // obstacles ahead: vehicles and people
    let gap = Infinity;
    for (const o of G.vehicles.list) {
      if (o === v) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > 22) continue;
      const lat = Math.abs(dx * -fz + dz * fx);
      if (lat > 2.3) continue;
      gap = Math.min(gap, along - (v.T.len + o.T.len) / 2);
    }
    let personAhead = false;
    for (const c of G.characters) {
      if (c.inVehicle || !c.alive) continue;
      const dx = c.pos.x - v.pos.x, dz = c.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > 12) continue;
      if (Math.abs(dx * -fz + dz * fx) > 1.8) continue;
      gap = Math.min(gap, along - v.T.len / 2 - 1);
      personAhead = true;
    }
    if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - 2.5) * 1.2));
    // traffic signal at the end of the lane
    if (r.phase === 'lane') {
      const remain = r.len - r.t;
      const next = this.net.node(r.link.to);
      if (next && this.signals.isSignalized(next.id) && remain < 26) {
        const st = this.signals.state(next.id, r.link.dx !== 0 ? 'h' : 'v');
        if (st === 'red' || (st === 'amber' && remain > 9)) target = Math.min(target, Math.max(0, (remain - 1) * 0.8));
      }
    } else target = Math.min(target, 8);

    r.braking = target < r.speed - 0.5;
    const accel = target > r.speed ? 5 : 14;
    r.speed += Math.sign(target - r.speed) * Math.min(Math.abs(target - r.speed), accel * dt);
    // impatient honk when the player blocks the road
    if (r.speed < 0.5 && gap < 6) {
      r.blockedT += dt;
      if (r.blockedT > 2.5 && G.audio && G.rng() < dt * 0.6 && !personAhead) G.audio.sfx.horn(v.pos, 0.6);
    } else r.blockedT = 0;

    r.t += r.speed * dt;
    while (r.t >= r.len) {
      r.t -= r.len;
      this.advance(v);
    }
    const u = r.t / r.len;
    const pt = bezier(r.curve, u);
    const tg = bezierTangent(r.curve, u);
    v.setRailPose(pt.x, pt.z, Math.atan2(tg.x, tg.z), r.speed);
    v.steerAngle = r.phase === 'turn' ? -0.3 * Math.sign(tg.x * fz - tg.z * fx) : 0;
  }

  advance(v) {
    const r = v.rail;
    const node = this.net.node(r.link.to);
    if (r.phase === 'lane') {
      // choose the next road at the junction (no U-turn unless it is a dead end)
      const options = node.links.filter((l) => !(l.dx === -r.link.dx && l.dz === -r.link.dz));
      const pick = options.length ? options[Math.floor(this.G.rng() * options.length)] : node.links[0];
      r.curve = this.net.turnCurve(node, r.link.dx, r.link.dz, pick);
      r.len = bezierLength(r.curve);
      r.phase = 'turn';
      r.turnNode = node;
      r.nextLink = pick;
    } else {
      r.node = r.turnNode;
      r.link = r.nextLink;
      r.curve = this.laneCurve(r.node, r.link);
      r.len = bezierLength(r.curve);
      r.phase = 'lane';
    }
  }
}
