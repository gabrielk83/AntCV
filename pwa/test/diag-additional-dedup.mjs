/* UNIT — Additional-info de-duplication (owner 2026-06-24). Languages/Interests/
 * Accessibility are shown+edited ONLY in their sub-blocks; the native Additional
 * editor hides the duplicate, kept as a tagged (__sub) hidden mirror in
 * personalInfo.additional, added/removed with the sub-block item. Imported
 * interests (personalInfo.interests) seed the Interests sub-block.
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
  { id: 'languages', title: 'LANGUAGES', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'English', v: 'native' }, { l: 'Danish', v: 'B1' }] },
], cl: [] };
// personalInfo.additional carries a LEGACY visible language dup (English) + a real row (Driving).
// personalInfo.interests is imported data the Interests sub-block should seed from.
const PI = { name: 'Gabriel', additional: [{ l: 'English', v: 'native' }, { l: 'Driving', v: 'Cat B' }], interests: ['Rugby', 'Tai-chi'], accessibility: 'Hearing-impaired, not limiting' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1200 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate(({ s, pi }) => { localStorage.setItem('sections', JSON.stringify(s)); localStorage.setItem('personalInfo', JSON.stringify(pi)); }, { s: SECTIONS, pi: PI });
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(150);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(200);
// CV sidebar content is collapsed by default — expand it to reach Additional info.
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const g = [...m.querySelectorAll('button')].find(b => /CV sidebar content/.test(b.textContent || '')); if (g) g.click(); });
await page.waitForTimeout(150);
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const h = [...m.querySelectorAll('button')].find(b => /Additional info/.test(b.textContent || '')); if (h) h.click(); });
await page.waitForTimeout(200);

const r = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const hdr = [...m.querySelectorAll('button')].find(b => /Additional info/.test(b.textContent || ''));
  const card = hdr.parentElement;
  const vals = [...card.querySelectorAll('input')].map(i => i.value);
  const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
  const add = Array.isArray(pi.additional) ? pi.additional : [];
  const sec = JSON.parse(localStorage.getItem('sections') || '{}');
  const interestsSec = (sec.cv || []).find(x => x.id === 'interests');
  return {
    // 'Driving' (real) shows; 'English' visible row is gone (deduped)
    showsDriving: vals.includes('Driving'),
    englishVisibleGone: add.filter(o => !o.__sub && o.l === 'English').length === 0,
    englishTaggedDup: add.some(o => o.__sub === 'languages' && o.l === 'English'),
    danishTaggedDup: add.some(o => o.__sub === 'languages' && o.l === 'Danish'),
    // interests seeded from personalInfo.interests into the section + tagged mirror
    interestsSeeded: !!(interestsSec && interestsSec.items.some(i => i.l === 'Rugby') && interestsSec.items.some(i => i.l === 'Tai-chi')),
    interestsShowsRugby: vals.includes('Rugby'),
    interestsTagged: add.some(o => o.__sub === 'interests' && o.l === 'Rugby'),
    accessibilitySeeded: add.some(o => o.__sub === 'accessibility' && /Hearing-impaired/.test(o.v || '')),
  };
});

// Add a language in the Languages sub-block → a new tagged mirror appears.
const added = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const heading = [...m.querySelectorAll('div')].find(d => d.children.length === 0 && /^🗣️\s*Languages$/.test((d.textContent || '').trim()));
  const wrap = heading ? heading.parentElement : null;
  const addBtn = wrap ? [...wrap.querySelectorAll('button')].find(b => /\+ row/.test(b.textContent || '')) : null;
  if (!addBtn) return { ok: false, reason: 'no add btn' };
  addBtn.click();
  const inputs = [...wrap.querySelectorAll('input')];
  if (inputs.length < 2) return { ok: false, reason: 'no inputs' };
  const last = inputs[inputs.length - 2]; // the new row's label input (value field is last)
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(last, 'Spanish'); last.dispatchEvent(new Event('input', { bubbles: true })); last.dispatchEvent(new Event('blur', { bubbles: true }));
  const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
  return { ok: true, spanishTagged: (pi.additional || []).some(o => o.__sub === 'languages' && o.l === 'Spanish') };
});

console.log(JSON.stringify(r, null, 1));
console.log('ADD:', JSON.stringify(added));
const pass = r.showsDriving && r.englishVisibleGone && r.englishTaggedDup && r.danishTaggedDup &&
  r.interestsSeeded && r.interestsShowsRugby && r.interestsTagged && r.accessibilitySeeded &&
  added.ok && added.spanishTagged;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
