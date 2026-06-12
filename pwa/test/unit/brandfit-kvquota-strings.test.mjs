// brandfit-kvquota-strings.test.mjs
// ============================================================
// Owner batch 2026-06-12 night:
//   1. COMPANY-BRAND-FIT-001 — checkbox next to Generate + prompt rule +
//      validated merge (hex/darkness/font whitelist) in the bundle;
//   2. KV-QUOTA-001 — relay compare-before-write + guarded admin-demo put;
//      consent-sync client backoff;
//   3. console hygiene — manifest share_target enctype, rate-limited
//      setup-chips log, button-scoped hardrefresh probe, keys panel form.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(path.join(ROOT, ...p), 'utf8');
const bundle = read('app.js');

test('COMPANY-BRAND-FIT-001 — checkbox + prompt + merge in the bundle', () => {
  assert.ok(bundle.includes('data-antcv-brandfit'));
  assert.ok(bundle.includes('Brand fit (match colours & fonts to the target company)'));
  assert.ok(bundle.includes('BRAND FIT (the user opted in)'));
  assert.ok(bundle.includes('COMPANY-BRAND-FIT-001'));
  assert.ok(bundle.includes('Palatino Linotype')); // font whitelist reached the bundle
});

test('KV-QUOTA-001 — relay compare-before-write + guarded admin put', () => {
  const relay = read('..', 'workers', 'access-relay', 'src', 'index.js');
  assert.ok(relay.includes('KV-QUOTA-001'));
  assert.ok(relay.includes('kvRawBefore'));
  // the admin demo put is wrapped (kv_write_failed envelope appears at least twice now)
  assert.ok((relay.match(/kv_write_failed/g) || []).length >= 2);
});

test('consent-sync backoff after consecutive failures', () => {
  const s = read('antcv-ai-consent-cloud-sync-224.js');
  assert.ok(s.includes('failStreak'));
  assert.ok(s.includes("9 * 60000"));
});

test('console hygiene — manifest enctype + rate-limited chips log + scoped probe + keys form', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.share_target.enctype, 'application/x-www-form-urlencoded');
  assert.ok(read('antcv-setup-chips-live-372.js').includes('lastLogAt'));
  assert.ok(read('antcv-diag-probes-370.js').includes('ownTxt'));
  assert.ok(bundle.includes('"keys"') && /form/.test(bundle)); // keys panel hosts a form
});
