// cl-academy-format.test.mjs — CL-ACADEMY-001 (owner 2026-11-01): the academy letter is the
// default (house packages 1048 Ambu / 1052 ASSA ABLOY): sentence-case headline, about 400
// words, I will / I would, two first-90-days questions, "My goal", one closing invitation,
// "Kind regards," and no hearing or communication line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const A = require('../../antcv-cl-academy-format.js');
const gold = JSON.parse(readFileSync(new URL('../../gold-rules.json', import.meta.url), 'utf8'));

test('gold rules carry the academy format for every generation', () => {
  const rule = gold.prompt_block.find((l) => l.includes('CL-ACADEMY-001'));
  assert.ok(rule, 'prompt_block rule present');
  for (const must of ['SENTENCE-CASE headline', 'about 400 words', "'I will' or 'I would'", 'exactly TWO questions for the first 90 days', "'My goal: <one line>'", 'ONE closing invitation', "'Kind regards,'", 'no hearing, captions or communication-needs line']) {
    assert.ok(rule.includes(must), 'rule names: ' + must);
  }
  assert.equal(gold.cl.format, 'academy');
  assert.equal(gold.cl.sign_off.en, 'Kind regards,');
});

test('sign-off: "Kind regards," replaces the Nordic default, follows the language, keeps a typed closing', () => {
  assert.equal(A.closingFor('', 'en', false), 'Kind regards,');
  assert.equal(A.closingFor('At your service,', 'en', false), 'Kind regards,');
  assert.equal(A.closingFor('Kind regards,', 'en', true), null, 'already set');
  assert.equal(A.closingFor('Kind regards,', 'da', true), 'Med venlig hilsen,', 'automatic value follows the language');
  assert.equal(A.closingFor('Best wishes from Copenhagen,', 'en', false), null, 'the user typed it');
  assert.equal(A.closingFor('', 'zh', false), null, 'zh keeps the app default');
});

test('no hearing / captions sentence in the letter; the rest of the paragraph stays', () => {
  const t = 'I run change boards calmly. I follow meetings best with live captions and written follow-ups. I write decisions down.';
  assert.equal(A.stripComms(t), 'I run change boards calmly. I write decisions down.');
  const cl = [
    { id: 'who', type: 'rich_block', items: [{ b: 'How I operate', t: 'Hearing impaired; captions help.' }, { b: 'Professional summary', t: 'Fifteen years in hardware.' }] },
    { id: 'why', type: 'text', content: 'Yale needs launches on plan.' },
  ];
  const out = A.stripCommsCl(cl);
  assert.equal(out[0].items[0].t, '');
  assert.deepEqual(out[0].hidden, { 0: true }, 'an emptied labelled row is hidden, not left as a bare label');
  assert.equal(out[1], cl[1], 'untouched sections are the same objects');
  assert.equal(A.stripCommsCl([cl[1]])[0], cl[1]);
});
