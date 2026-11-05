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

test('a short last line is pulled back by the smallest condense that holds at 98% of the column (-0.3 pt)', async () => {
  const { api } = load();
  const p = cv([words(22)]);            // 87 chars; ~82 fit per line at 497.8px -> 2 lines, last line ~5 chars
  const sum = await api.run(p, { measureLines: measure, fetchImpl: () => Promise.reject(new Error('no')) });
  assert.equal(sum.condensed, 1);
  // 87 chars must fit 98% of 497.8 px (SAFE_FIT): -0.3 pt alone (cost .057) is the cheapest step that does;
  // 99% + -0.2 pt (.048) would fit the full column only
  assert.equal(JSON.stringify(p.sections[0].item_condense), JSON.stringify({ 'roles.0.bullets.0': -6 }));
  assert.ok(!p.sections[0].item_scale, 'no width step needed');
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
  assert.ok(cells.every((t) => t.cell));
  // NO-ORPHAN-002: data cells may be reworded; the label column gets a one-line brief
  assert.deepEqual(plain(cells.filter((t) => !t.noRewrite).map((t) => t.condensePath)), ['rows.1.0', 'rows.1.1', 'rows.3.0', 'rows.3.1']);
  assert.equal(by['rows.1.0'].label, true);
  assert.equal(by['rows.1.1'].label, false);
  assert.equal(by['rows.1.0'].fitChars, Math.floor(by['rows.1.0'].widthPx / (by['rows.1.0'].fontPx * 0.55)));
});

test('table cell: a condense the body floor cannot reach uses the cell ladder (-0.5 pt + character width)', async () => {
  const { api } = load();
  const text = words(17);          // 15 words + 2 on the last line in the 354 px column
  const p = cv([text]);
  p.sections.push(tbl([HDR, ['Lead', text]]));
  const sum = await api.run(p, { measureLines: measureW, fetchImpl: noFetch });
  const t = p.sections[1];
  // 67 chars in 98% of 354.5 px: 97% + -0.5 pt ties 95% + -0.4 pt on cost; the wider character wins
  assert.equal(t.item_condense['rows.1.1'], -10);
  assert.equal(t.item_scale['rows.1.1'], 97);
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
  assert.equal(sj.residue, 1, 'NO-ORPHAN-002: an unbindable data cell goes to the L3 reword');
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

test('cover letter: measured in full at the body width (NO-ORPHAN-002); an empty CL is skipped', async () => {
  const { api } = load();
  const text = words(17);
  const p = { doc: 'cl', layout: 'two_column', style: {}, font_sizes: {}, sections: [
    { id: 'opening', type: 'text', loc: 'main', content: words(40) },
    { id: 'bring', type: 'table', loc: 'main', rows: [HDR, ['Lead', text]] },
  ] };
  const sum = await api.run(p, { measureLines: measureW, fetchImpl: noFetch });
  assert.equal(sum.skipped, undefined);
  assert.equal(sum.scanned, 5, 'the opening paragraph + two header cells + two data cells');
  const met = api._metricsFromPayload(p);
  assert.ok(Math.abs(met.cellWpx - (11906 - 400) / 15) < 1e-9, 'CL body = PAGE_W - 400');
  const s2 = await api.run({ doc: 'cl', sections: [] }, { measureLines: measureW });
  assert.equal(s2.skipped, 'doc');
});

// ── NO-ORPHAN-002 (owner 2026-11-05: reword labels; check marked rows / bullets, especially the cover letter and
// the CV bullet lists; fix experience bullets). Owner fix order: compress (body 96%), widen (to 104%), bind, reword.
const NBHY = String.fromCharCode(0x2011), NBS = String.fromCharCode(160);

test('bind: hyphens inside the bound tail become U+2011 (a renderer breaks after "-"); others and tags untouched', () => {
  const { api } = load();
  const s = 'Kept late-winter stock through early-spring <b>cross-team</b> peaks';
  // n = 1: the group is "<b>cross-team</b> peaks"; early-spring keeps its break
  assert.equal(api._bindLastN(s, 1), 'Kept late-winter stock through early-spring <b>cross' + NBHY + 'team</b>' + NBS + 'peaks');
  // n = 2: the group starts at "early-spring"; late-winter (before the group) is untouched
  assert.equal(api._bindLastN(s, 2), 'Kept late-winter stock through early' + NBHY + 'spring' + NBS + '<b>cross' + NBHY + 'team</b>' + NBS + 'peaks');
  assert.ok(api._bindLastN('a b <b class="x-y">c</b> d', 2).includes('class="x-y"'), 'never inside a tag');
});

test('widen (owner step 2): 101..104% when it fills the last line without adding one; refused without headroom', () => {
  const { api } = load();
  // natural line widths at 100%; measureTarget scales them by the width step and divides the column by it.
  // A line wider than the column the stub is given reflows into three lines.
  const stub = (n1, n2) => (spec) => { const a = spec.widthPx >= n1 ? [n1, n2] : [n1 - 100, 200, n2]; a.lastWords = 3; return a; };
  const tg = { condensePath: 'items.0', get: () => 'x y z', widthPx: 497.8, fontPx: 14, prefixHtml: '' };
  // 292 px = 58.7% of 497.8: 102% gives 297.8 (still under 298.7), 103% gives 300.8 -> filled
  const sec = {};
  assert.deepEqual(plain(api._tryWiden(stub(470, 292), { ...tg, sec })), { widened: true, scale: 103 });
  assert.equal(sec.item_scale['items.0'], 103);
  // a 476 px first line: at 103% only 473.6 px remain under the 98% margin -> it would reflow -> refused
  const sec2 = {};
  assert.deepEqual(plain(api._tryWiden(stub(476, 292), { ...tg, sec: sec2 })), {});
  assert.ok(!sec2.item_scale);
});

test('marker rows are targets in both columns: bullet geometry, no auto-colon, L3 only for markers and the cover letter', () => {
  const { api } = load();
  const p = cv([]);
  p.sections.push(
    { id: 'outcomes', type: 'rich_block', loc: 'main', items: [
      { b: 'Lead', t: 'A prose row body long enough' },
      { b: 'Cut', t: 'losses by 30% through tracking', mk: true },
      { b: '', t: 'An emoji led marker row', mk: '★' },
      { grp: true, t: 'Group' },
    ] },
    { id: 'skills', type: 'rich_block', loc: 'sidebar', items: [{ b: 'Lab', t: 'PCR and assays', mk: true }] },
  );
  const met = api._metricsFromPayload(p);
  const ts = api._collectTargets(p, met);
  const by = Object.fromEntries(ts.map((t) => [t.sid + ':' + t.condensePath, t]));
  assert.equal(by['outcomes:items.0'].kind, 'main_rich');
  assert.equal(by['outcomes:items.0'].noRewrite, true, 'CV prose rows: bind only (owner prose)');
  assert.equal(by['outcomes:items.0'].prefixHtml, '<b>Lead: </b>');
  assert.equal(by['outcomes:items.1'].kind, 'rich_mk');
  assert.equal(by['outcomes:items.1'].noRewrite, false);
  assert.equal(by['outcomes:items.1'].prefixHtml, '<b>Cut </b>', 'a marker lead gets no colon');
  assert.equal(by['outcomes:items.1'].widthPx, met.bulletWpx);
  assert.equal(by['outcomes:items.1'].fontPx, met.bulletPx);
  assert.equal(by['outcomes:items.2'].prefixHtml, '★ ');
  assert.equal(by['outcomes:items.2'].widthPx, met.cellWpx);
  assert.equal(by['outcomes:items.1'].justified, false, 'a grouped section renders LEFT');
  assert.equal(by['skills:items.0'].kind, 'side_label');
  assert.equal(by['skills:items.0'].widthPx, met.sideBulletWpx);
  // the same rows in a cover letter all go to L3 when nothing else fixes them
  const cl = { doc: 'cl', layout: 'linear', style: {}, font_sizes: {}, sections: [p.sections[1], { id: 'closure', type: 'text', loc: 'main', content: 'I would welcome the chance to talk.' }] };
  const cts = api._collectTargets(cl, api._metricsFromPayload(cl));
  assert.ok(cts.every((t) => t.noRewrite === false), 'cover-letter rows and text are rewordable');
});

test('a two-word label that wraps one word per line goes to the L3 reword with a one-line brief', async () => {
  const { api } = load({ proxyUrl: 'https://relay.example' });
  const p = cv([]);
  p.sections.push(tbl([HDR, ['Stakeholdering reportings', 'ok']]));   // 25 chars: two lines in the 98 px column
  let sent = null;
  const fetchImpl = (u, o) => { sent = JSON.parse(JSON.parse(o.body).messages[0].content); return Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify(['Stakeholders']) }] }) }); };
  const sum = await api.run(p, { measureLines: measureW, fetchImpl });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'label');
  assert.equal(sent[0].fitChars, Math.floor(((1922 - 450) / 15) / ((40 / 3) * 0.55)));
  assert.equal(sum.rewritten, 1);
  assert.equal(p.sections[1].rows[1][0], 'Stakeholders');
});

test('mirror: a cell / marker-row rewrite lands in the stored section only on a unique text match', () => {
  const { api } = load();
  const mk = (rows) => new Map([['sections', JSON.stringify({ cv: [{ id: 'core', type: 'table', rows }], cl: [{ id: 'bring', type: 'rich_block', items: [{ b: 'X', t: 'Shared text', mk: true }] }] })]]);
  const st = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) });
  const m1 = mk([HDR, ['Cross-team handover', 'proof']]);
  assert.equal(api._mirrorGeneric({ sid: 'core', doc: 'cv' }, 'Team handover', 'Cross-team handover', st(m1)), true);
  assert.equal(JSON.parse(m1.get('sections')).cv[0].rows[1][0], 'Team handover');
  const m2 = mk([HDR, ['Same', 'x'], ['Same', 'y']]);
  assert.equal(api._mirrorGeneric({ sid: 'core', doc: 'cv' }, 'New', 'Same', st(m2)), false, 'two hits: abort');
  const m3 = mk([HDR]);
  assert.equal(api._mirrorGeneric({ sid: 'bring', doc: 'cl' }, 'Short', 'Shared text', st(m3)), true, 'cover letter list');
  assert.equal(JSON.parse(m3.get('sections')).cl[0].items[0].t, 'Short');
});
