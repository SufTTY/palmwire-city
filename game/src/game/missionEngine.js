// Runs the story and side jobs: shows start markers for whatever is available, starts a mission
// when the player steps into one, steps through its stages with objectives, GPS targets,
// timers and fail conditions, then pays out, unlocks, autosaves - and handles the safehouse.
import { Marker, TargetArrow } from './missionMarkers.js';
import { STORY } from './storyMissions.js';
import { SIDE_JOBS } from './sideJobs.js';
import { saveGame } from './saveGame.js';
import { CAST } from './cast.js';

const GIVER_STYLE = {
  coral: { color: 0xff5a8a, label: 'C' },
  dex: { color: 0xffb43a, label: 'D' },
  race: { color: 0x3dc5ff, label: 'R' },
  taxi: { color: 0x2bb3a6, label: 'T' },
  rampage: { color: 0xff3b3b, label: '!' },
};

export class MissionEngine {
  constructor(G) {
    this.G = G;
    this.defs = [...STORY, ...SIDE_JOBS];
    this.active = null;
    this.startMarkers = new Map();
    this.target = null;
    this.targetOpts = {};
    this.targetMarker = new Marker(G.scene, 0xffd23a, null, 4);
    this.targetMarker.visible = false;
    this.arrow = new TargetArrow(G.scene, 0xffd23a);
    this.timer = null;
    this.cooldown = 0;
    this.safehouse = new Marker(G.scene, 0x3ddc84, 'S', 1.4);
    const sh = G.landmarks.safehouse.door;
    this.safehouse.place(sh.x, sh.y, sh.z);
    this.safeCooldown = 0;
  }

  isAvailable(def) {
    const done = this.G.prog.completed;
    if (def.side) return (def.requires || []).every((r) => done.has(r));
    if (done.has(def.id)) return false;
    const i = STORY.indexOf(def);
    return i === 0 || done.has(STORY[i - 1].id);
  }

  /** The story mission that can be started now (for the HUD hint and minimap). */
  get nextStory() { return STORY.find((d) => this.isAvailable(d)) || null; }

  refreshStartMarkers() {
    const G = this.G;
    for (const def of this.defs) {
      const show = !this.active && this.isAvailable(def);
      let m = this.startMarkers.get(def.id);
      if (show && !m) {
        const st = GIVER_STYLE[def.giver];
        m = new Marker(G.scene, st.color, st.label, def.inVehicle ? 3.5 : 1.5);
        const p = def.marker(G);
        m.place(p.x, G.layout.groundHeight(p.x, p.z), p.z);
        this.startMarkers.set(def.id, m);
      }
      if (m) m.visible = show;
    }
  }

  /** Context object stages talk to. */
  makeCtx() {
    const self = this;
    return {
      G: this.G,
      vars: {},
      get target() { return self.target; },
      setObjective: (t) => this.G.hud.setObjective(t),
      setTarget: (pos, opts = {}) => { self.target = pos; self.targetOpts = opts; },
      clearTarget: () => { self.target = null; },
      startTimer: (s) => { self.timer = s; },
      stopTimer: () => { self.timer = null; },
    };
  }

  start(def) {
    const G = this.G;
    const stages = def.stages(G);
    this.active = { def, stages, idx: -1, ctx: this.makeCtx() };
    this.refreshStartMarkers();
    const giver = CAST[def.giver];
    G.hud.missionTitle(def.title, def.side ? 'Side job' : giver ? `${giver.name}` : '');
    G.events.emit('missionStarted', { def });
    this.advance();
  }

  advance() {
    const a = this.active;
    if (!a) return;
    if (a.idx >= 0 && a.stages[a.idx].end) a.stages[a.idx].end(a.ctx);
    a.idx++;
    if (a.idx >= a.stages.length) { this.pass(); return; }
    a.stages[a.idx].start(a.ctx);
  }

  pass() {
    const G = this.G;
    const def = this.active.def;
    const r = def.reward || {};
    this.cleanup();
    if (!def.side) G.prog.completed.add(def.id);
    if (r.cash) G.prog.addCash(r.cash, def.title);
    if (r.respect) G.prog.addRespect(r.respect);
    if (r.unlock) G.prog.unlock(r.unlock);
    if (def.side) G.prog.stats.sideJobs++;
    else G.prog.stats.missions++;
    G.hud.missionPassed(def.side ? 'JOB COMPLETE' : 'MISSION PASSED', r.cash ? r.cash : 0, r.respect || 0);
    if (G.audio) G.audio.sfx.missionPassed();
    this.cooldown = 4;
    if (def.final) setTimeout(() => G.hud.showCredits(), 3500);
    if (!G.shotMode) saveGame(G);
  }

  fail(reason) {
    if (!this.active) return;
    const G = this.G;
    this.cleanup();
    G.hud.missionFailed(reason);
    if (G.audio) G.audio.sfx.missionFailed();
    this.cooldown = 5;
  }

  cleanup() {
    const G = this.G;
    const a = this.active;
    if (!a) return;
    const st = a.stages[a.idx];
    if (st && st.end) st.end(a.ctx);
    for (const v of Object.values(a.ctx.vars)) {
      if (v && v.persistent && v !== G.player.vehicle && !v.removed && v.T) v.persistent = false;
    }
    if (a.ctx.vars.target && a.ctx.vars.target.fleeAI) a.ctx.vars.target.fleeAI = null;
    this.active = null;
    this.target = null;
    this.timer = null;
    G.hud.setObjective('');
    G.dialogue.close();
    G.wanted.locked = false;
    this.refreshStartMarkers();
  }

  update(dt, input) {
    const G = this.G;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.safeCooldown = Math.max(0, this.safeCooldown - dt);
    const pp = G.player.pos;
    this.refreshStartMarkers();
    for (const m of this.startMarkers.values()) if (m.visible) m.update(G.time);
    this.safehouse.update(G.time);

    if (this.active) {
      const a = this.active;
      if (this.timer !== null) {
        this.timer -= dt;
        if (this.timer <= 0) { this.fail('Out of time'); return; }
      }
      const res = a.stages[a.idx].update(a.ctx, dt);
      if (res === 'done') this.advance();
      else if (res && res.startsWith('fail:')) this.fail(res.slice(5));
    } else if (this.cooldown <= 0 && G.state === 'play') {
      for (const def of this.defs) {
        const m = this.startMarkers.get(def.id);
        if (!m || !m.visible) continue;
        const p = m.group.position;
        if (Math.hypot(pp.x - p.x, pp.z - p.z) > m.radius + (G.player.vehicle ? 1.5 : 0.3)) continue;
        if (def.inVehicle && !G.player.vehicle) { G.hud.hint('Bring a vehicle to start the race'); continue; }
        if (!def.inVehicle && G.player.vehicle && !def.side) { G.hud.hint('Get out of the vehicle to talk'); continue; }
        if (G.wanted.stars > 0) { G.hud.hint('Lose your wanted level first'); continue; }
        this.start(def);
        break;
      }
    }

    // safehouse: save and heal
    const sh = this.safehouse.group.position;
    if (!this.active && !G.player.vehicle && Math.hypot(pp.x - sh.x, pp.z - sh.z) < 1.8) {
      G.hud.hint('Press E to save at Seagrass Apartments');
      if (input.pressed('KeyE') && this.safeCooldown <= 0) {
        this.safeCooldown = 3;
        const ch = G.player.char;
        ch.health = ch.maxHealth;
        if (G.prog.unlocks.armour) ch.armour = 100;
        G.sky.setTime(G.sky.tod + 1);
        saveGame(G);
      }
    }

    // objective marker / arrow
    const t = this.target;
    const o = this.targetOpts;
    if (t && !o.hidden && !o.follow) {
      this.targetMarker.visible = true;
      this.targetMarker.setColor(o.color || 0xffd23a);
      if (this.targetMarker.radius !== (o.radius || 4)) this.targetMarker.setRadius(o.radius || 4);
      this.targetMarker.place(t.x, G.layout.groundHeight(t.x, t.z), t.z);
      this.targetMarker.update(G.time);
    } else this.targetMarker.visible = false;
    if (t && o.follow) {
      this.arrow.setColor(o.color || 0xff3b3b);
      this.arrow.update(o.follow.pos, G.camera, G.time, o.follow.T ? o.follow.T.hgt + 1.6 : 2.6);
    } else this.arrow.update(null);
  }

  /** Where the GPS should route to (mission target, else the next story giver). */
  get gpsTarget() {
    if (this.target) return this.target;
    const n = this.nextStory;
    return n ? n.marker(this.G) : null;
  }
}
