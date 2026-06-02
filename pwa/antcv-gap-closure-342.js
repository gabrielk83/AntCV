/* AntCV Gap Closure — apply suggested edits to sections, with undo (v1.40.342)
 * ============================================================================
 *
 * Bundle 1 of the analysis-panel rework.
 *
 * What it does
 * ------------
 * The JD-analysis modal (antcv-recheck-fit.js, "Fit vs CV" tab) already
 * renders, per the /api/recheck-fit response:
 *   - a.gaps[]           -> { missing, jd_mention }
 *   - a.suggested_edits[]-> { doc, section_id, change_type, rationale, preview }
 * but each suggested edit was COPY-ONLY (clipboard). The user had to paste
 * the text into the editor by hand, and gaps were never marked closed.
 *
 * This sidecar augments that same modal, without editing recheck-fit.js:
 *   1. Adds an "Apply to <section>" button to every suggested-edit card.
 *      Clicking it writes edit.preview into the MOST APPROPRIATE section of
 *      the CV or CL — chosen by edit.doc + edit.section_id — using the live
 *      `sections` bundle and the same write conventions the closure and
 *      append sidecars use. The PWA re-renders via antcv:sections-updated.
 *   2. Marks the matching gap GREEN with a check once its edit is applied
 *      (mirrors the overlay's "Added" affordance).
 *   3. Supports UNDO: every apply snapshots the prior `sections` bundle onto
 *      a dedicated stack (antcv:gap-closure:undo). An "Undo" button on the
 *      card restores the snapshot and flips the gap back to open.
 *
 * Why a separate file
 * -------------------
 * Per CLAUDE.md hotfix discipline: tight, named, additive bundles over edits
 * to large working files. recheck-fit.js stays untouched; if this sidecar
 * regresses, removing its one <script> tag is a complete revert.
 *
 * Storage conventions (confirmed against the repo)
 * ------------------------------------------------
 *   localStorage.sections           — live bundle { cv:[...], cl:[...] } (React store)
 *   localStorage.doc                — 'cv' | 'cl' (active doc; not required here)
 *   Section shapes: { content:string } | { items:[string|{l,v}|{text}|{value}] }
 *                   | { bullets:[string] }
 *   Event: antcv:sections-updated   — re-render trigger consumed by app.js +
 *                                     sidecars. NB antcv-personality.js rebuilds
 *                                     from personalInfo on this event, so we
 *                                     only fire it AFTER writing `sections`.
 *
 * Undo stack
 * ----------
 *   localStorage['antcv:gap-closure:undo'] = JSON [ { at, label, sections } ... ]
 *   Capped at 20 entries. Self-contained — does not touch cv_pwa_undo_stack
 *   (that is app.js's own editor undo and has a different shape).
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.342';
  if (window.__antcvGapClosure342 === SCRIPT_VERSION) return;
  window.__antcvGapClosure342 = SCRIPT_VERSION;

  var SECTIONS_KEY = 'sections';
  var UNDO_KEY = 'antcv:gap-closure:undo';
  var UNDO_CAP = 20;

  // --- BRAND (matches recheck-fit.js editor chrome) ---
  var BRAND = {
    navy: '#283556', white: '#fff', teal: '#00746E', tealBright: '#01B7BB',
    tealBgLight: '#e7f4f3', muted: '#595959', amber: '#f59e0b',
    danger: '#b8001f', okBg: '#e7f4f3', okBorder: '#00746E', okText: '#0f6e56',
  };

  // --- storage helpers ---
  function readSectionsBundle() {
    try {
      var raw = localStorage.getItem(SECTIONS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) { return null; }
  }
  function writeSectionsBundle(bundle) {
    try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(bundle)); return true; }
    catch (_) { return false; }
  }
  function fireSectionsUpdated(source, extra) {
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated',
        { detail: Object.assign({ source: source }, extra || {}) }));
    } catch (_) {}
  }

  // --- undo stack ---
  function readUndo() {
    try { var r = localStorage.getItem(UNDO_KEY); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; }
    catch (_) { return []; }
  }
  function writeUndo(stack) {
    try { localStorage.setItem(UNDO_KEY, JSON.stringify(stack.slice(-UNDO_CAP))); } catch (_) {}
  }
  function pushUndo(label, bundleSnapshot) {
    var stack = readUndo();
    stack.push({ at: Date.now(), label: label, sections: bundleSnapshot });
    writeUndo(stack);
  }
  function popUndo() {
    var stack = readUndo();
    if (!stack.length) return null;
    var entry = stack.pop();
    writeUndo(stack);
    return entry;
  }

  // --- section resolution + write ---
  // Find the section in bundle[doc] whose id matches section_id. Match is
  // tolerant: exact id, normalised id, or a title-substring match so a
  // recommended target like "selected_outcomes" still lands when the section
  // id is "outcomes" or its title is "SELECTED OUTCOMES".
  function findSection(arr, sectionId) {
    if (!Array.isArray(arr) || !sectionId) return null;
    var want = String(sectionId).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      if (!s) continue;
      if (s.id === sectionId) return s;
    }
    for (var j = 0; j < arr.length; j++) {
      var s2 = arr[j];
      if (!s2) continue;
      var id2 = String(s2.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      if (id2 === want) return s2;
    }
    for (var k = 0; k < arr.length; k++) {
      var s3 = arr[k];
      if (!s3) continue;
      var title3 = String(s3.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      if (title3 && (title3.indexOf(want) >= 0 || want.indexOf(title3) >= 0)) return s3;
    }
    return null;
  }

  // Apply preview text to a section according to its shape and the change
  // type. For bullet/list sections an "add" appends a new item; otherwise
  // the preview replaces the primary text field. Returns true on mutation.
  function applyEditToSection(section, edit) {
    if (!section) return false;
    var preview = String(edit.preview || '').trim();
    if (!preview) return false;
    var changeType = String(edit.change_type || 'reword').toLowerCase();
    var isAdd = changeType === 'add' || changeType === 'append' || changeType === 'insert';

    // list / labeled_list / bullets -> add or replace-first
    if (Array.isArray(section.items)) {
      if (isAdd) {
        var sample = section.items[0];
        if (sample && typeof sample === 'object') {
          if ('l' in sample || 'v' in sample) section.items.push({ l: '', v: preview });
          else if ('text' in sample) section.items.push({ text: preview });
          else if ('value' in sample) section.items.push({ value: preview });
          else section.items.push(preview);
        } else {
          section.items.push(preview);
        }
      } else {
        var it = section.items[0];
        if (typeof it === 'string') section.items[0] = preview;
        else if (it && typeof it === 'object') {
          if (typeof it.v === 'string') it.v = preview;
          else if (typeof it.text === 'string') it.text = preview;
          else if (typeof it.value === 'string') it.value = preview;
          else section.items.unshift(preview);
        } else section.items.unshift(preview);
      }
      return true;
    }
    if (Array.isArray(section.bullets)) {
      if (isAdd) section.bullets.push(preview);
      else section.bullets[0] = preview;
      return true;
    }
    // text section
    if (typeof section.content === 'string' || section.content === undefined) {
      section.content = isAdd && section.content
        ? (section.content.trim() + ' ' + preview)
        : preview;
      return true;
    }
    return false;
  }

  // Decide the appropriate doc + section, write the edit, snapshot undo.
  // Returns { ok, doc, sectionTitle } or { ok:false, error }.
  function closeGapWithEdit(edit) {
    var bundle = readSectionsBundle();
    if (!bundle) return { ok: false, error: 'No sections loaded yet.' };
    var doc = (edit.doc === 'cl') ? 'cl' : 'cv';
    if (!Array.isArray(bundle[doc])) {
      doc = Array.isArray(bundle.cv) ? 'cv' : (Array.isArray(bundle.cl) ? 'cl' : null);
      if (!doc) return { ok: false, error: 'sections.' + (edit.doc || 'cv') + ' is missing.' };
    }
    var section = findSection(bundle[doc], edit.section_id);

    // Snapshot BEFORE mutation for undo.
    var snapshot = JSON.parse(JSON.stringify(bundle));

    var title;
    if (section) {
      if (!applyEditToSection(section, edit)) {
        return { ok: false, error: 'Could not write to section "' + (section.title || section.id) + '".' };
      }
      title = section.title || section.id;
    } else {
      // Section not found — append a clearly-labelled gap-closure block,
      // mirroring the proven jd_questions append pattern. Lands in the doc
      // the edit targeted so the evidence is still in the right place.
      var newSection = {
        id: 'gap_closure_' + String(edit.section_id || 'misc').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        title: (edit.section_id ? String(edit.section_id).toUpperCase().replace(/_/g, ' ') : 'GAP CLOSURE'),
        loc: 'main',
        on: true,
        type: 'text',
        content: String(edit.preview || '').trim(),
      };
      bundle[doc].push(newSection);
      title = newSection.title;
    }

    if (!writeSectionsBundle(bundle)) return { ok: false, error: 'Failed to save sections.' };
    pushUndo(doc.toUpperCase() + ' . ' + title, snapshot);
    fireSectionsUpdated('gap-closure-342', { doc: doc, section: title });
    return { ok: true, doc: doc, sectionTitle: title };
  }

  function undoLast() {
    var entry = popUndo();
    if (!entry || !entry.sections) return null;
    if (!writeSectionsBundle(entry.sections)) return null;
    fireSectionsUpdated('gap-closure-342-undo', { restored: entry.label });
    return entry;
  }

  // --- modal augmentation ---
  // The recheck-fit modal renders edit cards as .antcv-rf-edit with a head
  // (.antcv-rf-edit-head holding a badge + section id) and an actions row
  // (.antcv-rf-edit-actions with the copy button). We add Apply + Undo to
  // that actions row, once per card.
  function readEditMeta(card) {
    var badge = card.querySelector('.antcv-rf-edit-badge');
    var doc = badge && /cl/i.test(badge.className) ? 'cl' : 'cv';
    var head = card.querySelector('.antcv-rf-edit-head');
    var sectionId = '';
    var changeType = 'reword';
    if (head) {
      var txt = (head.textContent || '').replace(/\s+/g, ' ').trim();
      txt = txt.replace(/^(cv|cl)\s+/i, '');
      var parts = txt.split('\u00b7');
      sectionId = (parts[0] || '').trim();
      if (parts[1]) changeType = parts[1].trim().toLowerCase();
    }
    var prevEl = card.querySelector('.antcv-rf-edit-preview');
    var preview = prevEl ? (prevEl.textContent || '').trim() : '';
    return { doc: doc, section_id: sectionId, change_type: changeType, preview: preview };
  }

  function markGapClosed(modalRoot, edit, sectionTitle) {
    // Gaps render as .antcv-rf-col.gaps li with a <b> holding the missing
    // skill. We can't map an edit to a gap deterministically, so match on
    // section id / missing-skill keyword overlap. Best-effort: if the edit's
    // preview or section id shares a salient token with a gap's text, flip
    // that gap green with a check.
    var gaps = modalRoot.querySelectorAll('.antcv-rf-col.gaps li');
    var needle = (edit.section_id + ' ' + edit.preview).toLowerCase();
    for (var i = 0; i < gaps.length; i++) {
      var li = gaps[i];
      if (li.getAttribute('data-antcv-gap-closed') === '1') continue;
      var gt = (li.textContent || '').toLowerCase();
      var bold = li.querySelector('b');
      var key = bold ? (bold.textContent || '').toLowerCase().trim() : '';
      var hit = false;
      if (key && needle.indexOf(key.split(/\s+/)[0]) >= 0) hit = true;
      if (!hit && gt && needle.indexOf(gt.slice(0, 12)) >= 0) hit = true;
      if (hit) {
        li.setAttribute('data-antcv-gap-closed', '1');
        li.style.color = BRAND.okText;
        li.style.fontWeight = '600';
        if (!li.querySelector('[data-antcv-gap-check]')) {
          var chk = document.createElement('span');
          chk.setAttribute('data-antcv-gap-check', '1');
          chk.textContent = ' \u2713';
          chk.style.color = BRAND.okText;
          chk.title = 'Closed -> ' + (sectionTitle || '');
          li.appendChild(chk);
        }
        break; // one gap per applied edit
      }
    }
  }

  function augmentCard(card, modalRoot) {
    if (card.getAttribute('data-antcv-gap-closure-342') === '1') return;
    card.setAttribute('data-antcv-gap-closure-342', '1');
    var actions = card.querySelector('.antcv-rf-edit-actions');
    if (!actions) return;

    var status = document.createElement('span');
    status.style.cssText = 'font-size:10px;font-weight:700;margin-left:4px;';

    var applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = 'Apply to section';
    applyBtn.style.cssText =
      'font-size:11px;font-weight:700;padding:4px 10px;border:none;border-radius:4px;' +
      'cursor:pointer;background:' + BRAND.teal + ';color:' + BRAND.white + ';';

    var undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = 'Undo';
    undoBtn.style.cssText =
      'font-size:11px;font-weight:700;padding:4px 10px;border:1px solid ' + BRAND.navy + ';' +
      'border-radius:4px;cursor:pointer;background:' + BRAND.white + ';color:' + BRAND.navy + ';display:none;';

    applyBtn.addEventListener('click', function () {
      var edit = readEditMeta(card);
      if (!edit.preview) { status.textContent = 'x no preview text'; status.style.color = BRAND.danger; return; }
      var res = closeGapWithEdit(edit);
      if (!res.ok) { status.textContent = 'x ' + res.error; status.style.color = BRAND.danger; return; }
      card.style.background = BRAND.okBg;
      card.style.borderColor = BRAND.okBorder;
      applyBtn.textContent = '\u2713 Applied -> ' + res.sectionTitle;
      applyBtn.disabled = true;
      applyBtn.style.background = BRAND.okText;
      undoBtn.style.display = '';
      status.textContent = '';
      markGapClosed(modalRoot, edit, res.sectionTitle);
    });

    undoBtn.addEventListener('click', function () {
      var entry = undoLast();
      if (!entry) { status.textContent = 'x nothing to undo'; status.style.color = BRAND.danger; return; }
      card.style.background = '';
      card.style.borderColor = '';
      applyBtn.textContent = 'Apply to section';
      applyBtn.disabled = false;
      applyBtn.style.background = BRAND.teal;
      undoBtn.style.display = 'none';
      var gaps = modalRoot.querySelectorAll('.antcv-rf-col.gaps li[data-antcv-gap-closed="1"]');
      for (var i = 0; i < gaps.length; i++) {
        var li = gaps[i];
        li.removeAttribute('data-antcv-gap-closed');
        li.style.color = '';
        li.style.fontWeight = '';
        var chk = li.querySelector('[data-antcv-gap-check]');
        if (chk) chk.remove();
      }
      status.textContent = 'restored';
      status.style.color = BRAND.muted;
      setTimeout(function () { status.textContent = ''; }, 1800);
    });

    actions.appendChild(applyBtn);
    actions.appendChild(undoBtn);
    actions.appendChild(status);
  }

  function sweepModal() {
    var modal = document.getElementById('antcv-recheck-fit-modal');
    if (!modal) return;
    var cards = modal.querySelectorAll('.antcv-rf-edit');
    for (var i = 0; i < cards.length; i++) {
      try { augmentCard(cards[i], modal); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; try { sweepModal(); } catch (_) {} });
  }

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}
  schedule();
  [200, 600, 1500].forEach(function (d) { setTimeout(schedule, d); });

  window.AntcvGapClosure342 = {
    version: SCRIPT_VERSION,
    closeGapWithEdit: closeGapWithEdit,
    undoLast: undoLast,
    sweep: sweepModal,
  };

  try { console.debug('[gap-closure-342] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
