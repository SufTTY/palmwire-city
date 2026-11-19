// PCPD Air-2: the helicopter that joins at four stars. It circles above the player's last
// known position, sweeps a searchlight cone and spot over them, and makes hiding harder.
import * as THREE from 'three';
import { MeshBuilder } from '../world/meshBuilder.js';
import { damp } from '../core/mathUtil.js';

function heliGeometry() {
  const b = new MeshBuilder();
  b.box(0, 0, 0.3, 2.2, 2.0, 4.2, 0x1f3d7a, { taperX: 0.8, taperZ: 0.85 });
  b.box(0, 0.2, 2.1, 1.9, 1.4, 1.2, 0x1c2733, { taperX: 0.8 });
  b.box(0, 0.4, -3.6, 0.5, 0.5, 4.5, 0xf2f2f2);
  b.box(0, 1.0, -5.6, 0.15, 1.6, 0.9, 0x1f3d7a);
  b.box(0, -0.9, 0.3, 2.6, 0.1, 0.12, 0x222222);
  for (const s of [-1, 1]) b.box(s * 1.1, -1.3, 0.3, 0.1, 0.1, 3.4, 0x222222);
  b.box(0, 1.15, 0.3, 0.6, 0.35, 0.8, 0x333333);
  return b.build();
}

export class PoliceHeli {
  constructor(G) {
    this.G = G;
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
    this.body = new THREE.Mesh(heliGeometry(), mat);
    this.body.castShadow = true;
    this.group.add(this.body);
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    this.rotor.position.y = 1.4;
    this.group.add(this.rotor);
    this.rotor2 = this.rotor.clone();
    this.rotor2.rotation.y = Math.PI / 2;
    this.rotor.add(this.rotor2);
    this.rotor2.position.set(0, 0, 0);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.2), this.rotor.material);
    this.tailRotor.position.set(0.25, 1.0, -5.8);
    this.group.add(this.tailRotor);
    // searchlight: a real spotlight plus a visible additive cone
    this.light = new THREE.SpotLight(0xf4f8ff, 0, 140, 0.16, 0.5, 1.2);
    this.light.position.set(0, -1, 1.5);
    this.group.add(this.light);
    this.target = new THREE.Object3D();
    G.scene.add(this.target);
    this.light.target = this.target;
    const coneGeo = new THREE.ConeGeometry(1, 1, 24, 1, true);
    coneGeo.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    G.scene.add(this.cone);
    this.spot = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24), new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.spot.rotation.x = -Math.PI / 2;
    G.scene.add(this.spot);
    this.pos = this.group.position;
    this.angle = 0;
    this.active = false;
    this.group.visible = false;
    this.cone.visible = false;
    this.spot.visible = false;
    G.scene.add(this.group);
    this.aim = new THREE.Vector3();
  }

  activate(from) {
    this.active = true;
    this.group.visible = true;
    this.cone.visible = true;
    this.spot.visible = true;
    this.pos.set(from.x + 120, 60, from.z + 120);
    this.aim.copy(from);
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
    this.cone.visible = false;
    this.spot.visible = false;
    this.light.intensity = 0;
  }

  update(dt) {
    if (!this.active) return;
    const G = this.G;
    const w = G.wanted;
    const goal = w.seen ? G.player.pos : w.lastSeen;
    this.angle += dt * 0.25;
    const tx = goal.x + Math.cos(this.angle) * 26, tz = goal.z + Math.sin(this.angle) * 26;
    this.pos.x = damp(this.pos.x, tx, 0.8, dt);
    this.pos.z = damp(this.pos.z, tz, 0.8, dt);
    this.pos.y = damp(this.pos.y, 42, 0.5, dt);
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z;
    this.group.rotation.y = Math.atan2(dx, dz);
    this.group.rotation.z = Math.sin(G.time * 0.7) * 0.05;
    this.group.rotation.x = 0.08;
    this.rotor.rotation.y += dt * 40;
    this.tailRotor.rotation.x += dt * 50;
    // the light wanders a little around the target
    const jitter = w.seen ? 1.5 : 9;
    this.aim.x = damp(this.aim.x, goal.x + Math.sin(G.time * 1.3) * jitter, 3, dt);
    this.aim.z = damp(this.aim.z, goal.z + Math.cos(G.time * 1.1) * jitter, 3, dt);
    this.aim.y = G.layout.groundHeight(this.aim.x, this.aim.z);
    this.target.position.copy(this.aim);
    this.target.updateMatrixWorld();
    this.light.intensity = 300 + 900 * G.sky.night;
    const src = this.pos.clone();
    src.y -= 1;
    const len = src.distanceTo(this.aim);
    this.cone.position.copy(src);
    this.cone.scale.set(len * 0.16, len, len * 0.16);
    this.cone.lookAt(this.aim);
    this.cone.rotateX(-Math.PI / 2);
    this.cone.material.opacity = 0.03 + 0.05 * G.sky.night;
    this.spot.position.set(this.aim.x, this.aim.y + 0.08, this.aim.z);
    this.spot.material.opacity = 0.06 + 0.12 * G.sky.night;
  }
}
