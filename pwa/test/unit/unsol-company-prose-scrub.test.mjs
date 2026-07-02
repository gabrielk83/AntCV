// GEN-UNSOL-STALE-JD-001 Patch D — when the unsolicited-identity guard forces a
// contaminated app back to "Unsolicited", it also strips the prior company out of the
// CL body prose (the "unsolicited application went all Terma" class), CL only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-unsolicited-identity-guard.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
}
function load(backing) {
  const localStorage = mockStorage(backing);
  const win = {
    localStorage, addEventListener() {}, dispatchEvent() {},
    requestAnimationFrame: (fn) => { fn(); return 0; },
  };
  const sandbox = {
    window: win, localStorage, JSON, console, RegExp, Object, String, Array,
    document: { activeElement: null },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    StorageEvent: function () {}, CustomEvent: function () {},
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win.AntcvUnsolicitedIdentityGuard;
}

test('companyBase strips legal suffixes to a distinctive token', () => {
  const G = load(new Map());
  assert.equal(G._companyBase('Terma A/S'), 'Terma');
  assert.equal(G._companyBase('Innoviz Technologies'), 'Innoviz');
  assert.equal(G._companyBase('NVIDIA'), 'NVIDIA');
  assert.equal(G._companyBase('Co'), '');           // too short after stripping
});

test('neutralizeCompany removes the full name + base token, possessive-aware', () => {
  const G = load(new Map());
  const co = 'Terma A/S';
  assert.equal(G._neutralizeCompany("Terma A/S is a leader.", co), 'your organisation is a leader.');
  assert.equal(G._neutralizeCompany("Terma’s systems underpin defence.", co), "your organisation's systems underpin defence.");
  assert.equal(G._neutralizeCompany("I admire Terma and its work.", co), 'I admire your organisation and its work.');
  // an unrelated word starting the same is not touched (word boundary)
  assert.equal(G._neutralizeCompany('Terminal velocity.', co), 'Terminal velocity.');
});

test('apply() forces Unsolicited AND scrubs the company from CL prose', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Terma A/S', role: 'Senior Engineer', subtitle: 'Optics', greeting: 'Dear Hiring Manager,', opening: 'x' }));
  backing.set('antcv:lastJdText', '');   // unsolicited context (no real JD)
  backing.set('sections', JSON.stringify({ cv: [{ id: 'exp', type: 'experience', roles: [] }], cl: [
    { id: 'opening', type: 'text', content: "Terma’s electro-optical systems underpin defence programmes." },
    { id: 'why', type: 'rich_block', items: [{ b: 'Why this company', t: 'I want to help Terma A/S grow.' }] },
  ] }));
  backing.set('antcv:clProseGuard', JSON.stringify({
    'Unsolicited|Open Application': { opening: { id: 'opening', content: 'Terma stuff' } },
    'Terma A/S|Senior Engineer': { opening: { id: 'opening', content: 'legit Terma targeted prose' } },
  }));

  const G = load(backing);
  G._apply();

  const meta = JSON.parse(backing.get('meta'));
  assert.equal(meta.company, 'Unsolicited');
  assert.equal(meta.role, 'Open Application');

  const secs = JSON.parse(backing.get('sections'));
  const opening = secs.cl.find((s) => s.id === 'opening');
  const why = secs.cl.find((s) => s.id === 'why');
  assert.ok(!/terma/i.test(opening.content), 'company scrubbed from opening');
  assert.match(opening.content, /your organisation's electro-optical/i);
  assert.ok(!/terma/i.test(why.items[0].t), 'company scrubbed from why body');
  // the CV is untouched; the LEGIT targeted prose-guard bucket is preserved
  const store = JSON.parse(backing.get('antcv:clProseGuard'));
  assert.equal(store['Unsolicited|Open Application'], undefined, 'poisoned bucket purged');
  assert.ok(store['Terma A/S|Senior Engineer'], 'legit targeted bucket kept');
});

test('apply() is a no-op when a REAL JD is attached (targeted app untouched)', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Terma A/S', role: 'Senior Engineer' }));
  backing.set('antcv:lastJdText', 'A real job description that is clearly long enough to count as specific.');
  backing.set('sections', JSON.stringify({ cv: [], cl: [{ id: 'opening', type: 'text', content: 'Terma is great.' }] }));
  const G = load(backing);
  G._apply();
  assert.equal(JSON.parse(backing.get('meta')).company, 'Terma A/S', 'targeted identity kept');
  assert.match(JSON.parse(backing.get('sections')).cl[0].content, /Terma/, 'targeted prose kept');
});
