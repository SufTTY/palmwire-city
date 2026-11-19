// Every texture in the game is painted here on a canvas at load time: asphalt with lane
// markings, sidewalks, grass and sand, building facades (with matching night-window maps),
// roofs, wood, and the billboard atlas of Palmwire's own (fictional) brands.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

const rng = makeRng(90210);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Sprinkle per-pixel brightness noise over a canvas. */
function speckle(ctx, w, h, amount, count) {
  for (let n = 0; n < count; n++) {
    const v = rng() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${rng() * amount})`;
    const s = 1 + Math.floor(rng() * 2);
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), s, s);
  }
}

function asphaltBase(ctx, w, h) {
  ctx.fillStyle = '#3a3c40';
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 0.07, w * h * 0.2);
  // tar patches
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(20,20,24,${0.12 + rng() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h, 6 + rng() * 20, 4 + rng() * 10, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Road segment: 12 m across (u) by 24 m along (v); double yellow centre, white edge lines. */
function roadTexture() {
  const w = 192, h = 384;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  asphaltBase(ctx, w, h);
  const px = w / 12;
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(0.45 * px, 0, 0.18 * px, h);
  ctx.fillRect(w - 0.63 * px, 0, 0.18 * px, h);
  ctx.fillStyle = '#e8b62c';
  ctx.fillRect(w / 2 - 0.32 * px, 0, 0.16 * px, h);
  ctx.fillRect(w / 2 + 0.16 * px, 0, 0.16 * px, h);
  // worn tyre tracks
  ctx.fillStyle = 'rgba(15,15,18,0.16)';
  for (const lane of [3, 9]) {
    ctx.fillRect((lane - 1.0) * px, 0, 0.5 * px, h);
    ctx.fillRect((lane + 0.5) * px, 0, 0.5 * px, h);
  }
  return toTexture(c);
}

/** Intersection square with zebra crossings on all four sides. */
function intersectionTexture() {
  const s = 256;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  asphaltBase(ctx, s, s);
  const px = s / 12;
  ctx.fillStyle = '#ebe7dc';
  const stripe = (x, y, ww, hh) => ctx.fillRect(x, y, ww, hh);
  for (let k = 0; k < 6; k++) {
    const o = (1.1 + k * 1.7) * px;
    stripe(o, 0.2 * px, 0.8 * px, 1.6 * px);
    stripe(o, s - 1.8 * px, 0.8 * px, 1.6 * px);
    stripe(0.2 * px, o, 1.6 * px, 0.8 * px);
    stripe(s - 1.8 * px, o, 1.6 * px, 0.8 * px);
  }
  return toTexture(c);
}

function sidewalkTexture() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9c2b4';
  ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, s, 0.12, 3000);
  ctx.strokeStyle = 'rgba(80,70,60,0.35)';
  ctx.lineWidth = 2;
  for (let k = 0; k <= 4; k++) {
    ctx.beginPath(); ctx.moveTo(k * 32, 0); ctx.lineTo(k * 32, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * 32); ctx.lineTo(s, k * 32); ctx.stroke();
  }
  return toTexture(c);
}

function grassTexture() {
  const s = 256;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6c9a3e';
  ctx.fillRect(0, 0, s, s);
  for (let n = 0; n < 9000; n++) {
    const g = 110 + Math.floor(rng() * 70);
    ctx.fillStyle = `rgba(${60 + Math.floor(rng() * 40)},${g},${40 + Math.floor(rng() * 20)},0.6)`;
    ctx.fillRect(rng() * s, rng() * s, 1, 2 + rng() * 3);
  }
  return toTexture(c);
}

function sandTexture() {
  const s = 256;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8d3a6';
  ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, s, 0.12, 14000);
  ctx.strokeStyle = 'rgba(170,140,95,0.18)';
  for (let k = 0; k < 18; k++) {
    ctx.beginPath();
    const y = rng() * s;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(s * 0.3, y + 8, s * 0.6, y - 8, s, y);
    ctx.stroke();
  }
  return toTexture(c);
}

function plazaTexture() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const warm = (x + y) % 2 === 0;
    const v = Math.floor(rng() * 14);
    ctx.fillStyle = warm ? `rgb(${214 - v},${182 - v},${150 - v})` : `rgb(${236 - v},${226 - v},${206 - v})`;
    ctx.fillRect(x * 16, y * 16, 16, 16);
  }
  speckle(ctx, s, s, 0.08, 1500);
  return toTexture(c);
}

function concreteTexture() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a19d96';
  ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, s, 0.15, 5000);
  ctx.strokeStyle = 'rgba(40,40,40,0.25)';
  ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(s, 64); ctx.moveTo(64, 0); ctx.lineTo(64, s); ctx.stroke();
  return toTexture(c);
}

function parkingTexture() {
  const s = 256;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  asphaltBase(ctx, s, s);
  ctx.fillStyle = '#e4e0d4';
  for (let k = 0; k < 8; k++) {
    ctx.fillRect(k * 32, 0, 3, 90);
    ctx.fillRect(k * 32, s - 90, 3, 90);
  }
  return toTexture(c);
}

function woodTexture() {
  const w = 128, h = 128;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  for (let k = 0; k < 8; k++) {
    const v = Math.floor(rng() * 25);
    ctx.fillStyle = `rgb(${150 - v},${110 - v},${74 - v})`;
    ctx.fillRect(0, k * 16, w, 15);
    ctx.fillStyle = 'rgba(40,25,10,0.5)';
    ctx.fillRect(0, k * 16 + 15, w, 1);
  }
  speckle(ctx, w, h, 0.1, 1500);
  return toTexture(c);
}

function roofTexture() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8b2a8';
  ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, s, 0.25, 7000);
  return toTexture(c);
}

// ---- Facades: 512 px = 8 bays x 8 floors = 28 m square of wall. -------------------------------
const FACADE_CELL = 64;

function windowGlass(ctx, x, y, w, h, tint = [64, 96, 122]) {
  // sky reflection at the top fading into the room behind the glass
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, `rgb(${tint[0] + 110},${tint[1] + 105},${tint[2] + 100})`);
  g.addColorStop(0.4, `rgb(${tint[0] + 20},${tint[1] + 24},${tint[2] + 28})`);
  g.addColorStop(1, `rgb(${tint[0] - 20},${tint[1] - 26},${tint[2] - 26})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function facadePair(kind) {
  const s = 512;
  const base = canvas(s, s);
  const glow = canvas(s, s);
  const b = base.getContext('2d');
  const e = glow.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, s, s);
  const litColor = () => {
    const r = rng();
    if (r < 0.62) return null;
    if (r < 0.85) return `rgb(255,${200 + Math.floor(rng() * 40)},${120 + Math.floor(rng() * 60)})`;
    if (r < 0.95) return 'rgb(220,235,255)';
    return 'rgb(255,150,210)';
  };
  if (kind === 'glass') {
    b.fillStyle = '#1e2a33';
    b.fillRect(0, 0, s, s);
    for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
      const x = fx * FACADE_CELL, y = fy * FACADE_CELL;
      const k = Math.floor(rng() * 18);
      windowGlass(b, x + 2, y + 6, FACADE_CELL - 4, FACADE_CELL - 8, [40 + k, 82 + k, 108 + k]);
      const c = litColor();
      if (c) { e.fillStyle = c; e.fillRect(x + 4, y + 8, FACADE_CELL - 8, FACADE_CELL - 12); }
    }
  } else if (kind === 'warehouse') {
    for (let x = 0; x < s; x += 8) {
      b.fillStyle = (x / 8) % 2 ? '#d7d4cc' : '#bdb9b0';
      b.fillRect(x, 0, 8, s);
    }
    speckle(b, s, s, 0.12, 9000);
    for (let fx = 0; fx < 8; fx++) {
      windowGlass(b, fx * 64 + 10, 10, 44, 18);
      if (rng() < 0.4) { e.fillStyle = 'rgb(255,220,160)'; e.fillRect(fx * 64 + 10, 10, 44, 18); }
    }
    b.fillStyle = 'rgba(90,60,40,0.25)';
    b.fillRect(0, s - 30, s, 30);
  } else {
    b.fillStyle = kind === 'house' ? '#f6f1e8' : '#f1ebe1';
    b.fillRect(0, 0, s, s);
    speckle(b, s, s, 0.08, 12000);
    if (kind === 'house') {
      b.strokeStyle = 'rgba(120,110,100,0.25)';
      for (let y = 0; y < s; y += 8) { b.beginPath(); b.moveTo(0, y); b.lineTo(s, y); b.stroke(); }
    }
    for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
      const x = fx * FACADE_CELL, y = fy * FACADE_CELL;
      if (kind === 'house' && fx % 2 === 1) continue;
      if (kind === 'hotel') {
        windowGlass(b, x + 6, y + 8, 52, 40);
        b.fillStyle = 'rgba(0,0,0,0.25)';
        b.fillRect(x, y + 48, 64, 4);
        b.fillStyle = '#fbfbf7';
        b.fillRect(x, y + 50, 64, 12);
        b.fillStyle = 'rgba(80,90,100,0.6)';
        for (let k = 0; k < 64; k += 6) b.fillRect(x + k, y + 51, 2, 10);
        const c = litColor();
        if (c) { e.fillStyle = c; e.fillRect(x + 8, y + 10, 48, 36); }
      } else {
        const wx = x + 14, wy = y + 12, ww = 36, wh = 38;
        b.fillStyle = 'rgba(0,0,0,0.18)';
        b.fillRect(wx - 2, wy - 2, ww + 4, wh + 6);
        windowGlass(b, wx, wy, ww, wh);
        b.fillStyle = '#fffaf0';
        b.fillRect(wx - 3, wy + wh, ww + 6, 4);
        b.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (rng() < 0.3) {
          b.fillStyle = rng() < 0.5 ? '#3f7d78' : '#c9705a';
          b.fillRect(wx - 9, wy, 7, wh);
          b.fillRect(wx + ww + 2, wy, 7, wh);
        }
        const c = litColor();
        if (c) { e.fillStyle = c; e.fillRect(wx, wy, ww, wh); }
      }
    }
  }
  return { map: toTexture(base), emissive: toTexture(glow) };
}

// ---- Billboards: a 2x2 atlas of original Palmwire brands. --------------------------------------
function billboardAtlas() {
  const W = 1024, H = 512;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const panel = (px, py, draw) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath(); ctx.rect(0, 0, 512, 256); ctx.clip();
    draw(ctx);
    ctx.restore();
  };
  const bold = (size) => `900 ${size}px Impact, "Arial Black", sans-serif`;
  panel(0, 0, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#ff7a2f'); grd.addColorStop(1, '#ffd23a');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff3c4';
    g.beginPath(); g.arc(410, 150, 80, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 6; k++) { g.fillStyle = '#ff7a2f'; g.fillRect(320, 150 + k * 14, 200, 5); }
    g.fillStyle = '#5a1d0b'; g.font = bold(70); g.fillText('SUNBURST', 24, 95);
    g.font = bold(40); g.fillStyle = '#fff'; g.fillText('SODA', 28, 145);
    g.font = '600 24px Arial, sans-serif'; g.fillStyle = '#5a1d0b'; g.fillText('tastes like five o\'clock', 28, 210);
  });
  panel(512, 0, (g) => {
    g.fillStyle = '#0f8a8d'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#ffe9d6';
    g.beginPath(); g.moveTo(400, 40); g.lineTo(470, 120); g.lineTo(400, 200); g.lineTo(330, 120); g.closePath(); g.fill();
    g.strokeStyle = '#ffe9d6'; g.lineWidth = 3; g.beginPath(); g.moveTo(400, 200); g.bezierCurveTo(380, 230, 430, 240, 400, 256); g.stroke();
    g.fillStyle = '#fff'; g.font = bold(76); g.fillText('KITE', 30, 110);
    g.font = bold(44); g.fillText('MOBILE', 34, 160);
    g.font = '600 24px Arial, sans-serif'; g.fillStyle = '#c9fff7'; g.fillText('Unlimited sky. $29/mo', 34, 212);
  });
  panel(0, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 512, 0);
    grd.addColorStop(0, '#ff3d8b'); grd.addColorStop(1, '#ff9a6b');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#25112b';
    g.beginPath(); g.moveTo(250, 200); g.lineTo(280, 160); g.lineTo(380, 150); g.lineTo(430, 170); g.lineTo(480, 175); g.lineTo(490, 200); g.closePath(); g.fill();
    g.beginPath(); g.arc(300, 202, 16, 0, 7); g.arc(450, 202, 16, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = bold(54); g.fillText('MANGO MILE', 24, 80);
    g.font = bold(38); g.fillText('MOTORS', 26, 124);
    g.font = '600 22px Arial, sans-serif'; g.fillText('0% down on every Vireo GT', 26, 240);
  });
  panel(512, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1b0b3a'); grd.addColorStop(0.6, '#6b1b7a'); grd.addColorStop(1, '#ff6a9a');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(380, 170, 70, Math.PI, 0); g.fill();
    g.strokeStyle = '#ff4fd8'; g.lineWidth = 2;
    for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(0, 180 + k * 10); g.lineTo(512, 180 + k * 10); g.stroke(); }
    g.fillStyle = '#5ef2ff'; g.font = bold(80); g.fillText('WAVE', 28, 100);
    g.fillStyle = '#fff'; g.font = bold(46); g.fillText('88.1 FM', 30, 150);
    g.font = '600 22px Arial, sans-serif'; g.fillText('Palmwire\'s night drive', 30, 236);
  });
  return toTexture(c, { repeat: false });
}

/** Builds all textures once; returns a dictionary every builder reads from. */
export function createTextures() {
  const facades = {};
  for (const k of ['stucco', 'glass', 'hotel', 'house', 'warehouse']) facades[k] = facadePair(k);
  return {
    road: roadTexture(),
    intersection: intersectionTexture(),
    sidewalk: sidewalkTexture(),
    grass: grassTexture(),
    sand: sandTexture(),
    plaza: plazaTexture(),
    concrete: concreteTexture(),
    parking: parkingTexture(),
    wood: woodTexture(),
    roof: roofTexture(),
    billboards: billboardAtlas(),
    facades,
  };
}
