// Building blocks for missions. Each stage is { start(ctx), update(ctx, dt) -> 'done' |
// 'fail:<reason>' | null, end(ctx) }. Missions are lists of these: talk, get a car, drive or
// walk somewhere (optionally in a specific car, under a timer), fight a squad, raise or lose a
// wanted level, chase down a fleeing car, and run checkpoint courses.
import { angleDiff, clamp } from '../core/mathUtil.js';
import { suitLook } from '../entities/characterLooks.js';

const resolve = (v, G, ctx) => (typeof v === 'function' ? v(G, ctx) : v);

export function talk(lines) {
  return {
    start(ctx) { ctx.G.dialogue.play(lines); ctx.setObjective(''); },
    update(ctx) { return ctx.G.dialogue.active ? null : 'done'; },
  };
}

export function getCar(text = 'Get a vehicle', type = null) {
  return {
    start(ctx) { ctx.setObjective(text); ctx.clearTarget(); },
    update(ctx) {
      const v = ctx.G.player.vehicle;
      return v && (!type || v.type === type) ? 'done' : null;
    },
  };
}

/** Spawn a persistent mission car somewhere and remember it under ctx.vars[tag]. */
export function spawnCar(tag, type, where, opts = {}) {
  return {
    start(ctx) {
      const p = resolve(where, ctx.G, ctx);
      const v = ctx.G.vehicles.spawn(type, { x: p.x, z: p.z, heading: p.heading ?? 0, mode: 'parked', paint: opts.paint });
      v.persistent = true;
      v.tag = tag;
      ctx.vars[tag] = v;
    },
    update() { return 'done'; },
  };
}

/** Get into the tagged mission car (an arrow hovers over it). */
export function enterCar(tag, text) {
  return {
    start(ctx) { ctx.setObjective(text); },
    update(ctx) {
      const v = ctx.vars[tag];
      if (!v || v.isWreck || v.removed) return 'fail:The car was destroyed';
      ctx.setTarget(v.pos, { radius: 3, color: 0x3d9bff, follow: v });
      return ctx.G.player.vehicle === v ? 'done' : null;
    },
  };
}

/**
 * Reach a place. opts: text, radius, vehicleTag (must be in that car), inVehicle, timeLimit,
 * minHealth (fraction of the tagged car's health on arrival), stop (must be slow on arrival),
 * call (a phone conversation that plays while you drive, without stopping the car).
 */
export function goTo(where, opts = {}) {
  return {
    start(ctx) {
      ctx.setObjective(opts.text || 'Go to the marker');
      ctx.setTarget(resolve(where, ctx.G, ctx), { radius: opts.radius || 4, color: opts.color });
      if (opts.timeLimit) ctx.startTimer(opts.timeLimit);
      if (opts.call) ctx.G.dialogue.play(opts.call, { lock: false });
    },
    update(ctx) {
      const G = ctx.G;
      const p = G.player;
      if (opts.vehicleTag) {
        const v = ctx.vars[opts.vehicleTag];
        if (!v || v.isWreck || v.removed) return 'fail:The car was destroyed';
        if (v.inWater) return 'fail:The car ended up in the sea';
        if (p.vehicle !== v) {
          ctx.setObjective(opts.backText || `Get back in the ${v.T.name}`);
          ctx.setTarget(v.pos, { radius: 3, color: 0x3d9bff, follow: v });
          return null;
        }
        ctx.setObjective(opts.text);
        ctx.setTarget(resolve(where, G, ctx), { radius: opts.radius || 4, color: opts.color });
        if (opts.minHealth && v.health / v.maxHealth < opts.minHealth) return 'fail:The car is too banged up';
      } else if (opts.inVehicle && !p.vehicle) {
        ctx.setObjective(opts.backText || 'Get a vehicle');
        return null;
      } else if (opts.onFoot && p.vehicle) {
        ctx.setObjective('Get out of the vehicle');
        return null;
      }
      const t = ctx.target;
      if (t && Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < (opts.radius || 4) + (p.vehicle ? 1.5 : 0)) {
        if (opts.stop && p.vehicle && p.vehicle.absSpeed > 4) { ctx.setObjective('Stop the car'); return null; }
        if (opts.needNoWanted && G.wanted.stars > 0) { ctx.setObjective('Lose your wanted level first'); return null; }
        return 'done';
      }
      return null;
    },
    end(ctx) { ctx.stopTimer(); },
  };
}

export function killSquad(where, count, opts = {}) {
  return {
    start(ctx) {
      const G = ctx.G;
      const p = resolve(where, G, ctx);
      ctx.vars.squad = G.gangs.spawnSquad(p, count, {
        weapons: opts.weapons || ['pistol'], health: opts.health || 70, radius: opts.radius || 7,
        faction: 'gang', look: opts.suits ? suitLook : undefined, accuracy: opts.accuracy ?? 0.45, alerted: opts.alerted,
      });
      ctx.setTarget(p, { radius: 0, color: 0xff3b3b, hidden: true });
      if (opts.timeLimit) ctx.startTimer(opts.timeLimit);
      ctx.total = count;
    },
    update(ctx) {
      const sq = ctx.vars.squad;
      const left = sq.alive;
      ctx.setObjective(`${opts.text || 'Take out the crew'} (${count - left}/${count})`);
      // keep the GPS on the nearest survivor
      let best = null, bd = Infinity;
      for (const m of sq.members) {
        if (!m.alive) continue;
        const d = m.pos.distanceTo(ctx.G.player.pos);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) ctx.setTarget(best.pos, { radius: 0, color: 0xff3b3b, hidden: true, follow: best });
      return left === 0 ? 'done' : null;
    },
    end(ctx) { ctx.stopTimer(); },
  };
}

export function reachWanted(stars, text) {
  return {
    start(ctx) { ctx.setObjective(text || `Get a ${stars}-star wanted level`); ctx.clearTarget(); },
    update(ctx) { return ctx.G.wanted.stars >= stars ? 'done' : null; },
  };
}

export function loseWanted(text = 'Lose the cops') {
  return {
    start(ctx) { ctx.setObjective(text); ctx.clearTarget(); },
    update(ctx) {
      const w = ctx.G.wanted;
      ctx.setObjective(w.seen ? text : `${text} — stay hidden (${Math.max(0, Math.ceil(w.evadeTime - w.unseenT))}s)`);
      return w.stars === 0 ? 'done' : null;
    },
  };
}

/**
 * A target car flees along the road graph; wreck it (or kill the driver) before it escapes.
 */
export function chaseCar(type, where, opts = {}) {
  return {
    start(ctx) {
      const G = ctx.G;
      const p = resolve(where, G, ctx);
      const v = G.vehicles.spawn(type, { x: p.x, z: p.z, heading: p.heading ?? 0, mode: 'physics', paint: opts.paint });
      v.persistent = true;
      v.health = v.maxHealth = opts.health || v.T.health * 1.3;
      v.fleeAI = { waypoint: null, stuckT: 0, reverseT: 0 };
      ctx.vars.target = v;
      ctx.setTarget(v.pos, { radius: 0, color: 0xff3b3b, follow: v, hidden: true });
      ctx.setObjective(opts.text || 'Wreck the target car');
    },
    update(ctx, dt) {
      const G = ctx.G;
      const v = ctx.vars.target;
      if (v.isWreck || v.inWater) return 'done';
      const d = v.pos.distanceTo(G.player.pos);
      if (d > (opts.escape || 330)) return 'fail:The target got away';
      ctx.setObjective(`${opts.text || 'Wreck the target car'}  ·  ${Math.round(v.health / v.maxHealth * 100)}%`);
      driveFleeing(G, v, dt, opts.speed || 0.82);
      return null;
    },
  };
}

function driveFleeing(G, v, dt, speedFrac) {
  const net = G.roads;
  const ai = v.fleeAI;
  const c = v.controls;
  const pp = G.player.pos;
  if (!ai.waypoint || Math.hypot(ai.waypoint.x - v.pos.x, ai.waypoint.z - v.pos.z) < 9) {
    const here = ai.waypoint || net.nearestNode(v.pos.x, v.pos.z);
    // pick the neighbouring junction that leads away from the player (but not straight back)
    let best = null, bs = -Infinity;
    for (const l of here.links) {
      const n = net.node(l.to);
      if (ai.prev && n.id === ai.prev.id) continue;
      const s = Math.hypot(n.x - pp.x, n.z - pp.z) + G.rng() * 40;
      if (s > bs) { bs = s; best = n; }
    }
    ai.prev = here;
    ai.waypoint = best || net.node(here.links[0].to);
  }
  const w = ai.waypoint;
  const want = Math.atan2(w.x - v.pos.x, w.z - v.pos.z);
  const err = angleDiff(v.heading, want);
  if (ai.reverseT > 0) {
    ai.reverseT -= dt;
    Object.assign(c, { throttle: 0, brake: 1, steer: clamp(err * 2, -1, 1), handbrake: false });
    return;
  }
  c.steer = clamp(-err * 2.2, -1, 1);
  const sp = v.speed;
  const sharp = Math.abs(err) > 0.6 && sp > 15;
  c.throttle = sharp || sp > v.T.maxSpeed * speedFrac ? 0 : 1;
  c.brake = sharp ? 0.5 : 0;
  c.handbrake = Math.abs(err) > 1.2 && sp > 10;
  if (c.throttle > 0 && Math.abs(sp) < 1.2) ai.stuckT += dt; else ai.stuckT = 0;
  if (ai.stuckT > 1.2) { ai.stuckT = 0; ai.reverseT = 1.2; }
}

/** A sequence of checkpoints (races, courier routes). */
export function checkpoints(points, opts = {}) {
  return {
    start(ctx) {
      ctx.vars.cp = 0;
      ctx.vars.cpList = resolve(points, ctx.G, ctx);
      if (opts.timeLimit) ctx.startTimer(opts.timeLimit);
      ctx.vars.cpStart = ctx.G.time;
    },
    update(ctx) {
      const G = ctx.G;
      const list = ctx.vars.cpList;
      if (opts.inVehicle && !G.player.vehicle) {
        ctx.setObjective('Get back in a vehicle');
        ctx.setTarget(list[ctx.vars.cp], { radius: opts.radius || 6, color: 0xffd23a });
        return null;
      }
      const i = ctx.vars.cp;
      const t = list[i];
      ctx.setTarget(t, { radius: opts.radius || 6, color: opts.color || 0xffd23a, next: list[i + 1] });
      ctx.setObjective(`${opts.text || 'Hit the checkpoints'} (${i}/${list.length})`);
      if (Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z) < (opts.radius || 6) + 2) {
        ctx.vars.cp++;
        if (G.audio) G.audio.sfx.pickup();
        if (ctx.vars.cp >= list.length) {
          ctx.vars.elapsed = G.time - ctx.vars.cpStart;
          return 'done';
        }
      }
      return null;
    },
    end(ctx) { ctx.stopTimer(); },
  };
}

/** Run arbitrary code once (give a weapon, set the time, lock the wanted level...). */
export function run(fn) {
  return { start(ctx) { fn(ctx.G, ctx); }, update() { return 'done'; } };
}
