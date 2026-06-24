/* UNIT — FND-LEAK-001 (owner 2026-06-24): the Foundation per-paragraph controls
 * (page/fit/enhance/CJLR) must NOT attach to fields inside the Review & Edit data
 * modal — only in the editor. A field matching the "professionally" context
 * outside the modal still gets the control; an equivalent field inside the modal
 * does not.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-foundation-controls-327.js'), 'utf8');
const PAGE = `<!doctype html><html><body>
  <div id="editor"><div>Professionally</div><textarea id="ed-field"></textarea></div>
  <div data-antcv-review-modal="1"><div>Professionally</div><textarea id="modal-field"></textarea></div>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(200);
await page.evaluate(() => { try { window.AntcvFoundationControls327 && window.AntcvFoundationControls327.run(); } catch (_) {} });
await page.waitForTimeout(400);

const r = await page.evaluate(() => {
  const modal = document.querySelector('[data-antcv-review-modal]');
  const editor = document.getElementById('editor');
  return {
    inEditor: !!editor.querySelector('[data-antcv-fnd-row="professionally"]'),
    inModal: !!modal.querySelector('[data-antcv-fnd-row]'),
  };
});
console.log(JSON.stringify(r));
const pass = r.inEditor === true && r.inModal === false;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
