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

test('app.src.js prefers AntcvClusterDemandLive.get() over classifyJD() for the cluster id and cluster data', () => {
  assert.match(appSrc, /const LIVE = window\.AntcvClusterDemandLive;/);
  assert.match(appSrc, /const live = LIVE && "function" == typeof LIVE\.get \? LIVE\.get\(\) : null;/);
  assert.match(appSrc, /const ci = \(live && live\.clusterId\) \|\| \(CD && "function" == typeof CD\.classifyJD \? CD\.classifyJD\(\) : null\);/);
  assert.match(appSrc, /const cl = \(live && live\.cluster\) \|\| \(ci && CD && CD\.clusters && CD\.clusters\[ci\]\);/);
});

test('app.js (minified) carries the equivalent live-preferring logic', () => {
  assert.match(appMin, /lv=window\.AntcvClusterDemandLive,ld=lv&&"function"==typeof lv\.get\?lv\.get\(\):null/);
  assert.match(appMin, /ci=ld&&ld\.clusterId\|\|\(CD&&"function"==typeof CD\.classifyJD\?CD\.classifyJD\(\):null\)/);
  assert.match(appMin, /cl=ld&&ld\.cluster\|\|ci&&CD&&CD\.clusters&&CD\.clusters\[ci\]/);
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
