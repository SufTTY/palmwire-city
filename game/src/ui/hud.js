// The heads-up display: mission card and police response panel (top left), clock, cash,
// wanted stars, rank and weapon/crew slots (top right), place name, minimap and vitals
// (bottom left), dialogue (bottom centre), speedometer and radio (bottom right), plus
// banners, notifications, prompts and the WASTED / BUSTED screen.
import { DialogueCard } from './dialogue.js';
import { Minimap, buildBaseMap } from './minimap.js';
import { WEAPONS } from '../combat/weapons.js';
import { CREW } from '../gameplay/crew.js';
import { RANKS } from '../gameplay/progression.js';
import { fmtMoney, fmtTime } from '../core/mathUtil.js';

const WEAPON_LABEL = { fist: 'FIST', pistol: '9MM', smg: 'SMG', shotgun: '12G', carbine: 'C7' };
const $ = (root, sel) => root.querySelector(sel);

export class Hud {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    root.innerHTML = `
      <div class="tl">
        <div class="panel mcard hidden" id="mcard">
          <div class="mlabel"><span id="m-label"></span><span id="m-timer" class="mtimer hidden"></span></div>
          <div class="mtitle" id="m-title"></div>
          <div class="mstage"><span id="m-stage"></span><div class="bar"><i id="m-bar"></i></div></div>
          <div class="mobj" id="m-obj"></div>
          <div class="mprog" id="m-prog"></div>
          <div class="mnext"><b>NEXT</b> <span id="m-next"></span></div>
        </div>
        <div class="panel ppanel hidden" id="ppanel"><h4><span>POLICE RESPONSE</span><span id="p-count"></span></h4><div id="p-rows"></div><div class="pmore" id="p-more"></div></div>
      </div>
      <div class="tr">
        <div class="panel statrow"><span class="clock" id="clock"></span><span class="cash" id="cash"></span></div>
        <div class="cashpop" id="cashpop"></div>
        <div class="panel wanted"><div class="stars" id="stars"></div><div class="wstatus" id="wstatus"></div></div>
        <div class="panel rank"><div class="rtop"><span>RANK <span class="rn" id="rank-n"></span> · <span id="rank-t"></span></span><span id="rank-rp"></span></div><div class="rsub" id="rank-next"></div><div class="bar"><i id="rank-bar"></i></div></div>
        <div class="panel weapons" id="weapons"></div>
        <div class="panel crew" id="crew"></div>
      </div>
      <div class="notes" id="notes"></div>
      <div class="bl">
        <div class="panel place"><div class="dn" id="district"></div><div class="sn" id="street"></div></div>
        <canvas id="minimap" width="236" height="236"></canvas>
        <div class="panel vitals"><div class="vbar hp"><i id="hp"></i></div><div class="vbar ar"><i id="ar"></i></div></div>
      </div>
      <div class="bc"><div class="panel dcard" id="dcard"></div></div>
      <div class="br"><div class="panel speedo" id="speedo-panel">
        <canvas id="speedo" width="340" height="240"></canvas>
        <div class="vname" id="vname"></div>
        <div class="vcond"><span>CONDITION</span><div class="bar"><i id="vcond-bar"></i></div><span id="vcond"></span></div>
        <div class="radio"><div class="rs" id="rstation"></div><div class="rt" id="rtrack"></div></div>
      </div></div>
      <div id="crosshair" class="dot"></div>
      <div class="vehprompt panel hidden" id="prompt"></div>
      <div class="hint panel hidden" id="hint"></div>
      <div class="pickup hidden" id="pickup"></div>
      <div class="banner hidden" id="banner"><div class="b1" id="b1"></div><div class="b2" id="b2"></div><div class="b3" id="b3"></div></div>
      <div class="stagebanner hidden" id="stagebanner"><div class="s1" id="s1"></div><div class="s2" id="s2"></div></div>
      <div class="bigtext hidden" id="bigtext"></div>
      <div class="death hidden" id="death"><div class="dt" id="death-t"></div><div class="ds" id="death-s"></div></div>`;
    this.el = {};
    for (const n of root.querySelectorAll('[id]')) this.el[n.id] = n;
    this.dialogue = new DialogueCard(this.el.dcard);
    this.baseMap = buildBaseMap(game.layout);
    this.minimap = new Minimap(game, this.el.minimap, this.baseMap);
    this.speedoCtx = this.el.speedo.getContext('2d');
    this.timers = { banner: 0, stagebanner: 0, bigtext: 0, pickup: 0, hint: 0, cashpop: 0 };
    this.hinted = new Set();
    this.notes = [];
    this.buildSlots();
    const ev = game.events;
    ev.on('wantedUp', (e) => { if (e.stars >= 3) this.notify('Wanted level ' + e.stars + ' — ' + (e.stars >= 4 ? 'air support requested' : 'more units responding'), 'police'); });
    ev.on('evaded', () => this.notify('You lost the cops', 'info'));
    ev.on('rankUp', (e) => {
      this.resultBanner('RANK UP', 'Rank ' + e.rank + ' · ' + e.title, '#ffd23f');
      for (const w of e.weapons) this.notify('Unlocked: ' + w.name + ' (slot ' + w.slot + ')', 'rank');
      game.audio && game.audio.sfx.rankUp();
    });
  }

  buildSlots() {
    this.el.weapons.innerHTML = WEAPONS.map((w) => `<div class="wslot" data-w="${w.id}"><span class="k">${w.slot}</span><div class="ic">${WEAPON_LABEL[w.id]}</div><div class="am"></div></div>`).join('');
    this.el.crew.innerHTML = Object.entries(CREW).map(([slot, c]) => `<div class="cbtn" data-c="${slot}"><span class="ck">${c.label}</span><div class="cr">${c.role}</div><div class="ca">${c.ability}</div><div class="cd"></div></div>`).join('');
    this.slotEls = [...this.el.weapons.children];
    this.crewEls = [...this.el.crew.children];
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  // ---- transient messages ----
  notify(text, kind = 'info') {
    const n = document.createElement('div');
    n.className = 'note panel ' + kind;
    n.textContent = text;
    this.el.notes.prepend(n);
    this.notes.push({ el: n, t: 5.5 });
    while (this.el.notes.children.length > 4) this.el.notes.lastChild.remove();
  }
  timed(id, secs) { this.timers[id] = secs; this.el[id].classList.remove('hidden'); }
  missionBanner(label, title, color) {
    this.el.b1.textContent = label; this.el.b2.textContent = title.toUpperCase(); this.el.b2.style.color = color; this.el.b3.textContent = '';
    this.timed('banner', 3.2);
  }
  resultBanner(title, sub, color) {
    this.el.b1.textContent = ''; this.el.b2.textContent = title; this.el.b2.style.color = color; this.el.b3.textContent = sub;
    this.timed('banner', 4);
  }
  stageBanner(s1, s2) { this.el.s1.textContent = s1; this.el.s2.textContent = s2; this.timed('stagebanner', 3); }
  bigText(t, color) { this.el.bigtext.textContent = t; this.el.bigtext.style.color = color; this.timed('bigtext', 0.9); }
  pickupText(t) { this.el.pickup.textContent = t; this.timed('pickup', 1.4); }
  cashPop(n) { this.el.cashpop.textContent = (n > 0 ? '+' : '') + fmtMoney(n).replace('$-', '-$'); this.timed('cashpop', 2.5); }
  hintOnce(id, text) { if (this.hinted.has(id)) return; this.hinted.add(id); this.el.hint.textContent = text; this.timed('hint', 4); setTimeout(() => this.hinted.delete(id), 15000); }
  say(who, text) { this.dialogue.queue([[who, text]]); }
  radioPop(name, track) { this.notify(name + (track ? ' · ' + track : ''), 'crew'); }
  deathScreen(kind) {
    const d = this.el.death;
    d.className = 'death ' + kind;
    this.el['death-t'].textContent = kind === 'wasted' ? 'WASTED' : 'BUSTED';
    this.el['death-s'].textContent = kind === 'wasted' ? 'St. Marisol Medical will see you now' : 'Precinct 3 has a cell with your name on it';
  }
  hideDeathScreen() { this.el.death.classList.add('hidden'); }
  clearBanners() { for (const k of ['banner', 'stagebanner', 'bigtext']) { this.timers[k] = 0; this.el[k].classList.add('hidden'); } }

  // ---- per-frame ----
  update(dt) {
    const g = this.game, el = this.el, p = g.player, h = p.human, v = h.vehicle;
    for (const k of Object.keys(this.timers)) {
      if (this.timers[k] > 0) { this.timers[k] -= dt; if (this.timers[k] <= 0) el[k].classList.add('hidden'); }
    }
    for (let i = this.notes.length - 1; i >= 0; i--) { const n = this.notes[i]; n.t -= dt; if (n.t <= 0) { n.el.remove(); this.notes.splice(i, 1); } }
    this.dialogue.update(dt);

    // mission card
    const card = g.missions.card();
    el.mcard.classList.toggle('hidden', !card);
    if (card) {
      el['m-label'].textContent = card.label;
      el['m-title'].textContent = card.title;
      el['m-stage'].textContent = 'STAGE ' + card.stage + '/' + card.stages;
      el['m-bar'].style.width = ((card.stage - 1) / card.stages * 100 + 100 / card.stages * 0.35) + '%';
      el['m-obj'].textContent = card.text;
      el['m-prog'].textContent = card.progress;
      el['m-next'].textContent = card.next;
      el['m-timer'].classList.toggle('hidden', card.timer === null);
      if (card.timer !== null) el['m-timer'].textContent = fmtTime(card.timer);
    }
    // police panel
    const rows = g.wanted.stars > 0 ? g.police.panel() : [];
    el.ppanel.classList.toggle('hidden', rows.length === 0);
    if (rows.length) {
      const shown = rows.slice(0, 4);
      el['p-rows'].innerHTML = shown.map((r) => `<div class="prow"><span class="dot${r.air ? ' air' : ''}"></span><span>${r.callsign}</span><span class="dist">${Math.round(r.dist)} m</span><span class="tag ${r.tactic.split(' ')[0]}">${r.tactic}</span></div>`).join('');
      el['p-more'].textContent = rows.length > 4 ? '+' + (rows.length - 4) + ' more units' : '';
      el['p-count'].textContent = rows.length + ' UNITS';
    }
    // top right
    el.clock.textContent = g.day.clockText;
    el.cash.textContent = fmtMoney(g.progression.cash);
    const stars = g.wanted.stars;
    el.stars.innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('');
    el.stars.classList.toggle('blink', stars > 0 && !g.wanted.seen);
    el.wstatus.textContent = g.wanted.evadedFlash > 0 ? 'EVADED' : stars > 0 ? g.wanted.status : 'CLEAN';
    el.wstatus.style.color = stars > 0 ? '#ff8fa3' : '#7dff9a';
    const pr = g.progression;
    el['rank-n'].textContent = pr.rank;
    el['rank-t'].textContent = pr.rankTitle.toUpperCase();
    el['rank-rp'].textContent = pr.respectLabel;
    el['rank-bar'].style.width = (pr.rankProgress * 100).toFixed(1) + '%';
    const nextRank = RANKS[pr.rank + 1];
    el['rank-next'].textContent = nextRank ? 'Respect to next rank: ' + (nextRank.xp - pr.xp).toLocaleString('en-US') + ' RP' : 'Maximum rank';
    const ars = p.arsenal;
    for (const s of this.slotEls) {
      const id = s.dataset.w, w = WEAPONS.find((x) => x.id === id);
      s.classList.toggle('sel', ars.current === id);
      s.classList.toggle('locked', !ars.owned[id]);
      const a = ars.ammo[id];
      s.lastChild.textContent = !ars.owned[id] ? 'RANK ' + w.unlockRank : a ? (ars.current === id && ars.reloading > 0 ? 'RELOAD' : a.mag + '/' + a.reserve) : '∞';
    }
    for (const c of this.crewEls) {
      const slot = c.dataset.c, cd = g.crew.cooldowns[slot], def = CREW[slot];
      c.classList.toggle('locked', !g.crew.unlocked(slot));
      c.classList.toggle('cool', cd > 0);
      c.lastChild.style.width = (cd > 0 ? (1 - cd / def.cooldown) * 100 : 100) + '%';
      c.children[2].textContent = cd > 0 ? Math.ceil(cd) + 's' : def.ability;
    }
    // bottom left
    const f = p.focus;
    el.district.textContent = g.layout.districtNameAt(f.x, f.z);
    el.street.textContent = g.layout.streetAt(f.x, f.z);
    el.hp.style.width = Math.max(0, h.health) + '%';
    el.ar.style.width = Math.max(0, h.armour) + '%';
    this.minimap.draw(dt);
    // bottom right
    el['speedo-panel'].classList.toggle('hidden', !v);
    if (v) {
      this.drawSpeedo(v);
      el.vname.textContent = v.type.name.toUpperCase();
      const cond = Math.max(0, Math.round(v.health / v.maxHealth * 100));
      el.vcond.textContent = cond + '%';
      el['vcond-bar'].style.width = cond + '%';
      el['vcond-bar'].style.background = cond > 50 ? '' : cond > 25 ? '#ffb347' : '#ff4060';
      const radio = g.audio.radio;
      el.rstation.textContent = '♫ ' + radio.stationName;
      el.rtrack.textContent = radio.track || 'Q to change station';
    }
    // crosshair and prompts
    el.crosshair.classList.toggle('hidden', !!v || !h.alive || g.respawn.active);
    el.crosshair.classList.toggle('dot', !p.aiming);
    this.updatePrompt();
  }

  updatePrompt() {
    const g = this.game, h = g.player.human, el = this.el.prompt;
    let text = '';
    if (!h.vehicle && h.alive) {
      const v = g.vehicles.nearestEnterable(h.pos.x, h.pos.z, 3.2);
      if (v) text = `<span class="key">F</span>${v.npcDriver ? 'Steal' : 'Enter'} ${v.type.name}`;
    }
    el.classList.toggle('hidden', !text);
    if (text && el.innerHTML !== text) el.innerHTML = text;
  }

  drawSpeedo(v) {
    const ctx = this.speedoCtx, W = 340, H = 240;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = 170, R = 140;
    const max = Math.ceil(v.type.maxSpeed * 3.6 * 1.3 / 40) * 40;
    const kmh = v.kmh;
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    ctx.lineCap = 'round';
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    const t = Math.min(1, kmh / max);
    const grad = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
    grad.addColorStop(0, '#2ee6c8'); grad.addColorStop(0.6, '#ffb347'); grad.addColorStop(1, '#ff4fa3');
    ctx.strokeStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * t); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let s = 0; s <= max; s += 40) {
      const a = a0 + (a1 - a0) * (s / max);
      ctx.fillText(String(s), cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30));
    }
    ctx.fillStyle = '#fff'; ctx.font = '900 64px "Arial Black", Arial';
    ctx.fillText(String(Math.round(kmh)), cx, cy - 22);
    ctx.font = 'bold 16px Arial'; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText('KM/H' + (v.nitro > 0 ? ' · NITRO' : ''), cx, cy + 22);
  }
}
