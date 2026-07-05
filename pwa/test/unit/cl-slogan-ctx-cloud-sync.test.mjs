// cl-slogan-ctx-cloud-sync.test.mjs
// ============================================================
// SLOGAN-CTX-CLOUD-001 (owner 2026-07-05, 2nd Trackman-style repro — a
// DIFFERENT company's slogan, "MAKING HARDWARE PLATFORMS WORK ACROSS SPORTS",
// stuck over a later Unsolicited application the same way the original
// Trackman report did, despite SLOGAN-UNSOL-CLEAR-001 (antcv-cl-slogan-fresh.js)
// already shipping a fix for exactly this leak.
//
// Root cause: that clear (pwa/antcv-cl-slogan-fresh.js tick(), the untargeted
// branch) only fires when antcv:clSloganCtx EXISTS and proves the override is
// owned by a DIFFERENT app (`ctx.v === S && ctx.app !== cur`). antcv:clSlogan
// itself was already cloud-synced (antcv-cl-cloud-sync-extra.js), but its
// ownership stamp antcv:clSloganCtx was NOT — so a fresh device/session (or
// any hard reset) restored the slogan TEXT from the cloud but not who it
// belonged to, leaving a ctx-less override the leak-check can never identify.
// This is a source-level regression lock (no browser needed) proving the ctx
// key is now wired into BOTH sync layers: the client sidecar's MAP and the
// server-side access-relay allowlist that gates what /api/prefs will persist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sidecar = await readFile(new URL('../../antcv-cl-cloud-sync-extra.js', import.meta.url), 'utf8');
const relay = await readFile(new URL('../../../workers/access-relay/src/index.js', import.meta.url), 'utf8');

test('the cloud-sync sidecar MAP carries antcv:clSloganCtx alongside antcv:clSlogan', () => {
  assert.match(sidecar, /\[\s*'antcv:clSloganCtx',\s*'clSloganCtx'\s*\]/, 'clSloganCtx must be a MAP entry');
  const sloganIdx = sidecar.indexOf("['antcv:clSlogan', 'clSlogan']");
  const ctxIdx = sidecar.indexOf("['antcv:clSloganCtx', 'clSloganCtx']");
  assert.ok(sloganIdx !== -1 && ctxIdx !== -1, 'both entries must be present');
});

test('the MAP array is consumed generically (adding an entry needs no other code change)', () => {
  assert.match(sidecar, /MAP\.forEach/, 'push/restore/snapshot must iterate MAP, not hardcode keys');
});

test('access-relay allowlists clSloganCtx as a KERNEL_PREFS_STR_FIELDS entry (server-side gate)', () => {
  assert.match(relay, /KERNEL_PREFS_STR_FIELDS\s*=\s*new Set\(\[[\s\S]*?'clSloganCtx'[\s\S]*?\]\)/, 'clSloganCtx must be allowlisted or /api/prefs silently drops it');
});

test('clSloganCtx sits in the SAME allowlist entry group as clSlogan/clSloganHidden/clSloganAlign', () => {
  const i = relay.indexOf("'clSlogan', 'clSloganHidden', 'clSloganAlign'");
  assert.ok(i !== -1, 'the sibling fields must still be present');
  const nearby = relay.slice(i, i + 200);
  assert.match(nearby, /'clSloganCtx'/, 'clSloganCtx must be declared right alongside its siblings');
});
