// World markers: glowing light columns with a ground ring and a floating icon for mission
// starts, the safehouse and the current objective; a bobbing arrow over moving targets.
import * as THREE from 'three';

function columnTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

const iconCache = new Map();
export function iconTexture(label, color) {
  const key = label + color;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + new THREE.Color(color).getHexString();
  g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff';
  g.font = '900 64px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(key, t);
  return t;
}

let colTex = null;

export class Marker {
  constructor(scene, color, label = null, radius = 1.6) {
    if (!colTex) colTex = columnTexture();
    this.scene = scene;
    this.group = new THREE.Group();
    this.columnMat = new THREE.MeshBasicMaterial({ map: colTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), this.columnMat);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.column, this.ring);
    this.icon = null;
    if (label) {
      this.icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(label, color), depthTest: false, transparent: true }));
      this.icon.scale.setScalar(1.6);
      this.icon.renderOrder = 10;
      this.group.add(this.icon);
    }
    this.setRadius(radius);
    scene.add(this.group);
  }

  setRadius(r) {
    this.radius = r;
    this.column.scale.set(r, 3.2, r);
    this.column.position.y = 1.6;
    this.ring.scale.setScalar(r);
    if (this.icon) this.icon.position.y = 4.2;
  }

  setColor(c) {
    this.columnMat.color.setHex(c);
    this.ring.material.color.setHex(c);
  }

  place(x, y, z) { this.group.position.set(x, y + 0.05, z); }
  set visible(v) { this.group.visible = v; }
  get visible() { return this.group.visible; }

  update(time) {
    const s = 1 + Math.sin(time * 3) * 0.04;
    this.ring.scale.setScalar(this.radius * s);
    this.columnMat.opacity = 0.75 + Math.sin(time * 2) * 0.15;
    if (this.icon) this.icon.position.y = 4.2 + Math.sin(time * 2) * 0.25;
  }

  dispose() { this.scene.remove(this.group); }
}

/** A downward chevron that hovers over a moving target (a car to steal, an enemy). */
export class TargetArrow {
  constructor(scene, color) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.7, 0.6); shape.lineTo(0, -0.5); shape.lineTo(0.7, 0.6); shape.lineTo(0, 0.2); shape.closePath();
    this.mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false, transparent: true }));
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  update(pos, camera, time, h = 3) {
    if (!pos) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.mesh.position.set(pos.x, pos.y + h + Math.sin(time * 4) * 0.25, pos.z);
    this.mesh.quaternion.copy(camera.quaternion);
  }
  setColor(c) { this.mesh.material.color.setHex(c); }
}
