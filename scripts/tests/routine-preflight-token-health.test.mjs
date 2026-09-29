// ANTCV-TOKEN-EXPIRED-2026-08-14-001, third recurrence (2026-09-29 job-tracker nightly).
//   The owner's PWA JWT at ~/.antcv/token has a 7-day TTL and only self-renews when a routine
//   calls the relay inside the 6-day SESSION_REFRESH_WINDOW. It has now died three times, each
//   time discovered only AFTER a routine ate a 401 mid-task: 08-14, then again after the 08-26
//   re-save, found 27d dead on 09-29 behind a 33-day dispatch gap in this routine's own cron.
//   Fix under test: `routine-preflight.mjs start` decodes the token offline and reports
//   days-to-expiry (warning while it is still re-savable), plus days since this routine's own
//   previous start. Both advisory — `start`'s clean(0)/dirty(3) contract must be untouched.
// Run: node --test scripts/tests/routine-preflight-token-health.test.mjs
// No network, no relay, no real token: synthetic JWTs + a throwaway git repo in the OS temp dir.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'routine-preflight.mjs');
const TMP = mkdtempSync(join(os.tmpdir(), 'antcv-preflight-'));
after(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

// A throwaway repo so the script's own `git` probes have something real to read.
const REPO = join(TMP, 'repo');
mkdirSync(join(REPO, 'scripts', 'tests'), { recursive: true });
const SCRIPT = join(REPO, 'scripts', 'routine-preflight.mjs');
copyFileSync(SRC, SCRIPT);
const GITENV = {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(TMP, 'gitconfig-empty'),
  GIT_AUTHOR_NAME: 'pf-test', GIT_AUTHOR_EMAIL: 'pf@test',
  GIT_COMMITTER_NAME: 'pf-test', GIT_COMMITTER_EMAIL: 'pf@test',
};
writeFileSync(GITENV.GIT_CONFIG_GLOBAL, '');
const git = (...a) => spawnSync('git', a, { cwd: REPO, env: { ...process.env, ...GITENV }, encoding: 'utf8' });
git('init', '-q', '-b', 'main');
git('add', '-A');
git('commit', '-q', '-m', 'fixture');

const TOKEN = join(TMP, 'token');
const LEDGER = join(TMP, 'ledger.jsonl');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// A structurally real JWT with a junk signature — the code must never verify it, only read `exp`.
const SIG = 'not-a-real-signature';
const jwt = (expDaysFromNow) => [
  b64u({ alg: 'HS256', typ: 'JWT' }),
  b64u({ sub: 'tester@example.test', email: 'tester@example.test', iat: 1, exp: Math.floor((Date.now() + expDaysFromNow * 86400000) / 1000) }),
  SIG,
].join('.');

function run(args, { token, ledger = LEDGER } = {}) {
  if (token === null) { try { unlinkSync(TOKEN); } catch {} } else if (token !== undefined) writeFileSync(TOKEN, token);
  const env = { ...process.env, ...GITENV, ANTCV_TOKEN_FILE: TOKEN, ANTCV_ROUTINE_LEDGER: ledger };
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO, env, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('token: a healthy JWT reads OK and exits 0', () => {
  const r = run(['token'], { token: jwt(10) });
  assert.match(r.out, /TOKEN OK/);
  assert.match(r.out, /10\.0d left/);
  assert.equal(r.code, 0);
});

test('token: inside the warn window it says EXPIRING but still exits 0 (the run can self-renew)', () => {
  const r = run(['token'], { token: jwt(1) });
  assert.match(r.out, /TOKEN EXPIRING in 1\.0d/);
  assert.match(r.out, /antcv:auth:token/);         // carries the owner re-save recipe
  assert.equal(r.code, 0, 'a still-valid token must not fail the check');
});

test('token: a dead JWT names the age in days and exits 4', () => {
  const r = run(['token'], { token: jwt(-5) });
  assert.match(r.out, /TOKEN EXPIRED 5d ago/);
  assert.match(r.out, /only a manual re-save can/);
  assert.equal(r.code, 4);
});

test('token: missing and malformed files are reported, not crashed on', () => {
  const missing = run(['token'], { token: null });
  assert.match(missing.out, /TOKEN MISSING/);
  assert.equal(missing.code, 4);

  const junk = run(['token'], { token: 'this-is-not-a-jwt' });
  assert.match(junk.out, /TOKEN UNPARSEABLE/);
  assert.match(junk.out, /expected 3 JWT segments, got 1/);
  assert.equal(junk.code, 4);

  const empty = run(['token'], { token: '   ' });
  assert.match(empty.out, /TOKEN MISSING/);
  assert.equal(empty.code, 4);
});

test('token: the token value itself is never printed', () => {
  const t = jwt(10);
  const r = run(['token'], { token: t });
  const payload = t.split('.')[1];
  assert.ok(!r.out.includes(t), 'whole token leaked to stdout');
  assert.ok(!r.out.includes(payload), 'token payload segment leaked to stdout');
});

test('start: token health is advisory — a dead token does NOT change the clean(0)/dirty(3) contract', () => {
  const ledger = join(TMP, 'ledger-contract.jsonl');
  const clean = run(['start', '--routine', 'contract-test'], { token: jwt(-9), ledger });
  assert.match(clean.out, /TOKEN EXPIRED/);
  assert.match(clean.out, /WORKSPACE CLEAN/);
  assert.equal(clean.code, 0, 'a dead token must not be reported as a dirty workspace');

  writeFileSync(join(REPO, 'dirty.txt'), 'uncommitted');
  const dirty = run(['start', '--routine', 'contract-test'], { token: jwt(-9), ledger });
  assert.match(dirty.out, /WORKSPACE DIRTY/);
  assert.equal(dirty.code, 3);
  unlinkSync(join(REPO, 'dirty.txt'));
});

test('start: reports its own dispatch gap, and never counts its own start line as the previous one', () => {
  const ledger = join(TMP, 'ledger-gap.jsonl');
  const first = run(['start', '--routine', 'gap-test'], { token: jwt(10), ledger });
  assert.match(first.out, /no previous start for this routine/);

  // Back-date that start by 33 days — the real gap this fix was written for.
  const rows = readFileSync(ledger, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  rows[0].ts = new Date(Date.now() - 33 * 86400000).toISOString();
  writeFileSync(ledger, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  const second = run(['start', '--routine', 'gap-test'], { token: jwt(10), ledger });
  assert.match(second.out, /DISPATCH GAP/);
  assert.match(second.out, /33\.0d ago/);
  assert.match(second.out, /cannot refresh the token/);

  // A normal back-to-back run is "last run", not a gap — and it must read the 33d-old line's
  // successor (the one just written), proving the gap read happens BEFORE this run's own log.
  const third = run(['start', '--routine', 'gap-test'], { token: jwt(10), ledger });
  assert.match(third.out, /last run —/);
  assert.ok(!/DISPATCH GAP/.test(third.out), 'a same-day rerun must not be reported as a gap');

  // Another routine's rows must not be mistaken for this one's.
  const other = run(['start', '--routine', 'unrelated-routine'], { token: jwt(10), ledger });
  assert.match(other.out, /no previous start for this routine/);
});

test('start: the ledger row records token state so a later report can see WHEN it died', () => {
  const ledger = join(TMP, 'ledger-row.jsonl');
  run(['start', '--routine', 'row-test'], { token: jwt(-2), ledger });
  const row = JSON.parse(readFileSync(ledger, 'utf8').split(/\r?\n/).filter(Boolean).pop());
  assert.equal(row.routine, 'row-test');
  assert.equal(row.token, 'expired');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(row.token_exp), 'token_exp should be an ISO timestamp');
  assert.ok(!JSON.stringify(row).includes(SIG), 'ledger must not hold the token');
});

// ---- negative control: sabotage the real expiry comparison BY LINE INDEX and prove the
// suite goes red. A guard nobody can break is a guard nobody is testing.
test('NEGATIVE CONTROL: breaking the expiry comparison must flip the dead-token verdict', () => {
  const lines = readFileSync(SCRIPT, 'utf8').split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes("const state = days <= 0 ? 'expired'"));
  assert.ok(i > -1, 'expiry-comparison line not found — this control has gone stale, fix it');
  const original = lines[i];
  lines[i] = "  const state = 'ok';";   // sabotage: every token claims healthy
  writeFileSync(SCRIPT, lines.join('\n'));
  try {
    const sabotaged = run(['token'], { token: jwt(-5) });
    assert.match(sabotaged.out, /TOKEN OK/, 'sabotage did not land — the control is not exercising the real code');
    assert.equal(sabotaged.code, 0);
  } finally {
    lines[i] = original;
    writeFileSync(SCRIPT, lines.join('\n'));
  }
  // restored code must be red-free again
  const restored = run(['token'], { token: jwt(-5) });
  assert.match(restored.out, /TOKEN EXPIRED/);
  assert.equal(restored.code, 4);
});
