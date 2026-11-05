// company-match.test.mjs — COMPANY-MATCH-001 (owner 2026-11-01, D1 3524 Ambu / 3525 ASSA ABLOY)
// The shared "which application does this text belong to" matcher every cross-application
// guard relies on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../../antcv-company-match.js');

test('name variants: legal suffixes dropped, parenthesised brand kept, page-title junk ignored', () => {
  assert.deepEqual(M.tokens('Terma A/S'), ['terma']);
  assert.ok(M.tokens('ASSA ABLOY (Yale)').includes('yale'));
  assert.ok(M.tokens('ASSA ABLOY (Yale)').includes('assa abloy'));
  assert.ok(M.tokens('Hamamatsu Photonics A/S').includes('hamamatsu'));
  assert.ok(!M.tokens('Career Opportunities: Experienced Systems Engineer, Søborg (1424)').includes('career opportunities'));
  assert.deepEqual(M.tokens('Unsolicited'), ['unsolicited']);
});

test('names(): whole-word match, possessives count, another company does not', () => {
  assert.equal(M.names("I would bring this to Ambu's EndoIntelligence platform.", 'Ambu'), true);
  assert.equal(M.names('Terma builds radar and the systems engineer role fits me.', 'Ambu'), false);
  assert.equal(M.names('Smart locks for Yale households.', 'ASSA ABLOY (Yale)'), true);
  assert.equal(M.names('ambulance services', 'Ambu'), false, 'no substring match');
});

test('targeted vs unsolicited', () => {
  assert.equal(M.isTargeted('Ambu'), true);
  assert.equal(M.isTargeted('Unsolicited'), false);
  assert.equal(M.isTargeted('Open Application'), false);
  assert.equal(M.isTargeted(''), false);
});

test('sameApp(): employer AND posting; a new role at the same employer is a new application', () => {
  assert.equal(M.sameApp({ company: 'Terma', role: 'Experienced Systems Engineer' },
    { company: 'Ambu', role: 'Hardware Solution Architect, EndoIntelligence, Global R&D' }), false);
  assert.equal(M.sameApp({ company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA' },
    { company: 'ASSA ABLOY', role: 'Product Manager, Residential Access EMEIA' }), true);
  assert.equal(M.sameApp({ company: 'Hamamatsu Photonics A/S', role: 'Optical Engineer for R&D Projects' },
    { company: 'Hamamatsu Photonics A/S', role: 'Technical Project Manager Quantum Systems' }), false);
  assert.equal(M.sameApp({ company: 'Unsolicited', role: 'x' }, { company: '', role: 'y' }), true);
});

test('otherCompaniesNamed(): lists the foreign employers a text names', () => {
  const t = 'Terma builds radar systems for naval customers.';
  assert.deepEqual(M.otherCompaniesNamed(t, ['Terma A/S', 'Ambu', 'Unsolicited'], 'Ambu'), ['Terma A/S']);
  assert.deepEqual(M.otherCompaniesNamed(t, ['Terma A/S'], 'Terma'), []);
});
