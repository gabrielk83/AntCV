// PROFILE-ACCESS-SCRUB-001 (spec rules 20+22) — enforcement belt for three
// gen-prompt rules the model violated in the owner's NIL round-4 export:
// PROFILE-NO-FILLER-001, PROFILE-NO-DISABILITY-001, ACCESS-NO-COMMENT-001.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-profile-access-scrub.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
}
function load(backing) {
  const localStorage = mockStorage(backing);
  const win = { localStorage, addEventListener() {}, dispatchEvent() {} };
  const sandbox = {
    window: win, localStorage, JSON, console, Object, String, Array, RegExp,
    setTimeout: () => 0, clearTimeout: () => {}, CustomEvent: function () {},
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win.AntcvProfileAccessScrub;
}

const OWNER_PROFILE =
  'IT professional with 15+ years across commercial and regulated markets. ' +
  'Has worked with people from many backgrounds; hearing impaired, which has not limited his career. ' +
  'Builds the relationships that make hard changes land.';

test('the exact owner round-4 profile sentence is dropped, the rest survives', () => {
  const backing = new Map();
  backing.set('sections', JSON.stringify({
    cv: [{ id: 'profile', type: 'text', loc: 'main', content: OWNER_PROFILE }],
    cl: [],
  }));
  const G = load(backing);
  G.run();
  const p = JSON.parse(backing.get('sections')).cv[0].content;
  assert.doesNotMatch(p, /hearing|not limited|many backgrounds/i);
  assert.match(p, /15\+ years/);
  assert.match(p, /relationships that make hard changes land/);
});

test('career-comment CLAUSE is stripped from an accessibility row, facts stay', () => {
  const backing = new Map();
  backing.set('sections', JSON.stringify({
    cv: [{ id: 'additional', type: 'labeled_list', loc: 'sidebar', items: [
      { l: 'Accessibility', v: 'Hearing impaired; cochlear implant and hearing aid, which has not limited his career. Captions and written follow-up help.' },
    ] }],
    cl: [],
  }));
  const G = load(backing);
  G.run();
  const v = JSON.parse(backing.get('sections')).cv[0].items[0].v;
  assert.doesNotMatch(v, /not limited/i);
  assert.match(v, /cochlear implant/i, 'the factual accommodation stays');
  assert.match(v, /Captions and written follow-up help/);
});

test('all-offending profile: sentence pass aborts (never near-empty), but the banned career clause still strips', () => {
  // Layering: scrubProfile refuses to reduce the profile below 20 chars (a
  // profile of only banned content is a failed generation — regen's job), but
  // the GLOBAL clause strip still removes the banned career comment. Keeping
  // "Hearing impaired." (a rule-22 leftover for regen) beats keeping the
  // ACCESS-NO-COMMENT-banned "which has not limited his career".
  const backing = new Map();
  const content = 'Hearing impaired, which has not limited his career.';
  backing.set('sections', JSON.stringify({ cv: [{ id: 'profile', type: 'text', content }], cl: [] }));
  const G = load(backing);
  G.run();
  const p = JSON.parse(backing.get('sections')).cv[0].content;
  assert.equal(p, 'Hearing impaired.', 'career clause stripped, factual stub left for regen');
  assert.doesNotMatch(p, /not limited/i);
});

test('clean sections: no write; kill switch honored', () => {
  const b1 = new Map();
  b1.set('sections', JSON.stringify({ cv: [{ id: 'profile', type: 'text', content: 'Clean profile with substance and depth.' }], cl: [] }));
  const g1 = load(b1);
  const before = b1.get('sections');
  g1.run();
  assert.equal(b1.get('sections'), before);

  const b2 = new Map();
  b2.set('antcv:disable-profile-access-scrub', '1');
  b2.set('sections', JSON.stringify({ cv: [{ id: 'profile', type: 'text', content: OWNER_PROFILE }], cl: [] }));
  const g2 = load(b2);
  const before2 = b2.get('sections');
  g2.run();
  assert.equal(b2.get('sections'), before2);
});

test('idempotent: second run changes nothing', () => {
  const backing = new Map();
  backing.set('sections', JSON.stringify({ cv: [{ id: 'profile', type: 'text', content: OWNER_PROFILE }], cl: [] }));
  const G = load(backing);
  G.run();
  const after = backing.get('sections');
  G.run();
  assert.equal(backing.get('sections'), after);
});

test('rich_block profile (items[].t — the live NIL row shape) is scrubbed too', () => {
  const backing = new Map();
  const t =
    'IT professional with 15+ years across commercial and regulated markets. ' +
    'Builds the relationships that make hard changes land. ' +
    'Has worked with people from many backgrounds; hearing impaired.';
  backing.set('sections', JSON.stringify({
    cv: [{ id: 'profile', type: 'rich_block', items: [{ b: '', t }] }],
    cl: [],
  }));
  const G = load(backing);
  G.run();
  const out = JSON.parse(backing.get('sections')).cv[0].items[0].t;
  assert.doesNotMatch(out, /many backgrounds|hearing impaired/i);
  assert.match(out, /IT professional with 15\+ years/);
  assert.match(out, /hard changes land/);
});

// ACCESS-MIDDLE-001 (spec rule 34): canonicalise BOTH extremes to the owner's
// middle-ground one-liner — name-guarded to Gabriel.
test('ACCESS-MIDDLE-001: too-short and too-long accessibility rows canonicalise; middle stays; non-Gabriel untouched', () => {
  const CANON = 'Hearing impaired (cochlear implant); written follow-up works well.';
  const mk = (v, name) => {
    const backing = new Map();
    backing.set('personalInfo', JSON.stringify({ name }));
    backing.set('sections', JSON.stringify({ cv: [{ id: 'accessibility', type: 'labeled_list', items: [{ l: '', v, labelHidden: true }] }], cl: [] }));
    const G = load(backing);
    G.run();
    return JSON.parse(backing.get('sections')).cv[0].items[0].v;
  };
  assert.equal(mk('Hearing impaired.', 'Gabriel Alexander Karp-Gershon'), CANON, 'too short -> canon');
  assert.equal(mk('Hearing impaired; cochlear implant and hearing aid. Structured communication tools work well; captions, transcripts and written follow-up help', 'Gabriel Alexander Karp-Gershon'), CANON, 'too long -> canon');
  assert.equal(mk(CANON, 'Gabriel Alexander Karp-Gershon'), CANON, 'canon is stable');
  assert.equal(mk('Hearing impaired.', 'Anita Demo'), 'Hearing impaired.', 'non-Gabriel persona untouched');
});
