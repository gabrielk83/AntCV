// ca006-pathc-header-guard.test.mjs
// ============================================================
// CA-006 (register row 43): the "Application: <role> - <company>" sentence bled
// into the FIRST experience role title. Root cause: on Path C, findCandidateBlock()
// falls back to the WHOLE preview paper, and the anchor search matched the first
// experience role line (same role/company text) whose [data-sid] ancestor was lost
// on paginated/merged renders. Fix: on Path C ONLY (block is the whole paper),
// require the anchor to live inside a positive candidate-header marker — strictly
// additive (can only reject anchors, never create a bleed), inert on Paths A/B.
//
// Source-level regression lock: the sidecar is DOM-heavy (no jsdom in this repo),
// so this asserts the Path-C header-only guard is present in BOTH anchor loops and
// keyed off the candidate-band marker + the whole-paper detection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../antcv-candidate-preview-editor-341.js', import.meta.url), 'utf8');

test('the whole-paper (Path C) detection uses block.matches on the preview paper', () => {
  const hits = src.match(/block\.matches\('\.antcv-preview-paper, \[data-antcv-preview-paper\]'\)/g) || [];
  assert.ok(hits.length >= 2, 'both anchor loops detect Path C via the preview-paper matcher');
});

test('the Application-sentence loop has the Path-C header-only guard keyed on the candidate band', () => {
  assert.ok(/var wholePaper = false;/.test(src), 'wholePaper flag present');
  assert.ok(/if \(wholePaper\) \{ try \{ if \(!el\.closest\(CAND_REGION_SEL\)\) continue; \}/.test(src),
    'Application loop rejects non-candidate anchors on Path C');
  assert.ok(/CAND_REGION_SEL = '\[data-antcv-candidate-band="1"\]/.test(src),
    'candidate-band marker leads the whitelist selector');
});

test('the Specialisation loop has the same Path-C header-only guard', () => {
  assert.ok(/var subWholePaper = false;/.test(src), 'subWholePaper flag present');
  assert.ok(/if \(subWholePaper\) \{ try \{ if \(!el\.closest\(subCandRegionSel\)\) continue; \}/.test(src),
    'Specialisation loop rejects non-candidate anchors on Path C');
});

test('the original [data-sid] content-section blacklist is retained (defence in depth)', () => {
  assert.ok(/CONTENT_SECTION_SEL/.test(src), 'blacklist selector still present');
  assert.ok(/if \(inContentSection\(el\)\) continue;/.test(src), 'blacklist still applied in the Application loop');
});
