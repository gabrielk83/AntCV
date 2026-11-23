/* DIAGNOSTIC - JD-REMOVE-STICKY-001 end to end (register row 83, JD-REMOVE-OWNER-VERIFY-001).
 *
 * The unit test runs the tombstone predicate in isolation. This one boots the real
 * bundle on the upload screen against a MOCKED relay (no network, no account) whose
 * /api/prefs returns a targeted active_application, and drives the owner's steps:
 *   A. cold restore seeds the JD chip;
 *   B. "Remove" -> the chip goes away, the auto-sync window passes, -> refresh ->
 *      the JD stays removed (twice), the cloud row's jd_text is never blanked;
 *   C. a tracker Open/Reopen (claim the app id + stage antcv:lastJdText=jd, reload)
 *      -> the JD is re-staged and the tombstone is consumed;
 *   D. after another Remove, a DIFFERENT jd on the row seeds normally.
 * Red on 1.51.6571 (B2a-B4 both orders; A, C1, D in prefs-first), green from JD-REMOVE-STICKY-002.
 * Run:  node pwa/test/diag-jd-remove-sticky.mjs [--order=prefs-first|list-first] [--verbose]   (exit 0 = pass)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Two boot effects race (prefs restore vs application list). No --order = run both.
if (!process.argv.some((a) => a.startsWith('--order='))) {
  let bad = 0;
  for (const o of ['prefs-first', 'list-first']) {
    console.log('## ' + o);
    bad += spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--order=' + o, ...process.argv.slice(2)], { stdio: 'inherit' }).status === 0 ? 0 : 1;
  }
  process.exit(bad ? 1 : 0);
}

const VERBOSE = process.argv.includes('--verbose');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fp = path.join(ROOT, rel);
    const s = fp.startsWith(ROOT) ? await stat(fp).catch(() => null) : null;
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;

const APP_ID = 4242;
const JD_A = 'Acme Optics seeks a Senior Project Manager for hardware platforms. You will lead optical subsystem delivery, verification and supplier work. '.repeat(6).trim();
const JD_B = 'Acme Optics seeks a Verification Lead. You will own the test strategy for a camera platform and report to the head of engineering. '.repeat(6).trim();
const SECTIONS = {
  cv: [
    { id: 'name_block', title: 'NAME', loc: 'main', on: true, type: 'name_block', content: 'Anita Tester' },
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text here. '.repeat(6) },
  ],
  cl: [{ id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'Who text here. '.repeat(6) }],
};
const ORDER = process.argv.find((a) => a.startsWith('--order=')).slice(8);
const state = { jd: JD_A, writes: [] };
const row = () => ({
  id: APP_ID, jd_company: 'Acme Optics', jd_role: 'Senior Project Manager', jd_text: state.jd, category: 'product',
  cv_sections: SECTIONS.cv, cl_sections: SECTIONS.cl, meta: { company: 'Acme Optics', role: 'Senior Project Manager' },
  supporting_context: '', _pointer_device_id: null, _pointer_updated_at: null, updated_at: 1700000000,
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' });
// Relay / worker traffic is mocked or dropped; only the static CDNs (React, fonts) pass through.
await ctx.route((u) => u.origin !== origin, async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (!/^\/(api|auth)\//.test(u.pathname)) return /workers.dev$/.test(u.hostname) ? route.abort() : route.continue(); // React / fonts CDN
  if (m !== 'GET') { try { state.writes.push({ m, p: u.pathname, b: JSON.parse(req.postData() || '{}') }); } catch (_) {} }
  let body = { ok: true };
  if (u.pathname === '/api/prefs' && m === 'GET') body = { ok: true, prefs: { wizardCompleted: true, personalInfo: { name: 'Anita Tester' } }, active_application: row() };
  else if (/^\/api\/active/.test(u.pathname)) body = { ok: true, application_id: APP_ID };
  else if (u.pathname === '/api/applications') body = { ok: true, applications: [row()], application: row(), id: APP_ID };
  else if (/^\/api\/applications\/\d+/.test(u.pathname)) body = { ok: true, application: row() };
  else if (/session|me$/.test(u.pathname)) body = { ok: true, email: 'd@e.com', authenticated: true };
  if (m === 'GET') {
    const slow = ORDER === 'prefs-first' ? /^.api.(applications|active)/ : /^.api.prefs$/;
    if (slow.test(u.pathname)) await new Promise((r) => setTimeout(r, 1200));
  }
  if (VERBOSE) console.log('  api', m, u.pathname);
  return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
});
await ctx.addInitScript(() => {
  if (localStorage.getItem('__diagSeeded')) return;
  localStorage.setItem('__diagSeeded', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'd@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'd@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('upload')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'Anita Tester' }));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('aiNoticeAccepted', JSON.stringify(true));
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e && e.message)));
page.on('console', (m) => { if (VERBOSE && /restore|jd|apps\]/i.test(m.text())) console.log('  log', m.text().slice(0, 200)); });

const checks = [];
const check = (n, ok, d) => { checks.push(!!ok); console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d))}`); };
const look = () => page.evaluate((id) => {
  const raw = window.__antcvJdScopeRaw;
  const btn = [...document.querySelectorAll('button')].find((b) => /^✕ Remove$/.test((b.textContent || '').trim()));
  return {
    chip: !!btn, scope: window.AntcvJdScope && window.AntcvJdScope.getCurrentAppId(),
    tomb: localStorage.getItem('antcv:jdRemoved'), last: (localStorage.getItem('antcv:lastJdText') || '').length,
    slotApp: (raw.getItem('antcv:app:' + id + ':jdText') || '').length, slotKernel: (raw.getItem('antcv:app:kernel:jdText') || '').length,
  };
}, APP_ID);
const settle = (ms = 6000) => page.waitForTimeout(ms);
const reload = async () => { await page.reload({ waitUntil: 'load', timeout: 30000 }); await settle(); };
const remove = () => page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /^✕ Remove$/.test((x.textContent || '').trim()));
  if (b) b.click(); return !!b;
});

await page.goto(origin + '/index.html', { waitUntil: 'load', timeout: 30000 });
await settle(8000);
let s = await look(); if (VERBOSE) { console.log(s); console.log((await page.evaluate(() => document.body.innerText)).slice(0, 600)); }
check('A  cold restore seeds the JD chip', s.chip, s);

const clicked = await remove(); await page.waitForTimeout(400);
s = await look(); if (VERBOSE) console.log(s);
check('B1 Remove clears the chip and writes the tombstone', clicked && !s.chip && !!s.tomb, s);
// the owner keeps working: one edit, then let the auto-sync debounce run.
const mark = state.writes.length;
await page.evaluate(() => {
  const x = JSON.parse(localStorage.getItem('sections'));
  const p = x.cv.find((y) => y.id === 'profile'); if (p) p.content += ' Edited after Remove.';
  localStorage.setItem('sections', JSON.stringify(x));
  window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { sections: x, source: 'diag' } }));
});
await settle(9000);
const after = state.writes.slice(mark).filter((w) => /^.api.applications/.test(w.p));
if (VERBOSE) console.log('app writes after the edit', after.map((w) => w.m + ' ' + w.p + ' jd=' + ('jd_text' in w.b ? String(w.b.jd_text).length : '-') + ' edited=' + /Edited after Remove/.test(JSON.stringify(w.b))));
check('B2a no app write after Remove carries the removed JD', !after.some((w) => String(w.b.jd_text || '').trim() === JD_A), after.map((w) => w.p));
s = await look(); if (VERBOSE) console.log('after autosync window', s);
check('B2 auto-sync does not put the removed JD back in antcv:lastJdText', s.last === 0, s);
await reload();
s = await look(); if (VERBOSE) console.log(s);
check('B3 refresh: the JD stays removed', !s.chip && !!s.tomb, s);
await reload();
s = await look();
check('B4 second refresh: still removed', !s.chip && !!s.tomb, s);
const blanked = state.writes.filter((w) => w.b && 'jd_text' in w.b && !String(w.b.jd_text || '').trim());
check('B5 no request blanked the cloud jd_text', blanked.length === 0, blanked.slice(0, 2));

await page.evaluate(([id, jd]) => { window.AntcvJdScope.setCurrentAppId(String(id)); localStorage.setItem('antcv:lastJdText', jd); }, [APP_ID, JD_A]);
await reload();
s = await look(); if (VERBOSE) console.log(s);
check('C1 tracker Open/Reopen re-stages the JD', s.chip, s);
check('C2 the tombstone is consumed', !s.tomb, s);

await remove(); await page.waitForTimeout(400);
state.jd = JD_B;
await reload();
s = await look(); if (VERBOSE) console.log(s);
check('D  a different JD seeds normally after a Remove', s.chip, s);
check('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));

await browser.close(); server.close();
const ok = checks.every(Boolean);
console.log(ok ? 'JD-REMOVE-STICKY OK' : 'JD-REMOVE-STICKY FAIL');
process.exit(ok ? 0 : 1);
