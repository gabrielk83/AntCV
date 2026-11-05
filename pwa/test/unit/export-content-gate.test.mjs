// export-content-gate.test.mjs — EXPORT-CONTENT-GATE-001 (owner 2026-11-01)
// D1 3525 ASSA ABLOY exported the unfilled template letter; 3524 Ambu exported the Terma
// letter. The export is now HARD-blocked on template / instruction text, a letter that
// never names the company, the unsolicited profile on a targeted role, or content owned
// by another application — and every export path honours the refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../../antcv-company-match.js');
const G = require('../../antcv-export-content-gate.js');

// Shapes copied from D1 application 3525 (cl_sections / cv_sections, 2026-11-01).
const CL_3525 = [
  { id: 'greeting', type: 'text', title: 'Greeting', content: 'Dear [Hiring Team / Name],' },
  { id: 'opening', type: 'rich_block', items: [{ b: '', t: '', bullets: [] }] },
  { id: 'why', type: 'rich_block', items: [{ b: 'Why this company and position', t: '[NO-JD RULE (whole letter): with no JD (unsolicited), never leave a part empty and never invent facts - use the candidate\'s real background.]' }] },
  { id: 'bring', type: 'rich_block', items: [{ b: '[Decision foundation - short label]', t: '[EVIDENCE: how the candidate builds the decision foundation.]', mk: true }] },
  { id: 'foundation', type: 'rich_block', items: [{ b: 'Hands-on', t: 'across the full hardware product path: requirements and ALM/Codebeamer tooling, FMEA and validation setups.' }] },
];
const CV_3525 = [
  { id: 'profile', type: 'rich_block', items: [{ b: '', t: 'IT professional with 15+ years across commercial and regulated markets - product development, business analysis, change governance.' }] },
  { id: 'additional', type: 'labeled_list', items: [{ l: 'Research outputs', v: 'Details available via [Google Scholar](https://scholar.google.com/citations?user=E6q1Y34AAAAJ&hl=en)' }] },
];
const YALE = { company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA' };
const codes = (r) => r.reasons.map((x) => x.code);

test('3525: the template letter is blocked (placeholders, instruction text, company never named)', () => {
  const r = G.check({ sections: { cv: CV_3525, cl: CL_3525 }, meta: YALE, doc: 'cl' });
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ['CL_TEMPLATE', 'CL_NO_COMPANY']);
  assert.ok(r.reasons[0].count >= 3);
});

test('3525: the CV with the unsolicited "IT professional" opener on a Product Manager role is blocked', () => {
  const r = G.check({ sections: { cv: CV_3525, cl: CL_3525 }, meta: YALE, doc: 'cv' });
  assert.deepEqual(codes(r), ['CV_UNSOL_PROFILE']);
});

test('markdown links are not placeholders; "[verify]" flags are benign', () => {
  assert.equal(G.isTemplateText('Details via [Google Scholar](https://scholar.google.com/x)'), false);
  assert.equal(G.isTemplateText('Shipped a 20 MP camera [verify] at the ODM.'), false);
  assert.equal(G.isTemplateText('I am applying for [Role title] at [Company].'), true);
  assert.equal(G.isTemplateText('NO-JD RULE (whole letter): never leave a part empty'), true, 'instruction text without brackets');
});

test('a real Yale letter and CV pass; hidden and switched-off sections are ignored', () => {
  const cl = [
    { id: 'greeting', type: 'text', content: 'Dear Yale Smart Residential team,' },
    { id: 'opening', type: 'rich_block', items: [{ b: '', t: 'A smart lock has to be secure and simple to install. That is where I add most.' }] },
    { id: 'old', type: 'text', on: false, content: 'Dear [Hiring Team / Name],' },
    { id: 'bring', type: 'rich_block', hidden: { 1: true }, items: [{ b: 'From need to launch', t: 'I will build each decision on a business case.' }, { b: '[label]', t: '[EVIDENCE: x]' }] },
  ];
  const cv = [{ id: 'profile', type: 'rich_block', items: [{ b: '', t: 'I am a technical product manager who takes connected hardware from requirements to launch.' }] }];
  assert.deepEqual(G.check({ sections: { cv, cl }, meta: YALE, doc: 'both' }).reasons, []);
});

test('a letter for another company (the 3524 Terma letter under Ambu) is blocked; unsolicited letters are not company-checked', () => {
  const terma = [{ id: 'why', type: 'rich_block', items: [{ b: 'Why', t: "Terma's naval radar programmes need traceable requirements." }] }];
  assert.deepEqual(codes(G.check({ sections: { cl: terma }, meta: { company: 'Ambu', role: 'Hardware Solution Architect' }, doc: 'cl' })), ['CL_NO_COMPANY']);
  assert.equal(G.check({ sections: { cl: terma }, meta: { company: 'Unsolicited', role: 'Open Application' }, doc: 'cl' }).ok, true);
});

test('an IT role may keep an IT opener; a stale owner verdict blocks with the owning application', () => {
  const cv = [{ id: 'profile', type: 'text', content: 'IT professional with 15+ years running infrastructure.' }];
  assert.equal(G.check({ sections: { cv }, meta: { company: 'Netcompany', role: 'IT Infrastructure Lead' }, doc: 'cv' }).ok, true);
  const owner = { owner: { company: 'Terma', role: 'Systems Engineer' }, current: { company: 'Ambu', role: 'Architect' }, foreign: ['cv.profile'] };
  const r = G.check({ sections: { cv: [] }, meta: { company: 'Ambu', role: 'Architect' }, doc: 'cv', owner });
  assert.deepEqual(codes(r), ['STALE_OWNER']);
  assert.match(G.describe(r.reasons[0]), /written for Terma/);
});

test('checkPayload(): blank "CV Template" downloads are exempt', () => {
  const r = G.checkPayload({ doc: 'cv', filename: 'CV Template', sections: [{ id: 'profile', type: 'text', content: '[PROFILE placeholder]' }], meta: {} });
  assert.equal(r.ok, true);
});

test('placeholderGate (docx-client backstop) delegates to the gate and HARD-blocks — no confirm', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.window = globalThis;
  let confirmed = false, shown = null;
  globalThis.confirm = () => { confirmed = true; return true; };
  const realShow = G.showBlock;
  globalThis.AntcvExportContentGate = { ...G, showBlock: (res) => { shown = res; } };
  const { placeholderGate } = await import('../../antcv-docx-client.js');
  let err = null;
  try { placeholderGate({ doc: 'cl', sections: CL_3525, meta: { company: 'ASSA ABLOY (Yale)' } }); } catch (e) { err = e; }
  assert.ok(err && err.placeholderGate, 'refused with placeholderGate=true so app.js does not fall back');
  assert.ok(shown && shown.reasons.length >= 2, 'the block notice is shown');
  assert.equal(confirmed, false);
  globalThis.AntcvExportContentGate = { ...G, showBlock: realShow };
});

test('every export fallback honours the refusal (app.js, app.src.js, export-preview modal)', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('catch(e){if(e&&e.placeholderGate)return;if(console.warn("[pdf] server export failed'), 'PDF: no browser-print fallback');
  assert.ok(app.includes('catch(n){if(n&&n.placeholderGate)return;console.warn("[DOCX] Worker export failed'), 'DOCX: no inline fallback');
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  assert.equal(src.split('EXPORT-CONTENT-GATE-001 (1.51.5242): a refused export is final').length - 1, 2, 'mirrored in app.src.js');
  const gate = readFileSync(new URL('../../antcv-pdf-preview-gate.js', import.meta.url), 'utf8');
  assert.ok(gate.includes('if (e && e.placeholderGate) return;'), 'modal: no iframe-print fallback');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="antcv-company-match\.js\?v=[^"]+"><\/script>/, 'matcher loads synchronously');
  assert.match(html, /<script src="antcv-export-content-gate\.js\?v=[^"]+" defer><\/script>/);
});
