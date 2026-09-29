// width-target-hints.test.mjs
// ============================================================
// WIDTH-TARGET-HINTS-001 (GOLD-TARGET-LAYOUT-DENSITY-001, 1.51.375):
// antcv-bullet-targets.js SHIP 3 appends a WIDTH CALIBRATION block —
// chars-per-line measured from the LIVE column geometry — to every
// enrich prompt carrying DIMENSION-AWARE BULLET LENGTH and every
// Fit-it/compress prompt, overriding the hardcoded "Calibri 10.5pt
// ≈ 64-68 chars" figures that go stale whenever the sidebar ratio,
// indents, or body font differ.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-bullet-targets.js', import.meta.url), 'utf8');

function load(store = new Map()) {
  const canvasCtx = {
    // deterministic fake metrics: every char 6px wide at any font
    measureText: (s) => ({ width: s.length * 6 }),
    set font(v) { this._font = v; },
    get font() { return this._font; },
  };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    document: {
      readyState: 'complete',
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      createElement: (tag) => tag === 'canvas'
        ? { getContext: () => canvasCtx }
        : { style: {}, setAttribute() {}, appendChild() {}, textContent: '' },
      getElementById: () => null,
      head: { appendChild() {} }, body: null, documentElement: {},
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { info() {}, warn() {}, log() {}, error() {}, debug() {} },
    setTimeout(f) { return 0; }, clearTimeout() {},
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    TextEncoder: function () { this.encode = (s) => ({ length: s.length }); },
    fetch: () => Promise.resolve({}),
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
    isFinite, parseInt, parseFloat, Date, Infinity, NaN, Promise,
  };
  sandbox.window.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.AntcvBulletTargets;
}

const ENRICH_SYS = 'You are a senior CV editor. Enrich the bullets…\n' +
  'DIMENSION-AWARE BULLET LENGTH: bullets render in main column at Calibri 10.5pt ≈ 64-68 chars per line.';
const COMPRESS_USER = 'Compress this CV/cover letter section by approximately 15% in UK English. Keep every number.';

test('cpl is measured from live geometry, not hardcoded', () => {
  const store = new Map([
    ['cvSidebarRatio', '0.36'],
    ['styleConfig', JSON.stringify({ mainBodyFont: 'Calibri', mainEdgeIndent: 14, bulletIndent: 20, seamGap: 6 })],
  ]);
  const api = load(store);
  const cpl = api._measureCharsPerLine();
  // fake canvas: 6px/char. cellW = (11906 − 4286 − 420 − 90)/15 = 474px; bullet 454px → 76 cpl
  assert.equal(cpl, 76);
  // widening the sidebar shrinks the line
  store.set('cvSidebarRatio', '0.45');
  const cpl2 = api._measureCharsPerLine();
  assert.equal(cpl2 < cpl, true, 'wider sidebar → fewer chars per line');
});

test('enrich prompts (system message) get the WIDTH CALIBRATION override', () => {
  const api = load(new Map([['cvSidebarRatio', '0.36'], ['styleConfig', '{}']]));
  const body = JSON.stringify({ messages: [{ role: 'system', content: ENRICH_SYS }, { role: 'user', content: 'x' }] });
  const out = api._maybeInjectWidthHint(body);
  assert.equal(typeof out, 'string');
  const parsed = JSON.parse(out);
  const sys = parsed.messages[0].content;
  assert.equal(sys.includes('WIDTH CALIBRATION'), true);
  assert.equal(sys.includes('OVERRIDE any chars-per-line figures above'), true);
  assert.match(sys, /1-LINE = \d+-\d+ chars/);
  assert.match(sys, /FORBIDDEN dead zones/);
});

test('anthropic-style top-level system string is handled', () => {
  const api = load(new Map());
  const body = JSON.stringify({ system: ENRICH_SYS, messages: [{ role: 'user', content: 'x' }] });
  const out = api._maybeInjectWidthHint(body);
  assert.equal(JSON.parse(out).system.includes('WIDTH CALIBRATION'), true);
});

test('Fit-it/compress prompts with no system carrier get the block on the marked user turn', () => {
  const api = load(new Map());
  const body = JSON.stringify({ messages: [{ role: 'user', content: COMPRESS_USER }] });
  const out = api._maybeInjectWidthHint(body);
  assert.equal(JSON.parse(out).messages[0].content.includes('WIDTH CALIBRATION'), true);
});

test('GEN-WIDTH-CALIBRATION-001: every generation prompt (COMPRESSION-TIGHT carrier) gets calibrated', () => {
  const api = load(new Map());
  const genSys = 'You are AntCV… COMPRESSION — WRITE TIGHT (owner 2026-06-30): every CV experience bullet…';
  const out = api._maybeInjectWidthHint(JSON.stringify({ system: genSys, messages: [{ role: 'user', content: 'JD…' }] }));
  assert.equal(JSON.parse(out).system.includes('WIDTH CALIBRATION'), true);
});

test('idempotent + inert on unrelated traffic', () => {
  const api = load(new Map());
  const body = JSON.stringify({ system: ENRICH_SYS, messages: [] });
  const once = api._maybeInjectWidthHint(body);
  assert.equal(api._maybeInjectWidthHint(once), null, 'already-calibrated body untouched');
  assert.equal(api._maybeInjectWidthHint(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })), null);
  assert.equal(api._maybeInjectWidthHint('not json {'), null);
});

test('wiring composes: SHIP 3 width, SHIP 4 windows, SHIP 2 locks', () => {
  assert.equal(src.includes('const widthMod = maybeInjectWidthHint(bodyText);'), true);
  assert.equal(src.includes('maybeInjectBulletWindows(widthMod || bodyText) || widthMod'), true);
  assert.equal(src.includes('maybeInjectIntoBody(winMod || bodyText) || winMod'), true);
});

// ── SHIP 4: per-bullet measured windows ─────────────────────────────

const ENRICH_ROLE_SYS = 'You are a senior CV editor. Enrich the bullets…"experience_role"…roleId":"r1"…\n' +
  'DIMENSION-AWARE BULLET LENGTH: bullets render in main column at Calibri 10.5pt ≈ 64-68 chars per line.';

function storeWithRole(bullets) {
  return new Map([
    ['cvSidebarRatio', '0.36'],
    ['styleConfig', '{}'],
    ['cv_pwa_sections', JSON.stringify({ cv: [{ id: 'experience', roles: [{ id: 'r1', bullets }] }] })],
  ]);
}

test('SHIP 4: a short-last-line bullet gets an absolute char window; full bullets are exempt', () => {
  // fake metrics: 6px/char, bullet width = 454px -> 10 six-char words per
  // line. 13 words (90 chars) wrap to 2 lines with a 3-word ~26% runt line;
  // 10 words (69 chars) fill one line to ~91%.
  const word = 'abcdef';
  const runt = Array(13).fill(word).join(' ');   // 90 chars, dangling 3-word tail
  const full = Array(10).fill(word).join(' ');   // 69 chars, one full line
  const api = load(storeWithRole([runt, full]));
  const body = JSON.stringify({ messages: [{ role: 'system', content: ENRICH_ROLE_SYS }, { role: 'user', content: 'x' }] });
  const out = api._maybeInjectBulletWindows(body);
  assert.equal(typeof out, 'string');
  const sys = JSON.parse(out).messages[0].content;
  assert.equal(sys.includes('PER-BULLET MEASURED WINDOWS'), true);
  assert.match(sys, /Bullet 1 \(now 90 chars, last line \d+% full\)/);
  assert.equal(sys.includes('Bullet 2'), false, 'well-fitted bullet not listed');
});

test('SHIP 4: fast speed level skips the measured windows (owner: lower quality, faster)', () => {
  const runt = 'x'.repeat(70) + ' ' + 'y'.repeat(19);
  const store = storeWithRole([runt]);
  store.set('antcv:genSpeed', 'fast');
  const api = load(store);
  const body = JSON.stringify({ messages: [{ role: 'system', content: ENRICH_ROLE_SYS }] });
  assert.equal(api._maybeInjectBulletWindows(body), null);
});

test('SHIP 4: idempotent and inert without a role match', () => {
  const api = load(storeWithRole(['x'.repeat(70) + ' tail']));
  const noRole = JSON.stringify({ messages: [{ role: 'system', content: 'DIMENSION-AWARE BULLET LENGTH only, no role marker' }] });
  assert.equal(api._maybeInjectBulletWindows(noRole), null);
});

// LINEAR-LENGTH-BUDGET-001 (owner 2026-09-29): antcv:cvLayout = 'linear' measures the single-column
// export (A4, 1 cm sides = 10772 DXA, 360 DXA bullet indent, 10 pt) - not the two-column main column.
test('linear layout: full-width chars per line, prompt names the layout, back to two-column on switch', () => {
  const store = new Map([
    ['cvSidebarRatio', '0.36'],
    ['styleConfig', JSON.stringify({ mainBodyFont: 'Calibri', mainEdgeIndent: 14, bulletIndent: 20, seamGap: 6 })],
  ]);
  const api = load(store);
  assert.equal(api._measureCharsPerLine(), 76, 'two-column baseline');
  store.set('antcv:cvLayout', 'linear');
  // fake canvas 6px/char: (10772 - 360) / 15 = 694.1px -> 116 cpl, independent of the sidebar ratio
  assert.equal(api._measureCharsPerLine(), 116);
  store.set('cvSidebarRatio', '0.45');
  assert.equal(api._measureCharsPerLine(), 116, 'sidebar ratio has no effect in linear');
  const body = JSON.stringify({ messages: [{ role: 'system', content: ENRICH_SYS }, { role: 'user', content: 'x' }] });
  const sys = JSON.parse(api._maybeInjectWidthHint(body)).messages[0].content;
  assert.match(sys, /one full rendered line here = 116 chars/);
  assert.match(sys, /LINEAR single-column layout/);
  store.delete('antcv:cvLayout');
  store.set('cvSidebarRatio', '0.36');
  assert.equal(api._measureCharsPerLine(), 76, 'two-column restored');
});

// LINEAR-TABLES-001 (owner 2026-09-30): linear adds tile / tool-tile / details-row budgets after the gold block.
test('linear layout: table budgets follow the linear export cells; two-column prompt has none', () => {
  const store = new Map([['cvSidebarRatio', '0.36'], ['styleConfig', '{}']]);
  const api = load(store);
  const body = JSON.stringify({ messages: [{ role: 'system', content: ENRICH_SYS }, { role: 'user', content: 'x' }] });
  const two = JSON.parse(api._maybeInjectWidthHint(body)).messages[0].content;
  assert.doesNotMatch(two, /LINEAR TABLES/);
  store.set('antcv:cvLayout', 'linear');
  const lin = JSON.parse(api._maybeInjectWidthHint(body)).messages[0].content;
  // fake canvas 6px/char: tile (3590-240)/15 = 223.3px -> 37; tool (5386-180)/15 -> 58; detail (10772-2080)/15 -> 97
  assert.match(lin, /3 per row, ~37 chars per line: exactly 3 rows \(or 6/);
  assert.match(lin, /2 per row: a short label \(at most 26 chars\) and a value of 1-2 lines at ~58 chars per line/);
  assert.match(lin, /label \| content ROWS, ~97 chars per content line/);
  assert.ok(lin.indexOf('LINEAR TABLES') > lin.indexOf('GOLD CONTENT RULES'), 'after the gold block so it overrides its row count');
});
