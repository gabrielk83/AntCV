// Unit tests for the pure core of scripts/check-cache-bust.mjs.
// No git / filesystem — fixtures only, so this is deterministic in CI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersionRefs,
  extractVersion,
  numericVer,
  auditDrift,
  rangeOffenders,
} from '../../../scripts/check-cache-bust.mjs';

test('parseVersionRefs extracts every name?v= pair', () => {
  const html = `
    <script src="app.js?v=1.50.742"></script>
    <link href="antcv-packages-registry.css?v=1.50.700">
    <script src="antcv-version-override.js?v=1.50.722"></script>
    <script src="antcv-foo.js?v=1.50.185-react-dom-guard"></script>
    <script src="no-version.js"></script>`;
  const refs = parseVersionRefs(html);
  assert.equal(refs.get('app.js'), '1.50.742');
  assert.equal(refs.get('antcv-packages-registry.css'), '1.50.700');
  assert.equal(refs.get('antcv-version-override.js'), '1.50.722');
  assert.equal(refs.get('antcv-foo.js'), '1.50.185-react-dom-guard');
  assert.equal(refs.has('no-version.js'), false); // no ?v → not cache-bustable
});

test('extractVersion pulls the version out of a commit subject', () => {
  assert.equal(extractVersion('1.50.743 — PUBLICATIONS-HIDE-STABLE-001'), '1.50.743');
  assert.equal(extractVersion('1.50.743b — cache-bust fix'), '1.50.743b');
  assert.equal(extractVersion('feat(page-breaks 1.50.202): native render'), '1.50.202');
  assert.equal(extractVersion('docs: rewrite nightly prompt'), null);
});

test('numericVer normalizes ?v tokens and versions to MAJOR.MINOR.PATCH', () => {
  assert.equal(numericVer('1.50.185-react-dom-guard'), '1.50.185');
  assert.equal(numericVer('1.50.743'), '1.50.743');
  assert.equal(numericVer('1.50.743b'), '1.50.743b'); // letter bump is a real release
  assert.equal(numericVer('garbage'), null);
});

test('auditDrift: a "-word" suffix that matches numerically is NOT drift', () => {
  const refs = new Map([['antcv-foo.js', '1.50.185-react-dom-guard']]);
  const lastChange = new Map([['antcv-foo.js', { version: '1.50.185', subject: 'x' }]]);
  assert.deepEqual(auditDrift(refs, lastChange), []);
});

test('auditDrift: numeric mismatch IS drift (the version-override case)', () => {
  const refs = new Map([['antcv-version-override.js', '1.50.722']]);
  const lastChange = new Map([
    ['antcv-version-override.js', { version: '1.50.743', subject: '1.50.743 — PUB-HIDE' }],
  ]);
  const drifts = auditDrift(refs, lastChange);
  assert.equal(drifts.length, 1);
  assert.equal(drifts[0].file, 'antcv-version-override.js');
  assert.equal(drifts[0].ref, '1.50.722');
  assert.equal(drifts[0].changedAt, '1.50.743');
});

test('auditDrift: skips files whose last-change commit has no version', () => {
  const refs = new Map([['antcv-foo.js', '1.50.100']]);
  const lastChange = new Map([['antcv-foo.js', { version: null, subject: 'docs only' }]]);
  assert.deepEqual(auditDrift(refs, lastChange), []);
});

test('rangeOffenders: changed assets missing a ?v bump are returned', () => {
  const changed = ['antcv-version-override.js', 'antcv-docx-client.js'];
  const bumped = ['antcv-docx-client.js']; // only this one got its ?v line touched
  assert.deepEqual(rangeOffenders(changed, bumped), ['antcv-version-override.js']);
});

test('rangeOffenders: all bumped → no offenders', () => {
  assert.deepEqual(rangeOffenders(['a.js', 'b.js'], ['a.js', 'b.js']), []);
});
