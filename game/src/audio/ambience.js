// Background soundscape: rolling surf near the shore, a low city rumble, wind, and the odd
// gull or distant horn, mixed by where the player is.
import { BEACH_Z0, EAST_SHORE_X } from '../config.js';

export class Ambience {
  constructor(engine) { this.e = engine; this.ok = false; this.t = 0; this.nextEvent = 3; }

  init() {
    const ctx = this.e.ctx, bus = this.e.ambientBus;
    this.surf = this.e.noiseSource();
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 700;
    this.surfFilter = sf;
    this.surfGain = ctx.createGain(); this.surfGain.gain.value = 0;
    this.surf.connect(sf).connect(this.surfGain).connect(bus); this.surf.start();
    this.city = this.e.noiseSource(true);
    const cf = ctx.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 160;
    this.cityGain = ctx.createGain(); this.cityGain.gain.value = 0;
    this.city.connect(cf).connect(this.cityGain).connect(bus); this.city.start();
    this.ok = true;
  }

  gull() {
    const ctx = this.e.ctx, t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const t0 = t + k * 0.22;
      o.frequency.setValueAtTime(1500, t0); o.frequency.exponentialRampToValueAtTime(900, t0 + 0.18);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.connect(g).connect(this.e.ambientBus); o.start(t0); o.stop(t0 + 0.25);
    }
  }

  update(dt) {
    if (!this.ok) return;
    const g = this.e.game, ctx = this.e.ctx, f = g.player.focus;
    this.t += dt;
    const shore = Math.max(0, 1 - Math.max(0, BEACH_Z0 + 80 - f.z) / 160) + Math.max(0, 1 - Math.max(0, EAST_SHORE_X - f.x) / 120);
    const swell = 0.6 + 0.4 * Math.sin(this.t * 0.5) * Math.sin(this.t * 0.23 + 1);
    const paused = g.paused ? 0 : 1;
    this.surfGain.gain.setTargetAtTime(Math.min(1, shore) * 0.35 * swell * paused, ctx.currentTime, 0.3);
    this.surfFilter.frequency.setTargetAtTime(400 + swell * 600, ctx.currentTime, 0.3);
    this.cityGain.gain.setTargetAtTime((0.25 - Math.min(1, shore) * 0.12) * paused, ctx.currentTime, 0.5);
    this.nextEvent -= dt;
    if (this.nextEvent <= 0 && paused) {
      this.nextEvent = 4 + Math.random() * 8;
      if (shore > 0.3) this.gull();
      else this.e.sfx.tone({ freq: 392 + Math.random() * 60, type: 'square', peak: 0.015, decay: 0.3, bus: this.e.ambientBus });
    }
  }
}
