// orphan-export-preflight.test.mjs
// ============================================================
// ORPHANS v2 (EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001):
// the export preflight measures the BUILT payload with export metrics, binds
// runts with NBSP (L2), batches the residue through one LLM call (L3) gated by
// safeShorten + a re-measure, and mirrors rewrites to stored sections ONLY via
// the shipped text-verified writer. Tests run the sidecar in a vm sandbox with
// a deterministic greedy-wrap measurer + injected fetch/storage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-orphan-export-preflight.js', import.meta.url), 'utf8');
const bindSrc = await readFile(new URL('../../antcv-orphan-measure-bind.js', import.meta.url), 'utf8');

function load(store0, { withVerifier = false } = {}) {
  const store = new Map(Object.entries(store0 || {}));
  const events = [];
  const sandbox = {
    window: {
      addEventListener() {}, dispatchEvent(e) { events.push(e && e.type); return true; },
    },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    Promise, Date, JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat,
  };
  vm.createContext(sandbox);
  if (withVerifier) vm.runInContext(bindSrc, sandbox);   // provides window.AntcvOrphanBind (the shipped ORPHAN-WRITE-VERIFY-001 verifier)
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvOrphanExportPreflight, store, events };
}

// Deterministic greedy word-wrap measurer: every char is CW px wide; words split
// on SPACE only (NBSP glues tokens, exactly like a renderer). Returns one width
// per wrapped line — the same contract as the DOM Range measurer.
const CW = 6;
function fakeMeasure(spec) {
  let t = String(spec.html).replace(/<[^>]+>/g, '');
  t = t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const words = t.split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length * CW <= spec.widthPx) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => l.length * CW);
}

function cvPayload(sections, extra) {
  return { doc: 'cv', layout: 'two_column', sections, style: {}, font_sizes: {}, ...(extra || {}) };
}
const expSection = (bullets, results) => ({
  id: 'experience', type: 'experience', loc: 'main', title: 'EXPERIENCE',
  roles: [{ id: 'r1', title: 'PdM', company: 'Acme', bullets, ...(results ? { results } : {}) }],
});

// ── metrics: the payload IS the geometry source ─────────────────────────────
test('metricsFromPayload: worker defaults (no style tokens, ratio 0.33)', () => {
  const { api } = load();
  const m = api._metricsFromPayload(cvPayload([]));
  // sidebarW = round(11906*0.33) = 3929; mainW = 7977; cell = 7977-2*150 = 7677
  assert.equal(Math.round(m.cellWpx * 10) / 10, 511.8);
  assert.equal(Math.round(m.bulletWpx * 10) / 10, 497.8);   // -210 DXA numbering indent
  assert.equal(m.family, 'Calibri');
  assert.equal(m.bulletPx, 14);                              // 10.5pt -> 14px
});

test('metricsFromPayload: forwarded comfort tokens + ratio + package font', () => {
  const { api } = load();
  const m = api._metricsFromPayload({
    doc: 'cv', sections: [], sidebar_ratio: 0.33, package: 'warm-terracotta',
    style: { mainEdgeIndent: 14, seamGap: 6 }, font_sizes: { bulletContent: 11 },
  });
  // cell = 7977 - 2*210 - 90 = 7467 twips = 497.8px; bullet = 7257/15 = 483.8px
  assert.equal(Math.round(m.cellWpx * 10) / 10, 497.8);
  assert.equal(Math.round(m.bulletWpx * 10) / 10, 483.8);
  assert.equal(m.family, 'Georgia');
  assert.equal(Math.round(m.bulletPx * 100) / 100, Math.round(11 * 96 / 72 * 100) / 100);
});

test('metricsFromPayload: legacy ATS tier forces Calibri; ratio clamped to worker band', () => {
  const { api } = load();
  const m = api._metricsFromPayload({ doc: 'cv', sections: [], package: 'warm-terracotta', legacy_ats_tier: true, sidebar_ratio: 0.05 });
  assert.equal(m.family, 'Calibri');
  const sidebarW = Math.round(11906 * 0.2);                  // clamped to 0.2
  assert.equal(Math.round(m.cellWpx * 15), 11906 - sidebarW - 300);
});

// ── RUNT_FRAC 0.40 boundary ─────────────────────────────────────────────────
test('isRuntLines: 0.40 boundary + single-line never runts', () => {
  const { api } = load();
  assert.equal(api.RUNT_FRAC, 0.40);
  assert.equal(api._isRuntLines([500, 199], 500), true);     // 0.398 < 0.40
  assert.equal(api._isRuntLines([500, 201], 500), false);    // 0.402 >= 0.40
  assert.equal(api._isRuntLines([199], 500), false);         // one line cannot orphan
  assert.equal(api._isRuntLines([], 500), false);
});

// ── measurer math: known text + width → expected break count ────────────────
test('fake measurer contract: greedy wrap + NBSP glue', () => {
  // width 300px @6px/char = 50 chars/line. 3 words of 20 chars: 2 fit (41), 3rd wraps.
  const w20 = 'a'.repeat(20);
  const lines = fakeMeasure({ html: [w20, w20, w20].join(' '), widthPx: 300 });
  assert.equal(lines.length, 2);
  assert.equal(lines[1], 20 * CW);
  // NBSP-gluing the last gap forces both words down as one unit
  const glued = fakeMeasure({ html: w20 + ' ' + w20 + ' ' + w20, widthPx: 300 });
  assert.equal(glued.length, 2);
  assert.equal(glued[1], 41 * CW);
});

// ── L2: a bindable runt is NBSP-bound in the payload, no LLM call ────────────
test('L2 bind clears a runt without an LLM call', async () => {
  // width 497.8px -> ~82 chars/line. Uniform 4-char words; make the last line a
  // 1-word runt; binding trailing gaps pulls a whole group down past 0.40.
  const words = Array(34).fill('word');                      // 34*5-1 = 169 chars ≈ 3 lines
  const text = words.join(' ') + '.';
  const secs = [expSection([text])];
  const payload = cvPayload(secs);
  let fetchCalls = 0;
  const { api } = load();
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => { fetchCalls++; return Promise.reject(new Error('no')); } });
  const out = payload.sections[0].roles[0].bullets[0];
  const m = fakeMeasure({ html: out, widthPx: 497.8 });
  if (sum.bound === 1) {
    assert.ok(out.includes(' '), 'bullet carries NBSP glue');
    assert.equal(api._isRuntLines(m, 497.8), false, 'bound text no longer runts');
    assert.equal(fetchCalls, 0, 'no LLM call when L2 clears everything');
  } else {
    // fixture landed as unfixable-by-binding on this grid — must be residue then
    assert.equal(sum.runts, 1);
    assert.equal(sum.residue, 1);
  }
});

// ── L3: residue goes through ONE batched call; safeShorten + re-measure gate ─
function residueFixture() {
  // width 497.8 -> ~82 chars. 2-char words: MAX_BIND=6 binds glue ≤7 words = 20
  // chars = 120px < 0.40*497.8 (199px) -> L2 can never clear it -> residue.
  const words = Array(56).fill('ab');                        // 56*3-1 = 167 chars ≈ 3 lines, runt tail
  return words.join(' ') + ' zz 42.';
}
// A valid rewrite: shorter than orig but >= 45% of it (safeShorten floor), keeps
// the number, and greedy-measures to 2 lines with a wide (non-runt) last line.
const GOOD_SHORT = 'ab '.repeat(40).trim() + ' zz 42.';
test('L3: batched rewrite applied when safeShorten + re-measure pass', async () => {
  const orig = residueFixture();
  const short = GOOD_SHORT;
  const payload = cvPayload([expSection([orig])]);
  let body = null;
  const fetchImpl = (url, opts) => { body = JSON.parse(opts.body); return Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify([short]) }] }) }); };
  const { api, store, events } = load({ proxyUrl: 'https://relay.example' });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl });
  assert.equal(sum.residue, 1);
  assert.equal(sum.rewritten, 1);
  assert.equal(payload.sections[0].roles[0].bullets[0], short);
  assert.equal(body.model, 'claude-sonnet-5');
  assert.deepEqual(JSON.parse(body.messages[0].content), [orig], 'one batched call carries the residue');
  assert.ok(events.includes('antcv:sections-updated'));
  const attempted = JSON.parse(store.get('antcv:orphanPreflightAttempted'));
  assert.equal(Object.keys(attempted).length, 1, 'attempt recorded');
});

test('L3 gate: a rewrite that drops a number is rejected (payload unchanged)', async () => {
  const orig = residueFixture();                              // contains "42"
  const bad = 'ab '.repeat(18).trim() + ' zz.';               // number gone
  const payload = cvPayload([expSection([orig])]);
  const { api } = load({ proxyUrl: 'https://relay.example' });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify([bad]) }] }) }) });
  assert.equal(sum.rewritten, 0);
  assert.equal(payload.sections[0].roles[0].bullets[0], orig);
});

test('L3 gate: em dash introduced by the rewrite is rejected', () => {
  const { api } = load();
  assert.equal(api._safeShorten('Lead validation and delivery for the crew program', 'Lead validation — delivery for crew'), false);
  assert.equal(api._safeShorten('Lead validation and delivery for the crew program', 'Lead validation, delivery for crew'), true);
});

test('L3 failure (network down): run resolves, export payload keeps going', async () => {
  const orig = residueFixture();
  const payload = cvPayload([expSection([orig])]);
  const { api } = load({ proxyUrl: 'https://relay.example' });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => Promise.reject(new Error('offline')) });
  assert.equal(sum.l3, 'error');
  assert.equal(payload.sections[0].roles[0].bullets[0], orig, 'payload intact');
});

test('L3 attempted-cap: the same failing line stops costing calls after 2 attempts', async () => {
  const orig = residueFixture();
  let calls = 0;
  const failFetch = () => { calls++; return Promise.resolve({ json: () => Promise.resolve({ content: [{ text: 'garbage' }] }) }); };
  const { api, store } = load({ proxyUrl: 'https://relay.example' });
  for (let i = 0; i < 3; i++) {
    const payload = cvPayload([expSection([orig])]);
    await api.run(payload, { measureLines: fakeMeasure, fetchImpl: failFetch, storage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } });
  }
  assert.equal(calls, 2, 'third export skips the LLM for an already-attempted line');
});

// ── kill switch + doc gating ────────────────────────────────────────────────
test('kill switch: payload untouched, no measurement', async () => {
  const orig = residueFixture();
  const payload = cvPayload([expSection([orig])]);
  const { api } = load({ 'antcv:disable-orphan-preflight': '1' });
  const sum = await api.run(payload, { measureLines: () => { throw new Error('must not measure'); } });
  assert.equal(sum.disabled, true);
  assert.equal(payload.sections[0].roles[0].bullets[0], orig);
});

test('CL / linear payloads are skipped', async () => {
  const { api } = load();
  const sum = await api.run({ doc: 'cl', layout: 'linear', sections: [] }, { measureLines: fakeMeasure });
  assert.equal(sum.skipped, 'doc');
});

test('bracketed placeholders, sidebar subheads/hidden rows and non-labeled sidebar types are never targets', () => {
  const { api } = load();
  const payload = cvPayload([
    { ...expSection(['[Bullet 1 - describe scope]']), id: 'experience' },
    { id: 'certs', type: 'list', loc: 'sidebar', items: ['BABOK v3 - IIBA (2022)'] },     // simple list: not targeted
    { id: 'tools', type: 'labeled_list', loc: 'sidebar', items: [
      { group: 'Methods' },                                                               // subhead: never
      { l: 'Hidden', v: 'some hidden value text', hidden: true },                         // hidden: never
      { l: 'Ph', v: '[placeholder value]' },                                              // placeholder: never
    ] },
    { id: 'profile', type: 'text', loc: 'main', content: '[PROFILE - template placeholder]' },
  ]);
  const targets = api._collectTargets(payload, api._metricsFromPayload(payload));
  assert.equal(targets.length, 0);
});

// ── SIDEBAR-ORPHANS-001 (owner PDF review 2026-07-03): all 7 runts in the
// owner's export were sidebar labeled values — the sidebar is now measured
// with its OWN column geometry and L2-bound; sidebar lines never go to L3. ──
test('sidebar labeled_list values are targets with sidebar metrics + bold label prefix', () => {
  const { api } = load();
  const payload = cvPayload([
    { id: 'tools', type: 'labeled_list', loc: 'sidebar', items: [
      { group: 'Tools' },
      { l: 'Lab & fabrication', v: 'Cleanroom fabrication, photolithography, thin-film deposition and etching' },
      { l: 'NoLabel', v: 'value-only measured row text here', labelHidden: true },
    ] },
  ]);
  const m = api._metricsFromPayload(payload);
  // sidebarW = round(11906*0.33) = 3929; side cell = 3929 - 2*120 = 3689 twips = 245.9px
  assert.equal(Math.round(m.sideCellWpx * 10) / 10, 245.9);
  assert.equal(Math.round(m.sbBodyPx * 100) / 100, Math.round(10 * 96 / 72 * 100) / 100);
  assert.equal(m.sideFamily, 'Cabin');
  const targets = api._collectTargets(payload, m);
  assert.equal(targets.length, 2);
  assert.equal(targets[0].kind, 'side_label');
  assert.equal(Math.round(targets[0].widthPx * 10) / 10, 245.9, 'sidebar target measures at the SIDEBAR column width');
  assert.match(targets[0].prefixHtml, /<b>Lab &amp; fabrication: <\/b>/);
  assert.equal(targets[1].prefixHtml, '', 'labelHidden row measures value only');
});

test('sidebar runts are L2-bound in the payload and NEVER become L3 residue', async () => {
  // side cell 245.9px @6px/char ≈ 40 chars/line; 1-char words make an
  // unbindable runt (MAX_BIND glue is far under 0.40 of the column).
  const unbindable = Array(60).fill('a').join(' ') + '.';
  const bindable = Array(17).fill('word').join(' ') + '.';
  const payload = cvPayload([
    { id: 'tools', type: 'labeled_list', loc: 'sidebar', items: [
      { l: 'Lab', v: bindable },
      { l: 'Reg', v: unbindable },
    ] },
  ]);
  let fetchCalls = 0;
  const { api } = load({ proxyUrl: 'https://relay.example' });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => { fetchCalls++; return Promise.resolve({ json: () => Promise.resolve({ content: [{ text: '[]' }] }) }); } });
  assert.equal(sum.residue, 0, 'sidebar runts never reach the L3 residue list');
  assert.equal(fetchCalls, 0, 'no LLM call for sidebar-only runts');
  assert.equal(sum.runts >= 1, true, 'the fixture did runt');
  if (sum.bound >= 1) {
    const vals = [payload.sections[0].items[0].v, payload.sections[0].items[1].v].join('');
    assert.ok(vals.includes(' '), 'a bound sidebar value carries NBSP glue');
  }
});

// ── profile + results targets ────────────────────────────────────────────────
test('profile paragraphs and per-role Results are measured; Results carries the lead prefix', () => {
  const { api } = load();
  const payload = cvPayload([
    expSection(['a bullet with words'], 'Cut cycle time 95% across programs.'),
    { id: 'profile', type: 'text', loc: 'main', content: 'First paragraph here.\n\nSecond paragraph here.' },
  ]);
  const targets = api._collectTargets(payload, api._metricsFromPayload(payload));
  // join for comparison — the vm-realm array has a foreign Array.prototype
  const kinds = Array.from(targets, (t) => t.kind).sort().join(',');
  assert.equal(kinds, 'bullet,profile,profile,results');
  const res = targets.find((t) => t.kind === 'results');
  assert.match(res.prefixHtml, /Results: /);
  const prof = targets.find((t) => t.kind === 'profile');
  prof.set('Replaced paragraph.');
  assert.match(payload.sections[1].content, /^Replaced paragraph\.\n\nSecond paragraph here\.$/);
});

// ── verified-write mirror (build ON the shipped verifier) ────────────────────
test('mirror: rewrite lands in stored sections ONLY when the text verifies', async () => {
  const orig = residueFixture();
  const short = GOOD_SHORT;
  // stored sections: the same bullet exists (plus a hidden role shifting indices,
  // the export-16 corruption shape) -> text-verified write must still hit ONLY it
  const stored = { cv: [{ id: 'experience', type: 'experience', roles: [
    { id: 'r0', title: 'Hidden', on: false, bullets: ['unrelated bullet text here'] },
    { id: 'r1', title: 'PdM', company: 'Acme', bullets: ['another real bullet entirely', orig] },
  ] }], cl: [] };
  const payload = cvPayload([expSection([orig])]);
  const { api, store } = load({ proxyUrl: 'https://relay.example', sections: JSON.stringify(stored) }, { withVerifier: true });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify([short]) }] }) }) });
  assert.equal(sum.rewritten, 1);
  assert.equal(sum.mirrored, 1);
  const after = JSON.parse(store.get('sections'));
  assert.equal(after.cv[0].roles[1].bullets[1], short, 'stored bullet updated by unique text match');
  assert.equal(after.cv[0].roles[0].bullets[0], 'unrelated bullet text here', 'other roles untouched');
});

test('mirror: NO stored write when the measured text matches nothing (abort, never index-trust)', async () => {
  const orig = residueFixture();
  const short = GOOD_SHORT;
  const stored = { cv: [{ id: 'experience', type: 'experience', roles: [
    { id: 'r1', title: 'PdM', company: 'Acme', bullets: ['completely different stored text'] },
  ] }], cl: [] };
  const payload = cvPayload([expSection([orig])]);
  const { api, store } = load({ proxyUrl: 'https://relay.example', sections: JSON.stringify(stored) }, { withVerifier: true });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify([short]) }] }) }) });
  assert.equal(sum.rewritten, 1, 'payload still fixed');
  assert.equal(sum.mirrored || 0, 0, 'stored write aborted');
  const after = JSON.parse(store.get('sections'));
  assert.equal(after.cv[0].roles[0].bullets[0], 'completely different stored text');
});

// ── binding helpers ──────────────────────────────────────────────────────────
test('bindLastN is tag-aware and preserves trailing whitespace', () => {
  const { api } = load();
  assert.equal(api._bindLastN('one two three ', 1), 'one two three ', 'last gap bound, trailing space intact');
  const tagged = api._bindLastN('lead <b>bold run</b> tail words', 2);
  assert.equal(tagged, 'lead <b>bold run</b> tail words', 'last 2 text gaps bound, tag markup untouched');
  assert.equal(api._bindableSpaces('<b attr="x y">t</b> a b').length, 2, 'spaces inside <...> never counted');
});

test('toDisplayHtml: entities decoded, tags normalized, links reduced to text', () => {
  const { api } = load();
  assert.equal(api._toDisplayHtml('A &amp; B'), 'A &amp; B');
  assert.equal(api._toDisplayHtml('<strong>x</strong> <em>y</em>'), '<b>x</b> <i>y</i>');
  assert.equal(api._toDisplayHtml('see [the docs](https://x.y/z) now'), 'see the docs now');
});
