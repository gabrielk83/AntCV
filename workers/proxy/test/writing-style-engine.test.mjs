// Unit tests for the proxy writing-style engine (plan §4.7 pipeline + §8.4
// writing-style-violation matrix seed). Pure-logic coverage: request parsing,
// preamble building, the Semantic Constraint Engine banned-list filter, the
// language-partition invariant, the retry loop, ATS glyph conversion, and the
// provider-agnostic text extract / replace helpers.
//
// Run from inside workers/proxy/:  node --test test/
// No Cloudflare bindings or network: every LLM call is injected.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseWritingStyleRequest,
  buildStyleSystemPreamble,
  evaluateSce,
  runWithSceRetry,
  applyAtsGlyphConversion,
  extractLlmText,
  replaceLlmText,
  executeSceWithRetry,
} from '../src/writing-style-engine.js';

// ─── parseWritingStyleRequest ────────────────────────────────────────────

test('parse: empty body yields documented defaults', () => {
  const r = parseWritingStyleRequest({});
  assert.equal(r.writingStyle, 'nordic-minimal');
  assert.equal(r.target_language, 'en');
  assert.equal(r.targetPages, 2);
  assert.equal(r.sectionFormat, 'default');
  assert.equal(r.package, 'copenhagen-modern');
  assert.equal(r.ats, false);
  assert.deepEqual(r.toneChips, []);
  assert.deepEqual(r.extraBannedWords, { en: [], da: [], es: [], zh: [] });
  assert.deepEqual(r.extraBannedPhrases, { en: [], da: [], es: [], zh: [] });
});

test('parse: non-object body is tolerated', () => {
  for (const v of [null, undefined, 42, 'x', []]) {
    const r = parseWritingStyleRequest(v);
    assert.equal(r.writingStyle, 'nordic-minimal');
    assert.equal(r.target_language, 'en');
  }
});

test('parse: legacy style aliases resolve to canonical ids', () => {
  assert.equal(parseWritingStyleRequest({ writingStyle: 'japanese' }).writingStyle, 'precision-formal');
  assert.equal(parseWritingStyleRequest({ writingStyle: 'scandinavian' }).writingStyle, 'nordic-minimal');
  assert.equal(parseWritingStyleRequest({ writingStyle: 'AMERICAN' }).writingStyle, 'achievement-driven');
  // Unknown id falls back to the default rather than throwing.
  assert.equal(parseWritingStyleRequest({ writingStyle: 'no-such-style' }).writingStyle, 'nordic-minimal');
});

test('parse: language normalises and falls back to en', () => {
  assert.equal(parseWritingStyleRequest({ target_language: 'DA' }).target_language, 'da');
  assert.equal(parseWritingStyleRequest({ targetLanguage: 'es' }).target_language, 'es');
  assert.equal(parseWritingStyleRequest({ target_language: 'fr' }).target_language, 'en');
});

test('parse: targetPages clamps to the style allowed length', () => {
  // cold-outreach allows max 2 pages.
  assert.equal(parseWritingStyleRequest({ writingStyle: 'cold-outreach', targetPages: 5 }).targetPages, 2);
  // nordic-minimal allows min 1.
  assert.equal(parseWritingStyleRequest({ writingStyle: 'nordic-minimal', targetPages: 0 }).targetPages, 1);
  // Non-finite falls back to 2.
  assert.equal(parseWritingStyleRequest({ targetPages: 'abc' }).targetPages, 2);
});

test('parse: extra banned words accept array (en) or lang-keyed object', () => {
  const arr = parseWritingStyleRequest({ extraBannedWords: ['synergy', 7, 'paradigm'] });
  assert.deepEqual(arr.extraBannedWords.en, ['synergy', 'paradigm']);
  const obj = parseWritingStyleRequest({ extraBannedWords: { da: ['kernekompetence'], xx: ['ignored'] } });
  assert.deepEqual(obj.extraBannedWords.da, ['kernekompetence']);
  assert.deepEqual(obj.extraBannedWords.en, []);
});

test('parse: ats is true only for strict boolean true', () => {
  assert.equal(parseWritingStyleRequest({ ats: true }).ats, true);
  assert.equal(parseWritingStyleRequest({ ats: 'true' }).ats, false);
  assert.equal(parseWritingStyleRequest({ ats: 1 }).ats, false);
});

test('parse: per-section line limits are clamped to 1..15 and rounded', () => {
  const r = parseWritingStyleRequest({ sectionLineLimits: { exp: 99, edu: 0, skills: 3.6, bad: 'x' } });
  assert.equal(r.sectionLineLimits.exp, 15);
  assert.equal(r.sectionLineLimits.edu, 1);
  assert.equal(r.sectionLineLimits.skills, 4);
  assert.equal('bad' in r.sectionLineLimits, false);
});

// ─── buildStyleSystemPreamble ────────────────────────────────────────────

test('preamble: carries the active style row and integrity rules', () => {
  const p = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'achievement-driven' }));
  assert.match(p, /Writing style: achievement-driven/);
  assert.match(p, /Primary constraint:/);
  assert.match(p, /Integrity rules/);
  assert.match(p, /metric-integrity/);
  assert.match(p, /role-boundary-integrity/);
});

test('preamble: ats mode is announced only when ats is on', () => {
  const off = buildStyleSystemPreamble(parseWritingStyleRequest({}));
  assert.doesNotMatch(off, /ATS-safe mode: ON/);
  const on = buildStyleSystemPreamble(parseWritingStyleRequest({ ats: true }));
  assert.match(on, /ATS-safe mode: ON/);
});

test('preamble: banned-word block is language-partitioned (Danish output is not filtered against English bans)', () => {
  const da = buildStyleSystemPreamble(parseWritingStyleRequest({ target_language: 'da' }));
  // The Danish shared base, not the English one.
  assert.match(da, /Banned words \(da\): resultatorienteret/);
  assert.doesNotMatch(da, /spearhead/);
  const en = buildStyleSystemPreamble(parseWritingStyleRequest({ target_language: 'en' }));
  assert.match(en, /Banned words \(en\):.*spearhead/);
});

test('preamble: user extras union with the shared base for the target language', () => {
  const p = buildStyleSystemPreamble(parseWritingStyleRequest({
    target_language: 'da',
    extraBannedWords: { da: ['kernekompetence'] },
  }));
  assert.match(p, /resultatorienteret/);
  assert.match(p, /kernekompetence/);
});

test('preamble: active tone chips fall back to the style defaults when none chosen', () => {
  const p = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'nordic-minimal' }));
  assert.match(p, /Active tone chips: calm, restrained, factual/);
  const chosen = buildStyleSystemPreamble(parseWritingStyleRequest({ toneChips: ['terse', 'plain'] }));
  assert.match(chosen, /Active tone chips: terse, plain/);
});

test('preamble: nordic-minimal carries the Nordic craft guidance (cover-letter + CV)', () => {
  const p = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'nordic-minimal' }));
  assert.match(p, /Style guidance \(MUST follow\):/);
  assert.match(p, /statement of intent/i);
  assert.match(p, /elevator pitch/i);
  assert.match(p, /value to the EMPLOYER/i);
});

test('preamble: cold-outreach (unsolicited) carries the uopfordret dialogue guidance', () => {
  const p = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'cold-outreach' }));
  assert.match(p, /Style guidance \(MUST follow\):/);
  assert.match(p, /opening of a DIALOGUE/i);
  assert.match(p, /uopfordret/i);
  // the legacy alias "unsolicited" resolves to the same style + guidance
  const viaAlias = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'unsolicited' }));
  assert.match(viaAlias, /opening of a DIALOGUE/i);
});

test('preamble: a style without guidance has no Style-guidance block', () => {
  const p = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'achievement-driven' }));
  assert.doesNotMatch(p, /Style guidance \(MUST follow\):/);
});

test('preamble: unsolicited flag composes the uopfordret craft onto ANY style', () => {
  // nordic-minimal + unsolicited → both the nordic guidance AND the unsolicited block
  const nordicUn = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'nordic-minimal', unsolicited: true }));
  assert.match(nordicUn, /statement of intent/i);                 // nordic guidance present
  assert.match(nordicUn, /Unsolicited application \(uopfordret\) — ALSO apply/);
  assert.match(nordicUn, /opening of a DIALOGUE/i);               // composed unsolicited block
  // a style without guidance still gets the composed unsolicited block
  const achUn = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'achievement-driven', unsolicited: true }));
  assert.match(achUn, /Unsolicited application \(uopfordret\) — ALSO apply/);
  // off by default
  assert.equal(parseWritingStyleRequest({}).unsolicited, false);
  assert.doesNotMatch(buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'nordic-minimal' })), /ALSO apply/);
  // cold-outreach does NOT double up (it carries the guidance natively)
  const coUn = buildStyleSystemPreamble(parseWritingStyleRequest({ writingStyle: 'cold-outreach', unsolicited: true }));
  assert.doesNotMatch(coUn, /ALSO apply/);
});

// ─── evaluateSce (Semantic Constraint Engine filter) ─────────────────────

test('sce: detects a shared banned word in English', () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  const r = evaluateSce('We will spearhead the migration.', req);
  assert.equal(r.clean, false);
  assert.deepEqual(r.bannedWordHits.map((w) => w.toLowerCase()), ['spearhead']);
});

test('sce: word boundary prevents a substring false positive', () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  // "spearheaded" must not trip the "spearhead" rule.
  const r = evaluateSce('She spearheaded nothing here.', req);
  assert.equal(r.clean, true);
});

test('sce: language partition — English bans do not apply to Danish text', () => {
  const req = parseWritingStyleRequest({ target_language: 'da' });
  // "dynamic" and "leverage" are English bans; under da they must pass.
  const r = evaluateSce('Vi vil leverage en dynamic tilgang.', req);
  assert.equal(r.clean, true);
  assert.deepEqual(r.bannedWordHits, []);
});

test('sce: detects a banned phrase, tolerating hyphen punctuation', () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  assert.equal(evaluateSce('A proven track record of delivery.', req).clean, false);
  assert.equal(evaluateSce('A proven-track-record of delivery.', req).clean, false);
});

test('sce: clean text reports no hits', () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  const r = evaluateSce('Built the pipeline. Cut release time from a week to a day.', req);
  assert.equal(r.clean, true);
  assert.deepEqual(r.bannedWordHits, []);
  assert.deepEqual(r.bannedPhraseHits, []);
});

test('sce: honours user-supplied extra banned words', () => {
  const req = parseWritingStyleRequest({ extraBannedWords: ['synergy'] });
  const r = evaluateSce('A synergy of teams.', req);
  assert.equal(r.clean, false);
  assert.deepEqual(r.bannedWordHits.map((w) => w.toLowerCase()), ['synergy']);
});

// ─── applyAtsGlyphConversion ─────────────────────────────────────────────

test('ats: contact glyphs convert to plain-text labels', () => {
  assert.equal(applyAtsGlyphConversion('☎ +45 12 34 56 78'), 'Phone: +45 12 34 56 78');
  assert.equal(applyAtsGlyphConversion('✉ a@b.dk'), 'Email: a@b.dk');
  assert.equal(applyAtsGlyphConversion('🔗 example.com'), 'Link: example.com');
  assert.equal(applyAtsGlyphConversion('⌂ Copenhagen'), 'Location: Copenhagen');
  assert.equal(applyAtsGlyphConversion('★ Top 5%'), 'Highlight: Top 5%');
});

test('ats: text with no glyphs is unchanged; nullish is safe', () => {
  assert.equal(applyAtsGlyphConversion('plain line'), 'plain line');
  assert.equal(applyAtsGlyphConversion(null), '');
});

// ─── runWithSceRetry ─────────────────────────────────────────────────────

test('retry: a clean first draft stops at one attempt', async () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  let calls = 0;
  const res = await runWithSceRetry({
    req,
    callLlm: async () => { calls += 1; return 'Built the data path end to end.'; },
  });
  assert.equal(calls, 1);
  assert.equal(res.attempts, 1);
  assert.equal(res.flagged, false);
});

test('retry: a dirty draft is re-requested with a fix instruction, then clears', async () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  const seen = [];
  const drafts = ['We spearhead delivery.', 'We led delivery.'];
  let i = 0;
  const res = await runWithSceRetry({
    req,
    callLlm: async (fix) => { seen.push(fix); return drafts[i++]; },
  });
  assert.equal(res.attempts, 2);
  assert.equal(res.flagged, false);
  assert.equal(seen[0], ''); // first call has no fix prefix
  assert.match(seen[1], /banned words: spearhead/); // retry carries the hit
});

test('retry: a persistently dirty draft returns flagged after the retry budget', async () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  let calls = 0;
  const res = await runWithSceRetry({
    req,
    callLlm: async () => { calls += 1; return 'spearhead spearhead spearhead'; },
  });
  // Initial draft + 2 retries = 3 attempts.
  assert.equal(calls, 3);
  assert.equal(res.attempts, 3);
  assert.equal(res.flagged, true);
});

test('retry: ATS conversion is applied to the final text', async () => {
  const req = parseWritingStyleRequest({ target_language: 'en', ats: true });
  const res = await runWithSceRetry({ req, callLlm: async () => '☎ 123 — clean line' });
  assert.match(res.text, /^Phone: 123/);
  assert.equal(res.flagged, false);
});

// ─── extractLlmText / replaceLlmText ─────────────────────────────────────

test('extract: openai_compat reads choices[0].message.content', () => {
  assert.equal(extractLlmText('openai_compat', { choices: [{ message: { content: 'hi' } }] }), 'hi');
  assert.equal(extractLlmText('openai_compat', {}), null);
});

test('extract: anthropic_messages concatenates text blocks', () => {
  const json = { content: [{ type: 'text', text: 'a' }, { type: 'tool_use' }, { type: 'text', text: 'b' }] };
  assert.equal(extractLlmText('anthropic_messages', json), 'ab');
});

test('replace: openai_compat overwrites content', () => {
  const json = { choices: [{ message: { content: 'old' } }] };
  assert.equal(replaceLlmText('openai_compat', json, 'new'), true);
  assert.equal(json.choices[0].message.content, 'new');
});

test('replace: anthropic_messages writes the first text block and drops the rest', () => {
  const json = { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] };
  assert.equal(replaceLlmText('anthropic_messages', json, 'merged'), true);
  const textBlocks = json.content.filter((b) => b.type === 'text');
  assert.equal(textBlocks.length, 1);
  assert.equal(textBlocks[0].text, 'merged');
});

// ─── executeSceWithRetry (buffered response → eval → retry → headers) ─────

test('execute: no writing-style request passes the data through untouched', async () => {
  const out = await executeSceWithRetry({ data: '{"x":1}', shape: 'openai_compat', writingStyleRequest: null });
  assert.equal(out.data, '{"x":1}');
  assert.equal(out.flagged, false);
  assert.equal(out.sce, null);
});

test('execute: a dirty openai response is re-called and cleared, with SCE headers', async () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  const dirty = JSON.stringify({ choices: [{ message: { content: 'We spearhead it.' } }] });
  const clean = JSON.stringify({ choices: [{ message: { content: 'We led it.' } }] });
  const out = await executeSceWithRetry({
    data: dirty,
    shape: 'openai_compat',
    writingStyleRequest: req,
    reCallProvider: async () => ({ ok: true, text: clean }),
  });
  assert.equal(out.attempts, 2);
  assert.equal(out.flagged, false);
  assert.equal(out.headers['X-AntCV-Sce-Clean'], '1');
  assert.equal(extractLlmText('openai_compat', JSON.parse(out.data)), 'We led it.');
});

test('execute: a failed re-call keeps the prior draft and flags it', async () => {
  const req = parseWritingStyleRequest({ target_language: 'en' });
  const dirty = JSON.stringify({ choices: [{ message: { content: 'We spearhead it.' } }] });
  const out = await executeSceWithRetry({
    data: dirty,
    shape: 'openai_compat',
    writingStyleRequest: req,
    reCallProvider: async () => ({ ok: false }),
  });
  assert.equal(out.flagged, true);
  assert.equal(out.headers['X-AntCV-Flagged'], '1');
});
