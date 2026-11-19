// Paints the whole city once into an offscreen canvas - sea, beaches, district blocks,
// building footprints, parks, roads and the bridge - for the minimap and the pause-menu map.
import { CELL, HALF_ROAD, CITY, BEACH_END, QUAY_END, POINT_END } from '../world/cityLayout.js';

export const MAP_MIN = -220;
export const MAP_SIZE = 1560;   // metres covered by the image
export const MAP_PX = 2048;
export const PX_PER_M = MAP_PX / MAP_SIZE;

const DISTRICT_FILL = {
  downtown: '#d9d3cb', midtown: '#e2d9cc', residential: '#cfdcb6', beach: '#efe2c6', industrial: '#bdb6aa', park: '#8fc26c',
};

export function renderCityMap(layout, colliders) {
  const c = document.createElement('canvas');
  c.width = c.height = MAP_PX;
  const g = c.getContext('2d');
  const X = (x) => (x - MAP_MIN) * PX_PER_M;
  const rect = (x0, z0, x1, z1, fill) => { g.fillStyle = fill; g.fillRect(X(x0), X(z0), (x1 - x0) * PX_PER_M, (z1 - z0) * PX_PER_M); };

  g.fillStyle = '#2f7a96';
  g.fillRect(0, 0, MAP_PX, MAP_PX);
  // land masses
  rect(MAP_MIN, MAP_MIN, BEACH_END, -HALF_ROAD, '#c4c08f');
  rect(MAP_MIN, -HALF_ROAD, -HALF_ROAD, QUAY_END, '#c4c08f');
  rect(CITY + HALF_ROAD, -HALF_ROAD, BEACH_END, POINT_END, '#f0dca8');
  rect(13 * CELL - HALF_ROAD, CITY + HALF_ROAD, BEACH_END, POINT_END, '#f0dca8');
  rect(-HALF_ROAD, CITY + HALF_ROAD, 9 * CELL - HALF_ROAD, QUAY_END, '#b4ada2');
  // blocks
  for (const b of layout.blocks) {
    if (b.type === 'water') continue;
    rect(b.x0, b.z0, b.x1, b.z1, '#c9c3b8');
    rect(b.x0 + 3, b.z0 + 3, b.x1 - 3, b.z1 - 3, DISTRICT_FILL[b.type] || '#ddd');
  }
  rect(HALF_ROAD, HALF_ROAD, 3 * CELL - HALF_ROAD, 3 * CELL - HALF_ROAD, DISTRICT_FILL.park);
  g.fillStyle = '#7fb25d';
  g.beginPath();
  g.arc(X(layout.park.cx), X(layout.park.cz), layout.park.r * PX_PER_M, 0, Math.PI * 2);
  g.fill();
  // building footprints
  g.fillStyle = 'rgba(120,110,100,0.55)';
  for (const bx of colliders.boxes) {
    if (bx.y1 < 3 || bx.x1 - bx.x0 > 80) continue;
    g.fillRect(X(bx.x0), X(bx.z0), (bx.x1 - bx.x0) * PX_PER_M, (bx.z1 - bx.z0) * PX_PER_M);
  }
  // roads
  g.lineCap = 'square';
  for (const pass of [0, 1]) {
    for (const s of layout.segments) {
      g.strokeStyle = pass === 0 ? (s.bridge ? '#e8e2d6' : '#3e434a') : (s.bridge ? '#6a6f78' : '#5a6068');
      g.lineWidth = (pass === 0 ? HALF_ROAD * 2 + 2 : HALF_ROAD * 2 - 2) * PX_PER_M;
      g.beginPath();
      g.moveTo(X(s.x0), X(s.z0));
      g.lineTo(X(s.x1), X(s.z1));
      g.stroke();
    }
  }
  g.strokeStyle = 'rgba(255,214,90,0.55)';
  g.lineWidth = 1;
  for (const s of layout.segments) {
    g.beginPath();
    g.moveTo(X(s.x0), X(s.z0));
    g.lineTo(X(s.x1), X(s.z1));
    g.stroke();
  }
  // district labels
  g.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(40,40,50,0.55)';
  const label = (t, x, z) => g.fillText(t, X(x), X(z));
  label('HALCYON', 7 * CELL, 6 * CELL);
  label('MIRADOR', 10.5 * CELL, 4.5 * CELL);
  label('SEAGRASS HEIGHTS', 8 * CELL, 1.5 * CELL);
  label('SALTWORKS DOCKS', 4.5 * CELL, 12.6 * CELL);
  label('CRESTLINE PARK', 1.5 * CELL, 2.6 * CELL);
  label('PELICAN BAY', 11 * CELL, 11 * CELL);
  g.save();
  g.translate(X(CITY + 30), X(7 * CELL));
  g.rotate(Math.PI / 2);
  g.fillText('CORAL STRAND', 0, 0);
  g.restore();
  return c;
}
