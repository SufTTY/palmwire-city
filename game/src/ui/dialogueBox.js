// Cutscene-style dialogue cards: portrait, name and role, typewriter text, letterbox bars.
// Space / Enter / E / click advances; the player is frozen while a conversation plays.
import { CAST } from '../game/cast.js';
import { drawPortrait } from './portraits.js';

export class DialogueBox {
  constructor(G) {
    this.G = G;
    this.root = document.createElement('div');
    this.root.className = 'dialogue hidden';
    this.portrait = document.createElement('canvas');
    this.portrait.width = this.portrait.height = 232;
    const body = document.createElement('div');
    this.who = document.createElement('div');
    this.who.className = 'who';
    this.role = document.createElement('div');
    this.role.className = 'role';
    this.line = document.createElement('div');
    this.line.className = 'line';
    const next = document.createElement('div');
    next.className = 'next';
    next.textContent = 'SPACE ▸';
    body.append(this.who, this.role, this.line);
    this.root.append(this.portrait, body, next);
    document.getElementById('hud').appendChild(this.root);
    this.lines = [];
    this.index = 0;
    this.shown = 0;
    this.active = false;
  }

  /** opts.lock = false plays it as a phone call: no letterbox, the player keeps control. */
  play(lines, { lock = true } = {}) {
    this.lines = lines;
    this.index = 0;
    this.active = true;
    this.lock = lock;
    this.autoT = 0;
    if (lock) {
      this.G.player.controlsLocked = true;
      this.G.hud.setCutscene(true);
    }
    this.root.classList.toggle('phone', !lock);
    this.root.classList.remove('hidden');
    this.showLine();
  }

  showLine() {
    const [who, text] = this.lines[this.index];
    const c = CAST[who] || { name: who, role: '', bg: ['#333', '#666'], skin: '#c68b62', hair: '#222', accent: '#888' };
    drawPortrait(this.portrait, c);
    this.who.textContent = c.name;
    this.who.style.color = c.accent;
    this.role.textContent = c.role;
    this.text = text;
    this.shown = 0;
    this.line.textContent = '';
  }

  /** Jump straight to a fully typed line (used by screenshot scenes). */
  showInstant(lines, index = 0, opts = {}) {
    this.play(lines, opts);
    this.index = index;
    this.showLine();
    this.shown = this.text.length;
    this.line.textContent = this.text;
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.root.classList.add('hidden');
    if (this.lock) {
      this.G.player.controlsLocked = false;
      this.G.hud.setCutscene(false);
    }
  }

  update(dt, input) {
    if (!this.active) return;
    if (this.shown < this.text.length) {
      this.shown = Math.min(this.text.length, this.shown + dt * 55);
      this.line.textContent = this.text.slice(0, Math.floor(this.shown));
    }
    let advance;
    if (!this.lock) {
      // phone calls run on their own so driving keys stay free
      if (this.shown >= this.text.length) this.autoT += dt;
      advance = this.autoT > 2.8;
      if (advance) this.autoT = 0;
    } else advance = input.pressed('Space') || input.pressed('Enter') || input.pressed('KeyE') || input.mouseClicked(0);
    if (!advance) return;
    if (this.shown < this.text.length) {
      this.shown = this.text.length;
      this.line.textContent = this.text;
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) this.close();
    else this.showLine();
  }
}
