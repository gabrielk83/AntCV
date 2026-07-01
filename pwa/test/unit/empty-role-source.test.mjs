// empty-role-source.test.mjs
// ============================================================
// EMPTY-ROLE-SOURCE-001 — fix the SOURCE that materializes blank on:true
// experience roles (the belt antcv-empty-role-hide.js only mops them up at boot).
//
// The generation-output → sections merge (app.src.js ~25319) appended EVERY
// LLM-returned role not already in the editor list, verbatim. The gen prompt
// orders "5+ on:true" role slots, so the model emits extras (r8/r9/r10) whose
// bracketed "[Role title]"/"[Company name]" text is emptied by
// kernel-completeness-290's placeholder scrub — landing as blank on:true rows.
//
// Fix: drop an extra role with no title AND no company; push any populated
// extra as on:false (hidden, recoverable — mirrors the on:!1 backfill below).
//
// This test (a) reproduces the exact fixed writer loop and asserts behaviour,
// and (b) guards src↔app.js mirror parity via a distinctive verbatim fragment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

// Faithful reproduction of the fixed writer loop (app.src.js ~25319).
// r = editor role list, t = LLM-returned roles, l = merged output (seeded
// from the editor roles). Returns the mutated l.
function mergeExtras(r, t, l) {
  for (const e of t) {
    if (r.some((x) => x.id === e.id)) continue;
    const _hasContent = !!(
      e &&
      ((e.title && String(e.title).trim()) ||
        (e.company && String(e.company).trim()))
    );
    if (!_hasContent) continue;
    l.push({ ...e, on: false });
  }
  return l;
}

const editor = [{ id: 'r1', title: 'PdM', company: 'Acme', on: true, bullets: ['Shipped X'] }];

test('blank on:true extras (post-scrub r8/r9/r10) are dropped at source', () => {
  const llm = [
    { id: 'r1', title: 'PdM', company: 'Acme', on: true, bullets: ['Shipped X'] },
    { id: 'r8', title: '', company: '', years: '', on: true, bullets: [] },
    { id: 'r9', title: '', company: '', years: '', on: true, bullets: [] },
    { id: 'r10', title: '', company: '', years: '', on: true, bullets: [] },
  ];
  const l = mergeExtras(editor, llm, editor.slice());
  // no blank on!==false role survives (the belt sidecar's signature)
  const blankActive = l.filter((rr) => rr.on !== false && !(rr.title || '').trim() && !(rr.company || '').trim());
  assert.equal(blankActive.length, 0);
  // only the editor role remains
  assert.equal(l.length, 1);
  assert.equal(l[0].id, 'r1');
  assert.equal(l[0].on, true); // editor role untouched
});

test('a populated extra role is KEPT but forced on:false (hide-over-delete)', () => {
  const llm = [
    { id: 'r8', title: 'Volunteer Coordinator', company: 'Pan-Idraet', on: true, bullets: ['Ran the league'] },
    { id: 'r9', title: '', company: '', on: true, bullets: [] }, // empty → dropped
  ];
  const l = mergeExtras(editor, llm, editor.slice());
  assert.equal(l.length, 2);
  const extra = l.find((rr) => rr.id === 'r8');
  assert.ok(extra, 'populated extra kept');
  assert.equal(extra.on, false, 'populated extra forced hidden, recoverable');
  assert.equal(extra.title, 'Volunteer Coordinator'); // content preserved
  assert.ok(!l.some((rr) => rr.id === 'r9'), 'empty extra dropped');
});

test('whitespace-only title/company counts as empty (dropped)', () => {
  const llm = [{ id: 'r8', title: '   ', company: '\t', on: true, bullets: [] }];
  const l = mergeExtras(editor, llm, editor.slice());
  assert.equal(l.length, 1);
  assert.equal(l[0].id, 'r1');
});

test('an LLM role matching an editor id is not re-appended', () => {
  const llm = [{ id: 'r1', title: 'PdM (tailored)', company: 'Acme', on: true, bullets: ['New'] }];
  const l = mergeExtras(editor, llm, editor.slice());
  assert.equal(l.length, 1); // dedup by id; editor entry stays
});

// ---- src ↔ app.js mirror parity -------------------------------------------
const FRAG_SRC = 'String(e.company).trim()';
const FRAG_APP = 'String(e.company).trim()';

test('EMPTY-ROLE-SOURCE-001 guard present in app.src.js', () => {
  assert.ok(src.includes(FRAG_SRC), 'source lost the guard fragment');
  assert.ok(src.includes('EMPTY-ROLE-SOURCE-001'), 'source lost the comment marker');
});

test('EMPTY-ROLE-SOURCE-001 guard mirrored into app.js', () => {
  assert.ok(app.includes(FRAG_APP), 'app.js NOT mirrored — src edited but minified mirror missing the guard');
});

test('app.js stays a sloppy-mode IIFE with no "use strict" after the mirror', () => {
  assert.ok(app.trimStart().startsWith('(()=>{'));
  assert.equal(app.includes('use strict'), false);
});
