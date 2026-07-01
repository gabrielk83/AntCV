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
    assert.match(clause, /Do NOT fill the Focus Areas with electro-optics/, 'forbids the niche labels');
    assert.match(clause, /EO & photonic sensors/, 'cites the owner\'s bad example');
  });
}

test('the clause is byte-identical between source and deployed', () => {
  const grab = (s) => { const i = s.indexOf(TAG); return s.slice(i - 60, i + 700); };
  assert.equal(grab(src), grab(app), 'source and minified clause must match exactly');
});
