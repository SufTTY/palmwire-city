// Continuous vehicle sounds: the player's engine with simulated gear changes, tyre squeal,
// horn, the nearest police siren wailing, and the hum of passing traffic.

export class VehicleAudio {
  constructor(engine) { this.e = engine; this.ok = false; this.sirenPhase = 0; }

  init() {
    const ctx = this.e.ctx, bus = this.e.sfxBus;
    // engine: two detuned oscillators through a lowpass
    this.engOsc1 = ctx.createOscillator(); this.engOsc1.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square';
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600; this.engFilter.Q.value = 2;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.engOsc1.connect(this.engFilter); this.engOsc2.connect(g2).connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(bus);
    this.engOsc1.start(); this.engOsc2.start();
    // tyre squeal: band-passed noise
    this.skid = this.e.noiseSource();
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2600; sf.Q.value = 6;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    this.skid.connect(sf).connect(this.skidGain).connect(bus); this.skid.start();
    // horn
    this.horn1 = ctx.createOscillator(); this.horn1.type = 'square'; this.horn1.frequency.value = 392;
    this.horn2 = ctx.createOscillator(); this.horn2.type = 'square'; this.horn2.frequency.value = 494;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1800;
    this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0;
    this.horn1.connect(hf); this.horn2.connect(hf); hf.connect(this.hornGain).connect(bus);
    this.horn1.start(); this.horn2.start();
    // siren
    this.siren = ctx.createOscillator(); this.siren.type = 'triangle'; this.siren.frequency.value = 800;
    const sf2 = ctx.createBiquadFilter(); sf2.type = 'lowpass'; sf2.frequency.value = 2500;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.siren.connect(sf2).connect(this.sirenGain).connect(bus); this.siren.start();
    // traffic hum
    this.hum = this.e.noiseSource(true);
    const hf2 = ctx.createBiquadFilter(); hf2.type = 'lowpass'; hf2.frequency.value = 220;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    this.hum.connect(hf2).connect(this.humGain).connect(bus); this.hum.start();
    this.ok = true;
  }

  update(dt) {
    if (!this.ok) return;
    const g = this.e.game, ctx = this.e.ctx, t = ctx.currentTime;
    const v = g.player.human.vehicle;
    const smooth = (param, value, k = 0.08) => param.setTargetAtTime(value, t, k);
    if (v && !v.destroyed && !g.paused) {
      const sp = Math.abs(v.forwardSpeed), max = v.type.maxSpeed;
      const gears = v.type.bike ? 6 : 5;
      const gearSpan = max / gears;
      const gear = Math.min(gears - 1, Math.floor(sp / gearSpan));
      const within = (sp - gear * gearSpan) / gearSpan;
      const rpm = 0.25 + within * 0.75 * (gear === 0 ? 1 : 0.85) + (v.controls.throttle > 0 && sp < 1 ? 0.15 : 0);
      const base = v.type.bike ? 70 : v.type.mass > 2000 ? 38 : v.typeKey === 'stingline' || v.typeKey === 'hammerhead' ? 52 : 45;
      const f = base + rpm * base * 2.6;
      smooth(this.engOsc1.frequency, f);
      smooth(this.engOsc2.frequency, f * 0.5 + 1.5);
      smooth(this.engFilter.frequency, 300 + rpm * 1400 * (v.controls.throttle > 0 ? 1.3 : 0.8));
      smooth(this.engGain.gain, 0.09 + v.controls.throttle * 0.07);
      smooth(this.skidGain.gain, v.skidding && sp > 3 ? Math.min(0.18, v.slip * 0.03 + 0.05) : 0, 0.05);
      smooth(this.hornGain.gain, v.horn ? 0.12 : 0, 0.02);
    } else {
      smooth(this.engGain.gain, 0); smooth(this.skidGain.gain, 0); smooth(this.hornGain.gain, 0, 0.02);
    }
    // nearest siren
    let best = 0;
    for (const o of g.vehicles.list) {
      if (!o.siren || o.destroyed) continue;
      best = Math.max(best, this.e.distanceGain(o.pos.x, o.pos.z, 220));
    }
    this.sirenPhase += dt;
    const wail = 700 + 450 * (0.5 + 0.5 * Math.sin(this.sirenPhase * 2.2));
    smooth(this.siren.frequency, wail, 0.03);
    smooth(this.sirenGain.gain, g.paused ? 0 : best * 0.12, 0.1);
    // traffic hum from nearby moving cars
    let hum = 0;
    for (const o of g.vehicles.list) if (o !== v && o.speed > 3) hum = Math.max(hum, this.e.distanceGain(o.pos.x, o.pos.z, 40));
    smooth(this.humGain.gain, g.paused ? 0 : hum * 0.25, 0.2);
  }
}
