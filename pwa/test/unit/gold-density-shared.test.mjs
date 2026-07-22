// gold-density-shared.test.mjs — LINE-DISTRIBUTION-001 (owner 2026-07-22, OPEN_REGISTER row 61).
//
// The fill-band spec must have ONE source: pwa/gold-rules.json `density`, read by BOTH the
// Python density loop (measure_density.py RUNT_FRAC/FILL_LO/FILL_HI) and the JS prompt
// calibration (antcv-bullet-targets.js). Before this fix the JS side hand-duplicated the
// numbers and had drifted (0.70 vs gold 0.65 lower bound).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'antcv-bullet-targets.js'), 'utf8');
const gold = JSON.parse(readFileSync(join(PWA, 'gold-rules.json'), 'utf8'));

test('gold-rules.json carries the density block both sides read', () => {
  assert.ok(gold.density, 'density block');
  assert.ok(Array.isArray(gold.density.fill_band) && gold.density.fill_band.length >= 2, 'fill_band');
  assert.equal(typeof gold.density.runt_fraction, 'number', 'runt_fraction');
});

test('bullet-targets reads gold density (goldDensity), not hardcoded fractions', () => {
  assert.ok(src.includes('function goldDensity()'), 'goldDensity helper present');
  assert.ok(/l1: \[b\(0, gd\.lo\), b\(0, gd\.hi\)\]/.test(src), 'buildWidthBlock buckets use gd.lo/gd.hi');
  assert.ok(/Math\.round\(gd\.runt \* 100\)/.test(src), 'runt sentence uses gd.runt');
  assert.ok(/if \(fill >= gd\.runt\) return null;/.test(src), 'bulletWindow runt check uses gd.runt');
  assert.ok(/\(gd\.hi \* widthPx - lineW\)/.test(src), 'bulletWindow grow-hi uses gd.hi');
  // the old drifted literals must be gone from the two functions
  assert.ok(!/b\(0, 0\.70\)/.test(src), 'no hardcoded 0.70 bucket');
  assert.ok(!/if \(fill >= 0\.60\) return null/.test(src), 'no hardcoded 0.60 runt check');
});

test('goldDensity fallbacks mirror gold-rules.json values', () => {
  const m = src.match(/function goldDensity\(\)[\s\S]{0,500}?return \{ lo: band\[0\], hi: band\[1\], runt: runt \};/);
  assert.ok(m, 'goldDensity body found');
  assert.ok(m[0].includes('[0.65, 0.97]'), 'fallback band matches gold fill_band');
  assert.ok(m[0].includes('0.60'), 'fallback runt matches gold runt_fraction');
  assert.equal(gold.density.fill_band[0], 0.65);
  assert.equal(gold.density.fill_band[1], 0.97);
  assert.equal(gold.density.runt_fraction, 0.6);
});
