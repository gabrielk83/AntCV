// BABEL-RICHBLOCK-RESIDUE-CONVERGE-001 — the Latin lead-in residue drop in
// antcv-sections-normalize-415.js is re-enabled, and must converge.
//
// History: the drop shipped 2026-07-11 and was DISABLED the same day — on a zh/he/ar
// ribbon it removed a stored English "Foundation: …" row from a rich_block, a legacy
// re-adder (foundation-758 pre-345 caches, shape-guard eager writes, languageCache
// echoes) put it straight back, and the pair cycled about every 5s: "preview jumpy /
// edit closes". The re-adder inventory was never completed — and a NEW re-adder would
// reopen it anyway — so the drop is now remover-agnostic: a sticky one-shot decision
// keyed on the content that SURVIVES the drop, plus the per-section write guard.
//
// Same shim as antcv-sections-normalize-415.storm.test.mjs, including the FAKE CLOCK:
// the live poll is 2.5s, so a synchronous loop would hide the very re-arming that
// defeated the previous time-windowed guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'antcv-sections-normalize-415.js'), 'utf8');

function loadSidecar() {
  const store = new Map();
  const writes = { belt: 0, readder: 0 };
  const ctx = { writer: 'belt' };
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { if (k === 'sections') writes[ctx.writer]++; store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const listeners = new Map();
  const window = {
    addEventListener: (t, fn) => { listeners.set(t, (listeners.get(t) || []).concat(fn)); },
    removeEventListener: () => {},
    dispatchEvent: (ev) => { (listeners.get(ev.type) || []).forEach((fn) => fn(ev)); return true; },
  };
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = (init || {}).detail; } }
  const noop = () => 0;
  const quiet = { log: noop, info: noop, warn: noop, error: noop, debug: noop };
  const fetchStub = () => ({ then: () => ({ then: () => ({ catch: () => {} }) }) });
  const clock = { t: 1_700_000_000_000 };
  function FakeDate() { return new Date(clock.t); }
  FakeDate.now = () => clock.t;
  FakeDate.prototype = Date.prototype;

  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'document', 'console', 'CustomEvent', 'fetch',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date', SRC)(
    window, localStorage, { activeElement: null }, quiet, CustomEvent, fetchStub, noop, noop, noop, noop, FakeDate);

  return { window, localStorage, clock, writes, ctx };
}

// A zh cover letter whose rich_block carries BOTH the zh lead-in row and the leftover
// English twin — the owner's 2026-07-11 screenshot ("Foundation: I connect what I do
// best…" inside an otherwise-zh CL).
const RESIDUE = { b: 'Foundation', t: 'I connect what I do best with what the team needs.' };
const ZH_TWIN = { b: '基础', t: '我把最擅长的事与团队所需连接起来。' };

function seed(localStorage) {
  localStorage.setItem('language', '"zh"');
  localStorage.setItem('meta', JSON.stringify({ company: 'Ibsen Photonics', role: 'Optical Engineer' }));
  localStorage.setItem('personalInfo', JSON.stringify({ experience: [] }));
  localStorage.setItem('sections', JSON.stringify({
    cv: [{ id: 'tools', type: 'labeled_list', title: '工具与方法', on: true, items: [{ label: '光学', text: 'lidar' }] }],
    cl: [{ id: 'why', type: 'rich_block', title: '为什么', on: true, items: [ZH_TWIN, RESIDUE] }],
  }));
}

const clItems = (localStorage) => JSON.parse(localStorage.getItem('sections')).cl[0].items;
const hasResidue = (localStorage) => clItems(localStorage).some((i) => i.b === 'Foundation');

// The legacy re-adder, reproduced: it puts the English row back and churns an unrelated
// field, so the whole-blob write guard can never match.
function installReadder(env) {
  const { window, localStorage, ctx } = env;
  let cycles = 0;
  let live = true;
  window.addEventListener('antcv:sections-updated', () => {
    if (!live) return;
    const prev = ctx.writer;
    ctx.writer = 'readder';
    try {
      const b = JSON.parse(localStorage.getItem('sections'));
      const blk = b.cl[0];
      if (!blk.items.some((i) => i.b === 'Foundation')) blk.items.push({ ...RESIDUE });
      b.cv[0].items[0].text = 'lidar ' + (++cycles);            // parallel churn
      localStorage.setItem('sections', JSON.stringify(b));
    } finally { ctx.writer = prev; }
  });
  return { cycles: () => cycles, stop: () => { live = false; } };
}

const POLL_MS = 2500;
function drivePasses(env, n) {
  const start = env.writes.belt;
  for (let i = 0; i < n; i++) {
    env.clock.t += POLL_MS;
    env.window.AntcvSectionsNormalize._normalize();
  }
  return env.writes.belt - start;
}

// ----------------------------------------------------------------------- tests
test('the residue drop is ENABLED again: a Latin lead-in twin is removed on a zh ribbon', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  env.window.AntcvSectionsNormalize._normalize();
  const items = clItems(env.localStorage);
  assert.equal(items.length, 1, 'the English twin is gone');
  assert.equal(items[0].b, ZH_TWIN.b, 'the zh row survives');
});

test('a Latin ribbon is untouched (the drop is wide-script only)', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  env.localStorage.setItem('language', '"en"');
  env.window.AntcvSectionsNormalize._normalize();
  assert.ok(hasResidue(env.localStorage), 'no drop on an en ribbon');
});

test('the kill switch disables it', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  env.localStorage.setItem('antcv:disable-richblock-residue-drop', '1');
  env.window.AntcvSectionsNormalize._normalize();
  assert.ok(hasResidue(env.localStorage), 'kill switch respected');
});

test('a legacy re-adder + parallel churn does NOT sustain a write storm', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  const readder = installReadder(env);
  const writes = drivePasses(env, 20);
  // This is what got the pass disabled on 2026-07-11: one cycle every ~5s forever,
  // unmounting the editor mid-edit. The belt must stand down once it has proof.
  assert.ok(writes <= 2, `415 kept re-dropping every pass (${writes}/20 wrote, re-adder ran ${readder.cycles()}x)`);
});

test('after standing down, a genuine content change re-arms the drop', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  const readder = installReadder(env);
  drivePasses(env, 10);
  assert.ok(hasResidue(env.localStorage), 'precondition: the re-adder won and the belt stood down');
  readder.stop();

  // A translate pass rewrites the zh row: the surviving content changed, so this is a
  // real change rather than the churn, and the drop must fire again.
  const b = JSON.parse(env.localStorage.getItem('sections'));
  b.cl[0].items = b.cl[0].items.map((i) => (i.b === ZH_TWIN.b ? { ...i, t: '我把最擅长的事与团队的需要连接起来。' } : i));
  env.localStorage.setItem('sections', JSON.stringify(b));

  env.window.AntcvSectionsNormalize._normalize();
  assert.ok(!hasResidue(env.localStorage), 'the drop re-armed on a genuine change');
});
