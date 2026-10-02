// AntCV unified test-harness runner.
//
//   node scripts/run-tests.mjs            # discover + run every *.test.mjs / *.test.js
//   node scripts/run-tests.mjs pwa        # only files under pwa/
//   node scripts/run-tests.mjs workers/proxy
//
// Zero dependencies. Walks the tree, collects Node-native test files
// (the `node:test` + `node:assert` convention already used across the
// repo), and runs them through one `node --test` invocation so there is a
// single pass/fail and exit code for CI / pre-push hooks.
//
// NOT included: the standalone integration smokes (workers/*/test/smoke*.js
// and workers/access-relay/tests/*.mjs) — those write artefacts / assume a
// wrangler-or-sqljs environment and are run by hand. Only `*.test.mjs` and
// `*.test.js` are collected. See docs/qa/TEST_HARNESS.md.

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { walkPyTests, pickPython } from './lib/python-test-leg.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', 'build', '.wrangler']);
const TEST_RE = /\.test\.(mjs|js)$/;

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), out);
    } else if (TEST_RE.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

const scope = process.argv[2] ? join(ROOT, process.argv[2]) : ROOT;
const files = walk(scope, []).sort();
// Optional python leg (JOBTRACKER-PYTEST-UNWIRED-001): the repo's self-running
// `test_*.py` belts used to run by hand only. Collect any in scope; see below
// for the skip-loudly-when-no-interpreter contract. A scope with no python
// tests (e.g. `pwa`) collects nothing here, so the PWA suite is unchanged.
const pyFiles = walkPyTests(scope).sort();

if (files.length === 0 && pyFiles.length === 0) {
  console.error(`No *.test.mjs / *.test.js / test_*.py files found under ${relative(ROOT, scope) || '.'}`);
  process.exit(1);
}

let nodeStatus = 0;
if (files.length > 0) {
  console.log(`Running ${files.length} node test file(s):`);
  for (const f of files) console.log(`  • ${relative(ROOT, f).split(sep).join('/')}`);
  console.log('');

  // --test-force-exit: some suites register timer-based handles (e.g. the
  // stale-status watchdog setTimeout, PRV-004) that keep the event loop alive
  // after every test has passed, so `node --test` would otherwise HANG at the
  // end and get killed with a nonzero code — masking an all-green run as a
  // failure for CI / the pre-push hook. Force a clean exit once tests finish.
  // Pass paths RELATIVE to ROOT (cwd). Absolute paths overflow the Windows 32,767-char command
  // line from a deep worktree (290 files x a .claude/worktrees/<name>/ prefix = 46k chars); the
  // spawn then fails, status is null, and the run exits 1 with no test output (RUN-TESTS-CMDLINE-001).
  const res = spawnSync(
    process.execPath,
    ['--test', '--test-force-exit', '--test-reporter=spec', ...files.map((f) => relative(ROOT, f))],
    { stdio: 'inherit', cwd: ROOT }
  );
  if (res.error) console.error(`[run-tests] could not start node --test: ${res.error.code || ''} ${res.error.message}`);
  nodeStatus = res.status ?? 1;
}

let pyStatus = 0;
if (pyFiles.length > 0) {
  const py = pickPython();
  if (!py) {
    // SKIP LOUDLY, do NOT fail — a CI runner with no python interpreter must
    // not redden the whole suite (the explicit failure mode the row warned of).
    console.log('');
    console.log(`[run-tests] SKIPPED ${pyFiles.length} python test file(s): no python3/python interpreter found.`);
    console.log('[run-tests] python belts are UNVERIFIED this run — install python3 to run them.');
    for (const f of pyFiles) console.log(`  (skipped) ${relative(ROOT, f).split(sep).join('/')}`);
  } else {
    console.log('');
    console.log(`Running ${pyFiles.length} python test file(s) with ${py}:`);
    for (const f of pyFiles) console.log(`  • ${relative(ROOT, f).split(sep).join('/')}`);
    console.log('');
    for (const f of pyFiles) {
      const rel = relative(ROOT, f).split(sep).join('/');
      const r = spawnSync(py, [rel], { stdio: 'inherit', cwd: ROOT });
      if (r.error) {
        console.error(`[run-tests] could not start ${py} ${rel}: ${r.error.code || ''} ${r.error.message}`);
        pyStatus = 1;
      } else if ((r.status ?? 1) !== 0) {
        console.error(`[run-tests] FAIL ${rel} (exit ${r.status})`);
        pyStatus = 1;
      }
    }
  }
}

process.exit(nodeStatus || pyStatus);
