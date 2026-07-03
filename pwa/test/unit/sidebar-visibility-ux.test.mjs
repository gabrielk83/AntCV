// SIDEBAR-LONGPRESS-HIDE-001 + VISIBILITY-FEEDBACK-001 (owner 2026-07-03) —
// "long press a sidebar element in the preview -> menu -> hide -> it enters
// the hidden group (created if absent); log my hide/unhide overrides to
// analytics to improve future generations."
//
// Locks:
//  1. hideToken: token leaves the real line, the 'Hidden - <category>' group
//     is CREATED (or appended) immediately, the analytics event + feedback
//     summary are written.
//  2. diffEvents: a panel-eye hide flip is logged; un-hiding a residue row
//     logs 'unhide' per token; a broad rewrite (generation/restore) is never
//     misattributed to the user.
//  3. buildFeedback: latest decision per item wins (hide then unhide -> KEEP).
//  4. VISIBILITY-FEEDBACK-001: BOTH app bundles inject the feedback summary
//     into the generation prompt after the STORED TOOLS block.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-sidebar-visibility-ux.js', import.meta.url), 'utf8');

function loadSidecar() {
  const backing = {};
  const localStorage = {
    getItem: (k) => (k in backing ? backing[k] : null),
    setItem: (k, v) => { backing[k] = String(v); },
    removeItem: (k) => { delete backing[k]; },
  };
  const window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 800, innerHeight: 600 };
  const documentStub = { addEventListener() {}, removeEventListener() {}, body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {} }) };
  const ctx = {
    window, localStorage, console, document: documentStub,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {},
    CustomEvent: function CustomEvent() {}, Date,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return { api: window.AntcvSidebarVisibilityUx, backing };
}

test('hideToken: token moves into the Hidden group (created if absent) + analytics + feedback', () => {
  const { api, backing } = loadSidecar();
  backing['meta'] = JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' });
  backing['sections'] = JSON.stringify({
    cv: [{
      id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', type: 'labeled_list',
      items: [{ l: 'Lab & fabrication', v: 'Cleanroom fabrication, PDMS nanoimprint, lithography' }],
    }],
  });
  api._hideToken({ sid: 'tools', idx: 0, item: { l: 'Lab & fabrication', v: 'x' } }, 'PDMS nanoimprint');

  const b = JSON.parse(backing['sections']);
  const items = b.cv[0].items;
  assert.equal(items[0].v, 'Cleanroom fabrication, lithography', 'token removed from the real line');
  const res = items.find((it) => it.l === 'Hidden - Lab & fabrication');
  assert.ok(res, 'Hidden group created');
  assert.equal(res.v, 'PDMS nanoimprint');
  assert.equal(res.hidden, true, 'Hidden group never renders');

  const log = JSON.parse(backing['antcv:visibilityAnalytics']);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'hide');
  assert.equal(log[0].token, 'PDMS nanoimprint');
  assert.equal(log[0].app, 'NIL Technology|Nanooptics Prototyping Engineer');
  assert.ok(/HIDE: "PDMS nanoimprint" \(Lab & fabrication\)/.test(backing['antcv:visibility-feedback']), 'feedback summary written');
});

test('hideToken appends to an EXISTING Hidden group instead of duplicating it', () => {
  const { api, backing } = loadSidecar();
  backing['sections'] = JSON.stringify({
    cv: [{
      id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', type: 'labeled_list',
      items: [
        { l: 'Lab & fabrication', v: 'Cleanroom fabrication, DRIE, lithography' },
        { l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint', hidden: true },
      ],
    }],
  });
  api._hideToken({ sid: 'tools', idx: 0, item: { l: 'Lab & fabrication', v: 'x' } }, 'DRIE');
  const items = JSON.parse(backing['sections']).cv[0].items;
  const residues = items.filter((it) => /^Hidden - /.test(it.l || ''));
  assert.equal(residues.length, 1, 'no duplicate Hidden group');
  assert.equal(residues[0].v, 'PDMS nanoimprint, DRIE');
});

test('diffEvents: panel-eye flip logged; residue-row unhide logs per-token; broad rewrites ignored', () => {
  const { api } = loadSidecar();
  const prev = {
    cv: [{
      id: 'certifications', loc: 'sidebar', type: 'labeled_list',
      items: [{ l: 'EMVA 1288', v: 'Machine-vision sensor characterization' }],
    }, {
      id: 'tools', loc: 'sidebar', type: 'labeled_list',
      items: [{ l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint, DRIE', hidden: true }],
    }],
  };
  const next = JSON.parse(JSON.stringify(prev));
  next.cv[0].items[0].hidden = true;                    // user hid the cert row
  next.cv[1].items[0].hidden = false;                   // user un-hid the residue row
  const evs = api._diffEvents(prev, next, 'NIL|Engineer');
  assert.equal(evs.filter((e) => e.action === 'hide' && e.label === 'EMVA 1288' && e.src === 'panel-eye').length, 1);
  const unhides = evs.filter((e) => e.action === 'unhide' && e.src === 'residue-eye');
  assert.equal(JSON.stringify(unhides.map((e) => e.token).sort()), JSON.stringify(['DRIE', 'PDMS nanoimprint']));
  assert.ok(unhides.every((e) => e.label === 'Lab & fabrication'), 'residue prefix stripped in the event');

  // Broad rewrite: 5+ flips at once = generation/restore, not the user.
  const broadPrev = { cv: [{ id: 'tools', loc: 'sidebar', type: 'labeled_list', items: [1, 2, 3, 4, 5].map((n) => ({ l: 'Cat' + n, v: 'x' })) }] };
  const broadNext = JSON.parse(JSON.stringify(broadPrev));
  broadNext.cv[0].items.forEach((it) => { it.hidden = true; });
  assert.equal(api._diffEvents(broadPrev, broadNext, 'a|b').length, 0, 'oversized diff never misattributed');
});

test('buildFeedback: latest decision per item wins', () => {
  const { api } = loadSidecar();
  const events = [
    { sid: 'tools', label: 'Lab & fabrication', token: 'PDMS nanoimprint', action: 'hide', app: 'A|r' },
    { sid: 'tools', label: 'Lab & fabrication', token: 'PDMS nanoimprint', action: 'unhide', app: 'B|r' },
    { sid: 'certifications', label: 'EMVA 1288', token: null, action: 'hide', app: 'B|r' },
  ];
  const txt = api._buildFeedback(events);
  assert.ok(/KEEP VISIBLE: "PDMS nanoimprint"/.test(txt), 'latest (unhide) wins for PDMS');
  assert.ok(!/HIDE: "PDMS nanoimprint"/.test(txt), 'stale hide decision dropped');
  assert.ok(/HIDE: "EMVA 1288" \(whole element\)/.test(txt));
});

test('RICH shape: hideRow writes the SECTION-LEVEL hidden map (the mechanism the panel eye uses)', () => {
  // The owner's forever-hidden mobile bug: it.hidden is IGNORED by the rich
  // renderer + rich panel editor; both use the section-level index map.
  const { api, backing } = loadSidecar();
  backing['sections'] = JSON.stringify({
    cv: [{
      id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', type: 'rich_block',
      items: [
        { grp: true, t: 'Engineering', bullets: [] },
        { b: 'Lab & fabrication', t: 'Cleanroom fabrication, DRIE', bullets: [] },
      ],
    }],
  });
  const row = { sid: 'tools', idx: 1, item: { b: 'Lab & fabrication', t: 'x', bullets: [] } };
  // findRow is DOM-bound; drive hideRow directly with a rich item.
  api._hideToken(row, 'DRIE');
  const sec = JSON.parse(backing['sections']).cv[0];
  const res = sec.items.find((it) => /^Hidden - /.test(it.b || ''));
  assert.ok(res, 'rich residue row created');
  assert.equal(res.b, 'Hidden - Lab & fabrication');
  assert.equal(res.t, 'DRIE');
  assert.ok(!('hidden' in res), 'rich residue has no per-item flag');
  assert.ok(!/DRIE/.test(sec.items[1].t), 'token removed from the line');
});

test('undo: restores the exact pre-hide section', () => {
  const { api, backing } = loadSidecar();
  backing['sections'] = JSON.stringify({
    cv: [{
      id: 'tools', loc: 'sidebar', type: 'rich_block',
      items: [{ b: 'Lab & fabrication', t: 'Cleanroom fabrication, DRIE', bullets: [] }],
    }],
  });
  const before = backing['sections'];
  api._hideToken({ sid: 'tools', idx: 0, item: { b: 'Lab & fabrication', t: 'x', bullets: [] } }, 'DRIE');
  assert.notEqual(backing['sections'], before, 'hide changed the section');
  api._undoLast();
  const sec = JSON.parse(backing['sections']).cv[0];
  assert.equal(sec.items.length, 1, 'residue row gone after undo');
  assert.equal(sec.items[0].t, 'Cleanroom fabrication, DRIE', 'line back to the pre-hide value');
});

test('RESIDUE-PREVIEW-SKIP covers the rich_block renderer in both bundles; app.js placeholder regex repaired', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.ok(src.includes('if (!row.grp && /^\\s*hidden\\s*[-–—:]\\s*/i.test(String(row.b || row.l || ""))) return null;'), 'app.src.js rich_block skip');
  assert.ok(min.includes('if(!r.grp&&/^\\s*hidden\\s*[-–—:]\\s*/i.test(String(r.b||r.l||"")))return null;'), 'app.js rich_block skip');
  // APPJS-REGEX-BACKSLASH-REPAIR: the corrupted escape-less regex must be gone.
  assert.ok(!min.includes('/^s*[[sS]*]s*$/'), 'corrupted CV-PLACEHOLDER-DROP regex repaired');
  assert.ok(min.includes('/^\\s*\\[[\\s\\S]*\\]\\s*$/.test(String(r.t||""))'), 'correct placeholder regex present in app.js');
});

test('VISIBILITY-FEEDBACK-001: both app bundles inject the feedback into the gen prompt', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  for (const [name, s] of [['app.src.js', src], ['app.js', min]]) {
    assert.ok(s.includes('USER VISIBILITY FEEDBACK (VISIBILITY-FEEDBACK-001)'), name + ' carries the prompt block');
    assert.ok(s.includes('localStorage.getItem("antcv:visibility-feedback")'), name + ' reads the summary key');
  }
});
