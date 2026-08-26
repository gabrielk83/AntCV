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
    f['OPEN_REGISTER.md'] = before.replace(/^\| 25 \| `TABLE-GEOMETRY-PARITY-001` \| 2026-07-02 \|/m,
      '| 25 | `TABLE-GEOMETRY-PARITY-001` | no |');
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

test('the split actually happened: index is small, detail carries the prose', () => {
  const idx = readFileSync(join(QA, 'OPEN_REGISTER.md'), 'utf8');
  const det = readFileSync(join(QA, 'REGISTER_ACTIVE_DETAIL.md'), 'utf8');
  const log = readFileSync(join(QA, 'REGISTER_RUNLOG.md'), 'utf8');
  assert.ok(Buffer.byteLength(idx) < 64 * 1024, 'index must stay scannable');
  assert.ok(det.length > idx.length * 4, 'the prose belongs in the detail file');
  assert.ok(log.length > 100 * 1024, 'the run-log carries the historical run summaries');
});
