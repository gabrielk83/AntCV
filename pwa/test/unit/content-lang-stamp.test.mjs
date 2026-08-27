// content-lang-stamp.test.mjs
// ============================================================
// CONTENT-LANG-STAMP-001 (register row 94, 2026-08-27) — the prevention leg of
// APP-SWITCH-CONTENT-LANG-001.
//
// `jd_language` is the JOB DESCRIPTION's language. The language the CV/CL
// CONTENT is written in was persisted NOWHERE, so three consumers (the
// app-switch/boot language selector, the babel-relang heal, export) each
// re-derived it by script-sniffing the sections. A Latin document (en/da/es)
// falls outside the wide-script detector, so the selector fell back to
// jd_language and could pin a ribbon the content is NOT in — which drove
// babel-relang to LLM-re-translate a correctly-written document.
//
// The fix has two legs, both asserted here against the DEPLOYED bytes:
//   leg 1  pwa/app.js `update()` — the ONE method every cv/cl writer reaches the
//          server through — stamps `content_language` on the payload.
//   leg 2  both app-load sites read the stored stamp, ranked BELOW the certain
//          wide-script detect (__cl) and ABOVE the fuzzy Latin sniff.
// Plus the relay half: PUT /api/applications/:id whitelists the field and
// shapeApplicationRow returns it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const min   = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const src   = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const relay = await readFile(new URL('../../../workers/access-relay/src/index.js', import.meta.url), 'utf8');

const count = (hay, needle) => hay.split(needle).length - 1;

// The stamp expression, verbatim from the deployed bundle. Extracting it by the
// bytes that actually ship means these behaviour tests can never pass against a
// bundle that no longer carries the fix.
const STAMP_MIN =
  '(function(p){try{if(!p||"object"!=typeof p)return p;if("content_language"in p)return p;' +
  'var __cvs=Array.isArray(p.cv_sections)?p.cv_sections:null,__cls=Array.isArray(p.cl_sections)?p.cl_sections:null;' +
  'if(!__cvs&&!__cls)return p;if("function"!=typeof window.__antcvContentLang)return p;' +
  'var __L=String(window.__antcvContentLang(__cvs||[],__cls||[])||"").toLowerCase();' +
  'if(["en","da","es","zh","he","am"].indexOf(__L)>=0)return Object.assign({},p,{content_language:__L})}catch(_){}return p})';

// ---------------------------------------------------------------- leg 1: wiring

test('leg 1: app.js update() routes its PUT body through the content-language stamp', () => {
  const wired =
    'update(e,t){return this._call("/api/applications/"+e,{method:"PUT",body:JSON.stringify(' +
    STAMP_MIN + '(t||{}))})}';
  assert.equal(count(min, wired), 1, 'the stamped update() must appear exactly once in app.js');
  // Negative control on the shape this replaced: the un-stamped body must be gone.
  assert.equal(
    count(min, 'update(e,t){return this._call("/api/applications/"+e,{method:"PUT",body:JSON.stringify(t||{})})}'),
    0,
    'the un-stamped update() body must not survive anywhere in app.js',
  );
});

test('leg 1: app.src.js carries the same stamp (minified-mirror lock)', () => {
  assert.equal(count(src, 'content_language: __L'), 1, 'app.src.js must stamp content_language once');
  assert.ok(
    /body: JSON\.stringify\(\(function \(p\) \{[\s\S]{0,4000}?content_language: __L[\s\S]{0,400}?\}\)\(t \|\| \{\}\)\)/.test(src),
    'app.src.js update() must pass its payload through the stamp before JSON.stringify',
  );
  // Both bundles must agree that this is the ONLY PUT chokepoint that stamps.
  assert.equal(count(src, '"/api/applications/" + e'), 3, 'get/update/remove — the three by-id calls');
});

// ---------------------------------------------------------------- leg 1: behaviour

function runStamp(payload, contentLang) {
  const sandbox = { window: {}, Object, Array, String, JSON };
  if (contentLang !== undefined) sandbox.window.__antcvContentLang = () => contentLang;
  vm.createContext(sandbox);
  const fn = vm.runInContext(STAMP_MIN, sandbox);
  return fn(payload);
}

test('stamps a confident detection onto a payload that carries sections', () => {
  const p = { cv_sections: [{ id: 'x' }], cl_sections: [] };
  const out = runStamp(p, 'da');
  assert.equal(out.content_language, 'da');
  assert.equal(p.content_language, undefined, 'the caller payload must not be mutated');
});

test('stamps from cl_sections alone (a CL-only write)', () => {
  assert.equal(runStamp({ cl_sections: [{ id: 'opening' }] }, 'es').content_language, 'es');
});

test('a partial write with NO sections is left alone — never clears a stored value', () => {
  const out = runStamp({ jd_company: 'Terma', rationale: {} }, 'zh');
  assert.equal('content_language' in out, false);
});

test('an unconfident detection ("") is not stamped', () => {
  const out = runStamp({ cv_sections: [{ id: 'x' }] }, '');
  assert.equal('content_language' in out, false);
});

test('a language outside the six the app renders is dropped, not stored', () => {
  for (const bad of ['fr', 'de', 'xx', 'ENGLISH', null]) {
    const out = runStamp({ cv_sections: [{ id: 'x' }] }, bad);
    assert.equal('content_language' in out, false, 'must not stamp ' + String(bad));
  }
});

test('an explicit caller-supplied content_language wins over the sniff', () => {
  const out = runStamp({ cv_sections: [{ id: 'x' }], content_language: null }, 'zh');
  assert.equal(out.content_language, null, 'a deliberate null clear must survive the stamp');
});

test('a missing detector (bundle mismatch) degrades to a plain pass-through', () => {
  const out = runStamp({ cv_sections: [{ id: 'x' }] }, undefined);
  assert.equal('content_language' in out, false);
});

test('all six rendered languages round-trip', () => {
  for (const L of ['en', 'da', 'es', 'zh', 'he', 'am']) {
    assert.equal(runStamp({ cv_sections: [{ id: 'x' }] }, L).content_language, L);
  }
});

// ---------------------------------------------------------------- leg 2: the read

const READ_MIN =
  'try{var __st=String((n&&n.content_language)||"").toLowerCase().replace(/[^a-z]/g,"").slice(0,2);' +
  'if(["en","da","es","zh","he","am"].indexOf(__st)>=0)return __st}catch(_){}';

test('leg 2: BOTH app-load sites read the stored stamp', () => {
  assert.equal(count(min, READ_MIN), 2, 'app.js: the switch-path and boot-path load sites');
  assert.equal(count(src, '(n && n.content_language)'), 2, 'app.src.js mirror: same two sites');
});

test('leg 2: the stamp is ranked BELOW __cl and ABOVE the Latin sniff', () => {
  // In the shipped chain `var __al = __cl || (…)() || jd_language`, the stored
  // read must sit INSIDE the middle IIFE and BEFORE the __antcvContentLang call —
  // so a positive wide-script detect still wins, and the fuzzy Latin prose-ratio
  // sniff only runs when there is no stored stamp.
  const chain = min.split('var __al=__cl||function(){');
  assert.equal(chain.length, 3, 'two load sites use the __cl-first chain');
  for (const tail of chain.slice(1)) {
    const stored = tail.indexOf('n.content_language');
    const sniff  = tail.indexOf('window.__antcvContentLang');
    const jdLang = tail.indexOf('n.jd_language');
    assert.ok(stored > -1 && sniff > -1 && jdLang > -1, 'all three rungs present');
    assert.ok(stored < sniff, 'the stored stamp must be read before the Latin sniff');
    assert.ok(sniff < jdLang, 'the sniff must still precede the jd_language fallback');
  }
});

test('leg 2: a stored stamp is normalised and garbage falls through', () => {
  const run = (stored) => {
    const sandbox = { n: { content_language: stored }, String, Array };
    vm.createContext(sandbox);
    return vm.runInContext('(function(){' + READ_MIN + 'return "FELL-THROUGH"})()', sandbox);
  };
  assert.equal(run('da'), 'da');
  assert.equal(run('DA'), 'da');
  assert.equal(run('da-DK'), 'da');
  assert.equal(run('fr'), 'FELL-THROUGH', 'an unrenderable language must not pin the ribbon');
  assert.equal(run(null), 'FELL-THROUGH', 'a pre-stamp row (NULL) uses the old chain');
  assert.equal(run(''), 'FELL-THROUGH');
});

// ---------------------------------------------------------------- the relay half

test('relay: shapeApplicationRow returns content_language', () => {
  assert.equal(count(relay, 'content_language:   row.content_language || null,'), 1);
});

test('relay: PUT whitelists content_language with the same six-language gate', () => {
  assert.ok(relay.includes('if (body.content_language !== undefined) {'), 'undefined-skip convention');
  assert.ok(relay.includes("sets.push('content_language = ?');"), 'the field reaches the UPDATE');
  assert.ok(
    /body\.content_language === null[\s\S]{0,200}\['en', 'da', 'es', 'zh', 'he', 'am'\]\.indexOf\(__cl\) >= 0/.test(relay),
    'null clears; anything outside the six is dropped rather than stored',
  );
});
