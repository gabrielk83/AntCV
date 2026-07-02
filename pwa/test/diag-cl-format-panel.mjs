/* DIAGNOSTIC — CL-FORMAT-PANEL-001 / F3 (register row 7).
 * Boots the three sidecars (signature control, slogan control, format panel) in
 * Chromium against a fabricated Settings→Layout fragment (the PROFILE PHOTO
 * control anchor both controls key off) and asserts:
 *   1. the "COVER LETTER FORMAT" panel mounts once
 *   2. the signature control lives INSIDE the panel
 *   3. the slogan control lives INSIDE the panel, after the signature
 *   4. a container re-render does not duplicate the panel
 *   5. the kill switch leaves the controls in their legacy placement
 * Run: node pwa/test/diag-cl-format-panel.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const PAGE = `<!doctype html><html><body>
<div id="panel">
  <div id="photoCtrl"><div>PROFILE PHOTO</div><div data-antcv-bridge-active="1"></div></div>
</div>
<script src="/antcv-cl-signature-control.js"></script>
<script src="/antcv-cl-slogan-control.js"></script>
<script src="/antcv-cl-format-panel.js"></script>
</body></html>`;
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function run(kill) {
  const page = await browser.newPage();
  if (kill) await page.addInitScript(() => localStorage.setItem('antcv:disable-cl-format-panel', '1'));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => {
    const panel = document.querySelectorAll('[data-antcv-cl-format-panel]');
    const sig = document.querySelector('[data-antcv-cl-sig-control]');
    const slo = document.querySelector('[data-antcv-cl-slogan-control]');
    return {
      panels: panel.length,
      sigInPanel: !!(sig && sig.parentElement && sig.parentElement.hasAttribute('data-antcv-cl-format-panel')),
      sloInPanel: !!(slo && slo.parentElement && slo.parentElement.hasAttribute('data-antcv-cl-format-panel')),
      sloAfterSig: !!(slo && sig && slo.previousElementSibling === sig),
      heading: panel[0] ? /COVER LETTER FORMAT/.test(panel[0].textContent || '') : false,
      sigMounted: !!sig, sloMounted: !!slo,
    };
  });
  // container re-render: nuke and recreate the photo anchor
  await page.evaluate(() => {
    const p = document.getElementById('panel');
    p.innerHTML = '<div id="photoCtrl2"><div>PROFILE PHOTO</div><div data-antcv-bridge-active="1"></div></div>';
  });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({
    panels: document.querySelectorAll('[data-antcv-cl-format-panel]').length,
    sigs: document.querySelectorAll('[data-antcv-cl-sig-control]').length,
    sigInPanel: (() => { const s = document.querySelector('[data-antcv-cl-sig-control]'); return !!(s && s.parentElement && s.parentElement.hasAttribute('data-antcv-cl-format-panel')); })(),
  }));
  await page.close();
  return { state, after };
}

const normal = await run(false);
const killed = await run(true);
await browser.close(); server.close();

let fail = false;
const expect = (c, m) => { if (!c) { console.error('FAIL:', m); fail = true; } else console.log('OK:', m); };
expect(normal.state.sigMounted && normal.state.sloMounted, 'both CL controls mounted');
expect(normal.state.panels === 1, 'exactly one COVER LETTER FORMAT panel');
expect(normal.state.heading, 'panel carries the COVER LETTER FORMAT heading');
expect(normal.state.sigInPanel, 'signature control re-parented INTO the panel');
expect(normal.state.sloInPanel, 'slogan control re-parented INTO the panel');
expect(normal.state.sloAfterSig, 'slogan sits after the signature inside the panel');
expect(normal.after.panels === 1 && normal.after.sigs === 1, 'container re-render: still ONE panel + ONE signature control');
expect(normal.after.sigInPanel, 'after re-render the signature is back inside the panel');
expect(killed.state.panels === 0 && killed.state.sigMounted, 'kill switch: no panel, controls keep legacy placement');
console.log(fail ? 'DIAG CL-FORMAT-PANEL: FAIL' : 'DIAG CL-FORMAT-PANEL: PASS');
process.exit(fail ? 1 : 0);
