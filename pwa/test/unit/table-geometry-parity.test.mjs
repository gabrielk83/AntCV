// TABLE-GEOMETRY-PARITY-001 (OPEN_REGISTER row 25, 2026-07-13) — regression lock.
//
// Two fidelity gaps between the Core-Competencies preview and the exported PDF:
//
//   1. PREVIEW FONT (root cause). The preview rendered the competency cell at
//      Math.round(1.333 * 10pt) = 13px = 0.975x the true 10pt (13.333px @96dpi).
//      Labels measured 2.56% narrower than the exported Carlito 10pt, so the
//      owner dragged the splitter ~0.5pp below the ratio the PDF needs and the
//      PDF wrapped first-column labels to two lines. Fix: render the competency
//      cell at the UNROUNDED (4/3)*mainTblCell so the preview one-line threshold
//      matches the export. $.tbl is used ONLY by the competency-table render.
//
//   2. WIDTH FORWARDER (latent, width-handle path). The client width forwarder
//      still referenced 6630 dxa (stale MAIN_W-640 centered geometry) while the
//      deployed worker renderCompetencyTable default is mainW-288 = 7689 dxa.
//      Any non-default width drag forwarded a CV table ~14% narrower than both
//      the preview and the worker default. Fix: 6630 -> 7689.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');
const docxClient = readFileSync(join(PWA, 'antcv-docx-client.js'), 'utf8');

test('preview competency cell font is UNROUNDED true-10pt in app.src.js', () => {
  // The competency cell size must NOT be the rounded N(_.mainTblCell) = 13px.
  assert.equal(
    /tbl:\s*N\(_\.mainTblCell\)/.test(src),
    false,
    'app.src.js still rounds the competency cell font (tbl: N(_.mainTblCell)) — reintroduces the 2.56% preview/export wrap gap',
  );
  // It must be the unrounded 4/3 * mainTblCell (true pt->px @96dpi = 13.333px).
  assert.ok(
    /tbl:\s*\(4\s*\/\s*3\)\s*\*\s*_\.mainTblCell/.test(src),
    'app.src.js competency cell font must be (4 / 3) * _.mainTblCell (unrounded true 10pt)',
  );
});

test('minified app.js mirrors the unrounded competency cell font', () => {
  assert.equal(
    /tbl:F\(z\.mainTblCell\)/.test(app),
    false,
    'app.js still rounds the competency cell font (tbl:F(z.mainTblCell)) — app.src.js edited but NOT mirrored',
  );
  assert.ok(
    /tbl:4\/3\*z\.mainTblCell/.test(app),
    'app.js competency cell font must be the unrounded 4/3*z.mainTblCell mirror',
  );
});

test('docx-client CV table width reference is 7689 (mainW-288), not stale 6630', () => {
  // The two live forwarders both compute `(_isClTable/cl ? 11506 : <CV ref>)`.
  // The CV ref must be 7689 (mainW-288), never the stale 6630. Match the CODE
  // expression (a trailing "6630" in a traceability comment is allowed).
  assert.equal(
    /11506\s*:\s*6630/.test(docxClient),
    false,
    'antcv-docx-client.js still forwards the stale 6630 CV table width (MAIN_W-640) — forwards a table ~14% narrower than the worker default on a width drag',
  );
  const count = (docxClient.match(/11506\s*:\s*7689/g) || []).length;
  assert.ok(
    count >= 2,
    `expected >=2 live forwarders using 7689 (computeTableWidthDxa + inline table case), found ${count}`,
  );
});
