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
  const needleMin = 'try{window.AntcvJdScope&&window.AntcvJdScope.setCurrentAppId(String(e.id))}catch(_){}try{window.__antcvLoadJd&&window.__antcvLoadJd(n.jd_text,n.jd_company,n.jd_role)}catch(_){}localStorage.setItem("antcv:activeAppCompany",String(n.jd_company||""))}catch(e){}})(),await vo.setActive(e.id),ts(e.id)';
  assert.equal(count(min, needleMin), 2, 'mirror: settings history twin + topbar twin');
  const re = /try \{ window\.AntcvJdScope && window\.AntcvJdScope\.setCurrentAppId\(String\(e\.id\)\); \} catch \(_\) \{\}\n\s*\/\/ LANG-CACHE-APP-SCOPE-001b[^\n]*\n\s*try \{ window\.__antcvLoadJd && window\.__antcvLoadJd\(n\.jd_text, n\.jd_company, n\.jd_role\); \} catch \(_\) \{\}\n\s*localStorage\.setItem\(\n\s*"antcv:activeAppCompany",\n\s*String\(n\.jd_company \|\| ""\),/g;
  assert.equal((src.match(re) || []).length, 2, 'source: the scope call sits right before the stamp at both twins');
});

test('LANG-CACHE-APP-SCOPE-001b: the switch twins load the record\'s JD into the editor state through the bridge', () => {
  assert.equal(count(src, 'window.__antcvLoadJd = (jd, co, ro) => {'), 1, 'source: bridge defined once (editor component)');
  assert.equal(count(min, 'window.__antcvLoadJd=(jd,co,ro)=>{'), 1, 'mirror: bridge defined once');
  assert.equal(count(min, 'try{window.__antcvLoadJd&&window.__antcvLoadJd(n.jd_text,n.jd_company,n.jd_role)}catch(_){}'), 2, 'mirror: both twins call it');
  assert.equal(count(src, 'try { window.__antcvLoadJd && window.__antcvLoadJd(n.jd_text, n.jd_company, n.jd_role); } catch (_) {}'), 2, 'source: both twins call it');
  // a real JD lands in the JD state + the scoped lastJdText; an unsolicited / manual-save record clears it
  assert.ok(min.includes('localStorage.setItem("antcv:lastJdText",real?jd:"")'), 'mirror: scoped lastJdText follows the record');
  assert.ok(/GENERAL CV \[—–-\] UNSOLICITED APPLICATION CONTEXT/.test(min.slice(min.indexOf('window.__antcvLoadJd='), min.indexOf('window.__antcvLoadJd=') + 700)), 'mirror: unsolicited stub is not a real JD');
});

test('LANG-CACHE-APP-SCOPE-001c: every cache write keeps only this application\'s tagged entries', () => {
  assert.equal(count(src, 'function __antcvCacheOwn(c) {'), 1);
  assert.equal(count(min, 'function __antcvCacheOwn(c){'), 1);
  // untagged (pre-001) entries fail the === test exactly like a foreign application's
  assert.ok(min.includes('c[k]&&String(c[k].app||"")===me?o[k]=c[k]:d.push(k)'), 'mirror: foreign + untagged entries dropped');
  assert.ok(min.includes('r={...__antcvCacheOwn(Gr),[Be]:{'), 'mirror: switch snapshot');
  assert.ok(min.includes('const n=__antcvCacheOwn(t);delete n[e];return L.set("languageCache",n),n}const n={...__antcvCacheOwn(t),[e]:{sections:'), 'mirror: mixed-drop + post-translate snapshot');
  assert.equal(count(src, '__antcvCacheOwn(Or), // LANG-CACHE-APP-SCOPE-001c'), 1);
  assert.equal(count(src, '__antcvCacheOwn(t); // LANG-CACHE-APP-SCOPE-001c'), 1);
  assert.equal(count(src, '...__antcvCacheOwn(t), // LANG-CACHE-APP-SCOPE-001c'), 1);
  // TRANSLATE-CACHE-MIXED-001 guard stays in front of the write
  assert.ok(min.includes('if(r[Be]&&r[Be].sections&&__antcvTxtSame((Zr.current||xo).cv,r[Be].sections.cv))'), 'mixed guard intact');
});

test('LANG-CACHE-APP-SCOPE-001c: a switch to a DIFFERENT application clears the cache through the editor bridge', () => {
  assert.equal(count(min, 'window.__antcvLangCacheReset=(f,t)=>{'), 1, 'mirror: bridge defined once');
  assert.ok(min.includes(': languageCache cleared")}catch(_){}Jr({})})'), 'mirror: bridge clears state + storage via the setter');
  assert.equal(count(src, 'window.__antcvLangCacheReset = (f, t) => {'), 1);
  const twinMin = '__lcp&&__lcp!==String(e.id)&&(window.__antcvLangCacheReset?window.__antcvLangCacheReset(__lcp,String(e.id)):localStorage.removeItem("languageCache"))}catch(_){}try{window.AntcvJdScope&&window.AntcvJdScope.setCurrentAppId(String(e.id))}catch(_){}';
  assert.equal(count(min, twinMin), 2, 'mirror: both twins, previous id read BEFORE the scope moves');
  assert.equal(count(src, '__lcp && __lcp !== String(e.id) && (window.__antcvLangCacheReset'), 2, 'source: both twins');
});

test('LANG-CACHE-APP-SCOPE-001c: __antcvCacheOwn behaviour', () => {
  const body = min.slice(min.indexOf('function __antcvCacheOwn(c){'), min.indexOf('function __antcvSnapStandalone()'));
  const run = (cur, cache) => {
    const warn = [];
    const f = new Function('__antcvCacheApp', 'console', body + ';return __antcvCacheOwn;')(() => cur, { warn: (m) => warn.push(m) });
    return { out: f(cache), warn };
  };
  const cache = { en: { app: '3491', meta: { company: 'Kaleido' } }, da: { app: '3525' }, es: { meta: {} } };
  const r = run('3525', cache);
  assert.deepEqual(Object.keys(r.out), ['da']);
  assert.match(r.warn[0], /dropped cached en,es/);
  assert.deepEqual(run('3525', null).out, {});
  assert.equal(run('3525', { da: { app: '3525' } }).warn.length, 0);
});
