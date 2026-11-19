// Third-person camera: free mouse orbit on foot with an over-the-shoulder aim mode, a chase
// camera in vehicles that swings back behind the car when the mouse rests, speed-based FOV,
// recoil kick, screen shake, and pull-in when a building is between camera and player.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/mathUtil.js';

export class CameraRig {
  constructor(G, camera) {
    this.G = G;
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.22;
    this.dist = 5;
    this.idleMouse = 10;
    this.fov = 68;
    this.recoil = 0;
    this.target = new THREE.Vector3();
    this.override = null; // { pos, look } for scripted shots and cutscenes
  }

  kick(a) { this.recoil += a; }

  snapBehind() {
    const G = this.G;
    this.yaw = G.player.vehicle ? G.player.vehicle.heading : G.player.char.heading;
    this.pitch = G.player.vehicle ? 0.16 : 0.22;
  }

  update(dt, input) {
    const G = this.G;
    const cam = this.camera;
    const settings = G.settings;
    const sens = 0.0022 * (settings.sensitivity ?? 1);
    if (input && input.locked) {
      this.yaw -= input.mouseDX * sens;
      this.pitch += input.mouseDY * sens * (settings.invertY ? -1 : 1);
      if (Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 0) this.idleMouse = 0;
    }
    this.idleMouse += dt;
    if (this.recoil > 0) {
      const r = Math.min(this.recoil, dt * 0.6 + this.recoil * 0.5);
      this.pitch -= r;
      this.recoil -= r;
    }
    this.pitch = clamp(this.pitch, -0.55, 1.25);

    const pl = G.player;
    const v = pl.vehicle;
    let dist, height, shoulder = 0, fovT = 68;
    if (v) {
      const sp = v.absSpeed;
      // with the mouse at rest the camera swings back behind the car
      if (this.idleMouse > 1.0 && (sp > 3 || this.idleMouse > 3)) {
        this.yaw = dampAngle(this.yaw, v.heading, 2.6, dt);
        this.pitch = damp(this.pitch, 0.16, 2, dt);
      }
      dist = (v.T.bike ? 5.5 : 7.2 + v.T.len * 0.35) + sp * 0.04;
      height = v.T.hgt + 0.6;
      this.target.lerp(new THREE.Vector3(v.pos.x, v.pos.y + height, v.pos.z), 1 - Math.exp(-14 * dt));
      fovT = 68 + Math.min(18, sp * 0.3);
    } else {
      const aiming = pl.aiming;
      dist = aiming ? 3.7 : 4.6;
      shoulder = aiming ? 1.15 : 0.35;
      height = aiming ? 1.72 : 1.55;
      const p = pl.char.pos;
      this.target.lerp(new THREE.Vector3(p.x, p.y + height, p.z), 1 - Math.exp(-20 * dt));
      fovT = aiming ? 52 : 66;
      if (!pl.char.alive) dist = 7;
    }
    this.dist = damp(this.dist, dist, 6, dt);
    this.fov = damp(this.fov, fovT, 6, dt);

    const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw) * cp, fy = -sp2, fz = Math.cos(this.yaw) * cp;
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const pivot = this.target.clone();
    pivot.x += rx * shoulder;
    pivot.z += rz * shoulder;
    // keep the camera out of buildings
    let d = this.dist;
    const hit = G.colliders.raycast(pivot.x, pivot.y, pivot.z, -fx, -fy, -fz, d + 0.4);
    if (hit) d = Math.max(0.8, hit.t - 0.4);
    let px = pivot.x - fx * d, py = pivot.y - fy * d, pz = pivot.z - fz * d;
    const gh = G.layout.groundHeight(px, pz);
    if (py < gh + 0.4) py = gh + 0.4;

    if (this.override) {
      cam.position.copy(this.override.pos);
      cam.lookAt(this.override.look);
    } else {
      cam.position.set(px, py, pz);
      cam.lookAt(pivot.x + fx * 10, pivot.y + fy * 10, pivot.z + fz * 10);
    }
    const sh = G.fx ? G.fx.shakeAmount : 0;
    if (sh > 0.001) {
      cam.position.x += (Math.random() - 0.5) * sh * 0.5;
      cam.position.y += (Math.random() - 0.5) * sh * 0.5;
      cam.rotation.z += (Math.random() - 0.5) * sh * 0.03;
    }
    cam.fov = this.override && this.override.fov ? this.override.fov : this.fov;
    cam.updateProjectionMatrix();
  }
}
