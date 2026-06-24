/* UNIT — PERSONAL-MERGE-2: modal sections are collapsed by default and expand on
 * click; work-history roles collapse bullets/outcomes behind a per-role caret.
 * Drives the real openReview() against seeded personalInfo; no app boot/gate.
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

const PI = {
  name: 'Gabriel', headline: 'IT pro', email: 'g@e.com', background: 'bg',
  experience: [
    { id: 'r1', title: 'PdM', company: 'Acme', years: '2020-22', bullets: ['a', 'b'], outcomes: ['x'] },
    { id: 'r2', title: 'BA', company: 'Beta', years: '2018-20', bullets: ['c'], outcomes: ['y'] },
  ],
  tools: [{ l: 'Lang', v: 'JS' }], languages: [{ lang: 'English', level: 'native' }],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate((pi) => { localStorage.setItem('personalInfo', JSON.stringify(pi)); }, PI);
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(200);
await page.evaluate(() => window.AntcvReviewData && window.AntcvReviewData());
await page.waitForTimeout(200);

const r = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  if (!modal) return { modalPresent: false };
  const headers = [...modal.querySelectorAll('button')].filter(b => {
    const c = b.firstElementChild; return c && /^[▸▾]$/.test((c.textContent || '').trim());
  });
  const sectionHeaders = headers.filter(b => b.children.length >= 2); // caret + title span
  const initialAllCollapsed = sectionHeaders.every(b => {
    const inner = b.nextElementSibling; return inner && getComputedStyle(inner).display === 'none';
  });
  // expand the first section
  const first = sectionHeaders[0], innerFirst = first.nextElementSibling;
  first.click();
  const firstExpands = getComputedStyle(innerFirst).display !== 'none' && (first.firstElementChild.textContent.trim() === '▾');
  // expand Work history, then confirm role bullets stay hidden behind role caret
  const wh = sectionHeaders.find(b => /Work history/.test(b.textContent || ''));
  let roleDetailHidden = null, roleCaretCount = 0;
  if (wh) {
    wh.click();
    const sec = wh.parentElement;
    const roleCarets = [...sec.querySelectorAll('button')].filter(b => b.children.length === 0 && /^[▸▾]$/.test((b.textContent || '').trim()));
    roleCaretCount = roleCarets.length;
    const tas = [...sec.querySelectorAll('textarea')];
    roleDetailHidden = tas.length > 0 && tas.every(t => t.offsetParent === null);
  }
  return { modalPresent: true, sectionCount: sectionHeaders.length, initialAllCollapsed, firstExpands, roleCaretCount, roleDetailHidden };
});
console.log(JSON.stringify(r, null, 1));
const pass = r.modalPresent && r.sectionCount >= 6 && r.initialAllCollapsed &&
  r.firstExpands && r.roleCaretCount === 2 && r.roleDetailHidden === true;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
