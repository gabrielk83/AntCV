/* DIAGNOSTIC — SPEC-SLOGAN-LANG-001 (owner 2026-07-13):
 * "correct this 'unsolicited' as it is language pending (should not be danish
 * if I am set to english spanish chinese etc)". The CL slogan control's input
 * PLACEHOLDER (= subtitleFallback()) read the stale kernelShowcase (raw
 * generation-language) FIRST, so a Danish triad showed on an English/Spanish/
 * Chinese app. Fix: read personalInfo.specialization first (the current-ribbon
 * store the header renders + babel-fish keeps current); reject a wrong-script
 * candidate on a non-Latin ribbon.
 *
 * Drives the REAL shipped antcv-cl-slogan-control.js: a synthetic
 * [data-antcv-cl-sig-control] anchor lets the control mount; the placeholder it
 * sets from localStorage is then read back. No app boot, no real account.
 * Run: node pwa/test/diag-slogan-placeholder-language.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-cl-slogan-control.js'), 'utf8');

const PAGE = `<!doctype html><html><body>
  <div id="layout"><div data-antcv-cl-sig-control>sig</div></div>
</body></html>`;

const DA = 'Produktstrategi | Ændringsstyring | Tværgående samarbejde';
const EN = 'Product Strategy | Change Management | Cross-functional Collaboration';
const ZH = '产品战略 | 变更管理 | 跨职能协作';

const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
let fail = 0;
const check = (ok, label, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); if (!ok) fail++; };

// Load the control fresh with a given localStorage state; return the input placeholder.
async function placeholderFor(state) {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message)));
  await page.goto(base);
  await page.evaluate((st) => {
    localStorage.clear();
    if (st.language) localStorage.setItem('language', JSON.stringify(st.language));
    if (st.personalInfo) localStorage.setItem('personalInfo', JSON.stringify(st.personalInfo));
    if (st.kernelShowcase) localStorage.setItem('kernelShowcase', JSON.stringify(st.kernelShowcase));
    if (st.meta) localStorage.setItem('meta', JSON.stringify(st.meta));
    if (st.caseMode) localStorage.setItem('antcv:clSloganCase', st.caseMode);
  }, state);
  await page.addScriptTag({ content: sidecar });
  await page.waitForTimeout(400);
  const ph = await page.evaluate(() => {
    var box = document.querySelector('[data-antcv-cl-slogan-control]');
    var inp = box && box.querySelector('input[type="text"]');
    return inp ? (inp.placeholder || '') : '__no-input__';
  });
  await page.close();
  return { ph, errs };
}

// 1 — the reported bug: EN app, personalInfo current (English), kernel stale (Danish).
var r1 = await placeholderFor({ language: 'en', personalInfo: { specialization: EN }, kernelShowcase: { subtitle: DA } });
check(/PRODUCT STRATEGY/i.test(r1.ph) && !/PRODUKTSTRATEGI/i.test(r1.ph),
  'EN app: placeholder is the English specialization, not the stale Danish kernel', r1.ph);

// 2 — Spanish app, personalInfo Spanish, kernel Danish → Spanish, not Danish.
var ES = 'Estrategia de Producto | Gestión del Cambio | Colaboración Transversal';
var r2 = await placeholderFor({ language: 'es', personalInfo: { specialization: ES }, kernelShowcase: { subtitle: DA } });
check(/ESTRATEGIA DE PRODUCTO/i.test(r2.ph) && !/PRODUKTSTRATEGI/i.test(r2.ph),
  'ES app: placeholder is the Spanish specialization, not the stale Danish kernel', r2.ph);

// 3 — Chinese app, personalInfo Chinese → Chinese shown.
var r3 = await placeholderFor({ language: 'zh', personalInfo: { specialization: ZH }, kernelShowcase: { subtitle: DA } });
check(/产品战略/.test(r3.ph), 'ZH app: placeholder is the Chinese specialization', r3.ph);

// 4 — Chinese app but personalInfo EMPTY, only a stale Danish kernel: script guard
//     must blank a Latin candidate on a CJK ribbon -> generic hint (empty fallback).
var r4 = await placeholderFor({ language: 'zh', personalInfo: {}, kernelShowcase: { subtitle: DA } });
check(!/PRODUKTSTRATEGI/i.test(r4.ph), 'ZH app: stale Latin/Danish kernel is NOT forced (script guard)', r4.ph);

// 5 — Danish app, Danish personalInfo → Danish is correct here.
var r5 = await placeholderFor({ language: 'da', personalInfo: { specialization: DA } });
check(/PRODUKTSTRATEGI/i.test(r5.ph), 'DA app: Danish specialization shows (correct for a Danish app)', r5.ph);

// 6 — targeted app (company present) still uses meta.cl_slogan, not the triad.
var r6 = await placeholderFor({ language: 'en', meta: { company: 'Acme Corp', cl_slogan: 'Bridging optics and product' }, personalInfo: { specialization: EN } });
check(/BRIDGING OPTICS/i.test(r6.ph) && !/PRODUCT STRATEGY/i.test(r6.ph),
  'targeted app: placeholder is the smart cl_slogan, not the specialization triad', r6.ph);

// 7 — SLOGAN-CASE-001 (owner 2026-11-03, CL-ACADEMY-001): sentence case is the default;
//     the placeholder keeps the stored case. CAPS mode (antcv:clSloganCase='caps') upper-cases.
check(r1.ph.indexOf('Product Strategy') >= 0, 'default case: sentence case kept (SLOGAN-CASE-001)', r1.ph);
var r7 = await placeholderFor({ language: 'en', personalInfo: { specialization: EN }, caseMode: 'caps' });
check(/PRODUCT STRATEGY/.test(r7.ph), 'caps mode: placeholder upper-cased', r7.ph);

const allErrs = [].concat(r1.errs, r2.errs, r3.errs, r4.errs, r5.errs, r6.errs, r7.errs);
check(allErrs.length === 0, 'no page errors', allErrs.slice(0, 3));

await browser.close(); server.close();
console.log(fail ? `RED — ${fail} check(s) failed` : 'GREEN — SPEC-SLOGAN-LANG-001 verified');
process.exit(fail ? 1 : 0);
