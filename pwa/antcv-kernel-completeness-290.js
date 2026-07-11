/* AntCV kernel-generation completeness guard (v1.40.290)
 * ──────────────────────────────────────────────────────────────────────
 *
 * What changed vs v289
 * ────────────────────
 * 289 caught the obvious empty-array failure mode, but the production
 * log from the next run showed a more sophisticated failure:
 *
 *   Attempt 1: bring_rows = 0, contribute_items = 0       → guard fired ✓
 *   Augmented retry sent  ✓
 *   Attempt 2: arrays returned with N items where item[0] was
 *              the bracketed template ("[Role title]", "[Strategic
 *              expertise — 1 or 2 lines]") and items[1..] were real
 *              content. Count-based threshold (>=3 filled) passed.
 *              Prose fields (profile_content, opening_content,
 *              who_content, why_content, foundation_*, closure_content)
 *              were all bracketed placeholders. The bundle's existing
 *              "5/5 critical CL fields filled" check counts non-empty,
 *              so it accepted the response.
 *
 *   Then the placeholder leak detector logged 15 sections, and
 *   _scrubRole crashed with "TypeError: a is not a function" while
 *   iterating role 0's malformed bullet shape. Blue screen.
 *
 * Fix (three parts)
 * ─────────────────
 *
 *   Part A — strict completeness check (replaces 289's count-based one)
 *     If ANY array element still contains a bracketed placeholder, the
 *     whole response is rejected. We also validate the prose fields the
 *     bundle accepts as long as they're non-empty: profile_content,
 *     opening_content, who_content, why_content, foundation_hands_on,
 *     foundation_professionally, closure_content, plus
 *     contribute.intro / contribute.closing and selected_outcomes
 *     items. A single placeholder anywhere triggers PartialResponse.
 *
 *   Part B — persistent prompt augmentation (replaces 289's one-shot)
 *     289 consumed the failure timestamp on first augmentation, so a
 *     second failure within the same generation cycle would silently
 *     retry without augmentation. 290 keeps the timestamp armed until
 *     the response actually passes the completeness check, so every
 *     retry within the 30 s window gets the addendum. The addendum
 *     itself is strengthened: it explicitly forbids bracketed text
 *     anywhere in ANY field, names the prose fields that must contain
 *     real sentences, and points out item-0-placeholder as the
 *     observed failure pattern.
 *
 *   Part C — defensive scrubber (new in 290)
 *     If, despite Parts A+B, a placeholder string still survives into
 *     the parsed object (e.g. a future LLM returns content the guard
 *     does not recognise), Part C mutates the returned object in place
 *     to replace any string matching the placeholder pattern with an
 *     empty string before handing it back to app.js. Empty strings are
 *     safe for the bundle's downstream code; bracketed placeholders
 *     are not (they crash _scrubRole). This is a last-resort guard
 *     against the visible failure mode (blue screen) — the user will
 *     still see empty fields rather than placeholders, which is far
 *     less destructive than a runtime crash.
 *
 * Coexistence with 289
 * ────────────────────
 * 290 supersedes 289. Do not load both — both wrap JSON.parse, both
 * wrap fetch, and 289's count-based check would fire before 290's
 * strict check, polluting the failure-missing list. Replace the 289
 * script tag in index.html with a 290 tag.
 *
 * Constraints honoured
 * ────────────────────
 * - No \s in regex literals (trim before testing).
 * - No \u Unicode escapes in source (plain ASCII strings only).
 * - LinkedIn data and personalInfo are never touched.
 * - All comments are standard // or block style.
 */
(function () {
  'use strict';
  var VERSION = '1.51.356-identity-heal';
  if (window.__antcvKernelCompleteness290 === VERSION) return;
  window.__antcvKernelCompleteness290 = VERSION;

  // ────────────────────────────────────────────────────────────────────
  // Predicates
  // ────────────────────────────────────────────────────────────────────

  // Placeholder detectors. Note: trim() is applied before testing, so
  // no whitespace-class anchors are needed in the regex literal (this
  // is intentional — backslash escape sequences in regex literals
  // cause issues with the local test harness brace-counter).
  //
  // RE_BRACKET matches strings like:
  //   "[Role title]"
  //   "[Strategic expertise - 1 or 2 lines]"
  //   "[Specific thing you would do 1]"
  //   "[YYYY - YYYY]"
  //   "[bullet 1 - describe scope and outcome]"   (lowercase first char too)
  // It is intentionally permissive: any string that is entirely a
  // bracketed phrase of 4+ characters is treated as a placeholder.
  var RE_BRACKET = /^\[[^\]]{2,500}\]$/;
  var RE_FILL = /^FILL_[a-z_0-9]+_(here|HERE)/;

  // Manual analyser for "[TEMPLATE] trailing words" — implemented
  // without a regex literal so that no whitespace escape is needed.
  // Returns true if t starts with a bracketed token that looks like a
  // schema placeholder (uppercase first char, or common template
  // words inside the brackets).
  function startsWithTemplateBracket(t) {
    if (t.charAt(0) !== '[') return false;
    var endIdx = t.indexOf(']');
    if (endIdx < 3) return false;
    var inner = t.substring(1, endIdx);
    if (inner.length < 2 || inner.length > 200) return false;
    var first = inner.charAt(0);
    if (first >= 'A' && first <= 'Z') return true;
    var lc = inner.toLowerCase();
    if (lc.indexOf('placeholder') >= 0) return true;
    if (lc.indexOf('describe') >= 0) return true;
    if (lc.indexOf('bullet') >= 0) return true;
    if (lc.indexOf('specific thing') >= 0) return true;
    if (lc.indexOf('focus area') >= 0) return true;
    if (lc.indexOf('strategic') >= 0) return true;
    return false;
  }

  function isPlaceholderString(v) {
    if (typeof v !== 'string') return false;
    var t = v.trim();
    if (t.length === 0) return false;
    if (RE_BRACKET.test(t)) return true;
    if (RE_FILL.test(t)) return true;
    if (startsWithTemplateBracket(t)) return true;
    return false;
  }

  // CJK-LENGTH-EQUIV-001 (owner 2026-07-12): every length floor below was
  // calibrated for ENGLISH prose. Chinese carries roughly 3x the information
  // per character, so a perfectly valid zh contribute_intro (7-9 chars, e.g.
  // "our first priorities:" in 7 hanzi) failed the 10-char floor, the WHOLE
  // response was discarded as KERNEL_INCOMPLETE, every retry failed the same
  // way, and the zh kernel generation ended templated. Count each CJK char as
  // 3 toward the floors. charCode ranges, not a regex literal, per this
  // file's ASCII-only constraint (header notes).
  function effectiveLen(t) {
    var n = t.length;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c >= 0x3400 && c <= 0x9fff) n += 2;
    }
    return n;
  }

  function isFilledString(v, minLen) {
    if (typeof v !== 'string') return false;
    var t = v.trim();
    if (effectiveLen(t) < (minLen || 8)) return false;
    if (isPlaceholderString(t)) return false;
    if (t === 'Focus Area' || t === 'Strategic Expertise') return false;
    if (t.length <= 2) return false;
    return true;
  }

  // ────────────────────────────────────────────────────────────────────
  // Strict checkers — failure on ANY placeholder, not "enough filled"
  // ────────────────────────────────────────────────────────────────────

  // Returns null if rows is OK, else a description of what's wrong.
  function checkDataRowsStrict(rows, minDataRows, label) {
    if (!Array.isArray(rows)) return label + ' (not an array)';
    if (rows.length < (minDataRows + 1)) {
      return label + ' (' + Math.max(0, rows.length - 1) + ' data rows, need >=' + minDataRows + ')';
    }
    var placeholderRowIdx = -1;
    var filledCount = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!Array.isArray(r) || r.length < 2) {
        placeholderRowIdx = i;
        break;
      }
      if (isPlaceholderString(r[0]) || isPlaceholderString(r[1])) {
        placeholderRowIdx = i;
        break;
      }
      if (isFilledString(r[0], 3) && isFilledString(r[1], 6)) filledCount++;
    }
    if (placeholderRowIdx >= 0) {
      return label + ' (row ' + placeholderRowIdx + ' is placeholder text — ALL rows must be real content)';
    }
    if (filledCount < minDataRows) {
      return label + ' (' + filledCount + ' filled data rows, need >=' + minDataRows + ')';
    }
    return null;
  }

  function checkRolesStrict(roles, minRoles) {
    if (!Array.isArray(roles)) return 'cv_overrides.experience_roles (not an array)';
    var placeholderRoleIdx = -1;
    var filledCount = 0;
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      if (!r || typeof r !== 'object') continue;
      if (r.on === false) continue;
      var title = (typeof r.title === 'string') ? r.title : '';
      var company = (typeof r.company === 'string') ? r.company : '';
      var years = (typeof r.years === 'string') ? r.years : '';
      if (isPlaceholderString(title) || isPlaceholderString(company) || isPlaceholderString(years)) {
        placeholderRoleIdx = i;
        break;
      }
      if (!isFilledString(title, 3) || !isFilledString(company, 2)) {
        continue;
      }
      // Bullets: any placeholder bullet fails the role.
      if (Array.isArray(r.bullets)) {
        var bulletPlaceholder = false;
        for (var j = 0; j < r.bullets.length; j++) {
          if (isPlaceholderString(r.bullets[j])) { bulletPlaceholder = true; break; }
        }
        if (bulletPlaceholder) {
          placeholderRoleIdx = i;
          break;
        }
        var filledBullets = 0;
        for (var k = 0; k < r.bullets.length; k++) {
          if (isFilledString(r.bullets[k], 12)) filledBullets++;
        }
        if (filledBullets >= 1) filledCount++;
      }
    }
    if (placeholderRoleIdx >= 0) {
      return 'cv_overrides.experience_roles (role ' + placeholderRoleIdx
        + ' contains placeholder title/company/years/bullet — ALL active roles must be real content)';
    }
    if (filledCount < minRoles) {
      return 'cv_overrides.experience_roles (' + filledCount + ' filled, need >=' + minRoles + ')';
    }
    return null;
  }

  function checkItemsStrict(items, minItems, label, minLen) {
    if (!Array.isArray(items)) return label + ' (not an array)';
    var placeholderIdx = -1;
    var filledCount = 0;
    for (var i = 0; i < items.length; i++) {
      if (isPlaceholderString(items[i])) {
        placeholderIdx = i;
        break;
      }
      if (isFilledString(items[i], minLen || 12)) filledCount++;
    }
    if (placeholderIdx >= 0) {
      return label + ' (item ' + placeholderIdx + ' is placeholder text — ALL items must be real content)';
    }
    if (filledCount < minItems) {
      return label + ' (' + filledCount + ' filled items, need >=' + minItems + ')';
    }
    return null;
  }

  // Prose field check: a single string. Fails on placeholder. Fails on
  // too-short content. minLen is the minimum trimmed length to count
  // as filled.
  function checkProseFieldStrict(value, minLen, label) {
    if (typeof value !== 'string') return label + ' (missing or not a string)';
    var t = value.trim();
    if (t.length === 0) return label + ' (empty)';
    if (isPlaceholderString(t)) return label + ' (placeholder text)';
    // CJK-LENGTH-EQUIV-001: weighted length so zh prose is judged fairly.
    var el = effectiveLen(t);
    if (el < minLen) return label + ' (' + el + ' chars cjk-weighted, need >=' + minLen + ')';
    return null;
  }

  // GEN-UNSOL-002 (1.50.358): when the GENERATE REQUEST carried a real job
  // description, the output's meta.company and meta.role MUST name the
  // employer/role from that JD. An empty or unsolicited-flavoured meta on a
  // JD-bearing run makes the application header fall back to "Open
  // Application — Unsolicited" even though the JD names the company. The
  // request side (fetch wrap below) records whether the last generation call
  // contained a JD block; this checker enforces the contract on the output.
  function isAnglePlaceholder(t) {
    return t.length > 3 && t.charAt(0) === '<' && t.charAt(t.length - 1) === '>';
  }
  function checkMetaStrict(meta) {
    var issues = [];
    var m = (meta && typeof meta === 'object') ? meta : {};
    var fields = [['company', 'meta.company'], ['role', 'meta.role']];
    for (var i = 0; i < fields.length; i++) {
      var v = m[fields[i][0]];
      var label = fields[i][1];
      var t = (typeof v === 'string') ? v.trim() : '';
      if (t.length === 0) {
        issues.push(label + ' (empty — a JOB DESCRIPTION was provided; fill it with the exact name from the JD)');
        continue;
      }
      if (isPlaceholderString(t) || isAnglePlaceholder(t)) {
        issues.push(label + ' (placeholder text — fill it with the exact name from the JD)');
        continue;
      }
      if (/^(unsolicited|open\s+application.*|n\/?a)$/i.test(t)) {
        issues.push(label + ' ("' + t + '" — a JOB DESCRIPTION was provided; never fall back to unsolicited wording)');
      }
    }
    return issues;
  }

  // Request-side state: did the most recent generation request include a JD?
  var lastGenReqTs = 0;
  var lastGenReqHadJD = false;
  var GEN_REQ_WINDOW_MS = 30 * 60 * 1000; // generation cycles run 3-6+ min with retries

  function noteGenerationRequest(bodyStr) {
    // Cheap string sniff — only generation calls carry both override keys.
    if (typeof bodyStr !== 'string') return;
    if (bodyStr.indexOf('cv_overrides') === -1 || bodyStr.indexOf('cl_overrides') === -1) return;
    lastGenReqTs = Date.now();
    // STRICT marker: the JD content block's VALUE starts with the header
    // (':"JOB DESCRIPTION:' covers both "text":"…" and "content":"…"
    // serialisations). A JD pasted into Additional Signals sits mid-value
    // behind the "ADDITIONAL SIGNALS:" prefix and must NOT arm the check —
    // on a no-JD run the prompt forces meta.company EMPTY, and a false arm
    // here would fight that rule into a retry loop.
    lastGenReqHadJD = bodyStr.indexOf(':"JOB DESCRIPTION:') !== -1;
  }

  function metaCheckArmed() {
    return lastGenReqHadJD && lastGenReqTs !== 0 && (Date.now() - lastGenReqTs) < GEN_REQ_WINDOW_MS;
  }

  function looksLikeGenerationOutput(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    var hasCv = Object.prototype.hasOwnProperty.call(obj, 'cv_overrides');
    var hasCl = Object.prototype.hasOwnProperty.call(obj, 'cl_overrides');
    var hasMeta = Object.prototype.hasOwnProperty.call(obj, 'meta');
    var hasRationale = Object.prototype.hasOwnProperty.call(obj, 'rationale');
    var n = (hasCv ? 1 : 0) + (hasCl ? 1 : 0) + (hasMeta ? 1 : 0) + (hasRationale ? 1 : 0);
    if (n < 2) return false;
    var cvIsObj = hasCv && obj.cv_overrides && typeof obj.cv_overrides === 'object';
    var clIsObj = hasCl && obj.cl_overrides && typeof obj.cl_overrides === 'object';
    return cvIsObj || clIsObj;
  }

  // Returns an array of missing-key descriptions. Empty array = OK.
  function checkCompleteness(obj) {
    var missing = [];
    var cv = (obj && obj.cv_overrides) || {};
    var cl = (obj && obj.cl_overrides) || {};

    // Arrays / tables ────────────────────────────────────────────────
    var r;
    r = checkRolesStrict(cv.experience_roles, 3);
    if (r) missing.push(r);
    // CORE-COMP-RETRY-HANG-001 (owner 2026-06-15): require >=3 data rows, not 4.
    // 4 forced a full PartialResponse RETRY whenever the LLM returned exactly 3
    // competency rows — burning all 4 generate attempts (multi-minute hang +
    // the subtitle reverting to the [Specialisation …] placeholder), then ending
    // with 3 rows anyway. 3 matches the CL equivalent (cl.bring_rows, below) and
    // experience_roles — a 3-row Core Competencies table is acceptable.
    r = checkDataRowsStrict(cv.core_comp_rows, 3, 'cv_overrides.core_comp_rows');
    if (r) missing.push(r);
    r = checkDataRowsStrict(cl.bring_rows, 3, 'cl_overrides.bring_rows');
    if (r) missing.push(r);
    r = checkItemsStrict(cl.contribute_items, 3, 'cl_overrides.contribute_items', 12);
    if (r) missing.push(r);

    // Selected outcomes (CV) — bullets array of objects {t, b} or strings
    if (Array.isArray(cv.selected_outcomes)) {
      var soPlaceholder = -1;
      for (var i = 0; i < cv.selected_outcomes.length; i++) {
        var it = cv.selected_outcomes[i];
        if (typeof it === 'string') {
          if (isPlaceholderString(it)) { soPlaceholder = i; break; }
        } else if (it && typeof it === 'object') {
          if (isPlaceholderString(it.t) || isPlaceholderString(it.b)
              || isPlaceholderString(it.title) || isPlaceholderString(it.content)) {
            soPlaceholder = i;
            break;
          }
        }
      }
      if (soPlaceholder >= 0) {
        missing.push('cv_overrides.selected_outcomes (item ' + soPlaceholder + ' is placeholder)');
      }
    }

    // Prose fields ──────────────────────────────────────────────────
    // These are the fields the bundle's existing partial-response
    // check verifies for non-emptiness only. We check the same set
    // for non-placeholder content, plus a few neighbours that crash
    // _scrubRole or render visibly when left as placeholders.
    var proseChecks = [
      // CV prose
      [cv.profile_content, 30, 'cv_overrides.profile_content'],
      // CL prose (the bundle's 5/5 check covers these)
      [cl.opening_content, 20, 'cl_overrides.opening_content'],
      [cl.who_content, 30, 'cl_overrides.who_content'],
      [cl.why_content, 30, 'cl_overrides.why_content'],
      [cl.foundation_hands_on, 20, 'cl_overrides.foundation_hands_on'],
      [cl.foundation_professionally, 20, 'cl_overrides.foundation_professionally'],
      [cl.closure_content, 20, 'cl_overrides.closure_content'],
      // Contribute intro/closing are NOT in the bundle's 5/5 set but
      // get rendered. Placeholders there leak through visibly.
      [cl.contribute_intro, 10, 'cl_overrides.contribute_intro'],
      [cl.contribute_closing, 10, 'cl_overrides.contribute_closing'],
    ];
    for (var p = 0; p < proseChecks.length; p++) {
      var val = proseChecks[p][0];
      // Tolerate missing optional fields if the LLM omitted them
      // entirely (undefined). Only fail when the field IS provided
      // and is empty/placeholder. The bundle's own check already
      // enforces presence of the core 5.
      if (typeof val !== 'string') continue;
      var pr = checkProseFieldStrict(val, proseChecks[p][1], proseChecks[p][2]);
      if (pr) missing.push(pr);
    }

    return missing;
  }

  // ────────────────────────────────────────────────────────────────────
  // Part C — defensive recursive placeholder scrubber
  // ────────────────────────────────────────────────────────────────────
  //
  // If a placeholder somehow survives the completeness check (e.g. an
  // unanticipated field name or shape), this scrubber replaces any
  // string matching the placeholder pattern with an empty string. The
  // mutation is in-place. Empty strings are safe downstream; bracketed
  // placeholders are not (they crash _scrubRole).
  //
  // Limits:
  //   - depth cap at 20 to prevent runaway recursion on cyclic objects
  //   - only mutates strings; arrays and objects are descended into
  //   - keys are not scrubbed (only values)
  //   - returns the count of replacements made (for diagnostics)

  function scrubPlaceholders(obj, depthCap) {
    var count = { n: 0 };
    function walk(node, depth) {
      if (depth > depthCap) return;
      if (!node) return;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          var v = node[i];
          if (typeof v === 'string') {
            if (isPlaceholderString(v)) { node[i] = ''; count.n++; }
          } else if (v && typeof v === 'object') {
            walk(v, depth + 1);
          }
        }
        return;
      }
      if (typeof node === 'object') {
        for (var k in node) {
          if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
          var w = node[k];
          if (typeof w === 'string') {
            if (isPlaceholderString(w)) { node[k] = ''; count.n++; }
          } else if (w && typeof w === 'object') {
            walk(w, depth + 1);
          }
        }
      }
    }
    walk(obj, 0);
    return count.n;
  }

  // ────────────────────────────────────────────────────────────────────
  // Part A — JSON.parse interception
  // ────────────────────────────────────────────────────────────────────

  var lastFailureTs = 0;
  var lastFailureMissing = null;
  // 290 change: do NOT clear lastFailureTs on first augmentation.
  // Clear it only when a complete response is accepted.

  var origParse = JSON.parse;
  if (typeof origParse !== 'function') return;

  JSON.parse = function (text, reviver) {
    var result = origParse.call(JSON, text, reviver);
    try {
      if (looksLikeGenerationOutput(result)) {
        var missing = checkCompleteness(result);
        // GEN-UNSOL-002: only enforce the meta contract when the request side
        // saw a JD-bearing generation call recently.
        if (metaCheckArmed()) {
          missing = missing.concat(checkMetaStrict(result.meta));
        }
        if (missing.length > 0) {
          try {
            console.warn('[kernel-completeness-290] LLM output missing/placeholder critical sections — '
              + 'throwing PartialResponse to trigger provider retry. Issues: '
              + missing.join('; '));
          } catch (_) {}
          lastFailureTs = Date.now();
          lastFailureMissing = missing;
          var err = new Error('KERNEL_INCOMPLETE: ' + missing.join('; '));
          err.name = 'PartialResponse';
          err._kernelCompletenessMissing = missing;
          err._partialCount = 0;
          throw err;
        } else {
          // Response passed — clear the failure timestamp so the next
          // unrelated LLM call (e.g. JD parsing later in the session)
          // does not get an obsolete augmentation.
          if (lastFailureTs !== 0) {
            try { console.debug('[kernel-completeness-290] response complete; clearing augmentation arm.'); } catch (_) {}
            lastFailureTs = 0;
            lastFailureMissing = null;
          }
          // Accepted generation output — disarm the JD meta contract so an
          // unrelated later parse can't trip on stale request state.
          lastGenReqTs = 0;
          lastGenReqHadJD = false;
          // Defensive Part C: still scrub any rogue placeholder strings
          // in unanticipated locations. If our check passes but a stray
          // placeholder exists in some field we did not validate, the
          // scrubber empties it rather than letting it reach _scrubRole.
          try {
            var scrubbed = scrubPlaceholders(result, 20);
            if (scrubbed > 0) {
              console.warn('[kernel-completeness-290] defensive scrub: replaced ' + scrubbed
                + ' placeholder string(s) with empty strings in accepted response.');
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      if (e && e._kernelCompletenessMissing) throw e;
    }
    return result;
  };

  // ────────────────────────────────────────────────────────────────────
  // Part B — fetch interception with persistent prompt augmentation
  // ────────────────────────────────────────────────────────────────────

  function buildAddendum(missing) {
    var parts = [];
    parts.push('');
    parts.push('');
    parts.push('==========================================================');
    parts.push('CRITICAL OUTPUT REQUIREMENTS — RETRY REASON');
    parts.push('==========================================================');
    parts.push('Your previous response in this generation run was discarded.');
    parts.push('Reason: the following fields were missing, too short, or contained bracketed placeholder text:');
    if (missing && missing.length) {
      for (var i = 0; i < missing.length; i++) {
        parts.push('  - ' + missing[i]);
      }
    } else {
      parts.push('  - (no specific list available; assume widespread placeholders)');
    }
    parts.push('');
    parts.push('ABSOLUTE RULES FOR THIS RETRY:');
    parts.push('');
    parts.push('1. NEVER output a string that is entirely a bracketed placeholder, anywhere in the JSON.');
    parts.push('   Forbidden examples (any of these in any field is an automatic discard):');
    parts.push('     "[Role title]"');
    parts.push('     "[Company name]"');
    parts.push('     "[YYYY - YYYY]"');
    parts.push('     "[Bullet 1 - describe scope and outcome]"');
    parts.push('     "[Focus area 1]"');
    parts.push('     "[Strategic expertise - 1 or 2 lines]"');
    parts.push('     "[Specific thing you would do 1]"');
    parts.push('     "[Placeholder ...]"');
    parts.push('   Bracketed text in the schema is a TEMPLATE. You must REPLACE it with real content drawn from the candidate memory digest.');
    parts.push('');
    parts.push('2. Pay specific attention to ITEM 0 / ROW 1 in every array. The previous response left the FIRST data item as the template and filled later items. Fill EVERY item with real content.');
    parts.push('');
    parts.push('3. cv_overrides.experience_roles');
    parts.push('   - Minimum 5 entries with on:true.');
    parts.push('   - Each entry MUST have non-placeholder title, company, years ("YYYY - YYYY" or "YYYY - Present"), and 2-3 bullets per role.');
    parts.push('   - Source: candidate work history in the memory digest. Do NOT invent companies.');
    parts.push('');
    parts.push('4. cv_overrides.core_comp_rows AND cl_overrides.bring_rows');
    parts.push('   - First row is the literal header ["Focus Area", "Strategic Expertise"].');
    parts.push('   - At least 4-5 additional rows, each with two non-placeholder strings tailored to the JD.');
    parts.push('');
    parts.push('5. cl_overrides.contribute_items');
    parts.push('   - At least 3 specific, non-placeholder action bullets, 12-30 words each, concrete actions.');
    parts.push('');
    parts.push('6. Prose fields (write real sentences, not templates):');
    parts.push('   - cv_overrides.profile_content (>=30 chars, 2-3 sentences about the candidate)');
    parts.push('   - cl_overrides.opening_content (>=20 chars, first sentence of the letter)');
    parts.push('   - cl_overrides.who_content (>=30 chars, WHO I AM body)');
    parts.push('   - cl_overrides.why_content (>=30 chars, WHY THIS POSITION body)');
    parts.push('   - cl_overrides.foundation_hands_on (>=20 chars)');
    parts.push('   - cl_overrides.foundation_professionally (>=20 chars)');
    parts.push('   - cl_overrides.closure_content (>=20 chars, last sentence of the letter)');
    parts.push('   - cl_overrides.contribute_intro and contribute_closing (>=10 chars each if you include them)');
    parts.push('');
    parts.push('7. meta.company AND meta.role (when a JOB DESCRIPTION document is present)');
    parts.push('   - meta.company = the EXACT employer name from the JOB DESCRIPTION.');
    parts.push('   - meta.role = the EXACT role title from the JOB DESCRIPTION.');
    parts.push('   - NEVER leave them empty and NEVER write "Unsolicited" / "Open Application" when the JD names the employer.');
    parts.push('');
    parts.push('Reread your response BEFORE outputting. If ANY field contains bracketed placeholder text, REWRITE that field with real content from the memory digest before returning the JSON.');
    parts.push('==========================================================');
    return parts.join('\n');
  }

  function bodyLooksLikeLlmCall(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    if (!Array.isArray(parsed.messages)) return false;
    if (parsed.messages.length === 0) return false;
    var sys = null;
    if (typeof parsed.system === 'string' && parsed.system.length > 0) {
      sys = parsed.system;
    } else if (parsed.messages[0] && parsed.messages[0].role === 'system') {
      sys = parsed.messages[0].content;
    } else {
      var m = parsed.messages[0];
      if (m && typeof m.content === 'string') sys = m.content;
    }
    if (typeof sys !== 'string') return false;
    return sys.indexOf('cv_overrides') !== -1 || sys.indexOf('cl_overrides') !== -1;
  }

  function augmentSystemString(s, addendum) {
    if (typeof s !== 'string') return s;
    return s + addendum;
  }

  function augmentBody(parsed, addendum) {
    var copy = {};
    for (var k in parsed) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) copy[k] = parsed[k];
    }
    if (typeof copy.system === 'string' && copy.system.length > 0) {
      copy.system = augmentSystemString(copy.system, addendum);
      return copy;
    }
    if (Array.isArray(copy.messages) && copy.messages.length > 0) {
      var msgs = copy.messages.slice();
      if (msgs[0] && msgs[0].role === 'system') {
        var sm = {};
        for (var sk in msgs[0]) {
          if (Object.prototype.hasOwnProperty.call(msgs[0], sk)) sm[sk] = msgs[0][sk];
        }
        sm.content = augmentSystemString(sm.content, addendum);
        msgs[0] = sm;
      } else if (msgs[0] && typeof msgs[0].content === 'string') {
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
    window.AntcvKernelCompleteness290 = {
      version: VERSION,
      _checkCompleteness: checkCompleteness,
      _looksLikeGenerationOutput: looksLikeGenerationOutput,
      _scrubPlaceholders: scrubPlaceholders,
      _isPlaceholderString: isPlaceholderString,
      _lastFailureTs: function () { return lastFailureTs; },
    };
    try { console.debug('[kernel-completeness-290] installed v' + VERSION + ' (Parts A+C only; no window.fetch)'); } catch (_) {}
    return;
  }

  var WINDOW_MS = 30000;

  var augmentedFetch = function (url, init) {
    try {
      if (init && init.method === 'POST' && init.body && typeof init.body === 'string') {
        // GEN-UNSOL-002: record whether this generation request carries a JD
        // so the parse-side meta contract knows when to arm.
        noteGenerationRequest(init.body);
        var elapsed = Date.now() - lastFailureTs;
        if (lastFailureTs !== 0 && elapsed < WINDOW_MS) {
          var parsed = null;
          try { parsed = origParse.call(JSON, init.body); } catch (_) { parsed = null; }
          if (parsed && bodyLooksLikeLlmCall(parsed)) {
            var addendum = buildAddendum(lastFailureMissing);
            var newBody = augmentBody(parsed, addendum);
            try {
              console.warn('[kernel-completeness-290] augmenting LLM system prompt with ARRAY/TABLE/PROSE REQUIREMENTS (retry within ' + Math.round(elapsed) + ' ms of last failure; persistent until success).');
            } catch (_) {}
            // 290 change: do NOT consume the failure timestamp here.
            // It will be cleared by JSON.parse when a complete response
            // is finally accepted. This means every retry within the
            // 30 s window gets the addendum, not just the first one.
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
      try { console.warn('[kernel-completeness-290] fetch wrapper error (passing through):', e && e.message); } catch (_) {}
    }
    return origFetch.call(window, url, init);
  };

  try { window.fetch = augmentedFetch; }
  catch (_) {}

  window.AntcvKernelCompleteness290 = {
    version: VERSION,
    _checkCompleteness: checkCompleteness,
    _checkMetaStrict: checkMetaStrict,
    _noteGenerationRequest: noteGenerationRequest,
    _metaCheckArmed: metaCheckArmed,
    _looksLikeGenerationOutput: looksLikeGenerationOutput,
    _bodyLooksLikeLlmCall: bodyLooksLikeLlmCall,
    _buildAddendum: buildAddendum,
    _scrubPlaceholders: scrubPlaceholders,
    _isPlaceholderString: isPlaceholderString,
    _lastFailureTs: function () { return lastFailureTs; },
    _lastFailureMissing: function () { return lastFailureMissing; },
  };

  try { console.debug('[kernel-completeness-290] installed v' + VERSION + ' (Parts A + B + C; strict mode, persistent augmentation)'); } catch (_) {}
})();
