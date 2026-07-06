/* PARSE-JD-ADEQUACY-FLOOR-001 regression guard.
 *
 * Owner report (2026-07-06, live): a JD parse hard-failed with
 *   "All 1 LLM provider failed for task parse_jd: claude (bad_input):
 *    inadequate or truncated output (464 chars)".
 * Root cause: __antcvOutputInadequate applied the SAME 800-char floor to
 * parse_jd and generate_cv. generate_cv output is a multi-KB CV+CL JSON, but
 * parse_jd's valid output (company, role, a few requirements) is legitimately
 * much smaller. A complete ~464-char parse with balanced braces was wrongly
 * flagged "truncated"; with a single available provider there was no fallback,
 * so the whole task hard-failed.
 *
 * Fix: per-task floor — parse_jd uses a small floor (80), generate_cv keeps
 * 800. The unbalanced-brace (mid-object truncation) check still guards BOTH.
 *
 * Run: node --test pwa/test/unit/parse-jd-adequacy-floor.test.mjs
 * (or via: node scripts/run-tests.mjs pwa)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function extractFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  // function closes at the first 2-space-indented "}" line after the start
  const end = src.indexOf('\n  }\n', start);
  assert.ok(end > start, 'function close not found');
  return src.slice(start, end + 4);
}

function loadFrom(file, startMarker) {
  // normalise CRLF→LF so the \n-based offset extraction is checkout-independent
  const src = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const fnSrc = extractFn(src, startMarker);
  const ctx = { String, RegExp };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.__fn = __antcvOutputInadequate;', ctx);
  return ctx.__fn;
}

// Source of truth is app.src.js; the minified app.js twin is checked separately.
const inadequate = loadFrom('../../app.src.js', 'function __antcvOutputInadequate(task, text) {');

const balanced464 =
  '{"company":"Trackman A/S","role":"Project Manager, Hardware","location":"Hørsholm, DK",' +
  '"requirements":["several years hardware project management","cross-functional coordination",' +
  '"platform modularity","requirements & change management","supplier coordination"],' +
  '"preferred":["RF systems","advanced camera technology"],"language":"en"}';

test('a complete ~464-char parse_jd JSON with balanced braces is NOT inadequate', () => {
  assert.ok(balanced464.length < 800, 'fixture must be under the old 800 floor');
  assert.ok(balanced464.length >= 80, 'fixture must clear the new parse_jd floor');
  assert.equal(inadequate('parse_jd', balanced464), false);
});

test('the SAME small body IS inadequate for generate_cv (800 floor unchanged)', () => {
  assert.equal(inadequate('generate_cv', balanced464), true);
});

test('a genuinely tiny/empty parse_jd body is still inadequate (below the 80 floor)', () => {
  assert.equal(inadequate('parse_jd', '{}'), true);
  assert.equal(inadequate('parse_jd', ''), true);
  assert.equal(inadequate('parse_jd', '   '), true);
});

test('parse_jd truncation is still caught by the unbalanced-brace check', () => {
  const truncated = '{"company":"Trackman A/S","role":"Project Manager, Hardware","requirements":["a","b","c","d","e","f"';
  assert.ok(truncated.length >= 80, 'fixture clears the length floor so only the brace check can reject it');
  assert.equal(inadequate('parse_jd', truncated), true);
});

test('a large balanced generate_cv body passes', () => {
  const big = '{' + '"k":"' + 'x'.repeat(2000) + '","roles":["a","b"]}';
  assert.ok(big.length > 800);
  assert.equal(inadequate('generate_cv', big), false);
});

test('non-gated tasks are never flagged (unchanged)', () => {
  assert.equal(inadequate('enrich', 'x'), false);
  assert.equal(inadequate('compress', ''), false);
  assert.equal(inadequate('extract', '{}'), false);
});

test('the minified app.js twin carries the same per-task floor', () => {
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.ok(
    min.includes('"parse_jd"===String(e||"")?80:800'),
    'minified app.js must contain the per-task floor',
  );
  assert.ok(
    !min.includes('.trim();if(n.length<800)return!0;let o=0,r=0'),
    'old single-floor form must be gone from app.js',
  );
});
