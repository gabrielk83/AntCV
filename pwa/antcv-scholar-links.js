/* antcv-scholar-links.js — SCHOLAR-LINK-GATE-001 (spec rules 35 + 39, row 28)
 * ============================================================================
 * Kernel v10 carries the canonical Google Scholar profile
 * (personalInfo.publicationsScholar = { label, url, renderAsHyperlink,
 * showWhenJDContainsAny:[research terms…] }, plus the bare personalInfo
 * .googleScholar URL). Rule 35: wherever a Scholar pointer is SHOWN it must be
 * a real HYPERLINK (plain "Details available via Google Scholar" text is a
 * defect). Rule 39: the link is JD-CLASS-gated — prominent in research-heavy
 * positions, not for cleanroom/fabrication work.
 *
 * The render vehicle already exists end-to-end: the publications section's
 * masterSite = {on,label,url} renders as an <a> in the preview
 * (PUB-MASTERSITE-001) and as a real ExternalHyperlink in the worker; the
 * docx-client forwards it since PUB-MASTERSITE-EXPORT-001 (1.51.122). This
 * sidecar is the deterministic GATE that drives it from the kernel:
 *
 *  - research gate PASSES (a showWhenJDContainsAny term in antcv:lastJdText;
 *    unsolicited/no-JD = FAIL — "not prominent" is the default):
 *    masterSite absent -> create {on:true,label,url,_src:'kernel-gate',_gate:'on'}.
 *    our own row disabled by a previous gate-fail (_gate:'off') -> re-enable.
 *  - gate FAILS: our own row (_src:'kernel-gate') on -> {on:false,_gate:'off'}.
 *  - a USER-owned masterSite (no _src) is NEVER touched; a user turning OUR
 *    row off (on:false while _gate:'on') is respected forever.
 *  - RULE-35 REPAIR regardless of the gate: a publications ITEM that is a bare
 *    Scholar pointer line (mentions Google Scholar, no markdown link, short)
 *    is hidden via the section hidden map and masterSite switches on in its
 *    place — the shown pointer becomes a real link.
 *
 * Per-application by construction (sections storage). Write-only-on-change,
 * own event tagged, setTimeout debounce (never rAF — STICKY-LEAK-005).
 * Kill: localStorage['antcv:disable-scholar-links']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.122-scholar-link-gate';
  if (window.__antcvScholarLinks) return;
  window.__antcvScholarLinks = VERSION;

  var SRC = 'scholar-links';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-scholar-links'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }

  function kernelScholar() {
    var p = readJson('personalInfo', {}) || {};
    p = p.personalInfo || p;
    var ps = (p.publicationsScholar && typeof p.publicationsScholar === 'object') ? p.publicationsScholar : {};
    var url = String(ps.url || p.googleScholar || '').trim();
    if (!/^https?:\/\//i.test(url)) return null;
    return {
      url: url,
      label: String(ps.label || 'Full publication record via Google Scholar'),
      terms: Array.isArray(ps.showWhenJDContainsAny) ? ps.showWhenJDContainsAny : [],
    };
  }

  function gatePasses(terms) {
    var jd = '';
    try { jd = String(localStorage.getItem('antcv:lastJdText') || '').toLowerCase(); } catch (_) {}
    if (!jd.trim() || !terms.length) return false;
    return terms.some(function (t) { return t && jd.indexOf(String(t).toLowerCase()) !== -1; });
  }

  function isPubsSection(sec) {
    if (!sec || sec.on === false) return false;
    var id = String(sec.id || '').toLowerCase();
    if (id === 'pubs' || id === 'publications') return true;
    return /publication/i.test(String(sec.title || ''));
  }

  // A bare Scholar-pointer line: mentions Google Scholar, carries no markdown
  // link, and is a pointer (short), not a citation (no journal/year chain).
  function isPlainScholarPointer(text) {
    var t = String(text || '');
    if (!/google scholar/i.test(t)) return false;
    if (t.indexOf('](') !== -1) return false;
    return t.length <= 100;
  }

  function apply() {
    if (disabled()) return;
    try {
      var kernel = kernelScholar();
      if (!kernel) return;
      var b = readJson('sections', null);
      if (!b || !Array.isArray(b.cv)) return;
      var pass = gatePasses(kernel.terms);
      var changed = false;
      b.cv.forEach(function (sec) {
        if (!isPubsSection(sec)) return;
        var ms = (sec.masterSite && typeof sec.masterSite === 'object') ? sec.masterSite : null;
        var ours = !!(ms && ms._src === 'kernel-gate');
        var forceOn = false;
        // RULE-35 REPAIR: hide a plain pointer item; the masterSite link replaces it.
        if (Array.isArray(sec.items)) {
          var hidden = (sec.hidden && typeof sec.hidden === 'object') ? sec.hidden : null;
          sec.items.forEach(function (it, i) {
            if (hidden && hidden[i]) return;
            var text = typeof it === 'string' ? it : String((it && (it.text || it.title || it.name)) || '');
            if (!isPlainScholarPointer(text)) return;
            if (!hidden) hidden = {};
            hidden[i] = true;
            forceOn = true;
            changed = true;
          });
          if (hidden) sec.hidden = hidden;
        }
        if (forceOn) {
          // the pointer WAS shown -> it must be a link now, gate or no gate
          if (!ms || ours) {
            sec.masterSite = { on: true, label: kernel.label, url: kernel.url, _src: 'kernel-gate', _gate: 'on' };
            changed = true;
          } else if (!ms.on) {
            // user-owned but off while a pointer was shown: leave the user's
            // object alone — the hidden pointer item alone satisfies rule 39.
          }
          return;
        }
        if (pass) {
          if (!ms) {
            sec.masterSite = { on: true, label: kernel.label, url: kernel.url, _src: 'kernel-gate', _gate: 'on' };
            changed = true;
          } else if (ours && ms.on === false && ms._gate === 'off') {
            sec.masterSite = { on: true, label: ms.label || kernel.label, url: ms.url || kernel.url, _src: 'kernel-gate', _gate: 'on' };
            changed = true;
          }
          // ours && on -> already right; ours && on===false && _gate==='on' ->
          // the USER turned it off — respected forever. User-owned -> never touch.
        } else if (ours && ms.on) {
          sec.masterSite = { on: false, label: ms.label, url: ms.url, _src: 'kernel-gate', _gate: 'off' };
          changed = true;
        }
      });
      if (changed) {
        try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
        try { console.log('[scholar-links] publications masterSite ' + (pass ? 'enabled' : 'updated') + ' (research gate ' + (pass ? 'PASS' : 'fail') + ')'); } catch (_) {}
      }
    } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { apply(); } catch (_) {} }, 300); }

  [1100, 2800, 5500].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'personalInfo' || e.key === 'antcv:lastJdText' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 6000);

  window.AntcvScholarLinks = { version: VERSION, _apply: apply, _gatePasses: gatePasses, _isPlainScholarPointer: isPlainScholarPointer, _kernelScholar: kernelScholar };
})();
