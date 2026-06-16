/* Unit test — IMPORT-INGEST / CONFLICT / GAP (kernel v2 §4 engine).
 * Pure deterministic ingestion logic: extract → structural inference → gap flag →
 * create/merge with keep-both-and-flag. NO fabrication. No DOM/localStorage. */
import test from 'node:test';
import assert from 'node:assert';
import { parseTextToDraft, inferStructural, detectGaps, mergeKernels, ingest, detectSourceLang, detectImportKind, extractTextFromFile, ingestFile, projectV2ToWorkHistory } from '../../antcv-kernel-ingest.js';

// File-like stub (node): name/type + async text().
const fileOf = (name, content, type = '') => ({ name, type, text: async () => content });

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

// ── Slice 2: file → text ────────────────────────────────────────────────────
test('Slice2 detectImportKind: dispatch by name/type', () => {
  assert.equal(detectImportKind({ name: 'cv.docx' }), 'docx');
  assert.equal(detectImportKind({ name: 'cv.pdf' }), 'pdf');
  assert.equal(detectImportKind({ name: 'cv.txt' }), 'text');
  assert.equal(detectImportKind({ name: 'kernel.json' }), 'json');
  assert.equal(detectImportKind({ name: 'scan.png' }), 'image');
  assert.equal(detectImportKind({ name: 'cv.docx', type: '' }), 'docx');
  assert.equal(detectImportKind({ name: 'weird.bin' }), 'unknown');
});

test('Slice2 extract + ingest a .txt CV end-to-end', async () => {
  const r = await ingestFile(fileOf('cv.txt', CV), null);
  assert.equal(r.mode, 'create');
  assert.equal(r.kernel.experience.length, 3);
  assert.ok(r.gaps.length >= 1);
});

test('Slice2 a kernel .json bypasses the parser and create/merges directly', async () => {
  const kernelJson = JSON.stringify({ experience: [
    { id: 'r1', title: 'Engineer', company: 'Beta', start: '2019', end: '2021',
      outcomes: [{ title: 't', result: 'Shipped X.' }], scope: ['Built X.'] },
  ] });
  const r = await ingestFile(fileOf('mykernel.json', kernelJson), null);
  assert.equal(r.mode, 'create');
  assert.equal(r.kernel.experience.length, 1);
  assert.equal(r.kernel.experience[0].title, 'Engineer');
});

test('reader bridge: projectV2ToWorkHistory maps v2 → the v1 STORED-WORK-HISTORY shape', () => {
  const kernel = { experience: [
    { id: 'pm', title: 'Product Manager', company: 'Acme', start: '2022', end: 'present', isCurrent: true,
      scope: ['Ran the roadmap.', 'Owned delivery.'],
      outcomes: [{ title: 'cycle', result: 'Cut cycle 250→10 days.' }], proofPoints: ['250→10.'], langInvariantTokens: ['Acme', '250'] },
    { id: 'sa', title: 'System Architect', company: 'Acme', start: '2017', end: '2020', isCurrent: false, scope: ['Defined the architecture.'] },
  ] };
  const wh = projectV2ToWorkHistory(kernel);
  assert.equal(wh.length, 2);
  assert.equal(wh[0].role, 'Product Manager');
  assert.equal(wh[0].company, 'Acme');
  assert.equal(wh[0].isCurrent, true);
  assert.match(wh[0].years, /2022.*present/);
  assert.deepEqual(wh[0].bullets, ['Ran the roadmap.', 'Owned delivery.']);   // scope → bullets
  assert.ok(wh[0].outcomes && wh[0].outcomes[0].result, 'outcomes carried for the lamination');
  assert.ok(wh[0].langInvariantTokens.includes('Acme'), 'invariant tokens carried for the language reader');
  assert.equal(wh[1].isCurrent, false);
  assert.match(wh[1].years, /2017.*2020/);
});

test('Slice2 unsupported / no-browser paths fail gracefully (no throw-at-import)', async () => {
  await assert.rejects(() => extractTextFromFile(fileOf('x.bin', '')), /Unsupported file/);
  // docx in node (no window.loadMammoth) → a helpful message, not a crash
  await assert.rejects(() => extractTextFromFile(fileOf('cv.docx', '')), /DOCX support not ready|browser/i);
});
