// In-car radio with three procedurally composed stations, sequenced live on a look-ahead
// scheduler: WAVE 88.1 (night-drive synthwave), SOL 101.4 (dembow-flavoured beach rhythm) and
// KELP 94.7 (lo-fi chill with vinyl crackle). Each loops a chord progression with seeded
// melodic variation, so no two cars sound the same.
import { makeRng } from '../core/rng.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const STATIONS = [
  { key: 'off', name: 'Radio Off' },
  { key: 'wave', name: 'WAVE 88.1 — Neon Tide', bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },
  { key: 'sol', name: 'SOL 101.4 — Calle Caliente', bpm: 96, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 48, 52]] },
  { key: 'kelp', name: 'KELP 94.7 — Low Tide Lo-Fi', bpm: 78, chords: [[53, 57, 60, 64], [50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 59]] },
];

export class Radio {
  constructor(G, engine) {
    this.G = G;
    this.a = engine;
    this.index = 0;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.rng = makeRng(808);
    this.melody = [];
    this.title = false;
  }

  get station() { return STATIONS[this.index]; }

  setStation(i, announce = true) {
    this.index = (i + STATIONS.length) % STATIONS.length;
    this.step = 0;
    this.melody = Array.from({ length: 64 }, () => (this.rng() < 0.55 ? Math.floor(this.rng() * 5) : -1));
    if (this.a.ready) this.nextTime = this.a.now + 0.1;
    if (announce && this.G.hud) this.G.hud.showRadio(this.station.name);
    this.ensureRunning();
  }

  next(dir) {
    this.setStation(this.index + dir);
    if (this.G.player.vehicle) this.G.player.vehicle.station = this.index;
  }

  onEnterVehicle(v) {
    if (v.station === undefined) v.station = v.T.police ? 0 : 1 + Math.floor(this.G.rng() * 3);
    this.title = false;
    this.setStation(v.station);
  }
  onExitVehicle() {
    this.index = 0;
  }
  playTitleTheme(on) {
    this.title = on;
    if (on) this.setStation(1, false);
    else if (!this.G.player.vehicle) this.index = 0;
  }

  ensureRunning() {
    if (this.timer || !this.a.ready) return;
    this.nextTime = this.a.now + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  schedule() {
    if (!this.a.ready) return;
    const st = this.station;
    const paused = this.G.state === 'paused' && !this.title;
    if (st.key === 'off' || paused) { this.nextTime = this.a.now + 0.05; return; }
    const spb = 60 / st.bpm / 4; // seconds per 16th
    while (this.nextTime < this.a.now + 0.15) {
      this.playStep(st, this.step, this.nextTime);
      this.step++;
      // lo-fi swing: long-short pairs of sixteenths, same total length
      const swing = st.key === 'kelp' ? spb * 0.18 : 0;
      this.nextTime += spb + (this.step % 2 ? swing : -swing);
    }
  }

  // --- voices -------------------------------------------------------------------------------
  voice(t, freq, dur, type, vol, { cutoff = 3000, attack = 0.01, wet = false, detune = 0 } = {}) {
    const ctx = this.a.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.a.musicBus);
    if (wet) g.connect(this.a.reverbIn);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  kick(t, vol = 0.5) {
    const ctx = this.a.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.a.musicBus);
    o.start(t);
    o.stop(t + 0.35);
  }
  hit(t, freq, dur, vol, type = 'highpass', wet = false) {
    const ctx = this.a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.a.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.a.musicBus);
    if (wet) g.connect(this.a.reverbIn);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  playStep(st, step, t) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chord = st.chords[bar];
    const root = chord[0];
    const vol = this.title ? 0.55 : 1;
    if (st.key === 'wave') {
      if (s16 % 4 === 0) this.kick(t, 0.45 * vol);
      if (s16 === 4 || s16 === 12) this.hit(t, 1800, 0.25, 0.22 * vol, 'bandpass', true);
      if (s16 % 2 === 0) this.hit(t, 8000, 0.04, 0.05 * vol);
      if (s16 % 2 === 0) this.voice(t, midi(root - 24), 0.2, 'sawtooth', 0.12 * vol, { cutoff: 600 });
      const arp = chord[(s16 >> 0) % chord.length] + (s16 % 8 >= 4 ? 12 : 0);
      this.voice(t, midi(arp), 0.18, 'square', 0.035 * vol, { cutoff: 2400, wet: true });
      if (s16 === 0) for (const n of chord) {
        this.voice(t, midi(n), 1.9, 'sawtooth', 0.03 * vol, { cutoff: 1200, attack: 0.4, wet: true, detune: -8 });
        this.voice(t, midi(n), 1.9, 'sawtooth', 0.03 * vol, { cutoff: 1200, attack: 0.4, wet: true, detune: 8 });
      }
      const m = this.melody[(step % 64)];
      if (s16 % 4 === 2 && m >= 0) this.voice(t, midi(chord[m % chord.length] + 24), 0.4, 'triangle', 0.05 * vol, { wet: true });
    } else if (st.key === 'sol') {
      if (s16 % 4 === 0) this.kick(t, 0.5 * vol);
      if (s16 === 3 || s16 === 6 || s16 === 11 || s16 === 14) this.hit(t, 2500, 0.12, 0.2 * vol, 'bandpass');
      if (s16 % 2 === 1) this.hit(t, 9000, 0.03, 0.06 * vol);
      if (s16 === 0 || s16 === 7 || s16 === 10) this.voice(t, midi(root - 24), 0.35, 'sine', 0.3 * vol, { cutoff: 400 });
      const m = this.melody[(step % 64)];
      if (m >= 0 && s16 % 2 === 0) {
        const penta = [0, 3, 5, 7, 10];
        this.voice(t, midi(root + 12 + penta[m]), 0.22, 'sine', 0.08 * vol, { attack: 0.002, wet: true });
        this.voice(t, midi(root + 24 + penta[m]), 0.1, 'triangle', 0.025 * vol, { attack: 0.002 });
      }
      if (s16 === 0 || s16 === 8) for (const n of chord) this.voice(t, midi(n + 12), 0.5, 'triangle', 0.025 * vol, { cutoff: 1800 });
    } else if (st.key === 'kelp') {
      if (s16 === 0 || s16 === 10) this.kick(t, 0.35 * vol);
      if (s16 === 4 || s16 === 12) this.hit(t, 1400, 0.18, 0.12 * vol, 'bandpass', true);
      if (s16 % 2 === 0) this.hit(t, 7000, 0.05, 0.035 * vol);
      if (s16 === 0) for (const n of chord) {
        this.voice(t, midi(n), 2.2, 'sine', 0.05 * vol, { attack: 0.02, wet: true });
        this.voice(t, midi(n + 12), 1.2, 'triangle', 0.012 * vol, { attack: 0.01 });
      }
      if (s16 === 0 || s16 === 8) this.voice(t, midi(root - 12), 0.8, 'sine', 0.18 * vol, { cutoff: 300 });
      const m = this.melody[(step % 64)];
      if (m >= 0 && s16 % 4 === 2) this.voice(t, midi(chord[m % chord.length] + 12), 0.6, 'sine', 0.04 * vol, { wet: true });
      if (Math.random() < 0.3) this.hit(t, 3000, 0.01, 0.02 * vol, 'highpass');
    }
  }
}
