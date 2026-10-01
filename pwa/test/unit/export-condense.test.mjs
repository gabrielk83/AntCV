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
