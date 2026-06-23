// contribute-peel-fix.test.mjs
// ============================================================
// CONTRIBUTE-PEEL-FIX-001 (owner 2026-06-24 "markers on mid-bullets"):
// antcv-hwic-to-rich-block-760.js converts the CL "contribute" section (text_bullets)
// into a rich_block. The old peel UNCONDITIONALLY moved items[0]->intro and
// items[last]->closing whenever the explicit intro/closing fields were empty, so a plain
// generated bullet list lost its FIRST and LAST bullets to markerless paragraphs, leaving
// only the middle bullets with markers. The fix: only peel a genuine lead-in (items[0]
// ending with ":") and only peel the closing when such an intro was actually peeled.
//
// Loads the REAL sidecar in a vm sandbox with a Map-backed localStorage, seeds a contribute
// section, runs the converter, and asserts the resulting rich_block rows + markers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-hwic-to-rich-block-760.js', import.meta.url), 'utf8');

function makeSandbox() {
  const store = new Map();
  const sandbox = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    JSON, String, Array, Object, Number, Boolean, RegExp,
    setTimeout: () => 0,            // converter schedules run() via setTimeout; we call run() directly
    console,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.dispatchEvent = () => true;
  sandbox.CustomEvent = function () {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, store };
}

function convert(contributeSection) {
  const { sandbox, store } = makeSandbox();
  store.set('sections', JSON.stringify({ cv: [], cl: [contributeSection] }));
  sandbox.window.AntcvHwicToRichBlock.run();
  const out = JSON.parse(store.get('sections'));
  return out.cl.find((s) => s.id === 'contribute');
}

test('plain 4-bullet contribute (no intro/closing) keeps ALL 4 markered bullets — no phantom peel', () => {
  const sec = convert({
    id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'text_bullets',
    items: [
      'Map the change-request process to identify cycle-time bottlenecks.',
      'Align supplier scoring with technical and commercial priorities.',
      'Document validation plans and acceptance criteria for audit-ready compliance.',
      'Introduce clear written follow-ups to keep stakeholders aligned.',
    ],
  });
  assert.equal(sec.type, 'rich_block');
  assert.equal(sec.items.length, 4, 'all four bullets are preserved');
  assert.ok(sec.items.every((r) => r.mk === true), 'every row keeps its bullet marker (no markerless intro/closing stolen from real bullets)');
});

test('flat shape {items:[lead-in:, bullets, closing]} peels lead-in + closing as markerless rows', () => {
  const sec = convert({
    id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'text_bullets',
    items: [
      'If a role fits, my first priorities would typically be:',   // genuine lead-in (ends ":")
      'Learn the current setup before proposing changes.',
      'Map the highest-leverage gaps and propose a small fix for each.',
      'My aim is to help the team where it matters most.',          // closing
    ],
  });
  assert.equal(sec.items.length, 4);
  assert.equal(sec.items[0].mk, undefined, 'lead-in row is markerless (intro)');
  assert.equal(sec.items[1].mk, true);
  assert.equal(sec.items[2].mk, true);
  assert.equal(sec.items[sec.items.length - 1].mk, undefined, 'closing row is markerless');
});

test('REPAIR already-converted rich_block whose real first/last bullets lost their markers', () => {
  // The owner's actual state after the OLD 760 stripped markers off the first/last bullets.
  const sec = convert({
    id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'rich_block',
    items: [
      { b: '', t: 'Map the change-request process to identify cycle-time bottlenecks.' },          // markerless (wrong)
      { b: '', t: 'Align supplier scoring with priorities.', mk: true },
      { b: '', t: 'Document validation plans for audit-ready compliance.', mk: true },
      { b: '', t: 'Introduce clear written follow-ups to keep stakeholders aligned.' },             // markerless (wrong)
    ],
  });
  assert.equal(sec.items.length, 4);
  assert.ok(sec.items.every((r) => r.mk === true), 'all four real bullets regain their markers (no ":"-lead-in present)');
});

test('REPAIR keeps a genuine ":"-lead-in intro + closing markerless in a rich_block', () => {
  const sec = convert({
    id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'rich_block',
    items: [
      { b: '', t: 'If a role fits, my first priorities would typically be:', mk: true },  // intro wrongly markered
      { b: '', t: 'Learn the current setup first.', mk: true },
      { b: '', t: 'Map the highest-leverage gaps.', mk: true },
      { b: '', t: 'My aim is to help where it matters most.', mk: true },                  // closing wrongly markered
    ],
  });
  assert.equal(sec.items[0].mk, undefined, 'lead-in intro becomes markerless');
  assert.equal(sec.items[1].mk, true);
  assert.equal(sec.items[2].mk, true);
  assert.equal(sec.items[3].mk, undefined, 'closing becomes markerless');
});

test('explicit intro/closing fields win (skeleton shape) — bullets stay markered', () => {
  const sec = convert({
    id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'text_bullets',
    intro: 'My first priorities would be:',
    closing: 'Focused on what the team gains.',
    items: ['First concrete contribution.', 'Second concrete contribution.'],
  });
  const markerless = sec.items.filter((r) => r.mk === undefined);
  const markered = sec.items.filter((r) => r.mk === true);
  assert.equal(markerless.length, 2, 'intro + closing are markerless');
  assert.equal(markered.length, 2, 'both real bullets keep markers');
});
