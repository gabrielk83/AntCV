/* AntCV kernel-generation completeness guard (v1.40.289)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem (v1.40.290 symptoms reported by Gabriel)
 * ────────────────────────────────────────────────
 * The kernel-generated CV/CL output silently dropped four critical
 * sections:
 *
 *   CV   PROFESSIONAL EXPERIENCE       — entire section missing
 *   CV   CORE COMPETENCIES             — only header row + 1 row,
 *                                        Strategic Expertise column blank
 *   CL   WHAT I BRING                  — table rows kept as placeholder
 *                                        text "[Strategic expertise — 1 or 2 lines]"
 *   CL   HOW I WOULD CONTRIBUTE        — bullets array empty,
 *                                        only header + closing sentence visible
 *
 * Root cause
 * ──────────
 * The LLM returned `cv_overrides` and `cl_overrides` but omitted (or
 * left as placeholders) four specific keys:
 *
 *   cv_overrides.experience_roles   — array of role objects
 *   cv_overrides.core_comp_rows     — array of [focus, expertise] pairs
 *   cl_overrides.bring_rows         — array of [focus, expertise] pairs
 *   cl_overrides.contribute_items   — array of strings
 *
 * The existing partial-response check in the generate function counts
 * only five CL prose fields (who_content, why_content, foundation_hands_on,
 * foundation_professionally, closure_content). If at least 3/5 are
 * filled it accepts the response — even when ALL the array/table keys
 * are missing or placeholder-only. The post-processing step then
 * strips placeholder rows, leaving the visible output gutted.
 *
 * Fix
 * ───
 * Two-part sidecar that wraps the existing generation flow without
 * editing app.js:
 *
 *   Part A — JSON.parse interception
 *
 *     Wrap window.JSON.parse. For each parsed object that LOOKS like
 *     a generation-output payload (has cv_overrides or cl_overrides),
 *     run a completeness check on the four critical array keys. If
 *     any of them is empty / placeholder-only / below threshold,
 *     throw an Error with `name = 'PartialResponse'`. This is the
 *     exact error shape the existing generate function's outer catch
 *     looks for: it triggers a provider-cycle retry rather than
 *     bubbling up to the user.
 *
 *     Detection criteria are deliberately specific to AntCV's
 *     generation-output shape (presence of cv_overrides OR
 *     cl_overrides at the top level) so the wrapper does not
 *     interfere with unrelated JSON.parse calls in the bundle.
 *
 *   Part B — fetch interception with prompt augmentation
 *
 *     When Part A throws, it records the timestamp. The next LLM
 *     fetch within 30 s is identified by body shape (POST with
 *     `messages` array whose system message mentions cv_overrides)
 *     and gets an "ARRAY/TABLE REQUIREMENTS" addendum appended to
 *     the system content. The addendum names each missing key
 *     explicitly and lists the placeholder strings to avoid. This
 *     makes the retry meaningfully different from the first attempt
 *     — without it, the provider might cycle but the prompt
 *     wouldn't change, so the same omission could repeat.
 *
 * Why a sidecar (not an app.js edit)
 * ──────────────────────────────────
 * The validation logic lives inside a closure deep in the bundle
 * (~byte 403728 of the minified app.js). Editing minified code is
 * fragile. A sidecar that wraps JSON.parse and fetch achieves the
 * same outcome — the existing retry path is reused — without
 * touching the build output. If the bundle's validation is later
 * extended natively to cover these keys, this sidecar becomes a
 * harmless no-op (its check fires before the bundle's check, and
 * if the response is complete it returns the parsed value
 * untouched).
 *
 * Non-goals
 * ─────────
 * - We do NOT silently fill missing sections. Throwing is the right
 *   behaviour: it forces a real retry against the LLM. Faking content
 *   client-side would land hallucinated text in the output.
 * - We do NOT alter the user's outputs section structure. Only the
 *   path between "LLM returned partial JSON" and "renderer sees
 *   partial JSON" is intercepted.
 */
(function () {
  'use strict';
  var VERSION = '1.40.289';
  if (window.__antcvKernelCompleteness289 === VERSION) return;
  window.__antcvKernelCompleteness289 = VERSION;

  // ────────────────────────────────────────────────────────────────────
  // Predicates
  // ────────────────────────────────────────────────────────────────────

  // Placeholder detector: matches [Anything In Brackets] and FILL_marker_here.
  // Identical semantics to the bundle's own placeholder regex so behaviour
  // is consistent. Note: we trim before testing, so no \s* anchors are
  // needed (the constraint that the test harness brace-counter mishandles
  // backslash escapes in regex literals applies here).
  var RE_BRACKET = /^\[[A-Z][^\]]{2,500}\]$/;
  var RE_FILL = /^FILL_[a-z_0-9]+_(here|HERE)/;

  function isFilledString(v, minLen) {
    if (typeof v !== 'string') return false;
    var t = v.trim();
    if (t.length < (minLen || 8)) return false;
    if (RE_BRACKET.test(t)) return false;
    if (RE_FILL.test(t)) return false;
    // Catch the "Focus Area" / "Strategic Expertise" header literals if
    // they accidentally end up in a data cell.
    if (t === 'Focus Area' || t === 'Strategic Expertise') return false;
    // Catch single-word values like "f" or "e" from the schema's
    // shorthand example.
    if (t.length <= 2) return false;
    return true;
  }

  // Data rows = all rows except the header row at index 0.
  function countFilledDataRows(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return 0;
    var n = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!Array.isArray(r) || r.length < 2) continue;
      // Either cell being placeholder fails the row.
      if (isFilledString(r[0], 3) && isFilledString(r[1], 6)) n++;
    }
    return n;
  }

  function countFilledRoles(roles) {
    if (!Array.isArray(roles)) return 0;
    var n = 0;
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      if (!r || typeof r !== 'object') continue;
      if (r.on === false) continue;
      var title = (typeof r.title === 'string') ? r.title : '';
      var company = (typeof r.company === 'string') ? r.company : '';
      if (!isFilledString(title, 3)) continue;
      if (!isFilledString(company, 2)) continue;
      if (!Array.isArray(r.bullets) || r.bullets.length === 0) continue;
      var filledBullets = 0;
      for (var j = 0; j < r.bullets.length; j++) {
        if (isFilledString(r.bullets[j], 12)) filledBullets++;
      }
      if (filledBullets >= 1) n++;
    }
    return n;
  }

  function countFilledItems(items, minLen) {
    if (!Array.isArray(items)) return 0;
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      if (isFilledString(items[i], minLen || 12)) n++;
    }
    return n;
  }

  function looksLikeGenerationOutput(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    var hasCv = Object.prototype.hasOwnProperty.call(obj, 'cv_overrides');
    var hasCl = Object.prototype.hasOwnProperty.call(obj, 'cl_overrides');
    var hasMeta = Object.prototype.hasOwnProperty.call(obj, 'meta');
    var hasRationale = Object.prototype.hasOwnProperty.call(obj, 'rationale');
    var n = (hasCv ? 1 : 0) + (hasCl ? 1 : 0) + (hasMeta ? 1 : 0) + (hasRationale ? 1 : 0);
    // The LLM generation output always has all four top-level keys. Internal
    // state objects or debug envelopes essentially never share two or more
    // of these names at the top level, so >=2 is a tight predicate that
    // still tolerates the LLM omitting one of meta/rationale on malformed
    // responses.
    if (n < 2) return false;
    // Also require that at least one of cv_overrides / cl_overrides is an
    // object (not, say, a string mention) — the values are always objects
    // in real generation output.
    var cvIsObj = hasCv && obj.cv_overrides && typeof obj.cv_overrides === 'object';
    var clIsObj = hasCl && obj.cl_overrides && typeof obj.cl_overrides === 'object';
    return cvIsObj || clIsObj;
  }

  // Returns an array of missing-key descriptions. Empty array = OK.
  function checkCompleteness(obj) {
    var missing = [];
    var cv = (obj && obj.cv_overrides) || {};
    var cl = (obj && obj.cl_overrides) || {};

    // Thresholds picked to match the actual skeleton: 5 roles, 6 core_comp data rows,
    // 4 bring data rows, 3 contribute items. We require a margin below those
    // (e.g. 3 filled roles is enough) so the LLM is allowed to return fewer
    // than the maximum but not nothing.
    var filledRoles = countFilledRoles(cv.experience_roles);
    if (filledRoles < 3) {
      missing.push('cv_overrides.experience_roles (' + filledRoles + ' filled, need >=3)');
    }
    var filledCoreRows = countFilledDataRows(cv.core_comp_rows);
    if (filledCoreRows < 4) {
      missing.push('cv_overrides.core_comp_rows (' + filledCoreRows + ' filled data rows, need >=4)');
    }
    var filledBringRows = countFilledDataRows(cl.bring_rows);
    if (filledBringRows < 3) {
      missing.push('cl_overrides.bring_rows (' + filledBringRows + ' filled data rows, need >=3)');
    }
    var filledContribute = countFilledItems(cl.contribute_items, 12);
    if (filledContribute < 3) {
      missing.push('cl_overrides.contribute_items (' + filledContribute + ' filled items, need >=3)');
    }
    return missing;
  }

  // ────────────────────────────────────────────────────────────────────
  // Part A — JSON.parse interception
  // ────────────────────────────────────────────────────────────────────

  // Records the timestamp of the last completeness failure. Used by
  // Part B to know when to inject the array-requirements addendum.
  var lastFailureTs = 0;
  var lastFailureMissing = null;

  var origParse = JSON.parse;
  if (typeof origParse !== 'function') return;

  JSON.parse = function (text, reviver) {
    var result = origParse.call(JSON, text, reviver);
    try {
      if (looksLikeGenerationOutput(result)) {
        var missing = checkCompleteness(result);
        if (missing.length > 0) {
          try {
            console.warn('[kernel-completeness-289] LLM output missing critical sections — '
              + 'throwing PartialResponse to trigger provider retry. Missing: '
              + missing.join('; '));
          } catch (_) {}
          lastFailureTs = Date.now();
          lastFailureMissing = missing;
          var err = new Error('KERNEL_INCOMPLETE: ' + missing.join('; '));
          err.name = 'PartialResponse';
          err._kernelCompletenessMissing = missing;
          err._partialCount = 0; // matches the existing field used by the generate function for logging
          throw err;
        }
      }
    } catch (e) {
      // Re-throw only our errors. Anything else means our predicate
      // misfired and we should not break unrelated callers.
      if (e && e._kernelCompletenessMissing) throw e;
    }
    return result;
  };

  // ────────────────────────────────────────────────────────────────────
  // Part B — fetch interception with prompt augmentation on retries
  // ────────────────────────────────────────────────────────────────────

  // The addendum we append to the system content. It must reinforce
  // — not contradict — the existing prompt; the existing prompt
  // describes the schema in the abstract, this addendum names the
  // four observed-to-be-omitted keys and explicitly bans the
  // placeholder strings the bundle's own post-processor strips.
  function buildAddendum(missing) {
    var parts = [];
    parts.push('');
    parts.push('');
    parts.push('==========================================================');
    parts.push('CRITICAL ARRAY/TABLE REQUIREMENTS — RETRY REASON');
    parts.push('==========================================================');
    parts.push('Your previous response in this generation run was discarded.');
    parts.push('Reason: the following keys were missing, empty, or contained only placeholder rows:');
    if (missing && missing.length) {
      for (var i = 0; i < missing.length; i++) {
        parts.push('  - ' + missing[i]);
      }
    } else {
      parts.push('  - cv_overrides.experience_roles');
      parts.push('  - cv_overrides.core_comp_rows');
      parts.push('  - cl_overrides.bring_rows');
      parts.push('  - cl_overrides.contribute_items');
    }
    parts.push('');
    parts.push('This retry MUST fill ALL of the following with real content drawn from the candidate memory digest. Empty arrays, single-cell rows, or rows containing literal placeholder text are INVALID and will be discarded again:');
    parts.push('');
    parts.push('1. cv_overrides.experience_roles');
    parts.push('   - Minimum 5 entries with on:true.');
    parts.push('   - Each entry MUST have non-placeholder title, company, years (real "YYYY - YYYY" or "YYYY - Present"), and at least 2 bullets per role (3 for r1-r5).');
    parts.push('   - Source: the candidate work history in the memory digest. Do NOT invent companies or roles.');
    parts.push('   - INVALID examples: "[Role title]", "[Company name]", "[YYYY - YYYY]", "[Bullet 1 - describe scope and outcome]".');
    parts.push('');
    parts.push('2. cv_overrides.core_comp_rows');
    parts.push('   - First row is the header ["Focus Area", "Strategic Expertise"].');
    parts.push('   - At least 5 additional data rows, each with two non-placeholder strings tailored to the JD.');
    parts.push('   - INVALID examples: ["[Focus area 1]", "[Strategic expertise - 1 or 2 lines]"], ["Focus", "Exp"], ["f", "e"].');
    parts.push('');
    parts.push('3. cl_overrides.bring_rows');
    parts.push('   - First row is the header ["Focus Area", "Strategic Expertise"].');
    parts.push('   - At least 4 additional data rows, each with two non-placeholder strings tailored to the JD and complementing — not duplicating — cv_overrides.core_comp_rows.');
    parts.push('   - INVALID examples: same placeholders as item 2.');
    parts.push('');
    parts.push('4. cl_overrides.contribute_items');
    parts.push('   - At least 3 specific, non-placeholder action bullets describing first priorities in the role.');
    parts.push('   - Each bullet 12-30 words, concrete, names something the candidate would do.');
    parts.push('   - INVALID examples: "[Specific thing you would do 1]", "b1", short fragments, generic platitudes.');
    parts.push('');
    parts.push('Reread your response BEFORE outputting. If any of the above four keys is empty, contains placeholder text, or is shorter than the stated minimum, REWRITE that key with real content from the memory digest before returning the JSON.');
    parts.push('==========================================================');
    return parts.join('\n');
  }

  function bodyLooksLikeLlmCall(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    if (!Array.isArray(parsed.messages)) return false;
    if (parsed.messages.length === 0) return false;
    // System message is either parsed.system (Anthropic-style) or messages[0]
    // with role 'system' (OpenAI-style proxied through cv-proxy).
    var sys = null;
    if (typeof parsed.system === 'string' && parsed.system.length > 0) {
      sys = parsed.system;
    } else if (parsed.messages[0] && parsed.messages[0].role === 'system') {
      sys = parsed.messages[0].content;
    } else {
      // Some providers fold the system content into the user message.
      // Check the first user message for the cv_overrides marker.
      var m = parsed.messages[0];
      if (m && typeof m.content === 'string') sys = m.content;
    }
    if (typeof sys !== 'string') return false;
    // The generation prompts always mention cv_overrides or cl_overrides
    // in the system content. Other LLM calls (e.g. JD parsing) do not.
    return sys.indexOf('cv_overrides') !== -1 || sys.indexOf('cl_overrides') !== -1;
  }

  function augmentSystemString(s, addendum) {
    if (typeof s !== 'string') return s;
    // Append the addendum to the very end so it is the last thing the
    // model sees before generating.
    return s + addendum;
  }

  function augmentBody(parsed, addendum) {
    // Mutate a shallow copy. Preserve everything else.
    var copy = {};
    for (var k in parsed) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) copy[k] = parsed[k];
    }
    if (typeof copy.system === 'string' && copy.system.length > 0) {
      copy.system = augmentSystemString(copy.system, addendum);
      return copy;
    }
    if (Array.isArray(copy.messages) && copy.messages.length > 0) {
      // Copy the messages array shallowly so we can edit the system
      // message without mutating the original.
      var msgs = copy.messages.slice();
      if (msgs[0] && msgs[0].role === 'system') {
        var sm = {};
        for (var sk in msgs[0]) {
          if (Object.prototype.hasOwnProperty.call(msgs[0], sk)) sm[sk] = msgs[0][sk];
        }
        sm.content = augmentSystemString(sm.content, addendum);
        msgs[0] = sm;
      } else if (msgs[0] && typeof msgs[0].content === 'string') {
        // Folded-system case: augment the first user message at its end.
        var um = {};
        for (var uk in msgs[0]) {
          if (Object.prototype.hasOwnProperty.call(msgs[0], uk)) um[uk] = msgs[0][uk];
        }
        um.content = augmentSystemString(um.content, addendum);
        msgs[0] = um;
      }
      copy.messages = msgs;
    }
    return copy;
  }

  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') {
    // Without fetch, only Part A is active. That alone still helps —
    // retries cycle providers even if the prompt is unchanged.
    window.AntcvKernelCompleteness289 = {
      version: VERSION,
      _checkCompleteness: checkCompleteness,
      _looksLikeGenerationOutput: looksLikeGenerationOutput,
      _lastFailureTs: function () { return lastFailureTs; },
    };
    try { console.debug('[kernel-completeness-289] installed v' + VERSION + ' (Part A only; no window.fetch)'); } catch (_) {}
    return;
  }

  var WINDOW_MS = 30000; // 30 s after a failure, the next LLM call gets the addendum.

  var augmentedFetch = function (url, init) {
    try {
      if (init && init.method === 'POST' && init.body && typeof init.body === 'string') {
        var elapsed = Date.now() - lastFailureTs;
        if (elapsed < WINDOW_MS) {
          var parsed = null;
          try { parsed = JSON.parse(init.body); } catch (_) { parsed = null; }
          // Bypass our own JSON.parse wrapper above: we already wrap it,
          // so JSON.parse here might throw PartialResponse if the body
          // happens to LOOK like a generation output. But request bodies
          // are LLM CALLS, not LLM RESPONSES, so the shape (messages
          // array, not cv_overrides) makes that very unlikely. The
          // try/catch above is defensive.
          if (parsed && bodyLooksLikeLlmCall(parsed)) {
            var addendum = buildAddendum(lastFailureMissing);
            var newBody = augmentBody(parsed, addendum);
            try {
              console.warn('[kernel-completeness-289] augmenting LLM system prompt with ARRAY/TABLE REQUIREMENTS (retry within ' + Math.round(elapsed) + ' ms of last incompleteness failure).');
            } catch (_) {}
            // One-shot: consume the failure timestamp so we don't keep
            // augmenting every subsequent LLM call.
            lastFailureTs = 0;
            lastFailureMissing = null;
            var copyInit = {};
            for (var k in init) {
              if (Object.prototype.hasOwnProperty.call(init, k)) copyInit[k] = init[k];
            }
            copyInit.body = JSON.stringify(newBody);
            return origFetch.call(window, url, copyInit);
          }
        }
      }
    } catch (e) {
      try { console.warn('[kernel-completeness-289] fetch wrapper error (passing through):', e && e.message); } catch (_) {}
    }
    return origFetch.call(window, url, init);
  };

  try { window.fetch = augmentedFetch; }
  catch (_) {}

  window.AntcvKernelCompleteness289 = {
    version: VERSION,
    _checkCompleteness: checkCompleteness,
    _looksLikeGenerationOutput: looksLikeGenerationOutput,
    _bodyLooksLikeLlmCall: bodyLooksLikeLlmCall,
    _buildAddendum: buildAddendum,
    _lastFailureTs: function () { return lastFailureTs; },
    _lastFailureMissing: function () { return lastFailureMissing; },
  };

  try { console.debug('[kernel-completeness-289] installed v' + VERSION + ' (Part A + Part B)'); } catch (_) {}
})();
