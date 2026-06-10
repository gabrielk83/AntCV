/* DIAGNOSTIC — antcv-keyboard-shortcuts-374 (owner-approved 2026-06-10).
 * Asserts the shortcut sidecar against a synthetic editor:
 *   A. Ctrl+Enter clicks the "Generate CV & Cover Letter" button
 *   B. Cmd+Enter (meta) also works
 *   C. Esc with a textarea focused BLURS it (does not close a panel)
 *   D. Esc with nothing focused clicks a visible Close button
 *   E. a plain key (no modifier) does NOT trigger Generate
 *   F. disable hatch suppresses the listener
 * Run: node test/diag-keyboard-shortcuts.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = await readFile(path.join(ROOT, 'antcv-keyboard-shortcuts-374.js'), 'utf8');

const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<button id="gen">Generate CV &amp; Cover Letter</button>
<button id="close">Close</button>
<textarea id="ta">jd text</textarea>
<input id="txt" type="text">
<script>
  window.__clicks = { gen:0, close:0 };
  document.getElementById('gen').addEventListener('click', ()=>window.__clicks.gen++);
  document.getElementById('close').addEventListener('click', ()=>window.__clicks.close++);
</script>
<script>${SRC}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();

async function run(disable) {
  const page = await browser.newPage();
  if (disable) await page.addInitScript(() => localStorage.setItem('antcv:disable-shortcuts', '1'));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(200);

  // A — Ctrl+Enter clicks Generate
  await page.evaluate(() => document.body.focus());
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  // B — Cmd+Enter
  await page.keyboard.down('Meta'); await page.keyboard.press('Enter'); await page.keyboard.up('Meta');
  const genClicks = await page.evaluate(() => window.__clicks.gen);

  // C — Esc with textarea focused blurs it (no close click)
  await page.focus('#ta');
  await page.keyboard.press('Escape');
  const afterTaEsc = await page.evaluate(() => ({ active: document.activeElement && document.activeElement.id, close: window.__clicks.close }));

  // D — Esc with nothing focused clicks Close
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.body.focus(); });
  await page.keyboard.press('Escape');
  const closeClicks = await page.evaluate(() => window.__clicks.close);

  // E — plain Enter (no modifier) does NOT click Generate
  const before = await page.evaluate(() => window.__clicks.gen);
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Enter');
  const afterPlain = await page.evaluate(() => window.__clicks.gen);

  await page.close();
  return { genClicks, afterTaEsc, closeClicks, afterPlain, before, errs };
}

const on = await run(false);
const off = await run(true);
await browser.close(); await new Promise(r => server.close(r));

console.log('ON :', JSON.stringify(on));
console.log('OFF:', JSON.stringify({ genClicks: off.genClicks, closeClicks: off.closeClicks }));

const A = on.genClicks >= 1;                       // ctrl+enter fired
const B = on.genClicks >= 2;                       // meta+enter also fired
const C = on.afterTaEsc.active !== 'ta' && on.afterTaEsc.close === 0; // esc blurred field, no close
const D = on.closeClicks >= 1;                     // esc-with-nothing-focused closed
const E = on.afterPlain === on.before;             // plain Enter no-op for Generate
const F = off.genClicks === 0 && off.closeClicks === 0; // disabled = inert

console.log(`CHECK A (Ctrl+Enter → Generate): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (Cmd+Enter → Generate): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (Esc in textarea blurs, no panel close): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (Esc with nothing focused → Close): ${D ? 'PASS' : 'FAIL'}`);
console.log(`CHECK E (plain Enter does NOT Generate): ${E ? 'PASS' : 'FAIL'}`);
console.log(`CHECK F (disable hatch makes it inert): ${F ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && E && F && on.errs.length === 0 && off.errs.length === 0;
console.log(ok ? 'KEYBOARD-SHORTCUTS OK (6/6)' : 'KEYBOARD-SHORTCUTS FAIL');
process.exitCode = ok ? 0 : 1;
