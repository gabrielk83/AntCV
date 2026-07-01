/* D1-WRITE-RETRY-001 regression guard (owner 2026-07-02).
 *
 * A transient D1 write failure surfaced to the client as `d1_write_failed` during rapid
 * kernel/prefs saves. access-relay now wraps its idempotent write .run()s in d1RunWithRetry, which
 * retries with exponential backoff and re-throws the LAST error so the existing catch still returns
 * d1_write_failed after a genuine failure. This extracts the real helper from
 * workers/access-relay/src/index.js and drives it against a fake statement.
 *
 * Run:  node --test workers/access-relay/tests/d1-write-retry.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = src.indexOf('async function d1RunWithRetry(');
assert.ok(start > 0, 'd1RunWithRetry defined in src/index.js');
// slice through the function body's closing brace (ends with `throw lastErr;\n}`)
const end = src.indexOf('\n}', src.indexOf('throw lastErr;', start)) + 2;
const fnSrc = src.slice(start, end);

// run the extracted helper in a vm; setTimeout resolves immediately so retries don't actually wait.
const ctx = { setTimeout: (fn) => { fn(); return 0; }, Promise, console };
vm.createContext(ctx);
vm.runInContext(fnSrc + '\nthis.d1RunWithRetry = d1RunWithRetry;', ctx);
const d1RunWithRetry = ctx.d1RunWithRetry;

function fakeStmt(behaviour) {
  let calls = 0;
  return {
    calls: () => calls,
    run: async () => {
      calls++;
      const r = behaviour(calls);
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

test('succeeds on the first try — no retry', async () => {
  const s = fakeStmt(() => ({ success: true }));
  const res = await d1RunWithRetry(s);
  assert.deepEqual(res, { success: true });
  assert.equal(s.calls(), 1);
});

test('retries a transient failure and succeeds', async () => {
  const s = fakeStmt((n) => (n < 3 ? new Error('database is locked') : { success: true }));
  const res = await d1RunWithRetry(s);
  assert.deepEqual(res, { success: true });
  assert.equal(s.calls(), 3, 'failed twice, succeeded on the 3rd');
});

test('exhausts retries and re-throws the LAST error (so caller returns d1_write_failed)', async () => {
  const s = fakeStmt((n) => new Error('storage error #' + n));
  await assert.rejects(() => d1RunWithRetry(s), /storage error #4/);
  assert.equal(s.calls(), 4, 'default 4 attempts');
});

test('honours a custom try count', async () => {
  const s = fakeStmt(() => new Error('busy'));
  await assert.rejects(() => d1RunWithRetry(s, 2));
  assert.equal(s.calls(), 2);
});
