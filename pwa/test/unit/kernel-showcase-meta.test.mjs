// kernel-showcase-meta.test.mjs
// ============================================================
// End-to-end logic verification for the kernel-showcase
// meta-override and rescue path shipped in 1.50.257 / 1.50.258.
//
// The actual logic lives deep inside app.src.js (~line 20520) in a
// closure we can't reach from Node. We mirror it here EXACTLY so
// the 4 scenarios the owner cares about (and the regression we
// just fixed) are pinned by a unit test.
//
// If this file ever drifts from app.src.js, both must be updated
// together — the comments below quote the source lines.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Mirror of app.src.js ~20520..20680 (only the parts that
//     decide W.company / W.role / W.subtitle / W.opening). ---
function deriveShowcaseMeta(opts) {
  const D = opts.llmMeta || {};
  const personalInfo = opts.personalInfo || {};
  const inShowcaseMode = !!opts.inShowcaseMode;
  const ioCompany = opts.ioCompany || '';

  const showcaseGate =
    inShowcaseMode || (ioCompany && ioCompany === 'Unsolicited');

  let W = { ...D };

  if (showcaseGate) {
    const e = personalInfo || {};
    const t = ((e.roles || [])[0] && (e.roles || [])[0].title) || '';

    // 1.50.258: subtitle preference flipped — prefer LLM's subtitle,
    // fall back to headline / role title / "Open Application — Unsolicited".
    const n =
      D && D.subtitle && D.subtitle.trim()
        ? D.subtitle.trim()
        : e.headline && e.headline.trim()
          ? e.headline.trim()
          : t || 'Open Application — Unsolicited';

    W = {
      ...D,
      company: 'Unsolicited',
      role: t || 'Open Application',
      subtitle: n,
      greeting: 'Dear Hiring Manager,',
      opening:
        'I am writing to introduce myself and express my interest in future opportunities at your organisation.',
    };
  }

  // 1.50.257: rescue specialisation from CL opening (runs
  // unconditionally, just before lo()).
  try {
    const subRaw = W && W.subtitle ? String(W.subtitle).trim() : '';
    const subEmpty =
      !subRaw ||
      /^\[specialis(ation|ering)/i.test(subRaw) ||
      /^\[focus\s+area/i.test(subRaw);
    if (subEmpty && W && W.opening) {
      const m = String(W.opening).match(
        /background in\s+([^.;\n]+?)(?:\s+(?:for|where|to)\b|[.;\n]|$)/i,
      );
      if (m && m[1]) {
        const focus = m[1]
          .replace(/\s+and\s+/i, ', ')
          .split(/\s*,\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3);
        if (focus.length) W.subtitle = focus.join(' • ');
      }
    }
  } catch (_) {
    /* swallow */
  }

  return W;
}

// ============================================================
test('S1 — LLM emits a usable subtitle: trust it, do not rescue', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: true,
    personalInfo: { roles: [{ title: 'Principal Engineer' }], headline: '' },
    llmMeta: {
      subtitle: 'systems architecture, change governance, electro-optical engineering',
      opening: 'Some unrelated opening that contains background in some phrase.',
    },
  });
  assert.equal(W.company, 'Unsolicited');
  assert.equal(W.role, 'Principal Engineer');
  assert.equal(
    W.subtitle,
    'systems architecture, change governance, electro-optical engineering',
    'LLM subtitle should be kept verbatim (preference flip)',
  );
  assert.equal(
    W.opening,
    'I am writing to introduce myself and express my interest in future opportunities at your organisation.',
    'opening should be the owner-spec neutral text, not the LLM body',
  );
});

test('S2 — owner regression: LLM emits empty subtitle and routes focus areas into opening → rescue lifts them into subtitle', () => {
  // This is the exact failing scenario reported 2026-06-07.
  const W = deriveShowcaseMeta({
    inShowcaseMode: false, // showcase gate misses (the bug condition)
    personalInfo: {},
    llmMeta: {
      subtitle: '',
      opening:
        'I am writing to introduce my background in systems architecture, change governance, and electro-optical engineering.',
    },
  });
  assert.equal(
    W.subtitle,
    'systems architecture • change governance • electro-optical engineering',
    'rescue should pull the 3 focus areas out of the LLM opening',
  );
});

test('S3 — showcase mode with no LLM subtitle and no personalInfo headline → fall back to first role title', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: true,
    personalInfo: { roles: [{ title: 'Systems Architect' }], headline: '' },
    llmMeta: { subtitle: '', opening: 'A non-matching opening.' },
  });
  assert.equal(W.subtitle, 'Systems Architect');
  assert.equal(W.role, 'Systems Architect');
});

test('S4 — showcase mode with personalInfo.headline set, LLM emits empty subtitle → headline wins', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: true,
    personalInfo: {
      roles: [{ title: 'Senior Engineer' }],
      headline: 'Cross-discipline systems & change leader',
    },
    llmMeta: { subtitle: '', opening: 'A non-matching opening.' },
  });
  assert.equal(W.subtitle, 'Cross-discipline systems & change leader');
});

test('S5 — empty everything → "Open Application — Unsolicited" subtitle', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: true,
    personalInfo: {},
    llmMeta: { subtitle: '', opening: '' },
  });
  assert.equal(W.subtitle, 'Open Application — Unsolicited');
  assert.equal(W.role, 'Open Application');
});

test('S6 — placeholder subtitle still triggers rescue when opening matches', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: false,
    personalInfo: {},
    llmMeta: {
      subtitle: '[Specialisation — 1–3 focus areas, separated by •]',
      opening:
        'I am writing to introduce my background in optics, controls, and signal processing.',
    },
  });
  assert.equal(W.subtitle, 'optics • controls • signal processing');
});

test('S7 — opening with "background in" inside a longer sentence stops at the first natural boundary', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: false,
    personalInfo: {},
    llmMeta: {
      subtitle: '',
      opening:
        'I am writing to introduce my background in optics, controls, and signal processing for roles that demand cross-discipline coordination.',
    },
  });
  // Should stop at " for " — not bleed into "roles that demand…"
  assert.equal(W.subtitle, 'optics • controls • signal processing');
});

test('S8 — showcase mode FORCES company to Unsolicited even when LLM hallucinated a real company', () => {
  const W = deriveShowcaseMeta({
    inShowcaseMode: true,
    personalInfo: { roles: [{ title: 'Engineer' }] },
    llmMeta: {
      company: 'Kvadrat',
      role: 'Designer',
      subtitle: 'product design',
      opening: 'Opening text.',
    },
  });
  assert.equal(W.company, 'Unsolicited', 'must NOT keep hallucinated company');
  assert.equal(W.role, 'Engineer', 'role from personalInfo, not from LLM');
});

test('S9 — opening is the owner-spec neutral text in EVERY showcase-mode case', () => {
  const expectedOpening =
    'I am writing to introduce myself and express my interest in future opportunities at your organisation.';
  for (const llmOpening of [
    '',
    'Anything the LLM wrote here gets replaced.',
    'I am writing to introduce my background in A, B, and C.',
  ]) {
    const W = deriveShowcaseMeta({
      inShowcaseMode: true,
      personalInfo: { roles: [{ title: 'X' }] },
      llmMeta: { subtitle: 'something', opening: llmOpening },
    });
    assert.equal(W.opening, expectedOpening, `mismatch for input=${JSON.stringify(llmOpening)}`);
  }
});
