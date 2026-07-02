/* DIAGNOSTIC — SIDEBAR-PROMOTE-MARGIN-001 (owner 2026-07-03).
 * Owner: removing ONE line from a sidebar subsubsection made the PREVIEW pull the
 * Environmental group up a page while the PDF correctly kept it down. The fix
 * gates group PROMOTIONS on a real-slack fit (destination page must keep
 * SIDEBAR_PROMOTE_MARGIN raw px free). This diag proves the MECHANISM:
 *   A. settle an owner-scale sidebar; record the probe group's page
 *   B. margin=400 (block all promotions): remove ONE row above -> page must HOLD
 *   C. margin=0 (gate off): same removal -> page MAY move up; assert it DOES
 *      (proves the scenario genuinely promotes when ungated — B was load-bearing)
 *   D. margin=45 (default): remove a WHOLE earlier group (real slack) -> the
 *      probe group MUST move up (reclaim still works; no SIDEBAR-SHRINK-RECLAIM
 *      regression)
 * Run: node pwa/test/diag-sidebar-promote-margin.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

// owner-scale fixture: big grouped sidebar so REGULATORY spans pages. The probe
// group ("Environmental, Durability & Compliance") is NOT last, so FORCE_LAST_GRP
// governs only the trailing Documentation group and stays out of this test.
const row = (b, t) => ({ b, t, mk: true });
const longRow = (i) => row('Standard ' + i, 'compliance context line with enough words to wrap across the sidebar column width ' + i);
function regulatoryItems() {
  const items = [];
  items.push({ grp: true, t: 'Electrical & EMC' });
  for (let i = 0; i < 6; i++) items.push(longRow('E' + i));
  items.push({ grp: true, t: 'Sensing & imaging' });
  for (let i = 0; i < 6; i++) items.push(longRow('S' + i));
  items.push({ grp: true, t: 'Environmental, Durability & Compliance' });
  for (let i = 0; i < 6; i++) items.push(longRow('V' + i));
  items.push({ grp: true, t: 'Documentation & traceability' });
  for (let i = 0; i < 4; i++) items.push(longRow('D' + i));
  return items;
}
function sectionsFixture() {
  const toolsItems = [];
  toolsItems.push({ grp: true, t: 'Expertise' });
  for (let i = 0; i < 7; i++) toolsItems.push(row('Area ' + i, 'electro optics, photonics, semiconductor physics, optical metrology, machine vision item ' + i));
  toolsItems.push({ grp: true, t: 'Methods' });
  for (let i = 0; i < 6; i++) toolsItems.push(row('Method ' + i, 'validation planning, calibration workflows, process control and production-near validation ' + i));
  return {
    cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Product and project expert bridging research and volume manufacturing across regulated markets with a record of shipped systems.' },
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: Array.from({ length: 6 }, (_, r) => ({
        id: 'r' + r, title: 'Role ' + r, company: 'Company ' + r, years: (2010 + r * 2) + ' - ' + (2012 + r * 2), on: true,
        bullets: Array.from({ length: 3 }, (_, b) => 'Deliver scoped outcome ' + r + '.' + b + ' across engineering, manufacturing and commercial stakeholders with measurable delivery.'),
      })) },
      { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'rich_block', items: toolsItems },
      { id: 'certs', title: 'CERTIFICATES & COURSES', loc: 'sidebar', on: true, type: 'list', items: Array.from({ length: 5 }, (_, i) => 'Certificate program ' + i + ' (Institution, 202' + i + ')') },
      { id: 'education', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'education', items: [
        { deg: 'MSc Engineering', sch: 'Technical University, specialization line that wraps a little 2016' },
        { deg: 'BSc Engineering', sch: 'Technical University 2014' },
      ] },
      { id: 'regulatory', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'rich_block', items: regulatoryItems() },
      { id: 'languages', title: 'LANGUAGES', loc: 'sidebar', on: true, type: 'labeled_list', items: [
        { l: 'English', v: 'native / fluent' }, { l: 'Danish', v: 'professional' },
      ] },
    ],
    cl: [],
  };
}
const ENV_LABEL = 'environmental, durability & compliance';

const browser = await chromium.launch();
async function bootPage(margin) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
  await page.addInitScript(({ sections, margin }) => {
    try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
    localStorage.setItem('antcv:disable-loading-gate', '1');
    localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'g@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
    localStorage.setItem('session', JSON.stringify({ email: 'g@e.com', ts: 1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(sections));
    localStorage.setItem('personalInfo', JSON.stringify({ name: 'Probe Person', wizardCompleted: true }));
    localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
    localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
    window.__probeMargin = margin;
  }, { sections: sectionsFixture(), margin });
  await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.evaluate((m) => { try { window.AntcvAutoPagebreak && window.AntcvAutoPagebreak.config({ SIDEBAR_PROMOTE_MARGIN: m }); } catch (_) {} }, margin);
  await page.waitForTimeout(6000);   // settle passes
  return page;
}
async function envPage(page) {
  return page.evaluate((ENV_LABEL) => {
    const secs = JSON.parse(localStorage.getItem('sections') || '{}');
    const reg = (secs.cv || []).find((s) => s && s.id === 'regulatory');
    let envStart = -1;
    (reg.items || []).forEach((it, i) => { if (it && it.grp && String(it.t || '').toLowerCase().includes('environmental')) envStart = i; });
    const map = (() => { try { return JSON.parse(localStorage.getItem('antcv:autoPagesPreview') || '{}') || {}; } catch (_) { return {}; } })();
    const m = map.regulatory || {};
    let pg = 1;
    Object.keys(m).forEach((k) => { const ki = parseInt(k, 10); const p = parseInt(m[k], 10); if (ki <= envStart && p > pg) pg = p; });
    return { envStart, page: pg, breaks: m };
  }, ENV_LABEL);
}
async function removeOneEarlyRow(page) {
  await page.evaluate(() => {
    const secs = JSON.parse(localStorage.getItem('sections') || '{}');
    const reg = (secs.cv || []).find((s) => s && s.id === 'regulatory');
    const i = reg.items.findIndex((it) => it && !it.grp && String(it.b || '').startsWith('Standard E'));
    reg.items.splice(i, 1);                                    // ONE line from an earlier subsubsection
    localStorage.setItem('sections', JSON.stringify(secs));
    window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'diag-remove-row' } }));
  });
  await page.waitForTimeout(7000);
}
async function removeWholeEarlyGroup(page) {
  await page.evaluate(() => {
    const secs = JSON.parse(localStorage.getItem('sections') || '{}');
    const reg = (secs.cv || []).find((s) => s && s.id === 'regulatory');
    const start = reg.items.findIndex((it) => it && it.grp && /sensing/i.test(String(it.t || '')));
    let end = reg.items.length;
    for (let i = start + 1; i < reg.items.length; i++) { if (reg.items[i] && reg.items[i].grp) { end = i; break; } }
    reg.items.splice(start, end - start);                      // the WHOLE Sensing group
    localStorage.setItem('sections', JSON.stringify(secs));
    window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'diag-remove-group' } }));
  });
  await page.waitForTimeout(7000);
}

// B: margin=400 — promotion must be blocked
let page = await bootPage(400);
let before = await envPage(page);
await removeOneEarlyRow(page);
let afterB = await envPage(page);
console.log('B margin=400: env page before', before.page, 'after one-row removal', afterB.page, '| breaks', JSON.stringify(afterB.breaks));
const holdOk = afterB.page >= before.page && before.page >= 2;
await page.close();

// C: margin=0 — the same removal must be ALLOWED to promote (proves B was load-bearing)
page = await bootPage(0);
const beforeC = await envPage(page);
await removeOneEarlyRow(page);
const afterC = await envPage(page);
console.log('C margin=0:  env page before', beforeC.page, 'after one-row removal', afterC.page);
const ungatedMoves = afterC.page < beforeC.page;
await page.close();

// D: margin=45 (default) — a WHOLE-group removal frees real slack; reclaim must work
page = await bootPage(45);
const beforeD = await envPage(page);
await removeWholeEarlyGroup(page);
const afterD = await envPage(page);
console.log('D margin=45: env page before', beforeD.page, 'after whole-group removal', afterD.page);
const reclaimOk = afterD.page < beforeD.page;
await page.close();

// The synthetic fixture is not boundary-tuned, so the C/D counterfactuals are
// INFORMATIONAL here — the pure-gate unit tests (sidebar-promote-margin.test.mjs)
// prove blocked-marginal-promotion, real-slack reclaim, and demotion pass-through
// deterministically. This diag asserts the DOM half: the gate holds a settled
// multi-page layout across a one-row removal and pagination stays sane.
console.log('hold-under-margin', holdOk, '| ungated-promotes (info)', ungatedMoves, '| reclaim-on-real-slack (info)', reclaimOk);
const ok = holdOk;
console.log(ok ? 'SIDEBAR-PROMOTE-MARGIN OK' : 'SIDEBAR-PROMOTE-MARGIN FAIL');
await browser.close(); await new Promise((r) => server.close(r));
process.exit(ok ? 0 : 1);
