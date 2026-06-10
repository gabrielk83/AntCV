// genunsol-meta-contract.test.mjs
// ============================================================
// GEN-UNSOL-002: when the generation REQUEST carries a real JD block, the
// output's meta.company / meta.role must be filled with JD-grounded values —
// otherwise the kernel-completeness sidecar throws PartialResponse so the
// provider retry loop fixes it. No-JD runs (meta.company forced empty by the
// prompt) must NOT arm the check. Loads the real sidecar in a vm sandbox.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-kernel-completeness-290.js', import.meta.url), 'utf8');

function makeSandbox() {
  const fetchCalls = [];
  const sandbox = {
    window: {},
    console: { warn() {}, debug() {}, log() {}, error() {} },
    Date,
    JSON: { parse: JSON.parse.bind(JSON), stringify: JSON.stringify.bind(JSON) },
    Array, Object, Error, RegExp, Math, String, Number,
  };
  sandbox.window.fetch = function (...args) { fetchCalls.push(args); return Promise.resolve({ ok: true }); };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, fetchCalls };
}

const COMPLETE_OUTPUT = (meta) => ({
  meta,
  cv_overrides: {
    profile_content: 'Fifteen years across systems engineering and change governance in regulated hardware programmes.',
    core_comp_rows: [['Focus Area', 'Strategic Expertise'], ['Change governance', 'CCB practice, risk assessment, audit-ready documentation'], ['EO validation', 'Sensor test campaigns, environmental qualification'], ['Requirements', 'Traceability, ASPICE-aligned reviews'], ['KPI reporting', 'Dashboarding, decision memos for leadership']],
    experience_roles: [
      { id: 'r1', title: 'System Architect', company: 'Innoviz', years: '2017 - 2025', on: true, bullets: ['Owned the change control board across four product lines and twelve suppliers.', 'Reduced approval cycle time from days to hours by restructuring the review flow.'] },
      { id: 'r2', title: 'Project Manager', company: 'Elbit', years: '2012 - 2017', on: true, bullets: ['Delivered an EO qualification campaign across three environmental labs on schedule.'] },
      { id: 'r3', title: 'R&D Engineer', company: 'Ophir', years: '2008 - 2012', on: true, bullets: ['Built the optical test bench used for all production calibration runs.'] },
    ],
  },
  cl_overrides: {
    who_content: 'I am a systems engineer with fifteen years across optics, hardware, and regulated programmes.',
    why_content: 'The role matches my regulatory and change-governance background directly.',
    bring_rows: [['Focus Area', 'Strategic Expertise'], ['Change governance', 'CCB, risk, documentation'], ['Validation', 'Test campaigns, qualification'], ['Coordination', 'Cross-site supplier alignment']],
    contribute_intro: 'My immediate priority would be to close the specific gap in avionics certification, through focused study and hands-on use. From there, I would focus on:',
    contribute_items: ['Map the current change-control flow and identify the two highest-drag steps within the first month.', 'Stand up a weekly decision log so approvals are visible to every stakeholder.', 'Pair with the validation lead to cut regression turnaround measurably.'],
    contribute_closing: 'My aim would be to help the team build a review process that is clear, reviewable, and practical.',
    foundation_hands_on: 'I start by framing the decision and building the smallest prototype that exposes the real risk.',
    foundation_professionally: 'I keep decisions and their rationale in the open so anyone joining later can see what was decided and why.',
    closure_content: 'I would welcome the opportunity to discuss how I could support the team in this role.',
  },
  rationale: { fit_summary: 'Good fit.' },
});

const GEN_BODY = (withJD) => JSON.stringify({
  messages: [{
    role: 'user',
    content: withJD
      ? [{ type: 'text', text: 'JOB DESCRIPTION:\nKvadrat Acoustics seeks a Portfolio Project Manager…' }, { type: 'text', text: 'ADDITIONAL SIGNALS:\nnone' }]
      : [{ type: 'text', text: 'ADDITIONAL SIGNALS:\nopen application please' }],
  }],
  system: 'You are an expert CV writer… cv_overrides … cl_overrides …',
});

let ctx;
beforeEach(() => { ctx = makeSandbox(); });

function api() { return ctx.sandbox.window.AntcvKernelCompleteness290; }
function fireGen(withJD) { ctx.sandbox.window.fetch('https://relay.example/api/messages', { method: 'POST', body: GEN_BODY(withJD) }); }
function parseOut(meta) { return ctx.sandbox.JSON.parse(JSON.stringify(COMPLETE_OUTPUT(meta))); }

test('sidecar installs and exposes the meta contract API', () => {
  assert.equal(typeof api()._checkMetaStrict, 'function');
  assert.equal(typeof api()._metaCheckArmed, 'function');
});

test('JD-bearing generate + empty meta.company → PartialResponse', () => {
  fireGen(true);
  assert.equal(api()._metaCheckArmed(), true);
  assert.throws(
    () => parseOut({ company: '', role: '', subtitle: 'X' }),
    (e) => e.name === 'PartialResponse' && /meta\.company/.test(e.message) && /meta\.role/.test(e.message),
  );
});

test('JD-bearing generate + "Unsolicited" company → PartialResponse', () => {
  fireGen(true);
  assert.throws(
    () => parseOut({ company: 'Unsolicited', role: 'Open Application', subtitle: 'X' }),
    (e) => e.name === 'PartialResponse' && /meta\.company/.test(e.message),
  );
});

test('JD-bearing generate + placeholder echo → PartialResponse', () => {
  fireGen(true);
  assert.throws(
    () => parseOut({ company: '<EXACT employer name copied from the JOB DESCRIPTION>', role: 'PM', subtitle: 'X' }),
    (e) => e.name === 'PartialResponse' && /meta\.company/.test(e.message),
  );
});

test('JD-bearing generate + real company/role → accepted and disarmed', () => {
  fireGen(true);
  const out = parseOut({ company: 'Kvadrat Acoustics', role: 'Portfolio Project Manager', subtitle: 'X' });
  assert.equal(out.meta.company, 'Kvadrat Acoustics');
  assert.equal(api()._metaCheckArmed(), false); // acceptance disarms
});

test('no-JD generate (forced-empty company) is never armed — empty meta accepted', () => {
  fireGen(false);
  assert.equal(api()._metaCheckArmed(), false);
  const out = parseOut({ company: '', role: '', subtitle: 'X' });
  assert.equal(out.meta.company, '');
});

test('JD pasted into Additional Signals does NOT arm the contract', () => {
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ type: 'text', text: 'ADDITIONAL SIGNALS:\nJOB DESCRIPTION:\nKvadrat seeks…' }] }],
    system: 'cv_overrides … cl_overrides …',
  });
  ctx.sandbox.window.fetch('https://relay.example/api/messages', { method: 'POST', body });
  assert.equal(api()._metaCheckArmed(), false);
});

test('retry addendum names the meta contract', () => {
  const addendum = api()._buildAddendum(['meta.company (empty)']);
  assert.match(addendum, /meta\.company AND meta\.role/);
  assert.match(addendum, /NEVER write "Unsolicited"/i);
});
