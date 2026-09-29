/* DIAGNOSTIC — SETTINGS-PERSONAL-STABILIZE-001 (row 17, STANDING).
 *
 * What the two existing probes leave uncovered is the ADVANCED subtab.
 * diag-personal-panel-probe.mjs clicks PERSONAL only; diag-settings-panels-probe.mjs
 * covers Personal / Account / Layout and deliberately anchors on the standard-tier
 * subtab strip, which Advanced sits outside of. Row 17's open half names Advanced,
 * so it was the one panel never measured.
 *
 * This probe takes any subtab: it opens the gear, clicks the named tab, anchors on
 * the settings modal root (the smallest element containing the whole subtab strip,
 * so no per-panel text anchor is needed), and counts DOM mutations inside it over 8s
 * at rest, plus page errors. It reports a per-tab fingerprint so four identical
 * zeroes cannot hide four measurements of the same default panel.
 *
 *   node pwa/test/diag-settings-panel-churn.mjs                 # all four tabs
 *   node pwa/test/diag-settings-panel-churn.mjs --tab Layout    # one tab
 *   node pwa/test/diag-settings-panel-churn.mjs --budget 40     # override the cap
 *   node pwa/test/diag-settings-panel-churn.mjs --selftest      # NEGATIVE CONTROL
 *
 * --selftest exists because a probe that anchors on the wrong element, or whose
 * observer never attaches, reports a clean 0 exactly like a healthy panel. It ticks
 * a synthetic attribute write into the anchored root and MUST report roughly
 * WATCH_MS/100 mutations and exit non-zero; a 0 there means the probe is lying, not
 * that the panel is at rest.
 *
 * PASS = every measured tab at/below the churn budget with zero page errors.
 * A panel at rest should be near-silent; a sweep-army writer shows as hundreds or
 * thousands of repeated attribute/text mutations, and the per-key breakdown names
 * the writer's element chain.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ONE = arg('--tab', null);
const TABS = ONE ? [ONE] : ['Personal', 'Layout', 'Account', 'Advanced'];
const BUDGET = Number(arg('--budget', '5'));
const SELFTEST = process.argv.indexOf('--selftest') > -1;
const WATCH_MS = 8000;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end('e'); }
});
await new Promise((r) => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();

const results = [];
for (const tab of TABS) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e && e.message)));
  await page.addInitScript(() => {
    try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
    localStorage.setItem('antcv:disable-loading-gate', '1');
    localStorage.setItem('antcv:auth:token', 't');
    localStorage.setItem('antcv:auth:email', 'demo@e.com');
    localStorage.setItem('antcv:auth:expires_at', '4102444800');
    localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify({ cv: [{ id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' }], cl: [] }));
    localStorage.setItem('personalInfo', JSON.stringify({ name: 'Diag', wizardCompleted: true }));
    localStorage.setItem('meta', JSON.stringify({ company: 'Diag Co', role: 'Diag Role' }));
    localStorage.setItem('language', JSON.stringify('en'));
    localStorage.setItem('wizardCompleted', JSON.stringify(true));
  });
  await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  // open Settings — node click, not a Playwright locator: the gear's emoji carries a
  // variation selector that defeats text matching and the re-rendering toolbar fails
  // actionability waits (DIAG-PROBE-NO-META-001).
  const gearOk = await page.evaluate(() => {
    const gear = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').indexOf('⚙') !== -1);
    if (!gear) return false;
    gear.click();
    return true;
  });
  await page.waitForTimeout(1500);

  const start = await page.evaluate((wanted) => {
    const LABELS = ['Personal', 'Layout', 'Account', 'Advanced'];
    const leaf = Array.from(document.querySelectorAll('button,[role="tab"],a,span,div'))
      .find((e) => e.children.length === 0 && (e.textContent || '').trim() === wanted);
    if (leaf) (leaf.closest('button,[role="tab"],a') || leaf).click();
    let root = null;
    for (const el of Array.from(document.querySelectorAll('div,section'))) {
      const txt = el.textContent || '';
      if (LABELS.every((l) => txt.indexOf(l) !== -1)) {
        if (!root || txt.length < (root.textContent || '').length) root = el;
      }
    }
    if (!root) return { clicked: !!leaf, foundRoot: false };
    window.__diagRoot = root;
    window.__mkObs = function () {
      window.__pm = 0;
      window.__samples = {};
      const mo = new MutationObserver((recs) => {
        window.__pm += recs.length;
        recs.forEach((x) => {
          const chain = [];
          let n = x.target.nodeType === 1 ? x.target : x.target.parentElement;
          for (let d = 0; n && d < 4; d++, n = n.parentElement) {
            chain.push(n.tagName + (n.dataset ? Object.keys(n.dataset).slice(0, 2).join(',') : ''));
          }
          const added = (x.addedNodes && x.addedNodes[0])
            ? String(x.addedNodes[0].textContent || x.addedNodes[0].nodeName).slice(0, 40) : '';
          const key = x.type + '|' + (x.attributeName || '') + '|' + chain.join('>') + '|' + added;
          window.__samples[key] = (window.__samples[key] || 0) + 1;
        });
      });
      mo.observe(root, { subtree: true, childList: true, attributes: true });
      window.__tick = function () {
        let i = 0;
        setInterval(() => { root.setAttribute('data-diag-tick', String(++i)); }, 100);
      };
      return true;
    };
    return { clicked: !!leaf, foundRoot: true, rootChars: (root.textContent || '').length };
  }, tab);

  // Proof the subtab actually switched: a failed click would silently re-measure the
  // default panel four times and report four identical, meaningless 0s. The root's
  // character count is the cheapest per-panel fingerprint.
  const fp = await page.evaluate(() => {
    const r = window.__diagRoot;
    if (!r) return { chars: 0, connected: false };
    return { chars: (r.textContent || '').length, connected: !!r.isConnected };
  });
  const fingerprint = fp.chars;

  if (!start.foundRoot) {
    console.log('[' + tab + '] FAIL — settings modal never opened (gear=' + gearOk + ' subtab-clicked=' + start.clicked + ')');
    results.push({ tab, ok: false, why: 'modal-not-open', n: null, errs: errs.length });
    await page.close();
    continue;
  }
  // let the tab switch settle, then start counting
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__mkObs && window.__mkObs());
  if (SELFTEST) await page.evaluate(() => window.__tick && window.__tick());
  await page.waitForTimeout(WATCH_MS);

  const churn = await page.evaluate(() => ({
    n: window.__pm || 0,
    top: Object.entries(window.__samples || {}).sort((a, b) => b[1] - a[1]).slice(0, 10),
  }));
  // A detached root would report a serene 0 while the real panel churned elsewhere.
  const ok = churn.n <= BUDGET && errs.length === 0 && fp.connected;
  results.push({ tab, ok, n: churn.n, top: churn.top, errs: errs.length, clicked: start.clicked, fp: fingerprint, connected: fp.connected });
  console.log('[' + tab + '] mutations/' + (WATCH_MS / 1000) + 's = ' + churn.n
    + '   pageErrors = ' + errs.length + '   subtabClicked = ' + start.clicked
    + '   panelChars = ' + fingerprint + '   rootInDoc = ' + fp.connected
    + '   ' + (ok ? 'at rest' : 'CHURN'));
  churn.top.forEach((e) => console.log('    ' + e[1] + '  ' + e[0]));
  errs.slice(0, 2).forEach((e) => console.log('    ! ' + e));
  await page.close();
}

await browser.close();
server.close();

console.log('\n--- summary (budget ' + BUDGET + ' mutations / ' + (WATCH_MS / 1000) + 's) ---');
results.forEach((r) => console.log('  ' + String(r.tab).padEnd(10)
  + String(r.n === null ? r.why : r.n).padEnd(8) + (r.ok ? 'PASS' : 'FAIL')));
const fps = results.filter((r) => r.fp).map((r) => r.fp);
const distinct = new Set(fps).size;
if (TABS.length > 1) {
  console.log('distinct panel fingerprints: ' + distinct + ' of ' + fps.length
    + (distinct < fps.length ? '  <-- some subtabs rendered identical content' : ''));
}
const bad = results.filter((r) => !r.ok);
if (SELFTEST) {
  // negative control: the synthetic ticker must be SEEN, otherwise the 0s above mean
  // "probe blind", not "panel at rest".
  const floor = (WATCH_MS / 100) * 0.5;
  const blind = results.filter((r) => !(r.n > floor));
  console.log('\nSELFTEST — expect > ' + floor + ' mutations per tab (synthetic ticker)');
  console.log(blind.length === 0
    ? 'SELFTEST PASS — the probe sees injected churn on every tab (its 0s are real)'
    : 'SELFTEST FAIL — probe blind on: ' + blind.map((b) => b.tab + '(' + b.n + ')').join(', '));
  process.exit(blind.length === 0 ? 0 : 1);
}
console.log(bad.length === 0
  ? '\nDIAG PASS — every measured Settings panel is at rest'
  : '\nDIAG FAIL — ' + bad.map((b) => b.tab).join(', '));
process.exit(bad.length === 0 ? 0 : 1);
