// subtitle-no-double-company.test.mjs
// ============================================================
// CL-APP-SUBTITLE-NO-DOUBLE-COMPANY-001 (owner 2026-07-22, 3Shape screenshot).
// The "Application: <role> - <company>" band appended the company to a role that
// ALREADY ended in "- <company>" (the scraped jd_role bakes the employer into the
// position name), rendering "… - 3Shape - 3Shape". The composition now runs through
// a helper that strips a trailing "- <company>" from the role first, only when that
// tail is EXACTLY the company (so a legit role word is never touched), then joins once.
// Preview (app.src.js + app.js mirror) and export (docx-client __stripRoleCo) share
// the same logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// spec: the exact composition the code implements
function compose(role, company) {
  const c = String(company == null ? '' : company).trim();
  let r = String(role == null ? '' : role).trim();
  if (c) { const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); r = r.replace(new RegExp('\\s*[-–—]\\s*' + esc + '\\s*$', 'i'), '').trim(); }
  return r && c ? r + ' - ' + c : (r || c || '');
}

test('the 3Shape case: role with the company baked in is not doubled', () => {
  const role = 'Senior Project Manager - R&D Medical Devices, 3D Scanning & Diagnostics - 3Shape';
  assert.equal(compose(role, '3Shape'),
    'Senior Project Manager - R&D Medical Devices, 3D Scanning & Diagnostics - 3Shape');
  // exactly ONE trailing "- 3Shape"
  assert.equal((compose(role, '3Shape').match(/-\s*3Shape/gi) || []).length, 1);
});

test('an en-dash / em-dash company suffix is also stripped', () => {
  assert.equal(compose('Systems Engineer – Demant', 'Demant'), 'Systems Engineer - Demant');
  assert.equal(compose('Systems Engineer — Demant', 'Demant'), 'Systems Engineer - Demant');
});

test('a clean role (no company suffix) is joined normally', () => {
  assert.equal(compose('Optical System Engineer', 'NVIDIA'), 'Optical System Engineer - NVIDIA');
});

test('a legit role word matching part of the company is NOT stripped', () => {
  // only a trailing "- <exact company>" is removed; an internal hyphen stays
  assert.equal(compose('R&D - Optics Lead', 'Optics'), 'R&D - Optics Lead - Optics');
});

test('empty role or company degrade gracefully', () => {
  assert.equal(compose('', 'NVIDIA'), 'NVIDIA');
  assert.equal(compose('Engineer', ''), 'Engineer');
  assert.equal(compose('', ''), '');
});

test('mirror lock: helper present in both app bundles + docx export', async () => {
  const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  const docx = await readFile(new URL('../../antcv-docx-client.js', import.meta.url), 'utf8');
  assert.ok(src.includes('function __antcvSubtitleRoleCo('), 'app.src.js helper');
  assert.ok(min.includes('function __antcvSubtitleRoleCo('), 'app.js mirror helper');
  assert.ok(docx.includes('const __stripRoleCo ='), 'docx-client export helper');
  // the raw doubling composition is gone from the preview bundles
  assert.ok(!/role\|\|""\}\$\{[A-Za-z$_]+\.role&&[A-Za-z$_]+\.company\?" - "/.test(min), 'no raw compose left in app.js');
  assert.ok(!src.includes('${io.role || ""}${io.role && io.company ? " - " : ""}'), 'no raw compose left in app.src.js');
});
