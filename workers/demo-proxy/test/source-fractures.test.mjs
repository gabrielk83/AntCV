// source-fractures.test.mjs — SOURCE-FRACTURES-001 (owner 2026-10-23)
// The writer, the supervisor and the coherence reviewer must not read the
// same source in the same shape. This test pins:
//  - the fractures carry every number of the source (the ledger is complete)
//  - the supervisor view lists the facts in another order than the prose,
//    while losing none of them
//  - the coherence view groups facts by kind and carries the ledger
//  - numberGrounding flags a number no source line carries, lets a source
//    number through, and tags a job-ad figure as external (company fact)
//  - the supervisor endpoint merges the deterministic metric deviations and
//    reports fracture counts; proxy and demo-proxy copies stay identical
//
// Run from inside workers/proxy/:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFractures, viewFor, numberGrounding, extractNumbers, atomize, seededShuffle,
} from '../src/source-fractures.js';

const SOURCE = [
  'Change Request Lead, Innoviz Technologies, 2020 - 2025',
  '- Chair the change board of a 400-person matrix organisation.',
  '- Results: cycle cut from ~250 to ~10 days; $8M customer NRE programme supported.',
  'System Architect, Innoviz Technologies, 2017 - 2020',
  '- Results: trade-off analysis behind a 90% (10x) unit-cost reduction; ~3,400 of 3,600 requirements verified.',
  'Electro-Optics Team Leader, Meprolight, 2010 - 2014',
  '- Results: one end-of-line test line carries 500-unit premium runs and a 20,000 units/week product.',
  'M.Sc. Electrical Engineering, Tel Aviv University, 2007 - 2010; thesis grade 93.',
  'Languages: Danish upper-intermediate, English fluent, Spanish professional, Hebrew native.',
].join('\n');

const JD = 'Veo cameras are used by clubs in 120+ countries. You will own Capex/Opex budgets and DFM/DFA for mass production.';

test('the ledger carries every number of the source', () => {
  const fr = buildFractures({ source_cv: SOURCE, jd_text: JD });
  for (const v of ['400', '250', '10', '8', '90', '3400', '3600', '500', '20000', '93']) {
    assert.ok(fr.ledger.has(v), 'ledger has ' + v);
  }
  assert.ok(fr.counts.facts >= 9);
  assert.ok(fr.external.has('120'), 'the job-ad figure is external');
  assert.ok(fr.entities.some(e => /Tel Aviv University/.test(e)));
});

test('the supervisor view keeps every fact but in another order than the prose', () => {
  const fr = buildFractures({ source_cv: SOURCE });
  const view = viewFor('supervisor', fr, 'cv_profile:120');
  for (const f of fr.facts) assert.ok(view.includes(f.text), 'fact kept: ' + f.id);
  const order = fr.facts.map(f => view.indexOf('[' + f.id + '/'));
  const sorted = order.slice().sort((a, b) => a - b);
  assert.notDeepEqual(order, sorted, 'the shuffled order differs from the prose order');
  assert.ok(view.includes('METRIC LEDGER'));
  // the same seed gives the same order (a re-check reads what it read before)
  assert.equal(view, viewFor('supervisor', fr, 'cv_profile:120'));
  // another section reads another order
  assert.notEqual(view, viewFor('supervisor', fr, 'cv_outcomes:300'));
});

test('the coherence view groups facts by kind and the writer view is empty', () => {
  const fr = buildFractures({ source_cv: SOURCE, jd_text: JD });
  const view = viewFor('coherence', fr);
  assert.ok(view.includes('## result'));
  assert.ok(view.includes('## education'));
  assert.ok(view.includes('METRIC LEDGER'));
  assert.ok(view.includes('JOB-AD / COMPANY NUMBERS'));
  assert.equal(viewFor('writer', fr), '');
});

test('numberGrounding flags a number no source line carries', () => {
  const fr = buildFractures({ source_cv: SOURCE, jd_text: JD });
  const out = 'I cut late-stage rework by 95% and verified ~3,400 requirements for clubs in 120+ countries, with three evidence paragraphs.';
  const dev = numberGrounding(out, fr);
  const unbacked = dev.filter(d => d.type === 'metric_unbacked');
  const external = dev.filter(d => d.type === 'metric_external');
  assert.equal(unbacked.length, 1, 'one fabricated number');
  assert.match(unbacked[0].evidence, /95%/);
  assert.equal(unbacked[0].severity, 'high');
  assert.equal(external.length, 1, 'the job-ad figure is tagged external, not fabricated');
  assert.match(external[0].evidence, /120\+/);
  assert.ok(!dev.some(d => /Number "~3,400"/.test(d.evidence)), 'a source number passes');
});

test('numberGrounding skips years and small prose counts', () => {
  const fr = buildFractures({ source_cv: SOURCE });
  const dev = numberGrounding('Since 2010 I have run two teams across three sites, 2017 - 2020 as architect.', fr);
  assert.deepEqual(dev, []);
});

test('atomize splits bullets and long multi-sentence lines; the shuffle is a permutation', () => {
  const facts = atomize('- a first fact.\n- a second fact.\n' + 'A long line. '.repeat(20));
  assert.ok(facts.length >= 3);
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const s = seededShuffle(a, 'x');
  assert.deepEqual(s.slice().sort((p, q) => p - q), a);
  assert.deepEqual(s, seededShuffle(a, 'x'));
  assert.equal(extractNumbers('20 MP camera and 50% fewer rejects').length, 2);
});

test('supervisor endpoint merges metric deviations and reports fracture counts', async () => {
  const { handleSupervisorCheck } = await import('../src/supervisor.js');
  const req = new Request('https://x/api/supervisor/check', {
    method: 'POST',
    body: JSON.stringify({
      task: 'cv_profile',
      candidate_output: 'I am a hardware leader who cut rework by 95% and took 3,400 requirements to sign-off.',
      source_cv: SOURCE,
      jd_text: JD,
    }),
  });
  // no provider keys -> the grounding cascade fails soft; the deterministic
  // check still runs and its high-severity finding fails the output.
  const res = await handleSupervisorCheck(req, {}, () => ({}));
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.equal(j.passed, false);
  assert.ok(j.deviations.some(d => d.type === 'metric_unbacked' && /95%/.test(d.evidence)));
  assert.equal(j.fractures.metric_unbacked, 1);
  assert.ok(j.fractures.facts >= 9);
  assert.match(j.repair_prompt, /95%/);
});

test('proxy and demo-proxy copies of the fractures wiring are byte-identical', () => {
  for (const f of ['source-fractures.js', 'supervisor.js', 'gen-coherence.js']) {
    const a = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    const b = readFileSync(new URL('../../demo-proxy/src/' + f, import.meta.url), 'utf8');
    assert.equal(a, b, f + ' drifted between proxy and demo-proxy');
  }
});
