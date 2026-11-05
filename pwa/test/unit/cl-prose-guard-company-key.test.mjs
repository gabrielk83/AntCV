// cl-prose-guard-company-key.test.mjs — CL-GUARD-COMPANY-001 (owner 2026-11-01, D1 3524 Ambu)
// The prose-loss guard filed the Terma letter under "Ambu|Hardware Solution Architect…|en"
// (5735 bytes, identical to the Terma bucket) and re-applied it, so Ambu exported Terma's
// letter. A letter written for X names X.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const CompanyMatch = require('../../antcv-company-match.js');
const SRC = readFileSync(new URL('../../antcv-cl-prose-loss-guard-985.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
}
function load(backing) {
  const localStorage = mockStorage(backing);
  const win = { localStorage, addEventListener() {}, dispatchEvent() {}, performance: { now: () => 0 }, AntcvCompanyMatch: CompanyMatch };
  const sandbox = {
    window: win, localStorage, JSON, console: { log() {} }, performance: { now: () => 0 },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    CustomEvent: function () {}, Object, String, Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win.AntcvClProseGuard;
}

const TERMA_WHY = { id: 'why', type: 'rich_block', items: [{ b: 'Why this company and position', t: "Terma's radar and space programmes need systems engineers who keep requirements traceable to verification." }] };
const TERMA_WHO = { id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'Fifteen years across automotive LiDAR, defence electro-optics and consumer cameras.' }] };
const AMBU_WHY = { id: 'why', type: 'rich_block', items: [{ b: 'Why this company and position', t: "Ambu's single-use endoscopes need a hardware architecture that a factory can build at volume." }] };
const PH_WHY = { id: 'why', type: 'rich_block', items: [{ b: 'Why this company and position', t: '[NO-JD RULE (whole letter): never leave a part empty]' }] };
const AMBU_META = { company: 'Ambu', role: 'Hardware Solution Architect, EndoIntelligence, Global R&D' };
const AMBU_KEY = 'Ambu|Hardware Solution Architect, EndoIntelligence, Global R&D|en';
const TERMA_KEY = 'Terma|Experienced Systems Engineer|en';

test('snapshot(): the Terma letter is NOT filed under the Ambu key after meta switched to Ambu', () => {
  const b = new Map();
  b.set('meta', JSON.stringify(AMBU_META));
  b.set('sections', JSON.stringify({ cv: [], cl: [TERMA_WHY, TERMA_WHO] }));
  load(b).snapshot();
  const store = JSON.parse(b.get('antcv:clProseGuard') || '{}');
  assert.equal(store[AMBU_KEY], undefined, 'no Ambu bucket from a letter that never names Ambu');
});

test('snapshot(): a real Ambu letter is captured, company stamped, sections that do not name it ride along', () => {
  const b = new Map();
  b.set('meta', JSON.stringify(AMBU_META));
  b.set('sections', JSON.stringify({ cv: [], cl: [AMBU_WHY, TERMA_WHO] }));
  load(b).snapshot();
  const bucket = JSON.parse(b.get('antcv:clProseGuard'))[AMBU_KEY];
  assert.ok(bucket && bucket.why && bucket.who, 'letter names Ambu: why + who captured');
  assert.equal(bucket._co, 'Ambu');
});

test('snapshot(): a section that names ANOTHER known company is skipped even in an Ambu letter', () => {
  const b = new Map();
  b.set('meta', JSON.stringify(AMBU_META));
  b.set('antcv:clProseGuard', JSON.stringify({ [TERMA_KEY]: { why: TERMA_WHY, _co: 'Terma' } }));
  const terOpening = { id: 'opening', type: 'rich_block', items: [{ b: '', t: 'I am applying to Terma as a systems engineer for naval radar programmes.' }] };
  b.set('sections', JSON.stringify({ cv: [], cl: [AMBU_WHY, terOpening] }));
  load(b).snapshot();
  const bucket = JSON.parse(b.get('antcv:clProseGuard'))[AMBU_KEY];
  assert.ok(bucket.why, 'Ambu section captured');
  assert.equal(bucket.opening, undefined, 'the Terma-naming opening is not filed under Ambu');
});

test('reapply(): a poisoned Ambu bucket (the Terma letter) is never re-injected', () => {
  const b = new Map();
  b.set('meta', JSON.stringify(AMBU_META));
  b.set('antcv:clProseGuard', JSON.stringify({ [AMBU_KEY]: { why: TERMA_WHY, who: TERMA_WHO } }));
  b.set('sections', JSON.stringify({ cv: [], cl: [PH_WHY] }));
  load(b).reapply();
  const cl = JSON.parse(b.get('sections')).cl;
  assert.match(cl[0].items[0].t, /^\[NO-JD RULE/, 'placeholder stays; the export gate will block it');
  assert.equal(cl.length, 1, 'the missing who section is not re-inserted from the poisoned bucket');
});

test('reapply(): a genuine Ambu bucket still heals a placeholder (loss protection kept)', () => {
  const b = new Map();
  b.set('meta', JSON.stringify(AMBU_META));
  b.set('antcv:clProseGuard', JSON.stringify({ [AMBU_KEY]: { why: AMBU_WHY } }));
  b.set('sections', JSON.stringify({ cv: [], cl: [PH_WHY] }));
  load(b).reapply();
  assert.match(JSON.parse(b.get('sections')).cl[0].items[0].t, /Ambu's single-use/);
});

test('purgeCrossKeyBuckets(): drops the Ambu bucket that holds the Terma letter and duplicate cross-key copies', () => {
  const b = new Map();
  b.set('meta', JSON.stringify(AMBU_META));
  b.set('antcv:clProseGuard', JSON.stringify({
    [TERMA_KEY]: { why: TERMA_WHY, who: TERMA_WHO, _ts: 1 },
    [AMBU_KEY]: { why: TERMA_WHY, who: TERMA_WHO, _ts: 2 },       // the 2026-11-01 poison: identical to Terma
    '|Experienced Systems Engineer|en': { why: TERMA_WHY, who: TERMA_WHO },   // empty-company duplicate
    'Hamamatsu|Optical Engineer|en': { who: TERMA_WHO },              // never names Hamamatsu
  }));
  load(b).purgeCrossKeyBuckets();
  const store = JSON.parse(b.get('antcv:clProseGuard'));
  assert.deepEqual(Object.keys(store), [TERMA_KEY], 'only the bucket whose prose names its own company survives');
});
