// Hold Tab for the weapon wheel: time slows, the mouse picks a segment, release to equip.
import { WEAPONS } from '../combat/weapons.js';

const LABEL = { fist: 'FIST', pistol: '9MM', smg: 'SMG', shotgun: '12G', carbine: 'C7' };

export class WeaponWheel {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'wheel hidden';
    this.el.innerHTML = WEAPONS.map((w, i) => {
      const a = -Math.PI / 2 + (i / WEAPONS.length) * Math.PI * 2;
      const x = 210 + Math.cos(a) * 140, y = 210 + Math.sin(a) * 140;
      return `<div class="seg" data-w="${w.id}" style="left:${x}px;top:${y}px"><div class="wi">${LABEL[w.id]}</div><div class="wn">${w.name}</div><div class="wa"></div></div>`;
    }).join('') + '<div class="center"><div style="font-size:12px;letter-spacing:2px;color:var(--dim)">WEAPON</div><div id="ww-name" style="font-size:18px"></div></div>';
    root.appendChild(this.el);
    this.segs = [...this.el.querySelectorAll('.seg')];
    this.open = false;
    this.pick = null;
    this.vx = 0; this.vy = 0;
  }

  update() {
    const g = this.game, input = g.input;
    const want = input.isDown('Tab') && g.player.human.alive && g.ui.menus.state === 'playing';
    if (want && !this.open) { this.open = true; this.vx = 0; this.vy = 0; this.pick = g.player.arsenal.current; this.el.classList.remove('hidden'); }
    if (!want && this.open) {
      this.open = false;
      this.el.classList.add('hidden');
      if (this.pick) g.player.arsenal.select(this.pick);
    }
    if (!this.open) return;
    this.vx += input.mouseDX; this.vy += input.mouseDY;
    const len = Math.hypot(this.vx, this.vy);
    if (len > 30) {
      const a = Math.atan2(this.vy, this.vx);
      let idx = Math.round(((a + Math.PI / 2) / (Math.PI * 2)) * WEAPONS.length);
      idx = ((idx % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
      const w = WEAPONS[idx];
      if (g.player.arsenal.owned[w.id]) this.pick = w.id;
      if (len > 120) { this.vx *= 120 / len; this.vy *= 120 / len; }
    }
    const ars = g.player.arsenal;
    this.segs.forEach((s) => {
      const id = s.dataset.w;
      s.classList.toggle('hot', id === this.pick);
      s.classList.toggle('locked', !ars.owned[id]);
      const a = ars.ammo[id];
      s.lastChild.textContent = !ars.owned[id] ? 'LOCKED' : a ? a.mag + ' / ' + a.reserve : '';
    });
    const w = WEAPONS.find((x) => x.id === this.pick);
    this.el.querySelector('#ww-name').textContent = w ? w.name : '';
    // swallow mouse look while open
    input.mouseDX = 0; input.mouseDY = 0;
  }

  get timeScale() { return this.open ? 0.25 : 1; }
}
