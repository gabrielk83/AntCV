// unsol-company-scrub.test.mjs
// ============================================================
// GEN-UNSOL-STALE-JD-001 Patch D: when the application is unsolicited
// (meta.company empty or "Unsolicited") and a PRIOR targeted company name is
// still known (antcv:activeAppCompany), scrub that name from the generated
// prose — but NEVER when the name is one of the candidate's own employers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-unsol-company-scrub.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const events = [];
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent(e) { events.push(e && e.detail && e.detail.reason); return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout() { return 0; },
    console: { log() {}, warn() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvUnsolCompanyScrub, store, events };
}

const POISONED = {
  cv: [
    { id: 'profile', type: 'text', loc: 'main', content: 'Product expert ready to support Terma programmes end to end.' },
    { id: 'experience', type: 'experience', loc: 'main', roles: [
      { title: 'Change Request Lead', company: 'Innoviz Technologies', bullets: ['Own change governance for automotive LiDAR at Innoviz Technologies.'], results: 'Cut the change cycle.' },
    ] },
  ],
  cl: [
    { id: 'why', type: 'rich_block', loc: 'body', items: [
      { b: 'Why this company:', t: 'Terma builds radar systems; my background in Terma-adjacent validation fits.' },
    ] },
  ],
};

const baseStore = (company, prior) => ({
  meta: JSON.stringify({ company, role: 'Open Application' }),
  'antcv:activeAppCompany': prior,
  personalInfo: JSON.stringify({ workHistory: [{ company: 'Innoviz Technologies' }, { company: 'Kanzen Konsulenter ApS' }] }),
  sections: JSON.stringify(POISONED),
});

test('unsolicited + prior non-employer company: prose scrubbed in CV and CL, employers untouched', () => {
  const { api, store, events } = load(baseStore('Unsolicited', 'Terma'));
  api.run();
  const secs = JSON.parse(store.get('sections'));
  assert.doesNotMatch(secs.cv[0].content, /Terma/);
  assert.match(secs.cv[0].content, /your organisation/);
  assert.doesNotMatch(secs.cl[0].items[0].t, /Terma/);
  assert.match(secs.cv[1].roles[0].bullets[0], /Innoviz Technologies/, 'employer mention untouched');
  assert.ok(events.includes('unsol-company-scrub'));
});

test('empty meta.company (the Patch D trigger case) also scrubs', () => {
  const { api, store } = load(baseStore('', 'Terma'));
  api.run();
  assert.doesNotMatch(JSON.parse(store.get('sections')).cv[0].content, /Terma/);
});

test('TARGETED application (meta.company real): no scrub', () => {
  const { api, store } = load(baseStore('Terma', 'Terma'));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});

test('prior company IS an employer: never scrubbed (real CV facts protected)', () => {
  const { api, store } = load(baseStore('Unsolicited', 'Innoviz Technologies'));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});

test('no prior company known: no-op; kill switch honored', () => {
  const s1 = baseStore('Unsolicited', '');
  const { api: a1, store: st1 } = load(s1);
  const b1 = st1.get('sections');
  a1.run();
  assert.equal(st1.get('sections'), b1);
  const s2 = baseStore('Unsolicited', 'Terma');
  s2['antcv:disable-unsol-company-scrub'] = '1';
  const { api: a2, store: st2 } = load(s2);
  const b2 = st2.get('sections');
  a2.run();
  assert.equal(st2.get('sections'), b2);
});

test('idempotent: a second run after scrubbing changes nothing', () => {
  const { api, store } = load(baseStore('Unsolicited', 'Terma'));
  api.run();
  const after = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), after);
});
