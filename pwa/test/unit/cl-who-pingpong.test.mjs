/* CL-WHO-PINGPONG-001 (owner 2026-09-30 "the preview is jumping between two table formats").
 * antcv-nordic-cl-order-971 foundationKeep folded a foundation "Hands-on" row into the letter's who
 * block although who already held a real "Hands-on" row; antcv-rich-block-shape-fix dedupeLabels
 * (one row per label, the longest wins) removed it again -> both rewrote sections ~40x/s and the
 * preview re-rendered without end. A same-label real who row now counts as present. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NORDIC = readFileSync(path.join(dir, 'antcv-nordic-cl-order-971.js'), 'utf8');
const SHAPE = readFileSync(path.join(dir, 'antcv-rich-block-shape-fix.js'), 'utf8');

function load(src, key, sections) {
  const store = new Map([['sections', JSON.stringify(sections)]]);
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const win = { addEventListener() {}, dispatchEvent() { return true; } };
  const CE = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  const doc = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], body: null, readyState: 'complete' };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'setTimeout', 'CustomEvent', 'document', 'console', src)(win, localStorage, () => 0, CE, doc, { info() {}, warn() {}, log() {} });
  return { api: win[key], store };
}

const WHO = { id: 'who', type: 'rich_block', loc: 'main', items: [
  { b: 'Who I am', t: '', bullets: [] },
  { b: 'Professional summary', t: '[Identity tied to the role: years, disciplines.]' },
  { b: 'Hands-on', t: 'across the full hardware product path: requirements and ALM/Codebeamer tooling, FMEA and validation setups, RFQ/RFI and supplier scoring, and the change-control and traceability that move deep-tech products from concept to production - in more words.', mk: true, fnd: true },
  { b: 'My goal', t: '[The contribution the candidate wants to make in this role - never unilateral control.]', mk: true, bullets: [] },
] };
const FOUNDATION = { id: 'foundation', type: 'rich_block', loc: 'main', on: false, items: [
  { b: 'Hands-on', t: 'across the full hardware product path: requirements and ALM/Codebeamer tooling, FMEA and validation setups.' },
  { b: 'Professionally', t: 'that grounding lets me argue a product case before the spec.' },
] };

test('a real who row with the same label blocks the fold; a new label still folds in', () => {
  const { api } = load(NORDIC, 'AntcvNordicClOrder', { cv: [], cl: [] });
  const r = api.foundationKeep([WHO, FOUNDATION]);
  const who = r.list.find((s) => s.id === 'who');
  assert.equal(who.items.filter((x) => /^hands-on$/i.test(x.b)).length, 1, 'no second Hands-on row');
  assert.ok(who.items.some((x) => x.b === 'Professionally' && x.fnd), 'a label who lacks is still folded in');
});

test('fold result is stable under dedupeLabels: shape-fix finds nothing to change -> no storm', () => {
  const { api } = load(NORDIC, 'AntcvNordicClOrder', { cv: [], cl: [] });
  const folded = api.foundationKeep([WHO, FOUNDATION]).list;
  const sh = load(SHAPE, 'AntcvRichBlockShapeFix', { cv: [], cl: folded });
  const before = sh.store.get('sections');
  sh.api.run();
  const whoAfter = JSON.parse(sh.store.get('sections')).cl.find((s) => s.id === 'who');
  const whoBefore = JSON.parse(before).cl.find((s) => s.id === 'who');
  assert.deepEqual(whoAfter.items.map((x) => x.b), whoBefore.items.map((x) => x.b), 'dedupe removes no row');
  // and the next nordic pass adds nothing back
  const again = api.foundationKeep(JSON.parse(sh.store.get('sections')).cl.map((s) => (s.id === 'foundation' ? { ...s, on: false } : s)));
  assert.equal(again.changed, false, 'second pass is a no-op');
});
