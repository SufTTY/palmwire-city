// Title screen, pause menu, settings and controls: the game's front-end screens and the
// state that says whether the world is running.
import { drawLogo } from './logo.js';
import { SaveGame } from '../gameplay/saveGame.js';

const CONTROLS = [
  ['W A S D', 'Move / drive'], ['Mouse', 'Look and aim'], ['Left click', 'Shoot / punch'], ['Right click', 'Aim down sights'],
  ['Shift', 'Sprint'], ['Space', 'Jump / handbrake'], ['F', 'Enter, exit or steal a vehicle'], ['R', 'Reload'],
  ['1 – 5 / wheel', 'Weapon slots'], ['Tab (hold)', 'Weapon wheel'], ['Z X C', 'Crew: nitro, repair, jam police'],
  ['Q', 'Next radio station'], ['H', 'Horn'], ['G', 'Siren (police car)'], ['M', 'Map, missions and progress'], ['Esc / P', 'Pause'],
];

export class Menus {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.state = 'title';
    this.modal = null;
  }

  el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  clear() { this.root.innerHTML = ''; this.modal = null; }

  showTitle() {
    const g = this.game;
    this.state = 'title';
    this.clear();
    const has = SaveGame.exists();
    const s = this.el(`<div class="screen title-screen"><div class="title-col">
      <canvas id="logo" width="1040" height="520"></canvas>
      <button class="menu-btn" data-a="continue" ${has ? '' : 'disabled'}>CONTINUE</button>
      <button class="menu-btn" data-a="new">NEW GAME</button>
      <button class="menu-btn" data-a="controls">CONTROLS</button>
      <button class="menu-btn" data-a="settings">SETTINGS</button>
      <div class="menu-foot">An original open-world story on the Palmwire coast · keyboard + mouse</div>
    </div></div>`);
    this.root.appendChild(s);
    drawLogo(s.querySelector('#logo'));
    s.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a || a.disabled) return;
      g.audio.init();
      g.audio.sfx.ui();
      const act = a.dataset.a;
      if (act === 'new') { g.saveGame.wipe(); g.startPlaying(false); }
      if (act === 'continue') g.startPlaying(true);
      if (act === 'controls') this.showControls();
      if (act === 'settings') this.showSettings();
    });
    g.hud.show(false);
  }

  showPause() {
    const g = this.game;
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pausedAt = performance.now();
    g.paused = true;
    this.clear();
    const m = g.missions.active;
    const s = this.el(`<div class="modal"><div class="modal-box"><h2>PAUSED</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="menu-btn" data-a="resume">RESUME</button>
        <button class="menu-btn" data-a="map">MAP & PROGRESS</button>
        <button class="menu-btn" data-a="settings">SETTINGS</button>
        <button class="menu-btn" data-a="controls">CONTROLS</button>
        ${m ? '<button class="menu-btn" data-a="abort">ABANDON MISSION</button>' : ''}
        <button class="menu-btn" data-a="title">QUIT TO TITLE</button>
      </div><div class="menu-foot">Save the game by walking into the blue marker at the Palm Court safehouse. Missions autosave when passed.</div></div></div>`);
    this.root.appendChild(s);
    s.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      g.audio.sfx.ui();
      const act = a.dataset.a;
      if (act === 'resume') this.resume();
      if (act === 'map') { this.state = 'playing'; this.clear(); g.ui.mapScreen.show(); }
      if (act === 'settings') this.showSettings(() => { this.state = 'playing'; this.showPause(); });
      if (act === 'controls') this.showControls(() => { this.state = 'playing'; this.showPause(); });
      if (act === 'abort') { g.missions.abort(); this.resume(); }
      if (act === 'title') { g.saveGame.autosave(); location.search = ''; }
    });
  }

  resume() {
    const g = this.game;
    this.clear();
    this.state = 'playing';
    g.paused = false;
    g.input.requestLock();
    g.audio.resume();
  }

  showControls(back) {
    const prev = this.root.innerHTML;
    const s = this.el(`<div class="modal"><div class="modal-box"><h2>CONTROLS</h2><div class="controls-grid">
      ${CONTROLS.map(([k, d]) => `<b>${k}</b><span>${d}</span>`).join('')}</div>
      <h3>TIPS</h3><div style="font-size:14px;line-height:1.5;color:var(--dim)">Yellow markers start story missions, pink ones street races, green ones side jobs. Break line of sight and leave the search circle on the radar to lose the police. Drive into the orange marker at Okonkwo Auto Works to upgrade your ride.</div>
      <div class="btn-row"><button class="btn primary" data-a="back">BACK</button></div></div></div>`);
    this.root.appendChild(s);
    s.querySelector('[data-a=back]').addEventListener('click', () => { s.remove(); if (back) back(); else if (!prev) this.showTitle(); });
  }

  showSettings(back) {
    const st = this.game.settings;
    const slider = (key, label, min, max, step) => `<div class="setting"><label for="set-${key}">${label}</label><input id="set-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${st.get(key)}" data-k="${key}"><span>${Number(st.get(key)).toFixed(step < 1 ? 1 : 0)}</span></div>`;
    const s = this.el(`<div class="modal"><div class="modal-box"><h2>SETTINGS</h2>
      <h3>AUDIO</h3>${slider('masterVolume', 'Master volume', 0, 1, 0.05)}${slider('musicVolume', 'Radio & music', 0, 1, 0.05)}${slider('sfxVolume', 'Effects', 0, 1, 0.05)}
      <h3>CONTROLS</h3>${slider('sensitivity', 'Mouse sensitivity', 0.2, 3, 0.1)}
      <div class="setting"><label for="set-inv">Invert mouse Y</label><input id="set-inv" type="checkbox" ${st.get('invertY') ? 'checked' : ''}><span></span></div>
      <h3>GRAPHICS</h3>${slider('drawDistance', 'Draw distance', 0.6, 1.4, 0.1)}
      <div class="setting"><label for="set-sh">Shadows</label><input id="set-sh" type="checkbox" ${st.get('shadows') ? 'checked' : ''}><span></span></div>
      <div class="btn-row"><button class="btn primary" data-a="back">DONE</button></div></div></div>`);
    this.root.appendChild(s);
    s.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) { st.set(k, Number(e.target.value)); e.target.nextElementSibling.textContent = Number(e.target.value).toFixed(e.target.step < 1 ? 1 : 0); }
      if (e.target.id === 'set-inv') st.set('invertY', e.target.checked);
      if (e.target.id === 'set-sh') { st.set('shadows', e.target.checked); this.game.applyShadowSetting(); }
    });
    s.querySelector('[data-a=back]').addEventListener('click', () => { s.remove(); if (back) back(); });
  }

  update() {
    const g = this.game, input = g.input;
    if (this.state === 'playing' && !g.shotMode && (input.wasPressed('Escape') || input.wasPressed('KeyP'))) this.showPause();
    else if (this.state === 'paused' && performance.now() - this.pausedAt > 400 && (input.wasPressed('KeyP') || input.wasPressed('Escape')) && this.root.querySelectorAll('.modal').length === 1) this.resume();
  }
}
