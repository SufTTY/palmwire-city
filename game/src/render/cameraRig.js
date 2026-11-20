// Third-person camera: mouse-look orbit on foot, over-the-shoulder aiming, a chase camera in
// vehicles that swings back behind the car, speed FOV, wall avoidance and screen shake.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/mathUtil.js';

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.yaw = Math.PI;
    this.pitch = 0.25;
    this.dist = 4.8;
    this.fov = 62;
    this.shakeAmt = 0;
    this.lastMouse = 0;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.aimPoint = new THREE.Vector3();
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.override = null;  // { pos, look } for cutscene / screenshot framing
    this.first = true;
  }

  shake(amount) { this.shakeAmt = Math.min(1.5, this.shakeAmt + amount); }

  /** World direction the player is looking along (for aiming and movement). */
  get lookYaw() { return this.yaw + Math.PI; }

  handleMouse(input, sens) {
    const k = 0.0022 * sens;
    if (input.mouseDX || input.mouseDY) this.lastMouse = 0;
    this.yaw -= input.mouseDX * k;
    const inv = this.game.settings.get('invertY') ? -1 : 1;
    this.pitch = clamp(this.pitch + input.mouseDY * k * inv, -0.55, 1.2);
  }

  update(dt) {
    const g = this.game, p = g.player, h = p.human, v = h.vehicle;
    this.lastMouse += dt;
    let dist, height, fov, side = 0;
    if (v) {
      this.target.set(v.pos.x, v.pos.y + 1.0 + v.type.hgt * 0.45, v.pos.z);
      const sp = v.speed;
      dist = 5.2 + v.type.len * 0.75 + Math.min(sp, 50) * 0.035;
      height = 0;
      fov = 64 + Math.min(sp, 60) * 0.22;
      if (this.lastMouse > 1.2 && sp > 2) {
        const moveYaw = Math.atan2(v.vel.x, v.vel.z);
        const behind = (v.forwardSpeed < -2 ? moveYaw : v.yaw) + Math.PI;
        this.yaw = dampAngle(this.yaw, behind, 2.5, dt);
        this.pitch = damp(this.pitch, 0.2, 2, dt);
      }
    } else {
      this.target.set(h.pos.x, h.pos.y + 1.55, h.pos.z);
      const aiming = p.aiming;
      dist = aiming ? 2.6 : 4.6;
      fov = aiming ? 50 : 62;
      side = aiming ? 0.75 : 0.35;
      height = 0;
    }
    if (this.first) { this.smoothTarget.copy(this.target); this.first = false; }
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, v ? 14 : 20, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 10, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, v ? 14 : 20, dt);
    this.dist = damp(this.dist, dist, 6, dt);
    this.fov = damp(this.fov, fov, 5, dt);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ox = Math.sin(this.yaw) * cp, oz = Math.cos(this.yaw) * cp;
    // shoulder offset to the right of the view
    const rx = -Math.cos(this.yaw) * side * -1, rz = Math.sin(this.yaw) * side * -1;
    const tx = this.smoothTarget.x + rx, ty = this.smoothTarget.y + height, tz = this.smoothTarget.z + rz;
    let d = this.dist;
    const horiz = Math.hypot(ox, oz);
    if (horiz > 0.01) {
      const hit = g.colliders.raycast(tx, tz, ox / horiz, oz / horiz, d * horiz + 0.6, ty + sp * d * 0.5, true);
      if (hit < d * horiz + 0.6) d = Math.max(1.2, (hit - 0.6) / horiz);
    }
    const cam = this.camera;
    if (this.override) {
      cam.position.copy(this.override.pos);
      cam.lookAt(this.override.look);
      if (this.override.fov) this.fov = this.override.fov;
    } else {
      cam.position.set(tx + ox * d, Math.max(0.4, ty + sp * d), tz + oz * d);
      cam.lookAt(tx, ty + (v ? 0.3 : 0.1), tz);
    }
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.rotation.z += (Math.random() - 0.5) * s * 0.05;
      this.shakeAmt *= Math.exp(-6 * dt);
    }
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // aim ray from the screen centre
    cam.getWorldDirection(this.aimDir);
    const res = g.combat.trace(cam.position, this.aimDir, 200, h, v);
    this.aimPoint.copy(cam.position).addScaledVector(this.aimDir, Math.max(res.dist, 3));
  }
}
