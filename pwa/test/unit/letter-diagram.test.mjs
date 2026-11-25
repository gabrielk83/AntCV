// letter-diagram.test.mjs — LETTER-DIAGRAM-001 (owner 2026-11-25: "in all future cover letters … always
// add some impressive workflow / architecture idea related to something I will do for the company …
// also in AntCV and add in the control in preview a diagram adder").
// A diagram is ONE rich_block text row; these tests hold the parser, the stored-letter edits, the
// generation rule, the app hook, the sidecars that used to cut the row, and the write discipline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const D = require('../../antcv-letter-diagram.js');
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const worker = readFileSync(new URL('../../../workers/docx-worker/src/index.js', import.meta.url), 'utf8');
const gold = JSON.parse(read('gold-rules.json'));

const FLOW = { b: 'Workflow: From field day to tool', t: 'Ride along (one week in the field) → Pick (one task) → Prototype (two weeks) → Measure (time and use) → Hand over (to the owners)' };
const CASES = [
  FLOW,
  { b: 'Workflow', t: 'ride along -> pick -> build' },
  { b: 'Workflow: x', t: 'A (one, two) --> B (three) => C' },
  { b: 'Workflow (first 90 days)', t: 'A → B → C' },
  { t: 'Workflow: A → B → C' },
  { b: 'Architecture: How it connects', t: 'People (who decides) → Process (gates) → Data (stored) → Tools' },
  { b: 'Loop: How I improve', t: 'Measure → Change → Decide | each round ends in a decision.' },
  { b: 'Arbejdsgang: Fra felt til værktøj', t: 'Følg med (en uge) → Vælg → Byg → Mål' },
  { b: 'Arkitektur', t: 'A → B → C' }, { b: 'Kredsløb: x', t: 'A → B → C ↺ tilbage' },
  { b: 'Flujo de trabajo: x', t: 'A → B → C' }, { b: 'Arquitectura: x', t: 'A → B → C' }, { b: 'Ciclo: x', t: 'A → B → C' },
  { b: '工作流程：第一步', t: '观察（一周） → 选择 → 原型' },
  { b: 'From field to tool', t: 'A → B → C', dg: 'flow' },
  { b: 'Workflow: x', t: 'Ride along (one week) → Pick‑up → Hand over (to the owners)' },
  { b: 'Workflow: x', t: 'A: first → B: second → C: third.' },
  { b: 'Workflow: **bold**', t: '**A** → B → C' },
  { b: 'Change decisions', t: 'cut the cycle from 250 → 10 days → and kept it' },
  { b: 'Workflow: short', t: 'Pick → Build' }, { b: 'Workflow', t: '250 → 10 days' },
  { b: 'Workflow thinking', t: 'A → B → C' }, { b: 'My workflow', t: 'A → B → C' },
  { b: 'Workflow: x', t: 'A → B → C → D → E → F → G' },
  { b: '', t: 'From scope → cost → decision in one week.' },
  { grp: true, t: 'Workflow: A → B → C' }, { b: 'Workflow: x', t: '' }, null, 'Workflow: A → B → C', { b: 'x', t: 'A → B', dg: 'flow' },
];

test('parse: lead + steps + details; every drawn kind; prose and short rows are never a diagram', () => {
  assert.deepEqual(D.parse(FLOW), { kind: 'flow', name: 'From field day to tool', note: '', steps: [
    { label: 'Ride along', detail: 'one week in the field' }, { label: 'Pick', detail: 'one task' }, { label: 'Prototype', detail: 'two weeks' },
    { label: 'Measure', detail: 'time and use' }, { label: 'Hand over', detail: 'to the owners' }] });
  assert.equal(D.parse(CASES[1]).steps[0].label, 'Ride along', 'a lower-cased first step (marker rows) is shown with a capital');
  assert.equal(D.parse({ b: 'Architecture: x', t: 'A → B → C' }).kind, 'layers');
  assert.equal(D.parse({ b: 'Loop: x', t: 'A → B → C | back.' }).note, 'back');
  assert.equal(D.parse({ b: 'Kredsløb: x', t: 'A → B → C ↺ tilbage' }).note, 'tilbage');
  assert.equal(D.parse({ t: 'Workflow: A → B → C' }).name, '');
  assert.equal(D.parse({ b: 'From field to tool', t: 'A → B → C', dg: 'flow' }).name, 'From field to tool');
  assert.deepEqual(D.parse(CASES[15]).steps[1], { label: 'Pick-up', detail: '' });
  for (const no of [CASES[18], CASES[19], CASES[20], CASES[21], CASES[22], CASES[23], CASES[24], CASES[25], null, 'x']) assert.equal(D.parse(no), null, JSON.stringify(no));
});

test('the docx-worker parser gives the same result for every case (copied code, one behaviour)', () => {
  const a = worker.indexOf('const LD_LEADS = {'), b = worker.indexOf('function ldTint(');
  assert.ok(a > 0 && b > a, 'worker parser found');
  // eslint-disable-next-line no-new-func
  const parse = new Function('__name', worker.slice(a, b) + '; return parseLetterDiagram;')((f) => f);
  for (const c of CASES) assert.deepEqual(parse(c), D.parse(c), JSON.stringify(c));
});

test('toText round-trips, writes the lead of the language and keeps separators out of the fields', () => {
  const m = { kind: 'loop', name: 'First (draft) → x', steps: [{ label: 'A', detail: 'b (c)' }, { label: 'D → e', detail: '' }, { label: 'F | g', detail: 'h – i' }], note: 'n.' };
  const row = D.toText(m, 'da');
  assert.equal(row.b, 'Kredsløb: First draft, x');
  assert.equal(row.t, 'A (b c) → D, e → F g (h, i) | n');
  assert.equal(row.dg, 'loop');
  const back = D.parse(row);
  assert.equal(back.kind, 'loop'); assert.equal(back.steps.length, 3); assert.equal(back.note, 'n');
  assert.deepEqual(D.parse(D.toText(D.parse(FLOW), 'en')), D.parse(FLOW));
  assert.ok(!/[–—]/.test(row.b + row.t), 'no long dash');
  for (const k of D.KINDS) assert.ok(D.parse(D.toText(D.template(k), 'en')), 'template ' + k);
});

const letter = () => [
  { id: 'greeting', type: 'text', on: true, content: 'Dear team,' },
  { id: 'opening', type: 'rich_block', on: true, items: [{ b: '', t: 'Your need is real.' }] },
  { id: 'why', type: 'rich_block', on: true, items: [{ b: 'Why this position', t: 'The mix.' }] },
  { id: 'bring', type: 'rich_block', on: true, items: [{ b: 'What I bring', t: 'proof:' }, { b: 'A', t: 'x', mk: true }], hidden: { 1: true } },
  { id: 'contribute', type: 'rich_block', on: true, items: [{ b: 'How', t: 'lead:' }, { b: 'A', t: 'x', mk: true }, { b: 'Goal', t: 'y' }], hidden: { 2: true } },
  { id: 'closure', type: 'text', on: true, content: 'Thanks.' },
];

test('insert goes last in WHAT I BRING, before the closing row of HOW I WILL CONTRIBUTE, and moves with hidden rows', () => {
  const cl = letter(), m = D.parse(FLOW);
  assert.equal(D.defaultHost(cl), 'bring');
  assert.ok(D.missing(cl), 'a filled letter without a diagram gets the hint');
  const a = D.putDiagram(cl, m, null, 'en');
  assert.equal(a[3].items.length, 3); assert.equal(a[3].items[2].dg, 'flow'); assert.deepEqual(a[3].hidden, { 1: true });
  assert.equal(a[1], cl[1], 'other sections are the same objects');
  assert.ok(!D.missing(a));
  assert.equal(D.putDiagram(a, m, 'bring', 'en'), a, 'nothing owned changed: the same list, so no write');
  const withForeign = a.slice(); withForeign[3] = { ...a[3], items: a[3].items.map((r, i) => (i === 2 ? { ...r, mk: true, bullets: [] } : r)) };
  assert.equal(D.putDiagram(withForeign, m, 'bring', 'en'), withForeign, 'foreign keys on the row (mk, bullets) are not a change');
  const upd = D.putDiagram(withForeign, { ...m, name: 'New name' }, 'bring', 'en');
  assert.deepEqual(upd[3].items[2], { b: 'Workflow: New name', t: FLOW.t, dg: 'flow', mk: true, bullets: [] }, 'an update keeps the foreign keys');
  const moved = D.putDiagram(a, m, 'contribute', 'en');
  assert.equal(moved[3].items.length, 2); assert.equal(moved[4].items.length, 4);
  assert.equal(moved[4].items[2].dg, 'flow', 'before the Goal row'); assert.equal(moved[4].items[3].b, 'Goal');
  assert.deepEqual(moved[4].hidden, { 3: true }, 'the hidden row moved with its content');
  const gone = D.dropDiagram(moved);
  assert.equal(gone[4].items.length, 3); assert.deepEqual(gone[4].hidden, { 2: true });
  assert.equal(D.dropDiagram(gone), gone);
  assert.equal(D.putDiagram(cl, { kind: 'flow', name: '', steps: [{ label: 'A' }], note: '' }, null, 'en'), cl, 'a broken model writes nothing');
  const only = [{ id: 'bring', type: 'table', on: true, rows: [['a', 'b']] }];
  assert.equal(D.putDiagram(only, m, null, 'en'), only, 'no rich_block section: nothing to hold it');
});

test('render: aria text, pagination keys, arrows for a flow, bands for an architecture, null for prose or a killed row', () => {
  const R = { createElement: (type, props, ...kids) => ({ type, props, kids }) };
  const n = D.render(R, { size: 13, accent: '#00746E', font: 'Calibri' }, FLOW, 4);
  assert.equal(n.props['data-antcv-row-path'], 'items.4'); assert.equal(n.props['data-antcv-rowkey'], 'items.4');
  assert.equal(n.props.role, 'img'); assert.match(n.props['aria-label'], /^Workflow: From field day to tool\. 1 Ride along, one week in the field;/);
  const flat = JSON.stringify(n);
  assert.equal((flat.match(/→/g) || []).length, 4);
  const layers = JSON.stringify(D.render(R, {}, { b: 'Architecture: x', t: 'A (a) → B (b) → C' }, 0));
  assert.equal((layers.match(/→/g) || []).length, 0);
  assert.equal(D.render(R, {}, { b: 'Change decisions', t: 'from 250 → 10 → done' }, 0), null);
  globalThis.localStorage = { getItem: (k) => (k === 'antcv:disable-letter-diagram' ? '1' : null) };
  try { assert.equal(D.render(R, {}, FLOW, 0), null); assert.equal(D.isDiagramRow(FLOW), false); } finally { delete globalThis.localStorage; }
  assert.equal(D.isDiagramRow(FLOW), true);
});

test('app.js: the rich_block hook runs before the group branch, guarded by the sidecar, mirrored in app.src.js', () => {
  const min = read('app.js'), src = read('app.src.js');
  const hook = 'window.AntcvLetterDiagram&&window.AntcvLetterDiagram.isDiagramRow(r)){const __ld=window.AntcvLetterDiagram.render(React,';
  assert.equal(min.split(hook).length - 1, 1);
  assert.ok(min.indexOf(hook) < min.indexOf('if(r.grp){if(r.roleHead&&window.AntcvRolesRichBlock'));
  assert.equal(src.split('window.AntcvLetterDiagram.isDiagramRow(row)').length - 1, 1);
  const html = read('index.html');
  assert.match(html, /<script src="antcv-letter-diagram\.js\?v=1\.51\.\d+-[a-z-]+" defer><\/script>/);
});

test('gold rules: every targeted letter gets one workflow row, last in bring_rows, outside the word count', () => {
  const rule = gold.prompt_block.find((l) => l.includes('LETTER-DIAGRAM-001'));
  assert.ok(rule, 'prompt rule present');
  for (const must of ['LAST entry of bring_rows', "'Workflow: <name", "'Architecture: <name>'", "'Loop: <name>'", '3 to 5 steps', "' → '", "'Arbejdsgang:'", "'Flujo:'", 'does not count in the 350-450 words', 'no invented numbers', 'No job description (unsolicited): leave the row out']) {
    assert.ok(rule.includes(must), 'rule names: ' + must);
  }
  const shape = rule.match(/shape only: '([^']+)'/)[1];
  assert.ok(D.parse({ b: 'Workflow: x', t: shape }), 'the example in the rule is itself a diagram');
  assert.ok(!/[–—]/.test(rule));
  assert.deepEqual([gold.cl.diagram.rows, gold.cl.diagram.steps_min, gold.cl.diagram.steps_max], [1, 3, 5]);
});

// ── the sidecars on the generation path that used to cut or rewrite the row ─────────────
function run(file, cl) {
  const store = new Map([['sections', JSON.stringify({ cv: [], cl })], ['personalInfo', '{}']]);
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const win = { addEventListener() {}, dispatchEvent() { return true; } };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'document', 'console', 'CustomEvent', 'setTimeout', read(file))(win, ls, {}, { log() {}, info() {}, warn() {} }, class {}, () => 0);
  return { win, get: () => JSON.parse(store.get('sections')).cl };
}
test('core-comp-compress keeps the workflow row of bring_rows whole (25 / 89 character caps)', () => {
  const rows = [['The role needs', 'What I bring, with proof'], ['Change decisions under heavy pressure', 'x '.repeat(80).trim()], [FLOW.b, FLOW.t]];
  const r = run('antcv-core-comp-compress.js', [{ id: 'bring', type: 'table', on: true, title: 'WHAT I BRING', rows }]);
  r.win.AntcvCoreCompCompress.run();
  const out = r.get()[0].rows;
  assert.deepEqual(out[2], [FLOW.b, FLOW.t]);
  assert.ok(out[1][1].length <= 89, 'ordinary rows keep their cap');
});
test('cl-text-cleanup does not lower-case or cut a diagram row, and still heals prose rows', () => {
  const r = run('antcv-cl-text-cleanup.js', [{ id: 'bring', type: 'rich_block', on: true, items: [{ b: 'What I bring', t: 'proof:' }, { b: 'Validation', t: 'That holds and', mk: true }, { ...FLOW, mk: true }] }]);
  r.win.AntcvClTextCleanup.run();
  const it = r.get()[0].items;
  assert.equal(it[2].t, FLOW.t); assert.equal(it[2].b, FLOW.b);
  assert.equal(it[1].t, 'that holds');
});
test('bring-761 turns the generated table row into a diagram row', () => {
  const r = run('antcv-bring-to-rich-block-761.js', [{ id: 'bring', type: 'table', on: true, title: 'WHAT I BRING', rows: [['The role needs', 'What I bring, with proof'], ['Need', 'proof'], [FLOW.b, FLOW.t]] }]);
  r.win.AntcvBringToRichBlock.run();
  assert.deepEqual(D.parse(r.get()[0].items[2]), D.parse(FLOW));
});
test('docx-client forwards dg and the kill switch', () => {
  const c = read('antcv-docx-client.js');
  assert.ok(c.includes("row.dg === 'flow' || row.dg === 'loop' || row.dg === 'layers'"));
  assert.ok(c.includes('noDiagram ? { noDiagram: true } : {}'));
});
