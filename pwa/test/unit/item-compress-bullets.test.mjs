// item-compress-bullets.test.mjs — ITEM-COMPRESS-RICHBLOCK-001 (owner 2026-07-05).
//
// Owner clicked Compress on a single "bullets"-type rich_block item
// ({b:"Goal:", t:"My aim is..."}) and got a false "This item already fits
// tightly. Skipping compression." with a visible orphan on screen.
//
// Root cause: the per-item compress gate-check's fallback was `n || ""` for
// any section type that isn't labeled_list/education — handing the RAW
// {b,t} OBJECT to the fits-checker. That checker's very first condition is
// `"string" != typeof e`, true for an object, so it short-circuits to
// "already fits" WITHOUT measuring anything. Deeper still: even if the gate
// had passed, the actual compress-request builder had no "bullets" case
// either — it would have fallen through to a DIFFERENT wrong alert
// ("Per-item compress not supported for 'bullets'"). This was a genuinely
// unimplemented per-item type, not just a wrong check.
//
// Fix touches 5 sites (gate-check text extraction, source-builder, prompt
// chain, section-map dispatch, and the Pe applier), mirroring the EXACT
// established shape of labeled_list_item (b frozen like l, t tightened like
// v) and reusing the same {b,t} extraction the whole-section "bullets" scan
// a few lines below already used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

// 1) MIRROR GUARD — all 4 new "bullets_item" touch points must exist in BOTH files.
test('bullets_item prompt is present in app.src.js and app.js (mirror)', () => {
  const PROMPT = 'Compress the body ("t") of this single CV/cover-letter bullet';
  assert.ok(src.includes(PROMPT), 'bullets_item compress prompt missing from app.src.js');
  assert.ok(app.includes(PROMPT), 'bullets_item compress prompt missing from app.js (not mirrored)');
});
test('bullets_item source-builder branch exists in both files', () => {
  assert.ok(src.includes('type: "bullets_item"'), 'builder branch missing from app.src.js');
  assert.ok(app.includes('type:"bullets_item"'), 'builder branch missing from app.js');
});
test('bullets_item Pe/applier branch exists in both files', () => {
  assert.ok(src.includes('"bullets_item" === t.type && "number" == typeof l'),
    'Pe applier branch missing from app.src.js');
  assert.ok(app.includes('"bullets_item"===t.type&&"number"==typeof l'),
    'Pe applier branch missing from app.js');
});
test('the gate-check no longer hands al() a raw object for "bullets" sections', () => {
  // Confirms the fallback path now extracts b+t instead of `n || ""`.
  assert.match(src, /\("bullets" === r\.type \|\| "rich_block" === r\.type\)\s*\?\s*\(n\.b \? n\.b \+ " " : ""\) \+ \(n\.t \|\| n \|\| ""\)/);
  assert.ok(app.includes('("bullets"===r.type||"rich_block"===r.type)?(n.b?n.b+" ":"")+(n.t||n||"")'),
    'gate-check bullets/rich_block extraction missing from app.js');
});

// 2) LOGIC — replicate the SHIPPED gate-check extraction + Pe applier merge,
//    byte-for-byte matching what's committed, and prove they behave correctly
//    for the exact {b,t} shape that triggered the owner's report.
function gateCheckText(item, sectionType) {
  // Mirrors: "labeled_list"===r.type ? n.v||"" : "education"===r.type ? n.sch||""
  //   : "bullets"===r.type ? (n.b?n.b+" ":"")+(n.t||n||"") : n||""
  if (sectionType === 'labeled_list') return item.v || '';
  if (sectionType === 'education') return item.sch || '';
  if (sectionType === 'bullets' || sectionType === 'rich_block') return (item.b ? item.b + ' ' : '') + (item.t || item || '');
  return item || '';
}
function applyBulletsItem(section, itemIdx, compressedT) {
  // Mirrors the new Pe/"ht" bullets_item branch: b frozen, only t written.
  const items = [...(section.items || [])];
  if (items[itemIdx] && !items[itemIdx].group) {
    items[itemIdx] = { ...items[itemIdx], t: compressedT || items[itemIdx].t || '' };
  }
  return { ...section, items };
}

const GOAL_ITEM = { b: 'Goal:', t: 'My aim is to help your organisation make faster decisions, cleaner execution, and technical visibility to engineering and management.' };

test('gate-check extracts a real, measurable string for a {b,t} bullets item (not the raw object)', () => {
  const text = gateCheckText(GOAL_ITEM, 'bullets');
  assert.equal(typeof text, 'string', 'must extract a string, not hand the object to the fits-checker');
  assert.ok(text.startsWith('Goal: My aim is'), 'must include both the label and the body');
  assert.ok(text.length > 100, 'the real sentence is long — this is exactly the case that should NOT "already fit"');
});

test('gate-check falls back correctly for a non-"bullets" section (labeled_list unaffected)', () => {
  assert.equal(gateCheckText({ l: 'Sidebar Row', v: 'short value' }, 'labeled_list'), 'short value');
});

test('gate-check falls back correctly for a plain string in an unrelated type (no regression)', () => {
  assert.equal(gateCheckText('plain sidebar line', 'list'), 'plain sidebar line');
});

test('applier writes the compressed body back, keeps "b" (lead-in) frozen', () => {
  const section = { id: 'why', type: 'bullets', items: [GOAL_ITEM] };
  const out = applyBulletsItem(section, 0, 'Faster decisions, cleaner execution, visible progress.');
  assert.equal(out.items[0].t, 'Faster decisions, cleaner execution, visible progress.');
  assert.equal(out.items[0].b, 'Goal:', 'the lead-in label must stay unchanged, same as labeled_list_item freezes "l"');
});

test('applier never touches a group-heading row even if targeted by index', () => {
  const section = { id: 'why', type: 'bullets', items: [{ group: true, t: 'HEADING' }] };
  const out = applyBulletsItem(section, 0, 'should not apply');
  assert.deepEqual(out.items[0], { group: true, t: 'HEADING' });
});

test('applier leaves other items in the array untouched', () => {
  const section = {
    id: 'why', type: 'bullets',
    items: [{ b: 'A', t: 'first' }, GOAL_ITEM, { b: 'C', t: 'third' }],
  };
  const out = applyBulletsItem(section, 1, 'compressed goal text');
  assert.deepEqual(out.items[0], { b: 'A', t: 'first' });
  assert.equal(out.items[1].t, 'compressed goal text');
  assert.deepEqual(out.items[2], { b: 'C', t: 'third' });
});

// ITEM-ROWFIT-RICHBLOCK-001 (owner 2026-07-22): Fit-it (⇥) AND Enhance (✨) on a
// rich_block ROW must run the proven bullets_item path (freeze b, act on t) instead
// of alerting "not supported on row level". Guard the whitelist extension in BOTH
// the Fit-it (ll) and Enhance (il) handlers, mirrored src <-> minified.
test('rich_block rows route through bullets_item in Fit-it + Enhance (src + app mirror)', () => {
  // Fit-it (ll): fits-check, builder, write-back all accept rich_block
  assert.ok(src.includes('"bullets" === r.type || "rich_block" === r.type'), 'll builder src');
  assert.ok(app.includes('"bullets"===r.type||"rich_block"===r.type'), 'll builder app');
  assert.ok(src.includes('"bullets" === n.type || "rich_block" === n.type'), 'll write-back src');
  assert.ok(app.includes('"bullets"===n.type||"rich_block"===n.type'), 'll write-back app');
  // Enhance (il): payload case + type mapping accept rich_block -> bullets_item
  assert.ok(src.includes('else if ("rich_block" === o.type)') && /rich-block row/.test(src), 'il payload src');
  assert.ok(app.includes('else if("rich_block"===o.type)a={type:"bullets_item"'), 'il payload app');
  assert.ok(/"rich_block" === o\.type\s*\?\s*\(m\.type = "bullets_item"\)/.test(src), 'il map src');
  assert.ok(app.includes('"rich_block"===o.type?g.type="bullets_item"'), 'il map app');
});

// ROWFIT-FEEDBACK-001 (owner 2026-07-22): a per-ROW Fit-it/Enhance (item:/row:) must
// also mark the whole-SECTION transition key so the preview turns pink (the map is
// written per-row but the rich_block/table preview only reads the section key).
// Experience roles (real ids) must stay per-role — gate on item:/row:.
test('per-row Fit-it/Enhance also sets the section transition key (src + app mirror)', () => {
  // both il ([r]) and ll ([a]) setters carry the gated section-key write
  assert.ok(/\[r\]: "working", \[e\]: "working"/.test(src), 'il section-key write (src)');
  assert.ok(/\[a\]: "working", \[e\]: "working"/.test(src), 'll section-key write (src)');
  assert.ok(app.includes('[r]:"working",[e]:"working"'), 'il section-key write (app)');
  assert.ok(app.includes('[a]:"working",[e]:"working"'), 'll section-key write (app)');
  // gated to item:/row: so experience roles are not blanket-pinked
  assert.ok((src.match(/t\.startsWith\("item:"\) \|\| t\.startsWith\("row:"\)/g) || []).length >= 2, 'gate present twice (src)');
  assert.ok((app.match(/t\.startsWith\("item:"\)\|\|t\.startsWith\("row:"\)/g) || []).length >= 2, 'gate present twice (app)');
});

// ROWFIT-HOURGLASS-001 (owner 2026-07-22): the experience-as-rich_block editor mount
// omitted enrichingId/compressingId, so its per-row ✨/⇥ never showed ⏳. Fix maps the
// busy REAL roleId back to the row's "item:i" via _rid so the correct row goes busy.
test('experience-as-rich_block mount passes enrichingId/compressingId via _rid map (src + app)', () => {
  assert.ok(src.includes('const __itemIdForRid ='), 'itemIdForRid helper (src)');
  assert.ok(/enrichingId: __itemIdForRid\(a\)/.test(src) && /compressingId: __itemIdForRid\(o\)/.test(src), 'experience mount props (src)');
  assert.ok(app.includes('__itemIdForRid=rid=>'), 'itemIdForRid helper (app)');
  assert.ok(app.includes('enrichingId:__itemIdForRid(i),compressingId:__itemIdForRid(r)'), 'experience mount props (app)');
});
