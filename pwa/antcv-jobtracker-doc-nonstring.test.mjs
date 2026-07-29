// JT-DOC-NONSTRING-001 — the Job Tracker doc is ONE shared JSON written by this
// island, the nightly runner (scripts/job-tracker/gen-runner.py) and cloud
// routines. A routine wrote doc.support[<a Terma row>] as a structured object
// ({needs:[…], bring:[…]}) where the schema says string; mergeResearchBlock did
// `(roleIntel || '').trim()` on it, threw, and the row's Open button dead-ended
// with "Could not open in AntCV: (e || '').trim is not a function" (owner,
// 2026-07-29). The island cannot police every writer, so it must not trust the
// value TYPE: normalizeDoc() coerces every text-map entry as the doc enters.
//
// Behavioural tests run the REAL api.ts through the TypeScript transpiler; the
// last two are structure tests asserting the deployed bundle was rebuilt from
// this source (the "edited the .tsx but forgot `npm run build`" mistake).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_TS = join(HERE, '..', 'src', 'islands', 'JobTracker', 'api.ts');
const SRC = readFileSync(API_TS, 'utf8');
const TRACKER_SRC = readFileSync(join(HERE, '..', 'src', 'islands', 'JobTracker', 'JobTracker.tsx'), 'utf8');
const BUNDLE = readFileSync(join(HERE, 'antcv-react-islands.js'), 'utf8');

const ts = createRequire(import.meta.url)('typescript');
const js = ts.transpileModule(SRC, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
// api.ts touches window/localStorage at module scope only inside functions, but
// the module-level constants read `window` defensively — give it a stub.
globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { asText, normalizeDoc } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('asText passes strings through untouched', () => {
  assert.equal(asText('ROLE: Terma — Advanced Systems Engineer'), 'ROLE: Terma — Advanced Systems Engineer');
  assert.equal(asText(''), '');
});

test('asText maps null/undefined to the empty string (never "null")', () => {
  assert.equal(asText(null), '');
  assert.equal(asText(undefined), '');
});

test('asText renders the routine-written {needs,bring} object as labelled lines, not [object Object]', () => {
  const out = asText({ needs: ['MBSE', 'system architecture'], bring: ['optics', 'requirements discipline'] });
  assert.ok(!out.includes('[object Object]'), 'must not stringify to [object Object]');
  assert.match(out, /^NEEDS: MBSE\nsystem architecture$/m);
  assert.match(out, /^BRING: optics\nrequirements discipline$/m);
  assert.equal(typeof out.trim, 'function');   // the property that used to be missing
});

test('normalizeDoc coerces every text map so downstream .trim() is always safe', () => {
  const bad = {
    rows: [[1, 'Terma', 'Advanced Systems Engineer', 'Søborg', '', 'A', '', '', 'open', '', '', 'terma-x', 'strong']],
    support: { 'terma-x': { needs: ['MBSE'], bring: ['optics'] } },   // the live corruption
    webintel: { 'terma-x': 42 },
    signals: { 'terma-x': ['a', 'b'] },
    jd: { 'terma-x': 'a real job description' },
  };
  const d = normalizeDoc(bad);
  for (const map of ['support', 'webintel', 'signals', 'jd']) {
    assert.equal(typeof d[map]['terma-x'], 'string', map + ' must be a string after normalize');
  }
  assert.match(d.support['terma-x'], /NEEDS: MBSE/);
  assert.equal(d.webintel['terma-x'], '42');
  assert.equal(d.jd['terma-x'], 'a real job description', 'good values pass through unchanged');
});

test('normalizeDoc keeps rows index-stable and leaves the numeric rank alone', () => {
  const d = normalizeDoc({ rows: [[3, 'Terma', { x: 1 }, '', '', '', '', '', '', '', '', 'uk1', 'strong']] });
  assert.equal(d.rows[0][0], 3, 'rank stays numeric');
  assert.equal(d.rows[0][11], 'uk1', 'the urlkey stays at index 11');
  assert.equal(typeof d.rows[0][2], 'string', 'a non-string cell is coerced, not dropped');
  assert.equal(d.rows[0].length, 13);
});

test('normalizeDoc drops sigfiles entries with no text and coerces the rest', () => {
  const d = normalizeDoc({ rows: [], sigfiles: { uk1: [{ name: 1, text: 'body' }, { name: 'x', text: '' }, null] } });
  assert.equal(d.sigfiles.uk1.length, 1);
  assert.equal(d.sigfiles.uk1[0].name, '1');
  assert.equal(d.sigfiles.uk1[0].text, 'body');
});

test('normalizeDoc returns null for a missing doc (the empty-tracker path)', () => {
  assert.equal(normalizeDoc(null), null);
});

test('source: both doc entry points normalize — the GET and the 409 server doc', () => {
  assert.match(SRC, /return \{ doc: normalizeDoc\(\(j && j\.doc\) \|\| null\), rev:/);
  assert.match(SRC, /conflict: true, serverDoc: normalizeDoc\(j\.doc \?\? null\)/);
});

test('source: the two former throw sites coerce as defence in depth', () => {
  assert.match(TRACKER_SRC, /const intel = asText\(roleIntel\)\.trim\(\);/);
  assert.match(TRACKER_SRC, /const manual = asText\(\(d\?\.signals \|\| \{\}\)\[uk\]\)\.trim\(\);/);
});

test('bundle: the deployed island carries the normalizer (it WAS rebuilt from source)', () => {
  // Minification renames every identifier, so anchor on literals that survive:
  // asText's key-label regex and the TEXT_MAPS list normalizeDoc walks.
  assert.ok(BUNDLE.includes('[_-]+/g'), 'asText key-label regex missing — run `npm run build`');
  assert.match(BUNDLE, /"urls","jd","gen","signals","support","webintel"/, 'TEXT_MAPS missing — run `npm run build`');
});

test('bundle: Open no longer dead-ends — it asks for the JD and opens past a save failure', () => {
  assert.ok(BUNDLE.includes('[jt-open] no JD for '), 'the no-JD recovery path is not in the bundle');
  assert.ok(BUNDLE.includes('[jt-open] tracker-doc save failed'), 'the reload is still gated on the tracker-doc save');
});
