/* antcv-export-content-gate.js — EXPORT-CONTENT-GATE-001 (owner 2026-11-01)
 * ============================================================================
 * THE BUG (D1 application 3525, ASSA ABLOY): the exported letter was the unfilled
 * template ("Dear [Hiring Team / Name]", "[NO-JD RULE (whole letter) …" instructions),
 * and 3524 (Ambu) exported the Terma letter. placeholderGate in antcv-docx-client.js
 * only asked confirm(), and only for some CL ids; every export button also FALLS BACK
 * (browser print / inline DOCX) when the worker call throws, so a refusal there never
 * stopped the file.
 *
 * THIS GATE hard-blocks an export when:
 *   CL_TEMPLATE   a visible CL section holds a template placeholder or instruction text
 *   CV_TEMPLATE   a visible CV section does
 *   CL_NO_COMPANY the letter of a targeted application never names the company
 *   CV_UNSOL_PROFILE the CV profile opens with the unsolicited "IT professional" line
 *                 on a targeted, non-IT role (the 3525 profile)
 *   STALE_OWNER   the content was written for another application (APP-CONTENT-OWNER-001)
 * It runs in the capture phase on window, before React's handlers, for the app's PDF and
 * DOCX buttons and the export-preview modal's Save buttons; antcv-docx-client.js calls
 * checkPayload() as the backstop for every other caller. Markdown links
 * ("[Google Scholar](https://…)") are not placeholders.
 * Kill switch: localStorage['antcv:disable-export-content-gate'] = '1'.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.5242';

  var MD_LINK = /\[[^\]\n]{1,200}\]\((?:https?:|mailto:)[^)\s]*\)/g;
  var BENIGN = /^\s*(verify|sic|x|\d{1,3}|…|\.\.\.)\s*$/i;
  // Skeleton instruction text (TEMPLATE-STRUCT-DEFAULT-001 / me()) — also caught when a
  // sidecar has stripped the brackets around it.
  var INSTRUCTION = /(NO-JD RULE|\bEVIDENCE:\s|\bCLOSING\s*-\s*connect|ADAPT-WITH-THE-TEAM|ONLY when candidate-confirmed|Identity tied to the role|Write in the target language|Real proof points only|Never invent a number|Use Company Info|Professional identity|Employer priority \d|Focus area \d|Strategic expertise -|short label\b)/i;

  function CM() { return root && root.AntcvCompanyMatch; }
  function snip(s) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > 70 ? s.slice(0, 67) + '…' : s; }

  // Template hits in one string.
  function templateHits(s) {
    var t = String(s == null ? '' : s).replace(MD_LINK, ' ');
    var out = [];
    var m, re = /\[([^\[\]]{2,600})\]/g;
    while ((m = re.exec(t))) { if (!BENIGN.test(m[1])) out.push('[' + snip(m[1]) + ']'); }
    var ins = t.match(INSTRUCTION);
    if (ins && !out.length) out.push(snip(t.slice(Math.max(0, ins.index - 10), ins.index + 60)));
    return out;
  }
  function isTemplateText(s) { return templateHits(s).length > 0; }

  // Every visible string of a section (honours on:false, hidden maps, bOff/tOff).
  function eachString(sec, cb) {
    if (!sec || typeof sec !== 'object' || sec.on === false) return;
    var hid = (sec.hidden && typeof sec.hidden === 'object') ? sec.hidden : {};
    function obj(it) {
      if (it == null) return;
      if (typeof it === 'string') { cb(it); return; }
      if (typeof it !== 'object' || it.hidden === true) return;
      if (!it.bOff && typeof it.b === 'string') cb(it.b);
      if (!it.tOff && typeof it.t === 'string') cb(it.t);
      ['content', 'l', 'v', 'deg', 'sch', 'title', 'company', 'hands_on', 'professionally'].forEach(function (k) { if (typeof it[k] === 'string') cb(it[k]); });
      if (Array.isArray(it.bullets)) it.bullets.forEach(obj);
    }
    if (typeof sec.content === 'string') cb(sec.content);
    ['hands_on', 'professionally'].forEach(function (k) { if (typeof sec[k] === 'string') cb(sec[k]); });
    if (Array.isArray(sec.items)) sec.items.forEach(function (it, i) { if (!hid[i]) obj(it); });
    if (Array.isArray(sec.rows)) sec.rows.forEach(function (r, i) {
      if (hid[i]) return;
      if (Array.isArray(r)) r.forEach(function (c) { if (typeof c === 'string') cb(c); });
    });
    if (Array.isArray(sec.roles)) sec.roles.forEach(function (r) {
      if (!r || r.on === false || r.hidden === true) return;
      ['title', 'company', 'summary', 'results'].forEach(function (k) { if (typeof r[k] === 'string') cb(r[k]); });
      if (Array.isArray(r.bullets)) r.bullets.forEach(obj);
    });
  }
  function sectionHits(sec) {
    var out = [];
    eachString(sec, function (s) { templateHits(s).forEach(function (h) { out.push(h); }); });
    return out;
  }
  function docText(list) {
    var parts = [];
    (list || []).forEach(function (s) { eachString(s, function (x) { parts.push(x); }); });
    return parts.join(' ');
  }

  // The unsolicited kernel opener (profile_structure.who_i_am.unsolicited).
  var UNSOL_OPENER = /^\s*(?:I am an?\s+)?IT\s+(?:professional|specialist)\b/i;
  var IT_ROLE = /\b(IT|ICT|software|developer|devops|data|cloud|digital|infrastructure|sysadmin|system administrator|SAP|ERP|cyber)\b/i;

  function listFor(sections, d) {
    if (Array.isArray(sections)) return sections;
    return (sections && Array.isArray(sections[d])) ? sections[d] : [];
  }

  // Pure check. opts: { sections:{cv,cl}|list, doc:'cv'|'cl'|'both', meta:{company,role}, owner: verdict|null }
  function check(opts) {
    opts = opts || {};
    var meta = opts.meta || {};
    var doc = opts.doc === 'cl' || opts.doc === 'cv' ? opts.doc : 'both';
    var docs = doc === 'both' ? ['cv', 'cl'] : [doc];
    var cm = CM();
    var company = String(meta.company || '').trim();
    var targeted = cm ? cm.isTargeted(company) : !!company;
    var reasons = [];
    docs.forEach(function (d) {
      var list = listFor(opts.sections, d);
      var hits = [];
      list.forEach(function (s) { sectionHits(s).forEach(function (h) { hits.push((s.id || '?') + ': ' + h); }); });
      if (hits.length) reasons.push({ code: d === 'cl' ? 'CL_TEMPLATE' : 'CV_TEMPLATE', doc: d, detail: hits.slice(0, 4), count: hits.length });
      if (d === 'cl' && targeted && cm && !cm.names(docText(list), company)) {
        reasons.push({ code: 'CL_NO_COMPANY', doc: d, detail: [company] });
      }
      if (d === 'cv' && targeted) {
        var prof = list.filter(function (s) { return s && s.id === 'profile'; })[0];
        var pt = prof ? docText([prof]) : '';
        if (UNSOL_OPENER.test(pt) && !IT_ROLE.test(String(meta.role || ''))) {
          reasons.push({ code: 'CV_UNSOL_PROFILE', doc: d, detail: [snip(pt)] });
        }
      }
    });
    if (opts.owner) reasons.push({ code: 'STALE_OWNER', doc: doc, owner: opts.owner.owner, current: opts.owner.current, detail: opts.owner.foreign || [] });
    return { ok: reasons.length === 0, reasons: reasons };
  }

  function label(a) { a = a || {}; return [a.company, a.role].filter(Boolean).join(' — ') || '(no application)'; }
  function describe(r) {
    switch (r.code) {
      case 'CL_TEMPLATE': return 'The cover letter still holds template text (' + r.count + ' place(s), e.g. ' + r.detail[0] + '). Generation did not complete.';
      case 'CV_TEMPLATE': return 'The CV still holds template text (' + r.count + ' place(s), e.g. ' + r.detail[0] + '). Generation did not complete.';
      case 'CL_NO_COMPANY': return 'The cover letter never names ' + r.detail[0] + '. It was written for another application or not generated.';
      case 'CV_UNSOL_PROFILE': return 'The CV profile uses the unsolicited opener ("' + r.detail[0] + '") for a targeted role. Generate for this job.';
      case 'STALE_OWNER': return 'This content was written for ' + label(r.owner) + ', not ' + label(r.current) + '.';
      default: return r.code;
    }
  }
  function message(res) {
    return 'Export blocked.\n\n' + res.reasons.map(function (r) { return '• ' + describe(r); }).join('\n') +
      '\n\nGenerate for this application, then export again.';
  }

  // ── storage-backed side ──────────────────────────────────────────────────
  function rd(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function disabled() { try { return root.localStorage.getItem('antcv:disable-export-content-gate') === '1'; } catch (_) { return false; } }
  function ownerVerdict(doc) {
    try { var o = root.AntcvAppContentOwner; return (o && typeof o.currentVerdict === 'function') ? o.currentVerdict(doc) : null; } catch (_) { return null; }
  }
  function activeDoc() {
    try { if (typeof root.AntcvGetDoc === 'function') { var d = String(root.AntcvGetDoc() || '').toLowerCase(); if (d === 'cv' || d === 'cl') return d; } } catch (_) {}
    try {
      var raw = root.localStorage.getItem('doc') || 'cv';
      try { var p = JSON.parse(raw); if (typeof p === 'string') raw = p; } catch (_) {}
      return String(raw).toLowerCase() === 'cl' ? 'cl' : 'cv';
    } catch (_) { return 'cv'; }
  }
  function checkStored(doc) {
    return check({ sections: rd('sections') || {}, meta: rd('meta') || {}, doc: doc, owner: ownerVerdict(doc) });
  }
  // Backstop for antcv-docx-client buildPayload output: payload.sections = the doc's list.
  function checkPayload(payload) {
    payload = payload || {};
    var doc = payload.doc === 'cl' ? 'cl' : 'cv';
    if (/template/i.test(String(payload.filename || ''))) return { ok: true, reasons: [] };   // blank template downloads
    var m = rd('meta') || {};
    var meta = { company: (payload.meta && payload.meta.company) || m.company || '', role: m.role || (payload.meta && payload.meta.role) || '' };
    var secs = {}; secs[doc] = payload.sections || [];
    return check({ sections: secs, meta: meta, doc: doc, owner: ownerVerdict(doc) });
  }

  var MODAL_ID = 'antcv-export-content-gate-modal';
  function showBlock(res) {
    var d = root.document;
    if (!d || !d.body) { try { root.alert(message(res)); } catch (_) {} return; }
    var old = d.getElementById(MODAL_ID); if (old) old.remove();
    var wrap = d.createElement('div');
    wrap.id = MODAL_ID;
    wrap.setAttribute('role', 'alertdialog');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9100';
    var box = d.createElement('div');
    box.style.cssText = 'background:#fff;color:#1f2937;max-width:min(560px,92vw);border-radius:12px;padding:18px 20px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3)';
    var h = d.createElement('div'); h.style.cssText = 'font-weight:700;font-size:16px;margin-bottom:8px;color:#7a1d1d'; h.textContent = 'Export blocked';
    box.appendChild(h);
    var ul = d.createElement('ul'); ul.style.cssText = 'margin:0 0 10px 18px;padding:0';
    res.reasons.forEach(function (r) { var li = d.createElement('li'); li.textContent = describe(r); ul.appendChild(li); });
    box.appendChild(ul);
    var p = d.createElement('div'); p.textContent = 'Generate for this application, then export again.'; box.appendChild(p);
    var row = d.createElement('div'); row.style.cssText = 'margin-top:14px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
    var stale = res.reasons.filter(function (r) { return r.code === 'STALE_OWNER'; })[0];
    if (stale && res.reasons.length === 1 && root.AntcvAppContentOwner) {
      var keep = d.createElement('button'); keep.type = 'button';
      keep.textContent = 'The content is for ' + (stale.current.company || 'this application') + ' — keep it';
      keep.style.cssText = 'padding:7px 12px;border-radius:8px;border:1px solid #7a1d1d;background:#fff;color:#7a1d1d;cursor:pointer';
      keep.addEventListener('click', function () { try { root.AntcvAppContentOwner.stamp('kept by user'); } catch (_) {} wrap.remove(); });
      row.appendChild(keep);
    }
    var close = d.createElement('button'); close.type = 'button'; close.textContent = 'Close';
    close.style.cssText = 'padding:7px 14px;border-radius:8px;border:none;background:#7a1d1d;color:#fff;cursor:pointer';
    close.addEventListener('click', function () { wrap.remove(); });
    row.appendChild(close); box.appendChild(row); wrap.appendChild(box);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
    d.body.appendChild(wrap);
    try { console.warn('[export-gate] EXPORT-CONTENT-GATE-001 blocked:', res.reasons.map(function (r) { return r.code; }).join(', ')); } catch (_) {}
  }

  // Capture-phase interception of every export entry point.
  function exportDocFor(btn) {
    var title = String(btn.getAttribute('title') || '');
    if (/^Export as PDF/.test(title) || /^Export as \.docx/.test(title)) return activeDoc();
    if (btn.id === 'antcv-pdf-preview-modal-print' || btn.id === 'antcv-pdf-preview-modal-docx') return activeDoc();
    return null;
  }
  function onClick(e) {
    try {
      if (disabled()) return;
      var t = e.target;
      var btn = t && t.closest ? t.closest('button') : null;
      if (!btn) return;
      var doc = exportDocFor(btn);
      if (!doc) return;
      var res = checkStored(doc);
      if (res.ok) return;
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      showBlock(res);
    } catch (_) { /* a detector error never blocks */ }
  }

  var API = {
    version: VERSION, check: check, checkStored: checkStored, checkPayload: checkPayload,
    templateHits: templateHits, isTemplateText: isTemplateText, message: message, describe: describe, showBlock: showBlock
  };
  if (root) root.AntcvExportContentGate = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else if (root && root.addEventListener && root.__antcvExportContentGate !== VERSION) {
    root.__antcvExportContentGate = VERSION;
    root.addEventListener('click', onClick, true);
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
