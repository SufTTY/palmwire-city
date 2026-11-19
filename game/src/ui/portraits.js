// Flat, poster-style character portraits drawn on a canvas from the cast description: sunset
// backdrop, shoulders in the character's accent colour, face, hair style and accessories.

export function drawPortrait(canvas, p) {
  const g = canvas.getContext('2d');
  const S = canvas.width;
  g.save();
  g.scale(S / 240, S / 240);
  const bg = g.createLinearGradient(0, 0, 0, 240);
  bg.addColorStop(0, p.bg[0]);
  bg.addColorStop(1, p.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, 240, 240);
  // sun and stripes behind the head
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.arc(170, 80, 56, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let k = 0; k < 5; k++) g.fillRect(0, 150 + k * 18, 240, 8);
  // shoulders
  g.fillStyle = p.accent;
  g.beginPath();
  g.moveTo(30, 240); g.quadraticCurveTo(40, 168, 120, 166); g.quadraticCurveTo(200, 168, 210, 240); g.closePath();
  g.fill();
  if (p.tie) {
    g.fillStyle = '#f2f2f2';
    g.beginPath(); g.moveTo(98, 170); g.lineTo(142, 170); g.lineTo(120, 210); g.closePath(); g.fill();
    g.fillStyle = '#7a1020';
    g.beginPath(); g.moveTo(114, 176); g.lineTo(126, 176); g.lineTo(130, 222); g.lineTo(120, 232); g.lineTo(110, 222); g.closePath(); g.fill();
  }
  // neck + head
  g.fillStyle = p.skin;
  g.fillRect(104, 138, 32, 34);
  g.beginPath(); g.ellipse(120, 104, 44, 54, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath(); g.ellipse(132, 110, 30, 44, 0, -0.8, 1.6); g.fill();
  // ears + earrings
  g.fillStyle = p.skin;
  g.beginPath(); g.ellipse(76, 110, 8, 12, 0, 0, Math.PI * 2); g.ellipse(164, 110, 8, 12, 0, 0, Math.PI * 2); g.fill();
  if (p.earrings) {
    g.strokeStyle = '#ffd23a'; g.lineWidth = 3;
    g.beginPath(); g.arc(76, 128, 6, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(164, 128, 6, 0, Math.PI * 2); g.stroke();
  }
  // hair
  g.fillStyle = p.hair;
  const hs = p.hairStyle;
  if (hs === 'long') {
    g.beginPath(); g.ellipse(120, 82, 50, 40, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(70, 80, 18, 90);
    g.fillRect(152, 80, 18, 90);
  } else if (hs === 'bun') {
    g.beginPath(); g.ellipse(120, 78, 47, 32, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(120, 40, 20, 0, Math.PI * 2); g.fill();
  } else if (hs === 'slick') {
    g.beginPath(); g.ellipse(120, 76, 46, 30, -0.1, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(76, 70, 10, 30);
  } else if (hs === 'cap') {
    g.fillStyle = p.capColor || '#333';
    g.beginPath(); g.ellipse(120, 72, 48, 30, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(118, 64, 66, 10);
  }
  // face
  if (p.shades) {
    g.fillStyle = '#111';
    g.beginPath(); g.roundRect(84, 92, 34, 18, 6); g.roundRect(122, 92, 34, 18, 6); g.fill();
    g.fillRect(116, 96, 8, 4);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(90, 95, 10, 3); g.fillRect(128, 95, 10, 3);
  } else {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(102, 102, 9, 6, 0, 0, Math.PI * 2); g.ellipse(138, 102, 9, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1a10';
    g.beginPath(); g.arc(103, 102, 4, 0, Math.PI * 2); g.arc(139, 102, 4, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(40,20,10,0.8)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(90, 86); g.lineTo(112, 84); g.moveTo(128, 84); g.lineTo(150, 86); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(120, 106); g.lineTo(116, 124); g.lineTo(124, 125); g.stroke();
  g.strokeStyle = 'rgba(120,30,30,0.9)';
  g.beginPath(); g.moveTo(104, 138); g.quadraticCurveTo(120, 146, 136, 137); g.stroke();
  g.restore();
}
