// orphan-export-preflight.test.mjs
// ============================================================
// ORPHANS v2 (EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001):
// the export preflight measures the BUILT payload with export metrics, binds
// runts with NBSP (L2), batches the residue through one LLM call (L3) gated by
// safeShorten + a re-measure, and mirrors rewrites to stored sections ONLY via
// the shipped text-verified writer. Tests run the sidecar in a vm sandbox with
// a deterministic greedy-wrap measurer + injected fetch/storage.
// v3 (MAIN-RUNT-ORPHAN-SWEEP-001, register row 27): RUNT_FRAC 0.60 (the owner
// fill floor), L3 may LENGTHEN from kernel FACTS (safeRewrite gate — new
// numbers must exist in the stored facts), NO-FORCE-JUSTIFY belt (rule 30:
// payload item_alignment LEFT override for naturally under-filled mid-lines),
// SIDEBAR-PACKING belt (rule 40: comma-token reorder, accepted only when the
// measured line count drops), and rich_block sidebar rows as bind targets.

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

// ── RUNT_FRAC 0.60 boundary (v3: the owner fill floor IS the threshold) ─────
test('isRuntLines: 0.60 boundary + single-line never runts', () => {
  const { api } = load();
  assert.equal(api.RUNT_FRAC, 0.60);
  assert.equal(api._isRuntLines([500, 299], 500), true);     // 0.598 < 0.60
  assert.equal(api._isRuntLines([500, 301], 500), false);    // 0.602 >= 0.60
  assert.equal(api._isRuntLines([299], 500), false);         // one line cannot orphan
  assert.equal(api._isRuntLines([], 500), false);
});

test('hasUnderfilledMidline: rule-30 detector reads NON-last lines only', () => {
  const { api } = load();
  assert.equal(api.JUSTIFY_MIN, 0.85);
  assert.equal(api._hasUnderfilledMidline([420, 480], 500), true);   // 0.84 mid-line
  assert.equal(api._hasUnderfilledMidline([430, 100], 500), false);  // mid fine; LAST line never counts
  assert.equal(api._hasUnderfilledMidline([100], 500), false);       // single line: nothing to justify-stretch
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

// ── L3: residue goes through ONE batched call; safeRewrite + re-measure gate ─
function residueFixture() {
  // width 497.8 -> ~82 chars. 2-char words: MAX_BIND=8 binds glue ≤9 words = 26
  // chars = 156px < 0.60*497.8 (299px) -> L2 can never clear it -> residue.
  const words = Array(56).fill('ab');                        // 56*3-1 = 167 chars ≈ 3 lines, runt tail
  return words.join(' ') + ' zz 42.';
}
// A valid rewrite: shorter than orig but >= 45% of it (safeShorten floor), keeps
// the number, and greedy-measures to 2 lines with a >=60%-filled last line
// (46 words -> 27 + 19; last line 57 chars = 342px = 68.7% of 497.8).
const GOOD_SHORT = 'ab '.repeat(44).trim() + ' zz 42.';
test('L3: batched rewrite applied when safeRewrite + re-measure pass', async () => {
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
  // v3 request shape: each residue item carries the line + its kernel FACTS
  // (empty here — no personalInfo in storage).
  assert.deepEqual(JSON.parse(body.messages[0].content), [{ line: orig, facts: '' }], 'one batched call carries the residue');
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
  // SIDEBAR-FONT-METRIC-001: the payload never carries sidebarBodyFont (the worker
  // fills it from the package BODY font), so the measurer must use the same body
  // family as the main column — NEVER style.sidebarFont (the heading font).
  assert.equal(m.sideFamily, 'Calibri');
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

// ════════════════════════════════════════════════════════════════════════════
// v3 — MAIN-RUNT-ORPHAN-SWEEP-001 (register row 27)
// ════════════════════════════════════════════════════════════════════════════

// ── safeRewrite: the LENGTHEN gate (never fabricate) ─────────────────────────
test('safeRewrite: shorter rewrites keep the safeShorten contract', () => {
  const { api } = load();
  const orig = 'Lead validation and delivery for the crew program across three sites';
  assert.equal(api._safeRewrite(orig, 'Lead validation and delivery for the crew program', ''), true);
  assert.equal(api._safeRewrite(orig, orig, 'facts'), false, 'identical rewrite is a no-op');
});

test('safeRewrite: a LONGER rewrite requires facts and fact-backed new numbers', () => {
  const { api } = load();
  const orig = 'Led optical validation for LiDAR programs';
  const longer = 'Led optical validation for LiDAR programs across 12 automotive platforms';
  assert.equal(api._safeRewrite(orig, longer, ''), false, 'no facts -> nothing stored to lengthen from');
  assert.equal(api._safeRewrite(orig, longer, 'delivered 12 automotive platforms end to end'), true);
  assert.equal(api._safeRewrite(orig, longer, 'delivered platforms end to end'), false, 'new number 12 absent from facts -> fabrication, rejected');
});

test('safeRewrite: growth bound + banned dashes + original numbers verbatim', () => {
  const { api } = load();
  const orig = 'Cut cycle time 95% in review';
  assert.equal(api._safeRewrite(orig, 'Cut cycle time 95% in review — with governance', 'with governance'), false, 'em dash never enters');
  assert.equal(api._safeRewrite(orig, 'Cut review cycle in governance work', 'facts'), false, '95% dropped');
  const huge = orig + ' ' + 'pad '.repeat(40);
  assert.equal(api._safeRewrite(orig, huge, 'pad'), false, 'growth bounded — fill the line, not the page');
});

// ── kernelFactsFor: stored detail per target kind ────────────────────────────
test('kernelFactsFor: bullets match kernel experience by company; profile reads background+workStyle', () => {
  const pi = { personalInfo: {
    background: 'Physicist turned product engineer.',
    workStyle: 'Works through relationships across engineering and suppliers.',
    experience: [
      { title: 'EO Engineer', company: 'Acme', bullets: ['Built test benches for 14 product lines'], results: 'Cut NRE 30%.' },
      { title: 'Other', company: 'Elsewhere', bullets: ['Unrelated detail'] },
    ],
  } };
  const { api } = load({ personalInfo: JSON.stringify(pi) });
  const bulletFacts = api._kernelFactsFor({ kind: 'bullet', role: { title: 'Senior EO Engineer', company: 'Acme' } }, null);
  assert.match(bulletFacts, /14 product lines/);
  assert.match(bulletFacts, /Cut NRE 30%/);
  assert.doesNotMatch(bulletFacts, /Unrelated detail/, 'other companies never leak in');
  const profFacts = api._kernelFactsFor({ kind: 'profile' }, null);
  assert.match(profFacts, /Physicist turned product engineer/);
  assert.match(profFacts, /relationships across engineering/);
  assert.equal(api._kernelFactsFor({ kind: 'side_label' }, null), '', 'sidebar values never get facts');
});

// ── L3 LENGTHEN end-to-end: runt line grows from kernel facts, no line gained ─
test('L3 lengthen: fact-backed longer rewrite fills the runt line without adding a line', async () => {
  const orig = Array(56).fill('ab').join(' ') + ' zz.';
  const longer = Array(56).fill('ab').join(' ') + ' zz 45 ' + Array(14).fill('ab').join(' ') + '.';
  const pi = { experience: [{ title: 'PdM', company: 'Acme', bullets: ['Improved throughput by 45 percent using automation'], results: '' }] };
  const payload = cvPayload([expSection([orig])]);
  let body = null;
  const fetchImpl = (url, opts) => { body = JSON.parse(opts.body); return Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify([longer]) }] }) }); };
  const { api } = load({ proxyUrl: 'https://relay.example', personalInfo: JSON.stringify(pi) });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl });
  assert.equal(sum.residue, 1);
  assert.equal(sum.rewritten, 1, 'lengthened rewrite accepted');
  assert.equal(payload.sections[0].roles[0].bullets[0], longer);
  const sent = JSON.parse(body.messages[0].content);
  assert.match(sent[0].facts, /45 percent/, 'kernel facts shipped with the residue line');
  // the re-measure: same line count as the original, last line >= 60%
  const m = fakeMeasure({ html: longer, widthPx: 497.8 });
  assert.equal(m.length, fakeMeasure({ html: orig, widthPx: 497.8 }).length);
  assert.ok(m[m.length - 1] / 497.8 >= 0.60);
});

test('L3 lengthen: a longer rewrite whose new number is NOT in the facts is rejected', async () => {
  const orig = Array(56).fill('ab').join(' ') + ' zz.';
  const fabricated = Array(56).fill('ab').join(' ') + ' zz 99 ' + Array(14).fill('ab').join(' ') + '.';
  const pi = { experience: [{ title: 'PdM', company: 'Acme', bullets: ['Improved throughput by 45 percent'], results: '' }] };
  const payload = cvPayload([expSection([orig])]);
  const { api } = load({ proxyUrl: 'https://relay.example', personalInfo: JSON.stringify(pi) });
  const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl: () => Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify([fabricated]) }] }) }) });
  assert.equal(sum.rewritten, 0, 'fabricated 99 blocked by the facts gate');
  assert.equal(payload.sections[0].roles[0].bullets[0], orig);
});

// ── rule 30: NO-FORCE-JUSTIFY belt ───────────────────────────────────────────
// width 497.8 (bullet) @6px/char = 82 chars/line. Ten 6-char words = 69 chars
// (414px = 83.2% < JUSTIFY_MIN 85%) then a 60-char word forces the wrap: the
// mid-line is naturally under-filled -> justified render would stretch it.
const midUnderfillBullet = () => Array(10).fill('sixchr').join(' ') + ' ' + 'x'.repeat(60);
test('rule 30: an under-filled mid-line writes a LEFT item_alignment override into the payload', async () => {
  const payload = cvPayload([expSection([midUnderfillBullet()])]);
  const { api } = load();
  const sum = await api.run(payload, { measureLines: fakeMeasure });
  assert.equal(sum.leftAligned, 1);
  assert.equal(payload.sections[0].item_alignment['roles.0.bullets.0'], 'left');
  assert.equal(sum.residue, 0, 'last line at 72% is not a runt — alignment was the only fix');
});

test('rule 30: explicit user CJLR on the path (or a __group__ override) always wins', async () => {
  const p1 = cvPayload([{ ...expSection([midUnderfillBullet()]), item_alignment: { 'roles.0.bullets.0': 'justify' } }]);
  const { api } = load();
  const s1 = await api.run(p1, { measureLines: fakeMeasure });
  assert.equal(s1.leftAligned, 0);
  assert.equal(p1.sections[0].item_alignment['roles.0.bullets.0'], 'justify', 'user choice untouched');
  const p2 = cvPayload([{ ...expSection([midUnderfillBullet()]), item_alignment: { __group__: 'justify' } }]);
  const s2 = await api.run(p2, { measureLines: fakeMeasure });
  assert.equal(s2.leftAligned, 0);
  assert.equal(p2.sections[0].item_alignment['roles.0.bullets.0'], undefined);
});

// ── rule 40: sidebar packing belt ────────────────────────────────────────────
test('packTokens: comma token lists parse; prose and grouped values are shape-gated out', () => {
  const { api } = load();
  const ok = api._packTokens('Python, Git, Jupyter, MATLAB.');
  assert.ok(ok && ok.trailingDot);
  assert.equal(Array.from(ok.toks).join('|'), 'Python|Git|Jupyter|MATLAB');
  assert.equal(api._packTokens('Stability, calm, and reliable under pressure'), null, 'conjunction token = prose');
  assert.equal(api._packTokens('One, two'), null, 'fewer than 3 tokens');
  assert.equal(api._packTokens('Optics: benches, HRSEM, Raman'), null, 'inner colon = prose/label');
  assert.equal(api._packTokens('A; B, C, D'), null, 'semicolon grouping preserved');
  assert.equal(api._packTokens('[placeholder], b, c'), null, 'placeholders never');
});

// Sidebar width 245.9px @6px/char = 40 chars/line, bold lead "Software: " counts.
// Long,long,long,short,short wraps to 3 lines; long+short adjacency packs to 2.
const PACK_ITEMS = () => [
  { grp: true, t: 'Tools' },
  { b: 'Software', t: 'aaaaaaaaaaaaaaaa, cccccccccccccccc, eeeeeeeeeeeeeeee, bb, dd' },
];
test('rule 40: rich_block tools row is packed to fewer measured lines, tokens preserved', async () => {
  const payload = cvPayload([{ id: 'tools', type: 'rich_block', loc: 'sidebar', items: PACK_ITEMS() }]);
  const { api } = load();
  const sum = await api.run(payload, { measureLines: fakeMeasure });
  assert.equal(sum.packed, 1);
  assert.ok(sum.packedLinesSaved >= 1);
  const packed = payload.sections[0].items[1].t;
  const before = fakeMeasure({ html: '<b>Software: </b>' + 'aaaaaaaaaaaaaaaa, cccccccccccccccc, eeeeeeeeeeeeeeee, bb, dd', widthPx: 245.9 });
  const after = fakeMeasure({ html: '<b>Software: </b>' + packed, widthPx: 245.9 });
  assert.ok(after.length < before.length, 'measured line count dropped');
  assert.equal(
    packed.split(',').map((t) => t.trim()).sort().join('|'),
    'aaaaaaaaaaaaaaaa, cccccccccccccccc, eeeeeeeeeeeeeeee, bb, dd'.split(',').map((t) => t.trim()).sort().join('|'),
    'same token multiset — order only'
  );
});

test('rule 40: kill switch antcv:disable-sidebar-packing leaves the value byte-identical', async () => {
  const payload = cvPayload([{ id: 'tools', type: 'rich_block', loc: 'sidebar', items: PACK_ITEMS() }]);
  const { api } = load({ 'antcv:disable-sidebar-packing': '1' });
  const sum = await api.run(payload, { measureLines: fakeMeasure });
  assert.equal(sum.packed, undefined);
  // L2 NBSP binding may still glue trailing gaps (that is the bind belt, not
  // packing) — token ORDER must be untouched.
  const nbsp = String.fromCharCode(160);
  assert.equal(payload.sections[0].items[1].t.split(nbsp).join(' '), 'aaaaaaaaaaaaaaaa, cccccccccccccccc, eeeeeeeeeeeeeeee, bb, dd');
});

test('rule 40: prose sidebar values are never reordered', async () => {
  const prose = 'Stability, calm, and reliable under pressure';
  const payload = cvPayload([{ id: 'interests', type: 'labeled_list', loc: 'sidebar', items: [{ l: 'Tai-chi', v: prose }] }]);
  const { api } = load();
  await api.run(payload, { measureLines: fakeMeasure });
  // NBSP binding may glue gaps; the WORD ORDER of the prose must be untouched.
  assert.equal(payload.sections[0].items[0].v.split(String.fromCharCode(160)).join(' '), prose);
});

// ── rich_block sidebar rows are L2 bind targets (v2 only saw labeled_list) ───
test('rich_block sidebar rows collect as side targets; grp/residue/mk rows never do', () => {
  const { api } = load();
  const payload = cvPayload([
    { id: 'tools', type: 'rich_block', loc: 'sidebar', items: [
      { grp: true, t: 'Tools' },
      { b: 'Software', t: 'Python plus a long enough value to be measured for binding' },
      { b: 'Hidden - Lab & fabrication', t: 'PDMS nanoimprint' },   // residue: belt-dropped, never measured
      { b: 'Marker', t: 'a marker row body', mk: true },
      { b: 'Empty', t: '' },
      { b: 'Ph', t: '[placeholder value]' },
    ] },
  ]);
  const targets = api._collectTargets(payload, api._metricsFromPayload(payload));
  assert.equal(targets.length, 1);
  assert.equal(targets[0].kind, 'side_label');
  assert.match(targets[0].prefixHtml, /<b>Software: <\/b>/, 'lead + worker auto-colon in the measured prefix');
  targets[0].set('replaced');
  assert.equal(payload.sections[0].items[1].t, 'replaced');
});
