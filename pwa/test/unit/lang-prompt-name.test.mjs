// lang-prompt-name.test.mjs
// ============================================================
// BABEL-FISH-LANG-NAME-001 (owner 2026-07-11): the prominent generation prompt
// `LANGUAGE:` line was hardcoded to "UK English" for every non-Danish language,
// contradicting the trailing __langGenLock and letting the model drift back to
// English (the "unsolicited zh -> English content" report). The fix names the
// TRUE target via __langPromptName(code) so the prominent directive and the lock
// agree. String-level assertions on BOTH app.src.js and the deployed app.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

// the old hardcode: any non-Danish language -> "UK English" in the prominent line
const OLD_SRC = 'i = a\n              ? "Copenhagen Danish (simple everyday words, hverdagssprog, no buzzwords, short sentences)"\n              : "UK English",';
const OLD_APP = ':"UK English",s=Fa[Ma]||Fa["nordic-minimal"]';

test('app.src.js: the hardcoded UK-English fallback for the LANGUAGE line is gone', () => {
  assert.equal(src.includes(OLD_SRC), false, 'old hardcoded ternary removed');
  assert.equal(src.includes('function __langPromptName('), true, 'helper defined');
  assert.equal(src.includes('i = __langPromptName(je)'), true, 'LANGUAGE line uses the helper');
  assert.equal(src.includes('BABEL-FISH-LANG-NAME-001'), true, 'fix is documented');
});

test('app.src.js: the helper names the real target for zh/he/am and defaults to English', () => {
  // pull the helper body and check the key names are present
  const i = src.indexOf('function __langPromptName(');
  const body = src.slice(i, i + 900);
  assert.equal(/zh:\s*"Simplified Chinese/.test(body), true, 'zh -> Simplified Chinese');
  assert.equal(/he:\s*"Hebrew/.test(body), true, 'he -> Hebrew');
  assert.equal(/am:\s*"Amharic/.test(body), true, 'am -> Amharic');
  assert.equal(/return M\[code\]\s*\|\|\s*"UK English/.test(body), true, 'unknown/en -> UK English');
});

test('app.js (deployed): same fix present, hardcode gone', () => {
  assert.equal(app.includes(OLD_APP), false, 'old hardcoded fallback removed from the deployed bundle');
  assert.equal(app.includes('function __langPromptName('), true, 'helper in the bundle');
  assert.equal(app.includes('l=__langPromptName(Be)'), true, 'LANGUAGE line (minified) uses the helper');
});
