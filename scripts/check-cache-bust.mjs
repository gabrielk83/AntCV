// AntCV cache-bust hygiene check.
//
//   node scripts/check-cache-bust.mjs            # audit current tree for ?v drift
//   node scripts/check-cache-bust.mjs --range A..B  # assert the QUARTET for a commit range
//
// WHY THIS EXISTS
// ---------------
// AntCV's only cache-invalidation lever for a pwa asset is the `?v=` query
// string on its <script>/<link> in pwa/index.html (plus sw.js CACHE +
// antcv-version-override.js TARGET_VERSION — the "quartet"). When a file's
// CONTENT changes but its `?v=` is NOT bumped, the service worker / browser
// HTTP cache keeps serving the OLD bytes for the un-bumped URL, while
// antcv-version-override.js (whose TARGET_VERSION is bumped every release)
// rewrites the visible version chip to the latest number — so a STALE tab
// LOOKS current. That masking wasted most of the 2026-06-20 session
// (SIGNIN-GATE-HARDREFRESH-001 / [[stale-sw-version-mask-hazard]]) and froze
// antcv-version-override.js at ?v=722 while its content advanced to 743.
//
// This check makes that drift a hard, mechanical failure.
//
// Two modes:
//   AUDIT (default): for every `name?v=VER` reference in index.html, find the
//     LAST git commit that changed that file. If that commit's subject carries
//     a version (1.50.NNN) and it differs from the referenced `?v=`, that file
//     drifted (its content moved past its cache-bust token). Conservative:
//     skips files whose last-change commit subject has no version (can't judge).
//   RANGE (--range BASE..HEAD): the preventive quartet check. For every pwa
//     asset changed in the range, assert index.html's `?v=` line for that file
//     ALSO changed in the range. Use in a pre-push hook / CI.
//
// Pure helpers are exported for unit testing (no git needed in tests).

import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// ─── Pure, testable core ────────────────────────────────────────────────────

// All `someasset.ext?v=VERSION` references in an index.html string →
// Map(basename → version). Last write wins (a file referenced twice should
// carry the same version anyway).
export function parseVersionRefs(html) {
  const re = /([A-Za-z0-9._-]+\.(?:js|css|jsx|mjs))\?v=([0-9][0-9A-Za-z.\-]*)/g;
  const out = new Map();
  let m;
  while ((m = re.exec(html))) out.set(m[1], m[2]);
  return out;
}

// Pull a release version (1.50.NNN, optional letter suffix) out of a commit
// subject. Returns null when the subject carries no version.
export function extractVersion(subject) {
  const m = /\b(\d+\.\d+\.\d+[a-z]?)\b/.exec(String(subject || ''));
  return m ? m[1] : null;
}

// Reduce a `?v=` token (which may carry a descriptive suffix like
// "1.50.185-react-dom-guard") OR a commit version to its bare numeric
// MAJOR.MINOR.PATCH so the two are comparable. A trailing letter (743b) is
// kept on the patch — a letter bump IS a distinct release. The descriptive
// "-word" suffix is dropped (it is a label, not a version delta).
export function numericVer(v) {
  const m = /(\d+\.\d+\.\d+[a-z]?)/.exec(String(v || ''));
  return m ? m[1] : null;
}

// AUDIT core. refs: Map(basename→?v). lastChange: Map(basename→{version,subject})
// where version is parsed from that file's last-change commit subject (or null).
// Returns [{file, ref, changedAt, subject}] for every drifted file — i.e. the
// file's content moved to a version whose NUMERIC part differs from its ?v
// token's numeric part (a "-word" suffix difference alone is not drift).
export function auditDrift(refs, lastChange) {
  const drifts = [];
  for (const [file, ref] of refs) {
    const lc = lastChange.get(file);
    if (!lc || !lc.version) continue;        // can't judge — skip conservatively
    const a = numericVer(ref), b = numericVer(lc.version);
    if (a && b && a !== b) {
      drifts.push({ file, ref, changedAt: lc.version, subject: lc.subject });
    }
  }
  return drifts;
}

// RANGE core. changedAssets: basenames of pwa assets changed in the range.
// refsBumped: basenames whose `?v=` line changed in index.html within the range.
// Returns the basenames that changed content but did NOT get a ?v bump.
export function rangeOffenders(changedAssets, refsBumped) {
  const bumped = new Set(refsBumped);
  return [...changedAssets].filter((f) => !bumped.has(f));
}

// ─── git glue (impure) ──────────────────────────────────────────────────────

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

function lastChangeFor(relPath) {
  // Newest commit that touched the file; subject only.
  const subj = git(['log', '-1', '--pretty=%s', '--', relPath]).trim();
  return { version: extractVersion(subj), subject: subj };
}

// Map a referenced basename back to its on-disk pwa path (best effort).
function pwaPathFor(base) {
  return `pwa/${base}`;
}

function runAudit(strict) {
  const html = readFileSync(join(ROOT, 'pwa', 'index.html'), 'utf8');
  const refs = parseVersionRefs(html);
  const lastChange = new Map();
  for (const base of refs.keys()) {
    try { lastChange.set(base, lastChangeFor(pwaPathFor(base))); }
    catch { /* file not tracked under pwa/ — skip */ }
  }
  const drifts = auditDrift(refs, lastChange);
  if (drifts.length === 0) {
    console.log('cache-bust audit: OK — no ?v drift detected in pwa/index.html.');
    return 0;
  }
  // Report-only by default: this repo carries historical, dormant drift on
  // files that have not changed in many releases (harmless — the cache token
  // is just behind a label). The ENFORCING gate is --range (the quartet check
  // for the current change). Use --strict to fail on any drift.
  const label = strict ? 'DRIFT' : 'drift (report-only — use --range to gate a change)';
  console[strict ? 'error' : 'warn'](`cache-bust audit: ${label} — ${drifts.length} file(s) past their ?v=:`);
  for (const d of drifts) {
    console[strict ? 'error' : 'warn'](`  ${strict ? '✗' : '•'} ${d.file}  index.html ?v=${d.ref}  but last changed in ${d.changedAt}`);
  }
  if (strict) {
    console.error('\nFix: bump each file\'s ?v= in pwa/index.html to its current version,');
    console.error('then complete the quartet (sw.js CACHE + antcv-version-override.js TARGET_VERSION).');
  }
  return strict ? 1 : 0;
}

function runRange(range) {
  // Only assets that are actually loaded with a ?v= in index.html are
  // cache-bustable. The human-editable SOURCE app.src.js (never loaded, no
  // ?v) and any unreferenced/retired file are correctly excluded.
  const html = readFileSync(join(ROOT, 'pwa', 'index.html'), 'utf8');
  const referenced = new Set(parseVersionRefs(html).keys());
  const changed = git(['diff', '--name-only', range, '--', 'pwa/'])
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const assets = changed
    .filter((p) => /\.(js|css|jsx|mjs)$/.test(p) && !/\/test\//.test(p))
    .map((p) => basename(p))
    .filter((b) => b !== 'index.html' && b !== 'sw.js')
    .filter((b) => referenced.has(b));
  if (assets.length === 0) {
    console.log(`cache-bust range ${range}: OK — no cache-bustable pwa assets changed.`);
    return 0;
  }
  // Which ?v lines moved in index.html within the range?
  const idxDiff = git(['diff', range, '--', 'pwa/index.html']);
  const bumped = [];
  for (const a of assets) {
    const re = new RegExp(`^[+-].*${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=`, 'm');
    if (re.test(idxDiff)) bumped.push(a);
  }
  const offenders = rangeOffenders(assets, bumped);
  if (offenders.length === 0) {
    console.log(`cache-bust range ${range}: OK — all ${assets.length} changed asset(s) got a ?v bump.`);
    return 0;
  }
  console.error(`cache-bust range ${range}: ${offenders.length} asset(s) changed without a ?v bump:`);
  for (const o of offenders) console.error(`  ✗ ${o}`);
  return 1;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}` ||
    fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--range');
  let code;
  if (ri !== -1) {
    const range = argv[ri + 1];
    if (!range) { console.error('--range requires a value like origin/main..HEAD'); process.exit(2); }
    code = runRange(range);
  } else {
    code = runAudit(argv.includes('--strict'));
  }
  process.exit(code);
}
