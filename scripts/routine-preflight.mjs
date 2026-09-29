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
//   node scripts/routine-preflight.mjs token                    → token-health only (offline; exit 4 if unusable)
//
// TOKEN HEALTH + DISPATCH GAP (added 2026-09-29, third recurrence of the same failure):
// every relay-backed routine authenticates with the owner's PWA JWT at ~/.antcv/token. That token
// carries a plain 7-day TTL and only self-renews when a routine CALLS the relay inside the 6-day
// SESSION_REFRESH_WINDOW — so a stretch of missed dispatches kills it, and the next run discovers
// that only by eating a 401 mid-task. It has died this way three times (ANTCV-TOKEN-EXPIRED-
// 2026-08-14-001 on 08-14, again after the 08-26 re-save, found dead 27d later on 09-29 behind a
// 33-day dispatch gap). `start` now decodes the token LOCALLY (no network, no signature check,
// never prints the token) and reports days-to-expiry, warning while it is still re-savable rather
// than after it is dead; it also reports days since this routine's own previous start, which is
// the other half of the failure. Both are ADVISORY: they never change `start`'s exit code, so the
// clean(0)/dirty(3) contract every routine depends on is untouched.
//
// The ledger lives OUTSIDE the repo so writing it never dirties the tree the routine guards:
//   C:\Users\karpg\.claude\scheduled-tasks\ROUTINE_HEALTH.jsonl   (one JSON object per line)

import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = process.env.ANTCV_ROUTINE_LEDGER || join(os.homedir(), '.claude', 'scheduled-tasks', 'ROUTINE_HEALTH.jsonl');
const LEDGER_DIR = dirname(LEDGER);
const TOKEN_FILE = process.env.ANTCV_TOKEN_FILE || join(os.homedir(), '.antcv', 'token');
const EXPIRY_WARN_DAYS = 3;   // warn this far ahead — inside the 6d self-renewal window
const GAP_WARN_DAYS = 3;      // a routine that has not fired in this long cannot refresh the token

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

// --- token health: decode the stored PWA JWT LOCALLY. No network, no signature verification
// (this is an advisory expiry read, not an auth decision — the relay stays the authority), and
// the token value itself is never printed or logged.
function tokenHealth() {
  if (!existsSync(TOKEN_FILE)) return { state: 'missing', reason: 'no file at ' + TOKEN_FILE };
  let raw = '';
  try { raw = readFileSync(TOKEN_FILE, 'utf8').trim(); } catch (e) { return { state: 'unreadable', reason: e.message }; }
  if (!raw) return { state: 'missing', reason: 'file is empty' };
  const parts = raw.split('.');
  if (parts.length !== 3) return { state: 'unparseable', reason: `expected 3 JWT segments, got ${parts.length}` };
  let payload;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8'));
  } catch (e) { return { state: 'unparseable', reason: 'payload is not base64url JSON' }; }
  if (typeof payload.exp !== 'number') return { state: 'unparseable', reason: 'payload carries no numeric exp' };
  const expMs = payload.exp * 1000;
  const days = (expMs - Date.now()) / 86400000;
  const expIso = new Date(expMs).toISOString().replace('.000Z', 'Z');
  const state = days <= 0 ? 'expired' : days <= EXPIRY_WARN_DAYS ? 'expiring' : 'ok';
  return { state, expIso, days, email: payload.email || payload.sub || null };
}

const RESAVE_RECIPE = 'OWNER: re-save the token — on https://antcv.pages.dev (signed in) run '
  + "copy(localStorage.getItem('antcv:auth:token')) in the console, paste into "
  + TOKEN_FILE + ' (no trailing newline).';

function printTokenHealth(t) {
  const who = t.email ? ` [${t.email}]` : '';
  if (t.state === 'ok') {
    console.log(`[preflight] TOKEN OK — expires ${t.expIso} (${t.days.toFixed(1)}d left)${who}`);
  } else if (t.state === 'expiring') {
    console.log(`[preflight] TOKEN EXPIRING in ${t.days.toFixed(1)}d (${t.expIso})${who} — still valid, so a relay call THIS run self-renews it.`);
    console.log(`[preflight] ${RESAVE_RECIPE}`);
  } else if (t.state === 'expired') {
    console.log(`[preflight] TOKEN EXPIRED ${Math.abs(t.days).toFixed(0)}d ago (${t.expIso})${who} — every relay-backed step will 401. Self-renewal cannot recover a dead token; only a manual re-save can.`);
    console.log(`[preflight] ${RESAVE_RECIPE}`);
  } else {
    console.log(`[preflight] TOKEN ${t.state.toUpperCase()} — ${t.reason}`);
    console.log(`[preflight] ${RESAVE_RECIPE}`);
  }
}

// --- dispatch gap: how long since THIS routine's own previous start. A routine that stops firing
// is why the token dies (its own relay calls are what refresh it), so report the gap rather than
// assume a cadence the ledger does not record.
function dispatchGap(routineName) {
  if (!existsSync(LEDGER)) return null;
  let lines = [];
  try { lines = readFileSync(LEDGER, 'utf8').split(/\r?\n/).filter(Boolean); } catch { return null; }
  let prev = null;
  for (const l of lines) {
    let r; try { r = JSON.parse(l); } catch { continue; }
    if (r && r.routine === routineName && r.event === 'start') {
      const t = Date.parse(r.ts);
      if (Number.isFinite(t) && (prev === null || t > prev)) prev = t;
    }
  }
  if (prev === null) return null;
  return { prevIso: new Date(prev).toISOString(), days: (Date.now() - prev) / 86400000 };
}

const cmd = process.argv[2];
const routine = arg('routine', 'unknown-routine');

if (cmd === 'start') {
  const head = sh('git rev-parse --short HEAD');
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  const dirty = sh('git status --porcelain').length > 0;
  // Read the gap BEFORE logging this run's own start line, or it would find itself at 0 days.
  const gap = dispatchGap(routine);
  const tok = tokenHealth();
  log({ ts: now(), routine, event: 'start', host: os.hostname(), branch, head, dirty, token: tok.state, token_exp: tok.expIso || null });

  console.log(`[preflight] ${routine} start logged → ${LEDGER}`);
  console.log(`[preflight] branch=${branch} head=${head}`);
  printTokenHealth(tok);
  if (gap) {
    const tag = gap.days >= GAP_WARN_DAYS ? 'DISPATCH GAP' : 'last run';
    console.log(`[preflight] ${tag} — previous start ${gap.prevIso} (${gap.days.toFixed(1)}d ago)`);
    if (gap.days >= GAP_WARN_DAYS) {
      console.log('[preflight] A routine that stops firing cannot refresh the token (6d self-renewal window) — report the gap to the owner, routines are desktop-app-local.');
    }
  } else {
    console.log('[preflight] no previous start for this routine in the ledger (first run, or ledger rotated)');
  }
  if (dirty) {
    // A dirty shared tree is the collision hazard. Steer the routine into an isolated worktree.
    // The worktree goes under <repo>/.claude/worktrees/ (gitignored), NOT os.tmpdir(): %TEMP% is
    // outside the project dir, so every command there needs a permission prompt, and an unattended
    // run stalls on the first one (relay-cost-quality-tune 09-17 + 09-23 died 6-18s after start).
    const stamp = Date.now().toString(36);
    const wt = join(REPO, '.claude', 'worktrees', `routine-${routine}-${stamp}`).replace(/\\/g, '/');
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

if (cmd === 'token') {
  const t = tokenHealth();
  printTokenHealth(t);
  process.exit(t.state === 'ok' || t.state === 'expiring' ? 0 : 4);
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

console.error('usage: routine-preflight.mjs <start|end|error|report|token> --routine <name> [--status ok|no-op] [--summary "..."] [--days N]');
process.exit(1);
