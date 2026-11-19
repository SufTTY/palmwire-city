// The wanted level: crimes add heat, heat maps to 0-5 stars, and the stars fade only when no
// officer, cruiser or the helicopter has had eyes on the player for long enough. Tracks the
// last known position the police search around (shown on the minimap).
import * as THREE from 'three';

const THRESH = [0, 1, 6, 14, 26, 42];

export class WantedLevel {
  constructor(G) {
    this.G = G;
    this.heat = 0;
    this.stars = 0;
    this.seen = false;
    this.unseenT = 0;
    this.lastSeen = new THREE.Vector3();
    this.locked = false; // missions / screenshot scenes may pin the level
    const isPlayer = (c) => c && c === G.player.char;
    G.events.on('characterKilled', (e) => {
      if (!isPlayer(e.attacker)) return;
      if (e.victim.faction === 'cop') this.add(9, 2, e.victim.pos);
      else if (e.victim.faction === 'civ') this.add(3.2, 1, e.victim.pos);
      else this.add(0.6, 0, e.victim.pos);
    });
    G.events.on('characterHurt', (e) => {
      if (!isPlayer(e.attacker) || !e.victim.alive) return;
      if (e.victim.faction === 'cop') this.add(3, 2, e.victim.pos);
      else if (e.victim.faction === 'civ') this.add(0.5, 1, e.victim.pos);
    });
    G.events.on('shotFired', (e) => {
      if (!e.isPlayer) return;
      if (this.heat < 2 && this.witnessed(e.pos, 45)) this.add(0.35, 1, e.pos);
    });
    G.events.on('pedHitByCar', (e) => {
      if (isPlayer(e.driver)) this.add(e.victim.faction === 'cop' ? 5 : 1.5, 1, e.victim.pos);
    });
    G.events.on('vehicleDestroyed', (e) => {
      if (!isPlayer(e.attacker)) return;
      this.add(e.vehicle.T.police ? 7 : 2, 1, e.vehicle.pos);
    });
    G.events.on('vehicleImpact', (e) => {
      const pv = G.player.vehicle;
      if (!pv || !e.other) return;
      if (e.vehicle.T.police && e.other === pv && e.speed > 6) this.add(1.2, 1, pv.pos);
    });
  }

  /** Is anyone (civilians count as witnesses who call it in, cops directly) close enough? */
  witnessed(pos, radius) {
    for (const c of this.G.characters) {
      if (!c.alive || c.faction === 'player' || c.faction === 'gang') continue;
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < radius) return true;
    }
    return false;
  }

  /** Report a crime that only counts if police see it (carjacking, stealing a parked car). */
  report(kind, pos) {
    const G = this.G;
    let copNear = false;
    for (const c of G.characters) if (c.faction === 'cop' && c.alive && c.pos.distanceTo(pos) < 50) copNear = true;
    for (const v of G.police.cars) if (v.pos.distanceTo(pos) < 50) copNear = true;
    if (kind === 'carjack' && (copNear || G.rng() < 0.35)) this.add(1.2, 1, pos);
    if (kind === 'steal' && copNear) this.add(1, 1, pos);
  }

  add(heat, minStars, pos) {
    if (this.locked) return;
    this.heat = Math.max(this.heat + heat, THRESH[Math.min(5, minStars)] + (minStars ? 0.01 : 0));
    this.heat = Math.min(this.heat, 60);
    if (pos) this.lastSeen.copy(pos);
    this.seen = true;
    this.unseenT = 0;
  }

  setStars(n, lock = false) {
    this.heat = n > 0 ? THRESH[n] + 0.5 : 0;
    this.stars = n;
    this.locked = lock;
    this.seen = n > 0;
    this.unseenT = 0;
    this.lastSeen.copy(this.G.player.pos);
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.locked = false;
    this.unseenT = 0;
  }

  get evadeTime() { return 7 + this.stars * 2.5; }

  update(dt) {
    const G = this.G;
    let s = 0;
    for (let k = 5; k >= 0; k--) if (this.heat >= THRESH[k]) { s = k; break; }
    const prev = this.stars;
    this.stars = s;
    if (s > prev && G.hud) G.hud.flashStars();
    if (s === 0) { this.seen = false; return; }
    const pp = G.player.pos;
    const sight = 28 + s * 12;
    let seen = false;
    const eye = (x, y, z, range) => Math.hypot(x - pp.x, z - pp.z) < range && G.colliders.lineOfSight(x, y, z, pp.x, pp.y + 1.2, pp.z);
    for (const v of G.police.cars) if (!v.isWreck && eye(v.pos.x, v.pos.y + 1.5, v.pos.z, sight)) { seen = true; break; }
    if (!seen) for (const o of G.police.officers) if (o.alive && eye(o.pos.x, o.pos.y + 1.6, o.pos.z, sight)) { seen = true; break; }
    if (!seen && G.police.heli && G.police.heli.active) {
      const h = G.police.heli.pos;
      if (eye(h.x, h.y - 2, h.z, 75)) seen = true;
    }
    this.seen = seen;
    if (seen) {
      this.unseenT = 0;
      this.lastSeen.copy(pp);
    } else if (!this.locked) {
      this.unseenT += dt;
      if (this.unseenT > this.evadeTime) {
        this.clear();
        G.events.emit('wantedCleared', {});
      }
    }
  }
}
