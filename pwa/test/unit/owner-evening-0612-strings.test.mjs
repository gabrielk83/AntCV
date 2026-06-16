// owner-evening-0612-strings.test.mjs
// ============================================================
// String-presence locks for the 2026-06-12 EVENING owner batch — built
// app.js bundle contracts:
//   1. RECOMMENDATIONS-SECTION-001: skeleton section after experience +
//      backfill + da/es/zh titles;
//   2. SPEC-CATCHY-001: standing specialization line rule (unsolicited
//      append + simple-and-catchy);
//   3. work-style ends with a people skill (prompt rule);
//   4. patent numbers never dropped (prompt rule);
//   5. accessibility explicitly hearing-impaired (prompt rule + schema);
//   6. PUNCTUATION DASH RULE — "-" never "—";
//   7. ADV-SPACING-CONTROLS-001: slider keys present;
//   8. LINKEDIN-CLICK-001 + CONTACT-LOCAL-FORM-001 markers;
//   9. NO-JUSTIFY-GAPS-001: no sidebar justify ternaries remain.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('RECOMMENDATIONS-SECTION-001 — skeleton + translations (placement consolidated to sidecar)', () => {
  assert.ok(bundle.includes('Danish and international recommenders on request.'));
  assert.ok(bundle.includes('"RECOMMENDATIONS"') || /RECOMMENDATIONS:/.test(bundle));
  assert.ok(bundle.includes('REFERENCER'));
  assert.ok(bundle.includes('RECOMENDACIONES'));
  assert.ok(bundle.includes('推荐人'));
});

test('SPEC-CATCHY-001 — standing specialization line + unsolicited append', () => {
  // SPEC-SEPARATOR-001 (owner 2026-06-13): bullets, never asterisks.
  assert.ok(bundle.includes('Processes • Products • People'));
  assert.ok(!bundle.includes('Processes*Products*People'));
  assert.ok(bundle.includes('SPECIALIZATION LINE (meta.subtitle)'));
  // SPEC-SCOPE-001 reworded the rule: "simple, catchy and SMART"
  assert.ok(bundle.includes('simple, catchy and SMART'));
});

test('SPEC-SEPARATOR-001 — stored "*" separators normalized on read + in stored subtitle', () => {
  // GABRIEL_BG read-side normalization (regex literal survives minification)
  assert.ok(bundle.includes(String.raw`/\s*\*\s*/g`));
  assert.ok(bundle.includes('" • "'));
  // one-shot stored-subtitle rewrite effect trigger
  assert.ok(bundle.includes(String.raw`/\S\s*\*\s*\S/`));
});

test('RECOMMENDATIONS placement — consolidated into the restore-proof sidecar', () => {
  const sidecar = readFileSync(path.join(ROOT, 'antcv-sections-normalize-415.js'), 'utf8');
  // B9 (1.50.464): anchor now also matches the EXPERIENCE title (not just
  // EXPERTISE / type==='experience') so a mis-typed imported roles section is
  // still recognised and recs lands after the roles.
  assert.ok(sidecar.includes(String.raw`PROFESSIONAL EXPER(TISE|IENCE)`));
  assert.ok(sidecar.includes('placeRecs'));
  assert.ok(sidecar.includes('antcv:sections-updated'));
});

test('SPEC-SCOPE-001 — Gabriel-only default, tailored drafts get a fresh smart line', () => {
  // name-guarded default (no Gabriel-line leak to other candidates)
  assert.ok(bundle.includes(String.raw`/\bgabriel\b/i`));
  // tailored drafts never reuse the standing line
  assert.ok(bundle.includes('do NOT reuse the standing line'));
  // no-standing-line candidates derive one
  assert.ok(bundle.includes('DERIVE one from the candidate'));
});

test('ROLE-DECOMP-001 — distinct roles decomposed, exact dups still collapsed (prompt + sidecar)', () => {
  // ROLE-DECOMP-001 (owner 2026-06-16): the prompt now DECOMPOSES (no longer
  // merges) — distinct same-company functions stay as separate positions, and a
  // combined-function title is split. The old merge rule is gone.
  assert.ok(bundle.includes('ROLE DECOMPOSITION (ROLE-DECOMP-001)'));
  assert.ok(!bundle.includes('DUPLICATE-ROLE MERGE (ROLE-DUP-001)'));
  // SECTIONS-CONSOLIDATE-001: the deterministic dedupe/founder/recs effects live
  // in the restore-proof sidecar; dedupeRoles now merges EXACT-title dups only.
  const sidecar = readFileSync(path.join(ROOT, 'antcv-sections-normalize-415.js'), 'utf8');
  assert.ok(sidecar.includes('dedupeRoles'));
  assert.ok(sidecar.includes('ROLE-DECOMP-001: exact-title dup only'));
  // the Customer-Change dedupe is retained but NOT applied (kept as a distinct position)
  assert.ok(sidecar.includes('// var cc = dropCustomerChangeDup'));
  assert.ok(sidecar.includes('stripFounder'));
  assert.ok(sidecar.includes('placeRecs'));
  assert.ok(sidecar.includes('PROFESSIONAL EXPER(TISE|IENCE)'));
  // and app.js no longer carries the removed effect's runtime marker
  assert.ok(!bundle.includes('[ROLE-DUP-001] merged'));
});

test('work-style people-skill close rule in the prompt', () => {
  assert.ok(bundle.includes('MUST END with a people skill'));
});

test('patent numbers never dropped', () => {
  assert.ok(bundle.includes('PATENT NUMBERS ARE NEVER DROPPED'));
});

test('accessibility explicitly hearing-impaired', () => {
  assert.ok(bundle.includes('HEARING-IMPAIRED person'));
  assert.ok(bundle.includes('hearing-impaired person; omit row only'));
});

test('punctuation dash rule', () => {
  assert.ok(bundle.includes('PUNCTUATION DASH RULE'));
  assert.ok(bundle.includes('NEVER output an em dash'));
});

test('ADV-SPACING-CONTROLS-001 — slider keys + helpers', () => {
  for (const k of ['bodyEdgePad', 'sidebarEdgePad', 'seamGap', 'mainSectionGap', 'sidebarSectionGap', 'bodySectionGap', 'candidateGap']) {
    assert.ok(bundle.includes(k), `missing ${k}`);
  }
});

test('LINKEDIN-CLICK + CONTACT-LOCAL-FORM markers', () => {
  assert.ok(bundle.includes('noopener noreferrer'));
  // owner correction 2026-06-12: postcode + district, with the comma
  assert.ok(bundle.includes('2300, København S'));
});

test('GEN-PROFILE-001 — unsolicited broad-identity opener rule', () => {
  assert.ok(bundle.includes('PROFILE OPENER (GEN-PROFILE-001)'));
  assert.ok(bundle.includes('IT professional with 15+ years in consumer and regulated markets'));
  assert.ok(bundle.includes('Electro-optics and LiDAR architect'));
});

test('NO-JUSTIFY-GAPS — no sidebar justify ternaries remain in the source', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  assert.ok(!/\? "center"\s*\r?\n\s*: "justify"/.test(src), 'sidebar center/justify ternary still present');
  assert.ok(!src.includes('textAlign: S ? "justify" : "left"'), 'sidebar S-justify ternary still present');
});
