// One-shot sounds, all synthesized: three gun voices, explosions, crashes, punches, screams,
// car horns and alarms, reload clicks, pickups, cash, and the mission pass / fail stingers.

export class SoundEffects {
  constructor(engine) {
    this.a = engine;
    this.lastCrash = 0;
  }
  get ok() { return this.a.ready; }

  gunshot(kind, pos, isPlayer) {
    if (!this.ok) return;
    const a = this.a;
    const out = a.out(pos, isPlayer ? 0.9 : 0.75, null, 30);
    if (kind === 'shotgun') {
      a.noiseBurst(out, { dur: 0.45, vol: 1, freq: 1800, freq2: 300, type: 'lowpass' });
      a.tone(out, { freq: 110, freq2: 35, dur: 0.3, vol: 0.9, type: 'sine' });
    } else if (kind === 'smg') {
      a.noiseBurst(out, { dur: 0.09, vol: 0.7, freq: 3500, freq2: 900, type: 'lowpass' });
      a.tone(out, { freq: 160, freq2: 60, dur: 0.07, vol: 0.5, type: 'triangle' });
    } else {
      a.noiseBurst(out, { dur: 0.22, vol: 0.85, freq: 2800, freq2: 500, type: 'lowpass' });
      a.tone(out, { freq: 140, freq2: 45, dur: 0.15, vol: 0.7, type: 'sine' });
      a.noiseBurst(out, { start: 0.04, dur: 0.5, vol: 0.12, freq: 900, type: 'bandpass', q: 0.6 });
    }
  }

  explosion(pos) {
    if (!this.ok) return;
    const a = this.a;
    const out = a.out(pos, 1.2, null, 60);
    a.noiseBurst(out, { dur: 2.2, vol: 1, freq: 1200, freq2: 120, type: 'lowpass', attack: 0.01, buffer: a.brown });
    a.noiseBurst(out, { dur: 0.6, vol: 0.8, freq: 3000, freq2: 400, type: 'lowpass' });
    a.tone(out, { freq: 70, freq2: 22, dur: 1.2, vol: 1, type: 'sine' });
  }

  crash(pos, intensity = 1) {
    if (!this.ok) return;
    const now = this.a.now;
    if (now - this.lastCrash < 0.12) return;
    this.lastCrash = now;
    const a = this.a;
    const out = a.out(pos, Math.min(1, 0.35 + intensity * 0.5), null, 25);
    a.noiseBurst(out, { dur: 0.35, vol: 0.9, freq: 700, q: 1.2, type: 'bandpass' });
    a.tone(out, { freq: 190, freq2: 120, dur: 0.25, vol: 0.25, type: 'square' });
    a.tone(out, { freq: 283, freq2: 160, dur: 0.18, vol: 0.15, type: 'square' });
    a.noiseBurst(out, { start: 0.05, dur: 0.5, vol: 0.25, freq: 5000, type: 'highpass' });
  }

  punch(pos) {
    if (!this.ok) return;
    const out = this.a.out(pos, 0.8);
    this.a.noiseBurst(out, { dur: 0.12, vol: 0.8, freq: 500, type: 'lowpass' });
    this.a.tone(out, { freq: 90, freq2: 50, dur: 0.1, vol: 0.6 });
  }
  whoosh(pos) {
    if (!this.ok) return;
    this.a.noiseBurst(this.a.out(pos, 0.3), { dur: 0.18, vol: 0.5, freq: 600, freq2: 2400, type: 'bandpass', q: 2, attack: 0.05 });
  }
  scream(pos) {
    if (!this.ok) return;
    const a = this.a;
    const out = a.out(pos, 0.35, null, 14);
    const f0 = 520 + Math.random() * 400;
    const o = a.tone(out, { freq: f0, freq2: f0 * 1.4, dur: 0.7, vol: 0.25, type: 'sawtooth', attack: 0.04 });
    const lfo = a.ctx.createOscillator();
    const lg = a.ctx.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency);
    lfo.start();
    lfo.stop(a.now + 0.8);
  }
  horn(pos, vol = 0.7) {
    if (!this.ok) return;
    const out = this.a.out(pos, vol, null, 25);
    this.a.tone(out, { freq: 392, dur: 0.35, vol: 0.18, type: 'square', attack: 0.01 });
    this.a.tone(out, { freq: 494, dur: 0.35, vol: 0.15, type: 'square', attack: 0.01 });
  }
  carAlarm(pos) {
    if (!this.ok) return;
    const out = this.a.out(pos, 0.5, null, 25);
    for (let k = 0; k < 10; k++) this.a.tone(out, { freq: k % 2 ? 1300 : 900, start: k * 0.25, dur: 0.22, vol: 0.12, type: 'square' });
  }
  dryFire() {
    if (!this.ok) return;
    this.a.tone(this.a.out(null, 0.4), { freq: 2000, dur: 0.03, vol: 0.3, type: 'square' });
  }
  reload() {
    if (!this.ok) return;
    const out = this.a.out(null, 0.4);
    this.a.noiseBurst(out, { dur: 0.05, vol: 0.5, freq: 3000, type: 'bandpass', q: 3 });
    this.a.noiseBurst(out, { start: 0.45, dur: 0.06, vol: 0.6, freq: 2200, type: 'bandpass', q: 3 });
  }
  pickup() {
    if (!this.ok) return;
    const out = this.a.out(null, 0.5);
    [660, 880, 1320].forEach((f, k) => this.a.tone(out, { freq: f, start: k * 0.06, dur: 0.15, vol: 0.2, type: 'triangle' }));
  }
  cash() {
    if (!this.ok) return;
    const out = this.a.out(null, 0.5);
    this.a.tone(out, { freq: 1568, dur: 0.12, vol: 0.2, type: 'sine' });
    this.a.tone(out, { freq: 2093, start: 0.08, dur: 0.3, vol: 0.2, type: 'sine' });
  }
  ui(kind = 'click') {
    if (!this.ok) return;
    const out = this.a.out(null, 0.35);
    if (kind === 'hover') this.a.tone(out, { freq: 1200, dur: 0.04, vol: 0.08, type: 'sine' });
    else this.a.tone(out, { freq: 700, freq2: 1100, dur: 0.08, vol: 0.18, type: 'triangle' });
  }
  missionPassed() {
    if (!this.ok) return;
    const out = this.a.out(null, 0.7);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, k) => this.a.tone(out, { freq: f, start: k * 0.11, dur: 0.5, vol: 0.18, type: 'sawtooth' }));
    [523.25, 659.25, 783.99].forEach((f) => this.a.tone(out, { freq: f, start: 0.5, dur: 1.4, vol: 0.12, type: 'triangle' }));
    this.a.noiseBurst(out, { start: 0.5, dur: 0.8, vol: 0.15, freq: 6000, type: 'highpass' });
  }
  missionFailed() {
    if (!this.ok) return;
    const out = this.a.out(null, 0.6);
    [440, 392, 349.2, 261.6].forEach((f, k) => this.a.tone(out, { freq: f, start: k * 0.18, dur: 0.5, vol: 0.18, type: 'sawtooth' }));
  }
  heartbeat() {
    if (!this.ok) return;
    const out = this.a.out(null, 0.5);
    this.a.tone(out, { freq: 60, freq2: 40, dur: 0.12, vol: 0.6 });
    this.a.tone(out, { freq: 55, freq2: 38, start: 0.18, dur: 0.12, vol: 0.45 });
  }
  splash(pos) {
    if (!this.ok) return;
    this.a.noiseBurst(this.a.out(pos, 0.7), { dur: 0.8, vol: 0.7, freq: 1500, freq2: 400, type: 'lowpass' });
  }
}
