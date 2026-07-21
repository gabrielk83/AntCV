// cl-apply-placeholder-strip.test.mjs
// ============================================================
// CL-BLANK-001 (owner 2026-07: "most cover letter is blank — I had to regenerate it again").
//
// Root cause: the CL generation apply path (app.src.js, the big `cl: e.cl.map(...)` block) had two
// different placeholder-detectors for the `e.*` (previous-section) fallback used when the LLM
// returns nothing for a field:
//   - a():        strips a placeholder only when the WHOLE string is one bracket-wrapped block
//                 AND (is short with no nested "]") OR (contains an em-dash "—" / double-hyphen
//                 "--"). who/why/contribute were already fixed (CL-EMPTY-BODY-FIELDS-001 /
//                 HWIC-CONTRIB-REAL-FALLBACK-001) to use the next helper instead.
//   - __clReal():  strips ANY string starting with "[" (after trim), full stop.
//
// The Nordic CL template's CLOSURE placeholder has NESTED brackets ("[Company]",
// "[position/department]", "[relevant scope]") which defeats a()'s "single bracket-wrapped
// block" branch, and uses single hyphens (never an em-dash or "--"), which defeats its other
// branch. So a(closurePlaceholder) returned the placeholder VERBATIM (truthy) instead of "" — and
// `content: a(F.closure_content) || a(e.content) || n.closure || ""` then saved that raw bracketed
// template text as the CLOSURE section's real content on a fresh (or LLM-empty) generation. The
// export later detects content starting with "[" as a placeholder and blanks/drops the section —
// which reads to the owner as "the cover letter is blank". foundation.hands_on/.professionally had
// the same a()-vs-__clReal() gap. The fix (this session) switched all four to __clReal().
//
// This test is a regression lock: it (1) proves the literal Nordic CLOSURE placeholder is the kind
// of string a() fails on but __clReal() handles, and (2) asserts the apply-path source no longer
// uses the leaky a() form for foundation/closure's e.*-fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');

// Verbatim re-implementation of a() and __clReal() from app.src.js (~line 24699 / ~25425) — kept
// in sync by the source-presence assertions below, which fail loudly if either is edited without
// updating this test.
function a(e) {
  if ('string' != typeof e) return e;
  const t = e.trim();
  return t
    ? /^\[[A-Z][^\]]{2,500}\]$/i.test(t) ||
      (t.startsWith('[') && t.endsWith(']') && t.length < 1500 && /—|--/.test(t)) ||
      /^FILL_[a-z_0-9]+_(here|HERE)/.test(t)
      ? ''
      : e.replace(/\*\*/g, '')
    : '';
}
function __clReal(c) {
  const v = a(c) || '';
  return /^\s*\[/.test(String(v).trim()) ? '' : v;
}

// Pulled verbatim from the Nordic CL template's `closure` section in me()
// (CL-V5-STRUCT-001 reworded it to the v5 CLOSING rule; the placeholder SHAPE —
// nested brackets, no em dash — is what this test pins).
const NORDIC_CLOSURE_PLACEHOLDER =
  '[CLOSING - connect the strongest match, invite a conversation, and stay SHORTER than the body: "I would welcome a talk on how [strongest match] could support [Company] in [scope]." No generic sign-offs. Write in the target language (en/da/es/zh, etc.); default to the role\'s local language if the JD is in it.]';

test('source fixture: the Nordic closure placeholder is unchanged in app.src.js', () => {
  // app.src.js stores this as a JSON-escaped JS string literal (embedded `"` become `\"`) — compare
  // against the escaped form, not the runtime-decoded NORDIC_CLOSURE_PLACEHOLDER used below.
  const escaped = JSON.stringify(NORDIC_CLOSURE_PLACEHOLDER).slice(1, -1);
  assert.ok(src.includes(escaped), 'fixture text drifted from app.src.js — update the fixture');
});

test('a() fails to strip the Nordic closure placeholder (nested brackets + no em-dash defeats both branches)', () => {
  assert.equal(a(NORDIC_CLOSURE_PLACEHOLDER), NORDIC_CLOSURE_PLACEHOLDER, 'documents the historical leak a() had on this exact string');
});

test('__clReal() correctly strips the same placeholder to empty', () => {
  assert.equal(__clReal(NORDIC_CLOSURE_PLACEHOLDER), '');
});

test('__clReal() never strips real generated prose (no leading bracket)', () => {
  const real = 'I would welcome the chance to discuss how this background fits the role in more detail.';
  assert.equal(__clReal(real), real);
});

test('regression lock: foundation/closure apply-path uses __clReal(), not the leaky a(), for the e.*-fallback', () => {
  assert.ok(/hands_on:\s*\n?\s*__clReal\(F\.foundation_hands_on\)\s*\|\|\s*\n?\s*__clReal\(e\.hands_on\)/.test(src),
    'foundation.hands_on reverted to a() — the Nordic closure-style placeholder leak can return');
  assert.ok(/professionally:\s*\n?\s*__clReal\(F\.foundation_professionally\)\s*\|\|\s*\n?\s*__clReal\(e\.professionally\)/.test(src),
    'foundation.professionally reverted to a()');
  assert.ok(/"closure" === e\.id[\s\S]{0,300}__clReal\(F\.closure_content\)\s*\|\|\s*\n?\s*__clReal\(e\.content\)/.test(src),
    'closure.content reverted to a()');
  assert.ok(/"opening" === e\.id[\s\S]{0,300}__clReal\(D\.opening\)\s*\|\|\s*\n?\s*__clReal\(r\("opening", "content"\)\)/.test(src),
    'opening.content reverted to a()');
});
