#!/usr/bin/env node
// routine-preflight.mjs — liveness + workspace-safety helper for every AntCV scheduled routine.
//
// WHY THIS EXISTS (audit 2026-07-21): the scheduled routines are desktop-app-local tasks that
// only run while the Claude app is open; when they DO fire (often deferred to next launch) they
// have been (a) colliding with the owner's interactive session in the shared main clone — a dirty
// tree blocks their `git pull --rebase`, so the run silently aborts (7/18, 7/20 missed; 7/14
// half-ran) — and (b) failing SILENTLY: a run that fires and does nothing (demand-seed 7/17) left
// no trace, indistinguishable from never running. This helper fixes both:
//   * heartbeat  — append a start/end/error line to a LOCAL health ledger so "fired but did
//                  nothing" becomes visible. Local-only: no git push, no new pusher, no collision.
//   * preflight  — detect a dirty/behind shared tree and tell the routine to work in a worktree
//                  instead, so the owner's live WIP can never block the routine's rebase.
//
// It is a plain node script (no deps; Date/Math.random are fine here — not a workflow).
//
// Usage (from repo root; a routine's fresh session calls these):
//   node scripts/routine-preflight.mjs start  --routine antcv-nightly
//       → logs a "start" line AND prints a workspace verdict:
//         "WORKSPACE CLEAN" (safe to work in this clone) or
//         "WORKSPACE DIRTY — work in a worktree:" + a ready-to-run `git worktree add` line.
//   node scripts/routine-preflight.mjs end    --routine antcv-nightly --status ok      --summary "shipped X; 3 rows verified"
//   node scripts/routine-preflight.mjs end    --routine antcv-nightly --status no-op   --summary "sources dry; nothing to propose"
//   node scripts/routine-preflight.mjs error  --routine antcv-nightly --summary "relay 401 — token expired"
//   node scripts/routine-preflight.mjs report  [--days 14]     → print the recent ledger (health check)
//
// The ledger lives OUTSIDE the repo so writing it never dirties the tree the routine guards:
//   C:\Users\karpg\.claude\scheduled-tasks\ROUTINE_HEALTH.jsonl   (one JSON object per line)

import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER_DIR = join(os.homedir(), '.claude', 'scheduled-tasks');
const LEDGER = join(LEDGER_DIR, 'ROUTINE_HEALTH.jsonl');

function arg(name, def = null) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function sh(cmd) {
  try { return execSync(cmd, { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch { return ''; }
}
function log(obj) {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
  appendFileSync(LEDGER, JSON.stringify(obj) + '\n');
}
function now() { return new Date().toISOString(); }

const cmd = process.argv[2];
const routine = arg('routine', 'unknown-routine');

if (cmd === 'start') {
  const head = sh('git rev-parse --short HEAD');
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  const dirty = sh('git status --porcelain').length > 0;
  log({ ts: now(), routine, event: 'start', host: os.hostname(), branch, head, dirty });

  console.log(`[preflight] ${routine} start logged → ${LEDGER}`);
  console.log(`[preflight] branch=${branch} head=${head}`);
  if (dirty) {
    // A dirty shared tree is the collision hazard. Steer the routine into an isolated worktree.
    const stamp = Date.now().toString(36);
    const wt = join(os.tmpdir(), `antcv-routine-${routine}-${stamp}`);
    console.log('[preflight] WORKSPACE DIRTY — the owner (or another session) has uncommitted work here.');
    console.log('[preflight] Do NOT edit or rebase in this clone. Work in an isolated worktree instead:');
    console.log(`    git fetch origin && git worktree add "${wt}" origin/main`);
    console.log(`    cd "${wt}"`);
    console.log('[preflight] Run your task there; when done: git worktree remove "<path>". If you SHIP code, use scripts/shift.mjs claim from inside it.');
    process.exit(3); // non-zero, distinct: "clean-workspace preflight says use a worktree"
  } else {
    console.log('[preflight] WORKSPACE CLEAN — safe to SYNC FIRST (git pull --rebase origin main) and work in this clone.');
    process.exit(0);
  }
}

if (cmd === 'end' || cmd === 'error') {
  const status = cmd === 'error' ? 'error' : arg('status', 'ok');
  const summary = arg('summary', '');
  log({ ts: now(), routine, event: cmd, status, summary });
  console.log(`[preflight] ${routine} ${cmd} logged (status=${status}).`);
  process.exit(0);
}

if (cmd === 'report' || cmd === 'status') {
  const days = parseInt(arg('days', '14'), 10);
  const cutoff = Date.now() - days * 86400000;
  if (!existsSync(LEDGER)) { console.log('(no routine health ledger yet)'); process.exit(0); }
  const lines = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
  const rows = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(r => r && Date.parse(r.ts) >= cutoff);
  // Pair start→end per routine to surface runs that STARTED but never ended (crash/kill).
  console.log(`ROUTINE HEALTH — last ${days} days (${rows.length} events)\n`);
  for (const r of rows) {
    const tag = r.event === 'start' ? (r.dirty ? 'START(dirty)' : 'START')
      : r.event === 'error' ? 'ERROR'
      : `END(${r.status || 'ok'})`;
    console.log(`${r.ts}  ${r.routine.padEnd(28)} ${tag.padEnd(12)} ${r.summary || ''}`);
  }
  // Flag starts with no matching end (potential silent failure / crash).
  const starts = rows.filter(r => r.event === 'start');
  const ends = rows.filter(r => r.event === 'end' || r.event === 'error');
  const dangling = starts.filter(s => !ends.some(e => e.routine === s.routine && Date.parse(e.ts) >= Date.parse(s.ts)));
  if (dangling.length) {
    console.log('\n⚠ STARTED-BUT-NEVER-ENDED (crashed / killed / silent no-report):');
    for (const d of dangling) console.log(`   ${d.ts}  ${d.routine}`);
  }
  process.exit(0);
}

console.error('usage: routine-preflight.mjs <start|end|error|report> --routine <name> [--status ok|no-op] [--summary "..."] [--days N]');
process.exit(1);
