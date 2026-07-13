/* DIAGNOSTIC — PHOTO-REMOVE-LAST-RESET-001 (owner 2026-07-13):
 * "removing both x-ed photos should get me back to the ant photo not to my
 * photo". ✕ on the LAST library photo must drive the app's native Reset
 * (embedded default ant), not leave the previously active photo in place.
 *
 * Runs against a SYNTHETIC Profile Photo panel (no app boot, no real account —
 * activate()/remove() mutate cloud state on an authenticated pane, so this diag
 * never touches the live app). The fake panel mirrors what the sidecar's
 * findPanel/findPhotoImg/appFileInput/findNativeReset expect; the fake Reset
 * button swaps the img back to ant.png exactly like the app's own Reset.
 * Run: node pwa/test/diag-photo-remove-last-reset.mjs */
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
      <!-- the app's own hidden upload input lives INSIDE the panel, BEFORE the
           sidecar-appended controls column, so appFileInput() finds it first
           in document order (same as the real React panel) -->
      <input type="file" accept="image/*" id="app-input">
      <button id="native-reset">Reset</button>
    </div>
  </div>
  <script>
    window.__resetClicks = 0;
    window.__appInputChanges = 0;
    document.getElementById('native-reset').addEventListener('click', function () {
      window.__resetClicks++;
      document.getElementById('photo').src = './ant.png';   // app restores default
    });
    document.getElementById('app-input').addEventListener('change', function () {
      window.__appInputChanges++;
      // the app would read input.files and set the photo; mirror that
      document.getElementById('photo').src = 'activated-from-library';
    });
  </script>
</body></html>`;

// 1px PNG data URLs (distinct ids)
const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const LIB = JSON.stringify([{ id: 'a', ts: 1, dataUrl: px }, { id: 'b', ts: 2, dataUrl: px }]);

// setContent leaves the page on about:blank, where localStorage is denied —
// serve the synthetic panel over http so the sidecar's storage calls work.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(PAGE);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate((lib) => localStorage.setItem('antcv:photoLibrary', lib), LIB);
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(500); // sidecar schedule() = 250ms

let fail = 0;
const check = (ok, label, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); if (!ok) fail++; };

const s0 = await page.evaluate(() => ({
  overlay: !!document.querySelector('[data-antcv-photo-carousel]'),
  lib: JSON.parse(localStorage.getItem('antcv:photoLibrary') || '[]').length,
}));
check(s0.overlay && s0.lib === 2, 'carousel renders over the synthetic panel with 2 photos', s0);

// remove #1 — neighbour must be activated through the app's own input, no reset
await page.evaluate(() => window.AntcvPhotoLibrary._remove());
await page.waitForTimeout(400);
const s1 = await page.evaluate(() => ({
  lib: JSON.parse(localStorage.getItem('antcv:photoLibrary') || '[]').length,
  resets: window.__resetClicks, activations: window.__appInputChanges,
}));
check(s1.lib === 1, 'first ✕ leaves 1 photo in the library', s1.lib);
check(s1.resets === 0, 'first ✕ does NOT reset (a neighbour remains)', s1.resets);
check(s1.activations === 1, 'first ✕ activates the neighbour via the app input', s1.activations);

// remove #2 (the LAST one) — must click native Reset -> default ant
await page.evaluate(() => window.AntcvPhotoLibrary._remove());
await page.waitForTimeout(400);
const s2 = await page.evaluate(() => ({
  lib: JSON.parse(localStorage.getItem('antcv:photoLibrary') || '[]').length,
  resets: window.__resetClicks,
  src: document.getElementById('photo').getAttribute('src'),
  overlay: !!document.querySelector('[data-antcv-photo-carousel]'),
}));
check(s2.lib === 0, 'second ✕ empties the library', s2.lib);
check(s2.resets === 1, 'second ✕ clicks the native Reset exactly once', s2.resets);
check(s2.src === './ant.png', 'photo block is back on the default ant, not the user photo', s2.src);
check(!s2.overlay, 'carousel overlay removed with the library empty', s2.overlay);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));

await browser.close(); server.close();
console.log(fail ? `RED — ${fail} check(s) failed` : 'GREEN — PHOTO-REMOVE-LAST-RESET-001 verified');
process.exit(fail ? 1 : 0);
