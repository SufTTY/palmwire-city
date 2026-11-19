// Scripted play-through (?selftest=1): feeds real keyboard/mouse input into the game loop and
// checks that the main systems work end to end - walking, stealing and driving, shooting,
// the wanted level and police response, dying and respawning, and missions / side jobs.
// Results are written into the page so a headless browser can read them.

export function runSelfTest(G) {
  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  const input = G.input;
  const frames = (n, fn) => {
    for (let k = 0; k < n; k++) {
      if (fn) fn(k);
      G.step(1 / 30);
    }
  };
  const hold = (code, n, fn) => { input.down.add(code); frames(n, fn); input.down.delete(code); };
  const tap = (code) => { input.pressedNow.add(code); input.down.add(code); G.step(1 / 30); input.down.delete(code); };
  const click = () => { input.clicked[0] = true; input.buttons[0] = true; G.step(1 / 30); input.buttons[0] = false; };
  const p = G.player;

  // --- new game and walking
  G.session.begin(false);
  ok('new game starts in play state', G.state === 'play');
  const start = p.char.pos.clone();
  hold('KeyW', 45);
  ok('walking moves the player', p.char.pos.distanceTo(start) > 3, p.char.pos.distanceTo(start).toFixed(1) + ' m');
  hold('ShiftLeft', 1);
  tap('Space');
  frames(10);
  ok('player still alive after jump', p.alive);

  // --- enter the car outside the safehouse and drive
  const car = G.vehicles.list.find((v) => v.owned);
  ok('a car waits outside the safehouse', !!car);
  if (car) {
    p.char.pos.set(car.pos.x + 2.5, car.pos.y, car.pos.z);
    tap('KeyF');
    ok('F enters the vehicle', p.vehicle === car);
    const c0 = car.pos.clone();
    hold('KeyW', 90);
    ok('throttle drives the car', car.pos.distanceTo(c0) > 15, car.pos.distanceTo(c0).toFixed(1) + ' m, ' + (car.absSpeed * 3.6).toFixed(0) + ' km/h');
    hold('KeyD', 20, () => input.down.add('KeyW'));
    input.down.delete('KeyW');
    hold('Space', 20);
    hold('KeyS', 40);
    tap('KeyF');
    frames(5);
    ok('F exits the vehicle', !p.vehicle && !p.char.inVehicle);
  }

  // --- traffic and pedestrians exist
  frames(120);
  ok('traffic spawned', G.traffic.cars.length > 5, G.traffic.cars.length + ' cars');
  ok('pedestrians spawned', G.peds.list.length > 5, G.peds.list.length + ' peds');

  // --- carjack a traffic car
  const tcar = G.traffic.cars[0];
  if (tcar) {
    p.char.pos.set(tcar.pos.x + 2.2, tcar.pos.y, tcar.pos.z);
    tap('KeyF');
    ok('carjacking a traffic car', p.vehicle === tcar && tcar.mode === 'physics');
    tap('KeyF');
    frames(5);
  }

  // --- shooting a pedestrian raises the wanted level
  G.wanted.clear();
  const victim = G.peds.list.find((q) => q.alive);
  if (victim) {
    p.selectWeapon('pistol');
    p.char.pos.set(victim.pos.x - 6, victim.pos.y, victim.pos.z);
    victim.pos.y = G.layout.groundHeight(victim.pos.x, victim.pos.z);
    G.cam.yaw = Math.atan2(victim.pos.x - p.char.pos.x, victim.pos.z - p.char.pos.z);
    G.cam.pitch = 0.05;
    G.step(1 / 30);
    let shots = 0;
    const fwd = { x: Math.sin(G.cam.yaw), z: Math.cos(G.cam.yaw) };
    for (let k = 0; k < 12 && victim.alive; k++) {
      victim.pos.set(p.char.pos.x + 6 * fwd.x, victim.pos.y, p.char.pos.z + 6 * fwd.z);
      victim.vel.set(0, 0, 0);
      input.buttons[2] = true;
      G.step(1 / 30);
      // put the crosshair (screen centre) on the victim's chest, like a player would
      const cp = G.camera.position;
      const dx = victim.pos.x - cp.x, dy = victim.pos.y + 1.2 - cp.y, dz = victim.pos.z - cp.z;
      G.cam.yaw = Math.atan2(dx, dz);
      G.cam.pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      G.step(1 / 30);
      click();
      frames(8);
      shots++;
    }
    input.buttons[2] = false;
    ok('pistol kills a pedestrian', !victim.alive, shots + ' shots');
    ok('crime raises the wanted level', G.wanted.stars >= 1, G.wanted.stars + ' stars');
  }
  // --- police respond
  G.wanted.setStars(3);
  frames(240);
  ok('police cruisers respond', G.police.cars.length > 0, G.police.cars.length + ' cruisers');
  G.wanted.setStars(4);
  frames(60);
  ok('helicopter joins at 4 stars', G.police.heli.active);
  // --- death and respawn
  p.char.takeDamage(1000, { type: 'test' });
  ok('death shows FLATLINED', G.state === 'dead');
  frames(260);
  ok('respawn at the hospital', G.state === 'play' && p.alive && G.wanted.stars === 0, G.state);

  // --- story mission 1: Homecoming
  const run = (id) => G.missions.defs.find((d) => d.id === id);
  const skipTalk = () => { for (let k = 0; k < 20 && G.dialogue.active; k++) { tap('Space'); tap('Space'); } };
  G.missions.cooldown = 0;
  const m1 = run('m1');
  const door = m1.marker(G);
  p.char.pos.set(door.x, door.y, door.z);
  frames(3);
  ok('walking into a marker starts a mission', G.missions.active && G.missions.active.def.id === 'm1');
  skipTalk();
  frames(2);
  const ride = G.vehicles.spawn('sedan', { x: p.char.pos.x + 3, z: p.char.pos.z, heading: 0, mode: 'parked' });
  p.char.pos.set(ride.pos.x + 2.3, ride.pos.y, ride.pos.z);
  tap('KeyF');
  frames(3);
  const gp = G.landmarks.garage.parking;
  ride.pos.set(gp.x, ride.pos.y, gp.z);
  ride.vx = ride.vz = 0;
  frames(4);
  skipTalk();
  frames(4);
  ok('mission 1 passes', G.prog.completed.has('m1'), [...G.prog.completed].join(','));
  if (p.vehicle) { tap('KeyF'); frames(3); }

  // --- story mission 3: Hard Rinse (combat); the test player is made very tough
  p.char.maxHealth = p.char.health = 100000;
  G.prog.completed.add('m2');
  G.missions.cooldown = 0;
  G.wanted.clear();
  const m3 = run('m3');
  const d3 = m3.marker(G);
  p.char.pos.set(d3.x, d3.y, d3.z);
  frames(3);
  ok('mission 3 starts', G.missions.active && G.missions.active.def.id === 'm3');
  skipTalk();
  frames(3);
  ok('SMG unlocked by Hard Rinse', p.inventory.smg.owned);
  const tgt = G.missions.target;
  if (tgt) p.char.pos.set(tgt.x, 0.2, tgt.z);
  frames(4);
  const squad = G.missions.active && G.missions.active.ctx.vars.squad;
  ok('Kings squad spawned', squad && squad.members.length === 6);
  frames(60);
  p.char.health = 100;
  if (squad) for (const m of squad.members) m.takeDamage(500, { attacker: p.char, weapon: 'smg' });
  frames(4);
  skipTalk();
  G.wanted.clear();
  const back = G.landmarks.laundromat.door;
  p.char.pos.set(back.x, back.y, back.z);
  frames(4);
  ok('mission 3 passes', G.prog.completed.has('m3'));

  // --- mission 6: chase the van
  G.prog.completed.add('m4');
  G.prog.completed.add('m5');
  G.missions.cooldown = 0;
  G.wanted.clear();
  const m6 = run('m6');
  const d6 = m6.marker(G);
  p.char.pos.set(d6.x, d6.y, d6.z);
  frames(3);
  const mk = G.missions.startMarkers.get('m6');
  ok('mission 6 starts', G.missions.active && G.missions.active.def.id === 'm6',
    `state=${G.state} active=${G.missions.active && G.missions.active.def.id} avail=${G.missions.isAvailable(m6)} stars=${G.wanted.stars} veh=${!!p.vehicle} cd=${G.missions.cooldown.toFixed(1)} marker=${mk ? mk.visible + ' d=' + Math.hypot(mk.group.position.x - p.char.pos.x, mk.group.position.z - p.char.pos.z).toFixed(1) : 'none'}`);
  skipTalk();
  frames(5);
  const van0 = G.missions.active && G.missions.active.ctx.vars.target;
  if (van0) p.char.pos.set(van0.pos.x + 40, 0.2, van0.pos.z + 8); // close in so it bolts
  frames(60);
  const van = G.missions.active && G.missions.active.ctx.vars.target;
  ok('ledger van flees under AI', van && van.pos.distanceTo(van.fleeStart || van.pos) >= 0 && van.absSpeed > 2, van ? (van.absSpeed * 3.6).toFixed(0) + ' km/h' : 'none');
  if (van) {
    p.char.pos.set(van.pos.x + 30, 0.2, van.pos.z);
    van.explode({ attacker: p.char });
    frames(3);
    const wp = van.pos;
    p.char.pos.set(wp.x + 1, 0.2, wp.z);
    frames(3);
    G.wanted.clear();
    p.char.pos.set(back.x, back.y, back.z);
    frames(4);
    skipTalk();
    frames(3);
  }
  ok('mission 6 passes and unlocks the shotgun', G.prog.completed.has('m6') && p.inventory.shotgun.owned);

  // --- side job: race
  G.missions.cooldown = 0;
  G.wanted.clear();
  const race = run('race');
  const rp = race.marker(G);
  const rc = G.vehicles.spawn('sports', { x: rp.x, z: rp.z, heading: 0, mode: 'physics' });
  p.char.pos.set(rc.pos.x + 2.3, 0.2, rc.pos.z);
  tap('KeyF');
  frames(3);
  ok('race starts in a vehicle', G.missions.active && G.missions.active.def.id === 'race');
  skipTalk();
  for (let k = 0; k < 12 && G.missions.active; k++) {
    const t = G.missions.target;
    if (t) { rc.pos.set(t.x, 0, t.z); rc.vx = rc.vz = 0; }
    frames(2);
  }
  ok('race completes', !G.missions.active);

  // --- save
  G.missions.cooldown = 0;
  const sh = G.landmarks.safehouse.door;
  if (p.vehicle) { tap('KeyF'); frames(3); }
  p.char.pos.set(sh.x, sh.y, sh.z);
  frames(2);
  tap('KeyE');
  let saved = false;
  try { saved = !!window.localStorage.getItem('palmwire.save.v1'); } catch (e) { saved = 'n/a'; }
  ok('safehouse save', saved !== false, String(saved));

  // --- stress: long free-roam with high wanted level
  G.wanted.setStars(5);
  p.char.health = 100000;
  frames(600, (k) => { if (k % 60 === 0) p.char.pos.x += 8; });
  ok('10 s at five stars without errors', window.__errors.length === 0);
  ok('frame stats', true, `${G.characters.length} characters, ${G.vehicles.list.length} vehicles`);

  const errs = window.__errors;
  const report = log.concat(errs.map((e) => 'ERROR ' + e));
  document.getElementById('errlog').textContent = report.join('\n');
  document.title = 'selftest ' + (report.some((l) => l.startsWith('FAIL') || l.startsWith('ERROR')) ? 'FAILED' : 'OK');
}
