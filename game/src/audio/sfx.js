// One-shot synthesized sound effects: gunshots per weapon, punches, explosions, crashes,
// doors, pickups and the UI stings for checkpoints, missions and death.

export class Sfx {
  constructor(engine) { this.e = engine; this.lastGun = 0; }
  get ctx() { return this.e.ctx; }

  env(node, t0, peak, attack, decay) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  noiseHit({ freq = 1200, q = 0.8, type = 'bandpass', peak = 0.6, attack = 0.002, decay = 0.2, x, z, range = 150, brown = false }) {
    if (!this.e.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const gainK = this.e.distanceGain(x, z, range);
    if (gainK <= 0.01) return;
    const src = this.e.noiseSource(brown);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak * gainK, attack, decay);
    src.connect(f).connect(g).connect(this.e.sfxBus);
    src.start(t); src.stop(t + attack + decay + 0.05);
  }

  tone({ freq = 440, to = null, type = 'sine', peak = 0.3, attack = 0.005, decay = 0.2, delay = 0, bus = null }) {
    if (!this.e.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, decay);
    o.connect(g).connect(bus || this.e.sfxBus);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  gun(kind, x, z) {
    const now = performance.now();
    if (x !== undefined && now - this.lastGun < 30) return;
    this.lastGun = now;
    const k = { pistol: [1800, 0.55, 0.12, 160], smg: [2200, 0.4, 0.08, 190], shotgun: [900, 0.9, 0.35, 90], rifle: [1500, 0.65, 0.18, 120] }[kind] || [1800, 0.5, 0.12, 160];
    this.noiseHit({ freq: k[0], q: 0.7, peak: k[1], decay: k[2], x, z, range: 220 });
    this.noiseHit({ freq: 300, type: 'lowpass', peak: k[1] * 0.8, decay: k[2] * 1.5, x, z, range: 220, brown: true });
    if (x === undefined) this.tone({ freq: k[3], to: 40, type: 'triangle', peak: 0.35, decay: 0.12 });
  }

  dryFire() { this.noiseHit({ freq: 4000, q: 4, peak: 0.15, decay: 0.03 }); }
  punch() { this.noiseHit({ freq: 400, type: 'lowpass', peak: 0.6, decay: 0.12 }); this.tone({ freq: 120, to: 60, peak: 0.3, decay: 0.1 }); }
  door() { this.noiseHit({ freq: 600, q: 2, peak: 0.25, decay: 0.06 }); this.tone({ freq: 90, peak: 0.2, decay: 0.08, delay: 0.05 }); }
  crash(impact, x, z) {
    const p = Math.min(1, impact / 20);
    this.noiseHit({ freq: 800, q: 0.5, peak: 0.4 + p * 0.5, decay: 0.25 + p * 0.3, x, z, range: 120 });
    this.noiseHit({ freq: 3500, q: 1.5, peak: 0.2 * p, decay: 0.4, x, z, range: 120 });
  }
  explosion(x, z) {
    this.noiseHit({ freq: 500, type: 'lowpass', peak: 1.0, attack: 0.01, decay: 1.6, x, z, range: 400, brown: true });
    this.noiseHit({ freq: 1600, q: 0.6, peak: 0.6, decay: 0.5, x, z, range: 300 });
    if (this.e.distanceGain(x, z, 300) > 0.1) this.tone({ freq: 70, to: 25, type: 'sine', peak: 0.8, decay: 1.2 });
  }
  pickup() { this.tone({ freq: 880, peak: 0.2, decay: 0.08 }); this.tone({ freq: 1320, peak: 0.2, decay: 0.12, delay: 0.07 }); }
  checkpoint() { this.tone({ freq: 1046, peak: 0.25, decay: 0.15 }); this.tone({ freq: 1568, peak: 0.2, decay: 0.25, delay: 0.08 }); }
  beep(go) { this.tone({ freq: go ? 1320 : 660, type: 'square', peak: 0.18, decay: go ? 0.5 : 0.18 }); }
  ability() { this.noiseHit({ freq: 2000, q: 0.5, peak: 0.25, attack: 0.15, decay: 0.4 }); this.tone({ freq: 300, to: 1200, type: 'sawtooth', peak: 0.08, attack: 0.05, decay: 0.35 }); }
  missionStart() { [523, 659, 784].forEach((f, i) => this.tone({ freq: f, type: 'triangle', peak: 0.2, decay: 0.5, delay: i * 0.09 })); }
  missionPassed() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'square', peak: 0.12, decay: 0.35, delay: i * 0.11 })); }
  missionFailed() { [440, 370, 311, 262].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', peak: 0.12, decay: 0.4, delay: i * 0.16 })); }
  wasted() { this.tone({ freq: 220, to: 55, type: 'sawtooth', peak: 0.25, attack: 0.05, decay: 2.5 }); this.noiseHit({ freq: 200, type: 'lowpass', peak: 0.4, attack: 0.3, decay: 2.5, brown: true }); }
  rankUp() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', peak: 0.2, decay: 0.6, delay: i * 0.08 })); }
  ui() { this.tone({ freq: 1200, peak: 0.08, decay: 0.05 }); }
}
