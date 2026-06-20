// placeholder-export-guard.test.mjs
// ============================================================
// PLACEHOLDER-EXPORT-GUARD-001 (owner 2026-06-14): a generated CL that leaves a
// field empty must NEVER export the empty-skeleton bracket placeholder. The
// owner's unsolicited CL showed "[WHY THIS POSITION — 1-2 sentences …]" in the
// finished PDF because why_content came back empty. normalizeSections (in
// buildPayload) now treats a value that is ENTIRELY one bracketed placeholder
// as empty, and drops a text section that is empty after stripping.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

// ORPHAN-NBSP-EXPORT-001 (1.50.656): buildPayload binds orphans (last space ->
// U+00A0) on SURVIVING real content AFTER placeholder stripping. These tests cover
// placeholder stripping, not spacing — normalise NBSP back to a space so the
// content assertions stay robust to the orphan-bind.
const noNbsp = (s) => String(s).replace(/ /g, ' ');

function payloadWith(clSections) {
  return buildPayload({
    sections: { cv: [], cl: clSections },
    doc: 'cl', personalInfo: { name: 'T' }, meta: {},
  });
}

const WHY_PLACEHOLDER =
  '[WHY THIS POSITION — 1-2 sentences explaining why this role fits. Refer to specific things in the JD: scope, technology, team, mission, regulatory context.]';

test('unfilled WHY THIS POSITION placeholder is dropped from the export', () => {
  const p = payloadWith([
    { id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'Real intro.' },
    { id: 'why', title: 'WHY THIS POSITION', loc: 'main', on: true, type: 'text', content: WHY_PLACEHOLDER },
  ]);
  const why = p.sections.find((s) => s.id === 'why');
  assert.equal(why, undefined, 'placeholder WHY section must not export');
  // a real text section survives untouched
  const who = p.sections.find((s) => s.id === 'who');
  assert.ok(who && /Real intro/.test(noNbsp(who.content)));
});

test('a filled WHY THIS POSITION is kept', () => {
  const p = payloadWith([
    { id: 'why', title: 'WHY THIS POSITION', loc: 'main', on: true, type: 'text', content: 'I am reaching out because your work in optics aligns with my background.' },
  ]);
  const why = p.sections.find((s) => s.id === 'why');
  assert.ok(why && /reaching out/.test(why.content));
});

test('placeholder bullets + foundation fields are stripped', () => {
  const p = payloadWith([
    { id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'text_bullets',
      intro: 'My first step:', items: ['Real bullet.', '[placeholder bullet]'] },
    { id: 'foundation', title: 'FOUNDATION', loc: 'main', on: true, type: 'foundation',
      hands_on: '[FILL hands-on]', professionally: 'I keep decisions visible.' },
  ]);
  const contribute = p.sections.find((s) => s.id === 'contribute');
  assert.deepEqual(contribute.items.map(noNbsp), ['Real bullet.'], 'placeholder bullet must be dropped');
  const foundation = p.sections.find((s) => s.id === 'foundation');
  assert.equal(foundation.hands_on, '', 'placeholder hands_on must be blanked');
  assert.equal(noNbsp(foundation.professionally), 'I keep decisions visible.');
});

test('a placeholder that ALREADY contains an NBSP is still stripped (strip-before-bind)', () => {
  // Regression for the "strip misses the NBSP'd placeholder" hypothesis
  // (placeholder-export-guard, PROJECT_ISSUES 2026-06-20). PLACEHOLDER_RE uses
  // \s (matches U+00A0) at the ends and [^\]] (matches U+00A0) inside, and the
  // pipeline strips BEFORE bindOrphan — so even a placeholder whose internal/edge
  // spaces are already non-breaking must be treated as empty, not exported.
  const NBSP = ' ';
  const why = '[WHY THIS POSITION' + NBSP + '—' + NBSP + '1-2 sentences explaining fit.]';
  const p = payloadWith([
    { id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'Real intro.' },
    { id: 'why', title: 'WHY THIS POSITION', loc: 'main', on: true, type: 'text', content: NBSP + why + NBSP },
  ]);
  assert.equal(p.sections.find((s) => s.id === 'why'), undefined, 'NBSP-laden placeholder must not export');
  assert.ok(p.sections.find((s) => s.id === 'who'), 'real content still survives');
});

test('a bracket inside real prose is NOT treated as a placeholder', () => {
  // only a string that is ENTIRELY one [bracket] counts as a placeholder
  const p = payloadWith([
    { id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'I led the CCB [change control board] for three years.' },
  ]);
  const who = p.sections.find((s) => s.id === 'who');
  assert.ok(who && /change control board/.test(who.content), 'inline bracket must survive');
});
