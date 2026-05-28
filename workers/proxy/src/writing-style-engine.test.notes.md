# `writing-style-engine.js` — runtime contract + test notes

Pass 3b. The module wraps the existing multi-LLM proxy with the writing-system pipeline from locked-source plan §4.7.

## Wiring into `index.js`

Three integration points to add when the user is ready to enable the pipeline (none of these ship in this PR — the existing JD-analysis / supervisor flows still go through the legacy path):

1. **Request entry.** At the top of the `/api/generate-section` (or equivalent) handler, parse the new fields:
   ```js
   import { parseWritingStyleRequest, buildStyleSystemPreamble, runWithSceRetry, logWritingEngineEvent } from './writing-style-engine.js';
   const styleReq = parseWritingStyleRequest(body);
   const stylePreamble = buildStyleSystemPreamble(styleReq);
   ```
   Inject `stylePreamble` into the system message that goes to the LLM.

2. **Section generation.** Wrap the LLM call:
   ```js
   const result = await runWithSceRetry({
     req: styleReq,
     callLlm: async (extraSystemPrefix) => {
       // existing callMulti(...) path, but prepend extraSystemPrefix to system message
       return await callMulti(env, /* ...args... */);
     },
   });
   ```
   `result.text` is the SCE-clean draft (or the third draft with `flagged:true`).

3. **Analytics.** After return:
   ```js
   ctx.waitUntil(logWritingEngineEvent(env, {
     userId: identity.userId,
     writingStyle: styleReq.writingStyle,
     toneChips: styleReq.toneChips,
     target_language: styleReq.target_language,
     attempts: result.attempts,
     flagged: result.flagged,
     bannedWordHits: result.finalViolations.bannedWordHits.length,
     bannedPhraseHits: result.finalViolations.bannedPhraseHits.length,
   }));
   ```

## Test cases

Run with `node --test` from `workers/proxy/` when a test runner ships (today there's none in `workers/proxy/package.json`).

- **parse + clamp.** `parseWritingStyleRequest({ writingStyle: 'Scandinavian', targetPages: 7 })` → `writingStyle: 'nordic-minimal'`, `targetPages: 3` (clamped to nordic-minimal's allowed range 1-3).
- **lang-partitioned bans.** With `extraBannedWords = { da: ['tværgående'], en: [] }` and `target_language='en'`, the EN bucket does NOT enforce `tværgående`. With `target_language='da'`, it does.
- **case-insensitive word match.** Banned word `Strategic` matches `strategic`, `Strategic`, `STRATEGIC`.
- **punctuation-tolerant phrase match.** Banned phrase `I am passionate about` matches `I'm passionate about`, `I, am passionate about`, etc.
- **retry loop.** Mock `callLlm` that returns a banned word twice then clean text → result is clean, `attempts === 3`, `flagged === false`. Mock that returns banned word three times → `flagged === true`, `text` returned as-is.
- **ATS conversion.** `applyAtsGlyphConversion('Contact ☎ +1 555 — ✉ me@example.com')` → `'Contact Phone: +1 555 — Email: me@example.com'`.

## Keep-in-sync invariant

The const tables in this file (`STYLES`, `SHARED_BANNED_WORDS`, `SHARED_BANNED_PHRASES`, `LEGACY_STYLE_ALIAS`, `ATS_GLYPH_LABELS`, `INTEGRITY_RULES`) duplicate values from `writingSystems/registry.json` at the repo root. When the canonical JSON changes, update this file by hand.

A future ticket can move the engine to import the JSON via wrangler's bundler. The duplication was kept here to keep this PR's worker change tightly scoped and reviewable.
