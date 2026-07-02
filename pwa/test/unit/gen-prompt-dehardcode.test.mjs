// gen-prompt-dehardcode.test.mjs
// ============================================================
// GEN-DEHARDCODE (owner 2026-07-03): the main generation prompt carried
// Gabriel-only facts that contaminated other personas (seen on the Anita demo):
// his exact Technion/TAU education list, his regulatory group taxonomy, a voice
// paragraph naming him, and patent 241997 as the publications example. Each is
// replaced by a persona-neutral rule that reads the candidate's OWN stored data
// (GEN-EDU-DEHARDCODE-001, GEN-REG-DEHARDCODE-001); the Gabriel languages pin is
// name-guarded. Gabriel keeps his exact behaviour via his stored kernel data.
// String-level assertions on BOTH app.src.js and the deployed app.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

const count = (hay, needle) => hay.split(needle).length - 1;

test('Gabriel hardcodes are gone from the gen prompt in BOTH files', () => {
  for (const gone of [
    // (1) education: his exact degree entries as the ONLY allowed list
    '"MBA: Technion. Strategy, Finance"',
    'B.Sc., Physics & B.Sc., Electrical Engineering: Tel Aviv University',
    // (2) regulatory: his exact group taxonomy as "Groups available"
    'Groups available (use only those with 2+ visible items',
    '"Systems, safety and cybersecurity"  (ASPICE',
    // (3) voice paragraph naming him
    'Gabriel writes in a Scandinavian',
    // (4) his patent number as prompt example (all three sites)
    '241997',
    // entangled with (4): his Sigma-Connectivity example bullet
    'Sigma-Connectivity ODM", that role',
  ]) {
    assert.equal(count(src, gone), 0, 'src still has: ' + gone.slice(0, 50));
    assert.equal(count(app, gone), 0, 'app.js still has: ' + gone.slice(0, 50));
  }
});

test('persona-neutral replacements exist byte-identically in BOTH files', () => {
  for (const marker of [
    'The candidate writes in a Scandinavian / Danish professional register at all times. This tone is about HOW they write',
    "Use ONLY the candidate's OWN stored education entries (the STORED EDUCATION list above, when present)",
    'GEN-EDU-DEHARDCODE-001',
    "Group names come from the candidate's OWN stored regulatory items (the STORED REGULATORY / STANDARDS list above, when present)",
    'GEN-REG-DEHARDCODE-001',
    'every patent entry keeps its OWN stored patent number verbatim',
    "the candidate's stored patent number(s)",
    'Supervise 7-person task force at the ODM partner',
  ]) {
    assert.equal(count(src, marker) >= 1, true, 'src missing: ' + marker.slice(0, 50));
    assert.equal(count(app, marker) >= 1, true, 'app.js missing: ' + marker.slice(0, 50));
  }
});

test('GABRIEL_BG injects the stored regulatory list (grounding for the neutral rule)', () => {
  const push = "STORED REGULATORY / STANDARDS — the candidate's OWN regulatory/standards list. Fill regulatory_items ONLY from these ('# ' lines are stored group headings):";
  assert.equal(count(src, push), 1, 'src push present once');
  assert.equal(count(app, push), 1, 'app.js push present once');
  // group headings are preserved through the formatter
  assert.equal(src.includes('e && e.group') || src.includes('e&&e.group'), true);
  assert.equal(app.includes('e&&e.group'), true);
});

test('the Gabriel languages pin is name-guarded, not unconditional', () => {
  const pin = 'For Gabriel the canonical set is exactly: English (native), Hebrew (native), Spanish (professional), Danish (B1)';
  assert.equal(count(src, pin), 1, 'pin kept once in src');
  assert.equal(count(app, pin), 1, 'pin kept once in app.js');
  assert.equal(src.includes('${/\\bgabriel\\b/i.test(String(ie().name||""))?'), true, 'src guard');
  assert.equal(app.includes('${/\\bgabriel\\b/i.test(String(Fe().name||""))?'), true, 'app.js guard (minified ie -> Fe)');
});

test('no "use strict" was introduced into the deployed bundle (APPJS-BLUESCREEN-001 guard)', () => {
  assert.equal(app.startsWith('(()=>{'), true, 'bundle head intact');
  assert.equal(/^\s*['"]use strict['"]/.test(app), false);
});
