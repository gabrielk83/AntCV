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

test('RECOMMENDATIONS-SECTION-001 — skeleton + backfill + translations', () => {
  assert.ok(bundle.includes('Danish and international recommenders on request.'));
  assert.ok(bundle.includes('"RECOMMENDATIONS"') || /RECOMMENDATIONS:/.test(bundle));
  assert.ok(bundle.includes('REFERENCER'));
  assert.ok(bundle.includes('RECOMENDACIONES'));
  assert.ok(bundle.includes('推荐人'));
  assert.ok(bundle.includes('RECOMMENDATIONS-SECTION-001'));
});

test('SPEC-CATCHY-001 — standing specialization line + unsolicited append', () => {
  assert.ok(bundle.includes('Processes*Products*People'));
  assert.ok(bundle.includes('SPECIALIZATION LINE (meta.subtitle)'));
  assert.ok(bundle.includes('simple and catchy'));
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
  assert.ok(bundle.includes('2300 '));
});

test('NO-JUSTIFY-GAPS — no sidebar justify ternaries remain in the source', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  assert.ok(!/\? "center"\s*\r?\n\s*: "justify"/.test(src), 'sidebar center/justify ternary still present');
  assert.ok(!src.includes('textAlign: S ? "justify" : "left"'), 'sidebar S-justify ternary still present');
});
