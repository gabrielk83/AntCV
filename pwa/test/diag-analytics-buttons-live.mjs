/* DIAGNOSTIC — ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 (row 24). Desktop-only, live.
 * Loads https://antcv.pages.dev signed in with the saved owner JWT (~/.antcv/token),
 * opens Settings and clicks the three admin analytics buttons (Export JSON, Export CSV,
 * View summary). All three are GETs; nothing is written. PASS when every analytics call
 * returns 200, no "session expired" alert fires, the token survives and the page does not
 * reload into the sign-in gate (the original bug: 401 -> token wipe -> login reboot).
 * Run: node pwa/test/diag-analytics-buttons-live.mjs   (exit 4 = no token, 1 = FAIL) */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOKEN_FILE = process.env.ANTCV_TOKEN_FILE || path.join(os.homedir(), '.antcv', 'token');
if (!existsSync(TOKEN_FILE)) { console.log('SKIP - no token file'); process.exit(4); }
const token = readFileSync(TOKEN_FILE, 'utf8').trim();
let claims = {};
try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch {}
const email = claims.email || claims.sub || '';
const exp = claims.exp ? claims.exp * 1000 : Date.now() + 864e5;
if (!email || exp < Date.now()) { console.log('SKIP - token unreadable or expired'); process.exit(4); }

const URL = process.env.ANTCV_URL || 'https://antcv.pages.dev/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(([t, e, x]) => {
  if (!sessionStorage.getItem('__diag_seeded')) {
    localStorage.setItem('antcv:auth:token', t);
    localStorage.setItem('antcv:auth:email', e);
    localStorage.setItem('antcv:auth:expires_at', String(x));
    localStorage.setItem('antcv:disable-loading-gate', '1');
    sessionStorage.setItem('__diag_seeded', '1');
  }
}, [token, email, exp]);
const page = await ctx.newPage();
const calls = [], alerts = [], errs = [], navs = [];
page.on('response', r => { if (/\/analytics\//.test(r.url())) calls.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), status: r.status() }); });
const reqs = [];
page.on('request', r => { if (/\/analytics\//.test(r.url())) reqs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, '') }); });
page.on('requestfailed', r => { if (/\/analytics\//.test(r.url())) reqs.push({ failed: r.url().replace(/^https?:\/\/[^/]+/, ''), why: r.failure() && r.failure().errorText }); });
page.on('dialog', d => { alerts.push(d.message()); d.dismiss().catch(() => {}); });
page.on('pageerror', e => errs.push(e.message));
page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
page.on('download', d => d.cancel().catch(() => {}));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(6000);
const navsAtBoot = navs.length;

const opened = await page.evaluate(() => {
  if (typeof window._antcvOpenSettingsRoute === 'function') { window._antcvOpenSettingsRoute(); return 'route'; }
  const b = [...document.querySelectorAll('button')].find(x => /⚙|settings/i.test((x.textContent || '') + (x.title || '') + (x.getAttribute('aria-label') || '')));
  if (b) { b.click(); return 'click'; }
  return null;
});
await page.waitForTimeout(1500);

// the export calls are slow (~35 s for the JSON sessions view); wait for each answer
const URLS = { 'Export JSON': /analytics\/export\?format=json/, 'Export CSV': /analytics\/export\?format=csv/, 'View summary': /analytics\/summary/ };
const timings = {};
async function clickLabel(label) {
  for (let i = 0; i < 2; i++) {
    const btn = page.locator('button', { hasText: label }).first();
    if (await btn.count()) {
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      const t0 = Date.now();
      const resp = page.waitForResponse(r => URLS[label].test(r.url()), { timeout: 120000 }).catch(() => null);
      await btn.click({ timeout: 10000 }).catch(e => errs.push(label + ': ' + e.message.split('\n')[0]));
      const r = await resp;
      timings[label] = r ? Date.now() - t0 : null;
      await page.waitForTimeout(1500);
      return true;
    }
    // the analytics block sits behind the Admin mode, maybe on a sub-tab
    for (const tab of ['Admin', 'Analytics']) {
      const t = page.getByRole('button', { name: tab, exact: true }).first();
      if (await t.count()) { await t.click().catch(() => {}); await page.waitForTimeout(600); }
    }
  }
  return false;
}
const found = {};
for (const l of ['Export JSON', 'Export CSV', 'View summary']) found[l] = await clickLabel(l);

const after = await page.evaluate(() => ({
  token: !!localStorage.getItem('antcv:auth:token'),
  gate: !!document.querySelector('input[type=email]') && /sign in/i.test(document.body.innerText),
}));
await browser.close();

const expired = alerts.filter(a => /session expired/i.test(a));
const bad = calls.filter(c => c.status !== 200);
const ok = opened && Object.values(found).every(Boolean) && calls.length >= 3 && !bad.length &&
  !expired.length && after.token && !after.gate && navs.length === navsAtBoot;
console.log(JSON.stringify({ opened, found, timings, reqs, calls, alerts: alerts.map(a => a.slice(0, 80)), navsAfterBoot: navs.length - navsAtBoot, after, pageErrors: errs.slice(0, 5) }, null, 1));
console.log(ok ? 'PASS - three analytics buttons answered 200, session kept' : 'FAIL');
process.exit(ok ? 0 : 1);
