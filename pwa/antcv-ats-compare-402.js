/* AntCV legacy-ATS compare view (v1.50.402)
 * ============================================================
 * EXPORT-PREVIEW-FEATURES-001(d): "modern-ATS vs legacy-ATS compare
 * preview". The legacy tier is an export-palette flag, so it is not
 * renderable by re-running the preview — instead this sidecar renders the
 * LEGACY FLATTENING the way a legacy parser sees the document: single
 * column, Calibri, no photo, canonical section headers, tables flattened
 * to "Focus - Expertise" lines, labeled lists to "Label: value".
 *
 * UI: a "⇄ Legacy ATS view" toggle in the export-preview modal (next to
 * the page chips). Toggling swaps the modal's iframe for the flattened
 * pane and back. Read-only — builds from localStorage['sections'].
 */
(function () {
  'use strict';

  var VERSION = '1.50.402';
  if (window.__antcvAtsCompare === VERSION) return;
  window.__antcvAtsCompare = VERSION;

  var BTN_ID = 'antcv-ats-compare-btn';
  var PANE_ID = 'antcv-ats-compare-pane';

  function clean(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/[\t\n\r ]+/g, ' ').trim(); }

  var CANON = {
    PROFILE: 'Summary', 'CORE COMPETENCIES': 'Skills', 'SELECTED OUTCOMES': 'Achievements',
    'PROFESSIONAL EXPERIENCE': 'Work Experience', EDUCATION: 'Education',
    CERTIFICATIONS: 'Certifications', 'CERTIFICATES & COURSES': 'Certifications',
    'PUBLICATIONS & PATENT': 'Publications', 'ADDITIONAL INFORMATION': 'Additional Information',
  };

  function flattenSections() {
    var lines = [];
    var doc = 'cv';
    try { doc = JSON.parse(localStorage.getItem('doc') || '"cv"') === 'cl' ? 'cl' : 'cv'; } catch (_) {}
    var bundle = {};
    try { bundle = JSON.parse(localStorage.getItem('sections') || '{}') || {}; } catch (_) {}
    var pi = {};
    try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) {}
    if (pi.name) lines.push({ t: 'name', text: clean(pi.name) });
    var contact = [pi.email, pi.phone, pi.linkedin, pi.location].map(clean).filter(Boolean).join(' | ');
    if (contact) lines.push({ t: 'body', text: contact });
    var list = Array.isArray(bundle[doc]) ? bundle[doc] : [];
    list.forEach(function (sec) {
      if (!sec || sec.on === false) return;
      var title = clean(sec.title || '').toUpperCase();
      lines.push({ t: 'head', text: CANON[title] || clean(sec.title || sec.id || '') });
      if (typeof sec.content === 'string' && clean(sec.content)) lines.push({ t: 'body', text: clean(sec.content) });
      if (typeof sec.intro === 'string' && clean(sec.intro)) lines.push({ t: 'body', text: clean(sec.intro) });
      (Array.isArray(sec.items) ? sec.items : []).forEach(function (it) {
        if (it == null) return;
        if (typeof it === 'string') { var s = clean(it); s && lines.push({ t: 'li', text: s }); return; }
        if (it.hidden) return;
        if (it.group !== undefined) { var g = clean(it.group); g && lines.push({ t: 'sub', text: g }); return; }
        var txt = it.l && it.v ? clean(it.l) + ': ' + clean(it.v)
          : it.b || it.t ? [clean(it.b), clean(it.t)].filter(Boolean).join(' ')
          : it.deg || it.sch ? [clean(it.deg), clean(it.sch)].filter(Boolean).join(' - ')
          : clean(it.text || it.value || '');
        txt && lines.push({ t: 'li', text: txt });
      });
      (Array.isArray(sec.roles) ? sec.roles : []).forEach(function (r) {
        if (!r || r.on === false) return;
        lines.push({ t: 'sub', text: [clean(r.title), clean(r.company), clean(r.years)].filter(Boolean).join(' | ') });
        (Array.isArray(r.bullets) ? r.bullets : []).forEach(function (b) {
          var s = typeof b === 'string' ? clean(b) : clean(b && (b.text || b.t));
          s && lines.push({ t: 'li', text: s });
        });
      });
      (Array.isArray(sec.rows) ? sec.rows : []).forEach(function (row, ri) {
        if (!Array.isArray(row) || ri === 0) return; // header row dropped (legacy)
        var s = row.map(clean).filter(Boolean).join(' - ');
        s && lines.push({ t: 'li', text: s });
      });
      if (typeof sec.closing === 'string' && clean(sec.closing)) lines.push({ t: 'body', text: clean(sec.closing) });
      if (typeof sec.hands_on === 'string' && clean(sec.hands_on)) lines.push({ t: 'body', text: 'Hands-on: ' + clean(sec.hands_on) });
      if (typeof sec.professionally === 'string' && clean(sec.professionally)) lines.push({ t: 'body', text: 'Professionally: ' + clean(sec.professionally) });
    });
    return lines;
  }

  function buildPane() {
    var pane = document.createElement('div');
    pane.id = PANE_ID;
    pane.style.cssText = 'position:absolute;inset:0;overflow:auto;background:#ffffff;color:#111;'
      + "font-family:Calibri,Arial,sans-serif;font-size:13px;line-height:1.5;padding:28px 36px;z-index:5;";
    var note = document.createElement('div');
    note.style.cssText = 'font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:6px 10px;margin-bottom:14px;';
    note.textContent = 'Legacy ATS view — how an older parser (Taleo, iCIMS pre-2018, old SuccessFactors) reads this document: single column, no photo, no tables, canonical section names. Compare against the modern preview with the same toggle.';
    pane.appendChild(note);
    flattenSections().forEach(function (l) {
      var el = document.createElement('div');
      if (l.t === 'name') el.style.cssText = 'font-size:19px;font-weight:700;margin-bottom:2px;';
      else if (l.t === 'head') el.style.cssText = 'font-size:14px;font-weight:700;text-transform:uppercase;margin:14px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;';
      else if (l.t === 'sub') el.style.cssText = 'font-weight:700;margin:8px 0 2px;';
      else if (l.t === 'li') { el.style.cssText = 'margin:1px 0 1px 14px;'; l.text = '- ' + l.text; }
      else el.style.cssText = 'margin:2px 0;';
      el.textContent = l.text;
      pane.appendChild(el);
    });
    return pane;
  }

  function toggle() {
    var ifr = document.getElementById('antcv-pdf-preview-modal-iframe');
    if (!ifr || !ifr.parentElement) return;
    var host = ifr.parentElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var pane = document.getElementById(PANE_ID);
    var btn = document.getElementById(BTN_ID);
    if (pane) {
      pane.remove();
      ifr.style.visibility = '';
      if (btn) btn.textContent = '⇄ Legacy ATS view';
      return;
    }
    pane = buildPane();
    host.appendChild(pane);
    ifr.style.visibility = 'hidden';
    if (btn) btn.textContent = '⇄ Modern view';
  }

  function sweep() {
    try {
      var pager = document.getElementById('antcv-pdf-preview-modal-pager');
      if (!pager || document.getElementById(BTN_ID)) return;
      var btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.textContent = '⇄ Legacy ATS view';
      btn.title = 'EXPORT-PREVIEW-FEATURES-001(d): toggle between the modern preview and the flattened single-column rendering a legacy ATS parser sees.';
      btn.style.cssText = 'margin-left:10px;font-size:11px;padding:3px 9px;border-radius:6px;'
        + 'border:1px solid #f59e0b;background:rgba(245,158,11,0.12);color:#92400e;cursor:pointer;';
      btn.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); try { toggle(); } catch (_) {} };
      pager.appendChild(btn);
    } catch (_) {}
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; sweep(); });
  }
  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  schedule();
  [400, 1200, 3000].forEach(function (d) { setTimeout(schedule, d); });

  window.AntcvAtsCompare = { version: VERSION, toggle: toggle, flatten: flattenSections };
  try { console.debug('[ats-compare] installed v' + VERSION); } catch (_) {}
})();
