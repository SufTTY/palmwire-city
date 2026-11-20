// Mission engine: shows start markers for whatever is available, runs one mission at a time
// through its stages (setup, update, timers, dialogue), pays out on success, cleans up on
// failure, and exposes the state the HUD's mission card needs.
import { STAGES } from './stageTypes.js';
import './races.js';
import { STORY } from './storyMissions.js';
import { SIDE_JOBS } from './sideJobs.js';

export class MissionEngine {
  constructor(game) {
    this.game = game;
    this.story = STORY;
    this.side = SIDE_JOBS;
    this.active = null;
    this.ctx = null;
    this.startMarkers = new Map();   // def.id -> marker id
    this.cooldown = 0;
    this.lastResult = null;
    game.events.on('death', (e) => { if (e.human.role === 'player' && this.active) this.fail('You were wasted'); });
    game.events.on('busted', () => { if (this.active) this.fail('You were busted'); });
  }

  get all() { return [...this.story, ...this.side]; }

  nextStory() {
    const done = this.game.progression.missionsDone;
    return this.story.find((m) => !done.includes(m.id)) || null;
  }

  available() {
    const list = [];
    const next = this.nextStory();
    if (next) list.push(next);
    for (const s of this.side) if (!s.requires || s.requires(this.game)) list.push(s);
    return list;
  }

  /** Start markers on the map for available missions and jobs. */
  refreshStartMarkers() {
    const g = this.game;
    const avail = this.active ? [] : this.available();
    const ids = new Set(avail.map((m) => m.id));
    for (const [id, mk] of this.startMarkers) if (!ids.has(id)) { g.markers.remove(mk); this.startMarkers.delete(id); }
    for (const m of avail) {
      if (this.startMarkers.has(m.id)) continue;
      const p = m.startPos(g);
      this.startMarkers.set(m.id, g.markers.add('cylinder', p.x, p.z, { color: m.kind === 'story' ? 'mission' : m.kind === 'race' ? 'race' : m.kind === 'rampage' ? 'enemy' : 'job', radius: 2.2, height: 4 }));
    }
  }

  blips() {
    if (this.active) return this.ctx.blip ? [this.ctx.blip] : [];
    return this.available().map((m) => ({ ...m.startPos(this.game), kind: m.kind === 'story' ? 'mission' : m.kind, label: m.short || m.title }));
  }

  start(def) {
    const g = this.game;
    this.active = def;
    this.ctx = {
      game: g, mission: def, index: -1, vars: {}, markerIds: [], spawnedVehicles: [], tags: [], blip: null, hint: '', timer: 0,
      markers: g.markers,
      marker: (kind, x, z, opts) => { const id = g.markers.add(kind, x, z, opts); this.ctx.markerIds.push(id); this.ctx.followers.set(id, opts && opts.follow); return id; },
      followers: new Map(),
      removeMarkersFor: (things) => {
        for (const [id, f] of this.ctx.followers) if (f && things.includes(f)) { g.markers.remove(id); this.ctx.followers.delete(id); }
      },
    };
    this.refreshStartMarkers();
    if (def.onStart) def.onStart(g, this.ctx.vars);
    g.hud.missionBanner(def.kind === 'story' ? 'MISSION ' + def.number : def.kindLabel || 'SIDE JOB', def.title, '#ffd23f');
    g.audio && g.audio.sfx.missionStart();
    this.nextStage();
  }

  get stage() { return this.active ? this.active.stages[this.ctx.index] : null; }

  nextStage() {
    const ctx = this.ctx, g = this.game;
    const prev = this.stage;
    if (prev) this.cleanupStage(prev, false);
    ctx.index++;
    if (ctx.index >= this.active.stages.length) { this.complete(); return; }
    const st = this.stage;
    st._state = { ...st };
    const s = st._state;
    ctx.timer = typeof s.timer === 'function' ? s.timer(g, ctx.vars) : (s.timer || 0);
    ctx.hasTimer = !!s.timer;
    ctx.hint = '';
    ctx.blip = null;
    if (s.wanted) g.wanted.setStars(s.wanted);
    STAGES[s.type].setup(ctx, s);
    if (s.dialogue) g.hud.dialogue.queue(s.dialogue);
    if (ctx.index > 0) {
      g.hud.stageBanner('STAGE ' + ctx.index + '/' + this.active.stages.length + ' COMPLETE', s.text);
      g.audio && g.audio.sfx.checkpoint();
    }
  }

  cleanupStage(st, all) {
    const ctx = this.ctx, g = this.game;
    const s = st._state;
    if (s && STAGES[s.type].cleanup) STAGES[s.type].cleanup(ctx, s);
    for (const id of ctx.markerIds) g.markers.remove(id);
    ctx.markerIds.length = 0;
    ctx.followers.clear();
    if (all) {
      for (const v of ctx.spawnedVehicles) {
        v.persistent = false;
        if (v !== g.player.human.vehicle && !v.destroyed) { v.ai = null; v.parked = true; }
      }
      for (const t of ctx.tags) g.gangs.list.forEach((h) => { if (h.tag === t && h.alive) h.tag = 'leftover'; });
      g.wanted.minStars = 0;
    }
  }

  complete() {
    const g = this.game, def = this.active, ctx = this.ctx;
    const reward = typeof def.reward === 'function' ? def.reward(g, ctx.vars) : def.reward;
    g.progression.addCash(reward.cash);
    g.progression.addXP(reward.xp, def.district);
    if (def.kind === 'story') g.progression.missionsDone.push(def.id);
    else g.progression.sideDone[def.id] = (g.progression.sideDone[def.id] || 0) + 1;
    if (def.onComplete) def.onComplete(g, ctx.vars);
    this.cleanupStage(this.stage || def.stages[def.stages.length - 1], true);
    g.hud.resultBanner(def.kind === 'story' ? 'MISSION PASSED' : (def.passLabel || 'JOB DONE'), '+$' + reward.cash.toLocaleString('en-US') + '   +' + reward.xp + ' RP', '#3de07a');
    g.audio && g.audio.sfx.missionPassed();
    if (def.outro) g.hud.dialogue.queue(def.outro);
    this.lastResult = { id: def.id, passed: true };
    this.active = null;
    this.ctx = null;
    this.cooldown = 4;
    g.saveGame.autosave();
  }

  fail(reason) {
    const g = this.game;
    if (!this.active) return;
    this.cleanupStage(this.stage, true);
    g.hud.resultBanner('MISSION FAILED', reason, '#ff4060');
    g.audio && g.audio.sfx.missionFailed();
    this.lastResult = { id: this.active.id, passed: false };
    this.active = null;
    this.ctx = null;
    this.cooldown = 6;
  }

  abort() { if (this.active) this.fail('Mission abandoned'); }

  update(dt) {
    const g = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) {
      this.refreshStartMarkers();
      if (this.cooldown > 0 || g.respawn.active) return;
      const f = g.player.focus;
      for (const m of this.available()) {
        const p = m.startPos(g);
        const r = g.player.human.vehicle ? 4.5 : 2.4;
        if (Math.hypot(f.x - p.x, f.z - p.z) < r) {
          if (m.needVehicle && !g.player.human.vehicle) { g.hud.hintOnce(m.id, 'You need a vehicle for ' + m.title); continue; }
          this.start(m);
          return;
        }
      }
      return;
    }
    const ctx = this.ctx, st = this.stage, s = st._state;
    if (ctx.hasTimer && !s.timerPaused) {
      ctx.timer -= dt;
      if (ctx.timer <= 0) {
        if (s.timerSucceeds) { this.nextStage(); return; }
        this.fail(s.timeoutText || 'Out of time');
        return;
      }
    }
    const res = STAGES[s.type].update(ctx, s, dt);
    if (res === 'done') this.nextStage();
    else if (res && res.startsWith('fail:')) this.fail(res.slice(5));
  }

  /** Data for the HUD mission card. */
  card() {
    if (!this.active) return null;
    const def = this.active, ctx = this.ctx, st = this.stage;
    if (!st) return null;
    const s = st._state;
    const next = def.stages[ctx.index + 1];
    const prog = STAGES[s.type].progress ? STAGES[s.type].progress(ctx, s) : '';
    return {
      label: def.kind === 'story' ? 'MISSION ' + def.number : (def.kindLabel || 'SIDE JOB'),
      title: def.title,
      stage: ctx.index + 1, stages: def.stages.length,
      text: ctx.hint || s.text,
      next: next ? next.text : 'Collect your reward',
      timer: ctx.hasTimer ? ctx.timer : null,
      progress: prog,
    };
  }

  /** Jump straight into a mission (debug / screenshots). */
  forceStart(id, stageIndex = 0) {
    const def = this.all.find((m) => m.id === id);
    if (!def) return;
    if (this.active) this.abort();
    this.cooldown = 0;
    this.start(def);
    while (this.ctx && this.ctx.index < stageIndex) this.nextStage();
  }
}
