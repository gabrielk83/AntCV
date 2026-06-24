/* Unit — CONTRIBUTE-CHAROBJ-FIX-001. The 760 migration's earlier Object.assign({}, r)
 * over a STRING item produced a char-indexed object {"0":"M","1":"a",...,mk:true}
 * that the rich_block renderer showed BLANK. The fixedA mapper now heals char-objects
 * back to {t} and normalises raw strings to {t} before any Object.assign. This tests
 * the heal logic in isolation (mirrors the mapper's row-normalisation step). */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirror of the row-normalisation introduced in antcv-hwic-to-rich-block-760.js.
function healRow(r) {
  let row = r;
  if (typeof r === 'string') { row = { t: r }; }
  else if (r && typeof r === 'object' && r.b == null && r.t == null && r.v == null && r.content == null && !r.grp) {
    const ck = Object.keys(r).filter((k) => /^\d+$/.test(k));
    if (ck.length) {
      const str = ck.sort((a, b) => (+a) - (+b)).map((k) => r[k]).join('');
      if (str) row = r.mk ? { t: str, mk: r.mk } : { t: str };
    }
  }
  return row;
}

test('char-indexed object reconstructs to {t} (owner contribute bullets)', () => {
  const corrupt = { '0': 'M', '1': 'a', '2': 'p', '3': ' ', '4': 't', '5': 'h', '6': 'e', mk: true };
  const out = healRow(corrupt);
  assert.equal(out.t, 'Map the');
  assert.equal(out.mk, true, 'preserves marker');
  assert.equal(out.b, undefined);
});

test('raw string normalises to {t}', () => {
  assert.deepEqual(healRow('Set up KPIs'), { t: 'Set up KPIs' });
});

test('a real {b,t} row is untouched', () => {
  const ok = { b: 'Lead-in:', t: 'body', mk: true };
  assert.equal(healRow(ok), ok, 'same reference — no change');
});

test('a {t} row is untouched', () => {
  const ok = { t: 'already fine' };
  assert.equal(healRow(ok), ok);
});

test('a {grp} marker is untouched', () => {
  const g = { grp: true, t: 'Group' };
  assert.equal(healRow(g), g);
});
