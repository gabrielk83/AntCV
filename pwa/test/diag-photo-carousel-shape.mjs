/* DIAGNOSTIC — PHOTO-CAROUSEL-SHAPE-001 (owner 2026-07-13):
 * "adapt carousel shape according to the selected photo shape". The carousel
 * preview <img> must adopt the photoShape the shape selector stores
 * (personalInfo.stylePrefs.photoShape / personalInfo.photoShape): circle→50%,
 * rounded→12px, square→0, pentagon→clip-path. Previously it hardcoded a circle.
 *
 * Runs against a SYNTHETIC Profile Photo panel (no app boot / no real account —
 * the sidecar's activate/remove drive the app's real upload input + cloud sync).
 * Run: node pwa/test/diag-photo-carousel-shape.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-photo-library.js'), 'utf8');

const PAGE = `<!doctype html><html><body>
  <div id="outer">
    <div id="panel">
      <div><div><div>Profile Photo</div></div></div>
      <div id="host"><img id="photo" src="my-photo-data" style="width:56px;height:56px;border-radius:50%"></div>
      <input type="file" accept="image/*" id="app-input">
      <button id="native-reset">Reset</button>
    </div>
  </div>
</body></html>`;

const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const LIB = JSON.stringify([{ id: 'a', ts: 1, dataUrl: px }, { id: 'b', ts: 2, dataUrl: px }]);
const PENT = 'polygon(50% 0%, 97.55% 34.55%, 79.39% 90.45%, 20.61% 90.45%, 2.45% 34.55%)';

const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); });
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate((lib) => localStorage.setItem('antcv:photoLibrary', lib), LIB);
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(500);

let fail = 0;
const check = (ok, label, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); if (!ok) fail++; };

// helper: set the stored shape, poke the sidecar's shape-change listener, read the pic style
async function shapeStyle(shape) {
  return page.evaluate((shape) => {
    var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
    if (shape) { pi.stylePrefs = pi.stylePrefs || {}; pi.stylePrefs.photoShape = shape; }
    else { if (pi.stylePrefs) delete pi.stylePrefs.photoShape; delete pi.photoShape; }
    localStorage.setItem('personalInfo', JSON.stringify(pi));
    window.dispatchEvent(new CustomEvent('antcv:photo-shape-changed', { detail: { shape: shape || '' } }));
    return new Promise((resolve) => setTimeout(() => {
      var pic = document.querySelector('.antcv-carousel-pic');
      resolve(pic ? { br: pic.style.borderRadius, clip: pic.style.clipPath || '', border: pic.style.border } : null);
    }, 400));
  }, shape);
}

const def = await page.evaluate(() => {
  var pic = document.querySelector('.antcv-carousel-pic');
  return pic ? { br: pic.style.borderRadius, clip: pic.style.clipPath || '' } : null;
});
check(def && def.br === '50%', 'default (no shape stored) → circle 50%', def);

const sq = await shapeStyle('square');
check(sq && sq.br === '0px', 'square → border-radius 0', sq && sq.br);

const rnd = await shapeStyle('rounded');
check(rnd && rnd.br === '12px', 'rounded → border-radius 12px', rnd && rnd.br);

const pent = await shapeStyle('pentagon');
check(pent && pent.clip.indexOf('polygon') >= 0, 'pentagon → clip-path polygon applied', pent && pent.clip.slice(0, 24));
check(pent && (pent.border === '0px' || pent.border === '0px none' || pent.border.indexOf('0px') === 0), 'pentagon → ring border dropped', pent && pent.border);

const circ = await shapeStyle('circle');
check(circ && circ.br === '50%', 'circle → back to 50%', circ && circ.br);
check(circ && circ.clip === '', 'circle → clip-path cleared', circ && circ.clip);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));

await browser.close(); server.close();
console.log(fail ? `RED — ${fail} check(s) failed` : 'GREEN — PHOTO-CAROUSEL-SHAPE-001 verified');
process.exit(fail ? 1 : 0);
