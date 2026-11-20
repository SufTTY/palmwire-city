// Renders the four screenshot scenes with headless Chrome and saves them as JPEGs under
// screenshots/ (each <= 256 KiB, 1280x720). Needs `node serve.ts` running on :8080.
//   node tools/make-screenshots.mjs [path-to-chrome]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chrome = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const work = mkdtempSync(join(tmpdir(), 'pw-shots-'));
const profile = join(work, 'profile');
const SHOTS = [
  ['1-police-chase-sunline.jpg', 'shot=chase&seed=1'],
  ['2-shootout-on-foot.jpg', 'shot=foot&seed=1'],
  ['3-street-race-checkpoint.jpg', 'shot=race&seed=1'],
  ['4-map-and-progress.jpg', 'shot=map&seed=1'],
];
const LIMIT = 256 * 1024 - 2048;
const base = ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--user-data-dir=${profile}`, '--window-size=1280,720', '--hide-scrollbars', '--mute-audio'];

mkdirSync(join(root, 'screenshots'), { recursive: true });
for (const [name, query] of SHOTS) {
  const png = join(work, name.replace('.jpg', '.png'));
  spawnSync(chrome, [...base, '--virtual-time-budget=20000', `--screenshot=${png}`, `http://localhost:8080/?${query}`], { stdio: 'ignore' });
  let saved = false;
  for (const q of [0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.64]) {
    const page = pathToFileURL(join(root, 'tools', 'png-to-jpeg.html')).href + '?src=' + encodeURIComponent(pathToFileURL(png).href) + '&q=' + q;
    const r = spawnSync(chrome, [...base, '--allow-file-access-from-files', '--virtual-time-budget=3000', '--dump-dom', page], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const m = /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/.exec(r.stdout || '');
    if (!m) { console.error('conversion failed for', name, (r.stdout || '').slice(0, 200)); break; }
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length <= LIMIT) {
      const out = join(root, 'screenshots', name);
      writeFileSync(out, buf);
      console.log(name, 'q=' + q, Math.round(statSync(out).size / 1024) + ' KiB');
      saved = true;
      break;
    }
  }
  if (!saved) console.error('could not fit', name, 'under the size limit');
}
