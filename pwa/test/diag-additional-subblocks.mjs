/* UNIT — PERSONAL-MERGE-4: Languages / Interests / Accessibility render as
 * sub-blocks INSIDE the Additional-info card, editing sections.cv[{id}]. Languages
 * SEEDS once from personalInfo.languages only when its section is empty (the
 * section wins otherwise). Drives the real openReview() over seeded stores.
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
  { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Rugby', v: 'team operations' }] },
  { id: 'accessibility', title: 'ACCESSIBILITY', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Accessibility', v: 'hearing-impaired, not limiting' }] },
], cl: [] };
const PI = { name: 'Gabriel', additional: [{ l: 'Driving', v: 'Cat B' }], languages: [{ lang: 'English', level: 'native' }, { lang: 'Danish', level: 'B1', note: 'Prøve i dansk 2' }] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1100 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate(({ s, pi }) => { localStorage.setItem('sections', JSON.stringify(s)); localStorage.setItem('personalInfo', JSON.stringify(pi)); }, { s: SECTIONS, pi: PI });
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(200);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(200);

// Expand the Additional info card.
// CV sidebar content is collapsed by default — expand it to reach Additional info.
await page.evaluate(() => { const modal = document.querySelector('[data-antcv-review-modal]'); const g = [...modal.querySelectorAll('button')].find(b => /CV sidebar content/.test(b.textContent || '')); if (g) g.click(); });
await page.waitForTimeout(150);
await page.evaluate(() => { const modal = document.querySelector('[data-antcv-review-modal]'); const h = [...modal.querySelectorAll('button')].find(b => /Additional info/.test(b.textContent || '')); if (h) h.click(); });
await page.waitForTimeout(200);

const r = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const addHdr = [...modal.querySelectorAll('button')].find(b => /Additional info/.test(b.textContent || ''));
  const card = addHdr ? addHdr.parentElement : null;
  const t = card ? (card.textContent || '') : '';
  const vals = card ? [...card.querySelectorAll('input')].map(i => i.value) : [];
  const noStandaloneLang = ![...modal.querySelectorAll('button')].some(b => { const c = b.firstElementChild; return c && /^[▸▾]$/.test((c.textContent || '').trim()) && b.children.length >= 2 && /^[▸▾]\s*🗣️\s*Languages$/.test((b.textContent || '').replace(/\s+/g, ' ').trim()); });
  // sections store reflects the languages seed
  let langSection = null, piLangMirror = false;
  try {
    const s = JSON.parse(localStorage.getItem('sections') || '{}'); langSection = (s.cv || []).find(x => x && x.id === 'languages') || null;
    const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
    const secRows = (langSection && langSection.items || []).filter(r => r && !('group' in r));
    piLangMirror = Array.isArray(pi.languages) && pi.languages.length === secRows.length &&
      pi.languages.every((l, i) => l.lang === secRows[i].l && l.level === secRows[i].v);
  } catch (_) {}
  return {
    addCard: !!card,
    hasLangBlock: /🗣️\s*Languages/.test(t), hasInterestsBlock: /🎯\s*Interests/.test(t), hasAccessBlock: /♿\s*Accessibility/.test(t),
    hasProjectsBlock: /💻\s*Software projects/.test(t),
    hasPubProfile: /Publication entries/.test(modal.textContent || '') && /Profile link/.test(modal.textContent || ''),
    seedEnglish: vals.includes('English'), seedDanish: vals.includes('Danish'),
    interestRugby: vals.includes('Rugby'), accessHearing: vals.some(v => /hearing-impaired/.test(v)),
    langSectionSeeded: !!(langSection && Array.isArray(langSection.items) && langSection.items.some(i => i.l === 'English') && langSection.items.some(i => i.l === 'Danish')),
    noStandaloneLangCard: noStandaloneLang,
    piLangMirror: piLangMirror,
  };
});

// Edit a Languages row value -> persists to sections.cv.languages.
const edited = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const addHdr = [...modal.querySelectorAll('button')].find(b => /Additional info/.test(b.textContent || ''));
  const card = addHdr.parentElement;
  const inputs = [...card.querySelectorAll('input')];
  // find the value input whose sibling label input == 'English'
  let target = null;
  for (const inp of inputs) { if (inp.value === 'English' && inp.nextElementSibling && inp.nextElementSibling.tagName === 'INPUT') { target = inp.nextElementSibling; break; } }
  if (!target) return { ok: false };
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(target, 'native (edited)'); target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('blur', { bubbles: true }));
  try { const s = JSON.parse(localStorage.getItem('sections') || '{}'); const ls = (s.cv || []).find(x => x.id === 'languages'); return { ok: true, persisted: !!(ls && ls.items.some(i => i.l === 'English' && /edited/.test(i.v))) }; } catch (_) { return { ok: true, persisted: false }; }
});

console.log(JSON.stringify(r, null, 1));
console.log('EDIT:', JSON.stringify(edited));
const pass = r.addCard && r.hasLangBlock && r.hasInterestsBlock && r.hasAccessBlock &&
  r.hasProjectsBlock && r.hasPubProfile &&
  r.seedEnglish && r.seedDanish && r.interestRugby && r.accessHearing &&
  r.langSectionSeeded && r.noStandaloneLangCard && r.piLangMirror && edited.ok && edited.persisted;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
