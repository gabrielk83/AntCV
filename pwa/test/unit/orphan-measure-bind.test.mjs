// orphan-measure-bind.test.mjs
// ============================================================
// ORPHAN-MEASURE-BIND-001: deterministic helpers of the L1+L2 orphan sidecar.
// The DOM measurement (Range.getClientRects / clone) needs a real browser and is
// verified on a live export; here we test the pure binding + write-back logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-orphan-measure-bind.js', import.meta.url), 'utf8');
const NBSP = String.fromCharCode(160);

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const doc = { querySelectorAll() { return []; }, querySelector() { return null; }, createRange() { return { selectNodeContents() {}, getClientRects() { return []; } }; } };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    document: doc,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; }, clearTimeout() {},
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, parseInt, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvOrphanBind, store, sandboxWindow: sandbox.window, doc };
}

test('_bindLast binds the last N single-space gaps with NBSP', () => {
  const { api } = load();
  assert.equal(api._bindLast('one two three four', 1), 'one two three' + NBSP + 'four');
  assert.equal(api._bindLast('one two three four', 2), 'one two' + NBSP + 'three' + NBSP + 'four');
  assert.equal(api._bindLast('single', 2), 'single');       // no gaps to bind
});

test('_bindLast preserves trailing whitespace', () => {
  const { api } = load();
  assert.equal(api._spaceCount('a b c'), 2);
  assert.equal(api._bindLast('a b c ', 5), 'a' + NBSP + 'b' + NBSP + 'c ');
});

test('_isRunt: a last line far shorter than the widest is a runt', () => {
  const { api } = load();
  assert.equal(api._isRunt([480, 480, 60]), true);
  assert.equal(api._isRunt([480, 480, 300]), false);
  assert.equal(api._isRunt([480]), false);                  // single line, no orphan
  assert.equal(api._isRunt([]), false);
});

test('_alreadyBound detects an existing NBSP (idempotency guard)', () => {
  const { api } = load();
  assert.equal(api._alreadyBound('a' + NBSP + 'b'), true);
  assert.equal(api._alreadyBound('a b c'), false);
});

test('_bindBulletInSections binds a stored bullet by path and persists', () => {
  const sections = { cv: [{ id: 'experience', roles: [{ bullets: ['first bullet', 'owned the whole governance loop end to end'] }] }], cl: [] };
  const { api, store } = load({ sections: JSON.stringify(sections) });
  const ok = api._bindBulletInSections('experience', ['roles', '0', 'bullets', '1'], 2);
  assert.equal(ok, true);
  const bul = JSON.parse(store.get('sections')).cv[0].roles[0].bullets[1];
  assert.ok(bul.indexOf(NBSP) !== -1);
  assert.ok(bul.endsWith('to' + NBSP + 'end'), bul);
});

test('_bindBulletInSections is idempotent when already bound', () => {
  const sections = { cv: [{ id: 'experience', roles: [{ bullets: ['loop end to' + NBSP + 'end'] }] }], cl: [] };
  const { api } = load({ sections: JSON.stringify(sections) });
  assert.equal(api._bindBulletInSections('experience', ['roles', '0', 'bullets', '0'], 2), false);
});

test('_bindBulletInSections returns false for a missing path', () => {
  const sections = { cv: [{ id: 'experience', roles: [] }], cl: [] };
  const { api } = load({ sections: JSON.stringify(sections) });
  assert.equal(api._bindBulletInSections('experience', ['roles', '5', 'bullets', '0'], 2), false);
});

test('_bindResultsOverride writes the bound text into the override map', () => {
  const { api, store } = load({});
  assert.equal(api._bindResultsOverride('r|Eng|Acme|0', 'shipped the thing on time', 2), true);
  const map = JSON.parse(store.get('antcv:resultsOverride'));
  assert.ok(map['r|Eng|Acme|0'].endsWith('on' + NBSP + 'time'), map['r|Eng|Acme|0']);
});

// ── L3: escalate unfixable residue to the existing "Fix Orphans" button ──────────
// L3 clicks the REAL DOM button (no app.js edits — an earlier CustomEvent-bridge attempt
// there corrupted the file's giant comma-expression and was reverted) rather than
// reimplementing LLM routing. These tests verify the click/dedup/cooldown/kill-switch
// logic using a fake button; the real click target is verified live.
const BTN_TITLE = 'Run orphan-cleanup across both sidebar and main columns. Drops abandoned bullets, empty groups, and broken references.';
function fakeButton(disabled) {
  let clicks = 0;
  return { disabled: !!disabled, click() { clicks++; }, get clicks() { return clicks; } };
}

test('_maybeEscalateToL3 clicks the Fix Orphans button for fresh residue', () => {
  const { api, doc } = load({});
  const btn = fakeButton(false);
  doc.querySelector = (sel) => (sel.indexOf(BTN_TITLE.slice(0, 20)) >= 0 ? btn : null);
  api._maybeEscalateToL3([{ key: 'bullet|roles.0.bullets.1', sig: api._hash('some orphan text') }]);
  assert.equal(btn.clicks, 1);
});

test('_maybeEscalateToL3 does nothing when no button is mounted', () => {
  const { api, doc } = load({});
  doc.querySelector = () => null;
  // should not throw even though there is no button to click
  api._maybeEscalateToL3([{ key: 'bullet|x', sig: 1 }]);
});

test('_maybeEscalateToL3 does not click a disabled button', () => {
  const { api, doc } = load({});
  const btn = fakeButton(true);
  doc.querySelector = () => btn;
  api._maybeEscalateToL3([{ key: 'bullet|x', sig: 1 }]);
  assert.equal(btn.clicks, 0);
});

test('_maybeEscalateToL3 dedups: the SAME residue signature is not re-escalated', () => {
  const { api, doc, sandboxWindow } = load({});
  const btn = fakeButton(false);
  doc.querySelector = () => btn;
  const residue = [{ key: 'results|r|Eng|Acme|0', sig: api._hash('same runt text') }];
  api._maybeEscalateToL3(residue);
  assert.equal(btn.clicks, 1);
  sandboxWindow.__antcvOrphanL3LastFire = 0;   // bypass the cooldown to isolate the dedup check
  api._maybeEscalateToL3(residue);             // identical key+sig -> already attempted
  assert.equal(btn.clicks, 1);
});

test('_maybeEscalateToL3 does NOT dedup a residue whose text changed (new signature)', () => {
  const { api, doc, sandboxWindow } = load({});
  const btn = fakeButton(false);
  doc.querySelector = () => btn;
  api._maybeEscalateToL3([{ key: 'bullet|roles.0.bullets.1', sig: api._hash('first version') }]);
  assert.equal(btn.clicks, 1);
  sandboxWindow.__antcvOrphanL3LastFire = 0;
  api._maybeEscalateToL3([{ key: 'bullet|roles.0.bullets.1', sig: api._hash('edited version') }]);
  assert.equal(btn.clicks, 2);
});

test('_maybeEscalateToL3 respects the cooldown between fires', () => {
  const { api, doc } = load({});
  const btn = fakeButton(false);
  doc.querySelector = () => btn;
  api._maybeEscalateToL3([{ key: 'bullet|a', sig: 1 }]);
  api._maybeEscalateToL3([{ key: 'bullet|b', sig: 2 }]);   // different residue, but within cooldown
  assert.equal(btn.clicks, 1);
});

test('_maybeEscalateToL3 kill-switch: antcv:disable-orphan-l3 blocks escalation', () => {
  const { api, doc } = load({ 'antcv:disable-orphan-l3': '1' });
  const btn = fakeButton(false);
  doc.querySelector = () => btn;
  api._maybeEscalateToL3([{ key: 'bullet|x', sig: 1 }]);
  assert.equal(btn.clicks, 0);
});

test('_maybeEscalateToL3 persists the attempted signature to localStorage', () => {
  const { api, doc, store } = load({});
  doc.querySelector = () => fakeButton(false);
  api._maybeEscalateToL3([{ key: 'results|r|A|B|0', sig: 42 }]);
  const attempted = JSON.parse(store.get('antcv:orphanL3Attempted'));
  assert.equal(attempted['results|r|A|B|0'], 42);
});

test('_suppressNoOrphansAlert swallows only its own known-benign message', () => {
  const { api, sandboxWindow } = load({});
  const seen = [];
  sandboxWindow.alert = (msg) => seen.push(msg);
  api._suppressNoOrphansAlert(90000);
  sandboxWindow.alert('No orphan lines detected.');
  sandboxWindow.alert('Some unrelated important message');
  assert.deepEqual(seen, ['Some unrelated important message']);
});
