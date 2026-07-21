// babel-en-asymmetry.test.mjs
// ============================================================
// BABEL-EN-ASYMMETRY-001 (owner 2026-07-21: "a chinese job was loaded but the
// language selector stayed english - resulting with chinese all the time").
//
// isInLanguage() returned TRUE for L==='en' UNCONDITIONALLY ("English is the
// canonical rendering"), so the babel-relang healer was blind in the en
// direction: a zh document sitting under an 'en' ribbon passed as "already
// correct" and was NEVER re-rendered. The reverse (English under a zh ribbon)
// was always caught — the detector was asymmetric.
//
// Downstream, that same stuck state drives the 415 role storm:
// repairExperienceCompleteness compares the ENGLISH personalInfo roles against
// the zh section roles, _samePosition misses cross-script, and the same
// "missing" roles are re-added every pass forever.
//
// Lock: the en test is SYMMETRIC (non-Latin-dominated content is NOT English),
// while Latin invariants / an occasional CJK proper noun inside a genuinely
// English CV never trip it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-babel-relang.js', import.meta.url), 'utf8');

function load() {
  const store = new Map();
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, __antcvView: 'editor' },
    document: { hidden: false, addEventListener() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {},
    console: { log() {}, warn() {}, info() {}, debug() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, Date, parseInt, isNaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.AntcvBabelRelang;
}

// Long enough to clear MIN_LETTERS (200 letters).
const EN_CV = ('Experienced product and project professional with over fifteen years '
  + 'of delivery across regulated and commercial markets, leading validation and '
  + 'compliance work, requirements management and change control boards, and '
  + 'coordinating cross functional teams through qualification and release. ').repeat(3);

const ZH_CV = ('产品与项目专家，拥有超过十五年的交付经验，涵盖受监管市场与商业市场，'
  + '负责验证与合规工作、需求管理与变更控制委员会，并协调跨职能团队完成认证与发布。').repeat(6);

test('en ribbon + English content -> in language (no needless re-render)', () => {
  const B = load();
  assert.equal(B._isInLanguage(EN_CV, 'en'), true);
});

test('REGRESSION: en ribbon + Chinese content -> NOT in language (heals back to English)', () => {
  const B = load();
  assert.equal(B._isInLanguage(ZH_CV, 'en'), false,
    'a zh document under an en ribbon must be detected as wrong-language');
});

test('en ribbon + English CV containing a few CJK proper nouns -> still English', () => {
  const B = load();
  // e.g. a Chinese employer/customer name inside an otherwise English CV
  assert.equal(B._isInLanguage(EN_CV + ' 北京 上海 华为 ', 'en'), true,
    'a handful of CJK invariants must never trigger a re-render');
});

test('too little content to judge -> null (never acts on the empty skeleton)', () => {
  const B = load();
  assert.equal(B._isInLanguage('短', 'en'), null);
  assert.equal(B._isInLanguage('Short text', 'en'), null);
});

test('the non-Latin direction still works (unregressed)', () => {
  const B = load();
  assert.equal(B._isInLanguage(ZH_CV, 'zh'), true, 'zh content under a zh ribbon is fine');
  assert.equal(B._isInLanguage(EN_CV, 'zh'), false, 'English under a zh ribbon still heals');
});

test('mixed en/zh under an en ribbon is caught once the CJK prose dominates', () => {
  const B = load();
  assert.equal(B._isInLanguage(EN_CV + ZH_CV, 'en'), false);
});

test('both detection directions share one prose basis (proseLatinLen)', () => {
  assert.equal(src.includes('function proseLatinLen('), true, 'single prose measure helper');
  assert.equal(src.includes('BABEL-EN-ASYMMETRY-001'), true, 'documented at the fix site');
});
