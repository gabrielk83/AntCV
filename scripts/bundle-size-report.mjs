// AntCV PWA bundle-size report.
//
//   node scripts/bundle-size-report.mjs                 # print + write report
//   node scripts/bundle-size-report.mjs --check-budget   # non-zero exit if over budget
//
// Perf review (2026-07) asked for "Measure JS bundle size and Time to
// Interactive" as the first step of the recommended performance test suite.
// This script is the bundle-size half — zero dependencies, no browser, runs
// in a few ms so it's cheap enough for every CI run. scripts/perf-qa.mjs is
// the browser-driven TTI half (cold/warm load timing).
//
// Reports gzip'd size (the number that matters for wire transfer) for every
// asset actually SHIPPED — i.e. referenced by a <script src="…">/<link
// href="…"> in pwa/index.html, plus antcv-react-islands-panels.js (loaded
// dynamically at runtime by main-core.tsx, so it has no static index.html
// tag; see src/main-core.tsx's schedulePanelsLoad()). CLAUDE.md warns that
// pwa/ carries retired sidecars still present on disk but no longer loaded
// (e.g. antcv-onboarding.js, antcv-ai-notice-stability.js) — this script
// cross-checks against index.html so the report reflects what a user's
// browser actually downloads, not everything sitting in the directory.
// Files on disk that aren't referenced anywhere are listed separately
// (informational — dead-file cleanup is a separate concern from bundle size).
//
// Writes docs/qa/bundle-size.json so a size regression is diffable between
// runs (not just eyeballed).
//
// --check-budget compares the CORE islands bundle (the one every page load
// pays for before Settings/Package/Export code ever runs) against a fixed
// byte budget — see CORE_ISLANDS_BUDGET_BYTES below. It exists to catch a
// future PR silently un-splitting the panels bundle back into the core one.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PWA_DIR = join(ROOT, 'pwa');
const REPORT = join(ROOT, 'docs', 'qa', 'bundle-size.json');

// PERF-ISLANDS-SPLIT-001 shipped the core React-islands bundle at ~127KB
// gzip ~36KB. Budget gives ~15% headroom before treating growth as a
// regression worth a second look — not a hard architectural ceiling.
const CORE_ISLANDS_BUDGET_BYTES = 150_000; // raw bytes, pre-gzip

// Loaded at runtime via a dynamically-created <script> tag, not a static
// index.html tag — see the file header comment above.
const DYNAMICALLY_LOADED = ['antcv-react-islands-panels.js'];

const checkBudget = process.argv.includes('--check-budget');

function listFiles(dir, pattern) {
  return readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((f) => join(dir, f));
}

// index.html loads local files through more than plain <script src="…">:
// ES module `import … from './foo.js?v=…'`, and several boot-sequence
// scripts build a script element and assign `.src = 'foo.js?v=…'` in JS
// (see antcv-auth.js, antcv-docx-client.js, antcv-version-override.js —
// none of which have a static <script src> tag). Matching ANY quoted
// "*.js"/"*.css" filename anywhere in the file (not just inside src=/href=)
// catches all of these loading styles; the small risk of a false positive
// from a filename mentioned only in a comment is far safer than the false
// negative of flagging a genuinely-loaded file as dead.
function shippedFileNames() {
  const html = readFileSync(join(PWA_DIR, 'index.html'), 'utf8');
  const re = /['"]\.?\/?([a-zA-Z0-9_.-]+\.(?:js|css))(?:\?[^'"]*)?['"]/g;
  const names = new Set(DYNAMICALLY_LOADED);
  let m;
  while ((m = re.exec(html))) names.add(m[1]);
  return names;
}

function sizeOf(path) {
  const raw = readFileSync(path);
  return { rawBytes: raw.length, gzipBytes: gzipSync(raw).length };
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  const shipped = shippedFileNames();
  const jsFiles = listFiles(PWA_DIR, /\.js$/)
    .filter((p) => !p.endsWith('.map'));
  const cssFiles = listFiles(PWA_DIR, /\.css$/);

  const all = [...jsFiles, ...cssFiles].map((path) => path.slice(PWA_DIR.length + 1));
  const unreferenced = all.filter((name) => !shipped.has(name)).sort();

  const entries = all
    .filter((name) => shipped.has(name))
    .map((name) => ({ name, path: join(PWA_DIR, name), ...sizeOf(join(PWA_DIR, name)) }))
    .sort((a, b) => b.rawBytes - a.rawBytes);

  const totalRaw = entries.reduce((s, e) => s + e.rawBytes, 0);
  const totalGzip = entries.reduce((s, e) => s + e.gzipBytes, 0);

  const named = (name) => entries.find((e) => e.name === name) || null;
  const coreIslands = named('antcv-react-islands.js');
  const panelsIslands = named('antcv-react-islands-panels.js');
  const appJs = named('app.js');
  const sidecars = entries.filter((e) => /^antcv-(?!react-islands)/.test(e.name) && e.name.endsWith('.js'));
  const sidecarsRaw = sidecars.reduce((s, e) => s + e.rawBytes, 0);
  const sidecarsGzip = sidecars.reduce((s, e) => s + e.gzipBytes, 0);

  const rollup = {
    totalFiles: entries.length,
    totalRawBytes: totalRaw,
    totalGzipBytes: totalGzip,
    coreIslands: coreIslands && { rawBytes: coreIslands.rawBytes, gzipBytes: coreIslands.gzipBytes },
    panelsIslands: panelsIslands && { rawBytes: panelsIslands.rawBytes, gzipBytes: panelsIslands.gzipBytes },
    appJs: appJs && { rawBytes: appJs.rawBytes, gzipBytes: appJs.gzipBytes },
    sidecarsCount: sidecars.length,
    sidecarsRawBytes: sidecarsRaw,
    sidecarsGzipBytes: sidecarsGzip,
  };

  console.log('AntCV PWA bundle-size report (shipped assets only — see index.html)');
  console.log('='.repeat(60));
  console.log(`Total: ${entries.length} files, ${human(totalRaw)} raw / ${human(totalGzip)} gzip`);
  if (appJs) console.log(`  app.js:                         ${human(appJs.rawBytes)} raw / ${human(appJs.gzipBytes)} gzip`);
  if (coreIslands) console.log(`  antcv-react-islands.js (core):  ${human(coreIslands.rawBytes)} raw / ${human(coreIslands.gzipBytes)} gzip`);
  if (panelsIslands) console.log(`  antcv-react-islands-panels.js:  ${human(panelsIslands.rawBytes)} raw / ${human(panelsIslands.gzipBytes)} gzip (lazy-loaded, off the initial-load path)`);
  console.log(`  ${sidecars.length} antcv-*.js sidecars combined:  ${human(sidecarsRaw)} raw / ${human(sidecarsGzip)} gzip`);
  console.log('');
  console.log('Top 10 largest shipped files:');
  for (const e of entries.slice(0, 10)) {
    console.log(`  ${human(e.rawBytes).padStart(9)}  (${human(e.gzipBytes).padStart(8)} gzip)  ${e.name}`);
  }
  if (unreferenced.length) {
    console.log(`\n${unreferenced.length} file(s) on disk under pwa/ but not referenced by index.html (not counted above — `
      + `either dead/retired or missing a script tag; see CLAUDE.md's note on retired sidecars):`);
    for (const name of unreferenced.slice(0, 15)) console.log(`  - ${name}`);
    if (unreferenced.length > 15) console.log(`  … and ${unreferenced.length - 15} more (full list in the JSON report)`);
  }

  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), rollup, entries, unreferenced }, null, 2));
  console.log(`\nFull report → ${REPORT.replace(ROOT + '/', '')}`);

  if (checkBudget) {
    if (!coreIslands) {
      console.error('\n--check-budget: antcv-react-islands.js not found — build it first (npm run build).');
      process.exit(2);
    }
    if (coreIslands.rawBytes > CORE_ISLANDS_BUDGET_BYTES) {
      console.error(
        `\n--check-budget FAIL: antcv-react-islands.js is ${human(coreIslands.rawBytes)}, `
        + `over the ${human(CORE_ISLANDS_BUDGET_BYTES)} budget. If this is an intentional core-bundle `
        + `addition, raise CORE_ISLANDS_BUDGET_BYTES in this script; if not, check whether a panels-bundle `
        + `island regressed back into main-core.tsx.`,
      );
      process.exit(1);
    }
    console.log(`\n--check-budget PASS: core islands bundle ${human(coreIslands.rawBytes)} <= budget ${human(CORE_ISLANDS_BUDGET_BYTES)}.`);
  }
}

main();
