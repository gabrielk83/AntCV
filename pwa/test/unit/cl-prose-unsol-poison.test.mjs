// CL-PROSE-UNSOL-POISON-001 — the CL-prose-loss guard must NOT snapshot or re-apply
// prose for an UNSOLICITED application (that is how a prior company's CL body poisoned
// the "Unsolicited|<role>" bucket and made an unsolicited letter "go all Terma").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-cl-prose-loss-guard-985.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
    key: (i) => { const ks = [...backing.keys()]; return i < ks.length ? ks[i] : null; },
    get length() { return backing.size; },
  };
}
function load(backing) {
  const localStorage = mockStorage(backing);
  const win = {
    localStorage, addEventListener() {}, dispatchEvent() {},
    performance: { now: () => 0 },
  };
  const sandbox = {
    window: win, localStorage, JSON, console, performance: { now: () => 0 },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    CustomEvent: function () {}, Object, String, Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win.AntcvClProseGuard;
}

const realSection = { id: 'opening', type: 'text', content: "Company X's systems are great and I want to help." };
const placeholderSection = { id: 'opening', type: 'text', content: '[Opening]' };

test('snapshot() is a NO-OP for an unsolicited application', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [realSection] }));
  const G = load(backing);
  G.snapshot();
  assert.equal(backing.get('antcv:clProseGuard'), undefined, 'no bucket written for unsolicited');
});

test('snapshot() DOES capture for a real targeted company', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Terma A/S', role: 'Senior Engineer' }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [realSection] }));
  const G = load(backing);
  G.snapshot();
  const store = JSON.parse(backing.get('antcv:clProseGuard') || '{}');
  assert.ok(store['Terma A/S|Senior Engineer'], 'targeted bucket captured');
});

test('reapply() does NOT inject a poisoned bucket into an unsolicited app', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
  // a poisoned bucket (as if captured earlier) + a live placeholder that would be healed
  backing.set('antcv:clProseGuard', JSON.stringify({
    'Unsolicited|Open Application': { opening: realSection },
  }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [placeholderSection] }));
  const G = load(backing);
  G.reapply();
  const secs = JSON.parse(backing.get('sections'));
  assert.equal(secs.cl[0].content, '[Opening]', 'placeholder NOT overwritten with poisoned prose');
});

test('reapply() still heals a placeholder for a real targeted app', () => {
  const backing = new Map();
  backing.set('meta', JSON.stringify({ company: 'Terma A/S', role: 'Senior Engineer' }));
  backing.set('antcv:clProseGuard', JSON.stringify({
    'Terma A/S|Senior Engineer': { opening: realSection },
  }));
  backing.set('sections', JSON.stringify({ cv: [], cl: [placeholderSection] }));
  const G = load(backing);
  G.reapply();
  const secs = JSON.parse(backing.get('sections'));
  assert.match(secs.cl[0].content, /Company X/, 'targeted placeholder healed from snapshot');
});
