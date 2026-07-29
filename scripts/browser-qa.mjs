// AntCV repeatable browser-QA harness.
//
//   node scripts/browser-qa.mjs                         # run against production
//   node scripts/browser-qa.mjs --url http://localhost:8788
//   node scripts/browser-qa.mjs --headed                # watch it drive
//   node scripts/browser-qa.mjs --only palette-mix       # one check
//   node scripts/browser-qa.mjs --jwt "<token>"          # enable auth-gated checks
//
// Drives a real (desktop) browser with Playwright, seeds the Anita persona +
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
// Checks live in scripts/qa-checks.mjs and are shared with scripts/phone-qa.mjs
// (same assertions, driven on a real Android phone over adb instead).
// Adding a check: push to CHECKS there. A check is
//   { id, desc, auth?:true, run: async (page, ctx) => ({ pass, detail }) }
// `ctx` gives { baseUrl, persona, seed(state), screenshot(name) }.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { persona, runChecks } from './qa-checks.mjs';

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

// ── runner ───────────────────────────────────────────────────────────────────
async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      '\nPlaywright is not installed. One-time setup:\n'
      + '  npm i -D playwright && npx playwright install chromium\n'
      + '\nThe QA flows are already written in scripts/qa-checks.mjs — this only\n'
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

  const results = await runChecks(page, ctx, { only, jwt });

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
