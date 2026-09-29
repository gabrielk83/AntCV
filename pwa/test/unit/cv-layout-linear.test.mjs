// cv-layout-linear.test.mjs
// ============================================================
// EXEC-LINEAR step 5a client half (1.51.4607): the "CV layout" control stores
// localStorage['antcv:cvLayout'] = 'linear' | absent; a CV export then asks the worker for
// layout 'linear' (buildLinearCvDocument). Letters stay linear; an explicit layout still wins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};
const { buildPayload, readCvLayout } = await import('../../antcv-docx-client.js');
const cv = () => buildPayload({ doc: 'cv', personalInfo: { name: 'X' }, meta: {}, sections: { cv: [] }, styleConfig: {} });

test('default CV export stays two_column', () => {
  store.delete('antcv:cvLayout');
  assert.equal(readCvLayout(), 'two_column');
  assert.equal(cv().layout, 'two_column');
});

test('antcv:cvLayout=linear -> CV export asks for linear; letters unaffected; explicit layout wins', () => {
  store.set('antcv:cvLayout', 'linear');
  assert.equal(cv().layout, 'linear');
  assert.equal(buildPayload({ doc: 'cl', personalInfo: { name: 'X' }, meta: {}, sections: { cl: [] } }).layout, 'linear');
  assert.equal(buildPayload({ doc: 'cv', layout: 'two_column', personalInfo: { name: 'X' }, meta: {}, sections: { cv: [] } }).layout, 'two_column');
  store.set('antcv:cvLayout', 'bogus');
  assert.equal(cv().layout, 'two_column', 'unknown values fall back');
  store.delete('antcv:cvLayout');
});

test('the PAGE FLOW control offers the CV layout choice on its own key', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-role-line-format.js'), 'utf8');
  assert.ok(src.includes("var LKEY = 'antcv:cvLayout';"));
  assert.ok(src.includes("['linear', 'Linear (export only)']"));
});
