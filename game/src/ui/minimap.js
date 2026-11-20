// The radar: a pre-rendered top-down city map (roads, blocks, water, parks) that rotates with
// the camera inside a round frame, with blips for missions, police, vehicles and the
// police search circle. The same base image feeds the full-screen map.
import { BLOCK, GRID, CITY, ROAD_HALF, CANAL_COL, BEACH_Z0, SHORE_Z, EAST_SHORE_X, PIER_X, PIER_END_Z } from '../config.js';

const SCALE = 1.4;               // pixels per metre on the base map
const ORIGIN = { x: -200, z: -200 };
const SIZE_X = Math.ceil((EAST_SHORE_X + 420) * SCALE), SIZE_Z = Math.ceil((PIER_END_Z + 260) * SCALE);
const DISTRICT_TINT = { park: '#3f7a3a', residential: '#5d6b4c', downtown: '#5a5e6e', midtown: '#6a6058', beach: '#a08c64', docks: '#5a5450', canal: '#3a6f8f' };

export const BLIP_COLORS = { mission: '#ffd23f', objective: '#2ee6c8', enemy: '#ff4060', race: '#ff5fd2', job: '#6dff8a', rampage: '#ff4060', police: '#4da3ff', vehicle: '#2ee6c8', save: '#7fb2ff', garage: '#ffa040' };

export function buildBaseMap(layout) {
  const c = document.createElement('canvas');
  c.width = SIZE_X; c.height = SIZE_Z;
  const g = c.getContext('2d');
  const X = (x) => (x - ORIGIN.x) * SCALE, Z = (z) => (z - ORIGIN.z) * SCALE;
  // sea
  g.fillStyle = '#1d5f86'; g.fillRect(0, 0, SIZE_X, SIZE_Z);
  // land
  g.fillStyle = '#4f6b3f'; g.fillRect(0, 0, X(EAST_SHORE_X), Z(SHORE_Z));
  g.fillStyle = '#d9c38f'; g.fillRect(0, Z(BEACH_Z0), X(CANAL_COL * BLOCK + ROAD_HALF), Z(SHORE_Z) - Z(BEACH_Z0));
  g.fillStyle = '#6d6a64'; g.fillRect(X((CANAL_COL + 1) * BLOCK - ROAD_HALF), Z(BEACH_Z0), X(EAST_SHORE_X) - X((CANAL_COL + 1) * BLOCK - ROAD_HALF), Z(SHORE_Z - 40) - Z(BEACH_Z0));
  // blocks
  for (const b of layout.blocks) {
    const r = layout.blockRect(b.bx, b.bz);
    if (b.district === 'canal') {
      g.fillStyle = '#9a968c'; g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * SCALE, (r.z1 - r.z0) * SCALE);
      g.fillStyle = '#2a7aa8'; g.fillRect(X(r.x0 + 3), Z(r.z0 + 3), (r.x1 - r.x0 - 6) * SCALE, (r.z1 - r.z0 - 6) * SCALE);
      continue;
    }
    g.fillStyle = DISTRICT_TINT[b.district];
    g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * SCALE, (r.z1 - r.z0) * SCALE);
  }
  // canal mouth
  g.fillStyle = '#2a7aa8';
  g.fillRect(X(CANAL_COL * BLOCK + ROAD_HALF), Z(BEACH_Z0 + 3), (BLOCK - ROAD_HALF * 2) * SCALE, Z(SHORE_Z + 40) - Z(BEACH_Z0 + 3));
  // building footprints
  g.fillStyle = 'rgba(20,20,28,0.35)';
  for (const b of layout.buildings) if (b.y0 === 0) g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * SCALE, (b.z1 - b.z0) * SCALE);
  // roads
  g.fillStyle = '#e9e4da';
  for (let k = 0; k <= GRID; k++) {
    const c0 = k * BLOCK;
    g.fillRect(X(-ROAD_HALF), Z(c0 - ROAD_HALF), (CITY + ROAD_HALF * 2) * SCALE, ROAD_HALF * 2 * SCALE);
    g.fillRect(X(c0 - ROAD_HALF), Z(-ROAD_HALF), ROAD_HALF * 2 * SCALE, (CITY + ROAD_HALF * 2) * SCALE);
  }
  g.fillStyle = '#ffcf6b';
  g.fillRect(X(-ROAD_HALF), Z(CITY - ROAD_HALF), (CITY + ROAD_HALF * 2) * SCALE, ROAD_HALF * 2 * SCALE); // Sunline Blvd
  g.fillRect(X(5 * BLOCK - ROAD_HALF), Z(-ROAD_HALF), ROAD_HALF * 2 * SCALE, (CITY + ROAD_HALF * 2) * SCALE); // Broadwire Ave
  // pier and boardwalk
  g.fillStyle = '#a0764c';
  g.fillRect(X(PIER_X - 5), Z(BEACH_Z0 + 4), 10 * SCALE, Z(PIER_END_Z) - Z(BEACH_Z0 + 4));
  g.fillRect(X(PIER_X - 16), Z(PIER_END_Z - 40), 32 * SCALE, 40 * SCALE);
  g.fillRect(X(-80), Z(BEACH_Z0 + 4), X(CANAL_COL * BLOCK) - X(-80), 7 * SCALE);
  return { canvas: c, X, Z, scale: SCALE };
}

export class Minimap {
  constructor(game, canvas, base) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = base;
    this.zoom = 1.0;
    this.t = 0;
  }

  draw(dt) {
    const g = this.game, ctx = this.ctx, cv = this.canvas;
    this.t += dt;
    const W = cv.width, H = cv.height, R = W / 2;
    const f = g.player.focus;
    const v = g.player.human.vehicle;
    const targetZoom = v ? 0.62 - Math.min(0.22, v.speed / 150) : 0.8;
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 2);
    const k = this.zoom; // canvas px per base px
    const rot = g.cameraRig.lookYaw - Math.PI; // rotate so the camera's forward points up
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1d5f86'; ctx.fillRect(0, 0, W, H);
    ctx.translate(R, R);
    ctx.rotate(rot);
    ctx.scale(k, k);
    ctx.drawImage(this.base.canvas, -this.base.X(f.x), -this.base.Z(f.z));
    const S = this.base.scale;
    const toLocal = (x, z) => [(x - f.x) * S, (z - f.z) * S];
    // police search zone
    const w = g.wanted;
    if (w.stars > 0) {
      const [cx, cz] = toLocal(w.lkp.x, w.lkp.z);
      ctx.beginPath(); ctx.arc(cx, cz, w.searchRadius * S, 0, Math.PI * 2);
      const pulse = 0.18 + 0.1 * Math.sin(this.t * 6);
      ctx.fillStyle = w.seen ? `rgba(255,40,70,${pulse})` : `rgba(60,140,255,${pulse})`;
      ctx.fill();
      ctx.lineWidth = 2 / k; ctx.strokeStyle = w.seen ? 'rgba(255,80,100,.9)' : 'rgba(110,170,255,.9)'; ctx.stroke();
    }
    // gps line to the objective
    const blips = this.collectBlips();
    const target = blips.find((b) => b.gps);
    if (target) {
      const [tx, tz] = toLocal(target.x, target.z);
      ctx.setLineDash([6 / k, 5 / k]);
      ctx.strokeStyle = BLIP_COLORS[target.kind] || '#fff'; ctx.lineWidth = 3 / k;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, tz); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    // blips drawn unrotated so icons stay upright; clamp to the rim
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (const b of blips) {
      let [lx, lz] = toLocal(b.x, b.z);
      let px = (lx * cos - lz * sin) * k, pz = (lx * sin + lz * cos) * k;
      const d = Math.hypot(px, pz);
      const edge = d > R - 9;
      if (edge) { if (!b.always) continue; px *= (R - 9) / d; pz *= (R - 9) / d; }
      this.blip(R + px, R + pz, b, edge);
    }
    // player arrow
    ctx.save();
    ctx.translate(R, R);
    const heading = (v ? v.yaw : g.player.human.yaw);
    ctx.rotate(rot - heading + Math.PI);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // north marker
    const nx = R + (R - 12) * sin, nz = R - (R - 12) * cos;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(nx, nz, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx, nz + 1);
  }

  collectBlips() {
    const g = this.game, out = [];
    for (const b of g.missions.blips()) out.push({ ...b, always: true, gps: !!g.missions.active, big: true });
    if (!g.missions.active) {
      out.push({ ...g.saveGame.door, kind: 'save', always: true, letter: 'S' });
      if (g.garage.unlocked) out.push({ x: 544, z: 622, kind: 'garage', always: true, letter: 'G' });
    }
    for (const u of g.police.units) {
      if (u.vehicle && !u.vehicle.destroyed && u.mode !== 'leave') out.push({ x: u.vehicle.pos.x, z: u.vehicle.pos.z, kind: 'police', flash: true });
      for (const o of u.officers) if (o.alive && !o.inCar) out.push({ x: o.pos.x, z: o.pos.z, kind: 'police', small: true });
    }
    if (g.police.heli.active) out.push({ x: g.police.heli.pos.x, z: g.police.heli.pos.z, kind: 'police', letter: 'H', always: true });
    for (const h of g.gangs.list) if (h.alive && h.alerted) out.push({ x: h.pos.x, z: h.pos.z, kind: 'enemy', small: true });
    return out;
  }

  blip(x, y, b, edge) {
    const ctx = this.ctx;
    let color = BLIP_COLORS[b.kind] || '#fff';
    if (b.flash && Math.floor(this.t * 4) % 2) color = '#ff3050';
    const r = b.small ? 3 : b.big ? 7 : 5.5;
    ctx.fillStyle = color; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (b.kind === 'mission' || b.kind === 'objective') { ctx.moveTo(x, y - r - 2); ctx.lineTo(x + r + 1, y); ctx.lineTo(x, y + r + 2); ctx.lineTo(x - r - 1, y); ctx.closePath(); }
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (b.letter && !edge) { ctx.fillStyle = '#111'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.letter, x, y + 0.5); }
  }
}
