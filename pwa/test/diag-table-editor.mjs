/* AntCV universal table editor diag — TABLE-TYPE-001.
 * Renders window.AntcvTableEditor (antcv-table-editor.js) with a sample table
 * section using the page's own React/ReactDOM, and asserts:
 *   (1) the editor mounts (header row + body cells as textareas, "+ Add row"),
 *   (2) the HEADER-ROW CJLR control exists and writes section.headerAlign
 *       (the regression the owner reported: header had no CJLR),
 *   (3) "+ Add row" appends a row,
 *   (4) a body-row CJLR writes section.rowAlign,
 *   (5) per-row hide writes section.hidden.
 *
 * Run:  node pwa/test/diag-table-editor.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e && e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
// wait for the sidecar + React
await page.waitForFunction(() => window.AntcvTableEditor && window.React && (window.ReactDOM), null, { timeout: 15000 }).catch(() => {});

const result = await page.evaluate(async () => {
  const R = window.React, RD = window.ReactDOM;
  if (!window.AntcvTableEditor || !R || !RD) return { fatal: 'missing React/AntcvTableEditor' };
  const updates = [];
  let section = {
    id: 'core_comp', type: 'table', title: 'CORE COMPETENCIES',
    rows: [['Focus Area', 'Strategic Expertise'], ['Systems', 'reqs, V&V'], ['Sourcing', 'feasibility']],
    hidden: [], rowAlign: [], pageBreakRows: [],
  };
  const update = (patch) => { updates.push(patch); section = Object.assign({}, section, patch); rerender(); };
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = RD.createRoot ? RD.createRoot(host) : null;
  function rerender() {
    const el = R.createElement(window.AntcvTableEditor, { section, update, accent: '#01B7BB' });
    if (root) root.render(el); else RD.render(el, host);
  }
  rerender();
  await new Promise(r => setTimeout(r, 250));

  const q = (sel) => Array.from(host.querySelectorAll(sel));
  const byTitle = (re) => q('button').find(b => re.test(b.getAttribute('title') || '') || re.test(b.textContent || ''));

  const out = {};
  out.textareas = q('textarea').length;            // 2 cols * 3 rows = 6
  out.hasHeaderBtn = !!byTitle(/Header-row alignment/i);
  out.hasAddBtn = !!byTitle(/Add row/i);

  // (2) click header CJLR → expect headerAlign patch
  const hb = byTitle(/Header-row alignment/i); if (hb) hb.click();
  await new Promise(r => setTimeout(r, 60));
  out.headerAlignPatched = updates.some(p => typeof p.headerAlign === 'string');

  // (3) + Add row
  const before = section.rows.length;
  const ab = byTitle(/Add row/i); if (ab) ab.click();
  await new Promise(r => setTimeout(r, 60));
  out.rowAdded = section.rows.length === before + 1;

  // (4) body-row CJLR (a per-row align button) → rowAlign patch
  const alignBtns = q('button').filter(b => /Alignment:/.test(b.getAttribute('title') || ''));
  if (alignBtns.length) alignBtns[alignBtns.length - 1].click();
  await new Promise(r => setTimeout(r, 60));
  out.rowAlignPatched = updates.some(p => Array.isArray(p.rowAlign));

  // (5) per-row hide → hidden patch
  const hideBtn = q('button').find(b => /Visible — hide|Hidden — show/.test(b.getAttribute('title') || ''));
  if (hideBtn) hideBtn.click();
  await new Promise(r => setTimeout(r, 60));
  out.hiddenPatched = updates.some(p => Array.isArray(p.hidden));

  return out;
});

await browser.close();
await new Promise((r) => server.close(r));

let pass = true;
function check(name, ok) { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) pass = false; }
if (result.fatal) { console.log('  ✗ fatal: ' + result.fatal); pass = false; }
else {
  check('editor mounts with 6 cell textareas (got ' + result.textareas + ')', result.textareas === 6);
  check('header-row CJLR control present', result.hasHeaderBtn);
  check('+ Add row present', result.hasAddBtn);
  check('header CJLR writes section.headerAlign', result.headerAlignPatched);
  check('+ Add row appends a row', result.rowAdded);
  check('body-row CJLR writes section.rowAlign', result.rowAlignPatched);
  check('per-row hide writes section.hidden', result.hiddenPatched);
}
check('no page errors (' + errors.length + ')', errors.length === 0);
if (errors.length) errors.slice(0, 5).forEach(e => console.log('      ' + e));
console.log(pass ? 'TABLE-EDITOR OK' : 'TABLE-EDITOR FAILED');
process.exit(pass ? 0 : 1);
