// Outfits for everyone in Palmwire City: beach and street civilians, PCPD officers, the
// Gullcrest Kings crew (teal and violet), Marrow Company suits, and Rae Solano herself.

const SKINS = [0xf1c9a5, 0xe0ac85, 0xc68b62, 0xa86d47, 0x8a5634, 0x6b3f25, 0xf5d6be];
const HAIR = [0x1b1410, 0x3a2416, 0x6b4426, 0xb98a4e, 0xe0c27a, 0x8a8a8a, 0x2a1a30];
const SHIRTS = [0xff6f61, 0x41b3a3, 0xffd166, 0xf7f7f2, 0x3d7dd8, 0xef8fc0, 0x8bd17c, 0xffa94d, 0x6c5ce7, 0x222222, 0x00a6a6];
const PANTS = [0x2b3a55, 0x3c3c3c, 0xc8b89a, 0x5a6b7a, 0x1d1d1d, 0xe8e2d0, 0x6b4f3a];
const SHOES = [0x222222, 0xf2f2f2, 0x7a4a2a, 0x3355aa];

export function civilianLook(rng, district) {
  const beach = district === 'beach' || district === 'shore';
  const skin = rng.pick(SKINS);
  const swim = beach && rng.chance(0.45);
  return {
    skin,
    shirt: swim ? skin : rng.pick(SHIRTS),
    sleeves: swim ? skin : undefined,
    pants: swim ? rng.pick([0xff6f61, 0x1fb5a8, 0xffd166, 0x3d7dd8]) : rng.pick(PANTS),
    shoes: swim ? skin : rng.pick(SHOES),
    hair: rng.pick(HAIR),
    hairStyle: rng.pick(['short', 'short', 'long', 'cap', 'bald']),
    hat: rng.pick(SHIRTS),
    shades: rng.chance(beach ? 0.6 : 0.25),
    scale: rng.range(0.92, 1.06),
  };
}

export function copLook(rng) {
  return {
    skin: rng.pick(SKINS), shirt: 0x1f3d7a, sleeves: 0x1f3d7a, pants: 0x14213d, shoes: 0x111111,
    hair: rng.pick(HAIR), hairStyle: 'cap', hat: 0x14213d, shades: rng.chance(0.5), vest: 0x2a2f3a, scale: rng.range(0.98, 1.06),
  };
}

export function gangLook(rng) {
  return {
    skin: rng.pick(SKINS), shirt: rng.pick([0x1fb5a8, 0x7a3fa0, 0x14a39a]), sleeves: undefined,
    pants: rng.pick([0x1d1d1d, 0x2b2b44]), shoes: 0xf2f2f2, hair: rng.pick(HAIR),
    hairStyle: rng.pick(['cap', 'short', 'bald']), hat: 0x7a3fa0, shades: rng.chance(0.6), scale: rng.range(0.98, 1.08),
  };
}

export function suitLook(rng) {
  return {
    skin: rng.pick(SKINS), shirt: 0x2a2d34, sleeves: 0x2a2d34, pants: 0x2a2d34, shoes: 0x111111,
    hair: rng.pick(HAIR), hairStyle: 'short', shades: true, vest: 0xf2f2f2, scale: 1.02,
  };
}

export const PLAYER_LOOK = {
  skin: 0xc68b62, shirt: 0xf2efe6, sleeves: 0xf2efe6, vest: 0xd94f3d, pants: 0x2b3a55, shoes: 0xf5f5f5,
  hair: 0x1b1410, hairStyle: 'long', shades: true, scale: 1,
};
