// The heads-up display: clock, cash, weapon and ammo, wanted stars, minimap with health and
// armour, district name, speedometer, objective and timer, radio station, notifications,
// crosshair and hit markers, damage vignette, sun glare, letterbox, and the big banners
// (mission titles, MISSION PASSED, FLATLINED, CUFFED).
import * as THREE from 'three';
import { Minimap } from './minimap.js';
import { formatMoney, formatClock, formatTimer, clamp } from '../core/mathUtil.js';
import { DISTRICT_NAMES } from '../world/cityLayout.js';
import { WEAPONS } from '../combat/weaponDefs.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export function drawWeaponIcon(g, key, w, h) {
  g.clearRect(0, 0, w, h);
  g.save();
  g.fillStyle = '#fff';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = 4;
  g.translate(w / 2, h / 2);
  const s = h / 48;
  g.scale(s, s);
  g.beginPath();
  if (key === 'fists') {
    g.roundRect(-16, -12, 30, 22, 6);
    g.roundRect(-20, -4, 8, 16, 3);
  } else if (key === 'pistol') {
    g.rect(-20, -10, 38, 9);
    g.moveTo(-14, -1); g.lineTo(-4, -1); g.lineTo(-8, 16); g.lineTo(-18, 16); g.closePath();
  } else if (key === 'smg') {
    g.rect(-30, -9, 52, 10);
    g.rect(22, -6, 10, 4);
    g.rect(-6, 1, 7, 16);
    g.moveTo(-30, -9); g.lineTo(-42, -5); g.lineTo(-42, 4); g.lineTo(-30, 1); g.closePath();
    g.rect(-20, 1, 6, 10);
  } else if (key === 'shotgun') {
    g.rect(-24, -8, 64, 7);
    g.rect(-6, -1, 30, 5);
    g.moveTo(-24, -8); g.lineTo(-44, -2); g.lineTo(-44, 9); g.lineTo(-22, 2); g.closePath();
  }
  g.fill();
  g.restore();
}

export class HUD {
  constructor(G) {
    this.G = G;
    const root = (this.root = document.getElementById('hud'));
    root.innerHTML = '';
    this.vignette = el('div', 'vignette', root);
    this.glare = el('div', 'glare', root);
    this.flares = [0.35, 0.65, 1.1, 1.5].map((k, i) => {
      const f = el('div', 'flare', root);
      const size = [60, 26, 90, 40][i];
      f.style.width = f.style.height = size + 'px';
      f.style.background = ['rgba(255,190,120,0.35)', 'rgba(120,220,255,0.35)', 'rgba(255,120,160,0.18)', 'rgba(255,240,200,0.3)'][i];
      f.dataset.k = k;
      f.dataset.size = size;
      return f;
    });
    this.lbTop = el('div', 'letterbox top', root);
    this.lbBottom = el('div', 'letterbox bottom', root);

    const tr = el('div', 'hud-tr', root);
    this.clock = el('div', 'hud-clock', tr);
    this.cash = el('div', 'hud-cash', tr);
    const wb = el('div', 'hud-weapon', tr);
    this.weaponCanvas = el('canvas', '', wb);
    this.weaponCanvas.width = 192;
    this.weaponCanvas.height = 96;
    const wt = el('div', '', wb);
    this.ammo = el('div', 'hud-ammo', wt);
    this.weaponName = el('div', 'hud-weapon-name', wt);
    this.stars = el('div', 'hud-stars', tr);
    this.starEls = [0, 1, 2, 3, 4].map(() => el('span', '', this.stars, '★'));
    this.rank = el('div', 'rank', tr);
    this.timer = el('div', 'timer hidden', root);
    this.cashPop = el('div', 'cash-pop', root);

    this.tl = el('div', 'hud-tl', root);
    this.hintEl = el('div', 'notify hint hidden', this.tl);
    this.radio = el('div', 'radio', root);
    this.radio.style.opacity = 0;
    this.objective = el('div', 'objective', root);
    this.title = el('div', 'mission-title', root);
    this.big = el('div', 'big-message hidden', root);
    this.crosshair = el('div', 'crosshair hidden', root, '<div class="dot"></div>');
    this.hitmarker = el('div', 'hitmarker', root, '<i></i><i></i><i></i><i></i>');

    const bl = el('div', 'hud-bl', root);
    const mw = el('div', 'minimap-wrap', bl);
    const mc = el('canvas', '', mw);
    this.minimap = new Minimap(G, mc);
    const bars = el('div', 'bars', bl);
    this.healthBar = el('div', 'bar health', bars, '<i></i>');
    this.armourBar = el('div', 'bar armour', bars, '<i></i>');
    this.zone = el('div', 'zone', bl);

    const br = el('div', 'hud-br', root);
    this.speedo = el('canvas', '', br);
    this.speedo.width = this.speedo.height = 380;
    this.vehName = el('div', 'veh-name', br);
    this.br = br;

    this.notes = [];
    this.hintT = 0;
    this.radioT = 0;
    this.titleT = 0;
    this.bigT = 0;
    this.cashPopT = 0;
    this.vignetteT = 0;
    this.lastWeapon = null;
    G.events.on('playerHitMarker', (e) => {
      this.hitmarker.classList.toggle('kill', !!e.kill);
      this.hitmarker.classList.remove('show');
      void this.hitmarker.offsetWidth;
      this.hitmarker.classList.add('show');
    });
    G.events.on('characterHurt', (e) => {
      if (e.victim === G.player.char) this.vignetteT = 0.5;
    });
    G.events.on('wantedCleared', () => this.notify('You lost the cops.', 3));
  }

  setVisible(v) { this.root.classList.toggle('hidden', !v); }
  setCutscene(on) { this.root.classList.toggle('cutscene', on); }

  notify(text, seconds = 3.5) {
    const n = el('div', 'notify', this.tl, text);
    this.notes.push({ el: n, t: seconds });
    if (this.notes.length > 4) {
      const old = this.notes.shift();
      old.el.remove();
    }
  }

  hint(text) {
    this.hintEl.textContent = text;
    this.hintEl.classList.remove('hidden');
    this.hintT = 0.25;
  }

  setObjective(text) { this.objective.innerHTML = text ? text.replace(/^(.*?)(\(|$)/, '<b>$1</b>$2') : ''; }

  showRadio(name) {
    const [a, b] = name.split(' — ');
    this.radio.innerHTML = `${a}${b ? `<small>${b}</small>` : ''}`;
    this.radio.style.opacity = 1;
    this.radioT = 3;
  }

  flashStars() {
    this.stars.classList.remove('pop');
    void this.stars.offsetWidth;
    this.stars.classList.add('pop');
  }

  weaponChanged() { this.lastWeapon = null; }

  cashPopup(n, reason) {
    if (!n) return;
    this.cashPop.textContent = `${n > 0 ? '+' : '-'}${formatMoney(Math.abs(n))}${reason ? '  ' + reason : ''}`;
    this.cashPop.classList.toggle('neg', n < 0);
    this.cashPop.classList.remove('show');
    void this.cashPop.offsetWidth;
    this.cashPop.classList.add('show');
    this.cashPopT = 2.5;
    if (n > 0 && this.G.audio) this.G.audio.sfx.cash();
  }

  missionTitle(title, sub) {
    this.title.innerHTML = `<div class="t">${title}</div><div class="s">${sub || ''}</div>`;
    this.title.classList.add('show');
    this.titleT = 3.5;
  }

  showBigMessage(text, kind, sub = '', seconds = 0) {
    this.big.className = `big-message ${kind}`;
    this.big.innerHTML = `<div class="t">${text}</div><div class="s">${sub}</div>`;
    this.bigT = seconds;
  }
  hideBigMessage() { this.big.className = 'big-message hidden'; }

  missionPassed(title, cash, respect) {
    this.showBigMessage(title, 'passed', `${cash ? formatMoney(cash) : ''}${respect ? `  ·  +${respect} respect` : ''}`, 4.5);
  }
  missionFailed(reason) {
    this.showBigMessage('MISSION FAILED', 'failed', reason || '', 4);
  }

  showCredits() {
    const c = el('div', 'credits', document.getElementById('ui'));
    const p = this.G.prog;
    c.innerHTML = `<h1>LAST TIDE</h1><p>Hale is in cuffs, the Kings have scattered and Coral Strand stays with the people who live on it.</p>
      <p>Final rank: <b>${p.rank}</b> · ${formatMoney(p.cash)} · ${p.stats.kills} takedowns · ${p.stats.carsStolen} cars borrowed</p>
      <p style="opacity:0.7">Palmwire City is yours to roam. Side jobs stay open. Click to continue.</p>`;
    c.addEventListener('click', () => c.remove());
  }

  drawSpeedo(v) {
    const g = this.speedo.getContext('2d');
    const S = 380, C = S / 2;
    g.clearRect(0, 0, S, S);
    const kmh = Math.abs(v.speed) * 3.6;
    const maxK = Math.ceil((v.T.maxSpeed * 3.6) / 40) * 40 + 20;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineCap = 'round';
    g.lineWidth = 18;
    g.strokeStyle = 'rgba(10,14,20,0.6)';
    g.beginPath(); g.arc(C, C, 150, a0, a1); g.stroke();
    const f = clamp(kmh / maxK, 0, 1);
    const grd = g.createLinearGradient(0, S, S, 0);
    grd.addColorStop(0, '#2ec4b6'); grd.addColorStop(0.6, '#ffd23a'); grd.addColorStop(1, '#ff5a6e');
    g.strokeStyle = grd;
    g.beginPath(); g.arc(C, C, 150, a0, a0 + (a1 - a0) * f); g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.font = 'bold 20px "Segoe UI", Arial';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = 0; k <= maxK; k += 40) {
      const a = a0 + (a1 - a0) * (k / maxK);
      g.beginPath();
      g.moveTo(C + Math.cos(a) * 128, C + Math.sin(a) * 128);
      g.lineTo(C + Math.cos(a) * 138, C + Math.sin(a) * 138);
      g.stroke();
      g.fillText(String(k), C + Math.cos(a) * 108, C + Math.sin(a) * 108);
    }
    g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 6;
    g.font = '64px Impact, "Arial Black", sans-serif';
    g.fillText(String(Math.round(kmh)), C, C + 6);
    g.font = 'bold 18px "Segoe UI", Arial';
    g.fillText('KM/H', C, C + 50);
    g.shadowBlur = 0;
    // damage bar
    const hp = v.health / v.maxHealth;
    g.fillStyle = 'rgba(10,14,20,0.6)';
    g.fillRect(C - 60, C + 80, 120, 10);
    g.fillStyle = hp > 0.5 ? '#7cf08f' : hp > 0.25 ? '#ffd23a' : '#ff5a5a';
    g.fillRect(C - 60, C + 80, 120 * hp, 10);
  }

  update(dt) {
    const G = this.G;
    const p = G.player;
    this.clock.textContent = formatClock(G.sky.tod);
    this.cash.textContent = formatMoney(G.prog.cash);
    this.rank.textContent = G.prog.rank;
    // weapon
    const W = WEAPONS[p.weapon];
    if (this.lastWeapon !== p.weapon) {
      this.lastWeapon = p.weapon;
      drawWeaponIcon(this.weaponCanvas.getContext('2d'), p.weapon, 192, 96);
      this.weaponName.textContent = W.name;
    }
    const slot = p.inventory[p.weapon];
    this.ammo.innerHTML = W.melee ? '&nbsp;' : p.reloadT > 0 ? '<small>RELOADING</small>' : `${slot.mag}<small> / ${slot.reserve}</small>`;
    // stars
    const w = G.wanted;
    this.starEls.forEach((s, i) => s.classList.toggle('on', i < w.stars));
    this.stars.classList.toggle('flash', w.stars > 0 && !w.seen);
    // bars
    const ch = p.char;
    const hp = clamp(ch.health / ch.maxHealth, 0, 1);
    this.healthBar.firstChild.style.width = hp * 100 + '%';
    this.healthBar.classList.toggle('low', hp < 0.3);
    this.armourBar.firstChild.style.width = clamp(ch.armour, 0, 100) + '%';
    const d = G.layout.districtAt(p.pos.x, p.pos.z);
    this.zone.textContent = DISTRICT_NAMES[d] || '';
    // vehicle
    const v = p.vehicle;
    this.br.classList.toggle('hidden', !v);
    if (v) {
      this.drawSpeedo(v);
      this.vehName.textContent = v.T.name;
    }
    this.crosshair.classList.toggle('hidden', !(p.aiming && !v) || G.state !== 'play');
    // timers
    const mt = G.missions ? G.missions.timer : null;
    this.timer.classList.toggle('hidden', mt === null);
    if (mt !== null) {
      this.timer.textContent = formatTimer(mt);
      this.timer.classList.toggle('urgent', mt < 10);
    }
    for (let k = this.notes.length - 1; k >= 0; k--) {
      const n = this.notes[k];
      n.t -= dt;
      if (n.t <= 0) { n.el.remove(); this.notes.splice(k, 1); }
    }
    this.hintT -= dt;
    if (this.hintT <= 0) this.hintEl.classList.add('hidden');
    this.radioT -= dt;
    if (this.radioT <= 0) this.radio.style.opacity = 0;
    this.titleT -= dt;
    if (this.titleT <= 0) this.title.classList.remove('show');
    if (this.bigT > 0) {
      this.bigT -= dt;
      if (this.bigT <= 0) this.hideBigMessage();
    }
    this.vignetteT = Math.max(0, this.vignetteT - dt);
    const lowHp = hp < 0.25 && ch.alive ? 0.35 + Math.sin(G.time * 5) * 0.15 : 0;
    this.vignette.style.opacity = Math.max(this.vignetteT * 1.6, lowHp);
    this.minimap.update(dt);
    this.updateGlare();
  }

  /** Sun glare and lens flare ghosts when looking toward a low sun. */
  updateGlare() {
    const G = this.G;
    const sun = G.sky.sunDir;
    const cam = G.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const facing = fwd.dot(sun);
    if (facing < 0.5 || sun.y < -0.02 || G.sky.night > 0.5) {
      this.glare.style.opacity = 0;
      for (const f of this.flares) f.style.opacity = 0;
      return;
    }
    const sp = cam.position.clone().addScaledVector(sun, 1000).project(cam);
    const W = window.innerWidth, H = window.innerHeight;
    const x = (sp.x * 0.5 + 0.5) * W, y = (-sp.y * 0.5 + 0.5) * H;
    // is the sun hidden behind a building?
    const blocked = G.colliders.raycast(cam.position.x, cam.position.y, cam.position.z, sun.x, sun.y, sun.z, 400);
    const strength = blocked ? 0 : clamp((facing - 0.5) * 2, 0, 1) * (1 - G.sky.night);
    this.glare.style.left = x + 'px';
    this.glare.style.top = y + 'px';
    this.glare.style.opacity = strength * 0.95;
    const cx = W / 2, cy = H / 2;
    for (const f of this.flares) {
      const k = +f.dataset.k, s = +f.dataset.size;
      f.style.left = cx + (cx - x) * (k - 0.5) - s / 2 + 'px';
      f.style.top = cy + (cy - y) * (k - 0.5) - s / 2 + 'px';
      f.style.opacity = strength * 0.8;
    }
  }
}
