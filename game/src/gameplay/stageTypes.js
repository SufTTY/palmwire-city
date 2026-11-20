// The building blocks of every mission: each stage type knows how to set itself up (markers,
// enemies, target cars, pickups), report progress, and say when it is done or failed.
import { AIDriver } from '../actors/aiDriver.js';
import { Rng } from '../core/rng.js';

const rng = new Rng(4242);
const resolve = (ctx, p) => (typeof p === 'function' ? p(ctx.game, ctx.vars) : p);
const playerPos = (g) => g.player.focus;
const near = (g, p, r) => Math.hypot(playerPos(g).x - p.x, playerPos(g).z - p.z) < r;

export const STAGES = {
  goto: {
    setup(ctx, st) {
      st.pos = resolve(ctx, st.pos);
      ctx.marker('cylinder', st.pos.x, st.pos.z, { color: st.color || 'objective', radius: st.radius ?? 2.5 });
      ctx.blip = { x: st.pos.x, z: st.pos.z, kind: 'objective' };
    },
    update(ctx, st) {
      const g = ctx.game;
      if (st.needVehicle && !g.player.human.vehicle) { ctx.hint = 'Get a vehicle'; return null; }
      if (st.onFoot && g.player.human.vehicle) { ctx.hint = 'Get out of the vehicle'; }
      if (st.useVehicle && g.player.human.vehicle !== ctx.vars[st.useVehicle]) { ctx.hint = 'Get back in the ' + (ctx.vars[st.useVehicle]?.type.name || 'car'); ctx.blip = { x: ctx.vars[st.useVehicle].pos.x, z: ctx.vars[st.useVehicle].pos.z, kind: 'vehicle' }; return null; }
      ctx.blip = { x: st.pos.x, z: st.pos.z, kind: 'objective' };
      ctx.hint = '';
      const r = (st.radius ?? 2.5) + (g.player.human.vehicle ? 2.5 : 0);
      if (near(g, st.pos, r) && (!st.onFoot || !g.player.human.vehicle)) {
        if (st.stopRequired && g.player.human.vehicle && g.player.human.vehicle.speed > 4) { ctx.hint = 'Stop the vehicle'; return null; }
        return 'done';
      }
      return null;
    },
    progress(ctx, st) { const p = playerPos(ctx.game); return Math.round(Math.hypot(p.x - st.pos.x, p.z - st.pos.z)) + ' m'; },
  },

  enterVehicle: {
    setup(ctx, st) {
      const g = ctx.game;
      if (st.spawn) {
        const s = resolve(ctx, st.spawn);
        const v = g.vehicles.spawn(s.type, { x: s.x, z: s.z, yaw: s.yaw || 0, paint: s.paint });
        v.persistent = true; v.parked = true;
        ctx.vars[st.as || 'car'] = v;
        ctx.spawnedVehicles.push(v);
        ctx.marker('arrow', v.pos.x, v.pos.z, { color: 'objective', follow: v });
      }
    },
    update(ctx, st) {
      const g = ctx.game, v = g.player.human.vehicle;
      const target = st.spawn ? ctx.vars[st.as || 'car'] : null;
      if (target) {
        ctx.blip = { x: target.pos.x, z: target.pos.z, kind: 'vehicle' };
        if (target.destroyed) return 'fail:The car was destroyed';
      } else ctx.blip = null;
      if (!v) return null;
      if (target && v !== target) return null;
      if (st.filter && !st.filter(v)) { ctx.hint = st.filterHint || ''; return null; }
      ctx.vars[st.as || 'car'] = v;
      return 'done';
    },
  },

  kill: {
    setup(ctx, st) {
      const g = ctx.game;
      const s = resolve(ctx, st.spawn);
      const tag = 'm-' + ctx.mission.id + '-' + ctx.index;
      st.tag = tag;
      const crew = g.gangs.spawnCrew(s.x, s.z, s.n, { faction: s.faction || 'kings', weapon: s.weapon || 'pistol', tag, spread: s.spread || 7, skill: s.skill ?? 0.45, alerted: !!s.alerted });
      st.total = crew.length;
      for (const h of crew) ctx.marker('arrow', h.pos.x, h.pos.z, { color: 'enemy', follow: h, yOff: 2.6 });
      ctx.tags.push(tag);
      st.center = { x: s.x, z: s.z };
    },
    update(ctx, st) {
      const g = ctx.game;
      const alive = g.gangs.aliveWithTag(st.tag);
      ctx.removeMarkersFor(g.gangs.list.filter((h) => h.tag === st.tag && !h.alive));
      if (alive.length) ctx.blip = { x: alive[0].pos.x, z: alive[0].pos.z, kind: 'enemy' };
      st.left = alive.length;
      return alive.length === 0 ? 'done' : null;
    },
    progress(ctx, st) { return (st.total - (st.left ?? st.total)) + '/' + st.total + ' down'; },
  },

  collect: {
    setup(ctx, st) {
      const p = resolve(ctx, st.pos);
      st.pos = p;
      st.pickup = ctx.game.pickups.spawn('package', p.x, p.z, { label: st.label || 'Package', permanent: true });
      st.got = false;
      st.off = ctx.game.events.on('packageCollected', (e) => { if (e.pickup === st.pickup) st.got = true; });
      ctx.marker('arrow', p.x, p.z, { color: 'objective', yOff: 2.2 });
      ctx.blip = { x: p.x, z: p.z, kind: 'objective' };
    },
    update(ctx, st) { return st.got ? 'done' : null; },
    cleanup(ctx, st) { if (st.off) st.off(); if (!st.got && st.pickup) ctx.game.pickups.remove(st.pickup); },
  },

  lose: {
    setup(ctx, st) {
      const g = ctx.game;
      if (st.stars && g.wanted.stars < st.stars) g.wanted.setStars(st.stars);
      st.started = 0;
    },
    update(ctx, st, dt) {
      st.started += dt;
      ctx.blip = null;
      return st.started > 1 && ctx.game.wanted.stars === 0 ? 'done' : null;
    },
    progress(ctx) { return ctx.game.wanted.seen ? 'they see you' : 'out of sight'; },
  },

  chase: {
    setup(ctx, st) {
      const g = ctx.game;
      const s = resolve(ctx, st.spawn);
      const slot = g.roadGraph.spawnSlot(s.x, s.z, rng, 0, 40) || { x: s.x, z: s.z, yaw: 0 };
      const v = g.vehicles.spawn(s.type, { x: slot.x, z: slot.z, yaw: slot.yaw, paint: s.paint });
      v.persistent = true;
      v.health = v.maxHealth * (s.toughness || 1);
      v.maxHealth = v.health;
      v.npcDriver = { skin: 0xffdbac, hair: 0x222222, shirt: 0x15171c, pants: 0x111111 };
      new AIDriver(g, v, { a: slot.a, b: slot.b, nextNode: (p, c) => g.roadGraph.randomNext(p, c, rng), cruise: s.speed || 22, obeySignals: false, caution: 0.35 });
      if (slot.a === undefined) v.ai.reanchor();
      v.chaseTarget = true;
      ctx.vars[st.as || 'target'] = v;
      ctx.spawnedVehicles.push(v);
      ctx.marker('arrow', v.pos.x, v.pos.z, { color: 'enemy', follow: v });
      st.lost = 0;
    },
    update(ctx, st, dt) {
      const g = ctx.game, v = ctx.vars[st.as || 'target'];
      ctx.blip = { x: v.pos.x, z: v.pos.z, kind: 'enemy' };
      if (v.ai && v.ai.update) v.ai.update(dt);
      const d = Math.hypot(v.pos.x - playerPos(g).x, v.pos.z - playerPos(g).z);
      st.dist = d;
      if (d > 260) { st.lost += dt; if (st.lost > 6) return 'fail:The target got away'; } else st.lost = 0;
      if (v.health <= 0 || v.destroyed) { ctx.vars.wreckPos = { x: v.pos.x + 3, z: v.pos.z }; return 'done'; }
      return null;
    },
    progress(ctx, st) { const v = ctx.vars[st.as || 'target']; return 'target ' + Math.round((v.health / v.maxHealth) * 100) + '% · ' + Math.round(st.dist || 0) + ' m'; },
  },

  survive: {
    setup(ctx, st) {
      const p = resolve(ctx, st.pos);
      st.pos = p;
      st.wave = 0;
      st.next = 1;
      st.tag = 'm-' + ctx.mission.id + '-surv';
      ctx.tags.push(st.tag);
      ctx.marker('cylinder', p.x, p.z, { color: 'objective', radius: st.radius ?? 14, height: 1.5 });
      ctx.blip = { x: p.x, z: p.z, kind: 'objective' };
    },
    update(ctx, st, dt) {
      const g = ctx.game;
      st.next -= dt;
      if (st.next <= 0 && st.wave < (st.waves || 4)) {
        st.next = st.every || 11;
        st.wave++;
        const a = rng.float() * Math.PI * 2;
        const x = st.pos.x + Math.cos(a) * 30, z = st.pos.z + Math.sin(a) * 30;
        g.gangs.spawnCrew(x, z, st.per || 3, { faction: st.faction || 'vell', weapon: st.weapon || ['pistol', 'smg'], tag: st.tag, alerted: true, spread: 4 });
      }
      if (st.leash && !near(g, st.pos, (st.radius ?? 14) + 25)) return 'fail:You left the area';
      return ctx.timer <= 0 ? 'done' : null;
    },
    progress(ctx, st) { return 'wave ' + st.wave + '/' + (st.waves || 4); },
  },
};
