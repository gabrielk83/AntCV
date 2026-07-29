// SECTIONS-STORM-2026-07-23 — structural invariants for the storm fix in app.js.
//
// The storm engine: both app.js sections-ingest sites rebuilt the blob as a
// fresh {cv, cl}, dropping the belts' STAMP-IN-BLOB root fields
// (_roleMergeStamp / _sidebarCutStamp). The 500ms auto-save then wrote the
// stampless blob back, every one-shot belt re-armed, and the chain looped
// forever (the DTU Wind "sections rewritten continuously" probe). The fix
// spreads the parsed blob first ({...parsed, cv, cl}) so unknown ROOT keys
// survive the ingest → auto-save round-trip.
//
// Identifiers are mangled in app.js, so the guards below match the STRUCTURE
// (spread + cv/cl rebuild) with \w+ identifier wildcards, in BOTH bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

test('app.js: the sections STATE INITIALISER spreads the parsed blob (root keys preserved)', () => {
  assert.match(app, /return\{\.\.\.(\w+),cv:\w+\(\1\.cv\),cl:\w+\(\1\.cl\)\}/,
    'initial ingest must be {...parsed, cv:…, cl:…} — a bare {cv,cl} drops the belts\' root stamps and restarts the storm');
});

test('app.js: the sections RE-INGEST handler spreads the parsed blob (root keys preserved)', () => {
  assert.match(app, /__nextSec=\{\.\.\.(\w+),cv:\w+\(\1\.cv\),cl:\w+\(\1\.cl\)\}/,
    're-ingest must be {...parsed, cv:…, cl:…} — a bare {cv,cl} drops the belts\' root stamps and restarts the storm');
});

test('app.src.js mirrors both spread-ingest sites', () => {
  assert.match(src, /return \{ \.\.\.(\w+), cv: \w+\(\1\.cv\), cl: \w+\(\1\.cl\) \}/,
    'app.src.js initial ingest must mirror the app.js spread');
  assert.match(src, /__nextSec = \{ \.\.\.(\w+), cv: \w+\(\1\.cv\), cl: \w+\(\1\.cl\) \}/,
    'app.src.js re-ingest must mirror the app.js spread');
});

test('EXPORT-PALETTE-PARITY: the package-palette self-heal PERSISTS styleConfig (both bundles)', () => {
  // The heal used to fix React state only; docx-client buildStyle exports from
  // localStorage styleConfig, so exports kept a stale palette (the owner's dark
  // theme under the copenhagen preset). The heal must write styleConfig.
  assert.match(app, /mainHeadColor!==\w+\.mainHeadColor&&\w+\(\w+=>\{const \w+=\{\.\.\.\w+,\.\.\.\w+\};try\{\w+\.set\("styleConfig",\w+\)\}/,
    'app.js: the mainHeadColor-mismatch heal must persist styleConfig');
  assert.ok(src.includes('EXPORT-PALETTE-PARITY'),
    'app.src.js: the heal-persist block (EXPORT-PALETTE-PARITY comment) is missing');
});
