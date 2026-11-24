// IMPORT-SEMRULE-KEY-001 (desktop nightly 2026-11-24): an import keeps the stored style
// constraints. Two code paths, both loaded by index.html:
//   antcv-data-importer.js   mergePath/DEDUP_KEYS  (settings JSON, personalInfo fragment)
//   antcv-data-import-331.js mergeBannedIntoPI     (AntcvBackup restore)
// The canonical list is stylePrefs.semanticConstraintsV2 (WritingStylePicker reads it first
// and regenerates the flat bannedContextual from it on the next edit), so losing a V2 rule
// loses it for generation too. Run: node scripts/run-tests.mjs pwa
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
function slice(text, from, to) {
  const a = text.indexOf(from), b = text.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'anchor moved: ' + from);
  return text.slice(a, b);
}
const importer = vm.runInNewContext(
  '(function(){' + slice(src('antcv-data-importer.js'), '  const _ndk =', '  // ─── Diff flattening') + '; return { mergePath, DEDUP_KEYS }; })()');
function restoreMerge(current, incoming) {
  const body = slice(src('antcv-data-import-331.js'), '  function unionCsv(', '  // ── restore a PLAIN envelope');
  return vm.runInNewContext('(function(){' + body + '; return mergeBannedIntoPI(incoming); })()', {
    incoming, localStorage: { getItem: () => JSON.stringify(current) },
  });
}
const J = (x) => JSON.parse(JSON.stringify(x));
const imp = (cur, inc) => J(importer.mergePath({ stylePrefs: cur }, { stylePrefs: inc }, 'personalInfo')).stylePrefs;
const rest = (cur, inc) => J(restoreMerge({ stylePrefs: cur }, { stylePrefs: inc })).stylePrefs;

const V2 = (id, avoid, scope) => ({ ...(id ? { id } : {}), trigger: 'no line mgmt', avoid: [avoid], prefer: ['supervised'], ...(scope ? { scope } : {}) });
const ids = (l) => l.map((r) => r.id).sort();

for (const [name, run] of [['importer', imp], ['backup restore', rest]]) {
  test(`${name}: a small imported V2 list does not replace the stored one`, () => {
    const out = run({ semanticConstraintsV2: [V2('a', 'led'), V2('b', 'headed'), V2('c', 'ran')] }, { semanticConstraintsV2: [V2('d', 'owned')] });
    assert.deepEqual(ids(out.semanticConstraintsV2), ['a', 'b', 'c', 'd']);
  });
  test(`${name}: an import without V2 rules keeps the stored V2 rules`, () => {
    for (const inc of [{}, { semanticConstraintsV2: [] }]) {
      assert.deepEqual(ids(run({ semanticConstraintsV2: [V2('a', 'led')] }, inc).semanticConstraintsV2), ['a']);
    }
  });
  test(`${name}: re-importing the same V2 list adds nothing`, () => {
    const l = [V2('a', 'led'), V2(null, 'headed'), V2(null, 'headed', { role_company: 'Acme' })];
    assert.deepEqual(run({ semanticConstraintsV2: l }, { semanticConstraintsV2: l }).semanticConstraintsV2, l);
  });
  test(`${name}: flat rules for two roles with the same avoid term both survive`, () => {
    const a = { avoid: 'led', use_instead: 'supervised', when: { role_company: 'Acme' } };
    const b = { avoid: 'led', use_instead: 'ran', when: { role_company: 'Beta' } };
    const out = run({ bannedContextual: [a, b] }, { bannedContextual: [{ avoid: 'led', use_instead: 'x', when: { role_title: 'Intern' } }] });
    assert.equal(out.bannedContextual.length, 3);
  });
  test(`${name}: flat rules in a non-Latin script stay apart`, () => {
    const out = run({ bannedContextual: [{ avoid: '领导', when: {} }, { avoid: '管理', when: {} }] }, { bannedContextual: [{ avoid: 'הוביל', when: {} }] });
    assert.equal(out.bannedContextual.length, 3);
  });
}
for (const [name, run] of [['importer', imp], ['backup restore', rest]]) {
  test(`${name}: the rule key folds spaces and case, never letters`, () => {
    // an unescaped /s+/ turns 'boss' and 'bos' into one key
    const two = run({ semanticConstraintsV2: [V2(null, 'boss')] }, { semanticConstraintsV2: [V2(null, 'bos')] });
    assert.equal(two.semanticConstraintsV2.length, 2);
    const one = run({ semanticConstraintsV2: [V2(null, 'led  a team')] }, { semanticConstraintsV2: [V2(null, 'Led a team')] });
    assert.equal(one.semanticConstraintsV2.length, 1);
  });
}
test('importer: a re-import of the same flat rule updates it instead of duplicating it', () => {
  const out = imp({ bannedContextual: [{ avoid: 'Led ', use_instead: 'old', when: {} }] }, { bannedContextual: [{ avoid: 'led', use_instead: 'new', when: {} }] });
  assert.deepEqual(out.bannedContextual.map((r) => r.use_instead), ['new']);
});
test('importer: a V2 rule with the same id is updated in place', () => {
  const out = imp({ semanticConstraintsV2: [V2('a', 'led'), V2('b', 'ran')] }, { semanticConstraintsV2: [V2('a', 'headed')] });
  assert.deepEqual(out.semanticConstraintsV2.map((r) => r.avoid[0]), ['headed', 'ran']);
});
test('backup restore: a personalInfo without V2 rules on either side gets no V2 key', () => {
  assert.equal('semanticConstraintsV2' in rest({}, {}), false);
});
