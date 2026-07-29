/* antcv-malformed-detect.js — RELAY-DETECTION-GAP-001 (2026-07-13)
 *
 * Client mirror of the relay's detectMalformedOutput (workers/access-relay/src/telemetry.js).
 * The cost-quality router preferred cheaper providers on the strength of success-rate +
 * placeholder/fabrication/banned signals alone — all BLIND to FORMAT-broken output: a raw
 * SSE frame leaking into the body, an empty body despite billed tokens, or control-char
 * garbage. A provider could emit that all week and stay "healthy" (this is how openai stayed
 * health 1.0 through the 3.8.0-3.8.2 SSE-leak bugs), so a silently-broken-but-cheap provider
 * kept getting routed.
 *
 * app.js tags every llm_call telemetry event with malformed_output_count from this detector;
 * the relay aggregates malformed_output_rate into health_score, and the client's own
 * __antcvScoreOrder demotes a format-broken provider. Kept as a sidecar so the (fragile)
 * app.js core carries only a one-field call, not the logic. Pure + side-effect-free.
 *
 * detect(text, ctx) → a reason string ('sse_leak' | 'empty_despite_tokens' | 'control_garbage'
 * | 'off_language') when the output is format-broken, else null.
 *   ctx: { completionTokens?, targetLang? }  (both optional)
 *
 * Keep the break classes + thresholds in lockstep with the relay copy; the relay's
 * malformed-output.test.mjs is the canonical gate.
 */
(function () {
  'use strict';
  var SSE_LEAK_RE = /(^|\n)\s*data:\s*(\{|\[DONE\])|"object"\s*:\s*"chat\.completion|"delta"\s*:\s*\{|^\s*event:\s*\w+\s*\n/i;
  var LATIN_LANGS = { en: 1, da: 1, es: 1, de: 1, fr: 1, it: 1, nl: 1, sv: 1, no: 1, pt: 1 };
  var LANG_SCRIPT = { zh: 'cjk', he: 'hebrew', ar: 'arabic', am: 'ethiopic', ru: 'cyrillic' };

  function scriptFamilies(s) {
    var fams = {};
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c >= 0x4e00 && c <= 0x9fff) fams.cjk = 1;
      else if (c >= 0x0590 && c <= 0x05ff) fams.hebrew = 1;
      else if (c >= 0x0600 && c <= 0x06ff) fams.arabic = 1;
      else if (c >= 0x1200 && c <= 0x137f) fams.ethiopic = 1;
      else if (c >= 0x0400 && c <= 0x04ff) fams.cyrillic = 1;
      else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) fams.latin = 1;
    }
    return fams;
  }

  function detect(text, ctx) {
    ctx = ctx || {};
    var s = typeof text === 'string' ? text : (text == null ? '' : String(text));
    var trimmed = s.trim();
    var ct = Number(ctx.completionTokens);

    // 1) empty / whitespace body despite billed output tokens
    if (ct > 12 && trimmed.length < 2) return 'empty_despite_tokens';
    // 2) raw SSE / streaming envelope leak
    if (SSE_LEAK_RE.test(s)) return 'sse_leak';
    // 3) control-character garbage (mojibake / binary leak)
    var sample = trimmed.slice(0, 4000);
    if (sample.length >= 20) {
      var bad = 0;
      for (var i = 0; i < sample.length; i++) {
        var c = sample.codePointAt(i);
        if (c === 0xfffd || (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d)) bad++;
      }
      if (bad / sample.length > 0.15) return 'control_garbage';
    }
    // 4) hard off-language (only on a script mismatch; never Latin-vs-Latin)
    var lang = ctx.targetLang ? String(ctx.targetLang).toLowerCase() : null;
    if (lang && trimmed.length >= 16) {
      var fams = scriptFamilies(trimmed.slice(0, 2000));
      var want = LANG_SCRIPT[lang];
      if (want && !fams[want]) return 'off_language';
      if (LATIN_LANGS[lang]) {
        var nonLatin = fams.cjk || fams.hebrew || fams.arabic || fams.ethiopic || fams.cyrillic;
        if (nonLatin && !fams.latin) return 'off_language';
      }
    }
    return null;
  }

  window.AntcvMalformed = { detect: detect };
})();
