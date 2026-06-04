// AntCV — import / personalInfo normalisation (IMPORT-001 contract)
// ============================================================
//
// Canonical, dependency-free implementation of the import-mapping logic
// that IMPORT-001 depends on. It mirrors, exactly, two pieces that today
// live inline inside loaded sidecars:
//
//   - antcv-upload-recount-339.js : the dual-key cross-population
//     (workHistory <-> experience, publications <-> publicationsStructured)
//     and the upload-summary counts. The React app and the wizard summary
//     read `workHistory`/`publications`; the importer writes
//     `experience`/`publicationsStructured`. Without the cross-fill the
//     summary reports "0 work entries" even though the data imported fine.
//
//   - antcv-data-importer.js : the experience -> sections.cv.experience.roles
//     mapping. A JSON fragment (e.g. the Anita persona) sets
//     personalInfo.experience, but the React CV reads roles from
//     sections.cv.experience.roles, so the work never appears until the
//     rows are bridged across.
//
// This module is the single tested source of that contract. The drift
// guard in test/unit/import-normalize.test.mjs checks the sidecars still
// encode the same keys, so a rename in either place is caught in CI.
//
// Pure functions only — no DOM, no localStorage, no side effects beyond
// the documented in-place mutation in normalizePersonalInfo.

// The two key pairs that name the same data under different schema
// versions. First element is the name the consumer (React app / wizard
// summary) reads; second is the name the importer writes.
export const DUAL_KEYS = [
  ['workHistory', 'experience'],
  ['publications', 'publicationsStructured'],
];

export function arrLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

/**
 * Cross-populate the dual keys so a consumer that reads either name finds
 * the data. Fills only the empty side from a populated side; never
 * overwrites a populated array. Mutates `pi` in place (mirroring the
 * sidecar, which then writes pi back to localStorage) and reports whether
 * anything changed.
 *
 * @param {object|null} pi personalInfo object
 * @returns {{ changed: boolean, personalInfo: object|null }}
 */
export function normalizePersonalInfo(pi) {
  if (!pi || typeof pi !== 'object') return { changed: false, personalInfo: pi };
  let changed = false;
  for (let i = 0; i < DUAL_KEYS.length; i++) {
    const a = DUAL_KEYS[i][0];
    const b = DUAL_KEYS[i][1];
    const la = arrLen(pi[a]);
    const lb = arrLen(pi[b]);
    if (la === 0 && lb > 0) {
      // Shallow copy so later mutation of one side does not silently
      // alter the other.
      pi[a] = pi[b].slice();
      changed = true;
    } else if (lb === 0 && la > 0) {
      pi[b] = pi[a].slice();
      changed = true;
    }
  }
  return { changed, personalInfo: pi };
}

/**
 * The four counts the wizard upload summary reports. Uses the same
 * fallback order the sidecar uses, so the count is correct whichever
 * schema name the importer happened to write.
 *
 * @param {object|null} pi personalInfo object
 * @returns {{ work: number, education: number, certifications: number, publications: number }}
 */
export function importSummaryCounts(pi) {
  const p = pi && typeof pi === 'object' ? pi : {};
  const work = Array.isArray(p.workHistory) ? p.workHistory.length
    : Array.isArray(p.experience) ? p.experience.length : 0;
  const education = Array.isArray(p.education) ? p.education.length : 0;
  const certifications = Array.isArray(p.certifications) ? p.certifications.length : 0;
  const publications = Array.isArray(p.publicationsStructured) ? p.publicationsStructured.length
    : Array.isArray(p.publications) ? p.publications.length : 0;
  return { work, education, certifications, publications };
}

/**
 * Map personalInfo.experience entries into the role rows the React CV
 * reads from sections.cv.experience.roles. Accepts the several field
 * spellings that diverged across schema versions (title/role,
 * years/dates/startDate+endDate, bullets/description). Drops rows that
 * carry neither a title nor a company.
 *
 * @param {Array|null} expArr personalInfo.experience
 * @returns {Array<{id:string,title:string,company:string,years:string,on:boolean,bullets:string[]}>}
 */
export function mapExperienceToRoles(expArr) {
  if (!Array.isArray(expArr)) return [];
  return expArr.map((e, i) => ({
    id: e && e.id ? String(e.id) : 'r' + (i + 1),
    title: String((e && (e.title || e.role)) || '').trim(),
    company: String((e && e.company) || '').trim(),
    years: String((e && (e.years || e.dates || ''))).trim()
      || [e && e.startDate, e && e.endDate].filter(Boolean).join(' – '),
    on: true,
    bullets: Array.isArray(e && e.bullets)
      ? e.bullets.map((b) => String(b || '').trim()).filter(Boolean)
      : (e && e.description ? [String(e.description).trim()] : []),
  })).filter((r) => r.title || r.company);
}

export default {
  DUAL_KEYS,
  arrLen,
  normalizePersonalInfo,
  importSummaryCounts,
  mapExperienceToRoles,
};
