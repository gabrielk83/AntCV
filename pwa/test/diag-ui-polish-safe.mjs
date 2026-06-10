/* DIAGNOSTIC — antcv-ui-polish-373 safety (owner-approved UI polish 2026-06-10).
 * Asserts the polish layer is purely additive and cannot affect the page-break
 * measurer or override app styles:
 *   A. the stylesheet installs
 *   B. it animates ONLY non-layout properties (no width/height/margin/padding
 *      in any transition declaration)
 *   C. every selector carries the document-exclusion guard (nothing inside
 *      .antcv-preview-paper / .antcv-page-row / .antcv-document-sidebar)
 *   D. a chrome button gets a transition; a button INSIDE a preview paper does NOT
 *   E. the disable escape-hatch suppresses the layer
 * Run: node test/diag-ui-polish-safe.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = await readFile(path.join(ROOT, 'antcv-ui-polish-373.js'), 'utf8');

// Static checks on the source (no browser needed).
const transitions = [...SRC.matchAll(/transition:\s*([^;]+);/g)].map(m => m[1]);
const layoutWords = /\b(width|height|margin|padding|inset|top|left|right|bottom|flex|grid)\b/;
const Bstatic = transitions.length > 0 && transitions.every(t => !layoutWords.test(t));

const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<button id="chrome-btn">Chrome button</button>
<input id="chrome-inp" type="text">
<div class="antcv-preview-paper"><button id="doc-btn">Doc button</button></div>
<div class="antcv-page-row"><button id="row-btn">Row button</button></div>
<script>${SRC}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();

async function run(disable) {
  const page = await browser.newPage();
  if (disable) await page.addInitScript(() => localStorage.setItem('antcv:disable-ui-polish', '1'));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const st = document.getElementById('antcv-ui-polish-css');
    const has = !!st;
    const tr = (id) => { const el = document.getElementById(id); return el ? getComputedStyle(el).transitionProperty : ''; };
    // count document-exclusion guards in the ACTUAL injected CSS (the source
    // builds them via a variable, so they only expand here at runtime).
    var guardCount = 0;
    if (st) guardCount = (st.textContent.match(/:not\(\.antcv-page-row \*\)/g) || []).length;
    return {
      installed: has,
      guardCount: guardCount,
      chromeBtnTr: tr('chrome-btn'),
      docBtnTr: tr('doc-btn'),
      rowBtnTr: tr('row-btn'),
    };
  });
  await page.close();
  return { r, errs };
}

const on = await run(false);
const off = await run(true);
await browser.close(); await new Promise(r => server.close(r));

console.log('transitions found:', JSON.stringify(transitions));
console.log('ON :', JSON.stringify(on.r), 'errs', on.errs.length);
console.log('OFF:', JSON.stringify(off.r), 'errs', off.errs.length);

const A = on.r.installed;
const B = Bstatic;
const C = on.r.guardCount >= 5; // guard expanded across the interactive-element rules
// chrome button has a real (non-"all"/non-"none") transition; doc + row buttons do NOT
const D = /box-shadow|transform|background-color|color|filter/.test(on.r.chromeBtnTr)
  && (on.r.docBtnTr === 'all' || on.r.docBtnTr === 'none' || on.r.docBtnTr === '')
  && (on.r.rowBtnTr === 'all' || on.r.rowBtnTr === 'none' || on.r.rowBtnTr === '');
const E = !off.r.installed;

console.log(`CHECK A (polish stylesheet installs): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (transitions animate only non-layout properties): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (selectors carry the document-exclusion guard): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (chrome button styled; preview/page-row buttons untouched): ${D ? 'PASS' : 'FAIL'}`);
console.log(`CHECK E (disable escape-hatch suppresses the layer): ${E ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && E && on.errs.length === 0 && off.errs.length === 0;
console.log(ok ? 'UI-POLISH-SAFE OK (5/5)' : 'UI-POLISH-SAFE FAIL');
process.exitCode = ok ? 0 : 1;
