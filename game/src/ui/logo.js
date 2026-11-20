// The Palmwire City title logo, painted procedurally: a striped setting sun, palm
// silhouettes, chrome-gradient lettering and a neon subtitle.

function palm(g, x, y, h, lean, s) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = '#1a0b26'; g.lineWidth = 7 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean * 0.4, -h * 0.5, lean, -h); g.stroke();
  g.fillStyle = '#1a0b26';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5;
    g.save();
    g.translate(lean, -h);
    g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40 * s, -14 * s, 78 * s, 18 * s); g.quadraticCurveTo(40 * s, 0, 0, 6 * s); g.fill();
    g.restore();
  }
  g.restore();
}

export function drawLogo(canvas) {
  const W = canvas.width, H = canvas.height, s = W / 1040;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  // sun with scanline cut-outs
  const cx = W * 0.5, cy = H * 0.55, r = 170 * s;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  const sun = g.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#ffe066'); sun.addColorStop(0.45, '#ff8a3d'); sun.addColorStop(1, '#ff2e88');
  g.fillStyle = sun; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) { const yy = cy + i * 20 * s + 6 * s; g.fillRect(cx - r, yy, r * 2, (2 + i * 1.6) * s); }
  g.restore();
  // horizon water lines
  g.fillStyle = 'rgba(255,90,160,0.55)';
  for (let i = 0; i < 4; i++) g.fillRect(cx - (260 - i * 30) * s, cy + r * 0.62 + i * 12 * s, (520 - i * 60) * s, 3 * s);
  palm(g, cx - 250 * s, cy + 120 * s, 230 * s, -30 * s, s);
  palm(g, cx + 240 * s, cy + 125 * s, 260 * s, 36 * s, s);
  palm(g, cx + 300 * s, cy + 130 * s, 170 * s, 50 * s, s * 0.8);
  // PALMWIRE lettering: chrome gradient with dark extrusion
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `900 ${150 * s}px "Arial Black", Impact, sans-serif`;
  const ty = cy + 30 * s;
  for (let d = 12; d > 0; d--) { g.fillStyle = d > 9 ? '#12051f' : '#3a0d4a'; g.fillText('PALMWIRE', cx + d * s * 0.6, ty + d * s); }
  const chrome = g.createLinearGradient(0, ty - 120 * s, 0, ty);
  chrome.addColorStop(0, '#ffffff'); chrome.addColorStop(0.45, '#9ee7ff'); chrome.addColorStop(0.5, '#2a3c8f'); chrome.addColorStop(0.75, '#ff9ad5'); chrome.addColorStop(1, '#ffffff');
  g.fillStyle = chrome; g.fillText('PALMWIRE', cx, ty);
  g.lineWidth = 3 * s; g.strokeStyle = '#fff'; g.strokeText('PALMWIRE', cx, ty);
  // CITY in neon
  g.font = `italic 900 ${78 * s}px "Brush Script MT", "Segoe Script", Georgia, serif`;
  g.shadowColor = '#ff2e88'; g.shadowBlur = 24 * s;
  g.fillStyle = '#ff5fb8'; g.fillText('City', cx + 150 * s, ty + 78 * s);
  g.shadowBlur = 0;
  g.lineWidth = 2 * s; g.strokeStyle = '#ffe6f4'; g.strokeText('City', cx + 150 * s, ty + 78 * s);
  g.font = `700 ${20 * s}px "Bahnschrift", "Segoe UI", Arial`;
  g.fillStyle = '#2ee6c8'; g.fillText('S A L T W A T E R   L E D G E R', cx - 120 * s, ty + 64 * s);
}
