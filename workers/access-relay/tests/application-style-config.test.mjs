/* BRAND-FIT-PER-APP-001 regression guard.
 *
 * COMPANY-BRAND-FIT-001 (pwa/app.src.js) previously persisted brand-fit-
 * derived colors to account-wide keys (navyColor/styleConfig in KV prefs),
 * so generating one CV with brand fit on for one company recolored every
 * future application on every device. The fix gives each `application` D1
 * row its own `style_config` column — this test guards the read-side shape
 * function (shapeApplicationRow) that surfaces it to the client, and the
 * parseJsonField degrade-on-malformed-JSON behaviour it relies on.
 *
 * Run: node --test workers/access-relay/tests/application-style-config.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Normalise CRLF -> LF so the marker-offset extraction below is checkout-
// independent (git stores src/index.js as LF; a Windows autocrlf checkout
// materialises CRLF, which breaks the '\n'-based end markers). Same EOL-
// fragility class as the native-print-clip test fix.
const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start) + endMarker.length;
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

const parseJsonFieldSrc = extract('function parseJsonField(', '\n}');
const shapeSrc = extract('function shapeApplicationRow(row) {', '  };\n}');

const ctx = { console, JSON, String, Array, Object };
vm.createContext(ctx);
vm.runInContext(
  parseJsonFieldSrc + '\n' + shapeSrc +
  '\nthis.shapeApplicationRow = shapeApplicationRow;',
  ctx,
);
const { shapeApplicationRow } = ctx;

function baseRow(overrides) {
  return {
    id: 1, user_hash: 'u1', jd_hash: 'h1', jd_text: 'jd',
    supporting_context: '', jd_language: 'en', jd_company: 'Acme',
    jd_role: 'Engineer', subtitle: '', meta: null, category: 'targeted',
    rationale: null, cv_sections: null, cl_sections: null,
    created_at: 1, updated_at: 1,
    ...overrides,
  };
}

test('style_config is null when the column is null (legacy row / never brand-fit-generated)', () => {
  const shaped = shapeApplicationRow(baseRow({ style_config: null }));
  assert.equal(shaped.style_config, null);
});

test('style_config parses a saved JSON blob into an object', () => {
  const cfg = { headerBg: '#222222', mainHeadColor: '#ec691a', sidebarBg: '#f6f6f6' };
  const shaped = shapeApplicationRow(baseRow({ style_config: JSON.stringify(cfg) }));
  assert.deepEqual(shaped.style_config, cfg);
});

test('malformed style_config JSON degrades to null, never throws', () => {
  const shaped = shapeApplicationRow(baseRow({ style_config: 'not-json{{{' }));
  assert.equal(shaped.style_config, null);
});

test('shapeApplicationRow returns null for a null row (unchanged existing behaviour)', () => {
  assert.equal(shapeApplicationRow(null), null);
});

test('other fields are unaffected by the new column (spot-check)', () => {
  const shaped = shapeApplicationRow(baseRow({ style_config: null, jd_company: 'Trackman A/S' }));
  assert.equal(shaped.jd_company, 'Trackman A/S');
  assert.equal(shaped.category, 'targeted');
});
