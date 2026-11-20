// Every texture in the game is painted here on a canvas at load time: building facades,
// asphalt, sand, billboards, signs, palm fronds and soft sprites.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = true, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function speckle(ctx, w, h, n, colors, rng, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(rng.float() * w, rng.float() * h, size * rng.float() + 0.5, size * rng.float() + 0.5);
  }
}

/**
 * Facade atlas: 4 window bays x 4 floors per tile (16 m x 14 m in world space). The top-left
 * pixel band is plain wall so roofs can sample it. Returns { map, emissive }.
 */
export function facadeTextures(style) {
  return cached('facade-' + style, () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    const [e, ge] = canvas(S, S);
    const rng = new Rng(style.length * 131 + 7);
    const wall = { glass: '#d9dde0', concrete: '#f2eee6', stucco: '#fbf7f0', hotel: '#ffffff', warehouse: '#cfcac2', house: '#ffffff' }[style] || '#eee';
    g.fillStyle = wall; g.fillRect(0, 0, S, S);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    speckle(g, S, S, 900, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'], rng);
    const cell = S / 4;
    for (let fx = 0; fx < 4; fx++) {
      for (let fy = 0; fy < 4; fy++) {
        const x = fx * cell, y = fy * cell;
        if (style === 'warehouse') {
          // corrugated panels and a high strip window
          for (let k = 0; k < cell; k += 6) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x + k, y, 2, cell); }
          if (fy === 0) { g.fillStyle = '#6c7b84'; g.fillRect(x + 6, y + 10, cell - 12, 12); }
          continue;
        }
        let wx = x + 8, wy = y + 12, ww = cell - 16, wh = cell - 24;
        if (style === 'glass') { wx = x + 3; wy = y + 6; ww = cell - 6; wh = cell - 12; }
        if (style === 'house') { wx = x + 18; wy = y + 16; ww = cell - 36; wh = cell - 30; }
        const grad = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        if (style === 'glass') { grad.addColorStop(0, '#3e6f8f'); grad.addColorStop(0.55, '#7fb2cc'); grad.addColorStop(1, '#2d5470'); }
        else { grad.addColorStop(0, '#2d4a5e'); grad.addColorStop(0.6, '#5d8aa3'); grad.addColorStop(1, '#2a3f50'); }
        g.fillStyle = grad; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(wx + 2, wy + 2, ww * 0.3, 3);
        if (style !== 'glass') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 2, wy + wh, ww + 4, 4); }
        if (style === 'hotel') { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x + 4, y + cell - 14, cell - 8, 3); g.fillRect(x + 4, y + cell - 22, 2, 9); g.fillRect(x + cell - 6, y + cell - 22, 2, 9); }
        if (rng.chance(0.35)) {
          ge.fillStyle = rng.pick(['#ffd28a', '#ffe7b0', '#fff2d0', '#bfe0ff']);
          ge.fillRect(wx, wy, ww, wh);
        }
      }
    }
    // keep the top-left corner as plain wall for roofs
    g.fillStyle = wall; g.fillRect(0, 0, 6, 6);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 6, 6);
    return { map: toTexture(c), emissive: toTexture(e) };
  });
}

export function asphaltTexture() {
  return cached('asphalt', () => {
    const [c, g] = canvas(256, 256);
    const rng = new Rng(42);
    g.fillStyle = '#4a4b4f'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 5000, ['#3c3d41', '#57585c', '#46474b', '#5e5f62'], rng, 2);
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = 'rgba(20,20,22,0.35)'; g.lineWidth = 1;
      g.beginPath(); let x = rng.float() * 256, y = rng.float() * 256; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += rng.range(-20, 20); y += rng.range(-20, 20); g.lineTo(x, y); }
      g.stroke();
    }
    return toTexture(c);
  });
}

export function sidewalkTexture() {
  return cached('sidewalk', () => {
    const [c, g] = canvas(128, 128);
    const rng = new Rng(7);
    g.fillStyle = '#cbc4b6'; g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 1200, ['#bdb6a8', '#d6d0c4'], rng, 2);
    g.strokeStyle = '#a49d90'; g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    return toTexture(c);
  });
}

export function groundTexture(kind) {
  return cached('ground-' + kind, () => {
    const [c, g] = canvas(256, 256);
    const rng = new Rng(kind.length * 17);
    const base = { grass: '#6fa046', sand: '#e8d3a2', dirt: '#9c8a6a', plaza: '#d8cfbf', wood: '#a0764c', concrete: '#a8a39a' }[kind];
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    if (kind === 'grass') speckle(g, 256, 256, 7000, ['#5f9139', '#7cb052', '#88b85a', '#55822f'], rng, 3);
    else if (kind === 'sand') { speckle(g, 256, 256, 6000, ['#dcc591', '#f0dfb4', '#d2b984', '#f6e8c4'], rng, 2); }
    else if (kind === 'wood') {
      for (let y = 0; y < 256; y += 16) { g.fillStyle = y % 32 ? '#9b6f45' : '#a87d52'; g.fillRect(0, y, 256, 15); g.fillStyle = '#6b4a2c'; g.fillRect(0, y + 15, 256, 1); }
      speckle(g, 256, 256, 1500, ['rgba(60,40,20,0.3)'], rng, 2);
    } else if (kind === 'plaza') {
      speckle(g, 256, 256, 2000, ['#cfc5b3', '#e2dacb'], rng, 2);
      g.strokeStyle = '#bdb3a0'; g.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    } else speckle(g, 256, 256, 5000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], rng, 3);
    return toTexture(c);
  });
}

/** A billboard advert for one of the city's invented brands. */
export function billboardTexture(brand, seed = 1) {
  return cached('bb-' + brand.name, () => {
    const [c, g] = canvas(512, 256);
    const rng = new Rng(seed);
    g.fillStyle = brand.bg; g.fillRect(0, 0, 512, 256);
    // sunburst
    g.save(); g.translate(400, 230); g.globalAlpha = 0.18;
    for (let i = 0; i < 14; i++) { g.rotate(Math.PI / 14); g.fillStyle = brand.fg; g.fillRect(0, -6, 400, 12); }
    g.restore();
    g.fillStyle = brand.fg; g.globalAlpha = 0.9;
    g.beginPath(); g.arc(420, 100, 54 + rng.range(-6, 6), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.font = '900 64px Impact, "Arial Black", sans-serif'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeText(brand.name, 28, 92);
    g.fillStyle = brand.fg; g.fillText(brand.name, 28, 92);
    g.font = 'italic 700 30px Georgia, serif'; g.fillText(brand.tag, 32, 168);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 236, 512, 20);
    return toTexture(c, { repeat: false });
  });
}

/** A shop / landmark sign with bold lettering. */
export function signTexture(text, color, bg = '#141820') {
  return cached('sign-' + text, () => {
    const [c, g] = canvas(512, 128);
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
    g.font = '900 60px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color; g.fillText(text, 256, 66, 470);
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(text, 256, 66, 470);
    return toTexture(c, { repeat: false });
  });
}

/** Palm frond with transparent background, drawn as a feathered leaf. */
export function frondTexture() {
  return cached('frond', () => {
    const [c, g] = canvas(256, 64);
    g.clearRect(0, 0, 256, 64);
    g.strokeStyle = '#4f7a2a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 32); g.quadraticCurveTo(128, 26, 256, 34); g.stroke();
    for (let x = 6; x < 250; x += 5) {
      const len = Math.sin((x / 256) * Math.PI) * 28 + 2;
      g.strokeStyle = x % 10 ? '#5f9a35' : '#4c8a2c'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x, 31); g.lineTo(x + 10, 31 - len); g.stroke();
      g.beginPath(); g.moveTo(x, 33); g.lineTo(x + 10, 33 + len); g.stroke();
    }
    return toTexture(c, { repeat: false });
  });
}

/** Soft round sprite used for glows, smoke and particles. */
export function softDotTexture() {
  return cached('dot', () => {
    const [c, g] = canvas(64, 64);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return toTexture(c, { repeat: false, srgb: false });
  });
}

/** Big hillside letters spelling the city name. */
export function hillSignTexture() {
  return cached('hillsign', () => {
    const [c, g] = canvas(1024, 160);
    g.clearRect(0, 0, 1024, 160);
    g.font = '900 132px "Arial Black", Impact, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#fbf6ea'; g.fillText('PALMWIRE', 512, 84, 1000);
    return toTexture(c, { repeat: false });
  });
}

export function containerTexture() {
  return cached('container', () => {
    const [c, g] = canvas(128, 64);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64);
    for (let x = 0; x < 128; x += 6) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 0, 2, 64); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 61, 128, 3);
    return toTexture(c);
  });
}
