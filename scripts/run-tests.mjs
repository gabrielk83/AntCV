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

if (files.length === 0) {
  console.error(`No *.test.mjs / *.test.js files found under ${relative(ROOT, scope) || '.'}`);
  process.exit(1);
}

console.log(`Running ${files.length} test file(s):`);
for (const f of files) console.log(`  • ${relative(ROOT, f).split(sep).join('/')}`);
console.log('');

const res = spawnSync(
  process.execPath,
  ['--test', '--test-reporter=spec', ...files],
  { stdio: 'inherit', cwd: ROOT }
);

process.exit(res.status ?? 1);
