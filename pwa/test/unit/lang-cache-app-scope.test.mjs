// lang-cache-app-scope.test.mjs
// ============================================================
// LANG-CACHE-APP-SCOPE-001 (owner 2026-11-05, found by the top session on #3525 / #3491):
// the languageCache was keyed by language only, so "Use cached EN" on one application applied
// another application's snapshot META (company, role, subtitle). Every snapshot now carries the
// per-tab application id and the offer refuses a foreign entry. The two application-switch
// twins scope the JD keys to the NEW app before the company stamp (the [Fl] effect only runs
// after render, so the stamp and the JD mirror landed in the previous app's namespace).
// Source + minified-mirror parity, in the style of gen-company-missing-retry.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lf = (s) => s.replace(/\r\n/g, '\n');   // CRLF tree
const src = lf(await readFile(new URL('../../app.src.js', import.meta.url), 'utf8'));
const min = lf(await readFile(new URL('../../app.js', import.meta.url), 'utf8'));
const count = (s, needle) => s.split(needle).length - 1;

test('both bundles define __antcvCacheApp from the per-tab jd-scope id (kernel before an app exists)', () => {
  assert.equal(count(src, 'function __antcvCacheApp()'), 1);
  assert.equal(count(min, 'function __antcvCacheApp()'), 1);
  assert.match(src, /__antcvCacheApp\(\) \{\s*try \{ return String\(\(window\.AntcvJdScope && window\.AntcvJdScope\.getCurrentAppId && window\.AntcvJdScope\.getCurrentAppId\(\)\) \|\| "kernel"\)/);
});

test('every languageCache snapshot carries the application id (switch snapshot + post-translate snapshot)', () => {
  assert.equal(count(src, 'standalone: __antcvSnapStandalone(),\n                app: __antcvCacheApp(),'), 2, 'source: both snapshots');
  assert.equal(count(min, 'standalone:__antcvSnapStandalone(),app:__antcvCacheApp()}'), 2, 'mirror: both snapshots');
});

test('the "Use cached" offer refuses an entry from another application', () => {
  assert.equal(count(src, 'if (String(c.app || "") !== __antcvCacheApp()) {'), 1);
  assert.equal(count(min, 'if(String(c.app||"")!==__antcvCacheApp()){'), 1);
  assert.ok(min.includes('[LANG-CACHE-APP-SCOPE-001] cached "+e+" belongs to application'), 'mirror logs the refused entry');
  // the refused entry leaves `a` undefined, so the dialog falls through to "Translate now"
  assert.ok(min.includes('return c})(),i=()=>{'), 'offer IIFE feeds the same `a` the dialog reads');
});

test('both application-switch twins scope the JD keys to the new app before the company stamp', () => {
  const needleMin = 'try{window.AntcvJdScope&&window.AntcvJdScope.setCurrentAppId(String(e.id))}catch(_){}localStorage.setItem("antcv:activeAppCompany",String(n.jd_company||""))}catch(e){}})(),await vo.setActive(e.id),ts(e.id)';
  assert.equal(count(min, needleMin), 2, 'mirror: settings history twin + topbar twin');
  const re = /try \{ window\.AntcvJdScope && window\.AntcvJdScope\.setCurrentAppId\(String\(e\.id\)\); \} catch \(_\) \{\}\n\s*localStorage\.setItem\(\n\s*"antcv:activeAppCompany",\n\s*String\(n\.jd_company \|\| ""\),/g;
  assert.equal((src.match(re) || []).length, 2, 'source: the scope call sits right before the stamp at both twins');
});
