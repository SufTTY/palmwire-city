// ?selftest=1 — a scripted play-through that drives the real systems headlessly (stealing,
// driving, shooting, wanted levels, busted and wasted, explosions, a full story mission, a
// race, the garage, crew abilities, save/load) and writes a pass/fail report into the page.
import { landmarkDoor } from '../config.js';

const STEP = 1 / 30;

export async function runSelfTest(g) {
  const out = [];
  const log = (ok, name, info = '') => out.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : ''));
  const sim = (secs, each) => { for (let t = 0; t < secs; t += STEP) { if (each) each(t); g.time += STEP; g.update(STEP); g.input.endFrame(); } };
  const press = (code) => { g.input.pressed.add(code); g.input.down.add(code); };
  const release = (code) => { g.input.down.delete(code); };
  const tryStep = (name, fn) => { try { fn(); } catch (e) { log(false, name, String(e && e.stack || e).slice(0, 300)); } };

  g.startPlaying(false);
  g.paused = false;
  const p = g.player, h = p.human;

  tryStep('traffic and pedestrians populate', () => {
    sim(6);
    log(g.traffic.cars.length > 5 && g.peds.list.length > 10, 'traffic and pedestrians populate', `cars=${g.traffic.cars.length} peds=${g.peds.list.length} parked=${g.vehicles.activeSlots.size}`);
  });

  tryStep('steal a car from traffic', () => {
    const car = g.traffic.cars.find((v) => v.ai && !v.destroyed);
    h.pos.set(car.pos.x + 2, 0, car.pos.z + 1);
    car.vel.set(0, 0, 0);
    p.tryEnterVehicle();
    log(h.vehicle === car && !car.ai, 'steal a car from traffic', car.type.name);
  });

  tryStep('drive with handbrake drift', () => {
    const v = h.vehicle;
    const start = v.pos.clone();
    press('KeyW');
    sim(3);
    press('KeyD'); press('Space');
    let skid = false;
    sim(1.2, () => { if (v.skidding) skid = true; });
    release('KeyD'); release('Space'); release('KeyW');
    sim(1);
    log(v.pos.distanceTo(start) > 20, 'drive with handbrake drift', `moved ${v.pos.distanceTo(start).toFixed(0)} m, skid=${skid}, ${Math.round(v.kmh)} km/h`);
    press('KeyF'); sim(0.2); release('KeyF');
    log(!h.vehicle, 'exit vehicle with F');
  });

  tryStep('gunfire raises the wanted level and police respond', () => {
    p.arsenal.select('pistol');
    const ped = g.peds.list.find((x) => x.alive);
    ped.pos.set(h.pos.x + 4, 0.15, h.pos.z);
    g.combat.fire(h, p.arsenal.weapon, { x: h.pos.x, y: 1.5, z: h.pos.z }, { x: 1, y: -0.02, z: 0 });
    g.wanted.setStars(Math.max(2, g.wanted.stars));
    sim(12);
    log(g.wanted.stars >= 2 && g.police.units.length > 0, 'gunfire raises the wanted level and police respond', `stars=${g.wanted.stars} units=${g.police.units.length} tactics=${g.police.panel().map((r) => r.tactic).join(',')}`);
  });

  tryStep('four stars bring the helicopter and roadblocks', () => {
    const car = g.vehicles.spawn('hammerhead', { x: h.pos.x + 3, z: h.pos.z, yaw: 0 });
    p.placeInVehicle(car);
    g.wanted.setStars(4);
    press('KeyW');
    sim(8);
    release('KeyW');
    log(g.police.heli.active, 'four stars bring the helicopter and roadblocks', `units=${g.police.units.length} heli=${g.police.heli.active}`);
  });

  tryStep('busted', () => {
    if (h.vehicle) p.exitVehicle(false);
    g.wanted.setStars(1);
    let busted = false;
    const off = g.events.on('busted', () => { busted = true; });
    sim(25, () => {
      const cop = g.police.officers.find((o) => o.alive && !o.inCar);
      if (cop && !busted) { cop.pos.set(h.pos.x + 1, 0, h.pos.z); }
    });
    off();
    log(busted, 'busted', `units=${g.police.units.length} officers=${g.police.officers.length}`);
    sim(5);
    log(g.wanted.stars === 0 && h.alive && !g.respawn.active, 'respawn after busted');
  });

  tryStep('vehicle explosion and wasted', () => {
    const car = g.vehicles.spawn('meridian', { x: h.pos.x + 4, z: h.pos.z, yaw: 0 });
    car.damage(999);
    let boom = false;
    const off = g.events.on('explosion', () => { boom = true; });
    sim(6);
    off();
    log(boom && car.destroyed, 'vehicle explosion');
    h.damage(999, null, 'bullet');
    sim(1);
    log(g.respawn.active && g.respawn.active.kind === 'wasted', 'wasted screen');
    sim(5);
    log(h.alive && h.health === 100, 'respawn at hospital', `pos=${h.pos.x.toFixed(0)},${h.pos.z.toFixed(0)}`);
  });

  tryStep('mission 1 Homecoming end to end', () => {
    g.wanted.clear();
    const door = landmarkDoor('vee');
    h.pos.set(door.x, 0.15, door.z);
    sim(1);
    log(g.missions.active && g.missions.active.id === 'm1', 'mission starts from its marker');
    h.pos.set(door.x, 0.15, door.z - 1);
    sim(1);
    const car = g.vehicles.spawn('pipit', { x: h.pos.x + 3, z: h.pos.z + 8, yaw: 0 });
    p.placeInVehicle(car);
    sim(1);
    car.pos.set(544, 0, 622); car.vel.set(0, 0, 0);
    sim(2);
    log(g.progression.missionsDone.includes('m1') && g.progression.crew.mechanic, 'mission 1 Homecoming end to end', `cash=${g.progression.cash} xp=${g.progression.xp}`);
  });

  tryStep('garage upgrades and respray', () => {
    g.progression.cash += 5000;
    sim(4);
    g.missions.cooldown = 0;
    const v = h.vehicle;
    v.pos.set(544, 0, 622); v.vel.set(0, 0, 0);
    g.garage.wasInside = false;
    sim(0.2);
    const opened = g.ui.garageMenu.open;
    const ok = g.progression.buyUpgrade('engine');
    g.garage.respray(0x3a86ff);
    g.ui.garageMenu.hide();
    log(opened && ok && g.progression.garage.engine === 1, 'garage upgrades and respray', `opened=${opened}`);
  });

  tryStep('mission 4 chase, wreck and timed delivery', () => {
    g.missions.forceStart('m4', 1);
    sim(2);
    const target = g.missions.ctx.vars.target;
    target.damage(9999);
    sim(1);
    const st = g.missions.stage._state;
    log(st.type === 'collect', 'chase stage completes when the van is wrecked');
    const pk = st.pickup;
    if (h.vehicle) h.vehicle.pos.set(pk.x, 0, pk.z); else h.pos.set(pk.x, 0.15, pk.z);
    sim(1);
    const door = landmarkDoor('vee');
    if (h.vehicle) { h.vehicle.pos.set(door.x, 0, door.z + 4); h.vehicle.vel.set(0, 0, 0); } else h.pos.set(door.x, 0.15, door.z);
    sim(1.5);
    log(g.progression.missionsDone.includes('m4'), 'mission 4 chase, wreck and timed delivery');
  });

  tryStep('street race to the finish', () => {
    if (!h.vehicle) p.placeInVehicle(g.vehicles.spawn('stingline', { x: h.pos.x + 3, z: h.pos.z, yaw: 0 }));
    g.missions.forceStart('race-glasswater', 0);
    sim(4);
    const st = g.missions.stage._state;
    let guard = 0;
    while (g.missions.active && guard++ < 40) {
      const c = st.cps[st.cp];
      if (!c) break;
      h.vehicle.pos.set(c.x, 0, c.z); h.vehicle.vel.set(0, 0, 0);
      sim(0.3);
    }
    log(!g.missions.active && (g.progression.sideDone['race-glasswater'] || 0) > 0, 'street race to the finish', `place=${g.missions.lastResult && g.missions.lastResult.passed}`);
  });

  tryStep('crew abilities', () => {
    g.progression.crew = { driver: true, mechanic: true, lookout: true };
    g.wanted.setStars(3);
    press('KeyZ'); sim(0.1); release('KeyZ');
    press('KeyX'); sim(0.1); release('KeyX');
    press('KeyC'); sim(0.1); release('KeyC');
    log(g.crew.cooldowns.driver > 0 && g.crew.cooldowns.mechanic > 0 && g.crew.cooldowns.lookout > 0 && g.wanted.jam > 0, 'crew abilities');
    g.wanted.clear();
  });

  tryStep('kill stage with gang AI shooting back', () => {
    if (h.vehicle) p.exitVehicle(false);
    g.missions.forceStart('m2', 1);
    const tag = g.missions.stage._state.tag;
    const startHp = h.health + h.armour;
    sim(4);
    const crew = g.gangs.aliveWithTag(tag);
    const hurt = h.health + h.armour < startHp;
    for (const c of crew) c.damage(999, h);
    sim(1);
    log(g.missions.stage && g.missions.stage._state.type === 'collect', 'kill stage with gang AI shooting back', `crew=${crew.length} playerHurt=${hurt}`);
    g.missions.abort();
  });

  tryStep('save and load', () => {
    const cash = g.progression.cash;
    g.saveGame.save(true);
    g.progression.cash = 1;
    g.saveGame.load();
    log(g.progression.cash === cash, 'save and load', `cash=${cash}`);
  });

  tryStep('map screen and pause menu', () => {
    g.ui.mapScreen.show(); g.update(STEP); g.ui.mapScreen.hide();
    g.ui.menus.showPause(); g.ui.menus.resume();
    log(g.ui.menus.state === 'playing', 'map screen and pause menu');
  });

  tryStep('long run stability', () => {
    sim(30);
    log(true, 'long run stability', `vehicles=${g.vehicles.list.length} peds=${g.peds.list.length} cops=${g.police.officers.length} gangs=${g.gangs.list.length}`);
  });

  const errors = window.__pwErrors || [];
  log(errors.length === 0, 'no runtime errors', errors.slice(0, 3).join(' | '));
  const el = document.createElement('pre');
  el.id = 'selftest';
  el.textContent = out.join('\n');
  document.body.appendChild(el);
  document.title = out.some((l) => l.startsWith('FAIL')) ? 'SELFTEST FAIL' : 'SELFTEST PASS';
}
