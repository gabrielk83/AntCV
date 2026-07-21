// ROLES-STORM-CONVERGE-001 — convergence tests for the experience-completeness
// belt in antcv-sections-normalize-415.js.
//
// Live symptom (owner 2026-07-21, antcv.pages.dev 1.51.1792, Ibsen Photonics app,
// at rest): `sections` written ~40x / 31s forever, console looping
//    [415] experience-completeness restored 3 missing role(s) hidden
//    [sections-normalize-415] re-applied normalisers ... after restore
// repairExperienceCompleteness re-adds the SAME roles every pass and a competing
// writer strips them right back out. Neither existing guard converged:
//   - the add-side __complRepeat counter is time-windowed (6s) and RESETS on the
//     pass where nothing is missing, so a strict add/remove alternation re-arms it;
//   - the write-side __recentWrites guard hashes the WHOLE serialised blob, so a
//     PARALLEL writer (translation/babel residue pass) that touches any unrelated
//     byte each cycle means the hash never repeats and the guard never fires.
//
// These tests drive the real sidecar in a Node shim against a competing remover
// that also churns an unrelated field, i.e. exactly the live shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC_PATH = join(dirname(fileURLToPath(import.meta.url)), 'antcv-sections-normalize-415.js');
const SRC = readFileSync(SRC_PATH, 'utf8');

// ---------------------------------------------------------------- environment
// Loads the sidecar with shimmed browser globals. Timers are stubs — the boot
// sweep + 2.5s poll never fire; the test drives _normalize() itself and advances
// a FAKE CLOCK between passes. The clock matters: the live poll is 2.5s apart, so
// any guard keyed on a short time window (the old 6s __complRepeat counter) re-arms
// between passes. A synchronous test loop would hide exactly the bug we are fixing.
function loadSidecar() {
  const store = new Map();
  // `writer` names whoever is currently writing, so a pass can attribute the
  // `sections` writes it caused to 415 vs. to the competing remover.
  const writes = { belt: 0, remover: 0 };
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
  const document = { activeElement: null };
  const noop = () => 0;
  const quietConsole = { log: noop, info: noop, warn: noop, error: noop, debug: noop };
  const fetch = () => ({ then: () => ({ then: () => ({ catch: () => {} }) }) });

  // Fake clock: `now` is advanced by the driver, mirroring the live 2.5s poll.
  const clock = { t: 1_700_000_000_000 };
  function FakeDate() { return new Date(clock.t); }        // `new Date()` -> the fake now
  FakeDate.now = () => clock.t;
  FakeDate.prototype = Date.prototype;

  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'document', 'console', 'CustomEvent', 'fetch',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date', SRC)(
    window, localStorage, document, quietConsole, CustomEvent, fetch, noop, noop, noop, noop, FakeDate);

  return { window, localStorage, store, clock, writes, ctx };
}

// ------------------------------------------------------------------- fixtures
// Three PI roles (tau-*) are absent from the stored section — the live shape:
// a merged / translated experience section whose constituents no longer match
// their personalInfo source, so completeness sees them as missing every pass.
const PI_ROLES = [
  { id: 'kanzen', title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', years: '2025-present', bullets: ['Advisory.'] },
  { id: 'innoviz-sa', title: 'System Architect', company: 'Innoviz Technologies', years: '2017-2020', bullets: ['Architecture.'] },
  { id: 'tau-security', title: 'Security Guard, Student Dormitories', company: 'Tel Aviv University', years: '2010-2012', bullets: ['Night shifts.'] },
  { id: 'tau-research', title: 'Research Assistant', company: 'Tel Aviv University', years: '2011-2013', bullets: ['Lab work.'] },
  { id: 'tau-teaching', title: 'Teaching Assistant', company: 'Tel Aviv University', years: '2012-2014', bullets: ['Tutorials.'] },
];
const MISSING_IDS = ['tau-security', 'tau-research', 'tau-teaching'];

function seed(localStorage) {
  const kept = PI_ROLES.filter((r) => MISSING_IDS.indexOf(r.id) < 0)
    .map((r) => Object.assign({}, r, { on: true }));
  localStorage.setItem('personalInfo', JSON.stringify({ experience: PI_ROLES }));
  localStorage.setItem('meta', JSON.stringify({ company: 'Ibsen Photonics', role: 'Optical Engineer' }));
  localStorage.setItem('sections', JSON.stringify({
    cv: [
      { id: 'experience', type: 'experience', title: 'PROFESSIONAL EXPERIENCE', on: true, roles: kept },
      { id: 'tools', type: 'labeled_list', title: 'TOOLS & METHODS', on: true, items: [{ label: 'Optics', text: 'lidar' }] },
    ],
  }));
}

function expRoles(localStorage) {
  const b = JSON.parse(localStorage.getItem('sections'));
  return b.cv.find((s) => s.id === 'experience').roles;
}

// The competing writer, reproduced: it strips the restored hidden roles back out
// AND touches an unrelated field (a translation pass rewriting a tools row), so
// every cycle the whole-blob serialisation differs.
function installRemover(env) {
  const { window, localStorage, ctx } = env;
  let cycles = 0;
  let live = true;
  window.addEventListener('antcv:sections-updated', () => {
    if (!live) return;
    const prev = ctx.writer;
    ctx.writer = 'remover';
    try {
      const b = JSON.parse(localStorage.getItem('sections'));
      const exp = b.cv.find((s) => s.id === 'experience');
      exp.roles = exp.roles.filter((r) => !(r.on === false && MISSING_IDS.indexOf(String(r.id)) >= 0));
      b.cv.find((s) => s.id === 'tools').items[0].text = 'lidar ' + (++cycles);  // parallel translation churn
      localStorage.setItem('sections', JSON.stringify(b));
    } finally { ctx.writer = prev; }
  });
  return { cycles: () => cycles, stop: () => { live = false; } };
}

// Drive N normalize passes, advancing the clock by the live poll interval so
// short time-window guards get their real chance to re-arm.
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
test('completeness restores genuinely missing PI roles as hidden (the safety net still works)', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  env.window.AntcvSectionsNormalize._normalize();
  const roles = expRoles(env.localStorage);
  MISSING_IDS.forEach((id) => {
    const r = roles.find((x) => String(x.id) === id);
    assert.ok(r, `${id} restored`);
    assert.equal(r.on, false, `${id} restored HIDDEN, not visible`);
  });
});

test('a competing remover + parallel translation churn does NOT sustain a write storm', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  const remover = installRemover(env);
  const writes = drivePasses(env, 20);
  // Before ROLES-STORM-CONVERGE-001 this was 20/20 — one write + one full-app
  // re-render per pass, forever. The belt must give up after it has proof that
  // a competing writer is reverting it.
  assert.ok(writes <= 2, `415 kept writing every pass (${writes}/20 wrote, remover ran ${remover.cycles()}x)`);
});

test('a NEW missing set (real regeneration) is still restored after the belt gave up', () => {
  const env = loadSidecar();
  seed(env.localStorage);
  const remover = installRemover(env);
  drivePasses(env, 10);                       // belt converges / gives up on the tau-* set

  assert.ok(!expRoles(env.localStorage).some((r) => MISSING_IDS.indexOf(String(r.id)) >= 0),
    'precondition: the belt gave up and the remover won');

  remover.stop();                             // the competing writer goes away (app switch / fixed sidecar)

  // A regeneration changes the VISIBLE experience substructure. That is a real
  // change, not the churn, so the suppression must re-arm and restore again.
  const b = JSON.parse(env.localStorage.getItem('sections'));
  b.cv.find((s) => s.id === 'experience').roles.push(
    { id: 'newco', title: 'Optical Systems Lead', company: 'Ibsen Photonics', years: '2026-present', on: true, bullets: ['New.'] });
  env.localStorage.setItem('sections', JSON.stringify(b));

  env.window.AntcvSectionsNormalize._normalize();
  const roles = expRoles(env.localStorage);
  MISSING_IDS.forEach((id) => {
    const r = roles.find((x) => String(x.id) === id);
    assert.ok(r, `${id} restored again after a genuine regeneration`);
    assert.equal(r.on, false, `${id} restored hidden`);
  });
});
