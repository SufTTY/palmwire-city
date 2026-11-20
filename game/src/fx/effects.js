// Visual effects hub: particles, tracers and skid marks, plus muzzle-flash and explosion
// lights, shockwave rings and the player's headlight beams at dusk and night.
import * as THREE from 'three';
import { Particles } from './particles.js';
import { Tracers } from './tracers.js';
import { SkidMarks } from './skidMarks.js';
import { softDotTexture } from '../world/textures.js';

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.particles = new Particles(scene);
    this.tracers = new Tracers(scene);
    this.skids = new SkidMarks(scene);
    this.flash = new THREE.PointLight(0xffc070, 0, 14, 2);
    scene.add(this.flash);
    this.flashTime = 0;
    // a bright star-shaped flash sprite at the muzzle
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffe3a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flashSprite.scale.set(0.9, 0.9, 1);
    this.flashSprite.visible = false;
    this.flashSprite.renderOrder = 20;
    scene.add(this.flashSprite);
    this.boom = new THREE.PointLight(0xff8030, 0, 60, 2);
    scene.add(this.boom);
    this.boomTime = 0;
    const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, r: 1 });
    }
    // headlight beams for the player's car
    this.headlights = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xfff0d0, 0, 60, 0.5, 0.5, 1.2);
      scene.add(s); scene.add(s.target);
      this.headlights.push(s);
    }
  }

  muzzle(origin, dir, isPlayer) {
    this.particles.muzzle(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
    if (isPlayer || Math.random() < 0.5) {
      this.flash.position.set(origin.x + dir.x * 0.4, origin.y + dir.y * 0.4, origin.z + dir.z * 0.4);
      this.flash.intensity = 30;
      this.flashTime = 0.06;
    }
    if (isPlayer) {
      this.flashSprite.position.set(origin.x + dir.x * 0.25, origin.y + dir.y * 0.25, origin.z + dir.z * 0.25);
      this.flashSprite.material.rotation = Math.random() * Math.PI;
      const s = 0.7 + Math.random() * 0.5;
      this.flashSprite.scale.set(s, s, 1);
      this.flashSprite.visible = true;
    }
  }

  explosion(x, y, z, radius) {
    this.particles.explosion(x, y, z, radius);
    this.boom.position.set(x, y + 2, z);
    this.boom.intensity = 900;
    this.boomTime = 0.6;
    const ring = this.rings.find((r) => r.t <= 0) || this.rings[0];
    ring.t = 0.6; ring.r = radius * 2.2;
    ring.mesh.position.set(x, 0.3, z);
    ring.mesh.visible = true;
    if (this.game.audio) this.game.audio.sfx.explosion(x, z);
  }

  vehicleTrails(dt) {
    for (const v of this.game.vehicles.list) {
      if (v.destroyed || v.type.bike) continue;
      const d2 = (v.pos.x - this.game.camera.position.x) ** 2 + (v.pos.z - this.game.camera.position.z) ** 2;
      if (d2 > 160 * 160) continue;
      if (v.skidding && v.speed > 3) {
        const f = v.forward, r = v.right;
        const back = v.halfLen - v.type.wheelR - 0.4, side = v.type.wid / 2 - 0.2;
        for (const s of [-1, 1]) {
          const x = v.pos.x - f.x * back + r.x * side * s, z = v.pos.z - f.z * back + r.z * side * s;
          this.skids.mark(v.id * 2 + (s > 0 ? 1 : 0), x, z);
          if (Math.random() < dt * 22) this.particles.tyreSmoke(x, z);
        }
      }
    }
  }

  updateHeadlights(night) {
    const pv = this.game.player.human.vehicle;
    const on = pv && night > 0.15 && !pv.destroyed;
    this.headlights.forEach((s, i) => {
      s.intensity = on ? 60 * night : 0;
      if (!on) return;
      const f = pv.forward, r = pv.right, side = (i ? 1 : -1) * (pv.type.wid / 2 - 0.35);
      s.position.set(pv.pos.x + f.x * pv.halfLen + r.x * side, 0.8, pv.pos.z + f.z * pv.halfLen + r.z * side);
      s.target.position.set(pv.pos.x + f.x * 25 + r.x * side, 0, pv.pos.z + f.z * 25 + r.z * side);
    });
  }

  update(dt) {
    const g = this.game;
    this.particles.update(dt, g.camera, g.renderer.domElement.clientHeight || window.innerHeight);
    this.tracers.update(dt);
    this.vehicleTrails(dt);
    if (this.flashTime > 0) { this.flashTime -= dt; if (this.flashTime <= 0) { this.flash.intensity = 0; this.flashSprite.visible = false; } }
    if (this.boomTime > 0) { this.boomTime -= dt; this.boom.intensity = Math.max(0, this.boomTime / 0.6) * 900; }
    for (const r of this.rings) {
      if (r.t <= 0) continue;
      r.t -= dt;
      const k = 1 - r.t / 0.6;
      const s = 1 + k * r.r;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = (1 - k) * 0.7;
      if (r.t <= 0) r.mesh.visible = false;
    }
    this.updateHeadlights(g.day.night);
  }
}
