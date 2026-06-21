// table-header-center.test.mjs
// ============================================================
// TABLE-HEADER-CENTER-001 (owner 2026-06-14): table headers must be CENTER by
// default. The React preview renders <th> with textAlign:center, but the
// section-align sidecar's reapply pass forced EVERY editable target to the
// section's alignment (default 'left'), overriding the header center so every
// table header looked left-aligned. Fix: applyAlignmentToSection skips
// <th>-contained editables — the header keeps its center and is owned by its
// own per-header control. Export already centers (worker s.headerAlign||center).
//
// The sidecar runs only in a real DOM (MutationObserver-driven) and the repo
// has no jsdom harness, so this locks the guard in the shipped sidecar source +
// the React <th> center default. Owner visual-confirms the rendered result.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sidecar = readFileSync(path.join(ROOT, 'antcv-section-align.js'), 'utf8');

test('applyAlignmentToSection skips <th> editables (header decoupled from body cycler)', () => {
  assert.ok(sidecar.includes("t.closest('th')"), 'missing <th> skip guard');
  // the guard must sit INSIDE applyAlignmentToSection, before the textAlign write
  const fnStart = sidecar.indexOf('function applyAlignmentToSection');
  assert.ok(fnStart !== -1, 'applyAlignmentToSection not found');
  const fnBody = sidecar.slice(fnStart, fnStart + 2600);
  const guardIdx = fnBody.indexOf("if (t.closest('th')) continue;");
  const writeIdx = fnBody.indexOf('t.style.textAlign = alignment');
  assert.ok(guardIdx !== -1, 'th guard not inside applyAlignmentToSection');
  assert.ok(writeIdx !== -1, 'textAlign write not found');
  assert.ok(guardIdx < writeIdx, 'th guard must precede the textAlign write');
});

test('core-competencies row-controls sidecar defaults the HEADER row (row 0) to center', () => {
  // The REAL preview aligner is antcv-core-competencies-row-controls-234.js:
  // applyPreview() forces getAlign(0) onto the <th> cells every sweep. getAlign
  // used to default every row (incl. row 0) to 'left', so the header was
  // force-left in the preview even though every export path centers it. Row 0
  // now defaults to CENTER; body rows default to JUSTIFIED (owner 2026-06-19,
  // CJLR-RESPECT-NATIVE-001); the native section.rowAlign + an explicit CJLR choice
  // still win.
  const sc = readFileSync(path.join(ROOT, 'antcv-core-competencies-row-controls-234.js'), 'utf8');
  assert.match(sc, /i===0 \? 'center' : 'justify'/);
  // getAlign reads the native rowAlign so the native CJLR drives the preview
  assert.ok(sc.includes('sec.rowAlign'));
  // HEADER-ALIGN-UNIFY-001 (1.50.802, owner "header dancing"): the header is aligned from
  // section.headerAlign — the SAME source the React render uses (1.50.795), default center —
  // so the sweep and React no longer fight. (Was getAlign(0) = rowAlign[0], a different source.)
  assert.ok(sc.includes('s.headerAlign'), 'header must read section.headerAlign');
  assert.ok(sc.includes('headerRows.forEach(r=>applyAlign(r,__hAlign))'), 'header aligned from __hAlign (headerAlign), not getAlign(0)');
});

test('React preview <th> default is textAlign:center (both header cells)', () => {
  const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
  const min = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  // two header cells, each with textAlign:center in the preview render
  const centerThCount = (src.match(/textAlign: "center"/g) || []).length;
  assert.ok(centerThCount >= 2, 'preview source lost the centered <th> default');
  assert.ok(min.includes('textAlign:"center"'), 'minified bundle lost the centered <th> default');
});
