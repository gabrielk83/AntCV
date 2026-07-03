// cl-hydrate-export-gate.test.mjs
// ============================================================
// CL-HYDRATE-EXPORT-GATE-001 (register row 29 leg B, 1.51.124): a fast export
// used to race the prose-loss guard's async heal and ship literal template
// placeholders ("Dear [Hiring Team / Name],"). buildPayload now hydrates
// placeholder CL sections from the guard's bucket snapshot (right shape) or
// the meta strings — placeholder←real only, inside the payload itself
// (exports build from React state; a storage heal can't fix the payload).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const APP_KEY = 'Trackman A/S|Project Manager, Hardware';
const store = new Map();
store.set('outcomesMode', JSON.stringify('results'));
store.set('personalInfo', JSON.stringify({}));
store.set('meta', JSON.stringify({ company: 'Trackman A/S', role: 'Project Manager, Hardware' }));
store.set('antcv:clProseGuard', JSON.stringify({
  [APP_KEY]: {
    why: { id: 'why', type: 'rich_block', loc: 'body', headlineOff: true,
      items: [{ b: 'Why this company and role', t: 'Trackman builds modular tracking hardware and that matches my platform work.' }] },
  },
}));
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { buildPayload } = await import('../../antcv-docx-client.js');

const META = {
  company: 'Trackman A/S', role: 'Project Manager, Hardware',
  greeting: 'Dear Hiring Team,',
  opening: 'Trackman’s modular hardware platform is exactly the engineering problem I want to work on.',
};

function clPayload(cl) {
  return buildPayload({ sections: { cv: [], cl }, doc: 'cl', personalInfo: { name: 'Gabriel' }, meta: META });
}

test('placeholder opening/greeting hydrate from meta; placeholder why hydrates from the guard bucket', () => {
  const p = clPayload([
    { id: 'greeting', type: 'text', loc: 'body', on: true, content: 'Dear [Hiring Team / Name],' },
    { id: 'opening', type: 'rich_block', loc: 'body', on: true, headlineOff: true,
      items: [{ b: '', t: 'I am applying for [Role title] at [Company], where I can contribute to [main JD need 1].' }] },
    { id: 'why', type: 'rich_block', loc: 'body', on: true, headlineOff: true,
      items: [{ b: 'Why this company and role', t: 'Working at [Company] would let me [reason].' }] },
  ]);
  // NBSP orphan-glue may bind gaps downstream — normalize before comparing
  const deNbsp = (t) => String(t).split(String.fromCharCode(160)).join(' ');
  const byId = (id) => p.sections.find((s) => s.id === id);
  assert.equal(deNbsp(byId('greeting').content), 'Dear Hiring Team,', 'greeting hydrated from meta');
  assert.match(deNbsp(byId('opening').items[0].t), /modular hardware platform/, 'opening hydrated from meta');
  assert.match(deNbsp(byId('why').items[0].t), /matches my platform work/, 'why hydrated from the guard bucket snapshot');
});

test('REAL prose is never replaced; unguarded ids untouched', () => {
  const real = 'Trackman builds real products and my validation background fits directly.';
  const p = clPayload([
    { id: 'opening', type: 'rich_block', loc: 'body', on: true, headlineOff: true, items: [{ b: '', t: real }] },
    { id: 'application_qa', type: 'rich_block', loc: 'body', on: true, items: [{ b: 'Q', t: 'Answer with a [verify] flag stays as-is.' }] },
  ]);
  assert.match(p.sections.find((s) => s.id === 'opening').items[0].t.split(String.fromCharCode(160)).join(' '), /real products and my validation/);
  assert.match(p.sections.find((s) => s.id === 'application_qa').items[0].t, /\[verify\]/, 'unguarded QA section untouched');
});

test('no real source available: the placeholder stays (never fabricate); kill switch honored', () => {
  const p = clPayload([
    { id: 'who', type: 'rich_block', loc: 'body', on: true, headlineOff: true,
      items: [{ b: 'Who I am', t: 'I am a [profession] with [X] years.' }] },
  ]);
  assert.match(p.sections.find((s) => s.id === 'who').items[0].t, /\[profession\]/, 'no meta.who + no bucket snapshot -> unchanged');

  store.set('antcv:disable-cl-hydrate-gate', '1');
  const killed = clPayload([
    { id: 'greeting', type: 'text', loc: 'body', on: true, content: 'Dear [Hiring Team / Name],' },
  ]);
  assert.match(killed.sections.find((s) => s.id === 'greeting').content, /\[Hiring Team/, 'kill switch: no hydration');
  store.delete('antcv:disable-cl-hydrate-gate');
});
