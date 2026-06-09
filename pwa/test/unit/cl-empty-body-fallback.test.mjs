// cl-empty-body-fallback.test.mjs
// ============================================================
// CL-EMPTY-BODY-FIELDS-001 (owner 2026-06-09): an exported CL showed the TEMPLATE
// placeholders for WHO I AM / WHY THIS POSITION and NO bullets in HOW I WOULD
// CONTRIBUTE. Two root causes, both fixed in app.src.js (1.50.329):
//   (a) the post-processor fallback chain used a(e.content), and e.content is the
//       me() placeholder "[WHO I AM — …]" — a() returns it verbatim (truthy), so
//       the placeholder leaked instead of the neutral fallback. __clReal treats a
//       bracketed placeholder as empty.
//   (b) the partial-response gate accepted n>=3 of 5 critical fields, so an empty
//       who+why+bullets response (foundation×2 + closure = 3) passed. Now
//       contribute_items is a 6th field and the bar is >=4 of 6.
// We mirror the deterministic decisions here (must stay in sync with app.src.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';

// mirror app.src.js a() (cleaner) loosely + __clReal
const a = (c) => (typeof c === 'string' ? c.replace(/\s+/g, ' ').trim() : (c || ''));
const __clReal = (c) => { const v = a(c) || ''; return /^\s*\[/.test(String(v).trim()) ? '' : v; };

// mirror the who/why fallback chain: __clReal(F.x) || __clReal(e.content) || neutral
function resolveBody(Fval, templatePlaceholder, neutral) {
  return __clReal(Fval) || __clReal(templatePlaceholder) || neutral;
}

// mirror the partial-response gate (6 fields, bar >= 4)
function criticalCount(cl) {
  const t = (e) => typeof e === 'string' && e.trim().length >= 25 && !/^\[[A-Z][^\]]{2,500}\]$/i.test(e.trim()) && !/^FILL_/.test(e.trim());
  const cib = Array.isArray(cl.contribute_items) && cl.contribute_items.filter((x) => { const s = typeof x === 'string' ? x : (x && x.t) || ''; return String(s).trim().length >= 10; }).length >= 2;
  return (t(cl.who_content) ? 1 : 0) + (t(cl.why_content) ? 1 : 0) + (t(cl.foundation_hands_on) ? 1 : 0) + (t(cl.foundation_professionally) ? 1 : 0) + (t(cl.closure_content) ? 1 : 0) + (cib ? 1 : 0);
}
const retries = (cl) => criticalCount(cl) < 4;

const PH_WHO = '[WHO I AM — 3-5 sentences introducing yourself professionally. Cover years of experience…]';
const NEUTRAL_WHO = 'I am an engineer with 15+ years across the roles listed on my CV.';

// ============================================================
test('E1 — empty who_content + template placeholder -> neutral fallback (no placeholder leak)', () => {
  const out = resolveBody('', PH_WHO, NEUTRAL_WHO);
  assert.equal(out, NEUTRAL_WHO);
  assert.ok(!/^\s*\[/.test(out), 'must never be a bracketed placeholder');
});

test('E2 — real who_content is kept verbatim', () => {
  const real = 'I am a systems engineer focused on electro-optics and traceable delivery.';
  assert.equal(resolveBody(real, PH_WHO, NEUTRAL_WHO), real);
});

test('E3 — LLM echoes the placeholder into who_content -> still rejected -> neutral', () => {
  assert.equal(resolveBody(PH_WHO, PH_WHO, NEUTRAL_WHO), NEUTRAL_WHO);
});

test('E4 — owner failing response (who+why+bullets empty, foundation×2+closure filled) RETRIES', () => {
  const cl = {
    who_content: PH_WHO, why_content: '[WHY THIS POSITION — …]',
    foundation_hands_on: 'I start by framing the problem and building the smallest prototype that exposes risk.',
    foundation_professionally: 'I keep decisions and rationale visible in shared notes so others can follow.',
    closure_content: 'I would welcome the opportunity to discuss how I could support your team.',
    contribute_items: [],
  };
  assert.equal(criticalCount(cl), 3, 'old gate counted 3 -> wrongly accepted');
  assert.equal(retries(cl), true, 'new gate (>=4 of 6) must RETRY this empty-body draft');
});

test('E5 — a fully filled CL is accepted (no needless retry)', () => {
  const cl = {
    who_content: 'A four-line narrative introduction that is clearly longer than the minimum.',
    why_content: 'A sentence or two on why this kind of role fits my background and priorities here.',
    foundation_hands_on: 'I start by framing the problem and building the smallest prototype that exposes risk.',
    foundation_professionally: 'I keep decisions and rationale visible in shared notes so others can follow.',
    closure_content: 'I would welcome the opportunity to discuss how I could support your team.',
    contribute_items: ['Learn the current setup and main flows first.', 'Map the highest-leverage gaps and propose small fixes.'],
  };
  assert.equal(criticalCount(cl), 6);
  assert.equal(retries(cl), false);
});
