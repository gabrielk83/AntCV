// cl-skeleton-export-gate.test.mjs
// ============================================================
// CL-SKELETON-EXPORT-GATE-001 (owner 2026-07-05, live report): an Open
// Application (Unsolicited) Cover Letter PDF shipped the raw
// TEMPLATE-STRUCT-DEFAULT-001 skeleton verbatim — "Dear [Hiring Team / Name],"
// and all — because CL-HYDRATE-EXPORT-GATE-001's rescue sources
// (antcv:clProseGuard bucket, meta.opening/greeting) are deliberately never
// populated for Unsolicited apps (CL-PROSE-UNSOL-POISON-001 in
// antcv-cl-prose-loss-guard-985.js — stops a prior company's prose leaking
// into a later unsolicited one). placeholderGate now also checks the CL prose
// sections (rich_block/text) that CL-HYDRATE-EXPORT-GATE-001 covers and, if
// any are STILL a bracket placeholder after buildPayload has done everything
// else it can, asks before exporting instead of silently shipping it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload, placeholderGate } = await import('../../antcv-docx-client.js');

// The real skeleton shape (rich_block, headlineOff) for an Unsolicited app —
// no antcv:clProseGuard bucket, no meta.opening/greeting: exactly the
// no-rescue-source condition that shipped the raw skeleton live.
const SKELETON_CL = [
  { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear [Hiring Team / Name],' },
  { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'rich_block', headlineOff: true,
    items: [{ b: '', t: 'I am applying for [Role title] at [Company], where I can contribute to [main JD need 1 (example: a core responsibility from the JD)].' }] },
  { id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'rich_block', headlineOff: true,
    items: [
      { b: 'How I would contribute', t: 'I would start by learning where [Company/team] loses time, clarity, trust, or traceability. From there:' },
      { b: '', t: '[Action tied to values/company culture (example shape: keep communication direct, respectful, and useful for both technical and non-technical people).]' },
    ] },
];

function unsolicitedPayload(cl) {
  return buildPayload({
    sections: { cv: [], cl },
    doc: 'cl',
    personalInfo: { name: 'Gabriel' },
    meta: { company: 'Unsolicited', role: 'Open Application' },
  });
}

test('a fully-real CL passes the gate silently (no confirm call)', () => {
  const p = unsolicitedPayload([
    { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Team,' },
    { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'rich_block', headlineOff: true,
      items: [{ b: '', t: 'I would welcome the chance to bring my optics background to your team.' }] },
  ]);
  let confirmCalled = false;
  globalThis.confirm = () => { confirmCalled = true; return true; };
  assert.doesNotThrow(() => placeholderGate(p));
  assert.equal(confirmCalled, false, 'a real CL must never trigger the confirm gate');
});

test('CL-SKELETON-EXPORT-GATE-001: an unrescued skeleton CL asks before export, and a decline blocks it', () => {
  const p = unsolicitedPayload(SKELETON_CL);
  // Prove this is the actual no-rescue-source condition: CL-HYDRATE-EXPORT-GATE-001
  // could not fix these sections (no guard bucket, no meta.opening/greeting for an
  // unsolicited app), so buildPayload's own placeholder-stripping is the only thing
  // that could have caught it before the gate does — confirm it did NOT (this is
  // the live bug's exact shape: rich_block items, not the stripped text/list types).
  const opening = p.sections.find((s) => s.id === 'opening');
  assert.ok(opening, 'opening section must still be present (not silently dropped)');
  assert.match(opening.items[0].t, /\[Role title\]/, 'unrescued skeleton text reaches the payload verbatim');

  let confirmMsg = null;
  globalThis.confirm = (msg) => { confirmMsg = msg; return false; };
  assert.throws(() => placeholderGate(p), /placeholder content detected/);
  assert.match(confirmMsg, /Hiring Team \/ Name/, 'the confirm message names the actual placeholder symptom');
});

test('CL-SKELETON-EXPORT-GATE-001: accepting the confirm lets export proceed', () => {
  const p = unsolicitedPayload(SKELETON_CL);
  globalThis.confirm = () => true;
  assert.doesNotThrow(() => placeholderGate(p));
});

test('kill switch (antcv:disable-placeholder-gate) skips the CL check too', () => {
  const p = unsolicitedPayload(SKELETON_CL);
  localStorage.setItem('antcv:disable-placeholder-gate', '1');
  let confirmCalled = false;
  globalThis.confirm = () => { confirmCalled = true; return false; };
  assert.doesNotThrow(() => placeholderGate(p));
  assert.equal(confirmCalled, false);
  localStorage.removeItem('antcv:disable-placeholder-gate');
});

test('a CV export (doc !== "cl") never runs the CL prose check', () => {
  const p = buildPayload({
    sections: { cv: [{ id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: '[PROFILE placeholder]' }], cl: [] },
    doc: 'cv', personalInfo: { name: 'Gabriel' }, meta: { company: 'Unsolicited', role: 'Open Application' },
  });
  let confirmCalled = false;
  globalThis.confirm = () => { confirmCalled = true; return true; };
  placeholderGate(p);
  assert.equal(confirmCalled, false, 'CV-only placeholders are a different, already-existing detector (tables), not this CL check');
});
