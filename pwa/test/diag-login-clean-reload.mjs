/* DIAGNOSTIC — antcv-login-clean-reload-375 (owner 2026-06-10). After a hard
 * reset + sign-in, stale demo/setup notices + the previous user's subtitle
 * persisted until manual refresh because sign-IN doesn't reload. This sidecar
 * does a single guarded reload on a real login/user-switch. Asserts:
 *   A. the already-logged-in baseline at load does NOT reload
 *   B. a fresh login (new email) reloads exactly once
 *   C. a repeat notification for the same email does NOT reload again
 *   D. a user switch (different email) reloads once more
 *   E. sign-out (email '') then re-login reloads again (baseline reset)
 *   F. disable hatch suppresses everything
 * Run: node test/diag-login-clean-reload.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = await readFile(path.join(ROOT, 'antcv-login-clean-reload-375.js'), 'utf8');

const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<script>
  // Minimal AntcvAuth stub with a subscribe() that emits on _emit().
  window.AntcvAuth = {
    _subs: [], _state: { email: 'baseline@x.com' },
    subscribe: function (fn) { this._subs.push(fn); try { fn(this._state); } catch (e) {} return function () {}; },
    _emit: function (email) { this._state = { email: email }; this._subs.forEach(function (f) { f({ email: email }); }); },
  };
</script>
<script>${SRC}</script>
<script>
  // Spy on the reload (don't actually navigate). When the sidecar is disabled
  // it never defines AntcvLoginCleanReload, so guard the assignment.
  window.__reloads = 0;
  if (window.AntcvLoginCleanReload) window.AntcvLoginCleanReload._doReload = function () { window.__reloads++; };
</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();

async function run(disable) {
  const page = await browser.newPage();
  if (disable) await page.addInitScript(() => localStorage.setItem('antcv:disable-login-reload', '1'));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(150);
  const steps = await page.evaluate(() => {
    const A = window.AntcvAuth;
    const snap = () => window.__reloads;
    const out = {};
    out.afterBaseline = snap();             // A: baseline already emitted at subscribe
    A._emit('newuser@x.com'); out.afterLogin = snap();        // B
    A._emit('newuser@x.com'); out.afterRepeat = snap();       // C
    A._emit('other@y.com');   out.afterSwitch = snap();       // D
    A._emit('');              // sign out
    A._emit('newuser@x.com'); out.afterReLogin = snap();      // E
    return out;
  });
  await page.close();
  return { steps, errs };
}

const on = await run(false);
const off = await run(true);
await browser.close(); await new Promise(r => server.close(r));

console.log('ON :', JSON.stringify(on.steps), 'errs', on.errs.length);
console.log('OFF:', JSON.stringify(off.steps));

const A = on.steps.afterBaseline === 0;
const B = on.steps.afterLogin === 1;
const C = on.steps.afterRepeat === 1;
const D = on.steps.afterSwitch === 2;
const E = on.steps.afterReLogin === 3;
const F = off.steps.afterLogin === 0 && off.steps.afterSwitch === 0 && off.steps.afterReLogin === 0;

console.log(`CHECK A (baseline logged-in does NOT reload): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (fresh login reloads once): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (repeat same email: no extra reload): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (user switch reloads once more): ${D ? 'PASS' : 'FAIL'}`);
console.log(`CHECK E (sign-out then re-login reloads again): ${E ? 'PASS' : 'FAIL'}`);
console.log(`CHECK F (disable hatch makes it inert): ${F ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && E && F && on.errs.length === 0 && off.errs.length === 0;
console.log(ok ? 'LOGIN-CLEAN-RELOAD OK (6/6)' : 'LOGIN-CLEAN-RELOAD FAIL');
process.exitCode = ok ? 0 : 1;
