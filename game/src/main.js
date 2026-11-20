// Entry point: seed the randomness for screenshot scenes, build the Game, show the title
// screen (or stage a ?shot= scene), and run the frame loop.
import { mulberry32 } from './core/rng.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) Math.random = mulberry32(Number(params.get('seed') || 1) * 9973 + 17);
if (params.get('debug')) document.body.classList.add('debug');

const { Game } = await import('./game.js');
const { runScene } = await import('./shots/screenshotScenes.js');

const game = new Game(document.getElementById('view'), params);
window.__palmwire = game;
document.getElementById('loading').remove();

if (shot) runScene(game, shot);
else if (params.get('play')) game.startPlaying(params.get('play') === 'continue');
else game.ui.menus.showTitle();

let last = performance.now();
let frames = 0, statT = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try {
    game.update(dt);
    game.render();
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
  }
  // lightweight stats for headless checks and ?debug=1
  frames++; statT += dt;
  if (statT > 1) {
    const info = game.renderer.info.render;
    document.body.dataset.stats = `fps=${Math.round(frames / statT)} calls=${info.calls} tris=${info.triangles} cars=${game.vehicles.list.length} peds=${game.peds.list.length}`;
    frames = 0; statT = 0;
  }
  game.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
