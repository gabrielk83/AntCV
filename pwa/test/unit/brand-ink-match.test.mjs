// brand-ink-match.test.mjs
// ============================================================
// BRAND-INK-MATCH-001 + BRAND-WORTHY-GATE-001 + BRAND-WORTHY-PICK-001
// (owner 2026-07-22). The brand-fit apply used to (a) gate on plain BRIGHTNESS
// (<0.62), which let NVIDIA green #76b900 through, then hardcode WHITE header ink
// -> white-on-green (2.4:1, illegible); and (b) treat a generic greyscale
// theme-color (#919191) as a brand -> a dull grey band. Owner rule (from NVIDIA's
// own site: BLACK text on their green): keep the company's real colour and MATCH
// the ink to it; when the sample is NOT a real brand, apply nothing so the user's
// chosen package default shows instead of grey.
//
// The logic is inline in both app bundles + the worker, so this is a spec lock
// (the decision maths) plus a mirror lock (both bundles + worker carry it, and the
// hardcoded white ink is gone).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// ---- the spec: the exact decision the code must implement ----
const wlin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const relLum = (h) => 0.2126 * wlin(parseInt(h.slice(1, 3), 16)) + 0.7152 * wlin(parseInt(h.slice(3, 5), 16)) + 0.0722 * wlin(parseInt(h.slice(5, 7), 16));
const ctr = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const brandInk = (h) => (ctr(h, '#111111') >= ctr(h, '#FFFFFF') ? '#111111' : '#FFFFFF');
const hslSat = (h) => {
  const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
};
const brandWorthy = (h) => hslSat(h) >= 0.15 || relLum(h) <= 0.06;

test('ink matches the background (the NVIDIA case)', () => {
  assert.equal(brandInk('#76b900'), '#111111', 'NVIDIA green -> BLACK text (matches their site)');
  assert.equal(brandInk('#0000a0'), '#FFFFFF', 'Nordea navy -> white');
  assert.equal(brandInk('#232323'), '#FFFFFF', 'near-black brand -> white');
  assert.equal(brandInk('#0076c0'), '#FFFFFF', 'Teledyne blue -> white');
  // and the chosen ink always clears WCAG AA (4.5:1) on that bg
  for (const bg of ['#76b900', '#0000a0', '#232323', '#0076c0', '#24405b']) {
    assert.ok(ctr(bg, brandInk(bg)) >= 4.5, `${bg} + matched ink >= 4.5:1`);
  }
});

test('brand-worthy accepts real brands, rejects generic grey', () => {
  assert.equal(brandWorthy('#76b900'), true, 'chromatic green');
  assert.equal(brandWorthy('#0000a0'), true, 'chromatic navy');
  assert.equal(brandWorthy('#232323'), true, 'deliberate near-black (Templafy)');
  assert.equal(brandWorthy('#919191'), false, 'generic theme-color grey -> package default');
  assert.equal(brandWorthy('#5f5f64'), false, 'dull near-grey -> package default');
  assert.equal(brandWorthy('#fafafa'), false, 'near-white -> not a header bg');
});

test('mirror lock: app.src.js carries the ink-match + worthy gate + sidebar ink var', async () => {
  const s = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
  assert.ok(s.includes('__brandWorthy'), 'brand-worthy gate present');
  assert.ok(s.includes('__brandInk'), 'ink matcher present');
  assert.ok(s.includes('"--sidebar-text-color":b.sidebarInk'), 'resolver emits sidebar ink from brandV2');
  assert.ok(!/headerInk:\s*"#FFFFFF"/.test(s), 'the hardcoded white ink is gone');
});

test('mirror lock: minified app.js carries the same logic (and no hardcoded white ink)', async () => {
  const s = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  assert.ok(/bw=h=>hs\(h\)>=\.15\|\|rl\(h\)<=\.06/.test(s), 'brand-worthy gate mirrored');
  assert.ok(/bi=h=>cr\(h,"#111111"\)/.test(s), 'ink matcher mirrored');
  assert.ok(s.includes('"--sidebar-text-color":b.sidebarInk'), 'resolver mirror emits sidebar ink');
  assert.ok(!s.includes('headerInk:"#FFFFFF"'), 'no hardcoded white ink in the brand apply');
});

test('mirror lock: worker prefers a real brand over grey theme-color and returns ink', async () => {
  const w = await readFile(new URL('../../../workers/proxy/src/fetch-brand-colors.js', import.meta.url), 'utf8');
  const d = await readFile(new URL('../../../workers/demo-proxy/src/fetch-brand-colors.js', import.meta.url), 'utf8');
  for (const [name, src] of [['proxy', w], ['demo-proxy', d]]) {
    assert.ok(src.includes('function isBrandWorthy'), `${name}: brand-worthy picker present`);
    assert.ok(src.includes('candidates.find(isBrandWorthy)'), `${name}: picks first brand-worthy candidate`);
    assert.ok(src.includes('ink: winner.ink'), `${name}: returns matched ink`);
    assert.ok(!src.includes('darken('), `${name}: no longer force-darkens the brand colour`);
  }
  assert.equal(w, d, 'proxy and demo-proxy copies are byte-identical');
});
