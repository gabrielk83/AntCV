// AntCV repeatable browser-QA harness.
//
//   node scripts/browser-qa.mjs                         # run against production
//   node scripts/browser-qa.mjs --url http://localhost:8788
//   node scripts/browser-qa.mjs --headed                # watch it drive
//   node scripts/browser-qa.mjs --only palette-mix       # one check
//   node scripts/browser-qa.mjs --jwt "<token>"          # enable auth-gated checks
//
// Drives a real browser with Playwright, seeds the Anita persona +
// known-bad state into localStorage, reloads, and asserts the behaviour
// the bug tracker says is "live-verification owed". Each check writes a
// screenshot to docs/qa/screenshots/ and the run writes a JSON report to
// docs/qa/last-browser-qa.json. Exit code is non-zero if any check fails,
// so it drops straight into a pre-push hook or CI.
//
// Zero install in this repo by default — Playwright is loaded dynamically.
// First-time setup (one machine):
//   npm i -D playwright && npx playwright install chromium
//
// Adding a check: push to CHECKS below. A check is
//   { id, desc, auth?:true, run: async (page, ctx) => ({ pass, detail }) }
// `ctx` gives { baseUrl, persona, seed(state), screenshot(name) }.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SHOT_DIR = join(ROOT, 'docs', 'qa', 'screenshots');
const REPORT = join(ROOT, 'docs', 'qa', 'last-browser-qa.json');

// ── args ───────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const baseUrl = String(arg('url', 'https://antcv.pages.dev')).replace(/\/$/, '');
const headed = !!arg('headed', false);
const only = arg('only', null);
const jwt = arg('jwt', process.env.ANTCV_QA_JWT || null);

// ── persona ──────────────────────────────────────────────────────────────────
const persona = JSON.parse(
  readFileSync(join(ROOT, 'docs', 'personas', 'anita', 'personalInfo.json'), 'utf8')
);

// ── the checks ─────────────────────────────────────────────────────────────
// Registry id scheme (packages/registry.json). app.js legacy aliases that must
// NOT survive a reload are the orphans: stylePackage "scandinavian",
// toneRegister "scandinavian".
const REGISTRY_PACKAGE_IDS = new Set([
  'copenhagen-modern', 'navy-executive', 'warm-terracotta', 'nordic-frost',
  'pampas-contemporary', 'tokyo-precision', 'delhi-technical', 'custom',
]);

const CHECKS = [
  {
    id: 'boot',
    desc: 'App boots with the persona loaded; no uncaught console errors',
    async run(page, ctx) {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await ctx.seed({ personalInfo: JSON.stringify(persona) });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await ctx.screenshot('boot');
      // Filter noise: 3rd-party + favicon + known benign network aborts.
      const real = errors.filter((e) =>
        !/favicon|net::ERR_|Failed to load resource|the server responded/i.test(e));
      return { pass: real.length === 0, detail: real.slice(0, 5) };
    },
  },
  {
    id: 'debug-logger',
    desc: 'antcv-debug-logger — window.AntcvDebug present, captures an error to '
        + 'localStorage synchronously, and the viewer overlay opens.',
    async run(page, ctx) {
      await ctx.seed({ personalInfo: JSON.stringify(persona) });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const out = await page.evaluate(() => {
        const present = !!(window.AntcvDebug && typeof window.AntcvDebug.open === 'function');
        // Synthetic error event — caught by the logger's capture-phase listener.
        try {
          window.dispatchEvent(new ErrorEvent('error', {
            message: '__antcv_qa_probe__', error: new Error('__antcv_qa_probe__'),
          }));
        } catch (e) {}
        let logged = false;
        try {
          const raw = localStorage.getItem('antcv:debug:log') || '[]';
          logged = JSON.parse(raw).some((e) => (e.message || '').includes('__antcv_qa_probe__'));
        } catch (e) {}
        let opened = false;
        try { window.AntcvDebug.open(); opened = !!document.querySelector('[data-antcv-debug-panel]'); } catch (e) {}
        return { present, logged, opened };
      });
      await ctx.screenshot('debug-logger');
      return { pass: !!(out.present && out.logged && out.opened), detail: out };
    },
  },
  {
    id: 'palette-mix',
    desc: 'PACKAGE-PALETTE-MIX-001 — orphan "scandinavian" must resolve to a '
        + 'registry package id on reload; localStorage.stylePackage and '
        + 'body[data-package] must agree (no black-mix render).',
    async run(page, ctx) {
      // Seed the returning-user orphan exactly as the bug describes.
      await ctx.seed({
        personalInfo: JSON.stringify(persona),
        stylePackage: 'scandinavian',
        toneRegister: 'scandinavian',
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      const state = await page.evaluate(() => ({
        ls: localStorage.getItem('stylePackage'),
        tone: localStorage.getItem('toneRegister'),
        dataPkg: document.body?.getAttribute('data-package') || null,
      }));
      await ctx.screenshot('palette-mix');
      const lsResolved = state.ls && REGISTRY_PACKAGE_IDS.has(state.ls);
      const agree = state.ls === state.dataPkg;
      const toneResolved = state.tone && state.tone !== 'scandinavian';
      return {
        pass: !!(lsResolved && agree && toneResolved),
        detail: {
          stylePackage: state.ls,
          dataPackage: state.dataPkg,
          toneRegister: state.tone,
          lsResolved, dataPackageAgrees: agree, toneResolved,
          note: lsResolved && agree
            ? 'persisted id unified — APPJS-ID-SCHEME-UNIFY appears LANDED'
            : 'persisted id still orphan — bug OPEN (render-time mitigation only)',
        },
      };
    },
  },
  {
    id: 'demo-config',
    desc: 'DEMO-PERSIST-001 — /config reports user_mode/demo_mode for the signed-in '
        + 'account (auth-gated).',
    auth: true,
    async run(page, ctx) {
      const cfg = await page.evaluate(async () => {
        try {
          const r = await fetch('/config', { credentials: 'include' });
          return { status: r.status, body: await r.json() };
        } catch (e) { return { error: String(e) }; }
      });
      return {
        pass: cfg.body && typeof cfg.body.demo_mode === 'boolean',
        detail: {
          status: cfg.status,
          user_mode: cfg.body?.user_mode,
          demo_mode: cfg.body?.demo_mode,
          note: 'A demo account must read demo_mode:true. paid+demo_mode:false '
              + 'for a demo user == DEMO-PERSIST-001 still OPEN.',
        },
      };
    },
  },
  {
    id: 'demo-mode-roundtrip',
    desc: 'DEMO-PERSIST-001 — POST /api/user/mode {demo} then GET must read back '
        + 'demo (auth-gated; proves the write path, not an allowlist pin).',
    auth: true,
    async run(page, ctx) {
      const out = await page.evaluate(async () => {
        const post = await fetch('/api/user/mode', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'demo' }),
        });
        const postBody = await post.json().catch(() => ({}));
        const get = await fetch('/api/user/mode', { credentials: 'include' });
        const getBody = await get.json().catch(() => ({}));
        return { postStatus: post.status, postBody, getStatus: get.status, getBody };
      });
      return {
        pass: out.postStatus === 200 && out.getBody?.mode === 'demo',
        detail: out,
      };
    },
  },
];

// ── runner ───────────────────────────────────────────────────────────────────
async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      '\nPlaywright is not installed. One-time setup:\n'
      + '  npm i -D playwright && npx playwright install chromium\n'
      + '\nThe QA flows are already written in scripts/browser-qa.mjs — this only\n'
      + 'installs the browser driver.\n'
    );
    process.exit(2);
  }

  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext();
  if (jwt) {
    // Inject the auth cookie/header the relay expects. antcv-auth.js reads a
    // bearer; we set it as a cookie the page bootstrap promotes, and also add
    // an Authorization header on same-origin requests.
    await context.setExtraHTTPHeaders({ Authorization: `Bearer ${jwt}` });
  }
  const page = await context.newPage();

  const ctx = {
    baseUrl,
    persona,
    async seed(state) {
      // Navigate first so localStorage is same-origin, then set + ready for reload.
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.evaluate((kv) => {
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
      }, state);
    },
    async screenshot(name) {
      await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: false });
    },
  };

  const selected = CHECKS.filter((c) => (only ? c.id === only : true));
  const results = [];
  for (const c of selected) {
    if (c.auth && !jwt) {
      results.push({ id: c.id, skipped: true, reason: 'auth-gated; pass --jwt to run' });
      console.log(`SKIP  ${c.id} — needs --jwt`);
      continue;
    }
    process.stdout.write(`RUN   ${c.id} … `);
    try {
      const r = await c.run(page, ctx);
      results.push({ id: c.id, desc: c.desc, ...r });
      console.log(r.pass ? 'PASS' : 'FAIL');
      if (!r.pass) console.log('      ' + JSON.stringify(r.detail));
    } catch (e) {
      results.push({ id: c.id, pass: false, error: String(e) });
      console.log('ERROR\n      ' + String(e));
    }
  }

  await browser.close();

  const report = { baseUrl, ranAt: new Date().toISOString(), results };
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  const ran = results.filter((r) => !r.skipped);
  const failed = ran.filter((r) => !r.pass);
  console.log(`\n${ran.length - failed.length}/${ran.length} passed `
    + `(${results.length - ran.length} skipped). Report → docs/qa/last-browser-qa.json`);
  process.exit(failed.length ? 1 : 0);
}

main();
