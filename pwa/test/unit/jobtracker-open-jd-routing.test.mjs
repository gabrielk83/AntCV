// jobtracker-open-jd-routing.test.mjs
// ============================================================
// OPEN-JD-VISIBLE-001 regression guard: the Job Tracker "Open on AntCV" button
// must route the JD to the uploaded-application drop-zone and route ONLY the
// owner-added signals to the Additional Signals textarea — never the JD.
//
// The bug (owner, pre-2026-07-12): Open dumped the row's JD into the signals
// textarea and left the drop-zone empty. Fixed by splitting jd_text from
// supporting_context and lifting only the ADDITIONAL SIGNALS block on restore.
//
// This suite pins BOTH halves of the contract (openRouting.ts) AND asserts the
// shipped files still match it, so a silent edit to either side fails CI:
//   • write side : src/islands/JobTracker/JobTracker.tsx  (prepareAndOpen)
//   • read side  : pwa/app.js + pwa/app.src.js            (restore paths)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  OWNER_SIGNALS_HEADING,
  OWNER_SIGNALS_RE,
  extractOwnerSignals,
  assembleSupportingContext,
} from '../../../src/islands/JobTracker/openRouting.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// A JD sentinel that must NEVER show up in supporting_context or in the signals
// the restore path lifts out — it belongs in jd_text alone.
const JD = 'JOB DESCRIPTION SENTINEL: We seek a Senior PM to own the hardware roadmap and the change-control board across three sites.';
const OWNER = 'Hiring manager is Jane Doe.\nEmphasize the hardware-validation angle.';

// A realistic supporting_context, assembled the way prepareAndOpen() does, with
// every neighbouring block present (target facts, merged research, brand-fit).
function realisticContext({ ownerSig = OWNER, withBrand = true } = {}) {
  return assembleSupportingContext({
    envText: 'Ideal comp 700–900k; title band Senior/Lead; open to relocation.',
    targetFacts: '\n\nTARGET FACTS (calibration only — use to set altitude, emphasis and tone; NEVER copy verbatim):\n• Priority for this application: HIGH-priority (flagship quality).',
    researchBlock: '\n\nROLE AND COMPANY RESEARCH (one merged, non-duplicating brief):\nROLE INTEL (from the JD):\nOwns MBSE tooling.\nCOMPANY RESEARCH (from the web):\nDanish defence-tech, ~400 staff.',
    ownerSig,
    brandFitLine: withBrand ? "\n\nBRAND-FIT: style the CV and cover letter to the employer's brand identity — primary #123456, accent #abcdef (sampled from the company site)." : '',
  });
}

// ---- read side: extractOwnerSignals lifts ONLY the owner block --------------

test('extractOwnerSignals returns exactly the owner-added signals (brand-fit after)', () => {
  assert.equal(extractOwnerSignals(realisticContext({ withBrand: true })), OWNER);
});

test('extractOwnerSignals returns exactly the owner-added signals (owner block last)', () => {
  assert.equal(extractOwnerSignals(realisticContext({ withBrand: false })), OWNER);
});

test('extractOwnerSignals never lifts the JD into the signals textarea', () => {
  const sc = realisticContext();
  // The JD is not in supporting_context to begin with, and even if a caller
  // wrongly appended it, the heading-scoped capture would not reach it.
  assert.ok(!sc.includes('JOB DESCRIPTION SENTINEL'), 'JD must not be in supporting_context');
  assert.ok(!extractOwnerSignals(sc).includes('JOB DESCRIPTION SENTINEL'));
});

test('extractOwnerSignals returns empty when there is no owner block', () => {
  assert.equal(extractOwnerSignals('TARGET-ROLE GUIDELINES (Dream Envelope):\nx\n\nBRAND-FIT: style to brand.'), '');
  assert.equal(extractOwnerSignals(''), '');
  assert.equal(extractOwnerSignals(null), '');
});

// ---- write side: the JD cannot enter supporting_context --------------------

test('assembleSupportingContext carries the owner block but never the JD', () => {
  const sc = assembleSupportingContext({ envText: 'env', ownerSig: OWNER });
  assert.ok(sc.includes(OWNER_SIGNALS_HEADING + ':\n' + OWNER));
  assert.ok(!sc.includes('JOB DESCRIPTION SENTINEL'));
  // jd is not even a parameter — proving the split is structural, not stylistic.
});

test('assembleSupportingContext omits the signals heading when the owner typed nothing', () => {
  const sc = assembleSupportingContext({ envText: 'env', ownerSig: '' });
  assert.ok(!sc.includes(OWNER_SIGNALS_HEADING));
});

// ---- source parity: the shipped code still honours this contract -----------

test('pwa/app.src.js restore paths use the canonical owner-signals regex (both sites)', () => {
  const src = readFileSync(join(ROOT, 'pwa', 'app.src.js'), 'utf8');
  const needle = OWNER_SIGNALS_RE.source;
  const hits = src.split(needle).length - 1;
  assert.ok(hits >= 2, `expected >=2 restore sites using the canonical regex, found ${hits}`);
});

test('pwa/app.js (deployed) restore paths use the canonical owner-signals regex', () => {
  const app = readFileSync(join(ROOT, 'pwa', 'app.js'), 'utf8');
  assert.ok(app.split(OWNER_SIGNALS_RE.source).length - 1 >= 2, 'deployed app.js must carry the canonical regex at both restore sites');
});

test('JobTracker.tsx sends the JD as jd_text and never folds it into supporting_context', () => {
  const tsx = readFileSync(join(ROOT, 'src', 'islands', 'JobTracker', 'JobTracker.tsx'), 'utf8');
  // The JD travels in its own field...
  assert.ok(/jd_text:\s*jd\b/.test(tsx), 'createApplication must be called with jd_text: jd');
  // ...and the owner block is what goes into supporting_context.
  assert.ok(tsx.includes(OWNER_SIGNALS_HEADING), 'supporting_context must carry the ADDITIONAL SIGNALS (owner-added) heading');
  // The supporting_context variable must be assembled from ownerSig, not jd.
  const m = tsx.match(/const supporting =([\s\S]*?);\n/);
  assert.ok(m, 'could not locate the supporting_context assembly');
  assert.ok(!/\bjd\b/.test(m[1]), 'the supporting_context assembly must not reference the jd variable');
});
