// Full-screen map and progress (M): the whole city with district names and blips, plus the
// story checklist, side activities, district standing, crew, garage perks and stats.
import { DISTRICTS, BLOCK } from '../config.js';
import { BLIP_COLORS } from './minimap.js';
import { RANKS, UPGRADES } from '../gameplay/progression.js';
import { CREW } from '../gameplay/crew.js';
import { CAST, portrait } from '../gameplay/cast.js';
import { fmtMoney } from '../core/mathUtil.js';

const LABELS = [
  ['Verde Heights', 1.5, 1.4], ['Palm Court', 1.6, 7.5], ['Glasswater', 6.5, 4.8], ['Calle Mango', 6.6, 9.6],
  ['Coral Strip', 4.5, 13.5], ['Saltwater Canal', 10.5, 6.5], ['Rustline Docks', 12.5, 10], ['Sunset Pier', 4.7, 16.7],
];

export class MapScreen {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.el = null;
  }

  get open() { return !!this.el; }

  show() {
    const g = this.game;
    if (this.el) return;
    g.paused = true;
    g.ui.menus.state = 'map';
    g.input.releaseLock();
    const pr = g.progression;
    const next = g.missions.nextStory();
    const storyRows = g.missions.story.map((m) => {
      const done = pr.missionsDone.includes(m.id);
      const cls = done ? 'done' : next === m ? 'next' : '';
      return `<div class="mrow ${cls}"><span class="chk">${done ? '✓' : ''}</span><span>${m.number}. ${m.title}</span><span style="margin-left:auto;font-size:11px;opacity:.7">${m.stages.length} stages</span></div>`;
    }).join('');
    const sideRows = g.missions.side.map((m) => {
      const n = pr.sideDone[m.id] || 0;
      const avail = !m.requires || m.requires(g);
      return `<div class="mrow ${avail ? '' : 'done'}"><span class="chk" style="border-color:${BLIP_COLORS[m.kind] || '#fff'}">${n ? n : ''}</span><span>${m.title}</span><span style="margin-left:auto;font-size:11px;opacity:.7">${avail ? (m.kindLabel || '') : 'LOCKED'}</span></div>`;
    }).join('');
    const districtRows = Object.entries(DISTRICTS).map(([k, d]) => `<div class="drow"><span>${d.name}</span><div class="bar"><i style="width:${pr.standing[k]}%"></i></div><span>${pr.standing[k]}%</span></div>`).join('');
    const crewRows = Object.entries(CREW).map(([slot, c]) => {
      const on = pr.crew[slot];
      return `<div class="mrow ${on ? '' : 'done'}"><img src="${portrait(c.member, 48)}" style="width:28px;height:28px;border-radius:5px;opacity:${on ? 1 : .35}"><span><b>${CAST[c.member].name}</b> · ${c.role} · [${c.label}] ${c.ability}</span></div>`;
    }).join('');
    const garageRows = Object.entries(UPGRADES).map(([k, u]) => `<div class="drow"><span>${u.name}</span><div class="pips">${[0, 1, 2].map((i) => `<i class="${i < pr.garage[k] ? 'on' : ''}"></i>`).join('')}</div><span>${pr.garage[k]}/3</span></div>`).join('');
    const st = pr.stats;
    this.el = document.createElement('div');
    this.el.className = 'mapscreen';
    this.el.innerHTML = `
      <div class="mapwrap"><canvas id="bigmap"></canvas></div>
      <div class="side">
        <div class="panel wide"><h3>SOL ARROYO · RANK ${pr.rank} ${RANKS[pr.rank].title.toUpperCase()}</h3>
          <div class="drow"><span>${fmtMoney(pr.cash)}</span><div class="bar"><i style="width:${(pr.rankProgress * 100).toFixed(0)}%"></i></div><span>${Math.floor(pr.xp)}</span></div>
          <div style="font-size:12px;color:var(--dim)">Kills ${st.kills} · Cars taken ${st.carsStolen} · Races won ${st.racesWon} · Jobs ${st.jobsDone} · Escapes ${st.evaded} · Busted ${st.busted} · Wasted ${st.wasted}</div></div>
        <div class="panel"><h3>STORY · SALTWATER LEDGER (${pr.missionsDone.length}/${g.missions.story.length})</h3>${storyRows}</div>
        <div class="panel"><h3>SIDE ACTIVITIES</h3>${sideRows}</div>
        <div class="panel"><h3>DISTRICT STANDING</h3>${districtRows}</div>
        <div class="panel"><h3>CREW</h3>${crewRows}<h3 style="margin-top:10px">GARAGE PERKS</h3>${garageRows}</div>
        <div class="legend wide"><span><i style="background:${BLIP_COLORS.mission}"></i>Story</span><span><i style="background:${BLIP_COLORS.race}"></i>Race</span><span><i style="background:${BLIP_COLORS.job}"></i>Job</span><span><i style="background:${BLIP_COLORS.enemy}"></i>Rampage</span><span><i style="background:${BLIP_COLORS.save}"></i>Safehouse</span><span><i style="background:${BLIP_COLORS.garage}"></i>Garage</span><span><i style="background:${BLIP_COLORS.police}"></i>Police</span></div>
        <div class="btn-row wide" style="margin-top:0"><button class="btn primary" data-a="close">BACK TO THE STREETS (M)</button></div>
      </div>`;
    this.root.appendChild(this.el);
    this.el.querySelector('[data-a=close]').addEventListener('click', () => this.hide());
    this.drawMap();
  }

  drawMap() {
    const g = this.game;
    const base = g.hud.baseMap;
    const cv = this.el.querySelector('#bigmap');
    const wrap = this.el.querySelector('.mapwrap');
    const availW = Math.max(300, wrap.clientWidth || window.innerWidth - 680), availH = Math.max(300, wrap.clientHeight || window.innerHeight - 36);
    // crop to the interesting area
    const x0 = base.X(-140), z0 = base.Z(-140), x1 = base.X(1020), z1 = base.Z(1180);
    const k = Math.min(availW / (x1 - x0), availH / (z1 - z0));
    cv.width = Math.floor((x1 - x0) * k); cv.height = Math.floor((z1 - z0) * k);
    const ctx = cv.getContext('2d');
    ctx.drawImage(base.canvas, x0, z0, x1 - x0, z1 - z0, 0, 0, cv.width, cv.height);
    const P = (x, z) => [(base.X(x) - x0) * k, (base.Z(z) - z0) * k];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [name, bx, bz] of LABELS) {
      const [px, pz] = P(bx * BLOCK, bz * BLOCK);
      ctx.font = `800 ${Math.round(15 * Math.max(0.8, k / 0.9))}px Bahnschrift, Arial`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(name.toUpperCase(), px, pz);
      ctx.fillStyle = '#fff'; ctx.fillText(name.toUpperCase(), px, pz);
    }
    const placed = [];
    const overlaps = (a) => placed.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
    const blip = (x, z, color, label, r = 8) => {
      const [px, pz] = P(x, z);
      ctx.fillStyle = color; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, pz, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!label) return;
      ctx.font = '700 12px Bahnschrift, Arial';
      const w = ctx.measureText(label).width;
      // try right, left, above, below; skip the label if all collide
      const spots = [[px + r + 3, pz, 'left'], [px - r - 3, pz, 'right'], [px, pz - r - 9, 'center'], [px, pz + r + 9, 'center']];
      for (const [lx, ly, align] of spots) {
        const x0 = align === 'left' ? lx : align === 'right' ? lx - w : lx - w / 2;
        const rect = { x0, x1: x0 + w, y0: ly - 7, y1: ly + 7 };
        if (overlaps(rect)) continue;
        placed.push(rect);
        ctx.textAlign = align;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(label, lx, ly);
        ctx.fillStyle = color; ctx.fillText(label, lx, ly);
        break;
      }
      ctx.textAlign = 'center';
    };
    for (const b of g.missions.blips()) blip(b.x, b.z, BLIP_COLORS[b.kind] || '#fff', b.label || 'Objective');
    blip(g.saveGame.door.x, g.saveGame.door.z, BLIP_COLORS.save, 'Safehouse', 7);
    if (g.garage.unlocked) blip(544, 622, BLIP_COLORS.garage, 'Garage', 7);
    for (const u of g.police.units) if (u.vehicle && !u.vehicle.destroyed) blip(u.vehicle.pos.x, u.vehicle.pos.z, BLIP_COLORS.police, '', 5);
    if (g.wanted.stars > 0) {
      const [cx, cz] = P(g.wanted.lkp.x, g.wanted.lkp.z);
      ctx.beginPath(); ctx.arc(cx, cz, g.wanted.searchRadius * base.scale * k, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(77,163,255,.18)'; ctx.fill(); ctx.strokeStyle = '#4da3ff'; ctx.stroke();
    }
    const f = g.player.focus;
    const [px, pz] = P(f.x, f.z);
    ctx.save(); ctx.translate(px, pz);
    const heading = g.player.human.vehicle ? g.player.human.vehicle.yaw : g.player.human.yaw;
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  hide() {
    const g = this.game;
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    g.ui.menus.state = 'playing';
    g.paused = false;
    g.input.requestLock();
  }

  update() {
    const input = this.game.input;
    if (input.wasPressed('KeyM')) {
      if (this.el) this.hide();
      else if (this.game.ui.menus.state === 'playing') this.show();
    } else if (this.el && input.wasPressed('Escape')) this.hide();
  }
}
