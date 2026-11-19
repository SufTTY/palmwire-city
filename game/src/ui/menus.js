// Title screen (logo over a live fly-over of the city), pause menu with the full city map and
// stats, settings (volumes, mouse sensitivity, invert Y, shadows) and the controls card.
import { drawTitleLogo } from './titleLogo.js';
import { hasSave, saveSettings } from '../game/saveGame.js';
import { formatMoney } from '../core/mathUtil.js';
import { STORY } from '../game/storyMissions.js';

const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click the game to capture the mouse)'],
  ['Shift', 'Sprint'],
  ['Space', 'Jump · handbrake in a vehicle'],
  ['Left click', 'Fire / punch'],
  ['Right click', 'Aim'],
  ['R', 'Reload'],
  ['1-4 / wheel', 'Switch weapon'],
  ['F', 'Enter, steal or exit a vehicle'],
  ['H', 'Horn'],
  ['Q / E', 'Radio station (in a vehicle)'],
  ['E', 'Advance dialogue · save at the safehouse'],
  ['M / Esc', 'Map / pause menu'],
];

function button(parent, label, onClick, G) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => { if (G.audio) G.audio.sfx.ui('click'); onClick(); });
  b.addEventListener('mouseenter', () => { if (G.audio) G.audio.sfx.ui('hover'); });
  parent.appendChild(b);
  return b;
}

export class Menus {
  constructor(G, { onNewGame, onContinue, onResume, onQuit }) {
    this.G = G;
    this.root = document.getElementById('ui');
    this.cb = { onNewGame, onContinue, onResume, onQuit };
    this.screen = null;
  }

  get open() { return !!this.screen; }

  clear() {
    if (this.screen) this.screen.remove();
    this.screen = null;
  }

  showTitle() {
    this.clear();
    const s = document.createElement('div');
    s.className = 'screen title-screen';
    const logo = document.createElement('canvas');
    logo.className = 'logo';
    drawTitleLogo(logo);
    s.appendChild(logo);
    const tag = document.createElement('div');
    tag.className = 'tagline';
    tag.textContent = 'Last Tide · an open-world crime story';
    s.appendChild(tag);
    const menu = document.createElement('div');
    menu.className = 'menu';
    s.appendChild(menu);
    const cont = button(menu, 'CONTINUE', () => this.cb.onContinue(), this.G);
    cont.disabled = !hasSave();
    button(menu, 'NEW GAME', () => this.cb.onNewGame(), this.G);
    button(menu, 'SETTINGS', () => this.showPanel('settings', () => this.showTitle()), this.G);
    button(menu, 'CONTROLS', () => this.showPanel('controls', () => this.showTitle()), this.G);
    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.textContent = 'Original game · all art, sound and music generated in your browser · keyboard + mouse';
    s.appendChild(foot);
    this.root.appendChild(s);
    this.screen = s;
  }

  showPause(tab = 'menu') {
    this.clear();
    const G = this.G;
    const s = document.createElement('div');
    s.className = 'screen pause-screen';
    const map = document.createElement('canvas');
    map.className = 'map-canvas';
    map.width = map.height = 900;
    G.hud.minimap.drawFullMap(map);
    s.appendChild(map);
    const side = document.createElement('div');
    side.className = 'panel';
    const p = G.prog;
    const next = STORY.find((m) => !p.completed.has(m.id));
    side.innerHTML = `<h2>PAUSED</h2><div class="stats">
      <b>${p.rank}</b> · ${p.respect} respect<br>${formatMoney(p.cash)} cash<br>
      Story: ${p.completed.size} / ${STORY.length} missions${next ? ` · next: <b>${next.title}</b>` : ' · complete!'}<br>
      Takedowns ${p.stats.kills} · vehicles ${p.stats.carsStolen}${p.stats.bestRace ? ` · best Sunset Sprint ${p.stats.bestRace.toFixed(1)}s` : ''}</div><br>`;
    const menu = document.createElement('div');
    menu.className = 'menu';
    button(menu, 'RESUME', () => this.cb.onResume(), G);
    button(menu, 'SETTINGS', () => this.showPanel('settings', () => this.showPause()), G);
    button(menu, 'CONTROLS', () => this.showPanel('controls', () => this.showPause()), G);
    button(menu, 'QUIT TO TITLE', () => this.cb.onQuit(), G);
    side.appendChild(menu);
    s.appendChild(side);
    this.root.appendChild(s);
    this.screen = s;
    void tab;
  }

  showPanel(kind, back) {
    this.clear();
    const G = this.G;
    const s = document.createElement('div');
    s.className = 'screen pause-screen';
    const panel = document.createElement('div');
    panel.className = 'panel';
    if (kind === 'settings') {
      panel.innerHTML = '<h2>SETTINGS</h2>';
      const slider = (label, key, min, max, step) => {
        const l = document.createElement('label');
        const val = document.createElement('span');
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min; input.max = max; input.step = step;
        input.value = G.settings[key];
        val.textContent = Number(G.settings[key]).toFixed(2);
        input.addEventListener('input', () => {
          G.settings[key] = Number(input.value);
          val.textContent = Number(input.value).toFixed(2);
          G.audio.applySettings();
          saveSettings(G.settings);
        });
        l.append(label, input, val);
        panel.appendChild(l);
      };
      slider('Master volume', 'master', 0, 1, 0.05);
      slider('Music / radio', 'music', 0, 1, 0.05);
      slider('Effects', 'sfx', 0, 1, 0.05);
      slider('Mouse sensitivity', 'sensitivity', 0.3, 2.5, 0.05);
      const toggle = (label, key, apply) => {
        const l = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!G.settings[key];
        input.addEventListener('change', () => {
          G.settings[key] = input.checked;
          saveSettings(G.settings);
          if (apply) apply(input.checked);
        });
        l.append(label, input, document.createElement('span'));
        panel.appendChild(l);
      };
      toggle('Invert mouse Y', 'invertY');
      toggle('Shadows', 'shadows', (on) => G.setShadows(on));
    } else {
      panel.innerHTML = '<h2>CONTROLS</h2><table>' + CONTROLS.map(([k, d]) => `<tr><td>${k}</td><td>${d}</td></tr>`).join('') + '</table>';
    }
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.style.marginTop = '16px';
    button(menu, 'BACK', back, G);
    panel.appendChild(menu);
    s.appendChild(panel);
    this.root.appendChild(s);
    this.screen = s;
  }
}
