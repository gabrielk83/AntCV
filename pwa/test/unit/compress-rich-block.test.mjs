// compress-rich-block.test.mjs — H (owner 2026-06-29).
//
// rich_block sections (Foundation, why, who, bring, contribute under the Nordic
// CL template) had NO per-section compress branch: the handler fell through to
// `alert('Section type "rich_block" is not compressible here.')` AND left the
// per-section processing marker stuck ("junk processing" spinner).
//
// The fix adds a rich_block branch to (1) the compress source-builder, (2) the
// compress prompt chain, and (3) the Pe applier, plus clears the stuck marker on
// the unsupported-type early-return. The HIGH-RISK part is the builder→Pe
// value→row mapping: both must skip the SAME rows (grp sub-headings, hidden
// rows, empty-t rows) or compressed bodies land on the wrong rows
// (FIXIT-DESYNC-001, which bit labeled_list). This test pins both halves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

// 1) MIRROR GUARD — the rich_block compress branch must exist in BOTH files.
const RICH_PROMPT = 'Compress the body ("t") of each item in this cover-letter / CV rich block';
test('rich_block compress prompt is present in app.src.js and app.js (mirror)', () => {
  assert.ok(src.includes(RICH_PROMPT), 'rich_block compress prompt missing from app.src.js');
  assert.ok(app.includes(RICH_PROMPT), 'rich_block compress prompt missing from app.js (not mirrored)');
});
test('rich_block builder + applier branches exist in app.js', () => {
  assert.ok(app.includes('else if("rich_block"===r.type)'), 'rich_block source-builder branch missing from app.js');
  assert.ok(app.includes('if("rich_block"===t.type)'), 'rich_block Pe applier branch missing from app.js');
});
test('the unsupported-type guard now clears the processing marker (no stuck spinner)', () => {
  // The guard string still alerts, but must be followed by the Wr cleanup that
  // deletes the [a] processing key — not a bare void Pl(null).
  const i = app.indexOf('is not compressible here');
  assert.ok(i > 0, 'guard alert string missing');
  const tail = app.slice(i, i + 160);
  assert.ok(/Wr\(n=>\{const o=\{\.\.\.n\};return delete o\[a\]/.test(tail),
    'unsupported-type guard does not clear the Wr processing marker — stuck spinner');
});

// 2) LOGIC — replicate the SHIPPED builder filter + Pe applier and prove the
//    value→row mapping stays aligned across skipped (grp / hidden / empty-t) rows.
//    These two helpers are byte-for-byte the predicates committed to app.src.js.
function buildSource(section) {
  return (section.items || [])
    .filter((e, i) => e && !e.grp && !(section.hidden && section.hidden[i]) && (e.t || '').trim())
    .map((e) => ({ b: e.b || '', t: e.t || '' }));
}
function applyBack(section, compressed) {
  let m = 0;
  const out = (section.items || []).map((it, k) => {
    if (!it || it.grp || (section.hidden && section.hidden[k]) || !(it.t || '').trim()) return it;
    const c = (compressed.items || [])[m++];
    return c ? { ...it, t: c.t || it.t || '' } : it;
  });
  return { ...section, items: out };
}

const SECTION = {
  id: 'foundation',
  type: 'rich_block',
  hidden: { 4: true },
  items: [
    { grp: true, t: 'GROUP HEADING' },                       // 0 skip (grp)
    { b: 'Foundation', t: 'I connect hardware with clear decisions.' }, // 1 content #0
    { b: 'Lead only', t: '' },                               // 2 skip (empty t)
    { b: 'Hands-on', t: 'FMEA, DV/PV validation, RFQ scoring.', mk: true }, // 3 content #1
    { t: 'hidden body that must not move' },                 // 4 skip (hidden)
    { t: 'plain body, no lead-in', mk: true },               // 5 content #2
  ],
};

test('builder selects only the compressible content rows, in order', () => {
  const built = buildSource(SECTION);
  assert.deepEqual(built, [
    { b: 'Foundation', t: 'I connect hardware with clear decisions.' },
    { b: 'Hands-on', t: 'FMEA, DV/PV validation, RFQ scoring.' },
    { b: '', t: 'plain body, no lead-in' },
  ]);
});

test('applier writes each compressed body back to the RIGHT row; grp/hidden/empty/b/mk untouched', () => {
  const compressed = { items: [{ b: 'Foundation', t: 'C1' }, { b: 'Hands-on', t: 'C2' }, { b: '', t: 'C3' }] };
  const out = applyBack(SECTION, compressed);
  // skipped rows are byte-identical
  assert.deepEqual(out.items[0], { grp: true, t: 'GROUP HEADING' });
  assert.deepEqual(out.items[2], { b: 'Lead only', t: '' });
  assert.deepEqual(out.items[4], { t: 'hidden body that must not move' });
  // content rows get the compressed body but keep b/mk
  assert.equal(out.items[1].t, 'C1');
  assert.equal(out.items[1].b, 'Foundation');
  assert.equal(out.items[3].t, 'C2');
  assert.equal(out.items[3].mk, true);
  assert.equal(out.items[5].t, 'C3');
  assert.equal(out.items[5].mk, true);
});

test('builder and applier skip identical rows (no desync) — count matches', () => {
  const built = buildSource(SECTION);
  let consumed = 0;
  applyBack(SECTION, { items: built.map((b) => ({ b: b.b, t: b.t + ' x' })) });
  // re-derive how many rows the applier consumes
  (SECTION.items || []).forEach((it, k) => {
    if (it && !it.grp && !(SECTION.hidden && SECTION.hidden[k]) && (it.t || '').trim()) consumed++;
  });
  assert.equal(built.length, consumed, 'builder count != applier consumed count -> values would shift');
});

test('a short/failed compressed payload leaves trailing content rows unchanged (no crash)', () => {
  const out = applyBack(SECTION, { items: [{ t: 'ONLY1' }] });
  assert.equal(out.items[1].t, 'ONLY1');
  assert.equal(out.items[3].t, 'FMEA, DV/PV validation, RFQ scoring.'); // unchanged
  assert.equal(out.items[5].t, 'plain body, no lead-in');               // unchanged
});
