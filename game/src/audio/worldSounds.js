// Continuous sounds of the world: the player's engine (pitch follows speed through five
// gears), tyre squeal, the nearest police siren (wail, or yelp at high stars), the helicopter
// rotor, the held horn, surf that swells near the coast, city hum, gulls by day and crickets
// by night.
import { CITY, BEACH_END, QUAY_END, CELL } from '../world/cityLayout.js';
import { clamp } from '../core/mathUtil.js';

export class WorldSounds {
  constructor(G, engine) {
    this.G = G;
    this.a = engine;
    this.started = false;
    this.birdT = 3;
  }

  start() {
    const a = this.a;
    if (!a.ready || this.started) return;
    this.started = true;
    const ctx = a.ctx;
    // engine: saw + square sub through a lowpass
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 900;
    this.engFilter.connect(this.engGain).connect(a.sfxBus);
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    this.osc1.connect(this.engFilter);
    this.osc2.connect(g2).connect(this.engFilter);
    this.osc1.start();
    this.osc2.start();
    this.screech = a.loopNoise(a.noise, 'bandpass', 1800, a.sfxBus);
    this.screech.filter.Q.value = 6;
    // siren
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'square';
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 2200;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenPan = ctx.createStereoPanner();
    this.sirenOsc.connect(sf).connect(this.sirenGain).connect(this.sirenPan).connect(a.sfxBus);
    this.sirenOsc.start();
    // rotor: brown noise with a fast amplitude chop
    this.rotor = a.loopNoise(a.brown, 'lowpass', 400, a.sfxBus);
    this.rotorLfo = ctx.createOscillator();
    this.rotorLfo.frequency.value = 17;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    this.rotorAm = ctx.createGain();
    this.rotorAm.gain.value = 0.5;
    this.rotor.gain.disconnect();
    this.rotor.gain.connect(this.rotorAm).connect(a.sfxBus);
    this.rotorLfo.connect(lfoGain).connect(this.rotorAm.gain);
    this.rotorLfo.start();
    // horn
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    for (const f of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(this.hornGain);
      o.start();
    }
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 1800;
    this.hornGain.connect(hf).connect(a.sfxBus);
    // ambience
    this.surf = a.loopNoise(a.pink, 'lowpass', 650, a.ambientBus);
    this.city = a.loopNoise(a.brown, 'lowpass', 260, a.ambientBus);
  }

  setHorn(on, pos) {
    if (!this.started) return;
    this.hornGain.gain.setTargetAtTime(on ? 0.09 : 0, this.a.now, 0.02);
    if (on && pos) this.G.events.emit('horn', { pos });
  }

  update(dt) {
    if (!this.started) { this.start(); if (!this.started) return; }
    const G = this.G;
    const t = this.a.now;
    const v = G.player.vehicle;
    const active = G.state === 'play' || G.state === 'cutscene';
    // engine
    if (v && !v.isWreck && active) {
      const sp = Math.abs(v.speed);
      const frac = clamp(sp / v.T.maxSpeed, 0, 1);
      const gears = v.T.bike ? 6 : 5;
      const g = Math.min(gears - 1, Math.floor(frac * gears));
      const inGear = frac * gears - g;
      const rpm = 0.25 + inGear * 0.75;
      const base = v.T.bike ? 70 : v.T.style === 'muscle' ? 38 : v.T.style === 'sports' ? 55 : 45;
      const f = base + rpm * base * 2.2 + g * 6 + (v.controls.throttle ? 8 : 0);
      this.osc1.frequency.setTargetAtTime(f, t, 0.05);
      this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engFilter.frequency.setTargetAtTime(500 + rpm * 1400 + (v.controls.throttle ? 500 : 0), t, 0.05);
      this.engGain.gain.setTargetAtTime(0.05 + (v.controls.throttle ? 0.05 : 0.02), t, 0.08);
      this.screech.gain.gain.setTargetAtTime(v.skid > 0 && sp > 3 ? 0.1 * v.skid : 0, t, 0.05);
    } else {
      this.engGain.gain.setTargetAtTime(0, t, 0.1);
      this.screech.gain.gain.setTargetAtTime(0, t, 0.05);
    }
    // nearest siren
    let best = null, bd = 260;
    for (const c of G.police.cars) {
      if (!c.sirenOn || c.isWreck) continue;
      const d = c.pos.distanceTo(G.camera.position);
      if (d < bd) { bd = d; best = c; }
    }
    if (best && active) {
      const yelp = G.wanted.stars >= 3;
      const ph = yelp ? (t * 3.2) % 1 : 0.5 + 0.5 * Math.sin(t * 1.6);
      const f = yelp ? 700 + 600 * (ph < 0.5 ? ph * 2 : 2 - ph * 2) : 650 + 500 * ph;
      this.sirenOsc.frequency.setTargetAtTime(f, t, 0.02);
      const { gain, pan } = this.a.placement(best.pos, 40);
      this.sirenGain.gain.setTargetAtTime(0.07 * gain, t, 0.1);
      this.sirenPan.pan.setTargetAtTime(pan, t, 0.1);
    } else this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    // helicopter
    const heli = G.police.heli;
    if (heli.active && active) {
      const { gain } = this.a.placement(heli.pos, 50);
      this.rotor.gain.gain.setTargetAtTime(0.5 * gain, t, 0.2);
    } else this.rotor.gain.gain.setTargetAtTime(0, t, 0.3);
    // coast and city ambience
    const p = G.camera.position;
    const coast = Math.min(Math.abs(BEACH_END - p.x), Math.abs(QUAY_END - p.z), Math.hypot(p.x - 11 * CELL, p.z - 12 * CELL) - 160);
    const surfLevel = clamp(1 - coast / 160, 0, 1);
    const swell = 0.6 + 0.4 * Math.sin(t * 0.7) * Math.sin(t * 0.23);
    this.surf.gain.gain.setTargetAtTime(0.18 * surfLevel * swell + 0.01, t, 0.3);
    const inCity = p.x > 0 && p.x < CITY && p.z > 0 && p.z < CITY ? 1 : 0.4;
    this.city.gain.gain.setTargetAtTime(0.05 * inCity, t, 0.5);
    // gulls by day near the water, crickets at night
    this.birdT -= dt;
    if (this.birdT <= 0 && active) {
      this.birdT = 2 + Math.random() * 6;
      const night = G.sky.night > 0.5;
      const out = this.a.out(null, night ? 0.15 : 0.12 * (0.3 + surfLevel), this.a.ambientBus);
      if (night) for (let k = 0; k < 6; k++) this.a.tone(out, { freq: 4300, start: k * 0.07, dur: 0.04, vol: 0.12 });
      else {
        for (let k = 0; k < 3; k++) this.a.tone(out, { freq: 1500, freq2: 900, start: k * 0.22, dur: 0.18, vol: 0.12, type: 'triangle', attack: 0.02 });
      }
    }
  }
}
