/* DIAGNOSTIC — CPH-HEADER-BAND-OVERFLOW-STORM-001 (regression repro).
 *
 * The Copenhagen Stage-3 header band (default ON, kill: antcv:copenhagen-v2=0)
 * introduced a RUNAWAY layout-growth loop in the CV preview: the single page-
 * row's usable height climbs ~15px on EVERY measure cycle without bound
 * (usablePx 1053 -> 1608+ in 9s), even though totalMainPx / rows are constant
 * and the verdict is 'fits'. Each new height is a new signature, so
 * antcv-main-overflow-detect-364.js re-writes localStorage['antcv:mainOverflow']
 * ~4x/second forever, and the preview reflows continuously (main-thread churn).
 * The osc-damp in 364 only catches a two-state A,B,A,B flip — a monotone climb
 * slips past it. The grower is the antcv-sidebar-fill-equalize-227 / page-fit
 * chain: with the band present, mainH drifts up each cycle so the equalize
 * idempotency guard (data-antcv-eq-h === mainH) never holds.
 *
 * Bisect (headless, this harness): converged (1 write) at 1.51.1972 /
 * c77e38f2; runaway (35 writes) at c336c5a5 (Stage 3 header band, 1.51.3061).
 * Kill switch antcv:copenhagen-v2=0 restores convergence (1 write) on HEAD.
 *
 * PASS = the CV preview settles: <= 6 antcv:mainOverflow writes over 9s AND the
 * usable-page-height is stable (last - first <= 8px). Any monotone climb FAILs.
 * This asserts BOTH the default-ON path and the kill-switch path converge.
 * Run: node pwa/test/diag-copenhagen-overflow-storm.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end('e'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function run(killSwitch) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await page.addInitScript((kill) => {
    try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
    localStorage.setItem('antcv:disable-loading-gate', '1');
    if (kill) localStorage.setItem('antcv:copenhagen-v2', '0');
    localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
    localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    const mk = (id, t, loc, content) => ({ id, title: t, loc, on: true, type: 'text', content });
    localStorage.setItem('sections', JSON.stringify({ cv: [
      mk('profile', 'PROFILE', 'main', 'Senior PdM with 12y experience across products and platforms. '.repeat(6)),
      mk('exp', 'EXPERIENCE', 'main', 'Led cross-functional teams. Shipped multiple products. '.repeat(20)),
      mk('tools', 'TOOLS', 'sidebar', 'Jira, Figma, SQL, Python, Tableau, Amplitude'),
      mk('edu', 'EDUCATION', 'sidebar', 'MSc, BSc'),
      mk('lang', 'LANGUAGES', 'sidebar', 'English, Hebrew, Spanish, Danish'),
    ], cl: [] }));
    localStorage.setItem('personalInfo', JSON.stringify({ name: 'Diag Rich', specialization: 'Products • Platforms • People', wizardCompleted: true }));
    localStorage.setItem('meta', JSON.stringify({ company: 'Diag Co', role: 'Diag Role' }));
    localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
    window.__mo_writes = [];
    const _si = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'antcv:mainOverflow') { try { window.__mo_writes.push(JSON.parse(v)); } catch (_) {} } return _si.call(this, k, v); };
  }, killSwitch);
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
  await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(9000);
  const w = await page.evaluate(() => window.__mo_writes || []);
  await page.close();
  const u = w.map(s => s.usablePx).filter(n => typeof n === 'number');
  const drift = u.length ? (u[u.length - 1] - u[0]) : 0;
  return { writes: w.length, drift, errs: errs.length };
}

const onDefault = await run(false);
const onKill = await run(true);
console.log(`copenhagen ON (default): writes=${onDefault.writes} usablePx-drift=${onDefault.drift}px errors=${onDefault.errs}`);
console.log(`copenhagen OFF (kill=antcv:copenhagen-v2=0): writes=${onKill.writes} usablePx-drift=${onKill.drift}px errors=${onKill.errs}`);

const settled = (r) => r.writes <= 6 && Math.abs(r.drift) <= 8 && r.errs === 0;
const pass = settled(onDefault) && settled(onKill);
console.log(pass
  ? 'DIAG PASS — CV preview converges with the Copenhagen band ON and OFF'
  : 'DIAG FAIL — CPH-HEADER-BAND-OVERFLOW-STORM-001: the Copenhagen band drives a runaway main-overflow write storm (see writes/drift above)');
process.exitCode = pass ? 0 : 1;
await browser.close(); server.close();
