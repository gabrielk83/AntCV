// AntCV performance-QA harness — companion to scripts/browser-qa.mjs (which
// covers functional behaviour) and scripts/bundle-size-report.mjs (which
// covers static bundle size). This one drives a real browser and reports
// timing metrics; nothing here asserts pass/fail on product behaviour.
//
//   node scripts/perf-qa.mjs                          # against production
//   node scripts/perf-qa.mjs --url http://localhost:8788
//   node scripts/perf-qa.mjs --headed
//   node scripts/perf-qa.mjs --throttle                # Slow-4G + 4x CPU (chromium only)
//
// Covers the first two rows of the perf review's "recommended performance
// test suite" (cold load / warm load) plus a slow-network/CPU variant.
// Generate-CV / Export-PDF / Export-DOCX / provider-timeout scenarios need a
// live backend (LLM proxy + DOCX worker) and real credentials, so they are
// out of scope for a zero-config script — see docs/qa/last-perf-qa.json's
// `notCovered` field for what's deliberately left to manual/staging QA.
//
// Metrics per run:
//   - navigation timing: domContentLoaded, load (from the Navigation Timing
//     API, `performance.timing`/`getEntriesByType('navigation')`)
//   - a Time-to-Interactive PROXY: elapsed time until window.AntcvReactIslands
//     is defined AND mountAll() has run (the earliest point the always-visible
//     islands are usable) — a real TTI needs long-task + input-latency
//     tracing that's overkill for a repeatable script; this proxy is cheap
//     and directly reflects PERF-ISLANDS-SPLIT-001's bundle-size work.
//   - per-resource transfer size for every .js/.css request (from the
//     Resource Timing API), so cold vs warm cache behaviour is visible
//     (PERF-SW-CACHE-001 — cache-first for versioned assets should show
//     near-zero transferSize on the warm run for every antcv-*.js?v=… hit).
//
// Zero install in this repo by default — Playwright is loaded dynamically,
// same convention as browser-qa.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const REPORT = join(ROOT, 'docs', 'qa', 'last-perf-qa.json');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const baseUrl = String(arg('url', 'https://antcv.pages.dev')).replace(/\/$/, '');
const headed = !!arg('headed', false);
const throttle = !!arg('throttle', false);

async function collectResourceTimings(page) {
  return page.evaluate(() =>
    performance.getEntriesByType('resource')
      .filter((e) => /\.(js|css)(\?|$)/.test(e.name))
      .map((e) => ({
        name: e.name.replace(location.origin + '/', ''),
        transferSize: e.transferSize ?? null,
        durationMs: Math.round(e.duration),
      })));
}

async function collectNavTiming(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return null;
    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
      loadEventMs: Math.round(nav.loadEventEnd),
      responseEndMs: Math.round(nav.responseEnd),
    };
  });
}

// TTI proxy: poll until the core islands bundle has booted, or time out.
async function waitForIslandsBoot(page, timeoutMs = 15000) {
  const start = Date.now();
  try {
    await page.waitForFunction(
      () => !!(window.AntcvReactIslands && window.__antcvReactIslandsBooted),
      { timeout: timeoutMs },
    );
    return Date.now() - start;
  } catch {
    return null; // didn't boot within the window — recorded as null, not a thrown failure
  }
}

async function runLoad(page, label) {
  const navStart = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const domContentLoadedWallMs = Date.now() - navStart;
  const islandsBootMs = await waitForIslandsBoot(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  const loadWallMs = Date.now() - navStart;

  const [navTiming, resources] = await Promise.all([
    collectNavTiming(page),
    collectResourceTimings(page),
  ]);

  const jsResources = resources.filter((r) => /\.js(\?|$)/.test(r.name));
  const totalTransfer = jsResources.reduce((s, r) => s + (r.transferSize || 0), 0);
  const zeroTransferCount = jsResources.filter((r) => r.transferSize === 0).length;

  console.log(`\n[${label}] domContentLoaded (wall): ${domContentLoadedWallMs}ms | islands-boot proxy: `
    + `${islandsBootMs === null ? 'TIMEOUT' : islandsBootMs + 'ms'} | full load (wall): ${loadWallMs}ms`);
  console.log(`[${label}] ${jsResources.length} JS resources, ${(totalTransfer / 1024).toFixed(1)}KB transferred, `
    + `${zeroTransferCount} served from cache (transferSize=0)`);

  return {
    label,
    domContentLoadedWallMs,
    islandsBootMs,
    loadWallMs,
    navTiming,
    jsResourceCount: jsResources.length,
    jsTransferBytes: totalTransfer,
    jsCacheHitCount: zeroTransferCount,
  };
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      '\nPlaywright is not installed. One-time setup:\n'
      + '  npm i -D playwright && npx playwright install chromium\n',
    );
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: !headed });
  // Fresh context per run = no HTTP cache yet → first navigation is "cold".
  const context = await browser.newContext();
  const page = await context.newPage();

  if (throttle) {
    const cdp = await context.newCDPSession(page);
    // Slow 4G profile (Lighthouse's default "Slow 4G" preset) + 4x CPU
    // slowdown — the review's "Slow 4G and CPU-throttled browser" scenario.
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
      latency: 400,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    console.log('Throttling: Slow 4G (400Kbps/400ms latency) + 4x CPU slowdown');
  }

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const cold = await runLoad(page, 'cold');
  const warm = await runLoad(page, 'warm');

  await browser.close();

  const report = {
    baseUrl,
    throttled: throttle,
    ranAt: new Date().toISOString(),
    runs: { cold, warm },
    pageErrors: errors.slice(0, 10),
    notCovered: [
      'Generate CV from a Job Description (needs live LLM proxy + credentials)',
      'Switch design package / switch writing style (needs an authenticated, seeded session)',
      'Export PDF / Export DOCX (needs live docx-worker)',
      'Replay sidecar with 200 steps (no such panel exists yet — see PERF task notes)',
      'Provider timeout and fallback scenarios (needs live LLM proxy + fault injection)',
    ],
  };

  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`\nFull report → ${REPORT.replace(ROOT + '/', '')}`);

  if (errors.length) {
    console.log(`\n${errors.length} page error(s) during the run (see report) — not a scored failure, informational only.`);
  }
}

main();
