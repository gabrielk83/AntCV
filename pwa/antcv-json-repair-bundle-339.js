/* AntCV JSON repair sidecar (v1.40.339-f)
 * ============================================================
 *
 * Why
 * ---
 * The bundle's built-in JSON-repair function (in app.js) only handles
 * ONE failure mode: stream truncation. When an LLM response is cut
 * short, it walks back from the end of the string and trims until the
 * remaining prefix parses. That's it.
 *
 * Real LLM responses can fail to parse for many other reasons:
 *   1. Missing colon after a property name     ("key" "value")
 *   2. Missing comma between key-value pairs   (... } "next": ...)
 *   3. Smart quotes from sloppy escaping       ("key": "value")
 *   4. Trailing commas inside arrays/objects   ([1,2,3,])
 *   5. Markdown code fences wrapping JSON      (```json ... ```)
 *   6. JS-style comments inside the JSON       (// or block)
 *   7. Unquoted property names                 (key: "value")
 *   8. Single-quoted strings                   ('key': 'value')
 *
 * The bundle's repair throws "JSON repair failed: <SyntaxError msg>"
 * which the retry loop catches as a retry signal, but if every retry
 * hits the SAME structural error, the user gets the abort:
 *   "Failed: JSON repair failed: Expected ':' after property name
 *    in JSON at position 2177 (line 40 column 18)"
 *
 * What this sidecar does
 * ----------------------
 *  Wraps window.JSON.parse with a wrapper that, on parse failure for
 *  large LLM-shaped inputs (>=200 chars, contains both '{' and '"'),
 *  applies a layered repair pipeline:
 *
 *    pass 1  strip markdown fences        ```json ... ``` -> ...
 *    pass 2  strip JS comments            // ... and block comments
 *    pass 3  smart quotes -> straight     curly quotes -> ASCII "
 *    pass 4  fix missing colons           "key" "value" -> "key": "value"
 *    pass 5  fix missing commas           } "next" -> }, "next"
 *    pass 6  strip trailing commas        [1,2,3,] -> [1,2,3]
 *    pass 7  unquoted keys -> quoted      {a: 1} -> {"a": 1}
 *    pass 8  single -> double quotes      'a': 'b' -> "a": "b"
 *    pass 9  balance braces/brackets      truncation fallback
 *
 *  After each pass it retries JSON.parse. Returns on first success.
 *  If all passes fail, throws the ORIGINAL SyntaxError unchanged so
 *  the bundle's retry / error-handling paths continue to work (they
 *  check `instanceof SyntaxError` and "JSON repair failed" string).
 *
 *  Fast path: if the input parses fine (the common case), the wrapper
 *  returns immediately with ZERO behaviour change.
 *
 *  Scope guard: skips small inputs (<200 chars) and inputs that don't
 *  look LLM-shaped (no '{'/'[' or no '"'). The wrapper is a no-op for
 *  every JSON.parse call NOT related to LLM output.
 *
 *  Defence in depth: the entire wrapper body is wrapped in try/catch;
 *  any unexpected exception in the wrapper itself falls back to
 *  throwing the original parse error, so this sidecar can never make
 *  things worse than they already were.
 *
 * Escape hatch
 * ------------
 *   localStorage['antcv:disable-json-repair'] = '1'  -> no-op
 *
 * Debug API
 * ---------
 *   window.AntcvJsonRepair339.version
 *   window.AntcvJsonRepair339._repair(rawText)   -> {ok, parsed, repaired, pass}
 *   window.AntcvJsonRepair339._stats             -> {attempts, successes, failures, by_pass}
 *   window.AntcvJsonRepair339._passes.<name>(s)  -> direct access to each pass
 */
(function () {
  'use strict';

  var VERSION = '1.40.339-f';
  if (window.__antcvJsonRepair339 === VERSION) return;
  window.__antcvJsonRepair339 = VERSION;

  var DISABLE_KEY = 'antcv:disable-json-repair';
  var MIN_LEN = 200;

  var STATS = {
    attempts: 0,
    successes: 0,
    failures: 0,
    by_pass: {
      fence: 0, comments: 0, smartq: 0, colon: 0, comma: 0,
      trailing: 0, unquoted: 0, singleq: 0, balance: 0
    }
  };

  function disabled() {
    try {
      var v = localStorage.getItem(DISABLE_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  function looksLikeLlmJson(s) {
    if (typeof s !== 'string') return false;
    if (s.length < MIN_LEN) return false;
    if (s.indexOf('{') < 0 && s.indexOf('[') < 0) return false;
    if (s.indexOf('"') < 0) return false;
    return true;
  }

  // --- Pass 1: strip markdown fences ---------------------------------
  function stripFences(s) {
    var m = s.match(/^[\s\S]*?```(?:json|JSON|js|javascript)?\s*\n([\s\S]*?)\n```[\s\S]*$/);
    if (m && m[1]) return m[1].trim();
    var t = s.replace(/^```(?:json|JSON|js|javascript)?\s*/, '').replace(/\s*```\s*$/, '');
    return t;
  }

  // --- Pass 2: strip JS comments (but not inside strings) ------------
  function stripComments(s) {
    var out = '';
    var inStr = false, escNext = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i], n = s[i + 1];
      if (escNext) { out += c; escNext = false; continue; }
      if (inStr) {
        out += c;
        if (c === '\\') escNext = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; out += c; continue; }
      if (c === '/' && n === '/') {
        while (i < s.length && s[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && n === '*') {
        i += 2;
        while (i < s.length - 1 && !(s[i] === '*' && s[i + 1] === '/')) i++;
        i++;
        continue;
      }
      out += c;
    }
    return out;
  }

  // --- Pass 3: smart quotes -> straight ------------------------------
  function fixSmartQuotes(s) {
    return s
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  }

  // --- Pass 4: fix missing colons after property names ---------------
  // When a "..." string in object-context is in KEY position (preceded
  // by { or , with optional whitespace), the next non-whitespace token
  // must be ':'. If it isn't, insert one. Uses a justClosedKey flag
  // rather than position tracking so whitespace between key and value
  // doesn't desync the detector.
  function fixMissingColons(s) {
    var out = '';
    var inStr = false, escNext = false;
    var objStack = [];
    var justClosedKey = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (escNext) { out += c; escNext = false; continue; }
      if (inStr) {
        out += c;
        if (c === '\\') escNext = true;
        else if (c === '"') {
          inStr = false;
          var quoteOpen = out.lastIndexOf('"', out.length - 2);
          if (quoteOpen >= 0 && objStack[objStack.length - 1] === 'o') {
            var before = out.slice(0, quoteOpen).replace(/\s+$/, '');
            var prev = before.length ? before[before.length - 1] : '';
            justClosedKey = (prev === '{' || prev === ',');
          } else {
            justClosedKey = false;
          }
        }
        continue;
      }
      if (/\s/.test(c)) { out += c; continue; }
      if (justClosedKey) {
        if (c !== ':') {
          out += ':';
          STATS.by_pass.colon++;
        }
        justClosedKey = false;
      }
      if (c === '"') { inStr = true; out += c; continue; }
      if (c === '{') { objStack.push('o'); out += c; continue; }
      if (c === '[') { objStack.push('a'); out += c; continue; }
      if (c === '}' || c === ']') { objStack.pop(); out += c; continue; }
      out += c;
    }
    return out;
  }

  // --- Pass 5: fix missing commas between items ---------------------
  // After } or ] or " (closing string), if next non-space is " or { or
  // [ within an array/object context, insert a comma.
  function fixMissingCommas(s) {
    var out = '';
    var inStr = false, escNext = false;
    var lastSig = '';
    var objStack = [];
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (escNext) { out += c; escNext = false; continue; }
      if (inStr) {
        out += c;
        if (c === '\\') escNext = true;
        else if (c === '"') { inStr = false; lastSig = '"'; }
        continue;
      }
      if (c === '"') {
        if ((lastSig === '"' || lastSig === '}' || lastSig === ']') &&
            objStack.length > 0) {
          out += ',';
          STATS.by_pass.comma++;
        }
        inStr = true;
        out += c;
        continue;
      }
      if (c === '{' || c === '[') {
        if ((lastSig === '"' || lastSig === '}' || lastSig === ']') &&
            objStack.length > 0) {
          out += ',';
          STATS.by_pass.comma++;
        }
        objStack.push(c === '{' ? 'o' : 'a');
        out += c;
        lastSig = c;
        continue;
      }
      if (c === '}' || c === ']') {
        objStack.pop();
        out += c;
        lastSig = c;
        continue;
      }
      if (/\s/.test(c)) { out += c; continue; }
      if (c === ',' || c === ':') { out += c; lastSig = c; continue; }
      out += c;
      lastSig = c;
    }
    return out;
  }

  // --- Pass 6: strip trailing commas ---------------------------------
  function stripTrailingCommas(s) {
    return s.replace(/,(\s*[}\]])/g, function (_, p1) {
      STATS.by_pass.trailing++;
      return p1;
    });
  }

  // --- Pass 7: quote unquoted property names -------------------------
  function quoteUnquotedKeys(s) {
    return s.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, function (_, pre, k) {
      STATS.by_pass.unquoted++;
      return pre + '"' + k + '":';
    });
  }

  // --- Pass 8: single -> double quotes -------------------------------
  // Risky because apostrophes in content would be mangled. Only apply
  // if there are NO double quotes at all (LLM emitted everything in '').
  function singleToDouble(s) {
    if (s.indexOf('"') >= 0) return s;
    var out = s.replace(/'/g, '"');
    if (out !== s) STATS.by_pass.singleq++;
    return out;
  }

  // --- Pass 9: balance braces/brackets (truncation fallback) ---------
  function balanceBrackets(s) {
    var stack = [];
    var inStr = false, escNext = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (escNext) { escNext = false; continue; }
      if (inStr) {
        if (c === '\\') escNext = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '{' || c === '[') stack.push(c);
      else if (c === '}' && stack[stack.length - 1] === '{') stack.pop();
      else if (c === ']' && stack[stack.length - 1] === '[') stack.pop();
    }
    if (stack.length === 0 && !inStr) return s;
    var suffix = '';
    if (inStr) suffix += '"';
    for (var j = stack.length - 1; j >= 0; j--) {
      suffix += stack[j] === '{' ? '}' : ']';
    }
    STATS.by_pass.balance++;
    return s + suffix;
  }

  // --- Pipeline ------------------------------------------------------
  // Apply passes cumulatively; retry JSON.parse after each that changes
  // the string. Return on first parse success.
  function repair(input) {
    STATS.attempts++;
    var passes = [
      ['fence',    stripFences],
      ['comments', stripComments],
      ['smartq',   fixSmartQuotes],
      ['colon',    fixMissingColons],
      ['comma',    fixMissingCommas],
      ['trailing', stripTrailingCommas],
      ['unquoted', quoteUnquotedKeys],
      ['singleq',  singleToDouble],
      ['balance',  balanceBrackets]
    ];
    var current = input;
    var lastError = null;
    for (var p = 0; p < passes.length; p++) {
      var name = passes[p][0], fn = passes[p][1];
      try {
        var beforeLen = current.length;
        current = fn(current);
        if (current.length !== beforeLen || p === passes.length - 1) {
          try {
            var parsed = origParse.call(JSON, current);
            STATS.successes++;
            try { console.info('[antcv-json-repair-339] repaired via pass "' + name + '" (' + (p + 1) + '/' + passes.length + ')'); } catch (_) {}
            return { ok: true, parsed: parsed, repaired: current, pass: name };
          } catch (e) {
            lastError = e;
          }
        }
      } catch (e) {
        lastError = e;
      }
    }
    try {
      var finalParsed = origParse.call(JSON, current);
      STATS.successes++;
      return { ok: true, parsed: finalParsed, repaired: current, pass: 'all' };
    } catch (e) {
      STATS.failures++;
      return { ok: false, error: lastError || e, repaired: current };
    }
  }

  // --- JSON.parse override -------------------------------------------
  // Capture the ORIGINAL parse before installing the wrapper. The
  // wrapper closes over `origParse` so subsequent re-wraps (if any)
  // still call the real native parser.
  var origParse = JSON.parse;

  function installWrapper() {
    if (typeof origParse !== 'function') return;
    if (origParse.__antcvJsonRepairWrapped === VERSION) return;
    var wrapped = function (text, reviver) {
      // Fast path: try the original first.
      try {
        return origParse.call(JSON, text, reviver);
      } catch (origErr) {
        // Defence in depth: any unexpected exception in the repair
        // code path falls back to throwing the original parse error.
        try {
          if (disabled()) throw origErr;
          if (!looksLikeLlmJson(text)) throw origErr;
          var result = repair(text);
          if (result && result.ok) {
            if (reviver) {
              return origParse.call(JSON, result.repaired, reviver);
            }
            return result.parsed;
          }
        } catch (wrapperErr) {
          // Either explicit re-throw of origErr above, or a bug in the
          // repair pipeline itself. Either way, surface origErr so the
          // bundle's retry / error-handling sees the message it expects.
          throw origErr;
        }
        throw origErr;
      }
    };
    wrapped.__antcvJsonRepairWrapped = VERSION;
    try { JSON.parse = wrapped; } catch (_) {}
    try { console.info('[antcv-json-repair-339] JSON.parse wrapped (v=' + VERSION + ')'); } catch (_) {}
  }

  // Install immediately at module load - app.js's JSON.parse calls
  // can fire as early as the first fetch response, well before
  // DOMContentLoaded on slow networks.
  try { installWrapper(); }
  catch (e) {
    try { console.warn('[antcv-json-repair-339] install failed:', e && e.message); } catch (_) {}
  }

  window.AntcvJsonRepair339 = {
    version: VERSION,
    _repair: repair,
    _stats: STATS,
    _disabled: disabled,
    _origParse: origParse,
    _passes: {
      stripFences: stripFences,
      stripComments: stripComments,
      fixSmartQuotes: fixSmartQuotes,
      fixMissingColons: fixMissingColons,
      fixMissingCommas: fixMissingCommas,
      stripTrailingCommas: stripTrailingCommas,
      quoteUnquotedKeys: quoteUnquotedKeys,
      singleToDouble: singleToDouble,
      balanceBrackets: balanceBrackets
    }
  };
})();
