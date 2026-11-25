/* DIAGNOSTIC — LETTER-DIAGRAM-001 (owner 2026-11-25), Chromium.
 * Boots the COVER LETTER FORMAT panel and the diagram sidecar against a fabricated Settings fragment and
 * preview bar, with a fabricated letter, and asserts:
 *   1. the button mounts once in the format panel and once in the preview bar (cover letter only)
 *   2. the hint dot shows while the letter has no diagram
 *   3. the adder works by keyboard: Name is focused, three steps, Enter on Insert stores one text row
 *   4. one sections write and one antcv:sections-updated per action; a second Insert writes nothing
 *   5. opened from the format panel it stays open on the CV; Escape closes and returns the focus
 *   6. the suggestion falls back to a template when no provider is connected
 *   7. the kill switch shows no control
 * Run: node pwa/test/diag-letter-diagram.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = `<!doctype html><html><body>
<div style="height:120px"></div><div class="antcv-preview-actions" style="display:flex;width:400px;height:40px"></div>
<div id="panel"><div id="photoCtrl"><div>PROFILE PHOTO</div><div data-antcv-bridge-active="1"></div></div></div>
<script src="/antcv-cl-signature-control.js"></script>
<script src="/antcv-cl-slogan-control.js"></script>
<script src="/antcv-cl-format-panel.js"></script>
<script src="/antcv-letter-diagram.js"></script>
</body></html>`;
const CL = [
  { id: 'opening', type: 'rich_block', on: true, items: [{ b: '', t: 'Your sales teams need tools that save time.' }] },
  { id: 'why', type: 'rich_block', on: true, items: [{ b: 'Why this position', t: 'The mix of field work and product.' }] },
  { id: 'bring', type: 'rich_block', on: true, items: [{ b: 'What I bring', t: 'a few strengths:' }, { b: 'Change decisions', t: 'chaired a board of nine functions', mk: true }] },
];
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE); return; }
    const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let bad = 0;
const ok = (n, c, x) => { if (!c) bad++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || x == null ? '' : '  ' + JSON.stringify(x))); };
async function boot(doc, kill) {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(([cl, d, k]) => {
    localStorage.setItem('sections', JSON.stringify({ cv: [], cl })); localStorage.setItem('doc', JSON.stringify(d)); localStorage.setItem('language', '"en"');
    if (k) localStorage.setItem('antcv:disable-letter-diagram', '1');
    window.__n = { w: 0, e: 0 };
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === 'sections') window.__n.w++; return set.call(this, key, v); };
    window.addEventListener('antcv:sections-updated', () => { window.__n.e++; });
  }, [CL, doc, kill]);
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  return { page, errors };
}
const PANEL = '#antcv-letter-diagram-panel';
const FMT = '[data-antcv-letter-diagram="btn"][data-where="format"]';
const BAR = '[data-antcv-letter-diagram="btn"][data-where="bar"],[data-antcv-letter-diagram="btn"][data-where="float"]';

{
  const { page, errors } = await boot('cl');
  ok('one button in the format panel, inside it', await page.locator('[data-antcv-cl-format-panel] ' + FMT).count() === 1);
  ok('one control in the preview bar', await page.locator(BAR).count() === 1);
  ok('hint dot while the letter has no diagram', await page.locator(BAR).getAttribute('data-missing') === '1');
  const n0 = await page.evaluate(() => ({ ...window.__n }));
  await page.locator(FMT).focus(); await page.keyboard.press('Enter');
  ok('opens by keyboard, Name focused', await page.evaluate(() => document.activeElement.id) === 'antcv-letter-diagram-panel-name');
  await page.keyboard.type('From field day to tool');
  for (const [i, v] of ['Ride along', 'Prototype', 'Hand over'].entries()) await page.fill(PANEL + ' [data-step="' + i + '"]', v);
  await page.locator(PANEL + ' [data-main="1"]').focus(); await page.keyboard.press('Enter');
  const row = await page.evaluate(() => JSON.parse(localStorage.getItem('sections')).cl[2].items[2]);
  ok('one text row stored last in the bring section', row && row.b === 'Workflow: From field day to tool' && row.t === 'Ride along → Prototype → Hand over' && row.dg === 'flow', row);
  await page.locator(PANEL + ' [data-main="1"]').focus(); await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const n1 = await page.evaluate(() => ({ ...window.__n }));
  ok('one write and one event for two presses', n1.w - n0.w === 1 && n1.e - n0.e === 1, [n0, n1]);
  ok('the hint is gone', await page.locator(BAR).getAttribute('data-missing') === '0');
  await page.keyboard.press('Escape');
  ok('Escape closes and returns the focus', await page.locator(PANEL).count() === 0 && await page.evaluate(() => document.activeElement.getAttribute('data-where')) === 'format');
  ok('no page error', errors.length === 0, errors);
  await page.close();
}
{
  const { page } = await boot('cv');
  ok('CV: no control in the preview bar, the format button stays', await page.locator(BAR).count() === 0 && await page.locator(FMT).count() === 1);
  await page.locator(FMT).click();
  await page.evaluate(() => document.body.appendChild(document.createElement('p')));   // a foreign DOM change runs sync
  await page.waitForTimeout(700);
  ok('opened from the format panel it stays open on the CV', await page.locator(PANEL).count() === 1);
  await page.locator(PANEL + ' [data-act="suggest"]').click();
  await page.waitForTimeout(300);
  const s = await page.evaluate((p) => ({ msg: document.querySelector(p + ' [role="status"]').textContent, n: document.querySelectorAll(p + ' [data-step]').length, w: window.__n.w }), PANEL);
  ok('no provider: template with a message, nothing written', /template/.test(s.msg) && s.n === 4, s);
  await page.close();
}
{
  const { page } = await boot('cl', true);
  ok('kill switch: no control', await page.locator('[data-antcv-letter-diagram="btn"]').count() === 0);
  await page.close();
}
await browser.close(); server.close();
console.log(bad ? bad + ' FAILED' : 'all pass');
process.exit(bad ? 1 : 0);
