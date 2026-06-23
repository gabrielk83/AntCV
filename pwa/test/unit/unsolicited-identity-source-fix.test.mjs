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

test('source + mirror both carry the transform at all 3 sites', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  const srcMarker = 'Object.assign({}, m, { company: "Unsolicited", role: "Open Application" })';
  const minMarker = 'Object.assign({},m,{company:"Unsolicited",role:"Open Application"})';
  const srcN = src.split(srcMarker).length - 1;
  const minN = min.split(minMarker).length - 1;
  assert.equal(srcN, 3, 'app.src.js must have the sanitize at restore + 2 persist sites');
  assert.equal(minN, 3, 'app.js mirror must have the sanitize at restore + 2 persist sites');
});

test('restore-side rationale guard present in both bundles', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  // the contaminated-slot rationale skip
  assert.ok(src.includes('if (t.rationale && !(t.meta && t.meta.company && "Unsolicited" !== String(t.meta.company).trim()))'), 'src rationale guard');
  assert.ok(min.includes('if(t.rationale&&!(t.meta&&t.meta.company&&"Unsolicited"!==String(t.meta.company).trim()))'), 'min rationale guard');
});
