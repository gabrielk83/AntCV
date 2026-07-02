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

// ============================================================
// GEN-DEHARDCODE-002 (owner 2026-07-03, follow-up sweep): __neutralCo carried
// Gabriel's unsolicited identity (profile opener, "for Gabriel" specialization
// mention, EO/LiDAR forbidden-opener examples, EO focus-area labels), the main
// prompt carried his WHY-THIS-POSITION breadth list and the Innoviz
// merge-or-split example, and the STORED WORK HISTORY push named his employers
// (Innoviz/Meprolight/TAU examples, Kanzen founder framing, the Sirin
// paragraph) for EVERY candidate. Neutral rules read stored data; Gabriel's
// wording survives via a name-guarded pin, and the Kanzen/Sirin paragraphs are
// company-guarded on the stored history itself.

test('002: Gabriel hardcodes are gone from __neutralCo, the main prompt and placeholders', () => {
  for (const gone of [
    'for Gabriel: "Processes • Products • People"',
    '"Electro-optics Engineer" / "Deep Tech"',
    'frame him as only an electro-optics engineer',
    'the two Innoviz roles',
    'Electro-Optics Engineer & Team Leader',
    'Innoviz Technologies | 2017 - 2025',
    '| Innoviz | 2020 - 2025',
    'do NOT describe Kanzen with',
    'MBA | Technion',
    'ASPICE | Requirements, traceability',
  ]) {
    assert.equal(count(src, gone), 0, 'src still has: ' + gone.slice(0, 50));
    assert.equal(count(app, gone), 0, 'app.js still has: ' + gone.slice(0, 50));
  }
});

test('002: persona-neutral replacements exist byte-identically in BOTH files', () => {
  for (const marker of [
    'OWN stored profile and work history (professional field + years of experience',
    'narrow specialist labels (a single technology, instrument or sub-discipline)',
    'the work I do best: <one narrow niche>',
    'NEVER a narrow specialist opener (GEN-PROFILE-001)',
    '(e.g. two or three consecutive roles at the same employer)',
    'framing for an own-consultancy engagement is allowed ONLY when',
    'System Architect & Change Control Lead | <company> | 2017 - 2025',
    'MBA | Business School',
  ]) {
    assert.equal(count(src, marker) >= 1, true, 'src missing: ' + marker.slice(0, 50));
    assert.equal(count(app, marker) >= 1, true, 'app.js missing: ' + marker.slice(0, 50));
  }
});

test('002: the Gabriel unsolicited pin is name-guarded, once, in BOTH files', () => {
  assert.equal(count(src, 'GABRIEL PROFILE + FOCUS PIN'), 1, 'pin once in src');
  assert.equal(count(app, 'GABRIEL PROFILE + FOCUS PIN'), 1, 'pin once in app.js');
  // his identity opener survives ONLY inside the pin
  assert.equal(count(src, 'IT professional with 15+ years in consumer and regulated markets'), 1);
  assert.equal(count(app, 'IT professional with 15+ years in consumer and regulated markets'), 1);
  assert.equal(count(src, '(/\\bgabriel\\b/i.test(String(ie().name || ""))'), 1, 'src pin guard');
  assert.equal(count(app, '(/\\bgabriel\\b/i.test(String(Fe().name||""))'), 1, 'app.js pin guard');
});

test('002: Kanzen + Sirin work-history paragraphs are company-guarded on the stored history', () => {
  assert.equal(count(src, '/kanzen/i.test(whText)'), 1, 'src kanzen guard');
  assert.equal(count(src, '/sirin/i.test(whText)'), 1, 'src sirin guard');
  assert.equal(count(app, '/kanzen/i.test(i)'), 1, 'app.js kanzen guard');
  assert.equal(count(app, '/sirin/i.test(i)'), 1, 'app.js sirin guard');
  // the guarded content is kept, once each
  assert.equal(count(src, 'SIRIN LABS — TEAM-LEADERSHIP SEMANTICS'), 1);
  assert.equal(count(app, 'SIRIN LABS — TEAM-LEADERSHIP SEMANTICS'), 1);
  assert.equal(count(src, 'Kanzen Konsulenter ApS engagement'), 1);
  assert.equal(count(app, 'Kanzen Konsulenter ApS engagement'), 1);
});

// ============================================================
// GEN-DEHARDCODE-003 (owner 2026-07-03, third sweep): four Gabriel-flavored
// example lists still reached every persona — the translator KEEP-VERBATIM
// examples (Innoviz / Sirin Labs / Pan Idræt / Copenhagen Wolves RFC, LiDAR /
// Power BI / Codebeamer), the tools-category taxonomy shaped on his
// hardware/optics/PM background (Zemax / OpticStudio / EO design), the
// certification-relevance examples (BABOK / Six Sigma / ASPICE / "Prøve i
// dansk 2"), the PATENTS bullet quoting his cover-window patent work, and the
// LANG-CROSS-001 invariant list naming his metrics (250, 10, $8M, 7-person)
// and tech (LiDAR, SWIR, SPAD, SiPM). All five replaced by persona-neutral
// shape descriptions; the candidate's stored data supplies the specifics.

test('003: Gabriel example lists are gone from translator + gen prompt in BOTH files', () => {
  for (const gone of [
    // (1) translator KEEP VERBATIM examples
    'Innoviz, Sirin Labs, Pan Idræt, Copenhagen Wolves RFC',
    'LiDAR, Power BI, Codebeamer',
    // (5) LANG-CROSS-001 metrics + niche-tech examples
    '$8M, 7-person',
    'LiDAR, SWIR, FPGA, SPAD, SiPM',
    // (2) tools-category taxonomy example
    'hardware/optics/PM background',
    'Zemax, OpticStudio, Code V',
    // (3) certification-relevance examples
    'BABOK for BA roles',
    'for Denmark-local roles',
    // (4) PATENTS bullet example
    'cover-window geometry reducing optical crosstalk',
  ]) {
    assert.equal(count(src, gone), 0, 'src still has: ' + gone.slice(0, 50));
    assert.equal(count(app, gone), 0, 'app.js still has: ' + gone.slice(0, 50));
  }
});

test('003: persona-neutral replacements exist in BOTH files', () => {
  for (const marker of [
    'employers, clubs, associations — even small local ones',
    'technology names (tools, platforms, protocols)',
    '(e.g. 30%, 10×, $2M, 5-person, ~25)',
    'FMEA, MBSE); and quoted',
    // S3 quoting differs per file (\" in src, raw " in app.js) — quote-free substrings
    'category labels and tools MUST come from the candidate',
    '(their named methods and standards)',
    'judge each stored certification by its OWN domain',
    'a language certificate for roles local to that language',
    'the design or engineering change the patent covers, described in plain words',
  ]) {
    assert.equal(count(src, marker) >= 1, true, 'src missing: ' + marker.slice(0, 50));
    assert.equal(count(app, marker) >= 1, true, 'app.js missing: ' + marker.slice(0, 50));
  }
});

test('002: worker writing-style-engine pair is byte-identical and metric examples are persona-neutral', async () => {
  const eng = await readFile(new URL('../../../workers/proxy/src/writing-style-engine.js', import.meta.url), 'utf8');
  const demo = await readFile(new URL('../../../workers/demo-proxy/src/writing-style-engine.js', import.meta.url), 'utf8');
  assert.equal(eng === demo, true, 'proxy/demo-proxy engine drifted');
  for (const gone of ['241997', '250→10 day cycle', '7-engineer team']) {
    assert.equal(count(eng, gone), 0, 'engine still has: ' + gone);
  }
  assert.equal(count(eng, 'metric shapes: a cycle-time change, a % improvement') >= 1, true, 'neutral metric shapes missing');
});
