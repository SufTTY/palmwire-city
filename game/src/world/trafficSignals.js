// Traffic signals at every junction of three or more roads: a fixed cycle per junction (offset
// so the city does not pulse in sync), queried by traffic AI, drawn as instanced poles whose
// lamp moves between the red, amber and green slots.
import * as THREE from 'three';
import { HALF_ROAD, CURB_Y } from './cityLayout.js';
import { MeshBuilder } from './meshBuilder.js';
import { hash2 } from '../core/rng.js';

const CYCLE = 22;

function signalPoleGeometry() {
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 0.09, 0.08, 5.6, 6, 0x3b4148);
  b.box(0, 4.75, 0.05, 0.42, 1.35, 0.3, 0x22262b);
  b.box(0, 5.48, 0.05, 0.5, 0.06, 0.38, 0x22262b);
  return b.build();
}

export class TrafficSignals {
  constructor(scene, layout, colliders) {
    this.layout = layout;
    this.offsets = new Map();
    const poles = [];
    for (const n of layout.nodeList) {
      if (n.links.length < 3 || n.bridge) continue;
      this.offsets.set(n.id, hash2(n.i, n.j, 5) * CYCLE);
      for (const l of n.links) {
        // the approach arriving at n travels opposite to the outgoing link
        const dx = -l.dx, dz = -l.dz;
        const rx = -dz, rz = dx;
        const x = n.x - dx * (HALF_ROAD + 0.7) + rx * (HALF_ROAD + 0.7);
        const z = n.z - dz * (HALF_ROAD + 0.7) + rz * (HALF_ROAD + 0.7);
        poles.push({ node: n.id, axis: dx !== 0 ? 'h' : 'v', x, z, rot: Math.atan2(-dx, -dz) });
      }
    }
    this.poles = poles;
    const geo = signalPoleGeometry();
    const poleMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), poles.length);
    const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), poles.length);
    const d = new THREE.Object3D();
    poles.forEach((p, k) => {
      d.position.set(p.x, CURB_Y, p.z);
      d.rotation.set(0, p.rot, 0);
      d.updateMatrix();
      poleMesh.setMatrixAt(k, d.matrix);
      colliders.addCircle(p.x, p.z, 0.2, 6);
    });
    poleMesh.castShadow = true;
    scene.add(poleMesh);
    scene.add(lampMesh);
    this.lampMesh = lampMesh;
    this.dummy = d;
    this.lastStates = new Array(poles.length).fill('');
    this.colors = { green: new THREE.Color(0x3dff7a), amber: new THREE.Color(0xffb020), red: new THREE.Color(0xff2a2a) };
    this.time = 0;
    this.refresh(true);
  }

  /** 'green' | 'amber' | 'red' for traffic travelling along axis ('h' or 'v') into node. */
  state(nodeId, axis, time = this.time) {
    const off = this.offsets.get(nodeId);
    if (off === undefined) return 'green';
    const t = (time + off) % CYCLE;
    if (axis === 'h') return t < 8 ? 'green' : t < 10 ? 'amber' : 'red';
    if (t >= 11 && t < 19) return 'green';
    if (t >= 19 && t < 21) return 'amber';
    return 'red';
  }

  isSignalized(nodeId) { return this.offsets.has(nodeId); }

  update(time) {
    this.time = time;
    this.refresh(false);
  }

  refresh(force) {
    const d = this.dummy;
    let changed = false;
    this.poles.forEach((p, k) => {
      const s = this.state(p.node, p.axis);
      if (!force && this.lastStates[k] === s) return;
      this.lastStates[k] = s;
      changed = true;
      const slot = s === 'red' ? 5.15 : s === 'amber' ? 4.75 : 4.35;
      const fx = Math.sin(p.rot) * 0.22, fz = Math.cos(p.rot) * 0.22;
      d.position.set(p.x + fx, CURB_Y + slot, p.z + fz);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.lampMesh.setMatrixAt(k, d.matrix);
      this.lampMesh.setColorAt(k, this.colors[s]);
    });
    if (changed) {
      this.lampMesh.instanceMatrix.needsUpdate = true;
      if (this.lampMesh.instanceColor) this.lampMesh.instanceColor.needsUpdate = true;
    }
  }
}
