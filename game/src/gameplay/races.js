// Street races: routes through the grid, a starting grid with AI rivals, a countdown,
// checkpoint rings, live race positions and the finishing order.
import { STAGES } from './stageTypes.js';
import { AIDriver } from '../actors/aiDriver.js';
import { BLOCK } from '../config.js';

export const RACE_ROUTES = {
  sunline: { name: 'Sunline Sprint', corners: [[1, 14], [9, 14], [9, 11], [6, 11], [6, 13], [2, 13], [2, 14]], rivals: ['stingline', 'hammerhead', 'pipit'] },
  glasswater: { name: 'Glasswater Loop', corners: [[4, 2], [8, 2], [8, 7], [5, 7], [5, 4], [4, 4], [4, 2]], rivals: ['hammerhead', 'meridian', 'stingline'] },
  canal: { name: 'Canal Dash', corners: [[9, 1], [12, 1], [12, 8], [10, 8], [10, 12], [13, 12]], rivals: ['wasp', 'hammerhead', 'mesquite'] },
};

/** Expand corner list into adjacent grid node coords. */
export function expandRoute(corners) {
  const out = [corners[0]];
  for (let k = 1; k < corners.length; k++) {
    let [i, j] = out[out.length - 1];
    const [ti, tj] = corners[k];
    while (i !== ti || j !== tj) {
      if (i !== ti) i += Math.sign(ti - i); else j += Math.sign(tj - j);
      out.push([i, j]);
    }
  }
  return out;
}

export function raceStart(routeKey) {
  const r = expandRoute(RACE_ROUTES[routeKey].corners);
  const [i0, j0] = r[0], [i1, j1] = r[1];
  const dx = Math.sign(i1 - i0), dz = Math.sign(j1 - j0);
  return { x: i0 * BLOCK + dx * 18 + (-dz) * 3, z: j0 * BLOCK + dz * 18 + dx * 3, yaw: Math.atan2(dx, dz) };
}

STAGES.race = {
  setup(ctx, st) {
    const g = ctx.game, rg = g.roadGraph;
    const route = expandRoute(RACE_ROUTES[st.route].corners);
    st.nodes = route.map(([i, j]) => rg.id(i, j));
    st.cps = [];
    for (let k = 2; k < route.length; k += 2) st.cps.push(rg.pos(st.nodes[k]));
    if ((route.length - 1) % 2 === 1) st.cps.push(rg.pos(st.nodes[route.length - 1]));
    st.cp = 0;
    st.countdown = 3.2;
    st.done = false;
    st.rivals = [];
    const pv = g.player.human.vehicle;
    const a = st.nodes[0], b = st.nodes[1];
    const d = rg.dir(a, b);
    const yaw = Math.atan2(d.x, d.z);
    // grid: player in the right lane, rivals beside and behind
    const p0 = rg.pos(a);
    const gridPos = (along, lane) => ({ x: p0.x + d.x * along + -d.z * lane, z: p0.z + d.z * along + d.x * lane });
    if (pv) {
      const gp = gridPos(18, 3);
      pv.pos.set(gp.x, 0, gp.z); pv.yaw = yaw; pv.vel.set(0, 0, 0); pv.yawRate = 0;
    }
    const slots = [[18, -3], [11, 3], [11, -3]];
    const rivalTypes = RACE_ROUTES[st.route].rivals.slice(0, st.rivalCount ?? 3);
    rivalTypes.forEach((type, k) => {
      const gp = gridPos(slots[k][0], slots[k][1]);
      // clear traffic off the grid
      for (const o of [...g.vehicles.list]) if (o !== pv && o.traffic && Math.hypot(o.pos.x - gp.x, o.pos.z - gp.z) < 30) { g.traffic.release(o); g.vehicles.remove(o); }
      const v = g.vehicles.spawn(type, { x: gp.x, z: gp.z, yaw });
      v.persistent = true;
      v.npcDriver = { skin: 0xe0ac69, hair: 0x111111, shirt: 0xff4fa3, pants: 0x222222 };
      const idx = (n) => st.nodes.indexOf(n);
      const ai = new AIDriver(g, v, {
        a, b, cruise: 0, obeySignals: false, caution: 0.45,
        nextNode: (prev, cur) => { const i = idx(cur); return i >= 0 && i < st.nodes.length - 1 ? st.nodes[i + 1] : rg.randomNext(prev, cur, g.traffic.rng); },
      });
      ai.raceCruise = (st.pace || 31) + k * -1.5 + (type === 'stingline' ? 4 : 0);
      st.rivals.push({ v, ai, cp: 0, finished: false });
      ctx.spawnedVehicles.push(v);
    });
    st.ring = ctx.marker('ring', st.cps[0].x, st.cps[0].z, { color: 'race', radius: 6 });
    st.ring2 = st.cps[1] ? ctx.marker('ring', st.cps[1].x, st.cps[1].z, { color: 0xffffff, radius: 4 }) : null;
    st.finishOrder = [];
    ctx.vars.raceStartTime = g.time;
  },
  update(ctx, st, dt) {
    const g = ctx.game, pv = g.player.human.vehicle;
    if (st.countdown > 0) {
      const before = Math.ceil(st.countdown);
      st.countdown -= dt;
      const now = Math.ceil(st.countdown);
      if (now !== before) { g.hud.bigText(now > 0 ? String(now) : 'GO!', now > 0 ? '#ffd23f' : '#3de07a'); g.audio && g.audio.sfx.beep(now <= 0); }
      if (pv) { pv.controls.handbrake = true; pv.controls.throttle = 0; pv.vel.set(0, 0, 0); }
      for (const r of st.rivals) { r.v.vel.set(0, 0, 0); r.ai.cruise = 0; }
      if (st.countdown <= 0) for (const r of st.rivals) r.ai.cruise = r.ai.raceCruise;
      return null;
    }
    for (const r of st.rivals) {
      r.ai.update(dt);
      if (r.finished) { r.ai.cruise = 10; continue; }
      const c = st.cps[r.cp];
      if (Math.hypot(r.v.pos.x - c.x, r.v.pos.z - c.z) < 16) {
        r.cp++;
        if (r.cp >= st.cps.length) { r.finished = true; st.finishOrder.push(r); }
      }
    }
    if (!pv) { ctx.hint = 'Get back in a vehicle!'; return null; }
    ctx.hint = '';
    const c = st.cps[st.cp];
    ctx.blip = { x: c.x, z: c.z, kind: 'race' };
    if (Math.hypot(pv.pos.x - c.x, pv.pos.z - c.z) < 11) {
      st.cp++;
      g.fx.particles.checkpointSparkle(c.x, 2, c.z, 0xff5fd2);
      g.audio && g.audio.sfx.checkpoint();
      if (st.cp >= st.cps.length) {
        st.place = st.finishOrder.length + 1;
        ctx.vars.racePlace = st.place;
        ctx.vars.raceTime = g.time - ctx.vars.raceStartTime;
        for (const r of st.rivals) { r.ai.cruise = 12; }
        if (st.mustWin && st.place > 1) return 'fail:Finished ' + ordinal(st.place) + ' — you needed the win';
        return 'done';
      }
      const n = st.cps[st.cp], n2 = st.cps[st.cp + 1];
      ctx.markers.move(st.ring, n.x, n.z);
      if (st.ring2) { if (n2) ctx.markers.move(st.ring2, n2.x, n2.z); else ctx.markers.move(st.ring2, -9999, -9999); }
    }
    return null;
  },
  progress(ctx, st) {
    return 'CP ' + Math.min(st.cp + 1, st.cps.length) + '/' + st.cps.length + ' · ' + ordinal(racePosition(ctx.game, st));
  },
  cleanup(ctx, st) {
    for (const r of st.rivals || []) r.v.ai = null;
  },
};

export function racePosition(g, st) {
  const pv = g.player.human.vehicle;
  if (!pv || !st.cps) return 1;
  const score = (cp, pos) => cp * 10000 - (st.cps[cp] ? Math.hypot(pos.x - st.cps[cp].x, pos.z - st.cps[cp].z) : 0);
  const mine = score(st.cp, pv.pos);
  let place = 1;
  for (const r of st.rivals) if (r.finished || score(r.cp, r.v.pos) > mine) place++;
  return place;
}

export function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
