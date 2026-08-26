#!/usr/bin/env node
// check-register.mjs — REGISTER-HYGIENE-001 (owner-approved 2026-08-26).
//
// The register was one 524 KB file with two tables that had drifted apart: each carried its own
// date in its own column, five row numbers meant two different things, and closed rows sat in the
// open queue. A staleness scan for `verified:` therefore missed the OLDEST rows entirely — 18 and
// 25 sat 55 days stale while the nightly sweep rotated over rows a week old.
//
// The split fixed the state. This script keeps it fixed. It is cheap, has no dependencies, and
// runs in the PWA suite via pwa/test/unit/register-hygiene.test.mjs.
//
// Usage: node scripts/check-register.mjs [--quiet] [--dir <qa-dir>]
// Exit 0 = clean, 1 = violations (each printed with the file and the offending row).
// --dir points the checks at a different qa directory; the unit test uses it to run every check
// against deliberately sabotaged copies, so a green run proves the checks can actually fail.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dirArg = process.argv.indexOf('--dir');
const QA = dirArg > -1 && process.argv[dirArg + 1]
  ? process.argv[dirArg + 1]
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'qa');
const F = {
  index: join(QA, 'OPEN_REGISTER.md'),
  detail: join(QA, 'REGISTER_ACTIVE_DETAIL.md'),
  closed: join(QA, 'REGISTER_CLOSED.md'),
  runlog: join(QA, 'REGISTER_RUNLOG.md'),
};
// The index is the thing that has to stay scannable. 64 KB is ~4x its post-split size and ~1/8
// of the pre-split file — generous, but low enough to trip long before it is a monster again.
const INDEX_MAX_BYTES = 64 * 1024;

const problems = [];
const fail = (msg) => problems.push(msg);

for (const [k, p] of Object.entries(F)) {
  if (!existsSync(p)) fail(`missing register file: ${k} (${p})`);
}
if (problems.length) { report(); process.exit(1); }

const index = readFileSync(F.index, 'utf8');
const detail = readFileSync(F.detail, 'utf8');

// ---- the ACTIVE table -------------------------------------------------------
const activeSection = index.split(/^## ACTIVE\b.*$/m)[1];
if (!activeSection) fail('OPEN_REGISTER.md has no "## ACTIVE" section');

const rows = [];
if (activeSection) {
  for (const line of activeSection.split(/\r?\n/)) {
    const m = line.match(/^\|\s*([0-9]+[a-z]?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/);
    if (!m) continue;
    rows.push({ num: m[1], id: m[2].replace(/`/g, '').trim(), verified: m[3].trim(), scope: m[4].trim(), line });
  }
}
if (rows.length === 0) fail('OPEN_REGISTER.md ACTIVE table parsed to zero rows — the format changed');

// 1. row numbers unique. This is the one that bit us: two routines filing the same day both took
//    "the next number", so "row 40" meant both SO-003 and JOBSRC-FETCH-001.
const seenNum = new Map();
for (const r of rows) {
  if (seenNum.has(r.num)) fail(`duplicate ACTIVE row number ${r.num}: "${seenNum.get(r.num)}" and "${r.id || r.scope.slice(0, 40)}" — renumber the later filer and add it to the renumber map`);
  else seenNum.set(r.num, r.id || r.scope.slice(0, 40));
}

// 2. ticket IDs unique.
const seenId = new Map();
for (const r of rows) {
  if (!r.id || r.id === '—') continue;
  if (seenId.has(r.id)) fail(`ticket ${r.id} appears on ACTIVE rows ${seenId.get(r.id)} and ${r.num} — one ticket, one row`);
  else seenId.set(r.id, r.num);
}

// 3. every ACTIVE row carries exactly one parseable date (or an explicit never).
for (const r of rows) {
  const bare = r.verified.replace(/_\(STANDING\)_/, '').replace(/\*/g, '').trim();
  if (bare === 'never') continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bare)) {
    fail(`row ${r.num} (${r.id || 'no id'}) has verified="${r.verified}" — must be YYYY-MM-DD or **never**, so staleness can be ranked`);
  }
}

// 5. every ACTIVE row has its verbatim detail section.
const detailNums = new Set([...detail.matchAll(/^## Row ([0-9]+[a-z]?)\b/gm)].map((m) => m[1]));
const detailBody = new Map();
{
  const parts = detail.split(/^## Row ([0-9]+[a-z]?)\b/gm);
  for (let i = 1; i < parts.length; i += 2) detailBody.set(parts[i], parts[i + 1] || '');
}

// 4. no closed row lingering in ACTIVE. A row that announces closure and carries no open-work
//    marker anywhere in its FULL text belongs in REGISTER_CLOSED.md. Judge on the detail body,
//    not the index one-liner — the index line is truncated, and the marker that keeps a row open
//    ("REMAINING: the CL leg", "leg 3 still owed") usually sits past the truncation.
const OPEN_MARKER = /REMAINING|still owed|owed to|owed|partial|TO DO|owner-gated|owner-gate|owner verify|owner-verify|pending|BLOCKED|not started|open item|follow-up|follow-through|next run|re-verify|reverify|unverified|awaiting|NEEDS|live-verify|STANDING/i;
for (const r of rows) {
  const body = detailBody.get(r.num) || r.scope;
  const head = body.replace(/\*\*|`/g, '').slice(0, 400);
  if (/\b(CLOSED|FIXED|DONE)\b/.test(head) && !OPEN_MARKER.test(body)) {
    fail(`row ${r.num} (${r.id || 'no id'}) reads as finished with no open-work leg — move it to REGISTER_CLOSED.md`);
  }
}
for (const r of rows) {
  if (!detailNums.has(r.num)) fail(`row ${r.num} (${r.id || 'no id'}) is in the index with no "## Row ${r.num}" section in REGISTER_ACTIVE_DETAIL.md`);
}
// ...and no orphan detail section for a row that left the index.
for (const n of detailNums) {
  if (!seenNum.has(n)) fail(`REGISTER_ACTIVE_DETAIL.md has "## Row ${n}" but the index does not — closed rows move to REGISTER_CLOSED.md together with their detail`);
}

// 6. the index must stay scannable.
if (Buffer.byteLength(index, 'utf8') > INDEX_MAX_BYTES) {
  fail(`OPEN_REGISTER.md is ${(Buffer.byteLength(index, 'utf8') / 1024).toFixed(1)} KB, over the ${INDEX_MAX_BYTES / 1024} KB index cap — prose belongs in REGISTER_ACTIVE_DETAIL.md, run summaries in REGISTER_RUNLOG.md`);
}

// 7. run summaries must not creep back into the index.
if (/^> \*\*(CI |DESKTOP |JOB-TRACKER |DEMAND-SEED )?NIGHTLY/m.test(index) || /^> \*\*.*WEEKLY /m.test(index)) {
  fail('OPEN_REGISTER.md contains a run summary blockquote — those go to the top of REGISTER_RUNLOG.md');
}

function report() {
  if (problems.length === 0) return;
  console.error('REGISTER HYGIENE — ' + problems.length + ' problem(s):');
  for (const p of problems) console.error('  - ' + p);
}

if (problems.length) { report(); process.exit(1); }
if (!process.argv.includes('--quiet')) {
  console.log(`register OK — ${rows.length} ACTIVE rows, ${detailNums.size} detail sections, index ${(Buffer.byteLength(index, 'utf8') / 1024).toFixed(1)} KB`);
}
