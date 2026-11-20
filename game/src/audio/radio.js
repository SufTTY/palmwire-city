// In-car radio: three invented stations whose music is composed on the fly by a step
// sequencer (synthwave, boom bap, tropical), with rotating track names and an OFF position.
import { Rng } from '../core/rng.js';

export const STATIONS = [
  { id: 'wave', name: 'WAVE 88 FM', genre: 'Synthwave', bpm: 104, root: 45, prog: [0, -4, 3, -2], style: 'synth',
    tracks: [['Lumen Coast', 'Neon Undertow'], ['Glass Pelican', 'Midnight on Sunline'], ['Vapor Marina', 'Chrome Lagoon'], ['Kestrel Club', 'Tail Lights Forever']] },
  { id: 'bayside', name: 'BAYSIDE 104.2', genre: 'Boom Bap', bpm: 88, root: 41, prog: [0, 5, 3, -2], style: 'hiphop',
    tracks: [['MC Driftwood', 'Saltwater Ledger'], ['Kid Coquina', 'Canal Kids'], ['Lantana Lo', 'Palm Reader'], ['Breaker Street Crew', 'Low Tide Season']] },
  { id: 'coral', name: 'CORAL CALIENTE 97.3', genre: 'Tropical', bpm: 98, root: 48, prog: [0, 5, 7, 5], style: 'tropical',
    tracks: [['Los Flamencos del Muelle', 'Calle Mango'], ['DJ Marea', 'Sol de Medianoche'], ['La Brisa', 'Pier Pressure'], ['Coquí Sound', 'Arena Dorada']] },
  { id: 'off', name: 'RADIO OFF', genre: '', tracks: [['', '']] },
];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Radio {
  constructor(engine) {
    this.e = engine;
    this.index = 0;
    this.trackIndex = 0;
    this.trackTime = 0;
    this.step = 0;
    this.nextTime = 0;
    this.playing = false;
    this.menuMode = false;
    this.rng = new Rng(88);
    this.out = null;
  }

  get station() { return STATIONS[this.index]; }
  get stationName() { return this.station.name; }
  get track() { const t = this.station.tracks[this.trackIndex % this.station.tracks.length]; return t[0] ? t[0] + ' — ' + t[1] : ''; }

  next() {
    this.index = (this.index + 1) % STATIONS.length;
    this.trackIndex = Math.floor(Math.random() * 4);
    this.trackTime = 0;
    this.step = 0;
    if (this.e.ready) this.nextTime = this.e.ctx.currentTime + 0.1;
    this.e.game.hud && this.e.game.hud.radioPop(this.stationName, this.track);
    this.e.sfx.noiseHit({ freq: 3000, q: 0.3, peak: 0.08, decay: 0.15 });
  }

  ensureOut() {
    if (this.out) return;
    const ctx = this.e.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000;
    this.out.connect(tone).connect(this.e.musicBus);
  }

  update(dt) {
    const g = this.e.game, ctx = this.e.ctx;
    this.ensureOut();
    const inCar = !!g.player.human.vehicle && !g.paused;
    const want = (inCar || this.menuMode) && this.station.id !== 'off';
    this.out.gain.setTargetAtTime(want ? (this.menuMode ? 0.5 : 0.9) : 0, ctx.currentTime, 0.3);
    if (!want) { this.playing = false; return; }
    if (!this.playing) { this.playing = true; this.nextTime = ctx.currentTime + 0.05; }
    this.trackTime += dt;
    if (this.trackTime > 80) { this.trackTime = 0; this.trackIndex++; this.rng = new Rng(this.trackIndex * 31 + this.index); }
    const st = this.station;
    const stepDur = 60 / st.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(st, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur * (st.style === 'hiphop' && this.step % 2 === 0 ? 1.12 : st.style === 'hiphop' ? 0.88 : 1);
      this.step = (this.step + 1) % 64;
    }
  }

  // ---- instruments ----
  voice(type, freq, t, dur, peak, { filter = null, detune = 0, attack = 0.005 } = {}) {
    const ctx = this.e.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; node = o.connect(f); }
    node.connect(g).connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  kick(t, peak = 0.9) {
    const ctx = this.e.ctx;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.32);
  }
  noise(t, dur, freq, type, peak) {
    const ctx = this.e.ctx;
    const s = this.e.noiseSource();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + dur + 0.02);
  }
  chordTones(st, bar) {
    const r = st.root + st.prog[bar % 4];
    const minor = st.style !== 'tropical' && (st.prog[bar % 4] === 0);
    return [r, r + (minor ? 3 : 4), r + 7, r + 12];
  }

  playStep(st, step, t, sd) {
    const bar = Math.floor(step / 16), s = step % 16;
    const ch = this.chordTones(st, bar);
    const r = this.rng;
    if (st.style === 'synth') {
      if (s % 4 === 0) this.kick(t, 0.7);
      if (s === 4 || s === 12) this.noise(t, 0.18, 1800, 'bandpass', 0.35);
      if (s % 2 === 1) this.noise(t, 0.04, 8000, 'highpass', 0.08);
      if (s % 2 === 0) this.voice('sawtooth', midi(ch[0] - 12 + (s % 4 === 2 ? 12 : 0)), t, sd * 1.8, 0.12, { filter: 700 });
      this.voice('square', midi(ch[(s + bar) % 4] + 12), t, sd * 0.9, 0.035, { filter: 2400 });
      if (s === 0) for (const n of ch.slice(0, 3)) { this.voice('sawtooth', midi(n), t, sd * 15, 0.03, { filter: 1500, detune: 8, attack: 0.3 }); this.voice('sawtooth', midi(n), t, sd * 15, 0.03, { filter: 1500, detune: -8, attack: 0.3 }); }
    } else if (st.style === 'hiphop') {
      if (s === 0 || s === 7 || s === 10) this.kick(t, 0.95);
      if (s === 4 || s === 12) this.noise(t, 0.2, 1500, 'bandpass', 0.45);
      if (s % 2 === 0) this.noise(t, 0.05, 9000, 'highpass', s % 4 === 2 ? 0.1 : 0.06);
      if (s === 0 || s === 10) this.voice('sine', midi(ch[0] - 12), t, sd * 5, 0.32);
      if (s === 0 || s === 6) for (const n of ch.slice(0, 3)) this.voice('triangle', midi(n + 12), t, sd * 3, 0.05);
      if (s === 14 && r.chance(0.5)) this.voice('triangle', midi(ch[r.int(0, 3)] + 24), t, sd * 2, 0.04);
    } else {
      if (s === 0 || s === 8) this.kick(t, 0.85);
      if (s === 3 || s === 6 || s === 11 || s === 14) this.noise(t, 0.12, 2200, 'bandpass', 0.3);
      this.noise(t, 0.03, 10000, 'highpass', s % 4 === 0 ? 0.09 : 0.05);
      if (s === 0 || s === 3 || s === 8 || s === 11) this.voice('sine', midi(ch[0] - 12 + (s === 11 ? 7 : 0)), t, sd * 2.5, 0.3);
      if (r.chance(0.55)) this.voice('triangle', midi(ch[r.int(0, 3)] + 24), t, sd * 1.4, 0.06);
    }
  }
}
