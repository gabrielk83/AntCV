#!/usr/bin/env node
// diag-live-guard-sidecars.mjs — LIVE production attest for the shipped Band A-D guard sidecars.
//
// Why this exists: rows 38 / 39a / 40 / 41 / 42 / 43 / 44 / 34 are all "SHIPPED, owner-verify
// owed". CI can only prove the code sits in the REPO. This proves, against the deployed PWA,
// that each guard
//   (a) has a <script> the live index.html actually served,
//   (b) really executed (its global is on window),
//   (c) is BYTE-IDENTICAL to the repo file (EOL-normalized) - not a stale CDN/SW copy.
// (c) is the part a repo-side test can never give: it closes the "src edited but ?v stale ->
// phantom ship" class ([[stale-sw-version-mask-hazard]], [[appjs-appsrc-contribute-divergence]])
// on the real deploy.
//
// EOL note: a Windows checkout holds CRLF while Pages serves LF, so identity is compared after
// normalizing \r\n -> \n. Raw byte length is reported too, so a real content drift still shows.
//
// Usage: node pwa/test/diag-live-guard-sidecars.mjs [--url https://antcv.pages.dev]
// Exit 0 = every target served + executed + content-identical.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..');
const urlArg = process.argv.indexOf('--url');
const BASE = urlArg > -1 ? process.argv[urlArg + 1] : 'https://antcv.pages.dev';

// register row -> the sidecar that carries its fix, and the global that proves it executed
const TARGETS = [
  { row: '38',  id: 'GEN-BACKGROUND-001 memo',   file: 'antcv-gen-memo.js',                     global: 'AntcvGenMemo' },
  { row: '38',  id: 'GEN-BACKGROUND-001 job',    file: 'antcv-gen-job-client.js',               global: 'AntcvGenJob' },
  { row: '39a', id: 'PTR-STALE-GUARD-001',       file: 'antcv-pointer-stale-guard.js',          global: 'AntcvPointerStaleGuard' },
  { row: '40',  id: 'SO-003 outcomes loss-guard', file: 'antcv-outcomes-loss-guard.js',         global: 'AntcvOutcomesGuard' },
  { row: '41',  id: 'SO-004 #185 capture probe', file: 'antcv-debug-logger.js',                 global: 'AntcvDebug' },
  { row: '42',  id: 'GEN-LANGFAB-001',           file: 'antcv-lang-fabrication-guard.js',       global: 'AntcvLangFabricationGuard' },
  { row: '43',  id: 'CA-006 path-C guard',       file: 'antcv-candidate-preview-editor-341.js', global: null },
  { row: '44',  id: 'JD-ANALYSIS-PRINT-001',     file: 'antcv-analysis-report-pdf-360.js',      global: null },
  { row: '34',  id: 'ROLE-MERGE-STORED-001',     file: 'antcv-role-merge-stored.js',            global: 'AntcvRoleMergeStored' },
];

const norm = (s) => s.replace(/\r\n/g, '\n');

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
// heavy bundle (Babel + ~90 sidecars): give the tail of the script list time to execute
await page.waitForTimeout(20000);

const liveVersion = await page.evaluate(() => window.ANTCV_VERSION || null);
const scriptSrcs = await page.evaluate(() => [...document.scripts].map((s) => s.src));

const rows = [];
for (const t of TARGETS) {
  const src = scriptSrcs.find((s) => s.includes('/' + t.file));
  const globalOk = t.global ? await page.evaluate((g) => typeof window[g] !== 'undefined', t.global) : null;
  let same = null; let liveLen = null; let repoLen = null;
  if (src) {
    const r = await page.evaluate(async (u) => {
      try { const res = await fetch(u, { cache: 'no-store' }); return { status: res.status, txt: await res.text() }; }
      catch (e) { return { error: String(e) }; }
    }, src);
    if (r.error) { same = 'fetch-error'; }
    else {
      const repo = readFileSync(join(PWA, t.file), 'utf8');
      liveLen = r.txt.length; repoLen = repo.length;
      same = norm(repo) === norm(r.txt);
    }
  }
  rows.push({ ...t, served: !!src, v: src ? (src.split('?v=')[1] || '(none)') : null, globalOk, same, liveLen, repoLen });
}

await browser.close();

console.log('LIVE ' + BASE + '   ANTCV_VERSION=' + liveVersion);
console.log('row  guard                          served  global  identical  liveChars/repoChars  ?v');
let fails = 0;
for (const r of rows) {
  const bad = !r.served || r.same !== true || r.globalOk === false;
  if (bad) fails++;
  console.log([
    String(r.row).padEnd(4), r.id.padEnd(30),
    (r.served ? 'YES' : 'NO ').padEnd(6),
    String(r.globalOk === null ? 'n/a' : r.globalOk).padEnd(6),
    String(r.same).padEnd(9),
    (r.liveLen + '/' + r.repoLen).padEnd(19),
    String(r.v), bad ? '  <-- FAIL' : '',
  ].join(' '));
}
console.log('\nconsole errors on boot: ' + consoleErrors.length + ' (401s are expected with no auth session)');
consoleErrors.slice(0, 8).forEach((e) => console.log('  ! ' + e));
console.log(fails === 0
  ? '\nPASS - all ' + rows.length + ' live guard sidecars served, executed and content-identical to repo'
  : '\nFAIL - ' + fails + ' target(s)');
process.exit(fails === 0 ? 0 : 1);
