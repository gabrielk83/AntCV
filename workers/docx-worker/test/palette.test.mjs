// Unit + drift tests for the DOCX worker package palette.
//
// palette.js inlines the seven locked visual packages from
// packages/registry.json (the worker can't import outside its directory
// under the wrangler build). Its header says "keep in sync with
// packages/registry.json ... by hand" — this suite enforces that, so a
// registry colour/font edit that forgets the worker copy fails in CI.
//
// Two transforms are intentional and encoded here, not flagged as drift:
//   - colours: the registry stores "#RRGGBB"; OOXML hex omits the "#".
//   - headingFont: the registry stores e.g. "Segoe UI Bold"; the palette
//     strips the trailing " Bold" (bold weight is a per-run attribute).
//
// Run from inside workers/docx-worker/:  node --test test/palette.test.mjs
// Pure logic, no fflate, no Cloudflare bindings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  normalisePackageId,
  getPackageStyle,
  SUPPORTED_PACKAGES,
} from '../src/palette.js';

const reg = JSON.parse(
  readFileSync(new URL('../../../packages/registry.json', import.meta.url), 'utf8'),
);

const regIds = Object.keys(reg.packages);
const ooxmlHex = (v) => String(v).replace(/^#/, '').toUpperCase();
const stripBold = (v) => String(v).replace(/ Bold$/, '');

// ─── Registry integrity ──────────────────────────────────────────────────

test('registry default is a real package', () => {
  assert.ok(regIds.includes(reg.default), `default "${reg.default}" not in packages`);
});

test('registry has the seven locked packages, each fully specified', () => {
  assert.equal(regIds.length, 7);
  const required = ['base', 'primary', 'interactive', 'bullet', 'glyph', 'headingFont', 'bodyFont'];
  for (const id of regIds) {
    const p = reg.packages[id];
    for (const f of required) {
      assert.ok(p[f] != null && p[f] !== '', `${id} missing ${f}`);
    }
  }
});

test('registry colours are valid #RRGGBB hex', () => {
  const hex = /^#[0-9A-Fa-f]{6}$/;
  for (const id of regIds) {
    const p = reg.packages[id];
    for (const f of ['base', 'primary', 'interactive', 'bullet', 'glyph']) {
      assert.match(p[f], hex, `${id}.${f} = "${p[f]}" is not #RRGGBB`);
    }
  }
});

// ─── normalisePackageId ──────────────────────────────────────────────────

test('normalisePackageId: package id set matches the registry', () => {
  assert.deepEqual([...SUPPORTED_PACKAGES].sort(), [...regIds].sort());
});

test('normalisePackageId: unknown / non-string falls back to the registry default', () => {
  assert.equal(normalisePackageId('no-such-package'), reg.default);
  assert.equal(normalisePackageId(''), reg.default);
  assert.equal(normalisePackageId(undefined), reg.default);
  assert.equal(normalisePackageId(42), reg.default);
});

test('normalisePackageId: case-insensitive, whitespace-trimmed, alias-aware', () => {
  assert.equal(normalisePackageId('  Navy-Executive '), 'navy-executive');
  assert.equal(normalisePackageId('navy'), 'navy-executive');
  assert.equal(normalisePackageId('default'), 'copenhagen-modern');
  assert.equal(normalisePackageId('technical'), 'delhi-technical');
});

// ─── Drift guard: palette values vs registry (with documented transforms) ─

test('palette colours match the registry for every package (ignoring the "#" prefix)', () => {
  for (const id of regIds) {
    const r = reg.packages[id];
    const s = getPackageStyle(id, false);
    assert.equal(s.mainHeadColor.toUpperCase(), ooxmlHex(r.base), `${id} base`);
    assert.equal(s.sidebarHeadColor.toUpperCase(), ooxmlHex(r.primary), `${id} primary`);
    assert.equal(s.accent.toUpperCase(), ooxmlHex(r.interactive), `${id} interactive`);
    assert.equal(s.mainBulletColor.toUpperCase(), ooxmlHex(r.bullet), `${id} bullet`);
  }
});

test('palette fonts match the registry (heading with " Bold" stripped)', () => {
  for (const id of regIds) {
    const r = reg.packages[id];
    const s = getPackageStyle(id, false);
    assert.equal(s.mainHeadFont, stripBold(r.headingFont), `${id} headingFont`);
    assert.equal(s.mainBodyFont, r.bodyFont, `${id} bodyFont`);
  }
});

// ─── getPackageStyle behaviour ───────────────────────────────────────────

test('getPackageStyle: legacy-ATS tier forces a Calibri body font', () => {
  for (const id of regIds) {
    const s = getPackageStyle(id, true);
    assert.equal(s.mainBodyFont, 'Calibri', `${id} body under legacy ATS`);
    assert.equal(s.sidebarBodyFont, 'Calibri', `${id} sidebar body under legacy ATS`);
    // Heading font is unchanged by the ATS tier.
    assert.equal(s.mainHeadFont, stripBold(reg.packages[id].headingFont), `${id} heading under legacy ATS`);
  }
});

test('getPackageStyle: universal tokens are package-independent', () => {
  for (const id of regIds) {
    const s = getPackageStyle(id, false);
    assert.equal(s.mainTextColor, '1F2937');
    assert.equal(s.sidebarTextColor, 'FFFFFF');
    assert.equal(s.headerNameColor, 'FFFFFF');
  }
});

test('getPackageStyle: an unknown id resolves to the default package style', () => {
  const dflt = getPackageStyle(reg.default, false);
  const unknown = getPackageStyle('nonsense', false);
  assert.deepEqual(unknown, dflt);
});
