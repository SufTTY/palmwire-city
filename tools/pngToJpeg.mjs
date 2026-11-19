// Re-encode a browser screenshot PNG as JPEG (same pixels, smaller file) using headless Chrome's
// canvas encoder, so screenshots fit the 256 KiB limit. No image content is changed.
//   node tools/pngToJpeg.mjs <in.png> <out.jpg> [quality 0..1]
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const [src, dst, q = '0.88'] = process.argv.slice(2);
if (!src || !dst) {
  console.error('usage: node tools/pngToJpeg.mjs <in.png> <out.jpg> [quality]');
  process.exit(1);
}
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const work = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'jpeg-'));
const b64 = readFileSync(src).toString('base64');
const page = join(work, 'encode.html');
writeFileSync(page, `<!doctype html><body><script>
const img = new Image();
img.onload = () => {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  document.body.textContent = 'JPEG[' + c.toDataURL('image/jpeg', ${Number(q)}) + ']';
};
img.src = 'data:image/png;base64,${b64}';
</script></body>`);
const dom = execFileSync(chrome, [
  '--headless=new', '--disable-gpu', `--user-data-dir=${join(work, 'profile')}`,
  '--virtual-time-budget=10000', '--dump-dom', pathToFileURL(page).href,
], { maxBuffer: 64 * 1024 * 1024 }).toString();
const m = dom.match(/JPEG\[data:image\/jpeg;base64,([^\]]+)\]/);
rmSync(work, { recursive: true, force: true });
if (!m) {
  console.error('encoding failed');
  process.exit(1);
}
const out = Buffer.from(m[1], 'base64');
writeFileSync(dst, out);
console.log(`${dst}: ${out.length} bytes (quality ${q})`);
