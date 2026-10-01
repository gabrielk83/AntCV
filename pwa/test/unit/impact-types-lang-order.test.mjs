// impact-types-lang-order.test.mjs
// RESULTS-IMPACT-TYPES-001, LANGUAGES-ORDER-001, ROLE-BODY-NOTE-001 (owner 2026-10-01).
// The JS mirrors must match gold-rules.json, and each rule must do what the owner asked.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const gold = JSON.parse(await readFile(new URL('../../gold-rules.json', import.meta.url), 'utf8'));
const docx = await readFile(new URL('../../antcv-docx-client.js', import.meta.url), 'utf8');
const langSrc = await readFile(new URL('../../antcv-languages-concise.js', import.meta.url), 'utf8');
const noteSrc = await readFile(new URL('../../antcv-role-body-notes.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function runSidecar(src, sections, language = 'en') {
  const store = { sections: JSON.stringify(sections), language };
  const window = { addEventListener() {}, dispatchEvent() {} };
  const ctx = { window, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    setTimeout() {}, CustomEvent: function () {}, JSON };
  vm.runInNewContext(src, ctx);
  return { window, read: () => JSON.parse(store.sections) };
}

test('gold-rules carries the four impact types with a selection weight', () => {
  const it = gold.results.impact_types;
  assert.deepEqual(Object.keys(it.types), ['performance', 'deliverables', 'improvements', 'audience']);
  assert.equal(it.selection_weight, 0.35);
  for (const t of Object.values(it.types)) { new RegExp(t.detect_pattern, 'i'); new RegExp(t.jd_pattern, 'i'); }
  assert.ok(gold.prompt_block.some((l) => l.includes('RESULTS-IMPACT-TYPES-001')));
  assert.ok(gold.prompt_block.some((l) => l.includes('ROLE-BODY-NOTE-001')));
});

test('docx-client impact patterns are a verbatim copy of gold-rules', () => {
  for (const [k, t] of Object.entries(gold.results.impact_types.types)) {
    const re = new RegExp(k + ': \\[/(.*?)/i,\\s*\\n\\s*/(.*?)/gi\\]', 's');
    const m = docx.match(re);
    assert.ok(m, 'pattern pair for ' + k);
    assert.equal(m[1], t.detect_pattern, k + ' detect_pattern drifted');
    assert.equal(m[2], t.jd_pattern, k + ' jd_pattern drifted');
  }
});

test('the JD-most-asked impact type scores highest', async () => {
  const m = await import('../../antcv-docx-client.js');
  const d = m._jdImpactDemand('Own cost, schedule and budget; keep quality and lead time on plan.');
  assert.equal(d.performance, 1);
  assert.ok(m._impactNorm('Cut LiDAR unit cost 10x by substitute selection.', d) > m._impactNorm('Built the project template.', d));
  assert.equal(m._impactNorm('anything', null), 0);
});

test('languages sort Danish, English, Spanish, Hebrew in any output language', () => {
  const secs = { cv: [{ id: 'languages', items: [
    { l: 'English', v: 'native / fluent' }, { l: 'Hebrew', v: 'native / fluent' },
    { l: 'Spanish', v: 'professional' }, { l: 'Danish', v: 'intermediate (B2)' }] }] };
  const a = runSidecar(langSrc, secs);
  a.window.AntcvLanguagesConcise.run();
  assert.deepEqual(a.read().cv[0].items.map((i) => i.l), ['Danish', 'English', 'Spanish', 'Hebrew']);
  const da = { cv: [{ title: 'Sprog', items: [{ b: 'Engelsk', t: 'x' }, { b: 'Fransk', t: 'y' }, { b: 'Dansk', t: 'z' }] }] };
  const b = runSidecar(langSrc, da, 'da');
  b.window.AntcvLanguagesConcise.run();
  assert.deepEqual(b.read().cv[0].items.map((i) => i.b), ['Dansk', 'Engelsk', 'Fransk']);
});

test('languages order list in the sidecar matches gold-rules', () => {
  for (const names of gold.languages_order.order) assert.ok(langSrc.includes(JSON.stringify(names).replace(/"/g, "'").replace(/,/g, ', ')), names[0]);
});

test('Trackman body says internship; role line untouched; idempotent', () => {
  const secs = { cv: [{ type: 'experience', roles: [
    { title: 'Project Manager, Hardware Development & Supply', company: 'Trackman A/S', bullets: ['Hardware Project Management: Own the PMA template.'], results: 'PMA template v2.' },
    { title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', bullets: ['Offers: Scope and pricing input.'] }] }] };
  const s = runSidecar(noteSrc, secs);
  s.window.AntcvRoleBodyNotes.run(); s.window.AntcvRoleBodyNotes.run();
  const r = s.read().cv[0].roles;
  assert.equal(r[0].bullets[0], 'Hardware Project Management (internship): Own the PMA template.');
  assert.equal(r[0].title, 'Project Manager, Hardware Development & Supply');
  assert.equal(r[1].bullets[0], 'Offers: Scope and pricing input.');
});

test('index.html loads the role-body-notes sidecar with a ?v', () => {
  assert.match(index, /<script src="antcv-role-body-notes\.js\?v=[^"]+" defer><\/script>/);
});
