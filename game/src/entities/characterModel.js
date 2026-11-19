// Low-poly people: five vertex-coloured meshes per person (torso+head, two arms, two legs) so
// a crowd stays cheap to draw, plus a swappable weapon in the right hand and a procedural
// walk / run / aim / ride / swim animation.
import * as THREE from 'three';
import { MeshBuilder } from '../world/meshBuilder.js';

const sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const weaponMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.4, metalness: 0.6 });

const WEAPON_GEOS = {};
function weaponGeometry(kind) {
  if (WEAPON_GEOS[kind]) return WEAPON_GEOS[kind];
  const b = new MeshBuilder();
  if (kind === 'pistol') {
    b.box(0, -0.02, 0.1, 0.05, 0.08, 0.24, 0x1d1f23);
    b.box(0, -0.1, 0.02, 0.045, 0.12, 0.06, 0x2a2622);
  } else if (kind === 'smg') {
    b.box(0, 0, 0.16, 0.06, 0.1, 0.42, 0x23262b);
    b.box(0, -0.14, 0.12, 0.05, 0.18, 0.06, 0x16181b);
    b.box(0, -0.03, -0.12, 0.05, 0.08, 0.18, 0x23262b);
  } else if (kind === 'shotgun') {
    b.box(0, 0, 0.3, 0.07, 0.08, 0.8, 0x2b2522);
    b.box(0, -0.06, -0.05, 0.06, 0.14, 0.3, 0x6a4628);
    b.box(0, -0.05, 0.38, 0.065, 0.06, 0.3, 0x6a4628);
  }
  WEAPON_GEOS[kind] = b.build();
  return WEAPON_GEOS[kind];
}

/**
 * look: { skin, shirt, pants, shoes, hair, hairStyle: 'short'|'long'|'bald'|'cap'|'helmet',
 *         hat, shades: bool, vest: color|null, scale }
 */
export function buildCharacterModel(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // torso + head
  const t = new MeshBuilder();
  t.box(0, 1.24, 0, 0.5, 0.6, 0.28, look.shirt);
  if (look.vest) t.box(0, 1.26, 0, 0.53, 0.5, 0.31, look.vest);
  t.box(0, 0.98, 0, 0.46, 0.14, 0.26, look.pants);
  t.box(0, 1.6, 0, 0.12, 0.08, 0.12, look.skin);
  t.box(0, 1.77, 0.01, 0.26, 0.28, 0.27, look.skin);
  t.box(0, 1.76, 0.145, 0.05, 0.07, 0.03, look.skin);
  if (look.shades) t.box(0, 1.8, 0.14, 0.24, 0.05, 0.02, 0x101010);
  else {
    t.box(-0.06, 1.8, 0.14, 0.04, 0.035, 0.01, 0x1b1b1b);
    t.box(0.06, 1.8, 0.14, 0.04, 0.035, 0.01, 0x1b1b1b);
  }
  const hs = look.hairStyle || 'short';
  if (hs === 'short') t.box(0, 1.93, -0.01, 0.28, 0.07, 0.29, look.hair);
  if (hs === 'long') {
    t.box(0, 1.93, -0.01, 0.28, 0.08, 0.29, look.hair);
    t.box(0, 1.74, -0.12, 0.28, 0.36, 0.06, look.hair);
  }
  if (hs === 'cap') {
    t.box(0, 1.94, -0.01, 0.29, 0.09, 0.29, look.hat ?? look.hair);
    t.box(0, 1.91, 0.18, 0.26, 0.03, 0.14, look.hat ?? look.hair);
  }
  if (hs === 'helmet') t.box(0, 1.86, 0, 0.32, 0.26, 0.32, look.hat ?? 0x222222);
  const torso = new THREE.Mesh(t.build(), sharedMat);
  torso.castShadow = true;
  body.add(torso);

  // a limb hangs from a pivot (hip or shoulder) so it can swing; endColor paints the shoe or hand
  const limb = (x, y, len, w, color, endColor, endLen) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const b = new MeshBuilder();
    b.box(0, -len / 2, 0, w, len, w * 1.08, color);
    b.box(0, -len - endLen / 2, endLen > 0.1 ? 0.04 : 0, w * 0.95, endLen, w * (endLen > 0.1 ? 1.5 : 1), endColor);
    const m = new THREE.Mesh(b.build(), sharedMat);
    m.castShadow = true;
    pivot.add(m);
    body.add(pivot);
    return pivot;
  };
  const legL = limb(-0.12, 0.92, 0.8, 0.19, look.pants, look.shoes, 0.12);
  const legR = limb(0.12, 0.92, 0.8, 0.19, look.pants, look.shoes, 0.12);
  const armL = limb(-0.33, 1.5, 0.5, 0.14, look.sleeves ?? look.shirt, look.skin, 0.13);
  const armR = limb(0.33, 1.5, 0.5, 0.14, look.sleeves ?? look.shirt, look.skin, 0.13);

  const gun = new THREE.Mesh(weaponGeometry('pistol'), weaponMat);
  gun.position.set(0, -0.6, 0.05);
  gun.rotation.x = Math.PI / 2; // barrel along the forearm, grip toward the palm
  gun.visible = false;
  armR.add(gun);

  const s = look.scale || 1;
  root.scale.setScalar(s);
  return { root, body, torso, legL, legR, armL, armR, gun, weapon: null };
}

export function setCharacterWeapon(model, kind) {
  if (model.weapon === kind) return;
  model.weapon = kind;
  if (!kind || kind === 'fists') {
    model.gun.visible = false;
    return;
  }
  model.gun.geometry = weaponGeometry(kind);
  model.gun.visible = true;
}

/**
 * pose: 'idle' | 'walk' | 'aim' | 'ride' | 'swim' | 'cower'; speed in m/s; phase advances with distance.
 */
export function animateCharacter(m, pose, speed, phase, aimPitch = 0, punch = 0) {
  const swing = Math.min(1, speed / 6.5);
  const amp = 0.35 + swing * 0.55;
  const s = Math.sin(phase);
  m.body.position.y = 0;
  m.body.rotation.set(0, 0, 0);
  if (pose === 'ride') {
    m.legL.rotation.set(-1.25, 0, 0.15);
    m.legR.rotation.set(-1.25, 0, -0.15);
    m.armL.rotation.set(-1.1, 0, 0.1);
    m.armR.rotation.set(-1.1, 0, -0.1);
    return;
  }
  if (pose === 'swim') {
    m.body.rotation.x = 1.2;
    m.body.position.y = 0;
    m.legL.rotation.set(s * 0.5, 0, 0);
    m.legR.rotation.set(-s * 0.5, 0, 0);
    m.armL.rotation.set(-2.6 + Math.sin(phase * 0.5) * 1.2, 0, 0.2);
    m.armR.rotation.set(-2.6 - Math.sin(phase * 0.5) * 1.2, 0, -0.2);
    return;
  }
  if (pose === 'cower') {
    m.body.position.y = -0.35;
    m.legL.rotation.set(-1.4, 0, 0);
    m.legR.rotation.set(-1.4, 0, 0);
    m.armL.rotation.set(-2.6, 0, 0.5);
    m.armR.rotation.set(-2.6, 0, -0.5);
    return;
  }
  const moving = speed > 0.3;
  const legSwing = moving ? s * amp : 0;
  m.legL.rotation.set(legSwing, 0, 0);
  m.legR.rotation.set(-legSwing, 0, 0);
  m.body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.05 * (0.5 + swing) : 0;
  if (pose === 'aim') {
    m.armR.rotation.set(-Math.PI / 2 - aimPitch, 0, 0);
    m.armL.rotation.set(-Math.PI / 2 - aimPitch + 0.15, 0, -0.55);
  } else {
    const armSwing = moving ? -s * amp * 0.9 : Math.sin(phase * 0.2) * 0.03;
    m.armL.rotation.set(armSwing, 0, 0.06);
    m.armR.rotation.set(-armSwing - punch * 1.6, 0, -0.06);
    if (speed > 5) m.body.rotation.x = 0.12;
  }
}
