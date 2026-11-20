// WebAudio setup: one context created on the first user gesture, master/sfx/music/ambient
// buses tied to the volume settings, a shared noise buffer, and the sub-systems.
import { Sfx } from './sfx.js';
import { VehicleAudio } from './vehicleAudio.js';
import { Radio } from './radio.js';
import { Ambience } from './ambience.js';

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.sfx = new Sfx(this);
    this.vehicle = new VehicleAudio(this);
    this.radio = new Radio(this);
    this.ambience = new Ambience(this);
    game.settings.onChange(() => this.applyVolumes());
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Must be called from a user gesture (menu click). */
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.ambientBus = ctx.createGain(); this.ambientBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.applyVolumes();
    this.vehicle.init();
    this.ambience.init();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings;
    this.master.gain.value = s.get('masterVolume');
    this.sfxBus.gain.value = s.get('sfxVolume');
    this.musicBus.gain.value = s.get('musicVolume') * 0.6;
    this.ambientBus.gain.value = 0.5;
  }

  noiseSource(brown = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    return src;
  }

  /** 0..1 attenuation for a world position relative to the listener. */
  distanceGain(x, z, range = 120) {
    if (x === undefined) return 1;
    const f = this.game.player.focus;
    const d = Math.hypot(x - f.x, z - f.z);
    return Math.max(0, 1 - d / range) ** 1.5;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  update(dt) {
    if (!this.ready) return;
    this.vehicle.update(dt);
    this.radio.update(dt);
    this.ambience.update(dt);
  }
}
