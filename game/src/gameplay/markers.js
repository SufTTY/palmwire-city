// 3D world markers: glowing cylinders for mission spots, floating chevrons over targets,
// and race checkpoint rings, all drawn from small pooled meshes.
import * as THREE from 'three';

const COLORS = { mission: 0xffc83d, objective: 0x3de0ff, enemy: 0xff4060, race: 0xff5fd2, job: 0x6dff8a, save: 0x7fb2ff, garage: 0xffa040 };

function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying float vY; void main(){ float a = (1.0 - smoothstep(0.0, 1.0, vY)) * (0.55 + 0.25*sin(uTime*3.0 + vY*8.0)); gl_FragColor = vec4(uColor*a, 1.0);} ',
  });
}

export class Markers {
  constructor(game) {
    this.game = game;
    this.items = new Map();
    this.nextId = 1;
    this.cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
    this.cylGeo.translate(0, 0.5, 0);
    this.ringGeo = new THREE.TorusGeometry(1, 0.08, 6, 40);
    this.arrowGeo = new THREE.ConeGeometry(0.45, 0.9, 4);
    this.arrowGeo.rotateX(Math.PI);
    this.time = 0;
  }

  /** kind: 'cylinder' | 'ring' | 'arrow'; returns an id. opts: { color, radius, height, follow } */
  add(kind, x, z, opts = {}) {
    const id = this.nextId++;
    const color = COLORS[opts.color] ?? opts.color ?? COLORS.mission;
    let obj;
    if (kind === 'cylinder') {
      obj = new THREE.Mesh(this.cylGeo, beamMaterial(color));
      const r = opts.radius ?? 2;
      obj.scale.set(r, opts.height ?? 3, r);
    } else if (kind === 'ring') {
      obj = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, toneMapped: false }));
      const r = opts.radius ?? 6;
      obj.scale.set(r, r, r);
    } else {
      obj = new THREE.Mesh(this.arrowGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    }
    obj.renderOrder = 4;
    obj.position.set(x, kind === 'ring' ? (opts.radius ?? 6) * 0.9 : 0.05, z);
    this.game.scene.add(obj);
    this.items.set(id, { kind, obj, x, z, follow: opts.follow || null, yOff: opts.yOff ?? 2.6, color });
    return id;
  }

  move(id, x, z) { const m = this.items.get(id); if (m) { m.x = x; m.z = z; } }

  remove(id) {
    const m = this.items.get(id);
    if (!m) return;
    this.game.scene.remove(m.obj);
    if (m.obj.material) m.obj.material.dispose();
    this.items.delete(id);
  }

  clear() { for (const id of [...this.items.keys()]) this.remove(id); }

  update(dt) {
    this.time += dt;
    for (const m of this.items.values()) {
      if (m.follow) {
        const p = m.follow.pos || m.follow;
        m.x = p.x; m.z = p.z;
      }
      if (m.kind === 'cylinder') {
        m.obj.position.set(m.x, 0.05, m.z);
        m.obj.material.uniforms.uTime.value = this.time;
      } else if (m.kind === 'ring') {
        m.obj.position.x = m.x; m.obj.position.z = m.z;
        m.obj.lookAt(this.game.camera.position.x, m.obj.position.y, this.game.camera.position.z);
      } else {
        const base = m.follow && m.follow.type ? m.follow.type.hgt + 1.2 : m.yOff;
        m.obj.position.set(m.x, base + Math.sin(this.time * 4) * 0.25, m.z);
        m.obj.rotation.y += dt * 2.5;
      }
    }
  }
}
