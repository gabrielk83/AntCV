/* antcv-role-positioning-guard.js — ENVELOPE-PRECEDENCE-001 / ROLE-SUBTITLE-001 /
 * TOOLS-RELEVANCE-001 (owner 2026-11-01, D1 3525 ASSA ABLOY "Product Manager")
 * ============================================================================
 * Three role-positioning rules, one sidecar:
 *
 * 1. ENVELOPE-PRECEDENCE-001. The Job Tracker hands generation a supporting_context
 *    that opens "TARGET-ROLE GUIDELINES (Dream Envelope):" (title band "Technical
 *    Product Manager / AI Workflow", salary, mobility), and app.js passes it as
 *    "PRIOR RUN CONTEXT … do not contradict them". The model took the envelope title
 *    as the candidate's identity: the Product Manager CV opened "IT professional with
 *    15+ years". window.__antcvEnvelopePrecedence(sc) relabels that block as
 *    CALIBRATION ONLY and puts a precedence rule first: the JD's role family sets the
 *    profile identity, subtitle and headline; the envelope sets altitude only.
 *    app.js calls it at the PRIOR RUN CONTEXT push (stored rows keep the old heading).
 *
 * 2. ROLE-SUBTITLE-001. A targeted application whose subtitle is empty, a template, or
 *    the stored standing slogan ("Processes • Products • People", the UNSOLICITED line)
 *    gets a role-specific subtitle built from the posting title instead. Generation's
 *    own role-smart subtitle is never replaced.
 *
 * 3. TOOLS-RELEVANCE-001. Lab and cleanroom instruments (confocal, AFM, SEM, …) stay
 *    out of the Tools & Methods block for non-research roles: the row is HIDDEN in the
 *    stored section (eye-reversible, never deleted) so preview == export, and shown
 *    again when the application is a research / lab role. Mirrors quality_pass.py
 *    JD-RELEVANCE-VISIBILITY-001 for the PWA.
 *
 * Kill switch: localStorage['antcv:disable-role-positioning-guard'] = '1'.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.5242';

  function CM() { return root && root.AntcvCompanyMatch; }
  function isTargeted(c) { var cm = CM(); return cm ? cm.isTargeted(c) : !!String(c || '').trim(); }

  // ── role family ────────────────────────────────────────────────────────
  var FAMILIES = [
    { id: 'product', re: /\bproduct\s+(manager|owner|lead|management|director)\b|\bproduct\s*-?\s*manager\b/i, label: 'product management', pair: ['Product Lifecycle', 'Market Need to Launch'] },
    { id: 'architecture', re: /\barchitect(ure)?\b/i, label: 'system and solution architecture', pair: ['System Architecture', 'Concept to Production'] },
    { id: 'systems', re: /\bsystems?\s+engineer(ing)?\b/i, label: 'systems engineering', pair: ['Systems Engineering', 'Requirements to Verification'] },
    { id: 'project', re: /\b(project|program(me)?|portfolio|delivery)\s+(manager|management|lead|leader|consultant|director)\b|\bPMO\b/i, label: 'project and delivery management', pair: ['Project Delivery', 'Requirements to Production'] },
    { id: 'research', re: /\b(research|scientist|researcher|phd|ph\.d|postdoc|physicist)\b/i, label: 'research and development', pair: ['Research & Development', 'Measured Results'] },
    { id: 'optics', re: /\b(optic(al|s)?|photonic(s)?|laser|electro-?optic(al|s)?)\b/i, label: 'optics and photonics engineering', pair: ['Optics & Photonics', 'Test & Validation'] },
    { id: 'test', re: /\b(test(ing)?|validation|verification|V&V)\b/i, label: 'test and validation', pair: ['Test & Validation', 'Production Readiness'] },
    { id: 'quality', re: /\b(quality|regulatory|compliance)\b/i, label: 'quality and compliance', pair: ['Quality & Compliance', 'Verification & Traceability'] },
    { id: 'analyst', re: /\b(business|data|systems)\s+analyst\b|\banalyst\b/i, label: 'business analysis', pair: ['Business Analysis', 'Requirements & Data'] },
    { id: 'hardware', re: /\b(hardware|electronics?)\b/i, label: 'hardware engineering', pair: ['Hardware Engineering', 'Concept to Production'] }
  ];
  // Research / lab roles keep lab instruments (owner: "no lab or cleanroom instruments
  // for non-research roles"). "Global R&D" in an architect title is a department, not a lab role.
  var RESEARCH_ROLE = /\b(research|scientist|researcher|phd|ph\.d|postdoc|physicist|laborator(y|ies)|lab\s+(engineer|technician|manager)|metrolog\w*|characteri[sz]ation|clean\s*-?room|nano\s*-?fab\w*|fabrication|process\s+(development\s+)?engineer|optical\s+engineer|optics\s+engineer|photonics\s+engineer|laser\s+engineer|test\s+engineer|measurement|R&D\s+(engineer|projects?|scientist))\b/i;
  var RESEARCH_CATEGORY = /^(research|academic|r_?and_?d|phd|lab)/i;

  function roleFamily(role) {
    var r = String(role || '');
    for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].re.test(r)) return FAMILIES[i];
    return null;
  }
  function isResearchRole(role, category) {
    return RESEARCH_ROLE.test(String(role || '')) || RESEARCH_CATEGORY.test(String(category || ''));
  }

  // ── 1. envelope precedence ─────────────────────────────────────────────
  var OLD_HEAD = 'TARGET-ROLE GUIDELINES (Dream Envelope):';
  var NEW_HEAD = 'TARGET-ROLE CALIBRATION (Dream Envelope - calibration only, never positioning):';
  var MARK = 'ENVELOPE-PRECEDENCE-001';
  function precedenceRule(role) {
    var fam = roleFamily(role);
    var r = String(role || '').trim();
    return 'POSITIONING PRECEDENCE (' + MARK + ', owner 2026-11-01): the JOB DESCRIPTION sets the positioning' +
      (r ? ' - this posting is "' + r + '"' + (fam ? ' (role family: ' + fam.label + ')' : '') : '') + '. ' +
      'The CV profile identity sentence, meta.subtitle, the profile slogan and the cover-letter headline name THIS role family and what this employer needs. ' +
      'The Dream Envelope block below only calibrates seniority, title band, location, mobility and compensation altitude: never adopt an envelope title as the candidate\'s identity when it differs from the posting, ' +
      'and never open a targeted profile with the unsolicited "IT professional" / "IT specialist" line.';
  }
  function envelopePrecedence(sc, role) {
    var s = String(sc == null ? '' : sc);
    if (!s || s.indexOf(MARK) >= 0) return s;
    if (s.indexOf(OLD_HEAD) < 0 && s.indexOf(NEW_HEAD) < 0) return s;
    if (role == null) { try { role = (JSON.parse(root.localStorage.getItem('meta') || '{}') || {}).role || ''; } catch (_) { role = ''; } }
    return precedenceRule(role) + '\n\n' + s.split(OLD_HEAD).join(NEW_HEAD);
  }

  // ── 2. role-specific subtitle ──────────────────────────────────────────
  var STANDING = ['processes • products • people'];
  var REGION = /\b(EMEIA|EMEA|APAC|AMER|Nordics?|Global|Europe|Denmark|DK|Sweden|international|R&D)\b/gi;
  function normSub(s) { return String(s || '').toLowerCase().replace(/\s*[*|•·]\s*/g, ' • ').replace(/\s+/g, ' ').trim(); }
  function isTemplateSub(s) { s = String(s || '').trim(); return !s || /^\[/.test(s); }
  function titleWords(s) {
    return String(s || '').split(/\s+/).filter(Boolean).map(function (w) {
      return /^[A-Z0-9&]{2,}$/.test(w) || /[A-Z].*[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }
  function roleDomain(role) {
    var parts = String(role || '').split(/\s+[-–—]\s+|\s*,\s*|\s*\(\s*|\s*\)\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
    for (var i = 1; i < parts.length; i++) {
      var d = parts[i].replace(REGION, ' ').replace(/\s+/g, ' ').trim();
      if (d && d.length >= 3 && d.split(' ').length <= 4 && !/\b(maternity|cover|year|month|temporary|part[- ]time|full[- ]time)\b/i.test(d)) return titleWords(d);
    }
    return '';
  }
  function roleSubtitle(role) {
    var r = String(role || '').trim();
    if (!r) return '';
    var fam = roleFamily(r);
    var parts = fam ? fam.pair.slice() : [titleWords(r.split(/\s+[-–—]\s+|,/)[0].trim())];
    var dom = roleDomain(r);
    if (dom && parts.map(function (p) { return p.toLowerCase(); }).indexOf(dom.toLowerCase()) < 0) parts.push(dom);
    return parts.slice(0, 3).join(' • ');
  }
  function standingLines() {
    var out = STANDING.slice();
    try {
      var p = JSON.parse(root.localStorage.getItem('personalInfo') || '{}') || {};
      p = p.personalInfo || p;
      if (p && p.specialization) out.push(normSub(p.specialization));
    } catch (_) {}
    return out;
  }
  // Pure: the subtitle to write, or null to leave meta alone.
  function subtitleFix(meta, lang, standing) {
    meta = meta || {};
    if (!isTargeted(meta.company)) return null;
    if (lang && !/^en/i.test(lang)) return null;          // EN concept table only; other languages keep theirs
    var cur = String(meta.subtitle || '').trim();
    var stale = isTemplateSub(cur) || (standing || STANDING).indexOf(normSub(cur)) >= 0;
    if (!stale) return null;
    var next = roleSubtitle(meta.role);
    return next && normSub(next) !== normSub(cur) ? next : null;
  }

  // ── 3. tools relevance ─────────────────────────────────────────────────
  var LAB_LABEL = /^\s*(instruments?|lab(oratory)?(\s*(&|and)\s*[a-z]+)?|clean\s*-?room\w*|nano\s*-?fab\w*|fabrication|microscopy|characteri[sz]ation|measurement\s+instruments?)\s*:?\s*$/i;
  var LAB_TOKEN = /\b(SEM|HRSEM|AFM|TEM|STM|confocal|Raman|interferomet\w*|spectromet\w*|optical\s+bench(es)?|probe\s+stations?|clean\s*-?room\w*|lithograph\w*|e-?beam|CVD|PECVD|sputter\w*|evaporators?|wire[- ]?bond\w*|ellipsomet\w*|profilomet\w*|glove\s*box)\b/i;
  function isLabItem(it) {
    if (!it || typeof it !== 'object' || it.grp) return false;
    if (LAB_LABEL.test(String(it.b || ''))) return true;
    var list = String(it.t || '').split(/\s*[,;]\s*/).filter(Boolean);
    if (list.length < 2) return false;
    var lab = list.filter(function (x) { return LAB_TOKEN.test(x); }).length;
    return lab / list.length >= 0.6;
  }
  // Pure: returns a new tools section (or the same object when nothing changes).
  function toolsRelevance(sec, research, key) {
    if (!sec || !Array.isArray(sec.items)) return sec;
    var gate = (sec.jdGate && typeof sec.jdGate === 'object') ? sec.jdGate : null;
    var hidden = Object.assign({}, sec.hidden || {});
    var changed = false;
    if (research) {
      if (!gate || !Array.isArray(gate.idx) || !gate.idx.length) return sec;
      gate.idx.forEach(function (i) { if (hidden[i]) { delete hidden[i]; changed = true; } });
      var out = Object.assign({}, sec, { hidden: hidden });
      delete out.jdGate;
      return changed || gate ? out : sec;
    }
    // Hide once per application: a row the user unhid for THIS application stays visible.
    if (gate && gate.key === key) return sec;
    var idx = [];
    sec.items.forEach(function (it, i) { if (isLabItem(it) && !hidden[i]) { hidden[i] = true; idx.push(i); changed = true; } });
    if (!changed) return gate && gate.key !== key ? Object.assign({}, sec, { jdGate: { key: key, idx: gate.idx || [] } }) : sec;
    return Object.assign({}, sec, { hidden: hidden, jdGate: { key: key, idx: ((gate && gate.idx) || []).concat(idx) } });
  }

  // ── storage-backed side ──────────────────────────────────────────────
  function rd(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function disabled() { try { return root.localStorage.getItem('antcv:disable-role-positioning-guard') === '1'; } catch (_) { return false; } }
  function lang() { try { return String(root.localStorage.getItem('language') || 'en').replace(/["']/g, ''); } catch (_) { return 'en'; } }
  function category() {
    try { var r = rd('rationale'); return (r && typeof r.category === 'string' && r.category) || ''; } catch (_) { return ''; }
  }
  var busy = false;
  function tick() {
    if (busy || disabled()) return;
    busy = true;
    try {
      var meta = rd('meta') || {};
      var fix = subtitleFix(meta, lang(), standingLines());
      if (fix) {
        meta.subtitle = fix;
        root.localStorage.setItem('meta', JSON.stringify(meta));
        try { root.dispatchEvent(new StorageEvent('storage', { key: 'meta', newValue: JSON.stringify(meta) })); } catch (_) {}
        try { console.log('[role-positioning] ROLE-SUBTITLE-001: subtitle "' + fix + '" for ' + (meta.role || '')); } catch (_) {}
      }
      var secs = rd('sections');
      if (secs && Array.isArray(secs.cv) && isTargeted(meta.company)) {
        var key = String(meta.company || '') + '|' + String(meta.role || '');
        var research = isResearchRole(meta.role, category());
        var hit = false;
        var cv = secs.cv.map(function (s) {
          if (!s || s.id !== 'tools') return s;
          var n = toolsRelevance(s, research, key);
          if (n !== s) hit = true;
          return n;
        });
        if (hit) {
          secs.cv = cv;
          root.localStorage.setItem('sections', JSON.stringify(secs));
          try { root.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'tools-relevance' } })); } catch (_) {}
          try { console.log('[role-positioning] TOOLS-RELEVANCE-001: lab instrument rows ' + (research ? 'shown (research role)' : 'hidden (non-research role)')); } catch (_) {}
        }
      }
    } catch (_) { /* self-disable on any error */ }
    busy = false;
  }

  var API = {
    version: VERSION, roleFamily: roleFamily, isResearchRole: isResearchRole, envelopePrecedence: envelopePrecedence,
    roleSubtitle: roleSubtitle, subtitleFix: subtitleFix, isLabItem: isLabItem, toolsRelevance: toolsRelevance, tick: tick
  };
  if (root) {
    root.AntcvRolePositioning = API;
    root.__antcvEnvelopePrecedence = function (sc) { try { return disabled() ? sc : envelopePrecedence(sc); } catch (_) { return sc; } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else if (root && root.addEventListener && root.__antcvRolePositioning !== VERSION) {
    root.__antcvRolePositioning = VERSION;
    var t = null;
    root.addEventListener('antcv:sections-updated', function (e) {
      if (e && e.detail && e.detail.source === 'tools-relevance') return;
      if (t) clearTimeout(t); t = setTimeout(tick, 500);
    });
    root.addEventListener('storage', function (e) { if (!e || e.key === 'meta') { if (t) clearTimeout(t); t = setTimeout(tick, 500); } });
    [1500, 4000, 9000].forEach(function (ms) { setTimeout(tick, ms); });
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
