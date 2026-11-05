// jobtracker-outcomes.test.mjs
// OUTCOME-RECORD-001 (2026-11-05): the Job Tracker records outcomes. A status change is
// dated into status_history[uk] (Interview entries carry a stage), terminal outcomes (Hired,
// Offer declined, No response, Withdrawn) are closed, a Submitted row shows its
// submitted-on date and a follow-up-due badge from followups[uk] (written by
// followups.py too), and the Top-5 card shows financials[uk].summary with its CHECK note.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  recordStatus, interviewStage, statusSince, followUpState, stampSubmitted, setSubmitted, logSent,
  financialsView, dayOf, daysBetween, localDay, historyList, INTERVIEW_STAGES, statusHistoryOf, recordStatusIn,
} from '../../../src/islands/JobTracker/outcomes.ts';
import { closedBucket, isClosedRow, visBucket } from '../../../src/islands/JobTracker/rowVisibility.ts';
import { mergeDocs, MERGE_MAPS } from '../../../src/islands/JobTracker/mergeDocs.ts';
import { TRACKED_STATUSES } from '../../../src/islands/JobTracker/api.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const row = (status, band = 'DDEBF7', flag = '') => [1, 'Acme', 'PM', '', '', '', '', '', status, '', flag, 'a', band];

// ---- statuses -------------------------------------------------------------------
test('every older status string is kept and the four outcomes are added', () => {
  for (const s of ['Not started', 'Identified (posting saved)', 'CV/CL drafting', 'CV/CL drafted', 'Submitted',
    'Interview', 'Offer', 'Rejected', 'Archive / closed']) assert.ok(TRACKED_STATUSES.includes(s), s);
  for (const s of ['No response', 'Withdrawn', 'Offer declined', 'Hired']) assert.ok(TRACKED_STATUSES.includes(s), s);
  assert.deepEqual(INTERVIEW_STAGES, ['screening', '1st', '2nd', 'final', 'case']);
});

test('terminal outcomes are closed: out of Top-5 and into the right legend box', () => {
  assert.equal(closedBucket(row('Offer declined')), 'rejected');
  assert.equal(isClosedRow(row('Offer declined')), true, 'Top-5 used to keep a declined row');
  for (const s of ['No response', 'Hired', 'Withdrawn']) {
    assert.equal(isClosedRow(row(s)), true, s);
    assert.equal(visBucket(row(s)), 'archive', s);
  }
  for (const s of ['Submitted', 'Interview', 'Offer']) assert.equal(visBucket(row(s)), 'progress', s);
});

test('gen-runner.py is_closed_row reads the same status regex as the island', () => {
  const isl = readFileSync(join(ROOT, 'src', 'islands', 'JobTracker', 'rowVisibility.ts'), 'utf8')
    .match(/\/(rejected\|[^/]+)\/i\.test\(cell\(r, TRACKED\)\)/);
  const py = readFileSync(join(ROOT, 'scripts', 'job-tracker', 'gen-runner.py'), 'utf8')
    .match(/def is_closed_row[\s\S]*?_re\.search\(r"([^"]+)"/);
  assert.ok(isl && py, 'both regexes found');
  assert.equal(py[1], isl[1]);
});

// ---- dated history --------------------------------------------------------------
test('a status change is appended with its date; repeating it is a no-op', () => {
  let h = recordStatus({}, 'a', 'Submitted', '2026-10-20');
  h = recordStatus(h, 'a', 'Interview', '2026-11-02');
  assert.deepEqual(h.a, [{ status: 'Submitted', date: '2026-10-20' }, { status: 'Interview', date: '2026-11-02' }]);
  assert.deepEqual(recordStatus(h, 'a', 'Interview', '2026-11-03').a, h.a);
  assert.equal(statusSince(h.a, 'Interview'), '2026-11-02');
  assert.equal(statusSince(h.a, 'Offer'), '');
});

test('interview stages: a same-day pick refines the entry, a later stage is a new dated entry', () => {
  let h = recordStatus({}, 'a', 'Interview', '2026-11-02');
  h = recordStatus(h, 'a', 'Interview', '2026-11-02', 'screening');
  assert.deepEqual(h.a, [{ status: 'Interview', date: '2026-11-02', stage: 'screening' }]);
  h = recordStatus(h, 'a', 'Interview', '2026-11-09', '2nd');
  assert.equal(h.a.length, 2);
  assert.equal(interviewStage(h.a), '2nd');
  h = recordStatus(h, 'a', 'Rejected', '2026-11-12');
  assert.equal(interviewStage(h.a), '', 'no stage once the row left Interview');
});

test('a same-day switch back drops the mis-pick instead of logging it', () => {
  let h = recordStatus({ a: [{ status: 'Submitted', date: '2026-10-20' }] }, 'a', 'Interview', '2026-11-05');
  h = recordStatus(h, 'a', 'Submitted', '2026-11-05');
  assert.deepEqual(h.a, [{ status: 'Submitted', date: '2026-10-20' }]);
});

test('unreadable history entries from another writer are dropped, other rows untouched', () => {
  const h = recordStatus({ a: [null, { status: 'X' }, { status: 'Submitted', date: '2026-13-01' }], b: [{ status: 'Offer', date: '2026-11-01' }] },
    'a', 'Submitted', '2026-11-05');
  assert.deepEqual(h.a, [{ status: 'Submitted', date: '2026-11-05' }]);
  assert.deepEqual(h.b, [{ status: 'Offer', date: '2026-11-01' }]);
  assert.deepEqual(historyList('junk'), []);
});

// ---- follow-up clock (mirrors followups.py due) -------------------------------------
test('due = Submitted, 10+ days since submitted, fewer than 2 sent', () => {
  const rec = { submitted: '2026-10-20', submitted_source: 'first-seen', sent: [] };
  assert.equal(followUpState(rec, 'Interview', '2026-11-05'), null);
  assert.equal(followUpState(rec, 'Submitted', '2026-10-29').due, false);
  const f = followUpState(rec, ' Submitted ', '2026-10-30');
  assert.equal(f.due, true); assert.equal(f.quiet, 10); assert.equal(f.since, '2026-10-20'); assert.equal(f.last, false);
  assert.equal(f.source, 'first-seen');
});

test('the clock restarts at the last follow-up; the second is the last; a third is never due', () => {
  const one = { submitted: '2026-10-01', sent: ['2026-10-15'] };
  assert.equal(followUpState(one, 'Submitted', '2026-10-24').due, false);
  const f = followUpState(one, 'Submitted', '2026-10-25');
  assert.equal(f.due, true); assert.equal(f.last, true); assert.equal(f.since, '2026-10-15');
  assert.equal(followUpState({ submitted: '2026-09-01', sent: ['2026-09-11', '2026-09-21'] }, 'Submitted', '2026-11-05').due, false);
});

test('no readable submitted date: shown as missing, never due', () => {
  const f = followUpState({ submitted: 'soon' }, 'Submitted', '2026-11-05');
  assert.equal(f.submitted, null); assert.equal(f.due, false);
  assert.equal(followUpState(undefined, 'Submitted', '2026-11-05').due, false);
});

test('writers: stamp keeps an existing date, the owner date wins, a third follow-up is refused', () => {
  const fu = { a: { submitted: '2026-10-01', submitted_source: 'owner', sent: [] } };
  assert.deepEqual(stampSubmitted(fu, 'a', '2026-11-05'), fu);
  assert.deepEqual(stampSubmitted({}, 'b', '2026-11-05').b, { submitted: '2026-11-05', submitted_source: 'first-seen' });
  assert.deepEqual(setSubmitted({ b: { submitted: '2026-11-05', submitted_source: 'first-seen', thanks: ['2026-11-06'] } }, 'b', '2026-11-01').b,
    { submitted: '2026-11-01', submitted_source: 'owner', thanks: ['2026-11-06'] });
  assert.deepEqual(setSubmitted(fu, 'a', ''), fu, 'an empty date input changes nothing');
  let m = logSent(fu, 'a', '2026-11-05');
  m = logSent(m, 'a', '2026-11-15');
  assert.deepEqual(m.a.sent, ['2026-11-05', '2026-11-15']);
  assert.deepEqual(logSent(m, 'a', '2026-11-25').a.sent, ['2026-11-05', '2026-11-15']);
});

test('dates: real calendar days only, day counts across DST are whole', () => {
  assert.equal(dayOf('2026-02-30'), null);
  assert.equal(dayOf('2026-10-20T09:00:00Z'), '2026-10-20');
  assert.equal(daysBetween('2026-10-20', '2026-10-30'), 10);
  assert.equal(daysBetween('2026-03-20', '2026-04-05'), 16);
  assert.equal(localDay(new Date(2026, 10, 5, 0, 30)), '2026-11-05');
});

// ---- financials -----------------------------------------------------------------
test('financials: the CHECK note is split out so truncation never hides it', () => {
  const v = financialsView({ summary: "Acme A/S annual report 2024-01-01..2024-12-31: Revenue DKK 1.2bn (+5% y/y). Source: Erhvervsstyrelsen filing via Virk (the figures Proff shows). CHECK: filed under 'Acme Holding A/S', not 'Acme'." });
  assert.match(v.text, /^Acme A\/S annual report/);
  assert.ok(!v.text.includes('CHECK'));
  assert.equal(v.check, "CHECK: filed under 'Acme Holding A/S', not 'Acme'.");
  assert.deepEqual(financialsView({ summary: 'Acme: revenue.' }), { text: 'Acme: revenue.', check: '', error: '' });
  assert.equal(financialsView({ error: 'no annual report found' }).error, 'no annual report found');
  assert.equal(financialsView({ cvr: '12345678' }), null);
  assert.equal(financialsView('junk'), null);
});

// ---- OUTCOME-RECORD-002: the legacy `history` key ----------------------------------
// The first tracker design (JOB-TRACKER-001) kept a workbook history[] ARRAY in the doc.
// 1.51.5342 wrote the status map over that key; the map is status_history now.
const LEGACY = [{ week: '2026-W27', note: 'workbook history sheet row' }];

test('a legacy history array survives a dated status change', () => {
  const doc = { rows: [row('Submitted')], history: LEGACY };
  const sh = recordStatusIn(doc, 'a', 'Interview', '2026-11-05');
  assert.deepEqual(sh.a, [{ status: 'Interview', date: '2026-11-05' }]);
  assert.deepEqual(doc.history, LEGACY);
  assert.deepEqual(statusHistoryOf(doc, 'a'), []);
});

test('entries 1.51.5342 saved under a map-shaped history are still read and carried over', () => {
  const doc = { history: { a: [{ status: 'Submitted', date: '2026-11-05' }] } };
  assert.deepEqual(statusHistoryOf(doc, 'a'), [{ status: 'Submitted', date: '2026-11-05' }]);
  assert.deepEqual(recordStatusIn(doc, 'a', 'Interview', '2026-11-06', '1st').a.map((e) => e.status), ['Submitted', 'Interview']);
  const both = { status_history: { a: [{ status: 'Offer', date: '2026-11-07' }] }, history: doc.history };
  assert.deepEqual(recordStatusIn(both, 'a', 'Hired', '2026-11-08').a.map((e) => e.status), ['Offer', 'Hired'], 'status_history wins');
  assert.deepEqual(recordStatusIn({}, 'b', 'Submitted', '2026-11-05'), { b: [{ status: 'Submitted', date: '2026-11-05' }] });
});

test('a conflict rebase never turns an array into an object', () => {
  const base = { rows: [], history: LEGACY, urls: { a: 'u' } };
  const local = { rows: [], history: LEGACY, urls: { a: 'u', b: 'v' } };
  const server = { rows: [], history: [...LEGACY, { week: '2026-W28' }], urls: { a: 'u' } };
  const out = mergeDocs(server, local, base);
  assert.ok(Array.isArray(out.history));
  assert.deepEqual(out.history, server.history);
  assert.deepEqual(out.urls, { a: 'u', b: 'v' });
});

// ---- 409 rebase -----------------------------------------------------------------
test('a conflict rebase keeps history and follow-ups written elsewhere', () => {
  assert.ok(MERGE_MAPS.includes('status_history') && MERGE_MAPS.includes('followups'));
  assert.ok(!MERGE_MAPS.includes('history'), 'the legacy workbook key is never merged as a map');
  const r = row('Submitted');
  const base = { rows: [r], status_history: { a: [{ status: 'Submitted', date: '2026-10-20' }] },
    followups: { a: { submitted: '2026-10-20', submitted_source: 'first-seen', sent: [] } } };
  // followups.py logged a follow-up; the island's tab set the real submitted date and moved the row on.
  const server = { ...base, followups: { a: { ...base.followups.a, sent: ['2026-11-01'] } } };
  const local = { rows: [row('Interview')],
    status_history: { a: [...base.status_history.a, { status: 'Interview', date: '2026-11-05' }] },
    followups: { a: { submitted: '2026-10-18', submitted_source: 'owner', sent: [] } } };
  const out = mergeDocs(server, local, base);
  assert.deepEqual(out.followups.a, { submitted: '2026-10-18', submitted_source: 'owner', sent: ['2026-11-01'] });
  assert.deepEqual(out.status_history.a, local.status_history.a);
  assert.equal(out.rows[0][8], 'Interview');
});

test('a conflict rebase interleaves history entries both sides added, by date', () => {
  const base = { rows: [], status_history: { a: [{ status: 'Submitted', date: '2026-10-20' }] } };
  const server = { rows: [], status_history: { a: [...base.status_history.a, { status: 'Interview', date: '2026-11-02', stage: '1st' }] } };
  const local = { rows: [], status_history: { a: [...base.status_history.a, { status: 'Interview', date: '2026-11-09', stage: '2nd' }] } };
  assert.deepEqual(mergeDocs(server, local, base).status_history.a.map((e) => e.date), ['2026-10-20', '2026-11-02', '2026-11-09']);
});

// ---- wiring ---------------------------------------------------------------------
test('JobTracker.tsx: the status select dates the change instead of a bare cell edit', () => {
  const tsx = readFileSync(join(ROOT, 'src', 'islands', 'JobTracker', 'JobTracker.tsx'), 'utf8');
  assert.match(tsx, /<select value=\{r\[8\]\} onChange=\{\(e\) => setStatus\(uk, e\.target\.value\)\}/);
  assert.doesNotMatch(tsx, /editRow\(uk, 8,/);
  assert.match(tsx, /<OutcomeCell status=\{r\[8\]\}/);
  assert.match(tsx, /status_history: recordStatusIn\(doc, uk, 'Archive \/ closed', localDay\(\)\)/, 'Reject is dated too');
  assert.doesNotMatch(tsx, /[^_]history: /, 'the island never writes the legacy history key');
  assert.match(tsx, /financialsView\(\(doc\?\.financials \|\| \{\}\)\[uk\]\)/);
});
