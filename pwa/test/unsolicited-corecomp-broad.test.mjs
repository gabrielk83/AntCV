/* GEN-CORECOMP-BROAD-001 regression guard (owner 2026-07-01).
 *
 * Owner: an UNSOLICITED CV's CORE COMPETENCIES came back too NARROW ("EO & photonic sensors",
 * "Imaging", "Materials & devices") — for an unsolicited draft the competencies must be the BROAD
 * PdM/BA/process identity, not the electro-optics niche. The unsolicited prompt block (__neutralCo,
 * gated on __noJD) already forced the PROFILE opener broad (GEN-PROFILE-001) but said nothing about
 * CORE COMPETENCIES. The fix adds a parallel core_comp broad-identity rule to that block.
 *
 * This is a generation-PROMPT change (regen-gated; the real proof is a live generation). The test
 * guards that the instruction is present, sits INSIDE the unsolicited (__neutralCo) block, and is
 * mirrored byte-identically between app.src.js (source) and app.js (deployed).
 *
 * GEN-DEHARDCODE-002 (owner 2026-07-03): the rule itself is now persona-neutral ("narrow
 * specialist labels"); Gabriel's niche examples ("EO & photonic sensors", "Imaging", "Materials &
 * devices") moved into the name-guarded GABRIEL PROFILE + FOCUS PIN appended to the same block.
 *
 * Run:  node --test pwa/test/unsolicited-corecomp-broad.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../app.src.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const TAG = 'GEN-CORECOMP-BROAD-001';

for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: the broad core_comp rule is present`, () => {
    assert.equal(s.split(TAG).length - 1, 1, 'exactly one GEN-CORECOMP-BROAD-001 clause');
  });

  test(`${name}: the rule lives INSIDE the unsolicited (__neutralCo) block`, () => {
    const blockStart = s.indexOf('OPEN / UNSOLICITED APPLICATION');
    const tagAt = s.indexOf(TAG);
    assert.ok(blockStart > 0, 'unsolicited block present');
    assert.ok(tagAt > blockStart, 'core_comp rule is after the unsolicited block start');
    // the block ends at the profile-opener sentence's trailing double-newline; the tag must precede
    // the block-closing marker so it is part of the same single-quoted __neutralCo string.
    const clause = s.slice(tagAt, tagAt + 800);
    assert.match(clause, /BROAD cross-functional identity/, 'names the broad identity');
    assert.match(clause, /Do NOT fill the Focus Areas with narrow specialist labels/, 'forbids niche labels');
  });

  test(`${name}: the owner's niche examples live ONLY in the name-guarded Gabriel pin`, () => {
    assert.equal(s.split('EO & photonic sensors').length - 1, 1, 'cited exactly once');
    const pinAt = s.indexOf('GABRIEL PROFILE + FOCUS PIN');
    assert.ok(pinAt > 0, 'pin present');
    assert.ok(s.indexOf('EO & photonic sensors') > pinAt, 'example sits inside the pin');
  });
}

test('the clause is byte-identical between source and deployed', () => {
  // window ends at the string tail — beyond it the pin concatenation is
  // formatted differently in source (pretty) vs deployed (minified).
  const grab = (s) => {
    const i = s.indexOf(TAG);
    const end = s.indexOf('specialist focus areas.', i);
    return s.slice(i - 60, end + 'specialist focus areas.'.length);
  };
  assert.equal(grab(src), grab(app), 'source and minified clause must match exactly');
});
