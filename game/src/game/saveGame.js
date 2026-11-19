// Save / continue and settings persistence through localStorage (guarded: storage can be
// unavailable in private windows, so every access is wrapped).

const SAVE_KEY = 'palmwire.save.v1';
const SETTINGS_KEY = 'palmwire.settings.v1';

export const DEFAULT_SETTINGS = { master: 0.8, music: 0.6, sfx: 0.9, sensitivity: 1, invertY: false, shadows: true };

function read(key) {
  try {
    const s = window.localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  return !!read(SAVE_KEY);
}

export function saveGame(G) {
  const p = G.player;
  const data = {
    version: 1,
    savedAt: Date.now(),
    tod: G.sky.tod,
    progression: G.prog.serialize(),
    player: {
      health: p.char.health,
      armour: p.char.armour,
      inventory: JSON.parse(JSON.stringify(p.inventory)),
      weapon: p.weapon,
    },
  };
  const ok = write(SAVE_KEY, data);
  if (G.hud) G.hud.notify(ok ? 'Game saved' : 'Could not save (storage unavailable)', 3);
  return ok;
}

export function loadGame() {
  return read(SAVE_KEY);
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(read(SETTINGS_KEY) || {}) };
}

export function saveSettings(s) {
  write(SETTINGS_KEY, s);
}
