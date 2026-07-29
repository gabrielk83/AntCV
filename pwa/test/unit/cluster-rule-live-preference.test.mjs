// cluster-rule-live-preference.test.mjs
// ============================================================
// CLUSTER-QUAL-001 stage 2b (section 3.4, owner 2026-07-05): __clusterRule
// (the "JD-CLUSTER DEMAND WEIGHTING" prompt-injection IIFE) previously read
// ONLY window.AntcvClusterDemand.classifyJD() + .clusters[ci] — the static
// 3-cluster analyst seed (antcv-cluster-demand.js, section 7.5). classifyJD()
// can only ever pick one of its OWN 3 hardcoded clusters, so injecting real
// D1 top-20 data for the other 9 categories into window.AntcvClusterDemand
// would never be selected. Fix: prefer window.AntcvClusterDemandLive.get()
// (antcv-cluster-demand-live.js, backed by the real GET /api/cluster-top20
// endpoint keyed on the application's actual category) and fall back to the
// existing classifyJD()+seed path unchanged when live data isn't cached yet.
//
// Source-level regression lock (both bundles carry equivalent minified/
// de-minified code, not directly executable in isolation without the whole
// app's closures — same pattern as jd-category-attach.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSrc = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const appMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

// FUSE (owner 2026-07-13, "fuse the deterministic and research list so nothing
// is lost"): __clusterRule now UNIONs the live D1 top-20 with the static SEED
// (not live-OR-seed) — live order leads, SEED-only items append, dedup by
// normalized text — so a qualification dropped from one list still surfaces from
// the other. All temp vars are IIFE-scoped (can't collide with the minified
// outer scope).
test('app.src.js still resolves the cluster id via live-then-classifyJD', () => {
  assert.match(appSrc, /const LIVE = window\.AntcvClusterDemandLive;/);
  assert.match(appSrc, /const live = LIVE && "function" == typeof LIVE\.get \? LIVE\.get\(\) : null;/);
  assert.match(appSrc, /const ci = \(live && live\.clusterId\) \|\| \(CD && "function" == typeof CD\.classifyJD \? CD\.classifyJD\(\) : null\);/);
});

test('app.src.js UNIONs the live D1 top-20 with the static SEED (fuse; dedup; widened slice)', () => {
  assert.match(appSrc, /const cl = \(\(\) => \{/);
  assert.match(appSrc, /const seen = new Set\(\), rows = \[\];/);
  assert.match(appSrc, /if \(!k \|\| seen\.has\(k\)\) return;/);         // dedup by normalized text
  assert.match(appSrc, /live\.cluster\.top20/);                          // source 1: live D1
  assert.match(appSrc, /CD\.clusters && CD\.clusters\[ci\]/);            // source 2: static SEED
  assert.match(appSrc, /cl\.top20\.slice\(0, 24\)/);                     // widened so appended SEED-only items survive
});

test('app.js (minified) carries the equivalent UNION logic', () => {
  assert.match(appMin, /lv=window\.AntcvClusterDemandLive,ld=lv&&"function"==typeof lv\.get\?lv\.get\(\):null/);
  assert.match(appMin, /ci=ld&&ld\.clusterId\|\|\(CD&&"function"==typeof CD\.classifyJD\?CD\.classifyJD\(\):null\)/);
  assert.match(appMin, /cl=\(\(\)=>\{const nm=/);
  assert.match(appMin, /if\(!k\|\|seen\.has\(k\)\)return/);
  assert.match(appMin, /ld\.cluster\.top20/);
  assert.match(appMin, /CD\.clusters\[ci\]/);
  assert.match(appMin, /cl\.top20\.slice\(0,24\)/);
});

test('both bundles foreground SHARED (cross-cluster) qualifications in the injected prompt text (section 3.4 requirement)', () => {
  assert.match(appSrc, /Qualifications flagged SHARED below are demanded across MULTIPLE clusters/);
  assert.match(appMin, /Qualifications flagged SHARED below are demanded across MULTIPLE clusters/);
});

test('the ORDERING-JD-CLUSTER-001 rule text and "never adds a skill" guarantee are unchanged in both bundles', () => {
  assert.match(appSrc, /JD-CLUSTER DEMAND WEIGHTING \(ORDERING-JD-CLUSTER-001\)/);
  assert.match(appSrc, /it NEVER adds a skill the candidate does not have\./);
  assert.match(appMin, /JD-CLUSTER DEMAND WEIGHTING \(ORDERING-JD-CLUSTER-001\)/);
  assert.match(appMin, /it NEVER adds a skill the candidate does not have\./);
});

test('there is exactly one __clusterRule-equivalent definition per bundle (no accidental duplicate)', () => {
  assert.equal((appSrc.match(/const __clusterRule = \(\(\) => \{/g) || []).length, 1);
  assert.equal((appMin.match(/__cr=\(\(\)=>\{/g) || []).length, 1);
});

// Executable lock: pull the ACTUAL shipped union IIFE out of app.src.js and run
// it against mock inputs, so the "fuse / nothing is lost" behaviour is verified,
// not just its presence.
function fuseFn() {
  const start = appSrc.indexOf('const cl = (() => {');
  assert.ok(start > 0, 'union IIFE must exist');
  const end = appSrc.indexOf('})();', start) + '})();'.length;
  assert.ok(end > start, 'union IIFE close not found');
  const body = appSrc.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function('live', 'ci', 'CD', body + '\nreturn cl;');
}

test('UNION behaviour: live leads, SEED-only quals append (nothing lost), dedup by normalized text', () => {
  const fuse = fuseFn();
  const CD = { clusters: { pm_process: { label: 'PM', top20: [[1, 'Project management', 'none'], [2, 'Stakeholder mgmt', 'ABC'], [3, 'Obsolescence management', 'AB']] } } };
  const live = { clusterId: 'pm_process', cluster: { label: 'PM live', top20: [{ q: 'AI GenAI fluency', shared: ['executive'] }, { q: 'Project Management', shared: [] }] } };
  const cl = fuse(live, 'pm_process', CD);
  const qs = cl.top20.map((r) => r.q);
  assert.equal(qs[0], 'AI GenAI fluency', 'live order leads');
  assert.ok(qs.some((q) => /obsolescence/i.test(q)), 'a SEED-only qual dropped from live is retained (nothing lost)');
  assert.equal(qs.filter((q) => /^project manage/i.test(q)).length, 1, 'live "Project Management" and seed "Project management" dedup to one');
  assert.ok(cl.top20.some((r) => r.shared.length), 'shared flags survive for the SHARED note');
});

test('UNION degrades: live-only when no SEED, SEED-only when no live, null when neither', () => {
  const fuse = fuseFn();
  const CD = { clusters: { pm_process: { label: 'PM', top20: [[1, 'Seed skill', 'none']] } } };
  assert.deepEqual(fuse({ clusterId: 'x', cluster: { top20: [{ q: 'Live skill', shared: [] }] } }, null, { clusters: {} }).top20.map((r) => r.q), ['Live skill']);
  assert.deepEqual(fuse(null, 'pm_process', CD).top20.map((r) => r.q), ['Seed skill']);
  assert.equal(fuse(null, null, { clusters: {} }), null);
});
