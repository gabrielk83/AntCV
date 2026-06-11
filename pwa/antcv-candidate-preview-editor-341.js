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

  var SCRIPT_VERSION = '1.50.107-ca006-header-anchor-guard';
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

  // The application role + company are owned by the localStorage "meta"
  // object: the Set-panel "Application — Role/Company" inputs write here and
  // the top-bar chip renders `${meta.role} @ ${meta.company}`. personalInfo
  // role/company are only a legacy/showcase fallback. v1.40.341-p0d-fix7:
  // read + write `meta` so the panel and the preview sentence share one
  // source of truth (previously the panel wrote `meta` while the sentence
  // read personalInfo, so panel edits never reached the preview).
  var META_KEY = 'meta';

  function readMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (!raw) return {};
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : {};
    } catch (_) { return {}; }
  }

  function writeMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      // Same-tab localStorage writes don't fire 'storage', so nudge the app
      // shell explicitly so the top-bar chip + generation see the edit.
      try {
        window.dispatchEvent(new StorageEvent('storage', { key: META_KEY, newValue: localStorage.getItem(META_KEY) }));
      } catch (_) {}
    } catch (_) {}
  }

  function readApplicationRole() {
    var meta = readMeta();
    if (typeof meta.role === 'string' && meta.role.trim()) return meta.role;
    var pi = readPI();
    return clean(pi.role || pi.position || pi.jobTitle || pi.targetRole || '');
  }

  function readApplicationCompany() {
    var meta = readMeta();
    if (typeof meta.company === 'string' && meta.company.trim()) return meta.company;
    var pi = readPI();
    return clean(pi.company || pi.targetCompany || pi.employer || '');
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
      // v1.40.341-p0d-fix7: write the application role to the shared `meta`
      // store (the panel + chip's source), not personalInfo. Skip the
      // literal placeholder so an untouched empty slot stays empty.
      var nextRole = newText === '[Role]' ? '' : newText;
      var mRole = readMeta();
      if (mRole.role !== nextRole) { mRole.role = nextRole; writeMeta(mRole); }
    } else if (field === 'company') {
      var nextCompany = newText === '[Company]' ? '' : newText;
      var mCompany = readMeta();
      if (mCompany.company !== nextCompany) { mCompany.company = nextCompany; writeMeta(mCompany); }
    } else if (field === 'subtitle') {
      // Specialisation line. Stored as meta.subtitle (the same string the app
      // renders as `io.subtitle`, joined by " • "). Treat the localised
      // "[Specialisation — …]" / "[Specialisering — …]" hint as empty.
      var nextSub = /^\[\s*specialis/i.test(newText) ? '' : newText;
      var mSub = readMeta();
      if (mSub.subtitle !== nextSub) { mSub.subtitle = nextSub; writeMeta(mSub); }
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
    // v1.40.341-p0d-fix7: role/company come from the shared `meta` store
    // first (the Set-panel inputs write there), falling back to the legacy
    // personalInfo keys. This is what connects panel edits to the preview.
    var role = clean(readApplicationRole());
    var company = clean(readApplicationCompany());
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
      // CA-006: when findCandidateBlock() fell back to the whole preview
      // paper (Path C, no candidate anchor in this build), `block` is the
      // entire paper. The role and company strings ALSO appear in the
      // PROFESSIONAL EXPERIENCE first role line, so a naive role/company
      // text match here would pick the experience role node and overwrite
      // it with "Application: <role> - <company>" — the Preview-only bleed
      // reported as CA-006 (the clean DOCX/PDF never run this sidecar).
      // Guard: never treat a node that lives inside a content section as
      // the application-sentence anchor. The application sentence belongs
      // to the candidate header only. We exclude any node inside a
      // [data-sid] / [data-section-id] section other than the candidate /
      // top-bar header.
      var CONTENT_SECTION_SEL = '[data-sid]:not([data-sid="candidate"]):not([data-sid="topbar"]):not([data-sid="top_bar"]),'
        + '[data-section-id]:not([data-section-id="candidate"]):not([data-section-id="topbar"]):not([data-section-id="top_bar"])';
      var inContentSection = function (el) {
        try { return !!(el.closest && el.closest(CONTENT_SECTION_SEL)); } catch (_) { return false; }
      };
      for (var i = 0; i < probes.length; i++) {
        var el = probes[i];
        if (el.children.length > 0) continue;
        if (inContentSection(el)) continue; // CA-006: skip experience/profile/etc.
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

    // v1.40.341-p0d-fix5: mirror the candidate Name leaf's computed
    // typography onto the host so the application sentence inherits
    // bold weight, the header color (typically #fff on dark bg), and
    // the header font (serif). fix4 inserted a parallel <div> as the
    // host without copying any styling, so it rendered as the
    // browser default (black, fw 400, sans-serif) and looked like a
    // disabled placeholder hint instead of part of the candidate
    // header. Diagnostic that motivated this fix:
    //   {tag:'DIV', cls:'', color:'rgb(0, 0, 0)', fw:'400', ...}
    // wrapName() is called before wrapApplicationSentence() in
    // sweepOnce(), so by the time we get here the Name is already
    // tagged with data-antcv-candidate-edit="name" and we can read
    // its computed styles. If no Name leaf is found (rare — e.g. the
    // candidate has no name yet), we leave host as-is.
    // v1.50.105 — follow the CHOSEN STYLE. The previous fix only read the
    // candidate Name leaf; when it was absent the host kept the browser default
    // (black, sans-serif) and the sentence vanished on a dark template (e.g.
    // Nordic, white-on-#283556). Prefer the hidden ORIGINAL sentence we replaced
    // — it already carries the template's exact color/font for this slot — then
    // fall back to the Name leaf, then to the host's parent (the header context
    // the template colors). Color is the part that must always be set so the
    // text never disappears under the active style.
    try {
      var anchorSrc = block.querySelector('[data-antcv-candidate-anchor-hidden="1"]');
      var nameLeaf = block.querySelector('[data-antcv-candidate-edit="name"]');
      var styleSrc = anchorSrc || nameLeaf || host.parentElement;
      if (styleSrc) {
        var cs = window.getComputedStyle(styleSrc);
        if (cs) {
          if (cs.fontFamily) host.style.fontFamily = cs.fontFamily;
          if (cs.color) host.style.color = cs.color;
          if (styleSrc === nameLeaf) {
            // Name is usually bold; parallel its weight but read as a subtitle
            // (slightly smaller than the name).
            if (cs.fontWeight) host.style.fontWeight = cs.fontWeight;
            var px = parseFloat(cs.fontSize);
            if (Number.isFinite(px) && px > 0) host.style.fontSize = Math.max(11, Math.round(px * 0.6)) + 'px';
          } else if (styleSrc === anchorSrc) {
            // The original sentence already had the correct size/weight — adopt
            // them verbatim so we match the template exactly.
            if (cs.fontWeight) host.style.fontWeight = cs.fontWeight;
            var apx = parseFloat(cs.fontSize);
            if (Number.isFinite(apx) && apx > 0) host.style.fontSize = Math.round(apx) + 'px';
          }
          if (cs.letterSpacing && cs.letterSpacing !== 'normal') host.style.letterSpacing = cs.letterSpacing;
        }
      }
      // Make the editable spans inherit the host's resolved color/font so the
      // chosen style reaches the text the user actually types into.
      Array.prototype.forEach.call(host.querySelectorAll('[data-antcv-candidate-edit]'), function (sp) {
        sp.style.color = 'inherit'; sp.style.fontFamily = 'inherit'; sp.style.fontWeight = 'inherit';
      });
    } catch (_) {}

    // v1.40.341-p0d-fix6 — edit-safety + idempotency guard. The preview
    // re-renders frequently; rebuilding the host on EVERY sweep destroyed
    // the contenteditable span the user was typing into (focus lost, text
    // reverted to the placeholder), so the Application line was effectively
    // not editable and never showed the entered role/company. Two guards:
    //   (a) if focus is inside the host, the user is editing — leave it be.
    //   (b) if the existing spans already match label/role/company, skip the
    //       teardown so we neither thrash the DOM nor drop the caret.
    var existingLabel = host.querySelector('[data-antcv-candidate-edit="applicationLabel"]');
    var existingRole = host.querySelector('[data-antcv-candidate-edit="role"]');
    var existingCompany = host.querySelector('[data-antcv-candidate-edit="company"]');
    if (existingLabel && existingRole && existingCompany) {
      if (host.contains(document.activeElement)) return;
      if (clean(existingLabel.textContent) === clean(label)
        && clean(existingRole.textContent) === clean(role)
        && clean(existingCompany.textContent) === clean(company)) {
        return;
      }
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

  // ─── Find + wrap Specialisation (meta.subtitle) ─────────────────
  function wrapSpecialisation(block) {
    // Already wrapped? wrapEditable is idempotent, so just stop.
    if (block.querySelector('[data-antcv-candidate-edit="subtitle"]')) return;
    var sub = clean(readMeta().subtitle || '');
    // Find the leaf element that renders the specialisation value or the
    // localised "[Specialisation — …]" / "[Specialisering — …]" placeholder.
    var probes = block.querySelectorAll('div, p, span');
    var target = null;
    var subInContentSection = function (el) {
      var sel = '[data-sid]:not([data-sid="candidate"]):not([data-sid="topbar"]):not([data-sid="top_bar"]),'
        + '[data-section-id]:not([data-section-id="candidate"]):not([data-section-id="topbar"]):not([data-section-id="top_bar"])';
      try { return !!(el.closest && el.closest(sel)); } catch (_) { return false; }
    };
    for (var i = 0; i < probes.length; i++) {
      var el = probes[i];
      if (el.querySelector('[data-antcv-candidate-edit]')) continue; // skip name/application hosts
      if (subInContentSection(el)) continue; // CA-006: header-only
      var t = clean(el.textContent || '');
      if (!t) continue;
      var isPlaceholder = /^\[\s*specialis/i.test(t) || /fokusomr[aå]der/i.test(t);
      var isValue = sub && t === sub;
      if (isPlaceholder || isValue) {
        // Prefer a leaf; a placeholder element is always the leaf we want.
        if (el.children.length === 0 || isPlaceholder) { target = el; break; }
        target = el;
      }
    }
    if (!target) return;
    // Let the user see what they type (the rendered line is nowrap+ellipsis).
    target.style.whiteSpace = 'normal';
    target.style.overflow = 'visible';
    target.style.textOverflow = 'clip';
    wrapEditable(target, 'subtitle');
  }

  // ─── Main sweep ─────────────────────────────────────────────────
  function sweepOnce() {
    var block = findCandidateBlock();
    if (!block) return;
    try { wrapName(block); } catch (_) {}
    try { wrapApplicationSentence(block); } catch (_) {}
    try { wrapSpecialisation(block); } catch (_) {}
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
  // Re-sweep when the shared application `meta` changes (cross-tab, or when
  // any sidecar dispatches a storage event for it) so the sentence tracks
  // the Set-panel Role/Company inputs.
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === META_KEY) schedule();
  });

  window.AntcvCandidatePreviewEditor341 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
    applicationLabel: applicationLabel,
  };

  try { console.debug('[candidate-preview-editor] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
