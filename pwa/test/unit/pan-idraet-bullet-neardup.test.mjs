// PAN-IDRAET-BULLET-NEARDUP-001 — within-role near-duplicate bullets are collapsed
// on export, keeping the cleaner line, respecting KEEP_MIN, never falsely merging
// distinct bullets. Export-side only (stored sections / preview edit path untouched).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { _dedupNearBullets, _collapseRoleBullets, _keepMinBullets } =
  await import('../../antcv-docx-client.js');

// The real owner export-16 pair (Pan Idræt): same fact, "about 25" vs "25".
const B1 = 'Manage logistics for about 25 players and coaches, including travel and equipment';
const B2 = 'Coordinate match scheduling and referee assignments across the season';
const B3 = 'Manage logistics for 25 players, including travel bookings';

test('collapses the Pan Idraet near-dup, keeping the cleaner "25 players" line', () => {
  const out = _collapseRoleBullets({ title: 'Team Manager', company: 'Pan Idraet', bullets: [B1, B2, B3] });
  assert.equal(out.bullets.length, 2, 'one near-dup collapsed away');
  assert.ok(out.bullets.includes(B3), 'the cleaner "25 players" bullet survives');
  assert.ok(!out.bullets.includes(B1), 'the "about 25 players" bullet is dropped');
  assert.ok(out.bullets.includes(B2), 'the distinct bullet is preserved');
});

test('does NOT falsely collapse three distinct bullets', () => {
  const bullets = [
    'Build and maintain the CI pipeline and release automation',
    'Coordinate match scheduling and referee assignments across the season',
    'Author acceptance criteria and lead sprint reviews with stakeholders',
  ];
  assert.equal(_dedupNearBullets(bullets).length, 3);
  const role = { bullets };
  const out = _collapseRoleBullets(role);
  assert.equal(out, role, 'no-op returns the same role reference');
  assert.equal(out.bullets.length, 3);
});

test('KEEP_MIN=2: a 2-bullet near-dup role keeps BOTH (never drops below 2)', () => {
  const out = _collapseRoleBullets({ bullets: [B1, B3] });
  assert.equal(out.bullets.length, 2, 'both kept — KEEP_MIN floor');
  assert.deepEqual(out.bullets, [B1, B3]);
});

test('_keepMinBullets floor math', () => {
  assert.deepEqual(_keepMinBullets(['a', 'b'], ['a']), ['a', 'b']);   // 1 < min(2,2) -> original
  assert.deepEqual(_keepMinBullets(['a', 'b', 'c'], ['a', 'b']), ['a', 'b']); // 2 >= 2 -> collapsed
  assert.deepEqual(_keepMinBullets(['a'], []), ['a']);                // 0 < min(2,1)=1 -> original
});

test('handles {b,t} object bullets, preserving the winning object', () => {
  const o1 = { b: B1, align: 'left' };
  const o2 = { b: B2 };
  const o3 = { b: B3, align: 'left' };
  const out = _collapseRoleBullets({ bullets: [o1, o2, o3] });
  assert.equal(out.bullets.length, 2);
  assert.ok(out.bullets.includes(o3), 'the cleaner object reference survives untouched');
  assert.ok(!out.bullets.includes(o1));
  assert.ok(out.bullets.includes(o2));
});

test('anchor-clause (same verb+object headline, distinct tails) collapses even at low token overlap', () => {
  const a = 'Direct technical work across a 7-person EO and optics team for a high-security smartphone camera product';
  const b = 'Direct technical work across the imaging roadmap, defining sensor specifications and production validation gates';
  const out = _dedupNearBullets([a, b]);
  assert.equal(out.length, 1, 'same headline -> near-dup by anchor clause');
});

test('empty / non-text bullets pass through untouched', () => {
  assert.deepEqual(_dedupNearBullets(['', '  ', B2]), ['', '  ', B2]);
  assert.deepEqual(_dedupNearBullets([]), []);
  const role = { bullets: [] };
  assert.equal(_collapseRoleBullets(role), role, 'empty role untouched');
});
