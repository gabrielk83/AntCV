// upload-screen-top-clip.test.mjs — UPLOAD-SCREEN-TOP-CLIP-001 (owner 2026-07-05).
//
// Live-verified on a real phone (via CDP): the EN/gear/Editor header row on
// the upload screen rendered off-screen above the viewport (top:-13px) when
// content was taller than one viewport, and — separately — rendered BEHIND
// the "Generating kernel showcase…" fixed banner (top:38px, inside the
// banner's own 0-58px span) while a background generation was running.
//
// SUPERSEDES the earlier UPLOAD-SCREEN-SCROLLTOP-001 attempt (forcing
// `ref: el => el.scrollTop = 0` on mount) — that was chasing the wrong
// mechanism. Live measurement showed the header row at a negative offset
// even with scrollTop already 0: the clip wasn't a scroll-position
// artifact, it was `justifyContent:"center"` on the outer flex column
// actively centering overflowing content, symmetrically eating ~20px off
// BOTH the top and bottom. The inner wrapper's `margin:"auto 0"` already
// resolves to 0 once content overflows (correct top-anchor-and-scroll per
// the flexbox spec) — but a competing `justifyContent:"center"` on the
// outer container fought it. Dropping to "flex-start" removes the conflict.
//
// Confirmed live: toggling this one property on the real DOM node moved the
// header row from top:-13px (off-screen) / top:38px (behind the banner) to
// a clean top:79px, clear of both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

// The upload-screen "fade" block is the only one with height:"100dvh" +
// overflowY:"auto" together (the other "fade" screens use minHeight and are
// unaffected) — use that combo as the unique anchor into each file.
function uploadScreenBlock(text, needle) {
  const idx = text.indexOf(needle);
  assert.ok(idx > 0, `anchor "${needle}" not found`);
  return text.slice(idx, idx + 1600);
}

// The actual style OBJECT, skipping past the (long) explanatory comment —
// avoids false-positives from the comment's own prose mentioning "center".
function uploadScreenStyleObject(text) {
  const commentIdx = text.indexOf('UPLOAD-SCREEN-TOP-CLIP-001');
  assert.ok(commentIdx > 0, 'UPLOAD-SCREEN-TOP-CLIP-001 anchor not found');
  const styleIdx = text.indexOf('style: {', commentIdx);
  assert.ok(styleIdx > 0, 'style object not found after the comment');
  return text.slice(styleIdx, styleIdx + 400);
}

test('app.src.js: upload-screen fade container no longer centers overflowing content', () => {
  const block = uploadScreenStyleObject(src);
  assert.match(block, /justifyContent:\s*"flex-start"/, 'must top-align, not center, so overflow/banner-offset content is reachable');
  assert.equal(/justifyContent:\s*"center"/.test(block), false, 'the old centering value must be gone from this block');
});

test('app.src.js: the ineffective scrollTop-forcing ref is removed (dead code from the superseded fix)', () => {
  const block = uploadScreenBlock(src, 'UPLOAD-SCREEN-TOP-CLIP-001');
  assert.equal(/el\.scrollTop\s*=\s*0/.test(block), false, 'scrollTop=0 never fixed anything (scrollTop was already 0) — should not linger as cargo-cult code');
});

test('app.js (minified mirror): same top-align fix, ref cleanup', () => {
  const block = uploadScreenBlock(app, 'justifyContent:"flex-start",padding:20,fontFamily:"Georgia,serif"');
  assert.match(block, /justifyContent:"flex-start"/, 'must top-align in the minified mirror too');
  assert.equal(/className:"fade",ref:e=>\{e&&\(e\.scrollTop=0\)\}/.test(app), false, 'dead scrollTop-forcing ref must be gone from app.js');
});

test('the inner content wrapper still keeps margin:"auto 0" (centers when short, top-anchors when tall)', () => {
  const idx = src.indexOf('UPLOAD-SCREEN-TOP-CLIP-001');
  const block = src.slice(idx, idx + 1400);
  assert.match(block, /margin:\s*"auto 0"/, 'removing outer centering must not also remove the inner auto-margin — that is what keeps it looking centered on short content');
});
