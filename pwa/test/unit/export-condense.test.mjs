// EXPORT-CONDENSE-001 (owner 2026-10-01 "do: the paragraph condensing"): a paragraph whose last line is short gets the
// smallest per-paragraph character-spacing condense (floor -0.4 pt) that removes that line; written into
// sec.item_condense[path] in 1/20 pt for the docx-worker. Never global, never below the floor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const src = await readFile(new URL('../../antcv-orphan-export-preflight.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    Promise, Date, JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat,
  };
  vm.createContext(sandbox); vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvOrphanExportPreflight, store };
}
// greedy wrap; every char is 6px + the letter spacing
function measure(spec) {
  const cw = 6 + (spec.letterSpacingPx || 0);
  const t = String(spec.html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const lines = []; let cur = '';
  for (const w of t.split(' ').filter(Boolean)) {
    const cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length * cw <= spec.widthPx) cur = cand; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => l.length * cw);
}
const words = (n) => Array.from({ length: n }, () => 'abc').join(' ');
const cv = (bullets, extra = {}) => ({ doc: 'cv', layout: 'two_column', style: {}, font_sizes: {}, ...extra,
  sections: [{ id: 'experience', type: 'experience', loc: 'main', title: 'EXPERIENCE', roles: [{ id: 'r1', title: 'PdM', company: 'Acme', bullets }] }] });

test('a short last line is pulled back by the smallest condense (here -0.3 pt = -6 twentieths)', async () => {
  const { api } = load();
  const p = cv([words(22)]);            // 87 chars; ~82 fit per line at 497.8px -> 2 lines, last line ~5 chars
  const sum = await api.run(p, { measureLines: measure, fetchImpl: () => Promise.reject(new Error('no')) });
  assert.equal(sum.condensed, 1);
  assert.equal(JSON.stringify(p.sections[0].item_condense), JSON.stringify({ 'roles.0.bullets.0': -6 }));
  assert.equal(p.sections[0].roles[0].bullets[0], words(22), 'text untouched - no bind, no rewrite');
});

test('never past the -0.4 pt floor: a line that needs more is left to the bind/rewrite steps', async () => {
  const { api } = load();
  const p = cv([words(25)]);            // 99 chars: would need about -0.75 pt
  const sum = await api.run(p, { measureLines: measure, fetchImpl: () => Promise.reject(new Error('no')) });
  assert.equal(sum.condensed, 0);
  assert.ok(!p.sections[0].item_condense);
});

test('a well-filled last line is not condensed', async () => {
  const { api } = load();
  const p = cv([words(35)]);            // last line well over 55%
  const sum = await api.run(p, { measureLines: measure, fetchImpl: () => Promise.reject(new Error('no')) });
  assert.equal(sum.condensed, 0);
});

test('kill switch', async () => {
  const { api } = load({ 'antcv:disable-export-condense': '1' });
  const p = cv([words(22)]);
  await api.run(p, { measureLines: measure, fetchImpl: () => Promise.reject(new Error('no')) });
  assert.ok(!p.sections[0].item_condense);
});

// ── NO-ORPHAN-001 (owner 2026-11-05, "make sure not to have orphans - especially in tables. always, in all
// antCV applications"): table cells, education, lists and bullet sections are condense + NBSP-bind targets;
// condense uses the 0.60 detector floor; a single word alone on the last line is an orphan at any fill.
// Same greedy measurer, plus the .lastWords tag the DOM measurer sets (NBSP-separated tokens count as words).
function measureW(spec) {
  const cw = 6 + (spec.letterSpacingPx || 0);
  const t = String(spec.html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const lines = []; let cur = '';
  for (const w of t.split(' ').filter(Boolean)) {
    const cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length * cw <= spec.widthPx) cur = cand; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const out = lines.map((l) => l.length * cw);
  if (out.length >= 2) out.lastWords = lines[lines.length - 1].split(/\s+/).filter(Boolean).length;
  return out;
}
const noFetch = () => Promise.reject(new Error('no'));
const plain = (v) => JSON.parse(JSON.stringify(v));   // vm-realm arrays -> host arrays for deepEqual
const tbl = (rows, extra = {}) => ({ id: 'core_competencies', type: 'table', loc: 'main', title: 'CORE COMPETENCIES', rows, ...extra });
const HDR = ['The role needs', 'What I bring, with proof'];

test('CONDENSE_FRAC is the 0.60 detector floor: a 57% last line now condenses (it sat in the old 55-60% gap)', () => {
  const { api } = load();
  assert.equal(api.CONDENSE_FRAC, 0.6);
  assert.equal(api.CONDENSE_FRAC, api.RUNT_FRAC);
  // 8 lines, last at 57%: shrink pulls it back once any letter spacing is applied
  const stub = (spec) => (spec.letterSpacingPx ? Array(7).fill(100) : [...Array(7).fill(100), 57]);
  const sec = {};
  const tg = { condensePath: 'items.0', sec, get: () => 'x y z', widthPx: 100, fontPx: 14, prefixHtml: '' };
  assert.equal(api._tryCondense(stub, tg).condensed, true);
  assert.equal(sec.item_condense['items.0'], -2);
  const sec2 = {};
  const stub61 = (spec) => (spec.letterSpacingPx ? Array(7).fill(100) : [...Array(7).fill(100), 61]);
  assert.equal(api._tryCondense(stub61, { ...tg, sec: sec2 }).condensed, undefined, 'a 61% last line is not an orphan');
  assert.ok(!sec2.item_condense);
});

test('a condense that drops a line but still ends on an orphan is not a fix', () => {
  const { api } = load();
  // 3-line label "Winter / preparedness / planning": any squeeze gives 2 lines with "planning" alone
  const stub = (spec) => { const a = spec.letterSpacingPx ? [90, 40] : [40, 75, 48]; a.lastWords = 1; return a; };
  const sec = {};
  const tg = { cell: true, condensePath: 'rows.1.0', sec, get: () => 'Winter preparedness planning', widthPx: 98, fontPx: 13.3, prefixHtml: '' };
  assert.equal(api._tryCondense(stub, tg).condensed, undefined);
  assert.ok(!sec.item_condense && !sec.item_scale, 'nothing written');
});

test('single-word rule: one word alone on the last line is an orphan at any fill; one line never is', () => {
  const { api } = load();
  const w = (arr, n) => { const a = arr.slice(); if (n != null) a.lastWords = n; return a; };
  assert.equal(api._isRuntLines(w([100, 70], 1), 100), true);
  assert.equal(api._isRuntLines(w([100, 70], 2), 100), false);
  assert.equal(api._isRuntLines(w([100, 70]), 100), false);
  assert.equal(api._isRuntLines(w([70], 1), 100), false);
});

test('table geometry mirrors renderCompetencyTable: CV main-288, CL 0.9 x (PAGE_W-400), ratio 0.25, 450 DXA margins', () => {
  const { api } = load();
  const met = api._metricsFromPayload({ doc: 'cv', style: {}, font_sizes: {} });
  const [c0, c1] = api._tableColWidthsPx({}, met, false);
  assert.ok(Math.abs(c0 - (1922 - 450) / 15) < 0.01 && Math.abs(c1 - (5767 - 450) / 15) < 0.01, `cv ${c0} ${c1}`);
  const [l0, l1] = api._tableColWidthsPx({}, met, true);
  assert.ok(Math.abs(l0 - (2589 - 450) / 15) < 0.01 && Math.abs(l1 - (7766 - 450) / 15) < 0.01, `cl ${l0} ${l1}`);
  const [f0, f1] = api._tableColWidthsPx({ tableWidth: 6000, tableRatio: 0.3 }, met, false);
  assert.ok(Math.abs(f0 - 90) < 0.01 && Math.abs(f1 - 250) < 0.01, 'forwarded width + ratio win');
});

test('every non-empty table cell is a target: rows.R.C paths, cell fonts, bold label column + header, justified data column', () => {
  const { api } = load();
  const p = cv([], { package: 'copenhagen-modern' });
  p.sections.push(tbl([HDR, ['Regulatory affairs', 'ISO 13485 audits led for three sites.'], ['', '[placeholder]'], ['Field work', 'Ran trials.']], { rowAlign: [null, null, null, 'left'] }));
  const met = api._metricsFromPayload(p);
  const cells = api._collectTargets(p, met).filter((t) => t.kind === 'cell');
  assert.deepEqual(plain(cells.map((t) => t.condensePath)), ['rows.0.0', 'rows.0.1', 'rows.1.0', 'rows.1.1', 'rows.3.0', 'rows.3.1']);
  const by = Object.fromEntries(cells.map((t) => [t.condensePath, t]));
  assert.equal(by['rows.0.0'].family, 'Segoe UI', 'header uses the package heading font');
  assert.equal(by['rows.0.0'].fontPx, 14);
  assert.ok(Math.abs(by['rows.1.1'].fontPx - 40 / 3) < 1e-9, 'data cells at mainTblCell 10 pt');
  assert.equal(by['rows.1.0'].wrap, 'b');
  assert.equal(by['rows.1.1'].wrap, null);
  assert.equal(by['rows.1.1'].justified, true);
  assert.equal(by['rows.3.1'].justified, false, 'rowAlign left wins');
  assert.ok(cells.every((t) => t.noRewrite && t.cell));
});

test('table cell: a condense the body floor cannot reach uses the cell ladder (-0.5 pt + character width)', async () => {
  const { api } = load();
  const text = words(17);          // 15 words + 2 on the last line in the 354 px column
  const p = cv([text]);
  p.sections.push(tbl([HDR, ['Lead', text]]));
  const sum = await api.run(p, { measureLines: measureW, fetchImpl: noFetch });
  const t = p.sections[1];
  assert.equal(t.item_condense['rows.1.1'], -10);
  assert.equal(t.item_scale['rows.1.1'], 99);
  assert.equal(t.rows[1][1], text, 'text untouched');
  assert.ok(!p.sections[0].item_condense, 'the same text as a body bullet stays above the -0.4 pt floor');
  assert.ok(sum.condensed >= 1);
});

test('table cell: a single long word alone on the last line (>= 60% fill) is bound with NBSP', async () => {
  const { api } = load();
  const long = 'X'.repeat(37);     // 222 px = 63% of the column, alone on line 2
  const text = words(14) + ' ' + long;
  const p = cv([]);
  p.sections.push(tbl([HDR, ['Lead', text]]));
  const sum = await api.run(p, { measureLines: measureW, fetchImpl: noFetch });
  assert.equal(p.sections[1].rows[1][1], words(13) + ' abc\u00a0' + long);
  assert.equal(sum.bound, 1);
});

test('justified cell: a bind that would stretch the line above under 85% is refused and reported; a left row binds', async () => {
  const { api } = load();
  const text = words(22);
  // Stub for the data cell: each bound space drags 30 px from line 1 to line 2 (base 354 | 100 px). Line 1
  // drops under 85% of the 354.5 px column at 2 binds; line 2 reaches 60% at 4. Other cells: one line.
  const NB = String.fromCharCode(160);
  const stub = (spec) => {
    const t = spec.html.replace(/<[^>]+>/g, '');
    if (t.split(NB).join(' ') !== text) return [10];
    const n = t.split(NB).length - 1;
    return [354 - 30 * n, 100 + 30 * n];
  };
  const pj = cv([]);
  pj.sections.push(tbl([HDR, ['Lead', text]]));
  const sj = await api.run(pj, { measureLines: stub, fetchImpl: noFetch });
  assert.equal(pj.sections[1].rows[1][1], text);
  assert.deepEqual(plain(sj.unfixed), ['core_competencies:rows.1.1']);
  const pl = cv([]);
  pl.sections.push(tbl([HDR, ['Lead', text]], { rowAlign: [null, 'left'] }));
  const sl = await api.run(pl, { measureLines: stub, fetchImpl: noFetch });
  assert.equal(sl.bound, 1);
  assert.equal(pl.sections[1].rows[1][1].split(NB).length - 1, 4);
});

test('table cell: a bind never pushes a token past the column edge (narrow label column)', async () => {
  const { api } = load();
  const p = cv([]);
  p.sections.push(tbl([HDR, ['Regulatory affairs quality', 'ok']]));   // 98 px label column
  await api.run(p, { measureLines: measureW, fetchImpl: noFetch });
  assert.equal(p.sections[1].rows[1][0], 'Regulatory affairs quality');
});

test('education rows, list items, bullets and text_bullets are condense + bind targets with their own geometry', () => {
  const { api } = load();
  const p = cv([]);
  p.sections.push(
    { id: 'education', type: 'education', loc: 'sidebar', items: [{ deg: 'MSc Agricultural Sciences', sch: 'Alnarp' }, { deg: '', sch: '' }, { deg: 'BSc', sch: 'Lund', hidden: true }] },
    { id: 'certs', type: 'list', loc: 'main', title: 'CERTIFICATIONS', items: ['Advanced Certification in Logistics Coordination', { text: 'Second cert', _page: 2 }, '[Cert - issuer]'] },
    { id: 'skills', type: 'list', loc: 'sidebar', bullet_style: 'bullet', items: ['Soil micro-climate modelling'] },
    { id: 'pubs', type: 'list', loc: 'main', title: 'PUBLICATIONS', items: ['A paper'] },
    { id: 'outcomes', type: 'bullets', loc: 'main', items: [null, { b: 'Cut', t: 'losses by 30%' }, 'Plain bullet'] },
    { id: 'contribute', type: 'text_bullets', loc: 'main', intro: 'Intro text here.', items: ['', 'First', 'Second'], closing: 'Closing line.' },
    { id: 'languages', type: 'labeled_list', loc: 'main', items: [{ l: 'Danish', v: 'native' }] },
  );
  const met = api._metricsFromPayload(p);
  const r1 = (x) => Math.round(x * 10) / 10;
  const ts = api._collectTargets(p, met).map((t) => [t.kind, t.sid, t.condensePath, r1(t.widthPx), t.prefixHtml, t.wrap || '']);
  assert.deepEqual(plain(ts), [
    ['edu', 'education', 'items.0', r1(met.sideCellWpx), '<b>MSc Agricultural Sciences: </b>', ''],
    ['list', 'certs', 'items.0', r1(met.cellWpx), '', ''],          // certifications: no bullet
    ['list', 'certs', 'items.1', r1(met.cellWpx), '', ''],
    ['list', 'skills', 'items.0', r1(met.sideBulletWpx), '', ''],
    ['bullets', 'outcomes', 'items.0', r1(met.bulletWpx), '<b>Cut: </b>', ''],
    ['bullets', 'outcomes', 'items.1', r1(met.bulletWpx), '', ''],
    ['tb_body', 'contribute', 'intro', r1(met.cellWpx), '', ''],
    ['tb_body', 'contribute', 'closing', r1(met.cellWpx), '', ''],
    ['tb_item', 'contribute', 'items.0', r1(met.bulletWpx), '', ''],
    ['tb_item', 'contribute', 'items.1', r1(met.bulletWpx), '', ''],
    ['label', 'languages', 'items.0', r1(met.cellWpx), '<b>Danish: </b>', ''],
  ]);
});

test('cover letter: tables-only mode measures the What-I-bring cells; a CL without a table is skipped', async () => {
  const { api } = load();
  const text = words(17);
  const p = { doc: 'cl', layout: 'two_column', style: {}, font_sizes: {}, sections: [
    { id: 'opening', type: 'text', loc: 'main', content: words(40) },
    { id: 'bring', type: 'table', loc: 'main', rows: [HDR, ['Lead', text]] },
  ] };
  const sum = await api.run(p, { measureLines: measureW, fetchImpl: noFetch });
  assert.equal(sum.skipped, undefined);
  assert.equal(sum.scanned, 4, 'two header cells + two data cells, no prose');
  const s2 = await api.run({ doc: 'cl', sections: [{ id: 'opening', type: 'text', content: 'x' }] }, { measureLines: measureW });
  assert.equal(s2.skipped, 'doc');
});
