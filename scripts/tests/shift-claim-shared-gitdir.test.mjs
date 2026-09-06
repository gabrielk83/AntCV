// SHIFT-SHARED-ID-001 (2026-09-06) — two `claim`s from ONE gitdir must not share a ledger row.
//   Incident: session A claimed from the main clone (id file .git/shift-session-id). Session B
//   claimed from the SAME clone, reused A's id, and cmdClaim's `filter(c => c.id !== myId)`
//   silently REPLACED A's row with B's. A's `release` then deleted B's claim.
//   Fix: a gitdir whose id already owns a live row on origin is refused; the second session
//   claims from its own worktree (own gitdir → own id file). Both rows survive; each release
//   drops only its own row. Also pins the 2026-07-10 empty-id-file behaviour (blank id = absent).
// Run: node --test scripts/tests/shift-claim-shared-gitdir.test.mjs
// Real git, throwaway bare origin + clone in the OS temp dir; no network.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const SHIFT = join(dirname(fileURLToPath(import.meta.url)), '..', 'shift.mjs');
const TMP = mkdtempSync(join(os.tmpdir(), 'antcv-shift-'));
const ORIGIN = join(TMP, 'origin.git');
const CLONE = join(TMP, 'AntCV');
const WT = join(TMP, 'AntCV-wt');
const ENV = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(TMP, 'gitconfig-empty'),
  GIT_AUTHOR_NAME: 'shift-test', GIT_AUTHOR_EMAIL: 'shift@test', GIT_COMMITTER_NAME: 'shift-test', GIT_COMMITTER_EMAIL: 'shift@test',
};
writeFileSync(ENV.GIT_CONFIG_GLOBAL, '');

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}:\n${r.stderr}`);
  return r.stdout.trim();
}
function shift(cwd, ...args) {
  return spawnSync(process.execPath, [join(cwd, 'scripts', 'shift.mjs'), ...args], { cwd, env: ENV, encoding: 'utf8' });
}
function originClaims() {
  const txt = git(CLONE, ['show', 'origin/main:docs/qa/NIGHT_SHIFT.md']);
  const b = txt.indexOf('<!-- SHIFT:BEGIN'), e = txt.indexOf('<!-- SHIFT:END -->');
  return txt.slice(txt.indexOf('\n', b) + 1, e).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
}
const idFile = (gitdir) => join(gitdir, 'shift-session-id');
const readId = (gitdir) => existsSync(idFile(gitdir)) ? readFileSync(idFile(gitdir), 'utf8').trim() : null;

// ---- fixture: bare origin + clone holding a minimal ledger, version file and the script ----
git(TMP, ['init', '--bare', '-b', 'main', ORIGIN]);
git(TMP, ['init', '-b', 'main', CLONE]);
mkdirSync(join(CLONE, 'docs', 'qa'), { recursive: true });
mkdirSync(join(CLONE, 'pwa'), { recursive: true });
mkdirSync(join(CLONE, 'scripts'), { recursive: true });
writeFileSync(join(CLONE, 'docs', 'qa', 'NIGHT_SHIFT.md'), '# ledger\n\n<!-- SHIFT:BEGIN — one JSON object per line -->\n<!-- SHIFT:END -->\n\ntail\n');
writeFileSync(join(CLONE, 'pwa', 'antcv-version-override.js'), "const TARGET_VERSION = '1.51.100';\n");
copyFileSync(SHIFT, join(CLONE, 'scripts', 'shift.mjs'));
git(CLONE, ['add', '-A']);
git(CLONE, ['commit', '-q', '-m', 'fixture']);
git(CLONE, ['remote', 'add', 'origin', ORIGIN]);
git(CLONE, ['push', '-q', '-u', 'origin', 'main']);
const CLONE_GITDIR = join(CLONE, '.git');

after(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

test('a second claim from the same gitdir is refused and leaves the first row intact', () => {
  const a = shift(CLONE, 'claim', '--task', 'A-first');
  assert.equal(a.status, 0, a.stderr);
  assert.match(a.stdout, /CLAIMED 1\.51\.101-1\.51\.120/);
  const idA = readId(CLONE_GITDIR);
  assert.ok(idA, 'claim A wrote an id file');
  assert.deepEqual(originClaims().map((c) => [c.id, c.range, c.task]), [[idA, '1.51.101-1.51.120', 'A-first']]);

  const b = shift(CLONE, 'claim', '--task', 'B-second');
  assert.notEqual(b.status, 0, 'second claim from the same clone must fail');
  assert.match(b.stderr, /already holds 1\.51\.101-1\.51\.120/);
  assert.match(b.stderr, /A-first/);
  assert.match(b.stderr, /worktree/);
  assert.equal(readId(CLONE_GITDIR), idA, 'the refused claim must not touch the id file');
  // origin still has exactly A's row — nothing replaced, nothing appended
  assert.deepEqual(originClaims().map((c) => [c.id, c.range]), [[idA, '1.51.101-1.51.120']]);
});

test('claiming from a worktree mints its own id; both rows survive; each release drops only its own', () => {
  const idA = readId(CLONE_GITDIR);
  git(CLONE, ['worktree', 'add', '-q', WT, '-b', 'wt']);
  const WT_GITDIR = git(WT, ['rev-parse', '--absolute-git-dir']);
  assert.notEqual(WT_GITDIR, CLONE_GITDIR);

  const b = shift(WT, 'claim', '--task', 'B-from-worktree');
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, /CLAIMED 1\.51\.121-1\.51\.140/);
  assert.match(b.stdout, /You are in worktree/);
  const idB = readId(WT_GITDIR);
  assert.ok(idB && idB !== idA, 'worktree claim uses a fresh id in its own gitdir');
  assert.equal(readId(CLONE_GITDIR), idA, 'main clone id untouched');

  const both = originClaims();
  assert.deepEqual(both.map((c) => [c.id, c.range, c.task]), [
    [idA, '1.51.101-1.51.120', 'A-first'],
    [idB, '1.51.121-1.51.140', 'B-from-worktree'],
  ]);
  assert.equal(both[1].worktree, 'AntCV-wt', 'worktree claim records its directory name');

  // A releases from the main clone (behind origin by B's commit → exercises the rebase-retry push)
  const relA = shift(CLONE, 'release');
  assert.equal(relA.status, 0, relA.stderr);
  assert.match(relA.stdout, /released 1\.51\.101-1\.51\.120/);
  assert.deepEqual(originClaims().map((c) => [c.id, c.range]), [[idB, '1.51.121-1.51.140']], "B survives A's release");
  assert.equal(readId(CLONE_GITDIR), null, 'release deletes the id file');
  // the ledger-only rebase conflict was resolved, not swallowed: no rebase in progress, no markers
  assert.equal(existsSync(join(CLONE_GITDIR, 'rebase-merge')), false, 'clone must not be left mid-rebase');
  assert.equal(git(CLONE, ['status', '--porcelain']), '', 'clone tree clean after release');
  assert.doesNotMatch(readFileSync(join(CLONE, 'docs', 'qa', 'NIGHT_SHIFT.md'), 'utf8'), /<<<<<<<|>>>>>>>/);
  assert.equal(git(CLONE, ['rev-parse', 'HEAD']), git(CLONE, ['rev-parse', 'origin/main']), 'clone is exactly at origin/main');

  const relB = shift(WT, 'release');
  assert.equal(relB.status, 0, relB.stderr);
  assert.match(relB.stdout, /released 1\.51\.121-1\.51\.140/);
  assert.deepEqual(originClaims(), []);
});

test('an empty id file still counts as absent (2026-07-10 behaviour kept)', () => {
  writeFileSync(idFile(CLONE_GITDIR), '');
  const c = shift(CLONE, 'claim', '--task', 'C-after-blank');
  assert.equal(c.status, 0, c.stderr);
  const idC = readId(CLONE_GITDIR);
  assert.ok(idC, 'a fresh id was minted over the blank file');
  assert.deepEqual(originClaims().map((c) => c.id), [idC]);
  assert.equal(shift(CLONE, 'release').status, 0);
  assert.deepEqual(originClaims(), []);
});
