// jd-remove-tombstone.test.mjs
// ============================================================
// JD-REMOVE-STICKY-001 (owner 2026-07-13): pressing "✕ Remove" on the JD chip
// cleared only local React state — cloud-restore re-seeded the same jd_text on
// every refresh ("i refresh and it is added again"). The fix distinguishes the
// cases with a device-local tombstone:
//   - Remove writes antcv:jdRemoved = "<len>:<first-48-chars>" of the removed
//     jd and blanks antcv:lastJdText.
//   - cloud-restore (occ-1) skips JD-file seeding while the row's jd_text
//     matches the tombstone — UNLESS antcv:lastJdText equals that jd, which
//     only a tracker Open/Reopen stages right before its reload (deliberate
//     re-stage → tombstone cleared, seeding proceeds).
//   - the explicit "Read from Cloud" path (occ-2) always clears the tombstone
//     and seeds (a deliberate re-pull).
//   - a DIFFERENT jd never matches the tombstone, so uploads/other rows seed.
// The cloud row's jd_text is never touched — the job tracker still owns it.
//
// Locks (a) the clauses in BOTH bundles (app.src.js is the editable source,
// app.js the deployed minified mirror — memory appjs-appsrc-contribute-
// divergence), and (b) the tombstone predicate's actual behavior, executed
// from the MINIFIED bundle's own bytes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const min = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');

test('app.js: ✕ Remove writes the tombstone + blanks lastJdText before clearing state', () => {
  assert.match(min, /localStorage\.setItem\("antcv:jdRemoved",__rj\.length\+":"\+__rj\.slice\(0,48\)\),localStorage\.setItem\("antcv:lastJdText",""\)\}catch\(e\)\{\}try\{__rj&&so&&String\(so\.current\|\|""\)\.trim\(\)===__rj\.trim\(\)&&\(so\.current=null\);[^}]*\}catch\(e\)\{\}en\(null\),nn\(null\)/);
});

test('app.js: cloud-restore seeding is gated on the tombstone predicate', () => {
  assert.match(min, /var __jdTomb=function\(jt\)\{[^}]*antcv:jdRemoved[\s\S]{0,220}?\}\(e\.jd_text\);if\(!__jdTomb\)try\{var __jl=/);
  // the lastJdText mirror also blanks while tombstoned
  assert.ok(min.includes('localStorage.setItem("antcv:lastJdText",o||__antcvFd||r||a||__jdTomb?"":e.jd_text||"")'));
});

test('app.js: the explicit Read-from-Cloud path clears the tombstone and seeds', () => {
  assert.ok(min.includes('else{try{localStorage.removeItem("antcv:jdRemoved")}catch(e){}try{var __jl2=String('));
});

test('app.src.js: all three JD-REMOVE-STICKY-001 sites are mirrored in the source', () => {
  assert.ok(src.includes('localStorage.setItem("antcv:jdRemoved", __rj.length + ":" + __rj.slice(0, 48))'));
  assert.ok(src.includes('if (!__jdTomb) try {'));
  assert.ok(src.includes('(__isUnsolicited || __foreignDevice || t || n || __jdTomb) ?'));
  assert.match(src, /JD-REMOVE-STICKY-001: an EXPLICIT "Read from Cloud" click[\s\S]{0,200}removeItem\("antcv:jdRemoved"\)/);
});

// ── behavioral lock: run the predicate exactly as deployed ──────────────────

function tombFnFromBundle() {
  const m = min.match(/var __jdTomb=(function\(jt\)\{[\s\S]*?\})\(e\.jd_text\);/);
  assert.ok(m, 'tombstone predicate not found in app.js');
  const store = new Map();
  const slots = {};
  const win = { __antcvJdRestoredFor: '4242', AntcvJdScope: { getJd: (id) => slots[id] || '' } };
  const ctx = vm.createContext({
    window: win,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  });
  return { fn: vm.runInContext('(' + m[1] + ')', ctx), store, slots };
}

const JD = 'NVIDIA — Senior PM, hardware platforms. '.repeat(12);

test('predicate: no tombstone → seeds', () => {
  const { fn } = tombFnFromBundle();
  assert.equal(fn(JD), false);
});

test('predicate: tombstoned jd on a plain refresh → suppressed, tombstone kept', () => {
  const { fn, store } = tombFnFromBundle();
  store.set('antcv:jdRemoved', JD.length + ':' + JD.slice(0, 48));
  store.set('antcv:lastJdText', '');            // Remove blanked the mirror
  assert.equal(fn(JD), true);
  assert.equal(fn(JD), true, 'stays suppressed across repeated refreshes');
  assert.ok(store.has('antcv:jdRemoved'), 'tombstone survives a suppressed restore');
});

test('predicate: tracker Open staged lastJdText=jd → tombstone cleared, seeds', () => {
  const { fn, store } = tombFnFromBundle();
  store.set('antcv:jdRemoved', JD.length + ':' + JD.slice(0, 48));
  store.set('antcv:lastJdText', JD);            // prepareAndOpen stages this pre-reload
  assert.equal(fn(JD), false);
  assert.ok(!store.has('antcv:jdRemoved'), 'deliberate re-stage consumes the tombstone');
  assert.equal(fn(JD), false, 'subsequent refreshes seed normally');
});

test('predicate: a DIFFERENT jd never matches the tombstone → seeds', () => {
  const { fn, store } = tombFnFromBundle();
  store.set('antcv:jdRemoved', JD.length + ':' + JD.slice(0, 48));
  store.set('antcv:lastJdText', '');
  assert.equal(fn('Tech Mahindra — Delivery lead role, entirely different JD text body. '.repeat(10)), false);
});

// ── JD-REMOVE-STICKY-002 (2026-11-23) ───────────────────────────────────────

test('predicate: Open staged under the row\'s own slot (tab scope still kernel) → consumed, seeds', () => {
  const { fn, store, slots } = tombFnFromBundle();
  store.set('antcv:jdRemoved', JD.length + ':' + JD.slice(0, 48));
  store.set('antcv:lastJdText', '');            // kernel scope at restore time
  slots['4242'] = JD;                           // claimTabAppId + lastJdText before the reload
  assert.equal(fn(JD), false);
  assert.ok(!store.has('antcv:jdRemoved'));
});

test('predicate: another row\'s slot does not consume the tombstone', () => {
  const { fn, store, slots } = tombFnFromBundle();
  store.set('antcv:jdRemoved', JD.length + ':' + JD.slice(0, 48));
  slots['9999'] = JD;
  assert.equal(fn(JD), true);
});

test('both bundles: AUTO-COMMIT never PUTs a blank jd_text', () => {
  assert.ok(min.includes('return(/^GENERAL CV/i.test(t)||/^Manual save/i.test(t)?String(sn||"").trim():t)||void 0})()'));
  assert.ok(src.includes('return (/^GENERAL CV/i.test(t) || /^Manual save/i.test(t) ? String(Ut || "").trim() : t) || void 0;'));
});

test('both bundles: the boot list effect keeps the JD seeded for the row it activates', () => {
  assert.ok(min.includes('if(!(n&&window.__antcvJdRestoredFor&&String(n)===window.__antcvJdRestoredFor)){try{nn(null)}catch(e){}try{en(null)}catch(e){}try{cn("")}catch(e){}}'));
  assert.ok(src.includes('if (!(__chosenId && window.__antcvJdRestoredFor && String(__chosenId) === window.__antcvJdRestoredFor)) {'));
});

test('app.src.js: Remove drops the parked JD from the cloud-write fallback', () => {
  assert.ok(src.includes('if (__rj && Un && String(Un.current || "").trim() === __rj.trim()) Un.current = null;'));
});
