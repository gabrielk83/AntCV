/* AntCV — CL-HEADER-001 diagnostic probe (read-only)
 * ============================================================
 *
 * Purpose
 * -------
 * Gather the evidence needed to diagnose CL-HEADER-001 without changing
 * anything. The bug: the cover-letter "Application: [Role] - [Company]"
 * header is not editable and renders in the wrong font/colour. The
 * suspected root cause is a desync between the Settings panel
 * Role/Company edit (which may write to a hidden anchor or a different
 * personalInfo key) and the visible editable sentence built by
 * antcv-candidate-preview-editor-341.js.
 *
 * This probe is NOT a fix and is NOT loaded by index.html. It is a
 * console tool. It only reads the DOM and localStorage; it never
 * writes, patches window.fetch, or mutates state.
 *
 * How to run
 * ----------
 * 1. Open the live site, go to the cover-letter Preview where the
 *    "Application: ..." header shows.
 * 2. Open DevTools console, paste this whole file, press Enter.
 * 3. It prints a one-shot SNAPSHOT immediately and stashes it on
 *    window.__clHeaderProbe.last (copy with `copy(window.__clHeaderProbe.last)`).
 * 4. To capture the desync live, run:  __clHeaderProbe.watch()
 *    then edit Role (or Company) in the Settings panel. The probe logs,
 *    on each change, whether personalInfo.role/company updated and
 *    whether the visible sentence text updated. Stop with
 *    __clHeaderProbe.stop().
 * 5. Paste the SNAPSHOT and the WATCH timeline back into the chat.
 */
(function () {
  'use strict';

  var ROLE_KEYS = ['role', 'position', 'jobTitle', 'targetRole'];
  var COMPANY_KEYS = ['company', 'targetCompany', 'employer'];

  function readPI() {
    try {
      var raw = localStorage.getItem('personalInfo');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function pickKeys(obj, keys) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, keys[i])) out[keys[i]] = obj[keys[i]];
    }
    return out;
  }

  function computed(el) {
    if (!el) return null;
    try {
      var cs = window.getComputedStyle(el);
      return {
        color: cs.color,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        fontSize: cs.fontSize,
        display: cs.display,
        letterSpacing: cs.letterSpacing,
      };
    } catch (e) { return null; }
  }

  // Short, stable description of an element for the report.
  function describe(el) {
    if (!el) return null;
    var path = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 5) {
      var seg = node.tagName.toLowerCase();
      if (node.id) seg += '#' + node.id;
      else if (node.className && typeof node.className === 'string') {
        var cls = node.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) seg += '.' + cls;
      }
      path.unshift(seg);
      node = node.parentElement;
      depth++;
    }
    return path.join(' > ');
  }

  function sentenceSpans(host) {
    if (!host) return null;
    var spans = host.querySelectorAll('span');
    var out = [];
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i];
      out.push({
        text: clean(sp.textContent),
        editField: sp.getAttribute('data-antcv-candidate-edit') || null,
        contentEditable: sp.getAttribute('contenteditable') || sp.isContentEditable || false,
      });
    }
    return out;
  }

  // Heuristic search for Settings-panel Role/Company inputs. Read-only:
  // matches by associated <label>, placeholder, aria-label, name, id.
  function findPanelFields() {
    var fields = [];
    var inputs;
    try { inputs = document.querySelectorAll('input, textarea'); }
    catch (e) { return fields; }
    function labelTextFor(el) {
      var bits = [];
      if (el.id) {
        try {
          var lab = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
          if (lab) bits.push(clean(lab.textContent));
        } catch (e) {}
      }
      var wrapLabel = el.closest ? el.closest('label') : null;
      if (wrapLabel) bits.push(clean(wrapLabel.textContent));
      if (el.placeholder) bits.push(el.placeholder);
      if (el.getAttribute('aria-label')) bits.push(el.getAttribute('aria-label'));
      if (el.name) bits.push(el.name);
      if (el.id) bits.push(el.id);
      return bits.join(' | ').toLowerCase();
    }
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var hay = labelTextFor(el);
      var which = null;
      if (/\brole\b|position|job ?title|stilling/.test(hay)) which = 'role';
      else if (/\bcompany\b|employer|organi[sz]ation|virksomhed/.test(hay)) which = 'company';
      if (which) {
        fields.push({
          which: which,
          match: hay.slice(0, 120),
          value: clean(el.value),
          selector: describe(el),
        });
      }
    }
    return fields;
  }

  function snapshot() {
    var pi = readPI();
    var hosts = [];
    try {
      var found = document.querySelectorAll('[data-antcv-candidate-application-sentence="1"]');
      for (var i = 0; i < found.length; i++) {
        var h = found[i];
        hosts.push({
          selector: describe(h),
          text: clean(h.textContent),
          hasRolePlaceholder: /\[Role\]/.test(h.textContent || ''),
          hasCompanyPlaceholder: /\[Company\]/.test(h.textContent || ''),
          computed: computed(h),
          spans: sentenceSpans(h),
        });
      }
    } catch (e) {}

    var hiddenAnchors = [];
    try {
      var anchors = document.querySelectorAll('[data-antcv-candidate-anchor-hidden="1"]');
      for (var j = 0; j < anchors.length; j++) {
        hiddenAnchors.push({
          selector: describe(anchors[j]),
          text: clean(anchors[j].textContent),
          display: (computed(anchors[j]) || {}).display,
        });
      }
    } catch (e) {}

    var nameLeaf = null;
    try { nameLeaf = document.querySelector('[data-antcv-candidate-edit="name"]'); } catch (e) {}

    var report = {
      when: new Date().toISOString(),
      url: location.href,
      personalInfo: {
        present: !!pi,
        roleKeys: pickKeys(pi, ROLE_KEYS),
        companyKeys: pickKeys(pi, COMPANY_KEYS),
        applicationLabel: pi ? pi.applicationLabel : undefined,
      },
      visibleSentenceHosts: hosts,
      hiddenAnchors: hiddenAnchors,
      nameLeaf: nameLeaf ? { text: clean(nameLeaf.textContent), computed: computed(nameLeaf) } : null,
      panelFields: findPanelFields(),
      editorSidecar: (function () {
        var e = window.AntcvCandidatePreviewEditor341;
        return e ? { present: true, version: e.version } : { present: false };
      })(),
    };

    window.__clHeaderProbe.last = report;
    try {
      console.groupCollapsed('%c[CL-HEADER-001 probe] snapshot', 'color:#0a7;font-weight:bold');
      console.log('personalInfo role keys:', report.personalInfo.roleKeys);
      console.log('personalInfo company keys:', report.personalInfo.companyKeys);
      console.log('applicationLabel:', report.personalInfo.applicationLabel);
      console.log('visible sentence hosts (' + hosts.length + '):', hosts);
      console.log('hidden anchors (' + hiddenAnchors.length + '):', hiddenAnchors);
      console.log('name leaf (style baseline):', report.nameLeaf);
      console.log('panel Role/Company fields:', report.panelFields);
      console.log('editor sidecar:', report.editorSidecar);
      console.log('Full object on window.__clHeaderProbe.last  (run `copy(__clHeaderProbe.last)`)');
      console.groupEnd();
    } catch (e) { console.log(report); }
    return report;
  }

  // Live watch: poll personalInfo + visible sentence and log diffs so the
  // user can attribute a panel edit to a storage write and/or a render.
  var timer = null;
  var prev = null;

  function fingerprint() {
    var pi = readPI() || {};
    var host = null;
    try { host = document.querySelector('[data-antcv-candidate-application-sentence="1"]'); } catch (e) {}
    return {
      piRole: pi.role, piPosition: pi.position, piJobTitle: pi.jobTitle, piTargetRole: pi.targetRole,
      piCompany: pi.company, piTargetCompany: pi.targetCompany, piEmployer: pi.employer,
      sentence: host ? clean(host.textContent) : '(no host)',
    };
  }

  function watch(intervalMs) {
    if (timer) { console.log('[CL-HEADER-001 probe] already watching'); return; }
    prev = fingerprint();
    console.log('%c[CL-HEADER-001 probe] watching. Edit Role/Company in the panel now. Stop with __clHeaderProbe.stop()', 'color:#a60');
    console.log('baseline:', prev);
    timer = setInterval(function () {
      var cur = fingerprint();
      var changes = {};
      var any = false;
      for (var k in cur) {
        if (cur[k] !== prev[k]) { changes[k] = { from: prev[k], to: cur[k] }; any = true; }
      }
      if (any) {
        console.log('%c[CL-HEADER-001 probe] change @ ' + new Date().toLocaleTimeString(), 'color:#06c', changes);
        prev = cur;
      }
    }, intervalMs || 400);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; console.log('[CL-HEADER-001 probe] stopped'); }
  }

  window.__clHeaderProbe = {
    version: '1.0.0',
    snapshot: snapshot,
    watch: watch,
    stop: stop,
    last: null,
  };

  snapshot();
})();
