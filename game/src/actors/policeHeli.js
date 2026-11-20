// The PCPD air unit "Osprey 1": a helicopter that circles the suspect at four stars and up,
// sweeping a searchlight with a visible beam over the street.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { damp } from '../core/mathUtil.js';

export class PoliceHeli {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    const gb = new GeometryBuilder();
    const navy = 0x16213e, white = 0xf2f2f2;
    gb.hexa([[-1.1, 0, -1.6], [1.1, 0, -1.6], [1.0, 0.2, 2.2], [-1.0, 0.2, 2.2], [-1.0, 2.1, -1.4], [1.0, 2.1, -1.4], [0.8, 1.7, 1.6], [-0.8, 1.7, 1.6]], navy, { bottom: true });
    gb.box(-1.12, 0.5, -1.0, 1.12, 1.0, 1.4, white);
    gb.hexa([[-0.3, 1.0, -6.5], [0.3, 1.0, -6.5], [0.45, 0.8, -1.5], [-0.45, 0.8, -1.5], [-0.2, 1.4, -6.5], [0.2, 1.4, -6.5], [0.4, 1.8, -1.5], [-0.4, 1.8, -1.5]], navy);
    gb.box(-0.08, 1.2, -6.9, 0.08, 3.0, -6.1, navy);
    gb.box(-0.9, -0.5, -1.2, -0.8, 0, 1.4, 0x333333);
    gb.box(0.8, -0.5, -1.2, 0.9, 0, 1.4, 0x333333);
    gb.box(-0.15, 2.1, -0.15, 0.15, 2.5, 0.15, 0x333333);
    const glass = new GeometryBuilder();
    glass.hexa([[-0.95, 0.9, 1.4], [0.95, 0.9, 1.4], [0.9, 0.5, 2.25], [-0.9, 0.5, 2.25], [-0.85, 1.85, 0.6], [0.85, 1.85, 0.6], [0.7, 1.55, 1.7], [-0.7, 1.55, 1.7]], 0x1a2a3a);
    const body = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 }));
    body.castShadow = true;
    this.root.add(body, new THREE.Mesh(glass.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.6 })));
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222, transparent: true, opacity: 0.75 }));
    this.rotor.position.y = 2.55;
    this.rotor2 = this.rotor.clone(); this.rotor2.rotation.y = Math.PI / 2;
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.2), this.rotor.material);
    this.tailRotor.position.set(0.15, 2.2, -6.6);
    this.root.add(this.rotor, this.rotor2, this.tailRotor);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    this.beacon.position.set(0, 0.0, -1.2);
    this.root.add(this.beacon);

    this.spot = new THREE.SpotLight(0xf4f8ff, 0, 140, 0.16, 0.45, 1.0);
    this.spot.position.set(0, -0.3, 1.6);
    this.root.add(this.spot);
    game.scene.add(this.spot.target);
    // visible beam: open cone with additive gradient
    const coneGeo = new THREE.ConeGeometry(1, 1, 24, 1, true);
    coneGeo.translate(0, -0.5, 0);
    coneGeo.rotateX(-Math.PI / 2);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uStrength: { value: 0.35 } },
      vertexShader: 'varying float vT; void main(){ vT = position.z; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'uniform float uStrength; varying float vT; void main(){ gl_FragColor = vec4(vec3(0.85,0.92,1.0)*uStrength*(1.0-vT*0.85), 1.0);} ',
    });
    this.beam = new THREE.Mesh(coneGeo, beamMat);
    game.scene.add(this.beam);
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    game.scene.add(this.pool);
    this.root.visible = false; this.beam.visible = false; this.pool.visible = false;
    game.scene.add(this.root);
    this.active = false;
    this.angle = 0;
    this.pos = new THREE.Vector3();
    this.spotTarget = new THREE.Vector3();
    this.t = 0;
    this.callsign = 'OSPREY 1';
  }

  activate(on, from) {
    if (on === this.active) return;
    this.active = on;
    this.root.visible = on; this.beam.visible = on; this.pool.visible = on;
    this.spot.intensity = on ? 700 : 0;
    if (on) {
      const f = from || this.game.player.focus;
      this.pos.set(f.x - 120, 60, f.z - 120);
      this.spotTarget.copy(f);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const g = this.game;
    const target = g.wanted.seen ? g.player.focus : new THREE.Vector3(g.wanted.lkp.x, 0, g.wanted.lkp.z);
    this.angle += dt * 0.25;
    const want = new THREE.Vector3(target.x + Math.cos(this.angle) * 30, 38 + Math.sin(this.t * 0.7) * 2, target.z + Math.sin(this.angle) * 30);
    this.pos.x = damp(this.pos.x, want.x, 0.9, dt);
    this.pos.y = damp(this.pos.y, want.y, 0.9, dt);
    this.pos.z = damp(this.pos.z, want.z, 0.9, dt);
    this.root.position.copy(this.pos);
    const toT = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    this.root.rotation.y = toT;
    this.root.rotation.x = 0.12;
    this.rotor.rotation.y += dt * 40; this.rotor2.rotation.y += dt * 40;
    this.tailRotor.rotation.x += dt * 60;
    this.beacon.visible = Math.floor(this.t * 2) % 2 === 0;
    // searchlight wobbles around the target while searching
    const wob = g.wanted.seen ? 1.5 : 9;
    const st = new THREE.Vector3(target.x + Math.sin(this.t * 1.3) * wob, 0, target.z + Math.cos(this.t * 0.9) * wob);
    this.spotTarget.lerp(st, Math.min(1, dt * 3));
    this.spot.target.position.copy(this.spotTarget);
    const from = new THREE.Vector3(0, -0.3, 1.6).applyMatrix4(this.root.matrixWorld);
    const len = from.distanceTo(this.spotTarget);
    const radius = Math.tan(0.16) * len + 0.5;
    this.beam.position.copy(from);
    this.beam.lookAt(this.spotTarget);
    this.beam.scale.set(radius, radius, len);
    this.pool.position.set(this.spotTarget.x, 0.08, this.spotTarget.z);
    this.pool.scale.set(radius * 1.05, 1, radius * 1.05);
    const night = g.day.night;
    this.beam.material.uniforms.uStrength.value = 0.16 + night * 0.3;
    this.pool.material.opacity = 0.06 + night * 0.4;
    this.spot.intensity = 250 + night * 900;
  }

  sees(x, z) {
    return this.active && Math.hypot(this.spotTarget.x - x, this.spotTarget.z - z) < 30;
  }
}
