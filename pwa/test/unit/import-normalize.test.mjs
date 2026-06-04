// Unit tests for the IMPORT-001 import / normalisation contract.
// Pure logic, no DOM. Run with:  node --test pwa/test/unit/
//
// Covers the dual-key cross-population, the upload-summary counts, and the
// experience -> roles mapping, plus a drift guard that fails if the two
// loaded sidecars stop encoding the same keys this module does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DUAL_KEYS,
  arrLen,
  normalizePersonalInfo,
  importSummaryCounts,
  mapExperienceToRoles,
} from '../../lib/import-normalize.js';

const here = new URL('.', import.meta.url);
const anita = JSON.parse(
  readFileSync(new URL('../../../docs/personas/anita/personalInfo.json', here), 'utf8'),
);

// ─── arrLen ──────────────────────────────────────────────────────────────

test('arrLen counts arrays and treats everything else as zero', () => {
  assert.equal(arrLen([1, 2, 3]), 3);
  assert.equal(arrLen([]), 0);
  assert.equal(arrLen(undefined), 0);
  assert.equal(arrLen('nope'), 0);
  assert.equal(arrLen({ length: 5 }), 0);
});

// ─── normalizePersonalInfo ───────────────────────────────────────────────

test('normalize: fills workHistory from experience when only experience is set', () => {
  const pi = { experience: [{ title: 'A' }, { title: 'B' }] };
  const { changed, personalInfo } = normalizePersonalInfo(pi);
  assert.equal(changed, true);
  assert.equal(arrLen(personalInfo.workHistory), 2);
  // Shallow copy, not the same array reference.
  assert.notEqual(personalInfo.workHistory, personalInfo.experience);
  assert.deepEqual(personalInfo.workHistory, personalInfo.experience);
});

test('normalize: fills experience from workHistory when only workHistory is set', () => {
  const pi = { workHistory: [{ title: 'A' }] };
  const { changed, personalInfo } = normalizePersonalInfo(pi);
  assert.equal(changed, true);
  assert.equal(arrLen(personalInfo.experience), 1);
});

test('normalize: cross-fills publications <-> publicationsStructured', () => {
  const pi = { publicationsStructured: [{ name: 'P' }] };
  normalizePersonalInfo(pi);
  assert.equal(arrLen(pi.publications), 1);
});

test('normalize: never overwrites a populated side', () => {
  const pi = {
    workHistory: [{ title: 'kept' }],
    experience: [{ title: 'one' }, { title: 'two' }],
  };
  const { changed } = normalizePersonalInfo(pi);
  assert.equal(changed, false);
  assert.equal(pi.workHistory.length, 1);
  assert.equal(pi.experience.length, 2);
});

test('normalize: no-op on empty / non-object input', () => {
  assert.deepEqual(normalizePersonalInfo(null), { changed: false, personalInfo: null });
  assert.equal(normalizePersonalInfo({}).changed, false);
  assert.equal(normalizePersonalInfo({ experience: [] }).changed, false);
});

// ─── importSummaryCounts ─────────────────────────────────────────────────

test('counts: experience-only JSON reports the right work count (the IMPORT-001 symptom)', () => {
  // Before normalisation, the importer wrote `experience` but the summary
  // read `workHistory` and showed 0. The fallback fixes the count.
  const pi = { experience: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] };
  assert.equal(importSummaryCounts(pi).work, 3);
});

test('counts: prefers workHistory and publicationsStructured when both names exist', () => {
  const pi = {
    workHistory: [1, 2], experience: [1],
    publicationsStructured: [1, 2, 3], publications: [1],
    education: [1], certifications: [1, 2],
  };
  assert.deepEqual(importSummaryCounts(pi), { work: 2, education: 1, certifications: 2, publications: 3 });
});

test('counts: the Anita persona reports four work entries, not zero', () => {
  // Anita's JSON sets `experience` (4) with `workHistory` absent — exactly
  // the fragment IMPORT-001 describes.
  assert.equal(arrLen(anita.workHistory), 0);
  assert.equal(arrLen(anita.experience), 4);
  const counts = importSummaryCounts(anita);
  assert.equal(counts.work, 4);
  assert.equal(counts.education, 2);
  assert.equal(counts.certifications, 5);
  assert.equal(counts.publications, 3);
});

// ─── mapExperienceToRoles ────────────────────────────────────────────────

test('roles: maps the canonical experience shape (title/company/years/bullets)', () => {
  const roles = mapExperienceToRoles([
    { title: 'PM', company: 'Acme', years: '2020-2023', bullets: ['shipped X', ' ', 'cut Y'] },
  ]);
  assert.equal(roles.length, 1);
  assert.deepEqual(roles[0], {
    id: 'r1', title: 'PM', company: 'Acme', years: '2020-2023', on: true,
    bullets: ['shipped X', 'cut Y'], // blank bullet dropped
  });
});

test('roles: accepts the divergent field spellings (role/dates/description)', () => {
  const roles = mapExperienceToRoles([
    { role: 'Engineer', company: 'Beta', dates: '2018-2020', description: 'built the thing' },
  ]);
  assert.equal(roles[0].title, 'Engineer');
  assert.equal(roles[0].years, '2018-2020');
  assert.deepEqual(roles[0].bullets, ['built the thing']);
});

test('roles: derives years from startDate + endDate when no years/dates', () => {
  const roles = mapExperienceToRoles([
    { title: 'X', company: 'Y', startDate: '2015', endDate: '2017' },
  ]);
  assert.equal(roles[0].years, '2015 – 2017');
});

test('roles: keeps a given id and synthesises r{n} otherwise', () => {
  const roles = mapExperienceToRoles([{ id: 'abc', title: 'A' }, { title: 'B' }]);
  assert.equal(roles[0].id, 'abc');
  assert.equal(roles[1].id, 'r2');
});

test('roles: drops entries with neither title nor company', () => {
  const roles = mapExperienceToRoles([{ years: '2020' }, { title: 'keep' }]);
  assert.equal(roles.length, 1);
  assert.equal(roles[0].title, 'keep');
});

test('roles: non-array input yields an empty list', () => {
  assert.deepEqual(mapExperienceToRoles(null), []);
  assert.deepEqual(mapExperienceToRoles({}), []);
});

test('roles: the Anita persona maps to four usable rows', () => {
  const roles = mapExperienceToRoles(anita.experience);
  assert.equal(roles.length, 4);
  for (const r of roles) {
    assert.ok(r.title || r.company, 'each row has a title or company');
    assert.equal(r.on, true);
    assert.ok(Array.isArray(r.bullets));
  }
});

// ─── Drift guard: the loaded sidecars must still encode this contract ─────
// Static check (no execution of the sidecars). If someone renames a key in
// the sidecar but not here (or the reverse), this fails before merge — the
// same protection registry-sync gives the writing engine.

const pwaRoot = new URL('../../', here);
const recountSrc = readFileSync(new URL('antcv-upload-recount-339.js', pwaRoot), 'utf8');
const importerSrc = readFileSync(new URL('antcv-data-importer.js', pwaRoot), 'utf8');

test('drift: recount sidecar still encodes the dual-key pairs', () => {
  for (const [a, b] of DUAL_KEYS) {
    assert.ok(recountSrc.includes(a), `recount sidecar lost key "${a}"`);
    assert.ok(recountSrc.includes(b), `recount sidecar lost key "${b}"`);
  }
});

test('drift: importer sidecar still maps experience into sections.cv.experience', () => {
  assert.ok(importerSrc.includes('sections.cv.experience'), 'importer lost the experience->sections bridge');
  // The field spellings this module accepts must remain referenced.
  for (const token of ['title', 'role', 'company', 'years', 'dates', 'bullets', 'description']) {
    assert.ok(importerSrc.includes(token), `importer no longer references "${token}"`);
  }
});
