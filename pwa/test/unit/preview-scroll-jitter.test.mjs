// preview-scroll-jitter.test.mjs — PREVIEW-SCROLL-JITTER-001 (owner 2026-07-05).
//
// Live phone report: "the preview is a bit shaky (you can see it between two
// pages)". Live-proven via CDP on the real device: scrolled the preview to
// scrollTop:500 (into page 2), then triggered a real style-package change
// through the app's own reset API (window.AntcvPackageState.write — the same
// legitimate code path a Settings UI click uses, not a raw localStorage
// poke). scrollTop dropped to 209 within ~1s with zero user interaction.
//
// Root cause: the preview's fit-recompute effect (`_i()` in app.src.js,
// `Gi()` in the minified mirror) unconditionally snaps the scroll position
// back to (0,0) — immediate + 80ms + 240ms staggered calls — and used to run
// on ANY change to [Lt, je, Ke, ya] (doc type, language, navyColor,
// styleConfig). Lt/je (doc/language) are genuine, deliberate user choices —
// resetting to the top when the user switches CV<->CL or changes language
// makes sense. Ke/ya (navyColor/styleConfig) are PURELY COSMETIC and change
// silently in the background (brand-fit, the STYLE-BG-FOLLOW-PKG-001
// self-heal effect, cloud-restore) while the user may be mid-scroll reading
// page 2 — a colour/font change has no reason to move their reading
// position. Fix: drop Ke/ya from this effect's dependency array; Lt/je stay.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

test('app.src.js: the scroll-reset effect no longer depends on navyColor/styleConfig', () => {
  assert.ok(src.includes('}, [Lt, je, _i]),'), 'dependency array must be exactly [Lt, je, _i]');
  assert.equal(src.includes('}, [Lt, je, Ke, ya, _i]),'), false, 'the old broad dependency array (including cosmetic Ke/ya) must be gone');
});

test('app.js (minified mirror): same trimmed dependency array', () => {
  assert.ok(app.includes('Gi()},[Xt,Be,Gi])'), 'minified dependency array must be exactly [Xt,Be,Gi]');
  assert.equal(app.includes('Gi()},[Xt,Be,We,Ga,Gi])'), false, 'the old broad dependency array must be gone from app.js');
});

test('the fit-recompute function itself (_i/Gi) is untouched — still fires on doc/language change', () => {
  // Lt (doc) and je (language) are genuine content changes; a reset-to-top
  // on switching CV<->CL or language is still correct and must survive.
  const idx = src.indexOf('}, [Lt, je, _i]),');
  assert.ok(idx > 0);
  const before = src.slice(Math.max(0, idx - 1200), idx);
  assert.match(before, /_i\(\)/, 'the effect body must still call _i()');
});
