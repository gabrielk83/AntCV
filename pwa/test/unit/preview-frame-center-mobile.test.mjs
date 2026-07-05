// preview-frame-center-mobile.test.mjs — PREVIEW-FRAME-CENTER-MOBILE-001
// (owner 2026-07-05: "no reason for the preview to be pushed like that").
//
// .antcv-preview-frame (the actual zoomed CV/CL page) never centred itself
// on mobile — margin was "0 0 0 0" there vs "0 auto" on desktop. Invisible
// before ZOOM-FLOOR-001 (same session, earlier) since at the old 35% zoom
// floor the frame was still wider than the viewport (auto-margins are a
// no-op when there's no extra space to distribute), so pinned-left vs.
// centred looked identical. The new 10% floor can make the frame much
// narrower than the viewport, and pinned-left then dumps all the freed
// space on the right of the screen — the "pushed" look reported live.
//
// Fix: margin is now unconditionally "0 auto" (safe — still a no-op
// whenever the frame is wider than its container, i.e. the normal,
// non-zoomed-out case; only starts centring once zoomed out far enough
// for it to matter).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

function frameStyleBlock(text) {
  const idx = text.indexOf('antcv-preview-frame');
  return text.slice(idx, idx + 2000);
}

test('app.src.js: .antcv-preview-frame centers unconditionally (no mobile/desktop branch)', () => {
  const block = frameStyleBlock(src);
  assert.match(block, /margin:\s*"0 auto"/, 'frame must always get margin:"0 auto"');
  assert.equal(/margin:\s*Ii\s*\?\s*"0 auto"\s*:\s*"0 0 0 0"/.test(block), false,
    'the old mobile/desktop conditional (pinned-left on mobile) must be gone');
});

test('app.js (minified mirror): same unconditional centering', () => {
  const block = frameStyleBlock(app);
  assert.match(block, /margin:"0 auto"/, 'frame must always get margin:"0 auto" in app.js');
  assert.equal(/margin:\w+\?"0 auto":"0 0 0 0"/.test(block), false,
    'the old mobile/desktop conditional must be gone from app.js');
});
