// register-hygiene.test.mjs
// ============================================================
// REGISTER-HYGIENE-001 (owner-approved 2026-08-26).
//
// The register was one 524 KB file: a 226 KB run-log header, two tables that had drifted apart
// (each carrying its own date in its own column), five row numbers that meant two different
// things, and closed rows sitting in the open queue. A staleness scan for `verified:` therefore
// missed the OLDEST rows — 18 and 25 sat 55 days stale while the sweep rotated over week-old rows.
//
// The split fixed the state; `scripts/check-register.mjs` keeps it fixed. This test asserts the
// real register is clean AND — the part that matters — sabotages a copy once per rule to prove
// each check can actually fail. A checker that cannot fail is worse than no checker: it reports
// green forever while the file rots.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
function dirname(p) { return p.slice(0, p.lastIndexOf('/') > -1 ? p.lastIndexOf('/') : p.lastIndexOf('\\')); }
const SCRIPT = join(ROOT, 'scripts', 'check-register.mjs');
const QA = join(ROOT, 'docs', 'qa');
const FILES = ['OPEN_REGISTER.md', 'REGISTER_ACTIVE_DETAIL.md', 'REGISTER_CLOSED.md', 'REGISTER_RUNLOG.md'];

function run(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir, '--quiet'], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

// Copy the real register into a temp dir, apply one sabotage, and run the checker there.
function sabotage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'antcv-register-'));
  try {
    const files = {};
    for (const f of FILES) files[f] = readFileSync(join(QA, f), 'utf8');
    mutate(files);
    for (const f of FILES) writeFileSync(join(dir, f), files[f], 'utf8');
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the real register passes every hygiene check', () => {
  const r = run(QA);
  assert.equal(r.ok, true, 'check-register.mjs failed on the committed register:\n' + r.out);
});

test('control: an unmodified COPY also passes (the harness itself is not what makes it fail)', () => {
  const r = sabotage(() => {});
  assert.equal(r.ok, true, 'a verbatim copy should pass:\n' + r.out);
});

test('catches a duplicate ACTIVE row number — the collision that made "row 40" ambiguous', () => {
  const r = sabotage((f) => {
    const lines = f['OPEN_REGISTER.md'].split(/\r?\n/);
    const i = lines.findIndex((l) => /^\| 25 \|/.test(l));
    assert.ok(i > -1, 'fixture drift: no row 25 line to duplicate');
    lines.splice(i + 1, 0, lines[i]);
    f['OPEN_REGISTER.md'] = lines.join('\r\n');
  });
  assert.equal(r.ok, false, 'duplicate row number must fail');
  assert.match(r.out, /duplicate ACTIVE row number 25/);
});

test('catches the same ticket ID on two rows', () => {
  const r = sabotage((f) => {
    const lines = f['OPEN_REGISTER.md'].split(/\r?\n/);
    const i = lines.findIndex((l) => /^\| 25 \|.*TABLE-GEOMETRY-PARITY-001/.test(l));
    assert.ok(i > -1, 'fixture drift: no row 25 TABLE-GEOMETRY line');
    lines.splice(i + 1, 0, lines[i].replace(/^\| 25 \|/, '| 999 |'));
    f['OPEN_REGISTER.md'] = lines.join('\r\n');
    f['REGISTER_ACTIVE_DETAIL.md'] += '\r\n## Row 999 — TABLE-GEOMETRY-PARITY-001\r\n\r\nstub\r\n';
  });
  assert.equal(r.ok, false, 'duplicate ticket ID must fail');
  assert.match(r.out, /TABLE-GEOMETRY-PARITY-001 appears on ACTIVE rows/);
});

test('catches an unrankable verified cell — the "no" that hid 55 days of staleness', () => {
  const r = sabotage((f) => {
    const before = f['OPEN_REGISTER.md'];
    // Match row 25's verified cell DATE-AGNOSTICALLY (capture the ID prefix, drop the date) — a
    // hardcoded date here rots the moment the row is legitimately re-dated by a staleness sweep,
    // which is exactly what broke this negative control after the 2026-09-07 sweep re-dated row 25.
    f['OPEN_REGISTER.md'] = before.replace(
      /^(\| 25 \| `TABLE-GEOMETRY-PARITY-001` \|) [0-9]{4}-[0-9]{2}-[0-9]{2} \|/m,
      '$1 no |');
    assert.notEqual(f['OPEN_REGISTER.md'], before, 'fixture drift: row 25 verified cell not found');
  });
  assert.equal(r.ok, false, 'a non-date verified cell must fail');
  assert.match(r.out, /must be YYYY-MM-DD or \*\*never\*\*/);
});

test('catches an index row with no detail section', () => {
  const r = sabotage((f) => {
    f['OPEN_REGISTER.md'] = f['OPEN_REGISTER.md'].replace(
      /^\| 25 \|/m, '| 998 | `INVENTED-ROW-001` | 2026-01-01 | invented |\r\n| 25 |');
  });
  assert.equal(r.ok, false, 'an index row with no detail must fail');
  assert.match(r.out, /row 998 .* no "## Row 998" section/);
});

test('catches an orphan detail section for a row that left the index', () => {
  const r = sabotage((f) => {
    f['REGISTER_ACTIVE_DETAIL.md'] += '\r\n## Row 997 — ORPHANED-001\r\n\r\nstub\r\n';
  });
  assert.equal(r.ok, false, 'an orphan detail section must fail');
  assert.match(r.out, /"## Row 997" but the index does not/);
});

test('catches a finished row still sitting in ACTIVE', () => {
  const r = sabotage((f) => {
    const before = f['REGISTER_ACTIVE_DETAIL.md'];
    // Note: the replacement text must contain no open-work marker at all — "nothing left to do"
    // trips the case-insensitive `TO DO` marker and silently makes this control pass.
    f['REGISTER_ACTIVE_DETAIL.md'] = before.replace(
      /^## Row 25\b[\s\S]*?(?=^## Row )/m,
      '## Row 25 — TABLE-GEOMETRY-PARITY-001\r\n\r\n_verified: 2026-07-02_\r\n\r\nCLOSED 1.51.999. Shipped and verified.\r\n\r\n');
    assert.notEqual(f['REGISTER_ACTIVE_DETAIL.md'], before, 'fixture drift: row 25 detail section not replaced');
  });
  assert.equal(r.ok, false, 'a fully-closed ACTIVE row must fail');
  assert.match(r.out, /row 25 .* reads as finished/);
});

test('catches the index growing back into a monster', () => {
  const r = sabotage((f) => {
    f['OPEN_REGISTER.md'] += '\r\n' + 'x'.repeat(70 * 1024);
  });
  assert.equal(r.ok, false, 'an oversized index must fail');
  assert.match(r.out, /over the 64 KB index cap/);
});

test('catches a run summary pasted back into the index', () => {
  const r = sabotage((f) => {
    f['OPEN_REGISTER.md'] += '\r\n> **CI NIGHTLY 2026-09-01 — suite green, nothing shipped.**\r\n';
  });
  assert.equal(r.ok, false, 'a run summary in the index must fail');
  assert.match(r.out, /run summary blockquote/);
});

test('catches a missing register file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'antcv-register-'));
  try {
    for (const f of FILES.filter((x) => x !== 'REGISTER_RUNLOG.md')) {
      writeFileSync(join(dir, f), readFileSync(join(QA, f), 'utf8'), 'utf8');
    }
    const r = run(dir);
    assert.equal(r.ok, false, 'a missing file must fail');
    assert.match(r.out, /missing register file: runlog/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// REGISTER-STALEST-SCAN-MISS-001 (2026-10-05): the index is not kept sorted, so the E1 sweep takes
// its list from --stalest. The first two cases build a tiny register where the OLDEST row sits LAST.
function stalest(indexRows, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'antcv-register-'));
  try {
    const idx = '# r\n\n## ACTIVE — stalest first\n\n| # | ID | verified | scope |\n|---|---|---|---|\n' +
      indexRows.map((r) => '| ' + r[0] + ' | `' + r[1] + '` | ' + r[2] + ' | scope, REMAINING: work |').join('\n') + '\n';
    const det = indexRows.map((r) => '## Row ' + r[0] + ' — ' + r[1] + '\n\nREMAINING: work\n').join('\n');
    writeFileSync(join(dir, 'OPEN_REGISTER.md'), idx, 'utf8');
    writeFileSync(join(dir, 'REGISTER_ACTIVE_DETAIL.md'), det, 'utf8');
    writeFileSync(join(dir, 'REGISTER_CLOSED.md'), '# closed\n', 'utf8');
    writeFileSync(join(dir, 'REGISTER_RUNLOG.md'), '# runlog\n', 'utf8');
    const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir, '--stalest', ...args], { encoding: 'utf8' });
    return { status: r.status, lines: (r.stdout || '').trim().split(/\r?\n/).filter(Boolean), err: r.stderr || '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('--stalest ranks on the verified column, not on table position', () => {
  const r = stalest([
    ['1', 'NEW-001', '2026-10-01'],
    ['2', 'MID-001', '2026-09-15'],
    ['3', 'ANCHOR-001', '2026-07-01 _(STANDING)_'],
    ['4', 'OLD-001', '2026-08-26'],
  ], ['2']);
  assert.equal(r.status, 0, r.err);
  assert.deepEqual(r.lines, ['2026-08-26  row 4  OLD-001', '2026-09-15  row 2  MID-001'],
    'oldest row first although it sits last; the STANDING anchor is skipped');
});

test('--stalest puts a never-verified row first and defaults to 5 rows', () => {
  const r = stalest([
    ['1', 'A-001', '2026-10-01'], ['2', 'B-001', '2026-10-02'], ['3', 'C-001', '2026-10-03'],
    ['4', 'D-001', '2026-10-04'], ['5', 'E-001', '2026-10-05'], ['6', 'F-001', '**never**'],
  ]);
  assert.equal(r.status, 0, r.err);
  assert.equal(r.lines.length, 5);
  assert.equal(r.lines[0], '0000-00-00  row 6  F-001');
  assert.equal(r.lines[4], '2026-10-04  row 4  D-001');
});

test('--stalest on the real register lists only non-STANDING rows in date order', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--stalest', '8'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split(/\r?\n/);
  const dates = lines.map((l) => l.slice(0, 10));
  assert.equal(dates.length, 8);
  assert.deepEqual(dates, [...dates].sort(), 'ascending by verified date');
  const index = readFileSync(join(QA, 'OPEN_REGISTER.md'), 'utf8').split(/\r?\n/);
  for (const l of lines) {
    const num = l.match(/row (\S+)/)[1];
    const row = index.find((x) => x.startsWith('| ' + num + ' |'));
    assert.ok(row && !row.includes('_(STANDING)_'), 'row ' + num + ' is a real, non-STANDING index row');
  }
});

test('the split actually happened: index is small, detail carries the prose', () => {
  const idx = readFileSync(join(QA, 'OPEN_REGISTER.md'), 'utf8');
  const det = readFileSync(join(QA, 'REGISTER_ACTIVE_DETAIL.md'), 'utf8');
  const log = readFileSync(join(QA, 'REGISTER_RUNLOG.md'), 'utf8');
  assert.ok(Buffer.byteLength(idx) < 64 * 1024, 'index must stay scannable');
  assert.ok(det.length > idx.length * 4, 'the prose belongs in the detail file');
  assert.ok(log.length > 100 * 1024, 'the run-log carries the historical run summaries');
});
