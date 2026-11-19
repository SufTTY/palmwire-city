// Hostile crews (the Gullcrest Kings, Marrow Company muscle): squads that loiter until they
// spot the player or hear gunfire, then close in, strafe and shoot. Missions and the rampage
// side job spawn them and count the bodies.
import { Character } from '../entities/character.js';
import { gangLook } from '../entities/characterLooks.js';

class Gangster extends Character {
  constructor(G, x, z, opts) {
    super(G, (opts.look || gangLook)(G.rng), { faction: opts.faction || 'gang', health: opts.health || 70, x, z, heading: G.rng() * 6.28 });
    this.weaponKey = opts.weapon || 'pistol';
    this.setWeapon(this.weaponKey);
    this.alerted = !!opts.alerted;
    this.cooldown = 1 + G.rng();
    this.strafe = G.rng() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.squad = opts.squad;
    this.accuracy = opts.accuracy ?? 0.45;
    this.home = { x, z };
    this.deadT = 0;
  }

  onHurt() {
    if (this.squad) this.squad.alert();
    this.alerted = true;
  }

  think(dt) {
    const G = this.G;
    if (!this.alive) { this.deadT += dt; return; }
    const target = G.player.char;
    if (!target.alive) { this.pose = 'idle'; this.steer(0, 0, 6, dt); return; }
    const tp = target.inVehicle ? target.inVehicle.pos : target.pos;
    const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (!this.alerted) {
      this.pose = 'idle';
      this.steer(0, 0, 6, dt);
      if (d < 26 && G.colliders.lineOfSight(this.pos.x, this.pos.y + 1.6, this.pos.z, tp.x, tp.y + 1.4, tp.z)) {
        this.alerted = true;
        if (this.squad) this.squad.alert();
      }
      return;
    }
    const ang = Math.atan2(dx, dz);
    const los = d < 70 && G.colliders.lineOfSight(this.pos.x, this.pos.y + 1.5, this.pos.z, tp.x, tp.y + 1.3, tp.z);
    this.faceToward(ang, 10, dt);
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 1 + G.rng() * 2; this.strafe = -this.strafe; }
    const nx = dx / (d || 1), nz = dz / (d || 1);
    let vx, vz;
    if (!los || d > 22) { vx = nx * 4.6; vz = nz * 4.6; this.pose = 'idle'; }
    else {
      const close = d < 7 ? -1 : 0.2;
      vx = -nz * this.strafe * 2.2 + nx * close * 2;
      vz = nx * this.strafe * 2.2 + nz * close * 2;
      this.pose = 'aim';
    }
    this.steer(vx, vz, 6, dt);
    this.cooldown -= dt;
    if (los && d < 45 && this.cooldown <= 0) {
      const rate = { pistol: 0.9, smg: 0.22, shotgun: 1.4 }[this.weaponKey] || 1;
      this.cooldown = rate * (0.8 + G.rng() * 0.8);
      G.combat.npcFire(this, target, this.weaponKey, this.accuracy);
    }
  }
}

export class GangSystem {
  constructor(G) {
    this.G = G;
    this.list = [];
  }

  /** Spawn `count` hostiles around a point. Returns a squad object with alive/dead helpers. */
  spawnSquad(center, count, opts = {}) {
    const G = this.G;
    const squad = {
      members: [],
      alert() { for (const m of this.members) m.alerted = true; },
      get alive() { return this.members.filter((m) => m.alive).length; },
      get dead() { return this.members.filter((m) => !m.alive).length; },
    };
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + G.rng() * 0.5;
      const r = (opts.radius ?? 5) * (0.5 + G.rng() * 0.6);
      let x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      const fix = G.colliders.resolveCircle(x, z, 0.5, 1);
      x = fix.x; z = fix.z;
      const weapon = Array.isArray(opts.weapons) ? opts.weapons[k % opts.weapons.length] : opts.weapon;
      const m = new Gangster(G, x, z, { ...opts, weapon, squad });
      squad.members.push(m);
      this.list.push(m);
    }
    return squad;
  }

  clear() {
    for (const m of this.list) m.remove();
    this.list.length = 0;
  }

  update(dt) {
    const p = this.G.player.pos;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const m = this.list[k];
      m.think(dt);
      m.physics(dt);
      const far = Math.hypot(m.pos.x - p.x, m.pos.z - p.z) > 260;
      if ((!m.alive && m.deadT > 40) || m.removed || (far && !m.alive)) {
        m.remove();
        this.list.splice(k, 1);
      }
    }
  }
}
