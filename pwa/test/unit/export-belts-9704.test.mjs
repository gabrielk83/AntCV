// Export enforcement belts (spec rules 16/16a/17/18/36/38 — owner 2026-07-04
// "so fix in code!"): ROLE-CLASS-HIDE-001 + BULLET-CAP-BELT-001 in
// sanitizeForExport (via buildPayload), SIDEBAR-DEFAULT-32-001, and
// PLACEHOLDER-EXPORT-GATE-001 markers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
store.set('outcomesMode', JSON.stringify('results'));
store.set('personalInfo', JSON.stringify({}));
// targeted context: meta carries a real company
store.set('meta', JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' }));
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { buildPayload } = await import('../../antcv-docx-client.js');

const B = (n) => Array.from({ length: n }, (_, i) => `Did concrete thing number ${i + 1} with a measurable outcome and tools.`);

function payloadWithRoles(roles) {
  return buildPayload({
    sections: {
      cv: [{ id: 'experience', type: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, roles }],
      cl: [],
    },
    doc: 'cv',
    personalInfo: { name: 'Gabriel' },
    meta: { company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' },
  });
}

test('ROLE-CLASS-HIDE-001: Security Guard / Students Council / Team Ops never ship in a targeted payload', () => {
  const r = payloadWithRoles([
    { id: 'r1', title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', years: '2022 - 2026', on: true, bullets: B(3) },
    { id: 'r2', title: 'Security Guard, Student Dormitories', company: 'Tel Aviv University', years: '2010', on: true, bullets: B(3) },
    { id: 'r3', title: 'Students Council Representative', company: 'Tel Aviv University', years: '2005 - 2007', on: true, bullets: B(3) },
    { id: 'r4', title: 'Team Operations Manager (foreningsarbejde)', company: 'Pan Idræt', years: '2023 - present', on: true, bullets: B(3) },
  ]);
  const exp = r.sections.find((s) => s.id === 'experience');
  const titles = exp.roles.map((x) => x.title).join(' | ');
  assert.doesNotMatch(titles, /Security Guard|Students Council|Team Operations/);
  assert.match(titles, /Kanzen|Product \/ Project Expert/);
});

test('BULLET-CAP-BELT-001: plain role capped at 4, merged (& Leader) role at 5', () => {
  const r = payloadWithRoles([
    { id: 'r1', title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', years: '2022 - 2026', on: true, bullets: B(6) },
    { id: 'r2', title: 'Electro-Optics Engineer & Team Leader', company: 'Meprolight, IWI Group', years: '2010 - 2014', on: true, bullets: B(6) },
    { id: 'r3', title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', years: '2014 - 2017', on: true, bullets: B(6) },
  ]);
  const exp = r.sections.find((s) => s.id === 'experience');
  const by = (t) => exp.roles.find((x) => x.title.startsWith(t));
  assert.equal(by('Product / Project Expert').bullets.length, 4, 'plain role capped at 4');
  assert.equal(by('Electro-Optics Engineer & Team Leader').bullets.length, 5, 'merged role capped at 5');
  assert.equal(by('Senior Optics & Electro-Optics').bullets.length, 4, '"&" inside a FUNCTION name is not a merge');
});

test('UNSOLICITED payloads are untouched by the targeted belts', () => {
  store.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
  const r = payloadWithRoles([
    { id: 'r1', title: 'Security Guard, Student Dormitories', company: 'Tel Aviv University', years: '2010', on: true, bullets: B(6) },
  ]);
  store.set('meta', JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' }));
  const exp = r.sections.find((s) => s.id === 'experience');
  assert.equal(exp.roles.length, 1, 'unsolicited keeps the breadth');
  assert.equal(exp.roles[0].bullets.length, 6, 'no cap outside targeted exports');
});

test('SIDEBAR-DEFAULT-32-001: unset ratio defaults to 0.32; a user choice still wins', () => {
  store.delete('cvSidebarRatio');
  const r1 = payloadWithRoles([]);
  assert.equal(r1.sidebar_ratio, 0.32, 'default 32%');
  store.set('cvSidebarRatio', JSON.stringify(0.38));
  const r2 = payloadWithRoles([]);
  assert.equal(r2.sidebar_ratio, 0.38, 'user splitter choice wins');
  store.delete('cvSidebarRatio');
});

test('PLACEHOLDER-EXPORT-GATE-001: wired before BOTH export preflights, with kill switch', () => {
  const src = readFileSync(new URL('../../antcv-docx-client.js', import.meta.url), 'utf8');
  assert.equal(src.split('placeholderGate(payload);').length - 1, 2, 'gate at both export paths');
  assert.ok(src.includes("antcv:disable-placeholder-gate"), 'kill switch present');
  assert.ok(src.includes('PLACEHOLDER-EXPORT-GATE-001'), 'marker present');
});

// ── OLD-ROLE-BULLET-CAP-001 (spec rule 47, owner Trackman round 2: "for old
// roles pass 2-3 bullets only if highly relevant — a project manager should
// not get lots of research & teaching assistant bullets"). End-year 2010 is
// >=14y old for any now >= 2024; end-year 2016 is >=8y for any now >= 2024. ──

test('OLD-ROLE-BULLET-CAP: RA/TA (>=16y) -> 2; plain 11-15y -> 3; recent (Sirin-era <11y) -> 4', () => {
  const p = payloadWithRoles([
    { id: 'r0', title: 'Product Expert', company: 'Kanzen', years: '2022 - 2026 (present)', on: true, bullets: B(6) },       // current -> 4
    { id: 'r1', title: 'Senior Optics Engineer', company: 'Sirin', years: '2014 - 2017', on: true, bullets: B(6) },          // ended 2017 ~9y -> 4 (verified-pair behaviour)
    { id: 'r2', title: 'Optics Engineer', company: 'Meprolight', years: '2010 - 2013', on: true, bullets: B(6) },            // ended 2013 ~13y, PLAIN -> 3
    { id: 'r3', title: 'Research Assistant', company: 'Tel Aviv University', years: '2006 - 2010', on: true, bullets: B(6) }, // ~16y -> 2
  ]);
  const exp = p.sections.find((s) => s.type === 'experience');
  const byCo = (c) => exp.roles.find((r) => r.company === c);
  assert.equal(byCo('Kanzen').bullets.length, 4, 'recent role keeps the plain-role cap');
  assert.equal(byCo('Sirin').bullets.length, 4, '<11y old is NOT tightened (Sirin shipped at 4)');
  assert.equal(byCo('Meprolight').bullets.length, 3, '11-15y plain role -> 3');
  assert.equal(byCo('Tel Aviv University').bullets.length, 2, '>=16y old -> 2 bullets (no RA/TA bullet stack)');
});

test('OLD-ROLE-BULLET-CAP: not applied in an UNSOLICITED export', () => {
  store.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
  const p = buildPayload({
    sections: { cv: [{ id: 'experience', type: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true,
      roles: [{ id: 'r2', title: 'Research Assistant', company: 'TAU', years: '2006 - 2010', on: true, bullets: B(6) }] }], cl: [] },
    doc: 'cv', personalInfo: { name: 'Gabriel' }, meta: { company: 'Unsolicited', role: 'Open Application' },
  });
  store.set('meta', JSON.stringify({ company: 'NIL Technology', role: 'Nanooptics Prototyping Engineer' }));  // restore for later tests
  const exp = p.sections.find((s) => s.type === 'experience');
  assert.equal(exp.roles[0].bullets.length, 6, 'unsolicited keeps the full breadth');
});

// OLD-ROLE-BULLET-CAP-001 refinement (owner 2026-07-04: "the age cap applies
// also for relevant roles — a merged role's bullets must be very relevant to
// stay"). Age cap is the FLOOR for a merged old role; bonus bullets above it
// (up to 5) are kept ONLY when JD-relevant.
test('OLD-ROLE merged: age cap is the floor; bonus bullets above it must be JD-relevant', () => {
  store.set('antcv:lastJdText', 'Hardware platform project management with modular design, validation, calibration, and supplier coordination for tracking systems and requirements.');
  const p = payloadWithRoles([{
    id: 'm', title: 'Electro-Optics Engineer & Team Leader', company: 'Meprolight', years: '2010 - 2014', on: true,  // 12y -> floor 3
    bullets: [
      'Led optical alignment and metrology for prototype builds.',        // floor 1
      'Ran design reviews across the optics group.',                       // floor 2
      'Managed prototype-to-production handover.',                         // floor 3
      'Owned validation and calibration workflows for tracking modules.',  // bonus RELEVANT
      'Mentored junior staff on soldering technique in the lab.',          // bonus NOT relevant
      'Coordinated supplier requirements and platform modular design.',    // bonus RELEVANT
    ],
  }]);
  store.delete('antcv:lastJdText');
  const role = p.sections.find((s) => s.type === 'experience').roles[0];
  // orphan-bind may NBSP-glue trailing words — normalize before matching.
  const bl = role.bullets.map((b) => String(b).replace(/ /g, ' '));
  assert.equal(bl.length, 5, 'floor 3 + 2 JD-relevant bonus bullets');
  assert.ok(bl.some((b) => /calibration/.test(b)), 'relevant bonus kept');
  assert.ok(bl.some((b) => /modular design/.test(b)), 'second relevant bonus kept');
  assert.ok(!bl.some((b) => /soldering technique/.test(b)), 'irrelevant bonus dropped');
});

test('OLD-ROLE merged with NO relevant bonus bullets -> falls to the age floor', () => {
  store.set('antcv:lastJdText', 'Unrelated culinary pastry baking role about ovens flour dough recipes kitchen hygiene and dessert plating across many shifts in a busy restaurant.');
  const p = payloadWithRoles([{
    id: 'm', title: 'EO Engineer & Team Leader', company: 'Meprolight', years: '2010 - 2014', on: true,  // 12y -> floor 3
    bullets: ['Led optical metrology.', 'Ran design reviews.', 'Managed transfer.', 'Owned validation workflows.', 'Coached staff.'],
  }]);
  store.delete('antcv:lastJdText');
  const role = p.sections.find((s) => s.type === 'experience').roles[0];
  assert.equal(role.bullets.length, 3, 'no JD-relevant bonus -> the 11-15y age floor');
});
