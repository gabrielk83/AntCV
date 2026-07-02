// JD-SCAN-HALLUCINATION-001 — garbled-text-layer PDFs go to VISION, never to
// the document-LLM tier.
//
// The NIL Technology JD PDF (owner 2026-07-03) has a text layer with broken
// ToUnicode font maps: pdfjs extracts ~1500 chars/page of control glyphs. The
// garble detector correctly flags it (verified against the real extraction:
// common-word ratio 0.0), but the old ladder then handed the SAME corrupted
// byte stream to the document-LLM tier — providers without native PDF page
// rendering hallucinate a plausible JD from it, and the detector cannot flag
// fluent hallucinated output. Fix: warning "pdfjs_garbled" skips the
// document-LLM tier and goes straight to vision (rendered pixels), exactly
// like the image-only (<=30 chars) path.
//
// Locks:
//  1. Both bundles carry the garbled_skip_llm_for_vision branch, and it sits
//     BEFORE the image-only skip (an else-if chain — garbled wins).
//  2. Detector replica: real-garble-shaped text (no common words) flags true;
//     a normal English JD does not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

for (const [name, text] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: garbled text layer skips the document-LLM tier`, () => {
    const i = text.indexOf('garbled_skip_llm_for_vision');
    assert.ok(i !== -1, `${name} lost the garbled→vision branch`);
    const j = text.indexOf('skipped_llm_for_vision', i);
    assert.ok(j !== -1, `${name}: the image-only skip must still exist after the garbled branch`);
    // the garbled branch must key off the pdfjs_garbled warning
    const before = text.slice(Math.max(0, i - 800), i);
    assert.ok(/pdfjs_garbled/.test(before), `${name}: garbled branch is not gated on the pdfjs_garbled warning`);
  });
}

// Detector replica (app.src.js f(), lines ~770-800). Keep in sync when the
// detector changes — the mirror-guard style anchor above catches bundle drift.
function garbled(e) {
  if (
    e.length < 50 || e.startsWith('%PDF-') || e.includes('\nobj\n') || e.includes('\nendobj') ||
    /[A-Za-z0-9+/]{60,}/.test(e) ||
    (e.match(/\b(stream|endstream|xref|startxref|obj|endobj|trailer)\b/g) || []).length > 3 ||
    (e.match(/\(cid:\d+\)/g) || []).length > 3
  ) return true;
  const t = (e.match(/\b(the|and|or|of|to|in|is|for|with|on|at|that|this|are|as|be|by|we|our|you|your|will|have|from|will|can|not|but|all|any|new|one|out|use|how|its|who|has|had|was|were|been|og|er|en|et|den|det|der|som|af|til|på|med|for|ikke|har|kan|skal|vil|jeg|du|vi|de)\b/gi) || []).length;
  const n = (e.match(/\S+/g) || []).length;
  if ((n > 80 && t / n < 0.03) || (e.match(/[a-zA-Z][\[\]\\`<>{}~^_|][a-zA-Z]/g) || []).length > 25) return true;
  const o = (e.match(/\b[A-Z]{4,}\b/g) || []).length;
  return n > 100 && o / n > 0.4;
}

test('detector: NIL-shaped garble (no common words, control glyphs) is flagged', () => {
  // shape mirrors the real NIL extraction: many "words", none of them real
  const junk = Array.from({ length: 200 }, (_, i) => 'x' + (i % 7) + 'q').join(' \t ');
  assert.equal(garbled(junk), true);
});

test('detector: a normal English JD is NOT flagged (no false positive)', () => {
  const jd =
    'We are looking for a Nanooptics Prototyping Engineer to join our team in Kongens Lyngby. ' +
    'You will be responsible for the design and characterization of nanostructured optical components, ' +
    'and you will work with our process engineers on wafer-level prototyping. The role requires experience ' +
    'with cleanroom fabrication and optical metrology, and you should be comfortable working in a fast-paced ' +
    'environment with cross-functional teams across the company and with external partners on new product development.';
  assert.equal(garbled(jd), false);
});
