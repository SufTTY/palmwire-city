// The Palmwire City logo, painted procedurally: a striped sunset disc, palm silhouettes, a
// chrome italic wordmark and a neon "CITY" underline.

function palm(g, x, y, h, lean) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#1a0b2a';
  g.beginPath();
  g.moveTo(-5, 0);
  g.quadraticCurveTo(lean * 0.5, -h * 0.5, lean, -h);
  g.lineTo(lean + 6, -h);
  g.quadraticCurveTo(lean * 0.5 + 8, -h * 0.5, 5, 0);
  g.closePath();
  g.fill();
  g.translate(lean + 3, -h);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k / 6) * Math.PI + (k % 2 ? 0.15 : -0.1);
    g.save();
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(40, -18, 78, 14);
    g.quadraticCurveTo(40, -4, 0, 6);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.restore();
}

export function drawTitleLogo(canvas) {
  const W = 1280, H = 560;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  // sun
  const cx = 640, cy = 250, r = 190;
  const sun = g.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#ffe36b');
  sun.addColorStop(0.5, '#ff8a4c');
  sun.addColorStop(1, '#ff2f7a');
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = sun;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (let k = 0; k < 8; k++) {
    const y = cy + 20 + k * 22;
    g.clearRect(cx - r, y, r * 2, 4 + k * 1.6);
  }
  g.restore();
  g.shadowColor = 'rgba(255,80,140,0.6)';
  g.shadowBlur = 40;
  palm(g, 470, 420, 240, -40);
  palm(g, 820, 430, 280, 50);
  palm(g, 870, 430, 190, 20);
  g.shadowBlur = 0;
  // wordmark
  g.save();
  g.translate(640, 330);
  g.transform(1, 0, -0.22, 1, 0, 0);
  g.font = '900 170px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.lineWidth = 22;
  g.strokeStyle = '#1a0b2a';
  g.strokeText('PALMWIRE', 0, 0);
  const chrome = g.createLinearGradient(0, -140, 0, 10);
  chrome.addColorStop(0, '#ffffff');
  chrome.addColorStop(0.45, '#bfe9ff');
  chrome.addColorStop(0.52, '#3a6c9a');
  chrome.addColorStop(0.6, '#ffd6a8');
  chrome.addColorStop(1, '#ff8a4c');
  g.fillStyle = chrome;
  g.fillText('PALMWIRE', 0, 0);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.strokeText('PALMWIRE', 0, 0);
  g.restore();
  // neon CITY
  g.save();
  g.translate(640, 440);
  g.transform(1, 0, -0.22, 1, 0, 0);
  g.font = 'italic 900 92px "Arial Black", Impact, sans-serif';
  g.textAlign = 'center';
  g.shadowColor = '#ff3fa4';
  g.shadowBlur = 30;
  g.lineWidth = 6;
  g.strokeStyle = '#ff3fa4';
  g.strokeText('C I T Y', 0, 0);
  g.shadowBlur = 10;
  g.fillStyle = '#ffe1f3';
  g.fillText('C I T Y', 0, 0);
  g.restore();
  g.fillStyle = '#5ef2ff';
  g.shadowColor = '#5ef2ff';
  g.shadowBlur = 16;
  g.fillRect(330, 470, 620, 6);
  g.shadowBlur = 0;
}
