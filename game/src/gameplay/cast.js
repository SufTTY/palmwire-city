// The people of the "Saltwater Ledger" story and their procedurally painted portraits.

export const CAST = {
  sol:    { name: 'Sol Arroyo', role: 'Getaway driver, back in town', skin: '#c98d5a', hair: '#1b120c', shirt: '#17a8a0', bg: ['#0f4c5c', '#17a8a0'], hairStyle: 'short' },
  vee:    { name: 'Auntie Vee', role: 'Fixer · Suds & Sons', skin: '#8d5524', hair: '#e8e2d8', shirt: '#e86f9a', bg: ['#5c1f3c', '#e86f9a'], hairStyle: 'bun', glasses: true },
  tavo:   { name: 'Tavo Reyes', role: 'Street racer · Driver', skin: '#e0ac69', hair: '#2a1a10', shirt: '#ff9f1c', bg: ['#6b2d00', '#ff9f1c'], hairStyle: 'spiky' },
  grease: { name: 'Grease Okonkwo', role: 'Mechanic · Okonkwo Auto', skin: '#6b4226', hair: '#111111', shirt: '#3d5a80', bg: ['#1d2d44', '#3d5a80'], hairStyle: 'cap' },
  pixel:  { name: 'Pixel', role: 'Hacker · Lookout', skin: '#f1c27d', hair: '#b45cf0', shirt: '#2b2d42', bg: ['#2a0f4a', '#b45cf0'], hairStyle: 'bob', glasses: true },
  vell:   { name: 'Marcus Vell', role: 'CEO · Vell Coastal Holdings', skin: '#ffdbac', hair: '#9a8a70', shirt: '#15171c', bg: ['#1e2a38', '#d4b05a'], hairStyle: 'slick' },
  drey:   { name: 'Captain Lucan Drey', role: 'Harbor Kings', skin: '#c68642', hair: '#3a2a20', shirt: '#c0602a', bg: ['#3a1408', '#c0602a'], hairStyle: 'beard' },
  kroll:  { name: 'Lt. Dana Kroll', role: 'PCPD · on the take', skin: '#e0ac69', hair: '#5a3a1a', shirt: '#1d3a6e', bg: ['#0a1a3a', '#3b6fd6'], hairStyle: 'cap' },
  dispatch: { name: 'PCPD Dispatch', role: 'Police scanner', skin: '#888888', hair: '#333333', shirt: '#1d3a6e', bg: ['#0a1a3a', '#3b6fd6'], hairStyle: 'headset' },
};

const portraitCache = new Map();

/** Paints a stylised head-and-shoulders portrait for a cast member; returns a data URL. */
export function portrait(id, size = 96) {
  const key = id + size;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const c = CAST[id] || CAST.sol;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const s = size / 96;
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, c.bg[0]); grad.addColorStop(1, c.bg[1]);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  // sun disc behind the head
  g.fillStyle = 'rgba(255,220,150,0.25)'; g.beginPath(); g.arc(70 * s, 30 * s, 26 * s, 0, Math.PI * 2); g.fill();
  // shoulders
  g.fillStyle = c.shirt; g.beginPath(); g.ellipse(48 * s, 100 * s, 40 * s, 30 * s, 0, 0, Math.PI * 2); g.fill();
  // neck and head
  g.fillStyle = c.skin; g.fillRect(41 * s, 58 * s, 14 * s, 14 * s);
  g.beginPath(); g.ellipse(48 * s, 44 * s, 19 * s, 23 * s, 0, 0, Math.PI * 2); g.fill();
  // hair styles
  g.fillStyle = c.hair;
  switch (c.hairStyle) {
    case 'bun': g.beginPath(); g.ellipse(48 * s, 26 * s, 20 * s, 10 * s, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(48 * s, 15 * s, 8 * s, 0, Math.PI * 2); g.fill(); break;
    case 'spiky': for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo((30 + i * 7) * s, 30 * s); g.lineTo((33 + i * 7) * s, 12 * s); g.lineTo((38 + i * 7) * s, 30 * s); g.fill(); } break;
    case 'cap': g.fillRect(28 * s, 18 * s, 40 * s, 12 * s); g.fillRect(40 * s, 26 * s, 34 * s, 5 * s); break;
    case 'bob': g.beginPath(); g.ellipse(48 * s, 36 * s, 23 * s, 22 * s, 0, Math.PI, 0); g.fill(); g.fillRect(25 * s, 34 * s, 8 * s, 22 * s); g.fillRect(63 * s, 34 * s, 8 * s, 22 * s); break;
    case 'slick': g.beginPath(); g.ellipse(46 * s, 28 * s, 20 * s, 10 * s, -0.2, Math.PI, 0); g.fill(); break;
    case 'beard': g.beginPath(); g.ellipse(48 * s, 27 * s, 19 * s, 9 * s, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(48 * s, 58 * s, 16 * s, 10 * s, 0, 0, Math.PI); g.fill(); break;
    case 'headset': g.fillRect(29 * s, 22 * s, 38 * s, 7 * s); g.fillStyle = '#222'; g.fillRect(26 * s, 38 * s, 6 * s, 12 * s); break;
    default: g.beginPath(); g.ellipse(48 * s, 27 * s, 19 * s, 9 * s, 0, Math.PI, 0); g.fill();
  }
  // eyes, brows, mouth
  g.fillStyle = '#1a1a1a';
  g.fillRect(39 * s, 42 * s, 4 * s, 3 * s); g.fillRect(53 * s, 42 * s, 4 * s, 3 * s);
  g.fillRect(37 * s, 37 * s, 8 * s, 2 * s); g.fillRect(51 * s, 37 * s, 8 * s, 2 * s);
  g.fillStyle = 'rgba(80,20,20,0.8)'; g.fillRect(43 * s, 55 * s, 10 * s, 2 * s);
  if (c.glasses) { g.strokeStyle = '#111'; g.lineWidth = 2 * s; g.strokeRect(35 * s, 39 * s, 11 * s, 8 * s); g.strokeRect(50 * s, 39 * s, 11 * s, 8 * s); }
  const url = cv.toDataURL();
  portraitCache.set(key, url);
  return url;
}
