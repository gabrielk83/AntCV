// import-rewrap-keeps-photo.test.mjs
// ============================================================
// IMPORT-REWRAP-DROPS-PHOTO-001 (2026-08-26 desktop nightly, register row 18)
// IMPORT-REWRAP-SIBLING-DROP-001 (2026-10-05 desktop nightly, register row 107)
//
// The settings JSON import accepts BOTH shapes: the app's own export
// ({ photo, navyColor, personalInfo: {...} }) and a bare, UNWRAPPED
// personalInfo blob pasted by hand (what docs/personas/*/personalInfo.json is).
// For the unwrapped shape it REWRAPS the blob into { personalInfo: blob }.
//
// Bug 1 (row 18): the rewrap ran BEFORE the sibling reads further down the same
// comma-expression (`n.photo && (setPhoto(n.photo), store.set('photo', n.photo))`).
// After the rewrap `n.photo` is undefined, so a top-level `photo` carried by an
// unwrapped blob was silently DISCARDED — the import reported success and the
// profile photo never arrived. Fixed 1.51.4406 by carrying `photo` across.
//
// Bug 2 (row 107): the same rewrap still dropped every OTHER top-level sibling
// the chain reads: language, navyColor, the memory docs, the digest, provider
// keys/models, lineTargets, fontSizes, table ratios, consensusEnabled. Fixed by
// carrying the whole read-set across. `language` is carried only as a 2-letter
// code, because a hand-written personalInfo may hold a prose `language` field
// and the chain's setter does not validate.
//
// The behavioural cases below run the REAL rewrap arrow extracted from each
// bundle, not a transcription.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcJs = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const minJs = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

const MIN_RE = /n=(\(e=>\{const t=\{personalInfo:e\};for\(const o of\[[^\]]+\]\)[^;]+;return t\}\))\(n\)/g;
const SRC_RE = /\(n = (\(\(e\) => \{\s*const t = \{ personalInfo: e \};[\s\S]{0,1200}?return t;\s*\}\))\(n\)\)/g;

function extract(js, re, label) {
  const hits = [...js.matchAll(re)];
  assert.equal(hits.length, 1, `exactly one sibling-carrying rewrap in ${label}`);
  return new Function('return ' + hits[0][1])();
}
const BUNDLES = [
  ['app.src.js', extract(srcJs, SRC_RE, 'app.src.js')],
  ['app.js', extract(minJs, MIN_RE, 'app.js')],
];

// The guard around the rewrap, transcribed from the settings-import block. The
// rewrap itself is the real bundle code.
function importShape(blob, rewrapFn) {
  let n = JSON.parse(JSON.stringify(blob));
  if (
    !n || 'object' != typeof n || Array.isArray(n) || n.personalInfo || n.apiKey || n.proxyUrl ||
    ('string' != typeof n.name && 'string' != typeof n.email && 'string' != typeof n.phone &&
      !Array.isArray(n.experience) && !Array.isArray(n.workHistory))
  ) {
    // not an unwrapped personalInfo — left alone
  } else {
    n = rewrapFn(n);
  }
  return n;
}

const PHOTO = 'data:image/jpeg;base64,AAAA';
const SIBLINGS = {
  photo: PHOTO,
  language: 'da',
  navyColor: '#123456',
  profileDoc: { name: 'p.docx', text: 'profile' },
  skillsDoc: { name: 's.docx', text: 'skills' },
  wordsDoc: { name: 'w.docx', text: 'words' },
  danishDoc: { name: 'd.docx', text: 'dansk' },
  memoryDigest: 'digest',
  memoryDigestHash: 'abc123',
  openaiKey: 'test-openai',
  openaiProxyUrl: 'https://example.invalid/openai',
  openaiModel: '',
  mistralKey: 'test-mistral',
  mistralModel: 'm',
  geminiKey: 'test-gemini',
  geminiModel: 'g',
  lineTargets: { profile: 4 },
  fontSizes: { body: 10 },
  cvTableRatio: 0.3,
  clTableRatio: 0,
  consensusEnabled: false,
};

for (const [label, rewrap] of BUNDLES) {
  test(`${label}: unwrapped personalInfo carrying a photo keeps the photo`, () => {
    const out = importShape({ name: 'Anita Myre-Kornfeldt', email: 'a@b.c', photo: PHOTO }, rewrap);
    assert.equal(out.photo, PHOTO, 'top-level photo must survive');
    assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt', 'the blob still becomes personalInfo');
  });

  test(`${label}: unwrapped personalInfo with no siblings invents no keys`, () => {
    const out = importShape({ name: 'Anita Myre-Kornfeldt', email: 'a@b.c' }, rewrap);
    assert.deepEqual(Object.keys(out), ['personalInfo'], 'wrapper holds personalInfo only');
    assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt');
  });

  test(`${label}: every sibling the import chain reads survives the rewrap`, () => {
    const out = importShape({ name: 'Anita Myre-Kornfeldt', ...SIBLINGS }, rewrap);
    for (const [k, v] of Object.entries(SIBLINGS)) {
      assert.deepEqual(out[k], v, `${k} must survive the rewrap`);
    }
    assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt');
  });

  test(`${label}: falsy-but-set values survive (consensusEnabled false, ratio 0, model "")`, () => {
    const out = importShape({ name: 'A', consensusEnabled: false, clTableRatio: 0, openaiModel: '' }, rewrap);
    assert.equal(out.consensusEnabled, false);
    assert.equal(out.clTableRatio, 0);
    assert.equal(out.openaiModel, '');
  });

  test(`${label}: null siblings are not carried`, () => {
    const out = importShape({ name: 'A', navyColor: null, profileDoc: null }, rewrap);
    assert.equal('navyColor' in out, false);
    assert.equal('profileDoc' in out, false);
  });

  test(`${label}: a prose language field is not promoted to the app language`, () => {
    for (const bad of ['Danish (native)', 'DA', 'eng', { code: 'da' }, ['da']]) {
      const out = importShape({ name: 'A', language: bad }, rewrap);
      assert.equal('language' in out, false, `language ${JSON.stringify(bad)} must stay inside personalInfo`);
      assert.deepEqual(out.personalInfo.language, bad, 'the field is still kept on personalInfo');
    }
  });

  test(`${label}: personalInfo fields outside the read-set are not hoisted`, () => {
    const out = importShape({ name: 'A', headline: 'H', tools: ['x'], stylePrefs: { a: 1 } }, rewrap);
    assert.deepEqual(Object.keys(out), ['personalInfo']);
  });

  test(`${label}: already-wrapped app-export shape is untouched`, () => {
    const out = importShape({ photo: PHOTO, navyColor: '#123456', personalInfo: { name: 'Anita Myre-Kornfeldt' } }, rewrap);
    assert.equal(out.photo, PHOTO);
    assert.equal(out.navyColor, '#123456');
    assert.equal(out.personalInfo.personalInfo, undefined, 'must not double-wrap');
  });

  test(`${label}: a blob carrying apiKey or proxyUrl is never rewrapped`, () => {
    const out = importShape({ name: 'A', apiKey: 'test-key' }, rewrap);
    assert.equal(out.personalInfo, undefined);
    assert.equal(out.apiKey, 'test-key');
  });

  test(`${label}: the real Anita persona blob takes the rewrap path and keeps its photo`, async () => {
    const anita = JSON.parse(await readFile(
      new URL('../../../docs/personas/anita/personalInfo.json', import.meta.url), 'utf8'));
    assert.equal(anita.personalInfo, undefined, 'persona file is an UNWRAPPED personalInfo');
    const out = importShape(anita, rewrap);
    assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt', 'rewrap path confirmed');
    if (anita.photo) assert.equal(out.photo, anita.photo, 'persona photo must reach the app');
  });
}

test('NEGATIVE CONTROL: the 1.51.4406 photo-only rewrap really did drop the other siblings', () => {
  // The expression that shipped before row 107. If this did not lose navyColor,
  // the sibling cases above would prove nothing.
  const photoOnly = (n) => (n.photo ? { personalInfo: n, photo: n.photo } : { personalInfo: n });
  const out = importShape({ name: 'A', ...SIBLINGS }, photoOnly);
  assert.equal(out.photo, PHOTO, 'photo was already carried');
  for (const k of Object.keys(SIBLINGS).filter((k) => k !== 'photo')) {
    assert.equal(out[k], undefined, `pre-fix expression drops ${k} (bug reproduced)`);
  }
});

test('NEGATIVE CONTROL: the original unconditional rewrap dropped the photo too', () => {
  const old = (n) => ({ personalInfo: n });
  const out = importShape({ name: 'Anita Myre-Kornfeldt', photo: PHOTO }, old);
  assert.equal(out.photo, undefined, 'the pre-1.51.4406 expression drops the photo');
});

test('the carried key list is identical in both bundles and covers the chain read-set', () => {
  const keysOf = (js, re) => JSON.parse('[' + [...js.matchAll(re)][0][1].match(/of\s*\[([^\]]+)\]/)[1].replace(/,\s*$/, '') + ']');
  const srcKeys = keysOf(srcJs, SRC_RE);
  const minKeys = keysOf(minJs, MIN_RE);
  assert.deepEqual(srcKeys, minKeys, 'source and deployed key lists match');
  assert.deepEqual([...srcKeys].sort(), Object.keys(SIBLINGS).sort(), 'the test fixture covers every carried key');
  // Every `n.<key>` the import chain reads between the rewrap and the
  // personalInfo apply must be in the carried set (apiKey / proxyUrl never
  // reach the rewrap: they are disjuncts of the guard).
  const start = minJs.search(MIN_RE);
  const end = minJs.indexOf('n.personalInfo&&!', start);
  assert.ok(start > 0 && end > start, 'chain window located in app.js');
  const read = new Set([...minJs.slice(start, end).matchAll(/\bn\.([A-Za-z]+)\b/g)].map((m) => m[1]));
  read.delete('apiKey');
  read.delete('proxyUrl');
  for (const k of read) assert.ok(minKeys.includes(k), `chain reads n.${k}; the rewrap must carry it`);
});

test('the old rewrap forms are gone from both bundles', () => {
  assert.equal(srcJs.includes('personalInfo: n, photo: n.photo'), false, 'photo-only rewrap gone from app.src.js');
  assert.equal(srcJs.includes('(n = { personalInfo: n })'), false, 'unconditional rewrap gone from app.src.js');
  assert.equal(minJs.includes('n=n.photo?{personalInfo:n,photo:n.photo}:{personalInfo:n}'), false,
    'photo-only rewrap gone from app.js');
  assert.equal(minJs.includes(',n={personalInfo:n}'), false, 'unconditional rewrap gone from app.js');
});
