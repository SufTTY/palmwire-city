// The arsenal: fists plus three original firearms. Damage per hit, seconds between shots,
// magazine size, cone spread (radians), camera recoil and screen shake.

export const WEAPONS = {
  fists: { key: 'fists', name: 'Fists', melee: true, damage: 18, rate: 0.42, range: 1.9, icon: 'fist' },
  pistol: {
    key: 'pistol', name: 'Vesper 9', damage: 30, rate: 0.24, mag: 12, spread: 0.01, range: 150,
    pellets: 1, auto: false, recoil: 0.03, shake: 0.12, reload: 1.1, icon: 'pistol', startAmmo: 60,
  },
  smg: {
    key: 'smg', name: 'Hornet SMG', damage: 16, rate: 0.075, mag: 30, spread: 0.032, range: 120,
    pellets: 1, auto: true, recoil: 0.012, shake: 0.08, reload: 1.6, icon: 'smg', startAmmo: 150,
  },
  shotgun: {
    key: 'shotgun', name: 'Breaker 12', damage: 14, rate: 0.85, mag: 6, spread: 0.075, range: 50,
    pellets: 8, auto: false, recoil: 0.09, shake: 0.35, reload: 2.0, icon: 'shotgun', startAmmo: 30,
  },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];
