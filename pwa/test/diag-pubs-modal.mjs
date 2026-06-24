/* UNIT — the modal Publications section (owner 2026-06-24) edits the publication
 * ENTRIES (sections.cv.pubs.items) plus the profile link; and the CV sidebar
 * content group is collapsible, collapsed by default.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-data-export-360.js'), 'utf8');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = { cv: [
  { id: 'pubs', title: 'PUBLICATIONS', loc: 'main', on: true, type: 'list_italic', richPub: true, items: ['First paper — Journal, 2020', 'Second paper — Conf, 2021'] },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1200 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate((s) => { localStorage.setItem('sections', JSON.stringify(s)); localStorage.setItem('personalInfo', JSON.stringify({ name: 'Gabriel' })); }, SECTIONS);
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(150);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(150);

// CV sidebar content collapsed by default?
const collapse = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const g = [...m.querySelectorAll('button')].find(b => /CV sidebar content/.test(b.textContent || ''));
  if (!g) return { present: false };
  const inner = g.nextElementSibling;
  return { present: true, collapsedByDefault: inner && getComputedStyle(inner).display === 'none', caret: (g.firstElementChild.textContent || '').trim() };
});

// Expand Publications section + verify entries render + edit persists.
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const h = [...m.querySelectorAll('button')].find(b => /^[▸▾]\s*🔗\s*Publications$/.test((b.textContent || '').replace(/\s+/g, ' ').trim())); if (h) h.click(); });
await page.waitForTimeout(150);
const pubs = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const hdr = [...m.querySelectorAll('button')].find(b => /🔗\s*Publications$/.test((b.textContent || '').replace(/\s+/g, ' ').trim()));
  const card = hdr ? hdr.parentElement : null;
  const inputs = card ? [...card.querySelectorAll('input')] : [];
  const vals = inputs.map(i => i.value);
  const showsEntry = vals.some(v => /First paper/.test(v));
  // edit the first entry -> persists to sections.cv.pubs.items
  let persisted = false;
  const target = inputs.find(i => /First paper/.test(i.value));
  if (target) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(target, 'First paper (edited) — Journal, 2020'); target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('blur', { bubbles: true }));
    try { const s = JSON.parse(localStorage.getItem('sections')); const sec = s.cv.find(x => x.id === 'pubs'); persisted = sec.items.some(it => /edited/.test(String(it))); } catch (_) {}
  }
  const hasProfileLink = /Profile link/.test(card ? card.textContent || '' : '');
  const phs = inputs.map(i => i.placeholder);
  const splitFields = ['Title', 'Authors', 'Journal / publisher', 'Year', 'Pages'].every(ph => phs.includes(ph));
  return { cardPresent: !!card, showsEntry, persisted, hasProfileLink, splitFields };
});

console.log('COLLAPSE:', JSON.stringify(collapse));
console.log('PUBS:', JSON.stringify(pubs));
const pass = collapse.present && collapse.collapsedByDefault && collapse.caret === '▸' &&
  pubs.cardPresent && pubs.showsEntry && pubs.persisted && pubs.hasProfileLink && pubs.splitFields;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
