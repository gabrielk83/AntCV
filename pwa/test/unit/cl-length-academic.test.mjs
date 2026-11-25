// cl-length-academic.test.mjs — LETTER-LENGTH-002 (owner 2026-11-25: "keep it 2 pages when it is a real academic
// position/phd. if it is not keep it one page and very relevant to the job. the academic work ad in sweden is not a
// real academic work"). Default cover-letter length by job; a length the user picked always wins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
function boot(store) {
  const ls = { ...store };
  const window = { dispatchEvent() {}, addEventListener() {} };
  const ctx = { window, localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    document: { readyState: 'loading', addEventListener() {}, querySelector: () => null }, CustomEvent: class {}, MutationObserver: class { observe() {} }, requestAnimationFrame() {} };
  vm.runInNewContext(read('antcv-cl-length-560.js'), ctx);
  return window.AntcvClLength;
}
const len = (role, company, extra) => boot({ meta: JSON.stringify({ role, company }), ...(extra || {}) }).get();

test('academic positions default to two pages', () => {
  assert.equal(len('PhD scholarship in Electronic-Photonic Integration', 'DTU Electro'), 2);
  assert.equal(len('Postdoc in Nanoelectromechanical Control', 'DTU Electro'), 2);
  assert.equal(len('Doctoral student in photonics', 'Lund University'), 2);
  assert.equal(len('Ph.d.-stipendiat i fotonik', 'Aarhus Universitet'), 2);
  assert.equal(len('Research Assistant', 'University of Copenhagen'), 2);
  assert.equal(len('Project Manager', 'Siemens', { toneRegister: '"research-formal"' }), 2);
});
test('everything else stays on one page', () => {
  assert.equal(len('Optical & Camera Engineer', 'Academic Work'), 1);
  assert.equal(len('PhD-level Optical Engineer', 'Academic Work'), 1);
  assert.equal(len('Test Engineer, Photonic', 'NVIDIA'), 1);
  assert.equal(len('Project Manager', 'DTU Wind'), 1);
  assert.equal(len('Research Associate', 'Novo Nordisk'), 1);
  assert.equal(len('PhD Recruitment Coordinator', 'DTU'), 1);
  assert.equal(len('', ''), 1);
  for (const s of ['mediterranean-formal', 'context-rich', 'prestige-structured', 'nordic-minimal']) assert.equal(len('Project Manager', 'Siemens', { toneRegister: JSON.stringify(s) }), 1);
});
test('a picked length wins', () => {
  assert.equal(len('PhD scholarship', 'DTU Electro', { pageBudgetCl: '1' }), 1);
  assert.equal(len('Project Manager', 'Siemens', { pageBudgetCl: '2' }), 2);
});
test('the generation prompt reads the default, and the rule names the exception', () => {
  assert.match(read('app.js'), /COVER LETTER TARGET LENGTH: aim for \$\{window\.AntcvClLength\?window\.AntcvClLength\.get\(\)/);
  assert.match(read('app.src.js'), /COVER LETTER TARGET LENGTH: aim for \$\{window\.AntcvClLength \? window\.AntcvClLength\.get\(\)/);
  const gold = JSON.parse(read('gold-rules.json'));
  const rule = gold.prompt_block.find((l) => /LETTER-LENGTH-002/.test(l));
  assert.match(rule, /750-900 words on two pages/); assert.match(rule, /Academic Work is not academic/);
  assert.equal(gold.cl.academic.pages, 2);
});
