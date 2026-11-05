// jobtracker-submitted-prep.test.mjs
// SUBMITTED-VERSION-001 / INTERVIEW-PREP-001 (2026-11-05). Owner: "allow to save and
// mark the submitted version" and "support for positions that are advancing towards an
// interview". The tracker records each saved submitted version in submitted[uk] (the
// payload lives in the relay's insert-only application_snapshot table), shows the prep
// pack a script writes to interview[uk], keeps the owner's next-stage date in
// interview_next[uk], and shows the clearance gate's eligibility[uk] verdict.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  submittedList, addSubmitted, interviewPack, nextStageOf, setNextStage, eligibilityView, mdBlocks, mdInline, PREP_SCRIPT, prepCommands,
} from '../../../src/islands/JobTracker/outcomes.ts';
import { mergeDocs, MERGE_MAPS } from '../../../src/islands/JobTracker/mergeDocs.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TSX = readFileSync(join(ROOT, 'src', 'islands', 'JobTracker', 'JobTracker.tsx'), 'utf8');
const API = readFileSync(join(ROOT, 'src', 'islands', 'JobTracker', 'api.ts'), 'utf8');

// ---- submitted versions -----------------------------------------------------------
test('a re-submission adds a version; earlier ones stay; the top level is the newest', () => {
  let m = addSubmitted({}, 'acme', { snapshot_id: 11, date: '2026-11-01', application_id: 7 });
  m = addSubmitted(m, 'acme', { snapshot_id: 15, date: '2026-11-05', application_id: 8 });
  assert.deepEqual(m.acme.versions.map((s) => s.snapshot_id), [11, 15]);
  // interview_prep.py gather() reads sub.get("application_id") off this object: the newest save.
  assert.equal(Array.isArray(m.acme), false);
  assert.deepEqual([m.acme.snapshot_id, m.acme.date, m.acme.application_id], [15, '2026-11-05', 8]);
  assert.deepEqual(submittedList(m.acme).map((s) => s.snapshot_id), [11, 15]);
  assert.deepEqual(addSubmitted(m, 'beta', { snapshot_id: 16, date: '2026-11-05', application_id: null }).acme, m.acme);
});

test('submitted reader: object with versions, a bare object, a bare list; bad entries dropped', () => {
  assert.deepEqual(submittedList({ application_id: 4700, date: '2026-10-20', snapshot_id: 9 }),
    [{ snapshot_id: 9, date: '2026-10-20', application_id: 4700 }], 'a single-version object written by hand or a script');
  assert.deepEqual(submittedList([null, { snapshot_id: 'x', date: '2026-11-01' }, { snapshot_id: 3, date: 'soon' },
    { snapshot_id: 4, date: '2026-11-02', application_id: 0 }]), [{ snapshot_id: 4, date: '2026-11-02', application_id: null }]);
  assert.deepEqual(submittedList({ application_id: 4700, date: '2026-10-20' }), [], 'no snapshot id: nothing to open');
  assert.deepEqual(submittedList('junk'), []);
});

test('a conflict rebase keeps a version saved in another tab and re-derives the top level', () => {
  assert.ok(MERGE_MAPS.includes('submitted') && MERGE_MAPS.includes('interview_next'));
  assert.ok(!MERGE_MAPS.includes('interview') && !MERGE_MAPS.includes('eligibility'), 'script-written maps: the server copy wins');
  const v1 = { snapshot_id: 1, date: '2026-11-01', application_id: 7 };
  const v2 = { snapshot_id: 2, date: '2026-11-05', application_id: 7 };
  const v3 = { snapshot_id: 3, date: '2026-11-05', application_id: 9 };
  const base = { rows: [], submitted: { a: { ...v1, versions: [v1] } } };
  const server = { rows: [], submitted: { a: { ...v2, versions: [v1, v2] } } };
  const local = { rows: [], submitted: { a: { ...v3, versions: [v1, v3] } } };
  const out = mergeDocs(server, local, base).submitted.a;
  assert.deepEqual(out.versions.map((s) => s.snapshot_id), [1, 2, 3]);
  assert.deepEqual([out.snapshot_id, out.application_id], [3, 9], 'same day: the higher snapshot id is the newer save');
});

test('the island saves a version through the relay and never edits an older one', () => {
  assert.match(API, /saveSnapshot\(p:[\s\S]*?'\/api\/application-snapshots', \{ method: 'POST'/);
  assert.match(API, /missing: true, error: 'the snapshot store is not live yet/);
  assert.match(TSX, /submitted: addSubmitted\(doc\.submitted, uk, \{ snapshot_id: res\.snapshot\.id/);
  assert.doesNotMatch(TSX, /submitted: \{ \.\.\.\(doc\.submitted/, 'no hand-built submitted map that could replace a version');
  assert.match(TSX, /<SnapshotBody data=\{snapView\.data\} \/>/);
});

// ---- interview prep -------------------------------------------------------------
test('a pack shows when it has text or data; nothing otherwise', () => {
  assert.deepEqual(interviewPack({ stage: '2nd', generated_at: '2026-11-05T09:00', md: '# Prep\n- STAR stories' }),
    { md: '# Prep\n- STAR stories', stage: '2nd', generated_at: '2026-11-05T09:00', hasJson: false });
  assert.equal(interviewPack({ json: { q: [] } }).hasJson, true);
  assert.equal(interviewPack({ stage: '1st' }), null);
  assert.equal(interviewPack(null), null);
});

test('no pack: a disabled Generate button that names the script; the commands carry the row and stage', () => {
  assert.equal(PREP_SCRIPT, 'scripts/job-tracker/interview_prep.py');
  assert.match(TSX, /<button disabled title=\{'Run ' \+ PREP_SCRIPT/);
  assert.deepEqual(prepCommands('lumen', '2nd'), {
    pack: 'python scripts/job-tracker/interview_prep.py pack --uk lumen --stage 2nd --write',
    mock: 'python scripts/job-tracker/interview_prep.py mock --uk lumen --stage 2nd',
  });
  assert.match(prepCommands('lumen', '').pack, /--stage 1st --write$/, 'no stage picked: the script default');
  assert.match(prepCommands('lumen', 'lunch').pack, /--stage 1st /, 'never a stage the script rejects');
  // interview_prep.py STAGES must equal the island's list (argparse choices).
  const py = readFileSync(join(ROOT, 'scripts', 'job-tracker', 'interview_prep.py'), 'utf8').match(/^STAGES = \(([^)]*)\)/m);
  assert.ok(py, 'STAGES found');
  assert.deepEqual(py[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean), ['screening', '1st', '2nd', 'final', 'case']);
});

test('next-stage date: own key, cleared with an empty date, never an invalid day', () => {
  const m = setNextStage({ b: { date: '2026-11-20', stage: 'final' } }, 'a', '2026-11-12', '2nd');
  assert.deepEqual(m, { b: { date: '2026-11-20', stage: 'final' }, a: { date: '2026-11-12', stage: '2nd' } });
  assert.deepEqual(setNextStage(m, 'a', '', '2nd').a, { date: '', stage: '2nd' });
  assert.deepEqual(setNextStage({}, 'a', '2026-02-30', '').a, { date: '', stage: '' });
  assert.deepEqual(nextStageOf(undefined), { date: '', stage: '' });
  assert.match(TSX, /interview_next: setNextStage\(doc\.interview_next, uk, day/);
});

test('markdown renders as elements: headings, bullets, rules, bold, code, http(s) links only', () => {
  assert.deepEqual(mdBlocks('# Title\n\nIntro line\nwraps here\n\n- one\n  - two\n1. three\n---\n## Sub'), [
    { t: 'h', level: 1, text: 'Title' }, { t: 'p', text: 'Intro line wraps here' },
    { t: 'li', depth: 0, text: 'one' }, { t: 'li', depth: 1, text: 'two' }, { t: 'li', depth: 0, text: 'three' },
    { t: 'hr' }, { t: 'h', level: 2, text: 'Sub' },
  ]);
  assert.deepEqual(mdInline('Use **STAR** with `metrics`, see [guide](https://ex.com/a) or [bad](javascript:alert(1))'), [
    { t: 'text', s: 'Use ' }, { t: 'b', s: 'STAR' }, { t: 'text', s: ' with ' }, { t: 'code', s: 'metrics' },
    { t: 'text', s: ', see ' }, { t: 'a', s: 'guide', href: 'https://ex.com/a' }, { t: 'text', s: ' or [bad](javascript:alert(1))' },
  ]);
  assert.doesNotMatch(TSX, /dangerouslySetInnerHTML/, 'the pack is never injected as HTML');
});

// ---- eligibility ----------------------------------------------------------------
test('eligibility: PASS / FLAG / FAIL / UNVERIFIED only, quote kept for the chip title', () => {
  assert.deepEqual(eligibilityView({ verdict: 'fail', quote: 'Danish citizenship required', kind: 'citizenship' }),
    { verdict: 'FAIL', quote: 'Danish citizenship required', kind: 'citizenship' });
  assert.equal(eligibilityView({ verdict: 'PASS' }).verdict, 'PASS');
  // discover-positions.py ELIGIBILITY-GATE-001 writes FLAG for a clearance the hire must obtain.
  assert.equal(eligibilityView({ verdict: 'FLAG', kind: 'clearance to obtain', quote: 'must be able to obtain' }).verdict, 'FLAG');
  const gate = readFileSync(join(ROOT, 'scripts', 'job-tracker', 'discover-positions.py'), 'utf8');
  const written = new Set([...gate.matchAll(/return "(PASS|FLAG|FAIL|UNVERIFIED)"|\("(FLAG)", s/g)].map((m) => m[1] || m[2]));
  for (const v of written) assert.ok(eligibilityView({ verdict: v }), 'the gate writes ' + v + ' and the chip reads it');
  assert.equal(eligibilityView({ verdict: 'maybe' }), null);
  assert.equal(eligibilityView(null), null);
  assert.match(TSX, /<EligibilityChip v=\{\(doc\?\.eligibility \|\| \{\}\)\[uk\]\} \/>/);
});
