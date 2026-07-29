/* GEN-COMPANY-MISSING-RETRY-001 regression guard.
 *
 * Owner (2026-07-29): a FRESH generation with a JD for an Aimpoint role came out
 * with no company → the app rendered as Unsolicited/"unspecified". Root cause:
 * the whole CV+CL generation runs under task "parse_jd", and the prompt REQUIRES
 * meta.company (the exact employer copied from the JD). But the accept/retry gate
 * scored only the CL body fields (CL-EMPTY-BODY-FIELDS-001) and the CV critical
 * fields (CV-CRITICAL-FIELDS-001) — NOT meta.company. So a response with a
 * complete letter but an empty/placeholder company passed the gate and committed
 * with no company.
 *
 * Fix: mirror the sibling gates — with a JD present (!__noJD) an empty/placeholder
 * meta.company is a failed extraction → throw PartialResponse to cycle the provider
 * ladder. After L attempts it falls through and commits as before (never hard-fails).
 *
 * The gate lives deep inside the generate closure (DOM/state-coupled, not unit-
 * extractable), so this is a source-presence + minified-mirror-parity guard, the
 * same shape used for the other gen-gate fixes.
 *
 * Run: node --test pwa/test/unit/gen-company-missing-retry.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('source (app.src.js) carries the company-missing retry gate', () => {
  assert.equal(src.split('PARTIAL_META_COMPANY').length - 1, 1, 'exactly one PARTIAL_META_COMPANY in source');
  assert.ok(src.includes('GEN-COMPANY-MISSING-RETRY-001'), 'tagged with the fix id');
  // gated on a JD being present and attempts remaining
  assert.ok(src.includes('!__noJD && N < L'), 'gate fires only with a JD present and retries left');
  // reads the extracted company off the parse result meta
  assert.ok(/T && T\.meta && T\.meta\.company/.test(src), 'reads T.meta.company');
  // placeholder + unsolicited-label are treated as "no real company"
  assert.ok(src.includes('window.__antcvUnsol && window.__antcvUnsol(__mc)'), 'rejects unsolicited-label echoes');
});

test('minified mirror (app.js) carries the same gate with mapped names', () => {
  assert.equal(min.split('PARTIAL_META_COMPANY').length - 1, 1, 'exactly one PARTIAL_META_COMPANY in minified');
  // minified var mapping: __noJD->g, N->M, L->j, T->z
  assert.ok(min.includes('if(!g&&M<j)'), 'JD-present + retries-left guard, minified');
  assert.ok(min.includes('z.meta&&z.meta.company'), 'reads z.meta.company (T->z)');
  assert.ok(min.includes('window.__antcvUnsol&&window.__antcvUnsol(__mc)'), 'unsolicited-label check, minified');
});

test('the gate does NOT fire for a no-JD (unsolicited) run', () => {
  // the ONLY company-retry throw is guarded by !__noJD / !g — never on a no-JD run,
  // so an unsolicited generation (legitimately empty company) is never cycled by it.
  assert.ok(src.includes('!__noJD && N < L'), 'source gate is !__noJD-guarded');
  assert.ok(min.includes('if(!g&&M<j)'), 'minified gate is !g-guarded');
});
