// role-positioning-guard.test.mjs — ENVELOPE-PRECEDENCE-001 / ROLE-SUBTITLE-001 /
// TOOLS-RELEVANCE-001 (owner 2026-11-01, D1 3525 ASSA ABLOY Product Manager)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../../antcv-company-match.js');
const R = require('../../antcv-role-positioning-guard.js');

const ENV = 'TARGET-ROLE GUIDELINES (Dream Envelope):\nTitle: Technical Product Manager / AI Workflow\nSalary: 700-900k\n\nADDITIONAL SIGNALS (owner-added):\nHiring manager is Jane Doe.';

test('envelope precedence: the JD role family positions, the envelope only calibrates', () => {
  const out = R.envelopePrecedence(ENV, 'Product Manager - Residential Access EMEIA');
  assert.ok(out.startsWith('POSITIONING PRECEDENCE (ENVELOPE-PRECEDENCE-001'), 'precedence rule comes first');
  assert.match(out, /this posting is "Product Manager - Residential Access EMEIA" \(role family: product management\)/);
  assert.match(out, /never open a targeted profile with the unsolicited "IT professional"/);
  assert.ok(!out.includes('TARGET-ROLE GUIDELINES (Dream Envelope):'), 'old heading relabelled');
  assert.ok(out.includes('TARGET-ROLE CALIBRATION (Dream Envelope - calibration only, never positioning):'));
  assert.ok(out.includes('ADDITIONAL SIGNALS (owner-added):\nHiring manager is Jane Doe.'), 'owner signals untouched');
  assert.equal(R.envelopePrecedence(out, 'x'), out, 'idempotent');
  assert.equal(R.envelopePrecedence('no envelope here', 'x'), 'no envelope here');
});

test('app.js / app.src.js route PRIOR RUN CONTEXT through the precedence helper, never throwing', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.equal(app.split('window.__antcvEnvelopePrecedence&&window.__antcvEnvelopePrecedence(s)||s}catch(e){return s}').length - 1, 1);
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  assert.ok(src.includes('ENVELOPE-PRECEDENCE-001 (1.51.5242)'));
});

test('role-specific subtitle replaces the stored standing slogan on a targeted application', () => {
  const m = { company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA', subtitle: 'Processes • Products • People' };
  assert.equal(R.subtitleFix(m, 'en'), 'Product Lifecycle • Market Need to Launch • Residential Access');
  assert.equal(R.subtitleFix({ ...m, role: 'Hardware Solution Architect, EndoIntelligence, Global R&D' }, 'en'),
    'System Architecture • Concept to Production • EndoIntelligence');
  assert.equal(R.subtitleFix({ ...m, subtitle: '[Specialisation — 1-3 focus areas]' }, 'en'), 'Product Lifecycle • Market Need to Launch • Residential Access');
});

test('subtitle: generated role-smart lines, unsolicited apps and non-EN outputs are left alone', () => {
  assert.equal(R.subtitleFix({ company: 'Ambu', role: 'Architect', subtitle: 'Endoscopy Hardware • Concept to Volume' }, 'en'), null);
  assert.equal(R.subtitleFix({ company: 'Unsolicited', role: 'Open Application', subtitle: 'Processes • Products • People' }, 'en'), null);
  assert.equal(R.subtitleFix({ company: 'Ambu', role: 'Architect', subtitle: '' }, 'da'), null);
  assert.equal(R.subtitleFix({ company: 'Ambu', role: 'Hardware Architect', subtitle: 'Processes * Products * People' }, 'en', ['processes • products • people']),
    'System Architecture • Concept to Production', 'stored "*" separators are the same standing line');
});

test('research vs non-research roles', () => {
  assert.equal(R.isResearchRole('Product Manager - Residential Access EMEIA'), false);
  assert.equal(R.isResearchRole('Hardware Solution Architect, EndoIntelligence, Global R&D'), false, '"Global R&D" is a department');
  assert.equal(R.isResearchRole('Optical Engineer for R&D Projects'), true);
  assert.equal(R.isResearchRole('Process Development Engineer'), true);
  assert.equal(R.isResearchRole('Project Manager', 'research'), true, 'JD analysis category counts');
});

// Tools block from D1 3524 (cv_sections, 2026-11-01).
const TOOLS = {
  id: 'tools', type: 'rich_block', items: [
    { grp: true, t: 'Tools' },
    { b: 'Software', t: 'Codebeamer ALM, Excel, Confluence, Jira, Enterprise Architect, Power BI' },
    { b: 'Instruments', t: 'confocal imaging, working familiarity with AFM' },
    { b: 'Measurement', t: 'Interferometry, spectrometers, SEM' },
    { b: 'Quality & process', t: 'Design of Experiments, Six Sigma Black Belt, FMEA' },
  ],
};

test('tools: lab instrument rows are hidden (not deleted) for a non-research role, once per application', () => {
  const out = R.toolsRelevance(TOOLS, false, 'ASSA ABLOY (Yale)|Product Manager');
  assert.deepEqual(out.hidden, { 2: true, 3: true });
  assert.equal(out.items.length, TOOLS.items.length, 'never deleted');
  assert.deepEqual(out.jdGate, { key: 'ASSA ABLOY (Yale)|Product Manager', idx: [2, 3] });
  const userUnhid = { ...out, hidden: {} };
  assert.equal(R.toolsRelevance(userUnhid, false, 'ASSA ABLOY (Yale)|Product Manager'), userUnhid, 'a row the user unhid for this app stays visible');
});

test('tools: a research role shows the rows the gate hid again; untouched sections stay identical', () => {
  const hiddenOut = R.toolsRelevance(TOOLS, false, 'A|PM');
  const back = R.toolsRelevance(hiddenOut, true, 'Hamamatsu|Optical Engineer');
  assert.deepEqual(back.hidden, {});
  assert.equal(back.jdGate, undefined);
  assert.equal(R.toolsRelevance(TOOLS, true, 'x'), TOOLS);
  assert.equal(R.isLabItem({ b: 'Software', t: 'Jira, Confluence' }), false);
});

test('island write side carries the calibration heading + positioning line', async () => {
  const tsx = readFileSync(new URL('../../../src/islands/JobTracker/JobTracker.tsx', import.meta.url), 'utf8');
  assert.ok(tsx.includes("positioningLine(String(row[2] || '')) + ENVELOPE_HEADING"));
  assert.ok(!tsx.includes("'TARGET-ROLE GUIDELINES (Dream Envelope):\\n' + envText"));
  const bundle = readFileSync(new URL('../../antcv-react-islands.js', import.meta.url), 'utf8');
  assert.ok(bundle.includes('ENVELOPE-PRECEDENCE-001'), 'islands bundle rebuilt from source');
  const { assembleSupportingContext } = await import('../../../src/islands/JobTracker/openRouting.ts');
  const sc = assembleSupportingContext({ envText: 'Title: TPM', role: 'Product Manager' });
  assert.ok(sc.startsWith('POSITIONING PRECEDENCE (ENVELOPE-PRECEDENCE-001)'));
});
