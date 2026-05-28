/* AntCV Candidate Preview editor (v1.40.341-p0d)
 * ============================================================
 *
 * CA-001 + CA-002
 * ---------------
 * Makes the Candidate block in Preview directly editable. The
 * block today is React-rendered with three logical pieces:
 *
 *   1. Name           — `personalInfo.name` (or firstName/lastName).
 *   2. Application    — three fields rendered as one sentence:
 *                       `${applicationLabel}: ${role} - ${company}`.
 *      Source: `personalInfo.applicationLabel` (default localised
 *      via antcv-i18n key 'candidate.application'), `personalInfo.role`,
 *      `personalInfo.company`.
 *   3. Contact line   — `personalInfo.email / phone / linkedin / …`.
 *      Existing sidecars handle contact-item placement; this file
 *      doesn't touch them.
 *
 * Acceptance (§4.4):
 *   CA-001  All Candidate items editable in Preview; edits to Name,
 *           Application sentence, contact-like fields survive blur,
 *           reopen, export.
 *   CA-002  Panel exposes applicationLabel + role + company. Preview
 *           renders the concatenated sentence and is editable in
 *           place. Edits parse back into the three fields. Panel and
 *           Preview synchronised. No duplicate label.
 *
 * Approach
 * --------
 *   1. Locate the Preview Candidate block via the data attribute
 *      already in the DOM: `[data-candidate-drop-loc]` (anchors
 *      placed by app.js — see antcv-section-bar-freeze-fix.js:186).
 *      The `topbar` location is where Candidate lives today.
 *   2. For Name + role/company, identify leaf text nodes by the
 *      personalInfo string values currently rendered. Wrap each in
 *      a span tagged data-antcv-candidate-edit="<field>".
 *   3. Set contenteditable="true" on the wrappers; on blur, parse
 *      the new text into the corresponding personalInfo field(s),
 *      write back, dispatch antcv:sections-updated.
 *   4. For the Application sentence specifically: enclose three
 *      contiguous spans (label, role, company) so each can be edited
 *      independently. The separator characters (`: ` and ` - `) are
 *      static decoration.
 *
 * Hazards
 * -------
 *   - No \s in regex literals (none used).
 *   - No \u escapes.
 *   - Persistence touches localStorage['personalInfo'] only; other
 *     storage keys remain owned by app.js / other sidecars.
 *
 * Cooperation with CL-002 (closure-editable-341)
 * ----------------------------------------------
 * That sidecar makes the standalone CL Closure section editable.
 * This sidecar targets the Candidate block, identified by the
 * topbar drop-loc rather than any data-sid. No overlap.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0d-fix4';
  if (window.__antcvCandidatePreviewEditor341 === SCRIPT_VERSION) return;
  window.__antcvCandidatePreviewEditor341 = SCRIPT_VERSION;

  var PI_KEY = 'personalInfo';

  function readPI() {
    try {
      var raw = localStorage.getItem(PI_KEY);
      if (!raw) return {};
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : {};
    } catch (_) { return {}; }
  }

  function writePI(pi) {
    try {
      localStorage.setItem(PI_KEY, JSON.stringify(pi));
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'candidate-preview-editor-341' },
      }));
    } catch (_) {}
  }

  function applicationLabel() {
    var pi = readPI();
    var override = (pi && typeof pi.applicationLabel === 'string') ? pi.applicationLabel.trim() : '';
    if (override) return override;
    var i18n = window.AntcvI18n;
    if (i18n && typeof i18n.t === 'function') {
      return i18n.t('candidate.application', 'Application');
    }
    return 'Application';
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/[\t\n\r ]+/g, ' ').trim();
  }

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function findCandidateBlock() {
    var paper = findPreviewPaper();
    if (!paper) return null;
    // Path A: anchor-based (older builds that expose drop-loc).
    var topbar = paper.querySelector('[data-candidate-drop-loc="topbar"]');
    if (topbar) return topbar;
    // Path B: [data-sid] of canonical Candidate ids.
    var sidCand = paper.querySelector('[data-sid="candidate"], [data-sid="topbar"], [data-sid="top_bar"]');
    if (sidCand) return sidCand;
    // Path C (v1.40.341-p0d-fix2): no Candidate anchor in this
    // build — fall back to the preview paper itself. wrapName /
    // wrapApplicationSentence then locate their target leaves by
    // text match against personalInfo values.
    return paper;
  }

  // ─── Name editability (CA-001) ───────────────────────────────────

  function wrapEditable(el, field) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-antcv-candidate-edit') === field) return false;
    el.setAttribute('data-antcv-candidate-edit', field);
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.style.cursor = 'text';
    el.style.outline = 'none';
    el.addEventListener('click', function (ev) { ev.stopPropagation(); });
    el.addEventListener('blur', function () {
      try { commitField(field, clean(el.textContent || '')); } catch (_) {}
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        el.blur();
      }
    });
    return true;
  }

  function commitField(field, newText) {
    var pi = readPI();
    var changed = false;
    if (field === 'name') {
      if (pi.name !== newText) { pi.name = newText; changed = true; }
      // Best-effort split into first/last for round-trip via panel.
      // Only split if the user wrote a clean two-token name; leave
      // multi-token names intact under `name`.
      var parts = newText.split(' ');
      if (parts.length === 2) {
        if (pi.firstName !== parts[0]) { pi.firstName = parts[0]; changed = true; }
        if (pi.lastName  !== parts[1]) { pi.lastName  = parts[1]; changed = true; }
      }
    } else if (field === 'applicationLabel') {
      var fallback = applicationLabel();
      // Persist only if the user changed it from the localised default.
      if (newText && newText !== fallback) {
        if (pi.applicationLabel !== newText) { pi.applicationLabel = newText; changed = true; }
      } else {
        // User cleared the override; remove it.
        if (pi.applicationLabel) { delete pi.applicationLabel; changed = true; }
      }
    } else if (field === 'role') {
      // v1.40.341-p0d-fix3: skip the literal placeholder so leaving
      // an empty slot untouched doesn't write "[Role]" to storage.
      var nextRole = newText === '[Role]' ? '' : newText;
      if (pi.role !== nextRole) { pi.role = nextRole; changed = true; }
    } else if (field === 'company') {
      var nextCompany = newText === '[Company]' ? '' : newText;
      if (pi.company !== nextCompany) { pi.company = nextCompany; changed = true; }
    }
    if (changed) writePI(pi);
  }

  // ─── Find + wrap Name ───────────────────────────────────────────
  function wrapName(block) {
    var pi = readPI();
    var name = clean(pi.name || ((pi.firstName || '') + ' ' + (pi.lastName || '')));
    if (!name) return;
    // Find the leaf element whose textContent matches the candidate
    // name. Prefer the largest heading.
    var cand = block.querySelectorAll('h1, h2, h3, h4, h5');
    for (var i = 0; i < cand.length; i++) {
      var el = cand[i];
      if (clean(el.textContent) === name) {
        wrapEditable(el, 'name');
        return;
      }
    }
    // Fallback: any leaf element whose text matches.
    var leaves = block.querySelectorAll('div, span, p');
    for (var j = 0; j < leaves.length; j++) {
      var le = leaves[j];
      if (le.children.length > 0) continue;
      if (clean(le.textContent) === name) {
        wrapEditable(le, 'name');
        return;
      }
    }
  }

  // ─── Find + wrap Application sentence ───────────────────────────
  // The sentence is "<label>: <role> - <company>". We construct it
  // ourselves to guarantee one canonical rendering — and replace any
  // existing rendering inside the block (de-duplicating the label).
  function wrapApplicationSentence(block) {
    var pi = readPI();
    var label = applicationLabel();
    // v1.40.341-p0d-fix3: accept multiple personalInfo key names —
    // the schema diverged across writing-engine passes. Earlier
    // builds used pi.role/pi.company; some newer JD-tailoring code
    // writes pi.position/pi.jobTitle/pi.targetRole and
    // pi.targetCompany. Probe all of them.
    var role = clean(pi.role || pi.position || pi.jobTitle || pi.targetRole || '');
    var company = clean(pi.company || pi.targetCompany || pi.employer || '');
    // v1.40.341-p0d-fix3: previously bailed when both role+company
    // were empty. That meant the application sentence was NEVER made
    // editable on a fresh CV — the user had to fill the panel first
    // before they could click in Preview. CA-002 acceptance says
    // "Preview renders the concatenated sentence and is editable in
    // place" — so we must wrap even when the slots are empty. Render
    // the sentence with placeholder hints; the user can type over them.
    if (!role) role = '[Role]';
    if (!company) company = '[Company]';

    // Look for an existing host we control; if found, reuse it.
    var host = block.querySelector(':scope [data-antcv-candidate-application-sentence="1"]');
    if (!host) {
      // Find the leaf element that contains the role or company string
      // (or the localised "Application" label, or the literal
      // "[role and company]" placeholder that app.js renders when the
      // application slot is unfilled) and host the sentence at its
      // parent.
      // v1.40.341-p0d-fix4: previously fell back to
      // block.appendChild(host) when no anchor was found. On the CV
      // paper there is NO application sentence semantically, so the
      // fallback dumped an editable "Application: [Role] - [Company]"
      // span at the CV preview's bottom-left corner. Abort instead —
      // the candidate's application sentence belongs to CL only, and
      // forcing it onto CV produces a phantom block.
      var anchor = null;
      var probes = block.querySelectorAll('div, p, span');
      var lcLabel = label.toLowerCase();
      for (var i = 0; i < probes.length; i++) {
        var el = probes[i];
        if (el.children.length > 0) continue;
        var t = clean(el.textContent || '');
        if (!t) continue;
        var lct = t.toLowerCase();
        var roleHit = (role && role !== '[Role]' && t.indexOf(role) >= 0);
        var companyHit = (company && company !== '[Company]' && t.indexOf(company) >= 0);
        var labelHit = (lcLabel && lct.indexOf(lcLabel + ':') >= 0);
        var placeholderHit = (lct.indexOf('[role and company]') >= 0
                              || lct.indexOf('[role/company]') >= 0
                              || lct.indexOf('application:') >= 0);
        if (roleHit || companyHit || labelHit || placeholderHit) { anchor = el; break; }
      }
      if (!anchor) {
        // No anchor in this block — refuse to materialise a phantom
        // application sentence. The CV paper hits this path.
        return;
      }
      host = document.createElement('div');
      host.setAttribute('data-antcv-candidate-application-sentence', '1');
      host.style.display = 'block';
      host.style.whiteSpace = 'normal';
      anchor.parentNode.insertBefore(host, anchor);
      // Hide the original anchor — we render the canonical sentence
      // in our host. The anchor stays in DOM so React state remains
      // consistent.
      anchor.style.display = 'none';
      anchor.setAttribute('data-antcv-candidate-anchor-hidden', '1');
    }

    // (Re)build the host's children: three editable spans + two
    // static separator spans.
    host.innerHTML = '';
    var labelSpan   = document.createElement('span');
    labelSpan.textContent = label;
    var sep1        = document.createElement('span'); sep1.textContent = ': ';
    var roleSpan    = document.createElement('span');
    roleSpan.textContent = role;
    var sep2        = document.createElement('span'); sep2.textContent = ' - ';
    var companySpan = document.createElement('span');
    companySpan.textContent = company;
    host.appendChild(labelSpan);
    host.appendChild(sep1);
    host.appendChild(roleSpan);
    host.appendChild(sep2);
    host.appendChild(companySpan);
    wrapEditable(labelSpan, 'applicationLabel');
    wrapEditable(roleSpan, 'role');
    wrapEditable(companySpan, 'company');
  }

  // ─── Main sweep ─────────────────────────────────────────────────
  function sweepOnce() {
    var block = findCandidateBlock();
    if (!block) return;
    try { wrapName(block); } catch (_) {}
    try { wrapApplicationSentence(block); } catch (_) {}
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepOnce(); } catch (_) {}
    });
  }

  schedule();
  var delays = [200, 600, 1500, 3000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvCandidatePreviewEditor341 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
    applicationLabel: applicationLabel,
  };

  try { console.debug('[candidate-preview-editor] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
