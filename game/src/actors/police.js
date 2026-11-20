// Palmwire City PD response: dispatches cruisers scaled to the wanted level, routes them
// through the streets, switches to ramming and flanking up close, deploys officers who
// shoot or arrest, sets roadblocks at three stars, calls in the air unit at four, and
// decides when the player is busted.
import { AIDriver } from './aiDriver.js';
import { CombatAI } from './combatAI.js';
import { Human } from './human.js';
import { PoliceHeli } from './policeHeli.js';
import { Rng } from '../core/rng.js';
import { BLOCK, CITY } from '../config.js';

const CALLSIGNS = ['MARLIN', 'HERON', 'GULL', 'TARPON', 'EGRET', 'SNAPPER', 'PELICAN', 'BARRACUDA'];
const COP_LOOK = () => ({ skin: [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69][Math.floor(Math.random() * 4)], hair: 0x1a1a1a, shirt: 0x1d3a6e, sleeve: 0x1d3a6e, pants: 0x14213d, cap: 0x14213d });
const UNITS_FOR_STARS = [0, 1, 2, 3, 4, 5];

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.rng = new Rng(game.seed * 17 + 5);
    this.units = [];
    this.spawnTimer = 0;
    this.roadblockTimer = 8;
    this.bustTimer = 0;
    this.callsignN = 0;
    this.heli = new PoliceHeli(game);
    this.officers = [];   // all cop humans (for rendering / hit tests)
  }

  get heliActive() { return this.heli.active; }

  newCallsign() {
    const n = this.callsignN++;
    return CALLSIGNS[n % CALLSIGNS.length] + ' ' + (1 + ((n * 7) % 9)) + (n >= CALLSIGNS.length ? '-' + Math.floor(n / CALLSIGNS.length) : '');
  }

  routeToPlayer = (prev, cur) => {
    const g = this.game, rg = g.roadGraph;
    const t = g.wanted.seen || g.wanted.stars === 0 ? g.player.focus : g.wanted.lkp;
    const goal = rg.nearestNode(t.x, t.z);
    const r = rg.route(cur, goal);
    let n = r[1];
    if (n === undefined || n === prev) n = rg.randomNext(prev, cur, this.rng);
    return n;
  };

  spawnCruiser(slot, mode = 'drive') {
    const g = this.game;
    const v = g.vehicles.spawn('interceptor', { x: slot.x, z: slot.z, yaw: slot.yaw });
    v.siren = mode !== 'roadblock';
    v.persistent = true;
    const unit = { vehicle: v, officers: [], callsign: this.newCallsign(), mode, tactic: 'RESPONDING', flank: this.units.length % 2 ? 1 : -1, footTimer: 0 };
    v.police = unit;
    if (mode === 'drive') {
      unit.ai = new AIDriver(g, v, { a: slot.a, b: slot.b, nextNode: this.routeToPlayer, cruise: 24, obeySignals: false, caution: 0.6 });
      const f = v.forward;
      v.vel.set(f.x * 14, 0, f.z * 14);
    }
    for (let i = 0; i < 2; i++) {
      const h = new Human(g, { x: v.pos.x, z: v.pos.z, role: 'cop', look: COP_LOOK(), health: 90 });
      h.armour = 20;
      h.vehicle = mode === 'roadblock' ? null : v;
      h.inCar = mode !== 'roadblock';
      h.unit = unit;
      h.combat = new CombatAI(g, h, { weapon: g.wanted.stars >= 4 && i === 1 ? 'smg' : 'pistol', skill: 0.35 + g.wanted.stars * 0.08, damageMul: 0.38 });
      unit.officers.push(h);
      this.officers.push(h);
    }
    this.units.push(unit);
    return unit;
  }

  /** Called when the player takes a police car. */
  abandonVehicle(v) {
    const u = v.police;
    if (!u) return;
    u.vehicle = null;
    u.ai = null;
    v.police = null;
    v.persistent = false;
    v.siren = false;
    for (const o of u.officers) { o.inCar = false; o.vehicle = null; }
    u.mode = 'foot';
  }

  anyUnitSees(x, z, range) {
    const g = this.game;
    if (this.heli.sees(x, z)) return true;
    for (const u of this.units) {
      const pts = [];
      if (u.vehicle && !u.vehicle.destroyed) pts.push(u.vehicle.pos);
      for (const o of u.officers) if (o.alive && !o.inCar) pts.push(o.pos);
      for (const p of pts) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < range && !g.colliders.blocked(p.x, p.z, x, z, 1.6)) return true;
      }
    }
    return false;
  }

  deployOfficers(u) {
    const v = u.vehicle;
    u.officers.forEach((o, i) => {
      if (!o.alive || !o.inCar) return;
      const r = v.right, side = i === 0 ? -1 : 1, d = v.type.wid / 2 + 0.8;
      o.pos.set(v.pos.x + r.x * d * side, 0, v.pos.z + r.z * d * side);
      o.inCar = false; o.vehicle = null;
    });
    u.mode = 'foot';
    v.controls.throttle = 0; v.controls.brake = 1;
  }

  boardOfficers(u) {
    for (const o of u.officers) if (o.alive) { o.inCar = true; o.vehicle = u.vehicle; }
    u.mode = 'drive';
    if (!u.ai) u.ai = new AIDriver(this.game, u.vehicle, { nextNode: this.routeToPlayer, cruise: 24, obeySignals: false, caution: 0.6 });
    u.ai.reanchor();
  }

  placeRoadblock() {
    const g = this.game, rg = g.roadGraph;
    const pv = g.player.human.vehicle;
    if (!pv || pv.speed < 8) return;
    const dir = { x: pv.vel.x / pv.speed, z: pv.vel.z / pv.speed };
    const ahead = { x: pv.pos.x + dir.x * 150, z: pv.pos.z + dir.z * 150 };
    if (ahead.x < 0 || ahead.z < 0 || ahead.x > CITY || ahead.z > CITY) return;
    const node = rg.nearestNode(ahead.x, ahead.z);
    const np = rg.pos(node);
    // approach axis: the dominant direction of travel
    const ax = Math.abs(dir.x) > Math.abs(dir.z) ? { x: Math.sign(dir.x), z: 0 } : { x: 0, z: Math.sign(dir.z) };
    const cx = np.x - ax.x * 16, cz = np.z - ax.z * 16;
    if (Math.hypot(cx - pv.pos.x, cz - pv.pos.z) < 70) return;
    const yaw = Math.atan2(ax.x, ax.z) + Math.PI / 2;
    for (const s of [-1, 1]) {
      const slot = { x: cx + ax.z * 2.9 * s, z: cz - ax.x * 2.9 * s, yaw: yaw + (s > 0 ? 0.25 : -0.2) };
      const u = this.spawnCruiser(slot, 'roadblock');
      u.tactic = 'ROADBLOCK';
      u.officers.forEach((o, i) => {
        o.pos.set(cx - ax.x * (4 + i * 1.5) + ax.z * (s * 3 + i), 0, cz - ax.z * (4 + i * 1.5) - ax.x * (s * 3 + i));
        o.combat.goal = { x: o.pos.x, z: o.pos.z };
      });
    }
    g.hud && g.hud.notify('Roadblock reported ahead on ' + g.layout.streetAt(cx, cz), 'police');
    void BLOCK;
  }

  update(dt) {
    const g = this.game, stars = g.wanted.stars, focus = g.player.focus;
    const player = g.player.human;
    // helicopter
    if (stars >= 4 && !this.heli.active) this.heli.activate(true);
    if (stars < 4 && this.heli.active) this.heli.activate(false);
    this.heli.update(dt);

    // dispatch
    const driving = this.units.filter((u) => u.mode !== 'roadblock' && u.mode !== 'leave' && u.vehicle && !u.vehicle.destroyed).length;
    this.spawnTimer -= dt;
    if (stars > 0 && driving < UNITS_FOR_STARS[stars] && this.spawnTimer <= 0) {
      this.spawnTimer = 3.5 - stars * 0.4;
      const avoid = (p) => g.traffic.visibleFromCamera(p) && Math.hypot(p.x - focus.x, p.z - focus.z) < 130;
      const slot = g.roadGraph.spawnSlot(focus.x, focus.z, this.rng, 110, 210, avoid);
      if (slot) this.spawnCruiser(slot);
    }
    if (stars >= 3) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) { this.roadblockTimer = 30 - stars * 3; this.placeRoadblock(); }
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!this.updateUnit(u, dt, stars)) {
        this.units.splice(i, 1);
        if (u.vehicle) { u.vehicle.persistent = false; u.vehicle.police = null; if (!u.vehicle.driver) g.vehicles.remove(u.vehicle); }
        for (const o of u.officers) { const k = this.officers.indexOf(o); if (k >= 0) this.officers.splice(k, 1); }
      }
    }
    // dead officers linger a while, then go
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i];
      if (!o.alive) { o.deadTime += dt; if (o.deadTime > 20) this.officers.splice(i, 1); }
    }
    this.updateBust(dt, stars, player);
  }

  /** Returns false when the unit should be removed. */
  updateUnit(u, dt, stars) {
    const g = this.game, v = u.vehicle, player = g.player.human;
    const focus = g.player.focus;
    const ref = v || u.officers.find((o) => o.alive) || null;
    if (!ref) return false;
    const rp = ref.pos;
    const dist = Math.hypot(rp.x - focus.x, rp.z - focus.z);
    if (stars === 0 && u.mode !== 'leave') {
      u.mode = 'leave'; u.tactic = 'RETURNING';
      if (v) { v.siren = false; for (const o of u.officers) if (o.alive && !o.inCar) { o.inCar = true; o.vehicle = v; } }
      if (u.ai) { u.ai.direct = null; u.ai.nextNode = (p, c) => g.roadGraph.randomNext(p, c, this.rng); u.ai.cruise = 12; u.ai.obeySignals = true; u.ai.reanchor(); }
    }
    if (dist > 320 || (u.mode === 'leave' && dist > 140)) return false;
    if (v && v.destroyed && u.officers.every((o) => !o.alive || o.inCar)) return dist < 150;

    // keep riders in the car
    for (const o of u.officers) if (o.inCar && v) { o.pos.copy(v.pos); o.yaw = v.yaw; }

    if (u.mode === 'leave') { if (u.ai) u.ai.update(dt); return true; }

    if (u.mode === 'roadblock') {
      u.tactic = 'ROADBLOCK';
      for (const o of u.officers) if (o.alive && !o.inCar) o.combat.update(dt, player);
      if (dist > 220) return false;
      return true;
    }

    if (u.mode === 'drive' && v && !v.destroyed) {
      const seen = g.wanted.seen;
      const los = dist < 60 && !g.colliders.blocked(v.pos.x, v.pos.z, focus.x, focus.z, 1.2);
      const pv = player.vehicle;
      if (pv && los && seen) {
        const lead = Math.min(1.2, dist / 25);
        let tx = pv.pos.x + pv.vel.x * lead, tz = pv.pos.z + pv.vel.z * lead;
        if (dist > 16 && u.flank) {
          const r = pv.right;
          tx += r.x * 5 * u.flank; tz += r.z * 5 * u.flank;
          u.tactic = 'FLANKING';
        } else u.tactic = 'RAMMING';
        if (!u.ai.direct) u.ai.direct = { x: tx, z: tz };
        u.ai.direct.x = tx; u.ai.direct.z = tz;
        u.ai.directSpeed = Math.max(24, Math.min(v.type.maxSpeed, pv.speed + 14));
      } else if (!pv && player.alive && dist < 40 && los) {
        // pull up near the suspect and get out
        u.ai.direct = { x: focus.x, z: focus.z };
        u.ai.directSpeed = Math.max(4, Math.min(22, (dist - 9) * 1.4));
        u.tactic = 'CLOSING IN';
        if (dist < 15 && v.speed < 6) this.deployOfficers(u);
      } else {
        if (u.ai.direct) { u.ai.direct = null; u.ai.reanchor(); }
        u.tactic = seen ? 'PURSUIT' : 'SEARCHING';
        u.ai.cruise = seen ? 26 : 16;
      }
      if (u.ai) u.ai.update(dt);
      return true;
    }

    // on foot (or car wrecked)
    u.tactic = stars >= 2 ? 'FIRING' : 'ARRESTING';
    for (const o of u.officers) {
      if (!o.alive || o.inCar) continue;
      o.combat.arrest = stars <= 1 && !player.vehicle;
      o.combat.update(dt, player);
    }
    // back to the car when the suspect drives off
    if (player.vehicle && v && !v.destroyed) {
      const allNear = u.officers.every((o) => !o.alive || Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z) < 3.5);
      if (dist > 22) {
        for (const o of u.officers) if (o.alive && !o.inCar) {
          const dx = v.pos.x - o.pos.x, dz = v.pos.z - o.pos.z, l = Math.hypot(dx, dz) || 1;
          o.locomote(dt, dx / l * 6, dz / l * 6);
          o.pose = 'run';
        }
        if (allNear) this.boardOfficers(u);
      }
    }
    return true;
  }

  updateBust(dt, stars, player) {
    const g = this.game;
    if (stars === 0 || !player.alive || g.respawn.active) { this.bustTimer = 0; return; }
    let close = false;
    if (!player.vehicle) {
      for (const o of this.officers) if (o.alive && !o.inCar && Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < 2.2) close = true;
      if (close && (stars <= 2 || player.speed < 1.5) && !g.player.aiming) this.bustTimer += dt; else this.bustTimer = Math.max(0, this.bustTimer - dt);
      if (this.bustTimer > 1.4) { this.bustTimer = 0; g.events.emit('busted', {}); }
    } else {
      const pv = player.vehicle;
      for (const u of this.units) if (u.vehicle && !u.vehicle.destroyed && Math.hypot(u.vehicle.pos.x - pv.pos.x, u.vehicle.pos.z - pv.pos.z) < 7.5) close = true;
      for (const o of this.officers) if (o.alive && !o.inCar && Math.hypot(o.pos.x - pv.pos.x, o.pos.z - pv.pos.z) < 3.5) close = true;
      if (close && pv.speed < 1.5) this.bustTimer += dt; else this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      if (this.bustTimer > 2.6) { this.bustTimer = 0; g.events.emit('busted', {}); }
    }
  }

  /** Units sorted by distance for the HUD response panel. */
  panel() {
    const f = this.game.player.focus;
    const rows = [];
    for (const u of this.units) {
      const ref = u.vehicle && !u.vehicle.destroyed ? u.vehicle : u.officers.find((o) => o.alive);
      if (!ref || u.mode === 'leave') continue;
      rows.push({ callsign: u.callsign, dist: Math.hypot(ref.pos.x - f.x, ref.pos.z - f.z), tactic: u.tactic });
    }
    if (this.heli.active) rows.push({ callsign: this.heli.callsign, dist: Math.hypot(this.heli.pos.x - f.x, this.heli.pos.z - f.z), tactic: 'SPOTLIGHT', air: true });
    rows.sort((a, b) => a.dist - b.dist);
    return rows;
  }

  clearAll() {
    const g = this.game;
    for (const u of this.units) if (u.vehicle && !u.vehicle.driver) g.vehicles.remove(u.vehicle);
    this.units.length = 0;
    this.officers.length = 0;
    this.heli.activate(false);
  }
}
