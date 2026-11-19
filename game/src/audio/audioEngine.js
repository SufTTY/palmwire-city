// WebAudio plumbing: one context (created on the first click), master / sfx / music / ambient
// buses with a limiter, shared noise buffers, simple distance + stereo placement relative to
// the camera, and small voice helpers (enveloped tones and filtered noise bursts) that every
// synthesized sound in the game is built from.

export class AudioEngine {
  constructor(G) {
    this.G = G;
    this.ctx = null;
    this.ready = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    this.master.connect(limiter).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambientBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.ambientBus.connect(this.master);
    this.noise = this.makeNoise('white');
    this.pink = this.makeNoise('pink');
    this.brown = this.makeNoise('brown');
    // a short synthetic room reverb for the music bus
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(this.reverb).connect(wet).connect(this.musicBus);
    this.ready = true;
    this.applySettings();
  }

  applySettings() {
    if (!this.ready) return;
    const s = this.G.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master ?? 0.8, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music ?? 0.7, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx ?? 0.9, t, 0.05);
    this.ambientBus.gain.setTargetAtTime((s.sfx ?? 0.9) * 0.8, t, 0.05);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Held horn of the player's car (the looping voice lives in WorldSounds). */
  setHorn(on, pos) {
    if (this.world) this.world.setHorn(on, pos);
  }

  makeNoise(kind) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  makeImpulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /** Gain and pan for a world position relative to the camera. */
  placement(pos, ref = 18) {
    if (!pos) return { gain: 1, pan: 0 };
    const cam = this.G.camera;
    const dx = pos.x - cam.position.x, dy = pos.y - cam.position.y, dz = pos.z - cam.position.z;
    const d = Math.hypot(dx, dy, dz);
    const gain = 1 / (1 + Math.max(0, d - 2) / ref);
    const yaw = this.G.cam ? this.G.cam.yaw : 0;
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    return { gain: d > 400 ? 0 : gain, pan };
  }

  /** Output node for a positioned one-shot (gain + stereo pan into the sfx bus). */
  out(pos, volume = 1, bus = null, ref = 18) {
    const ctx = this.ctx;
    const { gain, pan } = this.placement(pos, ref);
    const g = ctx.createGain();
    g.gain.value = volume * gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(bus || this.sfxBus);
    return g;
  }

  tone(dest, { freq = 440, freq2 = null, type = 'sine', start = 0, dur = 0.2, vol = 0.3, attack = 0.005, release = null, detune = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + (release ?? dur) + 0.05);
    return o;
  }

  noiseBurst(dest, { start = 0, dur = 0.2, vol = 0.4, type = 'lowpass', freq = 1000, freq2 = null, q = 0.7, buffer = null, attack = 0.002 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = buffer || this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** A looping noise source through a filter into a gain (for engines, surf, rotor). */
  loopNoise(buffer, filterType, freq, dest) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(dest);
    src.start();
    return { src, filter: f, gain: g };
  }
}
