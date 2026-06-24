/* UNIT — RECS in the Review & Edit panel (Part A) + recommendation-letter
 * detection in the importer (Part B). Part A drives the real openReview() over a
 * seeded recommendations section; Part B loads the importer and checks detectKind
 * routes a reference letter to the recommendation handler (the LLM extraction
 * itself needs the proxy — offline here — so only routing is asserted).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportSidecar = await readFile(path.join(ROOT, 'antcv-data-export-360.js'), 'utf8');
const importer = await readFile(path.join(ROOT, 'antcv-data-importer.js'), 'utf8');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = { cv: [
  { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'sidebar', on: true, type: 'education', items: [{ deg: 'Jane Doe, VP Engineering at Acme', sch: 'For the PdM role', gpa: 'jane@acme.com' }] },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1100 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate((s) => { localStorage.setItem('sections', JSON.stringify(s)); localStorage.setItem('personalInfo', JSON.stringify({ name: 'Gabriel' })); }, SECTIONS);
await page.addScriptTag({ content: exportSidecar });
await page.waitForTimeout(150);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(150);
// Expand the Recommendations card.
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const h = [...m.querySelectorAll('button')].find(b => /Recommendations/.test(b.textContent || '')); if (h) h.click(); });
await page.waitForTimeout(150);

const a = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const hdr = [...m.querySelectorAll('button')].find(b => /Recommendations/.test(b.textContent || ''));
  const card = hdr ? hdr.parentElement : null;
  const vals = card ? [...card.querySelectorAll('input')].map(i => i.value) : [];
  // edit the contact field of the Jane Doe row → persists to sections.cv recommendations
  let persisted = false;
  if (card) {
    const contact = [...card.querySelectorAll('input')].find(i => i.value === 'jane@acme.com');
    if (contact) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(contact, 'jane@acme.com (edited)'); contact.dispatchEvent(new Event('input', { bubbles: true })); contact.dispatchEvent(new Event('blur', { bubbles: true }));
      try { const s = JSON.parse(localStorage.getItem('sections')); const sec = s.cv.find(x => x.id === 'recommendations'); persisted = sec.items.some(it => /edited/.test(it.gpa || '')); } catch (_) {}
    }
  }
  return {
    cardPresent: !!card,
    threeFields: card ? [...card.querySelectorAll('div')].some(() => true) && vals.length >= 3 : false,
    showsRecommender: vals.includes('Jane Doe, VP Engineering at Acme'),
    showsWho: vals.includes('For the PdM role'),
    showsContact: vals.some(v => /jane@acme.com/.test(v)),
    editPersists: persisted,
  };
});

// Part B — importer detection.
await page.addScriptTag({ content: importer });
await page.waitForTimeout(150);
const b = await page.evaluate(() => {
  const I = window.AntCVImporter;
  const dk = I && I._detectKind;
  return {
    importerLoaded: !!(I && typeof dk === 'function'),
    byName: typeof dk === 'function' && dk({ name: 'recommendation-letter.pdf' }, '') === 'recommendation-doc',
    byContent: typeof dk === 'function' && dk({ name: 'scan001.pdf' }, 'To whom it may concern, I highly recommend Gabriel for the role…') === 'recommendation-doc',
    handlerWired: !!(I && I._handlerKinds && I._handlerKinds.indexOf('recommendation-doc') >= 0),
  };
});

console.log('PART A (panel):', JSON.stringify(a, null, 1));
console.log('PART B (importer):', JSON.stringify(b));
const pass = a.cardPresent && a.threeFields && a.showsRecommender && a.showsWho && a.showsContact && a.editPersists &&
  b.importerLoaded && b.byName && b.byContent && b.handlerWired;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
