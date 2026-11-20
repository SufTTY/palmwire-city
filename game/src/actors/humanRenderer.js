// Draws every person in the city (player, pedestrians, police, gangs) with a handful of
// instanced meshes: one per body part, posed each frame (walk cycle, aim, punch, ride, dead).
import * as THREE from 'three';

const MAX = 160;
const PARTS = {
  torso: { size: [0.5, 0.62, 0.3], pivot: [0, 1.0, 0], off: [0, 0.31, 0] },
  head:  { size: [0.27, 0.3, 0.28], pivot: [0, 1.62, 0], off: [0, 0.16, 0] },
  hair:  { size: [0.29, 0.1, 0.31], pivot: [0, 1.62, 0], off: [0, 0.33, -0.01] },
  legL:  { size: [0.19, 0.95, 0.21], pivot: [-0.13, 1.0, 0], off: [0, -0.475, 0] },
  legR:  { size: [0.19, 0.95, 0.21], pivot: [0.13, 1.0, 0], off: [0, -0.475, 0] },
  armL:  { size: [0.14, 0.66, 0.16], pivot: [-0.33, 1.56, 0], off: [0, -0.31, 0] },
  armR:  { size: [0.14, 0.66, 0.16], pivot: [0.33, 1.56, 0], off: [0, -0.31, 0] },
  gun:   { size: [0.08, 0.14, 0.42], pivot: [0.33, 1.56, 0], off: [0, 0, 0] },
  cap:   { size: [0.3, 0.06, 0.38], pivot: [0, 1.62, 0], off: [0, 0.33, 0.05] },
};

const mRoot = new THREE.Matrix4(), mPart = new THREE.Matrix4(), mTmp = new THREE.Matrix4();
const col = new THREE.Color();

export class HumanRenderer {
  constructor(scene) {
    this.meshes = {};
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (const [name, p] of Object.entries(PARTS)) {
      const geo = new THREE.BoxGeometry(...p.size);
      geo.translate(...p.off);
      const m = new THREE.InstancedMesh(geo, name === 'gun' ? new THREE.MeshLambertMaterial({ color: 0x1d1f22 }) : mat, MAX);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      if (name !== 'gun') m.setColorAt(0, col.setHex(0xffffff));
      scene.add(m);
      this.meshes[name] = m;
    }
    this.n = 0;
    this.nGun = 0;
    this.nCap = 0;
  }

  begin() { this.n = 0; this.nGun = 0; this.nCap = 0; }

  part(name, index, angleX, angleZ = 0, color = null, extraY = 0) {
    const p = PARTS[name];
    mPart.makeTranslation(p.pivot[0], p.pivot[1] + extraY, p.pivot[2]);
    if (angleX) mPart.multiply(mTmp.makeRotationX(angleX));
    if (angleZ) mPart.multiply(mTmp.makeRotationZ(angleZ));
    mPart.premultiply(mRoot);
    const mesh = this.meshes[name];
    mesh.setMatrixAt(index, mPart);
    if (color !== null) mesh.setColorAt(index, col.setHex(color));
  }

  /** Adds one person. h: { pos, yaw, pose, phase, stride, look, aimPitch, gun, scale, lean } */
  draw(h) {
    if (this.n >= MAX) return;
    const i = this.n++;
    const L = h.look;
    const s = h.scale || 1;
    mRoot.makeTranslation(h.pos.x, h.pos.y, h.pos.z);
    mRoot.multiply(mTmp.makeRotationY(h.yaw));
    if (h.pose === 'dead') {
      mRoot.multiply(mTmp.makeTranslation(0, 0.16, 0));
      mRoot.multiply(mTmp.makeRotationX(-Math.PI / 2));
    } else if (h.pose === 'down') {
      mRoot.multiply(mTmp.makeRotationX(-Math.PI / 2 * Math.min(1, h.fall || 1)));
    } else if (h.lean) {
      mRoot.multiply(mTmp.makeRotationX(h.lean));
    }
    if (s !== 1) mRoot.multiply(mTmp.makeScale(s, s, s));

    const swing = Math.sin(h.phase || 0) * (h.stride || 0);
    let legL = swing, legR = -swing, armL = -swing * 0.8, armR = swing * 0.8, bodyY = 0;
    let armRz = 0, armLz = 0;
    const aiming = h.pose === 'aim' || h.pose === 'shoot';
    if (h.pose === 'ride') { legL = legR = -1.35; armL = armR = -1.1; bodyY = -0.35; }
    if (h.pose === 'sit') { legL = legR = -1.45; armL = armR = -0.9; bodyY = -0.5; }
    if (aiming) { armR = -Math.PI / 2 + (h.aimPitch || 0); if (h.twoHanded) { armL = armR; armLz = -0.45; } }
    if (h.pose === 'punch') { armR = -Math.PI / 2 * (h.punch || 1); }
    if (h.pose === 'hands') { armL = armR = -Math.PI; }
    if (h.pose === 'cower') { armL = armR = -2.4; armLz = -0.3; armRz = 0.3; bodyY = -0.3; legL = legR = -0.6; }
    if (h.pose === 'dead') { armL = -2.6; armR = -0.4; legL = 0.15; legR = -0.2; }

    this.part('torso', i, 0, 0, L.shirt, bodyY);
    this.part('head', i, 0, 0, L.skin, bodyY);
    this.part('hair', i, 0, 0, L.hair, bodyY);
    this.part('legL', i, legL, 0, L.pants, bodyY);
    this.part('legR', i, legR, 0, L.pants, bodyY);
    this.part('armL', i, armL, armLz, L.sleeve ?? L.shirt, bodyY);
    this.part('armR', i, armR, armRz, L.sleeve ?? L.shirt, bodyY);
    if (h.gun && (aiming || h.pose === 'idle' || h.pose === 'walk' || h.pose === 'run')) {
      const gi = this.nGun++;
      const p = PARTS.gun;
      mPart.makeTranslation(p.pivot[0], p.pivot[1] + bodyY, p.pivot[2]);
      mPart.multiply(mTmp.makeRotationX(armR));
      mPart.multiply(mTmp.makeTranslation(0, -0.6, 0));   // the hand, in arm space
      mPart.multiply(mTmp.makeRotationX(Math.PI / 2));     // barrel along the arm
      mPart.multiply(mTmp.makeTranslation(0, 0.05, 0.12));
      if (h.gunLong) mPart.multiply(mTmp.makeScale(1, 1, 1.9));
      mPart.premultiply(mRoot);
      this.meshes.gun.setMatrixAt(gi, mPart);
    }
    if (L.cap !== undefined && L.cap !== null) {
      const ci = this.nCap++;
      const p = PARTS.cap;
      mPart.makeTranslation(p.pivot[0], p.pivot[1] + bodyY, p.pivot[2]).premultiply(mRoot);
      this.meshes.cap.setMatrixAt(ci, mPart);
      this.meshes.cap.setColorAt(ci, col.setHex(L.cap));
    }
  }

  end() {
    for (const [name, m] of Object.entries(this.meshes)) {
      m.count = name === 'gun' ? this.nGun : name === 'cap' ? this.nCap : this.n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
