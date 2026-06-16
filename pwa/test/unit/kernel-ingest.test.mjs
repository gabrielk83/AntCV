/* Unit test — IMPORT-INGEST / CONFLICT / GAP (kernel v2 §4 engine).
 * Pure deterministic ingestion logic: extract → structural inference → gap flag →
 * create/merge with keep-both-and-flag. NO fabrication. No DOM/localStorage. */
import test from 'node:test';
import assert from 'node:assert';
import { parseTextToDraft, inferStructural, detectGaps, mergeKernels, ingest, detectSourceLang } from '../../antcv-kernel-ingest.js';

const CV = `Gabriel Karp
karp@example.com
+45 31 71 00 72

WORK EXPERIENCE

Product Manager — Acme Corp (2022 – Present)
- Built the product roadmap.
- Cut cycle time from 250 to 10 days.

System Architect — Acme Corp (2020 – 2023)
- Owned the system architecture.

Computer Administrator — IDF (2001 – 2003)
- Ran the unit help desk.

EDUCATION
M.Sc. — Tel Aviv University (2007 - 2010)
`;

test('4a parse: extracts roles, dates, isCurrent, contact (no fabrication)', () => {
  const d = parseTextToDraft(CV);
  assert.equal(d.experience.length, 3, 'three roles');
  const pm = d.experience[0];
  assert.match(pm.title, /Product Manager/);
  assert.match(pm.company, /Acme Corp/);
  assert.equal(pm.start, '2022');
  assert.equal(pm.isCurrent, true, 'Present → isCurrent');
  assert.equal(d.experience[1].isCurrent, false, '2020–2023 → not current');
  assert.equal(d.personalInfo.email, 'karp@example.com');
  assert.ok(d.personalInfo.phone && /31/.test(d.personalInfo.phone));
  // scope captured, but NO invented outcomes/proofPoints
  assert.ok(pm.scope.length >= 2);
  assert.equal(pm.outcomes.length, 0, 'no fabricated outcomes');
});

test('4b/4e infer: isCurrent flag, IDF hidden default, merge candidates, new-user defaults', () => {
  const k = inferStructural(parseTextToDraft(CV));
  const idf = k.experience.find((r) => /IDF/.test(r.company));
  assert.equal(idf.on, false, 'GEN-IDF-001: IDF hidden by default (flippable, not deleted)');
  assert.ok(k.experience.find((r) => /Product Manager/.test(r.title)).on !== false, 'current role stays visible');
  assert.ok(k._mergeCandidates.length >= 1, 'same-company overlap flagged as a merge CANDIDATE');
  assert.equal(k.tenseMode, 'auto');
  assert.deepEqual(k.language.activeDefaults, [k.language.sourceLang], 'ONBOARD-LANG-001: activeDefaults = detected sourceLang only');
  assert.ok(k.experience[0].langInvariantTokens.includes('Acme Corp'), 'company is an invariant token');
});

test('4c gaps: roles missing outcomes/proofPoints are flagged, never auto-filled', () => {
  const k = inferStructural(parseTextToDraft(CV));
  const gaps = detectGaps(k);
  assert.ok(gaps.length >= 1, 'gaps surfaced');
  const pmGap = gaps.find((g) => /Product Manager/.test(g.role));
  assert.ok(pmGap.missing.includes('outcomes') && pmGap.missing.includes('proofPoints'));
});

test('4d create: no existing kernel → build fresh', () => {
  const r = ingest(CV, null);
  assert.equal(r.mode, 'create');
  assert.ok(r.kernel.experience.length === 3);
});

test('4d merge: same role with a DIFFERENT metric → keep both + FLAG, never overwrite', () => {
  const existing = { experience: [
    { id: 'pm', title: 'Product Manager', company: 'Acme Corp', start: '2022', end: 'present',
      outcomes: [{ title: 'cycle', result: 'Cut cycle from 250 to 10 days.' }], scope: ['Roadmap.'] },
  ] };
  const incoming = { experience: [
    { id: 'pm', title: 'Product Manager', company: 'Acme Corp', start: '2022', end: 'present',
      outcomes: [{ title: 'cycle', result: 'Cut cycle from 300 to 12 days.' }], scope: ['Backlog grooming.'] },
  ] };
  const { kernel, mode, conflicts } = mergeKernels(existing, incoming);
  assert.equal(mode, 'merge');
  const c = conflicts.find((x) => x.role === 'Product Manager');
  assert.ok(c && c.fields.some((f) => f.field === 'metrics'), 'metric difference flagged as a conflict');
  // existing metric is PRESERVED (not auto-overwritten by the incoming 300→12)
  assert.match(kernel.experience[0].outcomes[0].result, /250 to 10 days/);
  // non-conflicting new scope DID merge in additively
  assert.ok(kernel.experience[0].scope.some((s) => /Backlog/.test(s)));
});

test('detectSourceLang: English default; Danish detected on signal', () => {
  assert.equal(detectSourceLang('Product Manager with experience in development.'), 'en');
  assert.equal(detectSourceLang('Erfaring med udvikling og ansvar for projekt i en virksomhed, nuværende rolle.'), 'da');
});
