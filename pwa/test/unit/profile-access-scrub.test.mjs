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

// COMMS-LINE-001 (owner 2026-11-01, supersedes ACCESS-MIDDLE-001): no disability
// label on Gabriel's CV; the row is COMMUNICATION and says what works.
const LINE_EN = 'English and Danish at work; live captions and written follow-ups in meetings.';
const GAB = 'Gabriel Alexander Karp-Gershon';
function runWith(cv, name, lang) {
  const backing = new Map();
  backing.set('personalInfo', JSON.stringify({ name }));
  if (lang) backing.set('language', lang);
  backing.set('sections', JSON.stringify({ cv, cl: [] }));
  const G = load(backing);
  G.run();
  return { out: JSON.parse(backing.get('sections')).cv, G, backing };
}

test('COMMS-LINE-001: accessibility section becomes COMMUNICATION with the canonical line (any stored length)', () => {
  for (const v of [
    'Hearing impaired.',
    'Hearing impaired (cochlear implant); written follow-up works well.',
    'Hearing impaired; live-transcription glasses caption and translate speech, and clear spoken communication with written follow-ups works well.',
  ]) {
    const { out } = runWith([{ id: 'accessibility', title: 'ACCESSIBILITY', type: 'labeled_list', items: [{ l: '', v, labelHidden: true }] }], GAB);
    assert.equal(out[0].id, 'accessibility', 'plumbing id kept');
    assert.equal(out[0].title, 'COMMUNICATION');
    assert.equal(out[0].items[0].v, LINE_EN);
    assert.doesNotMatch(JSON.stringify(out), /hearing|cochlear|impair/i);
  }
  const { out: t } = runWith([{ id: 'accessibility', title: 'ACCESSIBILITY', type: 'text', content: 'Hearing impaired.' }], GAB);
  assert.equal(t[0].content, LINE_EN);
  assert.equal(t[0].title, 'COMMUNICATION');
});

test('COMMS-LINE-001: Danish output gets the Danish line and title; ADDITIONAL row relabelled', () => {
  const { out } = runWith([
    { id: 'accessibility', title: 'TILGÆNGELIGHED', type: 'text', content: 'Hørehæmmet.' },
    { id: 'additional', type: 'labeled_list', items: [{ group: 'Accessibility' }, { l: 'Accessibility', v: 'Hearing impaired; captions help.' }, { l: 'Rugby', v: 'Copenhagen Wolves RFC' }] },
  ], GAB, 'da');
  assert.equal(out[0].title, 'KOMMUNIKATION');
  assert.equal(out[0].content, 'Engelsk og dansk i arbejdet; liveundertekster og skriftlig opfølgning i møder.');
  assert.equal(out[1].items[0].group, 'Kommunikation');
  assert.equal(out[1].items[1].l, 'Kommunikation');
  assert.equal(out[1].items[2].v, 'Copenhagen Wolves RFC', 'other rows untouched');
});

test('COMMS-LINE-001: idempotent and name-guarded', () => {
  const { G, backing } = runWith([{ id: 'accessibility', type: 'text', content: 'Hearing impaired.' }], GAB);
  const after = backing.get('sections');
  G.run();
  assert.equal(backing.get('sections'), after, 'second run writes nothing');
  const { out } = runWith([{ id: 'accessibility', type: 'text', content: 'Hearing impaired.' }], 'Anita Ant');
  assert.equal(out[0].content, 'Hearing impaired.', 'other personas untouched');
});

// COMMS-LINE-002 (owner 2026-11-05): rows that carry the COMMS-LINE-001 sentence move to the
// shorter line, in the accessibility section and in an ADDITIONAL row already labelled Communication.
test('COMMS-LINE-002: the COMMS-LINE-001 sentence is rewritten to the new line', () => {
  const OLD = 'I work in English and Danish and follow meetings best with live captions and written follow-ups.';
  const { out } = runWith([
    { id: 'accessibility', title: 'COMMUNICATION', type: 'labeled_list', items: [{ l: '', v: OLD, labelHidden: true }] },
    { id: 'additional', type: 'labeled_list', items: [{ l: 'Communication', v: OLD }] },
  ], GAB);
  assert.equal(out[0].items[0].v, 'English and Danish at work; live captions and written follow-ups in meetings.');
  assert.equal(out[1].items[0].v, out[0].items[0].v);
  const { out: da } = runWith([
    { id: 'additional', type: 'labeled_list', items: [{ l: 'Kommunikation', v: 'Jeg arbejder på engelsk og dansk og følger møder bedst med liveundertekster og skriftlig opfølgning.' }] },
  ], GAB, 'da');
  assert.equal(da[0].items[0].v, 'Engelsk og dansk i arbejdet; liveundertekster og skriftlig opfølgning i møder.');
});
