// LANE 4 — app.src.js ↔ app.js mirror guard.
//
// pwa/app.src.js is the de-minified SOURCE; pwa/app.js is its minified mirror
// (terser --compress --mangle). The mirror is a RECURRING failure mode: a fix
// lands in app.src.js but the minified app.js isn't updated (or vice versa),
// so the deployed app diverges from the reviewable source.
//
// terser mangles identifiers and drops formatting, but it preserves STRING
// LITERAL CONTENTS verbatim. So a curated set of distinctive display strings
// and storage keys MUST appear byte-identical in BOTH files. If a mirrored
// region is edited in one file but not the other, its anchor here breaks.
//
// When you add a new mirrored region whose behaviour hinges on a distinctive
// string, add that string to ANCHORS so the guard covers it too.
//
// Plus the structural invariants from docs/deployment/app-js-source-and-rebuild.md:
// app.js must boot as a sloppy-mode IIFE (head `(()=>{`) and carry ZERO
// `"use strict"` (esbuild's `"use strict"` prepend blue-screened the app —
// APPJS-BLUESCREEN-001).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

// Distinctive string-literal CONTENTS present in both files. Display text +
// storage keys — NOT identifiers (mangled) and NOT syntax-adjacent fragments
// (formatting differs). Each was confirmed to exist verbatim in src and app.
const ANCHORS = [
  // section headings / labels
  'PROFESSIONAL EXPERIENCE',
  'CORE COMPETENCIES',
  'SELECTED OUTCOMES',
  'HOW I WOULD CONTRIBUTE',
  'RECOMMENDATIONS',
  'WHAT I BRING',
  'Results: ',
  'Work style:',
  // packages / config
  'copenhagen-modern',
  // storage keys + bridges (cross-cutting, must stay in sync)
  'antcv:lastJdText',
  'antcv:autoPagesPreview',
  'exportPdfViaWorker',
  // wizard / import affordance
  'Drop a CV or LinkedIn export',
];

test('every mirror anchor exists in app.src.js (source integrity)', () => {
  const missing = ANCHORS.filter((a) => !src.includes(a));
  assert.deepEqual(missing, [], `anchors absent from app.src.js (update ANCHORS): ${missing.join(' | ')}`);
});

test('every mirror anchor exists in app.js (minified mirror is in sync)', () => {
  const missing = ANCHORS.filter((a) => !app.includes(a));
  assert.deepEqual(missing, [], `anchors absent from app.js — app.src.js edited but NOT mirrored: ${missing.join(' | ')}`);
});

test('app.js boots as a sloppy-mode IIFE (head invariant)', () => {
  assert.ok(app.trimStart().startsWith('(()=>{'), 'app.js must start with (()=>{ — a different head means a non-mirror rebuild');
});

test('app.js carries zero "use strict" (APPJS-BLUESCREEN-001 guard)', () => {
  // esbuild/build:app prepends "use strict", which is NOT behaviour-preserving
  // for this sloppy-mode bundle and blue-screened the app on 2026-06-06.
  assert.equal(app.includes('use strict'), false, 'app.js must NOT contain "use strict" — see the rebuild doc');
});
