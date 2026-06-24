/* UNIT — the Interests sub-block reads + edits a rich_block ({b,t}) section (e.g.
 * Gabriel's interests), with full add/edit/delete control, preserving the {b,t}
 * shape (no {l,v} collision/duplication). Owner 2026-06-24.
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
  { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'rich_block', items: [
    { b: 'Rugby & inclusive sport', t: 'Team operations, coach assist, literally a team player' },
    { b: 'Tai-chi', t: 'Stability and calm under pressure' },
    { b: 'Supervision', t: 'Handling three feline strategic napping experts (cats)' },
  ] },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1300 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate((s) => { localStorage.setItem('sections', JSON.stringify(s)); localStorage.setItem('personalInfo', JSON.stringify({ name: 'Gabriel' })); }, SECTIONS);
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(150);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(150);
// expand CV sidebar content -> Additional info
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const g = [...m.querySelectorAll('button')].find(b => /CV sidebar content/.test(b.textContent || '')); if (g) g.click(); });
await page.waitForTimeout(120);
await page.evaluate(() => { const m = document.querySelector('[data-antcv-review-modal]'); const h = [...m.querySelectorAll('button')].find(b => /Additional info/.test(b.textContent || '')); if (h) h.click(); });
await page.waitForTimeout(150);

const r = await page.evaluate(() => {
  const m = document.querySelector('[data-antcv-review-modal]');
  const heading = [...m.querySelectorAll('div')].find(d => d.children.length === 0 && /^🎯\s*Interests$/.test((d.textContent || '').trim()));
  const wrap = heading ? heading.parentElement : null;
  const inputs = wrap ? [...wrap.querySelectorAll('input')] : [];
  const vals = inputs.map(i => i.value);
  // edit the Tai-chi value, then confirm it persists as {b,t} (rich_block shape)
  let persistedRich = false, noLvCollision = false;
  const target = inputs.find(i => i.value === 'Stability and calm under pressure');
  if (target) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(target, 'Stability and calm (edited)'); target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('blur', { bubbles: true }));
    try {
      const s = JSON.parse(localStorage.getItem('sections'));
      const sec = s.cv.find(x => x.id === 'interests');
      persistedRich = sec.items.some(it => it.b === 'Tai-chi' && /edited/.test(it.t || ''));
      noLvCollision = !sec.items.some(it => 'l' in it || 'v' in it); // no {l,v} rows mixed in
    } catch (_) {}
  }
  return {
    showsRugby: vals.includes('Rugby & inclusive sport'),
    showsCats: vals.some(v => /feline strategic napping/.test(v)),
    rowCount: vals.filter((_, i) => i % 2 === 0).length,
    persistedRich, noLvCollision,
  };
});
console.log(JSON.stringify(r, null, 1));
const pass = r.showsRugby && r.showsCats && r.rowCount === 3 && r.persistedRich && r.noLvCollision;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
