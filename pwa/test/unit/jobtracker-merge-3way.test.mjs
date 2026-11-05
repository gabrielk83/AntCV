// jobtracker-merge-3way.test.mjs
// SAVE-409-MERGE-002 (2026-11-01): a stale Job Tracker tab must not reopen rows
// that were closed elsewhere. On 2026-11-01 a tab left open for hours saved twice
// (tracker rev 339 and 342) and the old local-wins merge rewrote 10 owner closures
// back to open. mergeDocs now rebases three-way against the doc this session last
// loaded or saved: local wins only where this session changed something.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDocs } from '../../../src/islands/JobTracker/mergeDocs.ts';

const row = (uk, status, band = 'E2EFDA', flag = '') => [1, 'Co ' + uk, 'Role', '', '', '', '', '', status, '', flag, uk, band];

const base = {
  rows: [row('nykredit', 'Identified'), row('ambu', 'Identified'), row('veo', 'Identified')],
  queue: { nykredit: true, ambu: false, veo: false },
  signals: { veo: 'old' },
  envelope: [['Title', 'Old']],
};
// Elsewhere (a routine) closed Nykredit and disarmed its queue entry.
const server = {
  rows: [row('nykredit', 'Archive / not a fit', 'D9D9D9', 'closed'), row('ambu', 'Identified'), row('veo', 'Identified'),
    row('coloplast', 'Identified')],
  queue: { nykredit: false, ambu: false, veo: false, coloplast: false },
  signals: { veo: 'old' },
  envelope: [['Title', 'Old']],
};
// This stale tab only edited Veo's signals and Ambu's status.
const local = {
  rows: [row('nykredit', 'Identified'), row('ambu', 'Submitted'), row('veo', 'Identified')],
  queue: { nykredit: true, ambu: false, veo: false },
  signals: { veo: 'new note' },
  envelope: [['Title', 'Old']],
};

test('a row closed elsewhere stays closed when the stale tab did not touch it', () => {
  const out = mergeDocs(server, local, base);
  const n = out.rows.find((r) => r[11] === 'nykredit');
  assert.equal(n[8], 'Archive / not a fit');
  assert.equal(n[12], 'D9D9D9');
});

test('a map key changed elsewhere keeps the server value (queue stays disarmed)', () => {
  assert.equal(mergeDocs(server, local, base).queue.nykredit, false);
});

test('this session\'s own row edit still wins', () => {
  const out = mergeDocs(server, local, base);
  assert.equal(out.rows.find((r) => r[11] === 'ambu')[8], 'Submitted');
});

test('this session\'s own map edit still wins', () => {
  assert.equal(mergeDocs(server, local, base).signals.veo, 'new note');
});

test('rows added elsewhere survive', () => {
  assert.ok(mergeDocs(server, local, base).rows.some((r) => r[11] === 'coloplast'));
});

test('a row this session added is appended', () => {
  const loc2 = { ...local, rows: [...local.rows, row('manex', 'Identified')] };
  assert.ok(mergeDocs(server, loc2, base).rows.some((r) => r[11] === 'manex'));
});

test('an unchanged envelope does not overwrite a server envelope edit', () => {
  const srv2 = { ...server, envelope: [['Title', 'New from elsewhere']] };
  assert.deepEqual(mergeDocs(srv2, local, base).envelope, [['Title', 'New from elsewhere']]);
});

test('without a base the legacy local-wins behaviour is kept', () => {
  const out = mergeDocs(server, local, null);
  assert.equal(out.rows.find((r) => r[11] === 'nykredit')[8], 'Identified');
});
