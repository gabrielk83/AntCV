/* antcv-application-line-001.js — HEADER-APP-LINE-001 (owner 2026-07-22)
 * ============================================================================
 * Owner: "switching between applications keeps the old application slogan,
 * specialization is Processes • Products • People, and the app line is still not
 * under the header and slogan."
 *
 * Root cause (diagnosed live): the header subtitle is the GLOBAL
 * personalInfo.specialization ("Processes • Products • People"), identical on
 * every application, so it never changes on switch; and there is no PER-APP
 * "Application for [Role] at [Company]" line under the header + slogan. The CL
 * slogan reset (SLOGAN-LOAD-SYMMETRIC-001) is already deployed and works — the
 * "sticky slogan" the owner saw is this generic specialization, not the tagline.
 *
 * This sidecar renders the per-app APPLICATION LINE — "Application for [Role] at
 * [Company]" — directly UNDER the header band (and under the slogan when a CL
 * slogan is present), on BOTH the CV and the CL preview papers. Additive, keyed
 * off the header CONTACT band (a stable marker: it carries the email + phone) so
 * it survives the actively-churning header render without touching app.js.
 * Per-app text is read from localStorage `meta`; an unsolicited / empty app
 * renders nothing.
 *
 * Kill switch: localStorage['antcv:disable-application-line'] = '1'.
 * NOTE (owner): this is the PREVIEW surface. Export parity (docx-worker header)
 * is a separate change — see HEADER-APP-LINE-001 in the registers.
 */
(function () {
  'use strict';

  var VERSION = '1.51.2440-application-line';
  if (window.__antcvApplicationLine === VERSION) return;
  window.__antcvApplicationLine = VERSION;

  var MARK = 'data-antcv-app-line';

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-application-line'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function curLang() {
    try { return String(get('language', 'en')).replace(/["']/g, '').toLowerCase().slice(0, 2) || 'en'; }
    catch (_) { return 'en'; }
  }
  function unsol(co) {
    try { return !!(co && window.__antcvUnsol && window.__antcvUnsol(co)); } catch (_) { return false; }
  }

  // The per-app application line text, or '' when there is nothing targeted to say
  // (empty meta, or an unsolicited application — which keeps its generic standing).
  function appLineText() {
    var meta = {};
    try { meta = JSON.parse(get('meta', '{}')) || {}; } catch (_) { meta = {}; }
    var role = String(meta.role || '').trim();
    var company = String(meta.company || '').trim();
    if (!role && !company) return '';
    if (unsol(company)) return '';
    var lang = curLang();
    // Localised connective; role/company are the candidate's own strings, kept verbatim.
    var forW = { en: 'Application for', da: 'Ansøgning til', es: 'Candidatura para', zh: '申请职位', he: 'מועמדות לתפקיד', am: 'ማመልከቻ ለ', ar: 'التقدم لوظيفة' }[lang] || 'Application for';
    var atW = { en: 'at', da: 'hos', es: 'en', zh: '·', he: 'ב', am: 'በ', ar: 'في' }[lang] || 'at';
    var t = role ? forW + ' ' + role : '';
    if (company) t = t ? (t + ' ' + atW + ' ' + company) : (forW + ' ' + company);
    return t.trim();
  }

  // A header CONTACT band: the header-level element that carries the candidate's
  // contact line (email + phone). Robust marker — present on both CV and CL, and
  // not tied to a churning class name.
  function contactBand(paper) {
    var email = '';
    try { var pi = JSON.parse(get('personalInfo', '{}')) || {}; pi = pi.personalInfo || pi; email = String(pi.email || '').trim(); } catch (_) {}
    var nodes = paper.querySelectorAll('div');
    var best = null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var t = (n.textContent || '');
      var looksContact = (email && t.indexOf(email) !== -1) || /[☎✉]/.test(t) || /\+\d[\d ]{6,}/.test(t);
      if (!looksContact) continue;
      // want the TIGHTEST such block (fewest descendants) so we insert after the
      // contact line itself, not the whole header wrapper.
      if (!best || n.getElementsByTagName('*').length < best.getElementsByTagName('*').length) best = n;
    }
    return best;
  }

  // A CL slogan element if present (uppercase, letter-spaced, brand-slogan colour).
  // When it exists we place the app line AFTER it ("under the header AND slogan").
  function sloganEl(paper) {
    var ps = paper.querySelectorAll('p,div');
    for (var i = 0; i < ps.length; i++) {
      var e = ps[i];
      if (e.hasAttribute(MARK)) continue;
      var st = '';
      try { st = (e.getAttribute('style') || ''); } catch (_) {}
      if (/letter-spacing\s*:\s*0?\.0?8/.test(st) && /font-weight\s*:\s*(bold|700)/.test(st) && (e.textContent || '').trim()) return e;
    }
    return null;
  }

  function styleFor(anchorAfter) {
    // Centered, small, brand-slogan colour, sitting just below the header.
    return 'margin:2pt 0 8pt;text-align:center;font-family:Calibri,Arial,sans-serif;' +
      'font-size:10.5pt;font-weight:600;letter-spacing:.02em;' +
      'color:var(--brand-slogan-color,var(--header-line-color,#01746E));';
  }

  function apply() {
    if (disabled()) { removeAll(); return; }
    var txt = appLineText();
    var papers = document.querySelectorAll('.antcv-preview-paper');
    for (var i = 0; i < papers.length; i++) {
      var paper = papers[i];
      var existing = paper.querySelector('[' + MARK + ']');
      if (!txt) { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); continue; }
      // Steady-state fast path: the line is already present and correct, so skip
      // the (relatively expensive) anchor scan entirely. A re-mounted paper loses
      // its line (the childList observer + this scan re-inject it), so we never
      // miss a real change — this just keeps the periodic re-check cheap.
      if (existing && existing.textContent === txt) continue;
      // Anchor: after the slogan if present, else after the contact band.
      var anchor = sloganEl(paper) || contactBand(paper);
      if (!anchor) { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); continue; }
      if (existing) {
        // update text / reposition if the anchor moved
        if (existing.textContent !== txt) existing.textContent = txt;
        if (existing.previousSibling !== anchor && anchor.parentNode) anchor.parentNode.insertBefore(existing, anchor.nextSibling);
        continue;
      }
      var el = document.createElement('div');
      el.setAttribute(MARK, '1');
      el.setAttribute('style', styleFor(anchor));
      el.textContent = txt;
      if (anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
    }
  }

  function removeAll() {
    var xs = document.querySelectorAll('[' + MARK + ']');
    for (var i = 0; i < xs.length; i++) { if (xs[i].parentNode) xs[i].parentNode.removeChild(xs[i]); }
  }

  // Perf note (PREVIEW-FREEZE-IS-TEXTALIGN-STORM family): this header is already
  // hammered by ~200 text-align writes/s from other sidecars, so a broad
  // characterData/subtree MutationObserver here would pile onto that storm. We
  // DON'T observe text — we react only to the app's own re-render signal
  // (antcv:sections-updated), a few boot sweeps, and a CHEAP childList-only
  // observer that fires solely when a `.antcv-preview-paper` is added/removed
  // (an app switch / re-mount), then re-applies. apply() is a no-op when the line
  // is already correct, so repeated calls are cheap and self-limiting.
  // DEBOUNCE-STARVATION-001 (live-diagnosed 2026-07-22): a clear-and-reset 250ms
  // debounce here NEVER fired — the header's frequent antcv:sections-updated storm
  // reset the timer faster than it could resolve, so apply() ran only when boot
  // sweeps happened to hit a good moment (usually never). apply() is cheap (a
  // fast-path skips the anchor scan when the line is already correct) and
  // idempotent, so we run it DIRECTLY on a short, NON-resettable timeout — bursts
  // just coalesce into a couple of cheap no-op passes instead of starving to zero.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { apply(); } catch (_) {} }, 120);
  }

  try {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type !== 'childList') continue;
        var hit = false, j;
        for (j = 0; j < m.addedNodes.length && !hit; j++) { var a = m.addedNodes[j]; if (a.nodeType === 1 && (a.classList && a.classList.contains('antcv-preview-paper') || a.querySelector && a.querySelector('.antcv-preview-paper'))) hit = true; }
        for (j = 0; j < m.removedNodes.length && !hit; j++) { var r = m.removedNodes[j]; if (r.nodeType === 1 && (r.classList && r.classList.contains('antcv-preview-paper') || r.querySelector && r.querySelector('.antcv-preview-paper'))) hit = true; }
        if (hit) { schedule(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:language-changed', schedule);
  window.addEventListener('antcv:language-prefs-changed', schedule);
  // The editor boots slowly (~18s) and switching TO the Preview tab shows an
  // already-mounted paper (no childList add fires), so events alone can miss it.
  // A low-frequency re-check guarantees the line appears within a few seconds of
  // the preview being shown. Cheap: apply() early-returns via the steady-state
  // fast path when the line is already correct.
  [400, 1200, 3000, 7000, 12000, 20000].forEach(function (ms) { setTimeout(schedule, ms); });
  // Backstop: React re-renders the paper subtree on state changes and strips our
  // (non-React) node; the antcv:sections-updated listener re-injects right after,
  // and this interval guarantees re-appearance even if that event is missed. The
  // fast path makes the steady-state pass a couple of cheap DOM reads.
  setInterval(schedule, 1500);
  try { window.AntcvApplicationLine = { version: VERSION, _apply: apply, _text: appLineText, _remove: removeAll }; } catch (_) {}
  try { console.debug('[application-line] installed ' + VERSION); } catch (_) {}
})();
