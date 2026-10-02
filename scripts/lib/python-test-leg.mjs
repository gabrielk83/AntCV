// Python test leg for the unified test harness (JOBTRACKER-PYTEST-UNWIRED-001).
//
// The repo carries network-free, self-running python tests (`test_*.py`, each
// `sys.exit(1)` on failure / prints PASS otherwise) that guard the belts
// deciding whether a model call is spent — the closed-row gate, the
// obsolescence classifier, the board parsers. Until now they ran by hand only,
// so they were green-by-nobody-looking between the runs that touched that dir.
//
// This module is the pure, testable core of the OPTIONAL python leg that
// `scripts/run-tests.mjs` adds. Design constraints (see the register row):
//   - A missing interpreter must SKIP LOUDLY, never redden the node suite.
//   - Scopes with no python tests (e.g. `pwa`) must be a no-op, so the PWA
//     suite the pre-push hook + CI gate on is byte-for-byte unchanged.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Mirror run-tests.mjs's skip set so the two walks stay in step.
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', 'build', '.wrangler']);
const PY_TEST_RE = /^test_.*\.py$/;

// Recursively collect self-running python test files under `dir`.
export function walkPyTests(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkPyTests(join(dir, e.name), out);
    } else if (PY_TEST_RE.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

// Return the first working python interpreter, or null if none is present.
// `spawn` is injectable so the no-interpreter (skip-loudly) path is testable.
export function pickPython(spawn = spawnSync) {
  for (const cand of ['python3', 'python']) {
    let r;
    try { r = spawn(cand, ['--version'], { stdio: 'ignore' }); }
    catch { continue; }
    if (r && !r.error && r.status === 0) return cand;
  }
  return null;
}
