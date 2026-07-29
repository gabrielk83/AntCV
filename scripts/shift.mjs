#!/usr/bin/env node
// shift.mjs — NIGHT SHIFT coordination helper for parallel AntCV sessions.
//
// The ledger docs/qa/NIGHT_SHIFT.md carries an ACTIVE CLAIMS block (JSONL between
// <!-- SHIFT:BEGIN --> / <!-- SHIFT:END -->). This tool claims/releases a version-number
// range in that block and (best-effort) syncs it to origin/main so other sessions see it.
//
// Commands:
//   claim   --task "<what>" [--range 1.51.260-1.51.279] [--worktree <name>] [--size 20] [--no-push]
//   status                       print the active claims table
//   next-version [--range]       next free version number (or the next free range)
//   beat                         heartbeat this session's claim
//   release                      drop this session's claim
//   reap    [--hours 6]          drop claims whose heartbeat is older than N hours
//
// This session's id is stored in .git/shift-session-id so beat/release find the same row.
// It is a plain node script (not a workflow) — Date/Math.random are fine here.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(REPO, 'docs', 'qa', 'NIGHT_SHIFT.md');
const VERSION_FILE = join(REPO, 'pwa', 'antcv-version-override.js');
// Resolve the per-worktree git dir so the session-id file lives in a REAL directory even
// inside a git WORKTREE — there `<repo>/.git` is a FILE (a gitdir pointer), not a dir, so
// join(REPO,'.git',…) is an invalid path and the id never persists (the 2026-07-10 bug that
// forced a hand-edited release). `--absolute-git-dir` returns the worktree-specific dir
// (main clone → .git; worktree → .git/worktrees/<name>) → an id file PER session/worktree.
function resolveGitDir() {
  try { return execSync('git rev-parse --absolute-git-dir', { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch { return join(REPO, '.git'); }
}
const IDFILE = join(resolveGitDir(), 'shift-session-id');
const BEGIN = '<!-- SHIFT:BEGIN';
const END = '<!-- SHIFT:END -->';

// ---- args ------------------------------------------------------------------
const [, , cmd, ...rest] = process.argv;
function arg(name, def = null) {
  const i = rest.indexOf('--' + name);
  if (i === -1) return def;
  const v = rest[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

// ---- git (best-effort; never throw the process down on a network hiccup) ----
function git(args, { quiet = false } = {}) {
  try {
    return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    if (!quiet) process.stderr.write(String(e.stderr || e.message || e) + '\n');
    return null;
  }
}
function sync() {
  git('fetch origin', { quiet: true });
  const r = git('pull --rebase origin main', { quiet: true });
  return r !== null;
}

// ---- ledger read/write -----------------------------------------------------
function parseClaims(text) {
  const b = text.indexOf(BEGIN), e = text.indexOf(END);
  if (b === -1 || e === -1) return [];
  const beginLineEnd = text.indexOf('\n', b) + 1;
  return text.slice(beginLineEnd, e).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{'))
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function readLedger() {
  if (!existsSync(LEDGER)) { console.error('ledger missing: ' + LEDGER); process.exit(1); }
  const text = readFileSync(LEDGER, 'utf8');
  const b = text.indexOf(BEGIN), e = text.indexOf(END);
  if (b === -1 || e === -1) { console.error('ledger markers not found'); process.exit(1); }
  const beginLineEnd = text.indexOf('\n', b) + 1;
  return { text, beginLineEnd, e, claims: parseClaims(text) };
}
// WIP-PROOF READ: the authoritative claim list is what is on origin/main, NOT the local
// working copy. A session with uncommitted changes can't `pull --rebase`, so the local
// ledger goes stale and a naive read lets two sessions grab the same range. This reads
// origin's ledger directly (fetch + `git show`), independent of any local WIP; it falls
// back to the local file only when origin is unreachable. All commands base their
// active-claim view on this, then write the full fresh set (± their own row) locally.
function originLedgerClaims() {
  git('fetch origin', { quiet: true });
  const txt = git('show origin/main:docs/qa/NIGHT_SHIFT.md', { quiet: true });
  return txt != null ? parseClaims(txt) : readLedger().claims;
}
function writeLedger(claims) {
  const { text, beginLineEnd, e } = readLedger();
  const body = claims.length ? claims.map((c) => JSON.stringify(c)).join('\n') + '\n' : '';
  const next = text.slice(0, beginLineEnd) + body + text.slice(e);
  writeFileSync(LEDGER, next);
}

// ---- version-range math ----------------------------------------------------
function currentPatch() {
  // High-water mark, NOT just TARGET_VERSION — a parallel session's merge can REGRESS
  // TARGET below numbers already shipped (this is the exact collision the ledger prevents),
  // so also scan recent git subjects for the highest 1.51.x ever used and take the max.
  let fromFile = 0;
  try {
    const m = readFileSync(VERSION_FILE, 'utf8').match(/TARGET_VERSION\s*=\s*'1\.51\.(\d+)/);
    fromFile = m ? parseInt(m[1], 10) : 0;
  } catch {}
  let fromGit = 0;
  const log = git('log -60 --format=%s', { quiet: true }) || '';
  for (const m of log.matchAll(/1\.51\.(\d+)/g)) fromGit = Math.max(fromGit, parseInt(m[1], 10));
  return Math.max(fromFile, fromGit);
}
function rangeEnd(r) { const m = String(r || '').match(/1\.51\.(\d+)\s*-\s*1\.51\.(\d+)/); return m ? parseInt(m[2], 10) : 0; }
function nextFreeRange(claims, size) {
  const claimedMax = claims.reduce((mx, c) => Math.max(mx, rangeEnd(c.range)), 0);
  const base = Math.max(currentPatch(), claimedMax) + 1;
  return `1.51.${base}-1.51.${base + size - 1}`;
}
function overlaps(a, b) {
  const pa = String(a).match(/1\.51\.(\d+)\s*-\s*1\.51\.(\d+)/), pb = String(b).match(/1\.51\.(\d+)\s*-\s*1\.51\.(\d+)/);
  if (!pa || !pb) return false;
  return +pa[1] <= +pb[2] && +pb[1] <= +pa[2];
}

// ---- session id ------------------------------------------------------------
function sessionId(create = false) {
  // An existing-but-EMPTY id file (a prior release blanked it) is NOT a valid id — treat
  // it as absent, otherwise a subsequent claim gets written with id:'' and can never be
  // released. This was the 2026-07-10 stuck-claim bug.
  if (existsSync(IDFILE)) {
    const v = readFileSync(IDFILE, 'utf8').trim();
    if (v) return v;
  }
  if (!create) return null;
  const id = 'sh_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  try { mkdirSync(dirname(IDFILE), { recursive: true }); writeFileSync(IDFILE, id); } catch {}
  return id;
}
const nowIso = () => new Date().toISOString();

// ---- pretty table ----------------------------------------------------------
function printTable(claims) {
  if (!claims.length) { console.log('(no active claims)'); return; }
  const rows = claims.map((c) => [c.range || '?', (c.task || '').slice(0, 40), c.branch || c.worktree || '-', c.host || '-', c.beat || c.started || '-']);
  const head = ['RANGE', 'TASK', 'BRANCH/WORKTREE', 'HOST', 'LAST BEAT'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const fmt = (r) => r.map((c, i) => String(c).padEnd(w[i])).join('  ');
  console.log(fmt(head)); console.log(w.map((n) => '-'.repeat(n)).join('  '));
  rows.forEach((r) => console.log(fmt(r)));
}

function commitPush(msg, noPush) {
  git('add docs/qa/NIGHT_SHIFT.md', { quiet: true });
  const committed = git(`commit -m ${JSON.stringify(msg)}`, { quiet: true });
  if (committed === null) return; // nothing staged / hook — leave the working-tree edit in place
  if (noPush) return;
  let pushed = git('push origin HEAD:main', { quiet: true });
  if (pushed === null) { sync(); git('push origin HEAD:main', { quiet: true }); } // one retry after rebase
}

// ---- commands --------------------------------------------------------------
function cmdClaim() {
  const size = parseInt(arg('size', '20'), 10) || 20;
  const active = originLedgerClaims().filter((c) => c.id !== sessionId());
  let range = arg('range', null);
  if (range) {
    if (!/^1\.51\.\d+-1\.51\.\d+$/.test(range)) { console.error('range must look like 1.51.260-1.51.279'); process.exit(1); }
    const clash = active.find((c) => overlaps(range, c.range));
    if (clash) { console.error(`range ${range} overlaps active claim ${clash.range} (${clash.task || clash.id}). Pick another or omit --range for an auto range.`); process.exit(1); }
  } else {
    range = nextFreeRange(active, size);
  }
  const id = sessionId(true);
  const claims = active.concat([{
    id, started: nowIso(), host: os.hostname(),
    worktree: arg('worktree', null) || null,
    branch: git('rev-parse --abbrev-ref HEAD', { quiet: true }) || null,
    range, task: arg('task', '') || '', beat: nowIso(),
  }]);
  writeLedger(claims);
  commitPush(`chore(shift): claim ${range} — ${arg('task', '') || 'work'}`, arg('no-push', false));
  const start = range.split('-')[0];
  const wtName = (arg('worktree', null)) || ('shift-' + start.replace(/\./g, '-'));
  console.log(`\nCLAIMED ${range}  (session ${id})`);
  console.log(`Use version numbers only inside ${range}. First: ${start}.`);
  console.log(`\nWork in your own worktree so you never touch the shared clone:`);
  console.log(`  git worktree add ../AntCV-${wtName} -b ${wtName}`);
  console.log(`  cd ../AntCV-${wtName}`);
  console.log(`\nHeartbeat: node scripts/shift.mjs beat   ·   Release: node scripts/shift.mjs release`);
}

function cmdStatus() { printTable(originLedgerClaims()); }

function cmdNextVersion() {
  const claims = originLedgerClaims();
  if (arg('range', false)) { console.log(nextFreeRange(claims, parseInt(arg('size', '20'), 10) || 20)); return; }
  const mine = claims.find((c) => c.id === sessionId());
  if (!mine) { console.log(nextFreeRange(claims, 1)); return; }
  console.log(mine.range.split('-')[0]); // range start; the session increments within its own range
}

function cmdBeat() {
  const id = sessionId(); if (!id) { console.error('no session id — run claim first'); process.exit(1); }
  const claims = originLedgerClaims();
  const mine = claims.find((c) => c.id === id);
  if (!mine) { console.error('no active claim for this session'); process.exit(1); }
  mine.beat = nowIso();
  writeLedger(claims);
  commitPush(`chore(shift): heartbeat ${mine.range}`, arg('no-push', false));
  console.log(`beat ${mine.range} @ ${mine.beat}`);
}

function cmdRelease() {
  const id = sessionId(); if (!id) { console.error('no session id — nothing to release'); process.exit(1); }
  const all = originLedgerClaims();
  const mine = all.find((c) => c.id === id);
  const claims = all.filter((c) => c.id !== id);
  writeLedger(claims);
  commitPush(`chore(shift): release ${mine ? mine.range : id}`, arg('no-push', false));
  try { if (existsSync(IDFILE)) unlinkSync(IDFILE); } catch {}   // delete, don't blank — see sessionId()
  console.log(mine ? `released ${mine.range}` : 'no claim for this session (cleaned id)');
}

function cmdReap() {
  const parsed = parseFloat(arg('hours', '6'));
  const hours = Number.isFinite(parsed) ? parsed : 6;   // 0 is valid (reap all past claims)
  const cutoff = Date.now() - hours * 3600 * 1000;
  const all = originLedgerClaims();
  const dead = all.filter((c) => new Date(c.beat || c.started).getTime() < cutoff);
  if (!dead.length) { console.log('nothing to reap'); return; }
  const claims = all.filter((c) => new Date(c.beat || c.started).getTime() >= cutoff);
  writeLedger(claims);
  commitPush(`chore(shift): reap ${dead.length} stale claim(s)`, arg('no-push', false));
  console.log('reaped: ' + dead.map((c) => c.range).join(', '));
}

const table = { claim: cmdClaim, status: cmdStatus, 'next-version': cmdNextVersion, beat: cmdBeat, release: cmdRelease, reap: cmdReap };
if (!cmd || !table[cmd]) {
  console.log('usage: node scripts/shift.mjs <claim|status|next-version|beat|release|reap> [opts]');
  process.exit(cmd ? 1 : 0);
}
table[cmd]();
