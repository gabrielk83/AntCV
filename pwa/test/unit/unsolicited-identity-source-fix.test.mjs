// unsolicited-identity-source-fix.test.mjs
// ============================================================
// UNSOLICITED-IDENTITY-SOURCE-FIX-001 (1.50.819): the kernel showcase cloud
// slot is BY DESIGN the unsolicited kernel (the restore guard returns when the
// live meta carries a real company). A slot left contaminated by an older
// targeted commit would re-inject that company's meta on every boot
// (UNSOLICITED-SHOWS-NVIDIA-001). The source fix sanitizes the slot meta at the
// read boundary (getShowcase restore) and the two write boundaries (putShowcase
// edit-persist + generation-commit), forcing Unsolicited/Open Application and
// dropping the JD-specific rationale while keeping the candidate's own subtitle.
//
// This test (a) behaviorally verifies the sanitize transform and (b) binds it to
// the real bundles by asserting the exact transform string appears at all three
// sites in BOTH app.src.js and the minified mirror app.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The sanitize used inline at all three sites (kept identical to the source).
function sanitize(m) {
  try {
    if (!m || 'object' != typeof m) return m;
    var co = String(m.company || '').trim();
    if (!co || 'Unsolicited' === co) return m;
    var c = Object.assign({}, m, { company: 'Unsolicited', role: 'Open Application' });
    try { delete c.rationale; } catch (_) {}
    return c;
  } catch (_) { return m; }
}

test('contaminated meta (real company) is forced to the unsolicited identity', () => {
  const out = sanitize({ company: 'NVIDIA', role: 'Test Engineer - Photonic', subtitle: 'Processes • Products • People', rationale: { fit: 'x' }, greeting: 'Dear Hiring Manager,' });
  assert.equal(out.company, 'Unsolicited');
  assert.equal(out.role, 'Open Application');
  assert.equal('rationale' in out, false, 'JD-specific rationale dropped');
  assert.equal(out.subtitle, 'Processes • Products • People', 'subtitle preserved');
  assert.equal(out.greeting, 'Dear Hiring Manager,', 'greeting preserved');
});

test('already-unsolicited meta is returned unchanged (same reference)', () => {
  const m = { company: 'Unsolicited', role: 'Open Application', subtitle: 'x' };
  assert.equal(sanitize(m), m);
});

test('empty / missing company is treated as unsolicited (no forcing)', () => {
  const m1 = { company: '', subtitle: 'x' };
  const m2 = { subtitle: 'x' };
  assert.equal(sanitize(m1), m1);
  assert.equal(sanitize(m2), m2);
});

test('non-object input passes through (null/undefined/string)', () => {
  assert.equal(sanitize(null), null);
  assert.equal(sanitize(undefined), undefined);
  assert.equal(sanitize('NVIDIA'), 'NVIDIA');
});

test('whitespace-only company is not a real company', () => {
  const m = { company: '   ', subtitle: 'x' };
  assert.equal(sanitize(m), m);
});

test('source + mirror both carry the transform at every showcase boundary', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  // The showcase slot is BY DESIGN the unsolicited kernel, so EVERY write/read
  // boundary sanitizes the meta. As of 1.51.239 there are 6 sites:
  //   • 2 generation-commit putShowcase (edit-persist + gen-commit)
  //   • 2 manual-save putShowcase (APP-HISTORY-KERNEL-SAVE-001, owner 2026-07-10)
  //   • 1 restore getShowcase
  //   • 1 AntcvApplyStyleKernel Load hook (APP-HISTORY-STYLE-KERNELS-001)
  // Whitespace-tolerant between tokens (but NOT inside the "Open Application"
  // literal) so a source site written in compact form (the
  // APP-HISTORY-KERNEL-SAVE-001 blocks are pasted minified) still counts —
  // otherwise a purely cosmetic formatting difference false-fails the guard.
  const marker = /Object\.assign\(\{\},\s*m,\s*\{\s*company:\s*"Unsolicited",\s*role:\s*"Open Application"\s*\}\)/g;
  const count = (s) => (s.match(marker) || []).length;
  const srcN = count(src);
  const minN = count(min);
  assert.equal(srcN, 6, 'app.src.js must sanitize all 6 showcase boundaries');
  assert.equal(minN, 6, 'app.js mirror must sanitize all 6 showcase boundaries');
  assert.equal(srcN, minN, 'source + minified mirror must not drift');
});

test('restore-side rationale guard present in both bundles', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  // the contaminated-slot rationale skip
  // UNSOL-PILLAR-LANG-001 (1.51.334): the guard now matches every language
  // variant of the sentinel via window.__antcvUnsol, not the English literal.
  assert.ok(src.includes('if (t.rationale && !(t.meta && t.meta.company && !window.__antcvUnsol(t.meta.company)))') || /t\.rationale && !\(t\.meta && t\.meta\.company && !window\.__antcvUnsol\(/.test(src), 'src rationale guard (pillar form)');
  assert.ok(/t\.rationale&&!\(t\.meta&&t\.meta\.company&&!window\.__antcvUnsol\(/.test(min), 'min rationale guard (pillar form)');
});
