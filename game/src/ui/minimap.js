// The radar: a rotating, zooming slice of the pre-painted city map with the GPS route to the
// current objective, the police search area, and blips for police, hostiles, mission givers,
// the safehouse, side jobs and pickups. The same overlay draws the full map in the pause menu.
import { renderCityMap, MAP_MIN, PX_PER_M } from './cityMapImage.js';

const GIVER_COLORS = { coral: '#ff5a8a', dex: '#ffb43a', race: '#3dc5ff', taxi: '#2bb3a6', rampage: '#ff3b3b' };
const GIVER_LABELS = { coral: 'C', dex: 'D', race: 'R', taxi: 'T', rampage: '!' };

export class Minimap {
  constructor(G, canvas) {
    this.G = G;
    this.canvas = canvas;
    this.size = 440; // backing pixels (shown at 220 css px)
    canvas.width = canvas.height = this.size;
    this.g = canvas.getContext('2d');
    this.map = renderCityMap(G.layout, G.colliders);
    this.route = [];
    this.routeTimer = 0;
  }

  computeRoute() {
    const G = this.G;
    const t = G.missions && G.missions.gpsTarget;
    if (!t) { this.route = []; return; }
    const a = G.roads.nearestNode(G.player.pos.x, G.player.pos.z);
    const b = G.roads.nearestNode(t.x, t.z);
    if (!a || !b) { this.route = []; return; }
    this.route = G.roads.route(a.id, b.id).map((n) => ({ x: n.x, z: n.z }));
    this.route.unshift({ x: G.player.pos.x, z: G.player.pos.z });
    this.route.push({ x: t.x, z: t.z });
  }

  update(dt) {
    const G = this.G;
    this.routeTimer -= dt;
    if (this.routeTimer <= 0) { this.routeTimer = 0.5; this.computeRoute(); }
    const g = this.g;
    const S = this.size, C = S / 2;
    const pp = G.player.pos;
    const v = G.player.vehicle;
    const metresShown = 150 + (v ? Math.min(140, v.absSpeed * 3) : 0);
    const pxPerM = C / metresShown;
    const rot = G.cam.yaw + Math.PI;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const toScreen = (x, z) => {
      const dx = (x - pp.x) * pxPerM, dz = (z - pp.z) * pxPerM;
      return [C + dx * cs - dz * sn, C + dx * sn + dz * cs];
    };
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath();
    g.arc(C, C, C, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#2f7a96';
    g.fillRect(0, 0, S, S);
    g.translate(C, C);
    g.rotate(rot);
    const k = pxPerM / PX_PER_M;
    g.scale(k, k);
    g.translate(-(pp.x - MAP_MIN) * PX_PER_M, -(pp.z - MAP_MIN) * PX_PER_M);
    g.drawImage(this.map, 0, 0);
    g.restore();
    g.save();
    g.beginPath();
    g.arc(C, C, C, 0, Math.PI * 2);
    g.clip();
    this.drawOverlay(g, toScreen, pxPerM, C - 14, rot);
    g.restore();
    // north marker on the rim
    // world north (-z) rotated onto the screen
    const r = C - 18;
    const nx = C + sn * r, ny = C - cs * r;
    g.fillStyle = 'rgba(10,14,20,0.8)';
    g.beginPath();
    g.arc(nx, ny, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = 'bold 18px "Segoe UI", Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', nx, ny + 1);
  }

  /** Route, search area and blips through any world->screen transform. */
  drawOverlay(g, toScreen, pxPerM, clampR, rot = 0, full = false) {
    const G = this.G;
    const C = this.size / 2;
    const clampPt = (p) => {
      if (full) return [p[0], p[1], false];
      const dx = p[0] - C, dy = p[1] - C;
      const d = Math.hypot(dx, dy);
      if (d <= clampR) return [p[0], p[1], false];
      return [C + (dx / d) * clampR, C + (dy / d) * clampR, true];
    };
    // GPS route
    if (this.route.length > 1) {
      g.strokeStyle = 'rgba(190,90,255,0.95)';
      g.lineWidth = full ? 4 : 7;
      g.lineJoin = 'round';
      g.beginPath();
      this.route.forEach((p, i) => {
        const [x, y] = toScreen(p.x, p.z);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke();
    }
    // police search area
    const w = G.wanted;
    if (w.stars > 0 && !w.seen) {
      const [x, y] = toScreen(w.lastSeen.x, w.lastSeen.z);
      const flash = Math.sin(G.time * 6) > 0;
      g.fillStyle = flash ? 'rgba(255,60,60,0.22)' : 'rgba(60,110,255,0.22)';
      g.beginPath();
      g.arc(x, y, (28 + w.stars * 12) * pxPerM, 0, Math.PI * 2);
      g.fill();
    }
    const dot = (x, z, color, r, outline = '#000') => {
      const [sx, sy] = clampPt(toScreen(x, z));
      g.fillStyle = color;
      g.strokeStyle = outline;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    };
    const badge = (x, z, color, label, r = 15) => {
      const [sx, sy] = clampPt(toScreen(x, z));
      g.fillStyle = color;
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.font = `bold ${Math.round(r * 1.2)}px Impact, "Arial Black", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, sx, sy + 1);
    };
    for (const it of G.pickups.items) {
      if (!it.active || it.kind === 'cash') continue;
      const col = it.kind === 'health' ? '#3ddc84' : it.kind === 'armour' ? '#3d8bff' : '#e0c050';
      const [sx, sy, edge] = clampPt(toScreen(it.x, it.z));
      if (edge) continue;
      g.fillStyle = col;
      g.fillRect(sx - 5, sy - 5, 10, 10);
    }
    const sh = G.landmarks.safehouse.door;
    badge(sh.x, sh.z, '#2a9d5a', 'S', 13);
    if (G.missions) {
      for (const def of G.missions.defs) {
        const m = G.missions.startMarkers.get(def.id);
        if (!m || !m.visible) continue;
        badge(m.group.position.x, m.group.position.z, GIVER_COLORS[def.giver], GIVER_LABELS[def.giver], def.side ? 12 : 15);
      }
      const t = G.missions.target;
      if (t) {
        const col = '#' + (G.missions.targetOpts.color || 0xffd23a).toString(16).padStart(6, '0');
        dot(t.x, t.z, col, 11, '#fff');
      }
    }
    for (const c of G.characters) {
      if (!c.alive || c.inVehicle) continue;
      if (c.faction === 'gang') dot(c.pos.x, c.pos.z, '#ff3b3b', 7);
      else if (c.faction === 'cop' && w.stars > 0) dot(c.pos.x, c.pos.z, '#4a8cff', 6);
    }
    for (const v of G.police.cars) {
      if (v.isWreck) continue;
      const flash = Math.sin(G.time * 10 + v.id) > 0;
      dot(v.pos.x, v.pos.z, w.stars > 0 ? (flash ? '#ff3030' : '#3d6bff') : '#4a6aa8', 9);
    }
    if (G.police.heli.active) {
      const h = G.police.heli.pos;
      badge(h.x, h.z, '#1f3d7a', 'H', 11);
    }
    // player arrow
    const pv = G.player.vehicle;
    const heading = pv ? pv.heading : G.player.char.heading;
    const [px, py] = toScreen(G.player.pos.x, G.player.pos.z);
    const a = Math.atan2(Math.sin(heading), Math.cos(heading));
    const dx = Math.sin(a), dz = Math.cos(a);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const fx = dx * cs - dz * sn, fy = dx * sn + dz * cs;
    const s = full ? 14 : 16;
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(px + fx * s, py + fy * s);
    g.lineTo(px - fx * s * 0.7 - fy * s * 0.65, py - fy * s * 0.7 + fx * s * 0.65);
    g.lineTo(px - fx * s * 0.35, py - fy * s * 0.35);
    g.lineTo(px - fx * s * 0.7 + fy * s * 0.65, py - fy * s * 0.7 - fx * s * 0.65);
    g.closePath();
    g.fill();
    g.stroke();
  }

  /** Full, north-up map into a big canvas (pause menu). */
  drawFullMap(canvas) {
    const g = canvas.getContext('2d');
    const S = canvas.width;
    g.drawImage(this.map, 0, 0, S, S);
    const k = S / this.map.width;
    const toScreen = (x, z) => [(x - MAP_MIN) * PX_PER_M * k, (z - MAP_MIN) * PX_PER_M * k];
    this.computeRoute();
    this.drawOverlay(g, toScreen, PX_PER_M * k, 0, 0, true);
  }
}
