// Player-facing settings (volume, mouse, graphics) persisted in localStorage.

const KEY = 'palmwire-settings-v1';
const DEFAULTS = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  sensitivity: 1.0,
  invertY: false,
  shadows: true,
  drawDistance: 1.0,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch (e) { /* storage blocked: keep defaults */ }
    this.listeners = [];
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    this.values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch (e) { /* ignore */ }
    for (const fn of this.listeners) fn(k, v);
  }
  onChange(fn) { this.listeners.push(fn); }
}
