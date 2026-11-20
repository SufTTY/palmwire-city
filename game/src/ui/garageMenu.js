// The Okonkwo Auto Works screen: buy upgrade levels, repair the current car and pick a
// respray colour, with Grease's portrait and running cash total.
import { UPGRADES } from '../gameplay/progression.js';
import { RESPRAY_COLORS } from '../gameplay/garage.js';
import { portrait } from '../gameplay/cast.js';
import { fmtMoney } from '../core/mathUtil.js';

export class GarageMenu {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.el = null;
  }

  get open() { return !!this.el; }

  show() {
    const g = this.game;
    g.paused = true;
    g.ui.menus.state = 'garage';
    g.input.releaseLock();
    this.el = document.createElement('div');
    this.el.className = 'modal';
    this.root.appendChild(this.el);
    this.render();
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  render() {
    const g = this.game, pr = g.progression, v = g.player.human.vehicle;
    const upg = Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = pr.garage[k], cost = u.cost[lvl];
      return `<div class="upg"><div><div class="un">${u.name}</div><div class="ud">${u.desc}</div><div class="pips">${[0, 1, 2].map((i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn ${cost !== undefined && pr.cash >= cost ? 'primary' : ''}" data-buy="${k}" ${cost === undefined || pr.cash < cost ? 'disabled' : ''}>${cost === undefined ? 'MAXED' : 'BUY ' + fmtMoney(cost)}</button></div>`;
    }).join('');
    const rc = v ? g.garage.repairCost(v) : 0;
    this.el.innerHTML = `<div class="modal-box">
      <div style="display:flex;gap:14px;align-items:center"><img src="${portrait('grease', 72)}" style="width:72px;height:72px;border-radius:10px">
        <div><h2 style="margin:0">OKONKWO AUTO WORKS</h2><div style="color:var(--dim)">"${v ? 'Nice ' + v.type.name + '. Whose was it?' : 'Bring me a car, Sol.'}" — Grease</div></div>
        <div style="margin-left:auto;font-size:26px;font-weight:800;color:#7dff9a">${fmtMoney(pr.cash)}</div></div>
      <h3>PERFORMANCE (applies to every car you drive)</h3>${upg}
      <h3>BODY SHOP</h3>
      <div class="upg"><div><div class="un">Repair</div><div class="ud">Condition ${v ? Math.round(v.health / v.maxHealth * 100) : 0}%</div></div>
        <button class="btn ${rc > 0 && pr.cash >= rc ? 'primary' : ''}" data-a="repair" ${!v || rc === 0 || pr.cash < rc ? 'disabled' : ''}>${rc === 0 ? 'PRISTINE' : 'REPAIR ' + fmtMoney(rc)}</button></div>
      <div class="upg"><div><div class="un">Respray · $150</div><div class="ud">New colour. Low-level heat forgets your plates.</div>
        <div class="swatches">${RESPRAY_COLORS.map((c) => `<div class="swatch" data-paint="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></div>`).join('')}</div></div></div>
      <div class="btn-row"><button class="btn primary" data-a="close">DRIVE OUT</button></div></div>`;
  }

  onClick(e) {
    const g = this.game;
    const t = e.target.closest('[data-buy],[data-a],[data-paint]');
    if (!t || t.disabled) return;
    g.audio.sfx.ui();
    if (t.dataset.buy) { if (g.progression.buyUpgrade(t.dataset.buy)) g.audio.sfx.pickup(); }
    if (t.dataset.a === 'repair') g.garage.repair();
    if (t.dataset.paint) g.garage.respray(Number(t.dataset.paint));
    if (t.dataset.a === 'close') { this.hide(); return; }
    this.render();
  }

  hide() {
    const g = this.game;
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    g.garage.close();
    g.ui.menus.state = 'playing';
    g.paused = false;
    g.input.requestLock();
    g.saveGame.autosave();
  }
}
