// app-content-owner-guard.test.mjs — APP-CONTENT-OWNER-001 (owner 2026-11-01, D1 3524 Ambu)
// Moving from Terma to Ambu without a generation kept the Terma CV + letter in the editor
// and exported them as Ambu's. The tailored sections are now stamped with the application
// they were written for; content owned only by another application is stale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../../antcv-company-match.js');
const O = require('../../antcv-app-content-owner-guard.js');

const TERMA = { company: 'Terma', role: 'Experienced Systems Engineer' };
const AMBU = { company: 'Ambu', role: 'Hardware Solution Architect, EndoIntelligence, Global R&D' };
const profile = (t) => ({ id: 'profile', type: 'rich_block', items: [{ b: '', t }] });
const why = (t) => ({ id: 'why', type: 'rich_block', items: [{ b: 'Why', t }] });
const TERMA_SECS = {
  cv: [profile('I am a systems engineer who keeps radar requirements traceable from concept to verification at Terma.'),
       { id: 'work_style', type: 'rich_block', items: [{ b: 'Work style', t: 'Calm, structured decisions from measured data; clear written outcomes.' }] }],
  cl: [why("Terma's naval radar programmes need requirements that hold through verification and delivery.")],
};

test('content stamped for Terma is stale once meta says Ambu (CV and letter)', () => {
  const store = O.stampInto(null, TERMA_SECS, TERMA, 1);
  assert.equal(O.verdict(TERMA_SECS, TERMA, store, 'both'), null, 'fine for its own application');
  const v = O.verdict(TERMA_SECS, AMBU, store, 'cv');
  assert.ok(v, 'stale for Ambu');
  assert.equal(v.owner.company, 'Terma');
  assert.deepEqual(v.foreign, ['cv.profile']);
  assert.deepEqual(O.verdict(TERMA_SECS, AMBU, store, 'cl').foreign, ['cl.why']);
});

test('kernel-standard sections (work style) are not signed, so they never block', () => {
  const ids = O.sigsOf(TERMA_SECS, 'both').map((g) => g.doc + '.' + g.id);
  assert.deepEqual(ids, ['cv.profile', 'cl.why']);
});

test('regenerating for Ambu clears the block; switching back to Terma is fine again', () => {
  let store = O.stampInto(null, TERMA_SECS, TERMA, 1);
  const AMBU_SECS = { cv: [profile("I am a hardware system architect who keeps Ambu's endoscopy platform buildable at volume.")], cl: [why("Ambu's EndoIntelligence platform joins optics, sensors and software in one device.")] };
  store = O.stampInto(store, AMBU_SECS, AMBU, 2);
  assert.equal(O.verdict(AMBU_SECS, AMBU, store, 'both'), null);
  assert.equal(O.verdict(TERMA_SECS, TERMA, store, 'both'), null);
  assert.ok(O.verdict(TERMA_SECS, AMBU, store, 'both'), 'still stale if the Terma content shows under Ambu');
});

test('unknown content (never stamped) is not stale; template sections are never signed', () => {
  assert.equal(O.verdict(TERMA_SECS, AMBU, { v: 1, sigs: {} }, 'both'), null);
  const tpl = { cv: [profile('[Professional identity tied to the role: years, disciplines, environments]')], cl: [] };
  assert.deepEqual(O.sigsOf(tpl, 'both'), []);
  assert.equal(O.unknownSigs(TERMA_SECS, { v: 1, sigs: {} }).length, 2);
});

test('a correction of the company name to the same employer does not block (fuzzy same app)', () => {
  const yale = { company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA' };
  const secs = { cv: [profile('I am a technical product manager who takes connected hardware from market need to launch for Yale.')], cl: [] };
  const store = O.stampInto(null, secs, yale, 1);
  assert.equal(O.verdict(secs, { company: 'ASSA ABLOY', role: 'Product Manager, Residential Access EMEIA' }, store, 'cv'), null);
});

test('app.js and app.src.js dispatch antcv:generation-complete exactly once', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  assert.equal(app.split('"antcv:generation-complete"').length - 1, 1);
  assert.equal(src.split('"antcv:generation-complete"').length - 1, 1);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="antcv-app-content-owner-guard\.js\?v=[^"]+" defer><\/script>/);
});
