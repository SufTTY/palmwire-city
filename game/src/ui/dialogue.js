// Cutscene-style dialogue cards: a queue of lines shown one after another with the
// speaker's painted portrait, name and role.
import { CAST, portrait } from '../gameplay/cast.js';

export class DialogueCard {
  constructor(root) {
    this.el = root;
    this.el.innerHTML = '<img alt=""><div><div class="dn"></div><div class="dr"></div><div class="dl"></div></div>';
    this.img = this.el.querySelector('img');
    this.name = this.el.querySelector('.dn');
    this.role = this.el.querySelector('.dr');
    this.line = this.el.querySelector('.dl');
    this.lines = [];
    this.current = null;
    this.t = 0;
    this.el.classList.add('hidden');
  }

  /** lines: [[castId, text], ...] */
  queue(lines) {
    for (const l of lines) if (l) this.lines.push(l);
    if (!this.current) this.advance();
  }

  show(who, text, hold = null) {
    const c = CAST[who] || CAST.sol;
    this.img.src = portrait(who);
    this.name.textContent = c.name;
    this.role.textContent = c.role;
    this.line.textContent = text;
    this.current = [who, text];
    this.t = hold ?? 2.4 + text.length * 0.045;
    this.el.classList.remove('hidden');
  }

  advance() {
    const next = this.lines.shift();
    if (!next) { this.current = null; this.el.classList.add('hidden'); return; }
    this.show(next[0], next[1]);
  }

  skip() { if (this.current) this.advance(); }

  update(dt) {
    if (!this.current) return;
    this.t -= dt;
    if (this.t <= 0) this.advance();
  }
}
