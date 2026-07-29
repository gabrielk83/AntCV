// GAP-APPLY-RICHBLOCK-001 — owner 2026-07-29 (UNSOL-APP-DEFECTS item a: "✏ edit →
// apply to docs" misbehaves on the Terma application).
//
// The JD Gap Closure card's "✏ I cover this — apply to docs" builds a `Current
// state` payload of the CV/CL sections and asks the model to patch them. That
// builder handled text / text_inline / text_bullets / foundation / bullets /
// table / experience and returned **null for everything else** — including
// `rich_block`. The documents migrated to rich_block (roles cutover + CL v5), so
// on the owner's real application (D1 id 2751, Terma) the CV is 15/15 rich_block
// and the CL 7/9: the model was handed 2 of 24 sections and asked to patch the
// rest. The same rich_block gap was closed for the COMPRESS path on 2026-06-29
// (compress-rich-block.test.mjs); the gap-closure path was missed.
//
// These tests run the REAL builder extracted from the shipping app.js — not a
// replica — and pin it against Pe()'s rich_block applier so the value→row
// mapping cannot desync (FIXIT-DESYNC-001).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');

// ---- extract the SHIPPING gap-closure payload builder out of app.js ----------
function extractBuilder() {
  const end = app.indexOf(':null:null;(a.cv||[]).forEach');
  assert.ok(end > 0, 'gap-closure builder not found in app.js — did the call site change?');
  const start = app.lastIndexOf('o=e=>e&&e.on?', end);
  assert.ok(start > 0 && start < end, 'builder head not found');
  const body = app.slice(start + 2, end + ':null:null'.length);   // drop the leading "o="
  // eslint-disable-next-line no-new-func
  return new Function('return (' + body + ')')();
}
const build = extractBuilder();

// Pe()'s rich_block applier, as committed (the half that consumes the payload).
function applyBack(section, patch) {
  let m = 0;
  const items = (section.items || []).map((it, k) => {
    if (!it || it.grp || (section.hidden && section.hidden[k]) || !(it.t || '').trim()) return it;
    const c = (patch.items || [])[m++];
    return c ? { ...it, t: c.t || it.t || '' } : it;
  });
  return { ...section, items };
}

// Shaped like the owner's real Terma CL "contribute" section (console dump 07-29).
const CONTRIBUTE = {
  id: 'contribute',
  title: 'HOW I WOULD CONTRIBUTE',
  loc: 'main',
  on: true,
  type: 'rich_block',
  headlineOff: true,
  hidden: { 4: true },
  items: [
    { grp: true, t: 'GROUP HEADING' },
    { b: 'How I will contribute', t: 'In the first months I would focus on system architecture.', bullets: [] },
    { b: 'Empty row', t: '', bullets: [] },
    { b: 'Run trade studies', t: 'and scenario-based analysis across optics and software.', mk: true, bullets: [] },
    { b: 'Hidden', t: 'must not move' },
    { b: 'Goal', t: 'Air-domain system clarity.', mk: true, bullets: [] },
  ],
};

test('REGRESSION: a rich_block section is no longer dropped from the payload', () => {
  const out = build(CONTRIBUTE);
  assert.ok(out, 'builder returned null for rich_block — the model would never see this section');
  assert.equal(out.id, 'contribute');
  assert.equal(out.type, 'rich_block');
});

test('the payload carries only the patchable content rows, in document order', () => {
  const out = build(CONTRIBUTE);
  assert.deepEqual(out.items, [
    { b: 'How I will contribute', t: 'In the first months I would focus on system architecture.' },
    { b: 'Run trade studies', t: 'and scenario-based analysis across optics and software.' },
    { b: 'Goal', t: 'Air-domain system clarity.' },
  ]);
});

test('builder rows and Pe() applier rows line up exactly (no FIXIT-DESYNC-001 shift)', () => {
  const built = build(CONTRIBUTE);
  let consumed = 0;
  (CONTRIBUTE.items || []).forEach((it, k) => {
    if (it && !it.grp && !(CONTRIBUTE.hidden && CONTRIBUTE.hidden[k]) && (it.t || '').trim()) consumed++;
  });
  assert.equal(built.items.length, consumed, 'builder emits a different row count than the applier consumes');

  const patched = applyBack(CONTRIBUTE, { items: built.items.map((r, i) => ({ b: r.b, t: 'P' + i })) });
  assert.equal(patched.items[1].t, 'P0');
  assert.equal(patched.items[3].t, 'P1');
  assert.equal(patched.items[5].t, 'P2');
  // skipped rows byte-identical
  assert.deepEqual(patched.items[0], CONTRIBUTE.items[0]);
  assert.deepEqual(patched.items[2], CONTRIBUTE.items[2]);
  assert.deepEqual(patched.items[4], CONTRIBUTE.items[4]);
  // frozen fields survive
  assert.equal(patched.items[3].b, 'Run trade studies');
  assert.equal(patched.items[3].mk, true);
});

test('an off section is still excluded, whatever its type', () => {
  assert.equal(build({ ...CONTRIBUTE, on: false }), null);
});

test('the already-supported types are unchanged by this patch', () => {
  assert.deepEqual(build({ id: 'p', on: true, type: 'text', content: 'x' }), { id: 'p', type: 'text', content: 'x' });
  const tbl = build({ id: 'c', on: true, type: 'table', rows: [['Focus', 'Expertise'], ['A', 'B']] });
  assert.deepEqual(tbl, { id: 'c', type: 'table', rows: [{ focus: 'A', expertise: 'B' }] });
  assert.equal(build({ id: 'z', on: true, type: 'no_such_type' }), null, 'unknown types still drop out');
});

test('the owner document shape survives end-to-end: 24/24 sections reach the model', () => {
  // 15 CV rich_block + 7 CL rich_block + 2 CL text — the live Terma app (D1 2751).
  const mk = (i, type) => ({ id: 's' + i, on: true, type, content: 'body ' + i, items: [{ b: 'L', t: 'body ' + i }] });
  const docSections = [
    ...Array.from({ length: 22 }, (_, i) => mk(i, 'rich_block')),
    ...Array.from({ length: 2 }, (_, i) => mk(100 + i, 'text')),
  ];
  const seen = docSections.map(build).filter(Boolean);
  assert.equal(seen.length, 24, 'sections still missing from the gap-closure payload');
});

test('MIRROR: the rich_block branch and its prompt rule are in BOTH bundles', () => {
  assert.ok(src.includes('"rich_block" === e.type'), 'branch missing from app.src.js');
  assert.ok(app.includes('"rich_block"===e.type?{id:e.id,type:"rich_block"'), 'branch missing from app.js');
  const RULE = 'For rich_block sections, keep every';
  assert.ok(src.includes(RULE), 'prompt rule missing from app.src.js');
  assert.ok(app.includes(RULE), 'prompt rule missing from app.js (not mirrored)');
});
