/* INTERESTS-ALIGN-STABLE-001 — the INTERESTS rich_block content alignment flipped LEFT<->JUSTIFY
 * because __hasGrp oscillated. The 763 sidecar now pins antcvItemAlignment.interests.__group__='left'
 * (honored by preview + worker before the __hasGrp default). Loads the REAL sidecar in a shim and
 * asserts the pin is stable regardless of grouped/ungrouped interests, idempotent, and override-safe. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-labeled-list-to-rich-block-763.js'), 'utf8');

function load(sections, preAlign) {
  const store = new Map();
  store.set('sections', JSON.stringify(sections));
  if (preAlign !== undefined) store.set('antcvItemAlignment', JSON.stringify(preAlign));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { addEventListener() {}, dispatchEvent() { return true; } };
  const CE = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'setTimeout', 'CustomEvent', SRC)(win, localStorage, () => 0, CE);
  win.AntcvLabeledListToRichBlock.run();
  const grp = () => { const a = JSON.parse(store.get('antcvItemAlignment') || '{}'); return a.interests && a.interests.__group__; };
  return { grp: grp(), rerun: () => { win.AntcvLabeledListToRichBlock.run(); return grp(); } };
}

const grouped = { cv: [{ id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'rich_block', items: [{ grp: true, t: 'Interests' }, { b: 'Rugby', t: 'coach' }] }], cl: [] };
const ungrouped = { cv: [{ id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'rich_block', items: [{ b: 'Rugby', t: 'coach' }, { b: 'Hiking', t: 'reset' }] }], cl: [] };

test('grouped interests -> __group__ pinned left', () => {
  assert.equal(load(grouped).grp, 'left');
});
test('ungrouped interests -> __group__ pinned left (same stable value)', () => {
  assert.equal(load(ungrouped).grp, 'left');
});
test('idempotent across re-runs', () => {
  const h = load(ungrouped);
  assert.equal(h.grp, 'left');
  assert.equal(h.rerun(), 'left');
});
test('owner override respected (already set to justify)', () => {
  assert.equal(load(ungrouped, { interests: { __group__: 'justify' } }).grp, 'justify');
});
test('no interests section -> nothing pinned', () => {
  const h = load({ cv: [{ id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'rich_block', items: [{ b: 'A', t: 'b' }] }], cl: [] });
  assert.equal(h.grp, undefined);
});
