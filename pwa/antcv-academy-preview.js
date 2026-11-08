/* antcv-academy-preview.js — ACADEMY-EMPTY-001 + ELMA-PREVIEW-001, preview half
 * ============================================================================
 * Owner on a margin-layout preview (2026-11-06): "go to academy rule. notice that you
 * lest sub headings empty on application". The preview showed TOOLS & METHODS,
 * CERTIFICATES & COURSES and REGULATORY CONTEXT headings with no rows, "[Language]:
 * [level]" rows, the skeleton's ADDITIONAL INFORMATION instruction, and, under Anita
 * Myre-Kornfeldt's name, the owner's education rows and Communication line.
 *
 * Owner on #3536 Elma (2026-11-08): "elma preview in antcv is bleeping the Elma
 * eftersøger table ... CV Preview is 5 pages, while the pdfs are actually 1.5 pages."
 *   - Blink: app.js wraps a section in a busy div while it is translating / pending /
 *     working (Ce, app.src.js ~6127), so every busy flip re-mounts the section node.
 *     The placeholder-only CORE COMPETENCIES table was hidden by an inline style set
 *     120 ms after each re-mount, so it showed for a moment on every flip (21 times
 *     in 25 s of a DA translation). Hidden sections now come from a stylesheet keyed
 *     on data-sid, which applies to a re-mounted node before it paints.
 *   - Pages: the export runs AntcvAcademyFormat.apply() (<= 6 roles + Earlier career,
 *     <= 3 bullets, capped sidebar rows, no outcomes / publications block); the preview
 *     drew every stored role and bullet (13 roles, 5 pages vs 2 in the PDF). The same
 *     projection now decides what the preview hides: sections, folded roles and cut
 *     bullets by stylesheet (data-sid, data-antcv-role-index, data-antcv-rowkey), sidebar
 *     rows by text. The measurer is asked to re-plan when the hidden set changes.
 *     Not mirrored: the Earlier career summary row and the shortened bullet wording.
 *
 * The house CV (pkgs_1050/1051) has no heading without real content and no template
 * text. This file HIDES DOM nodes inside .antcv-preview-paper (stylesheet + display:none
 * marks) and NEVER writes storage or dispatches events, so it cannot join a
 * sections-updated storm. Stored sections stay as they are; the editor panel still lists
 * every section, role and row.
 *
 * Scope: the CV preview in the margin layout (body[data-antcv-cv-margin="1"]), the
 * same gate as the export projection. A blank template (fewer than 3 sections with real
 * content) is left alone so a new document still shows its skeleton.
 * Kill: antcv:disable-academy-format=1.
 */
(function () {
  'use strict';
  var VERSION = '1.51.6345-elma-preview';
  if (window.__antcvAcademyPreview === VERSION) return;
  window.__antcvAcademyPreview = VERSION;

  var MARK = 'data-antcv-af-hide';
  var STYLE_ID = 'antcv-af-hide-css';
  var PAPER = '.antcv-preview-paper ';
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function str(k) { var v = readJSON(k); return typeof v === 'string' ? v : String(localStorage.getItem(k) || ''); }
  function raw(k) { try { return String(localStorage.getItem(k) || ''); } catch (_) { return ''; } }
  function active() {
    try {
      if (localStorage.getItem('antcv:disable-academy-format') === '1') return false;
      if (!document.body || document.body.getAttribute('data-antcv-cv-margin') !== '1') return false;
      if ((str('doc') || 'cv') !== 'cv') return false;
      return !!(window.AntcvAcademyFormat && typeof window.AntcvAcademyFormat.apply === 'function');
    } catch (_) { return false; }
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/[^0-9a-zà-ÿæøå]+/g, ' ').trim(); }
  function hide(el, why) { if (el.getAttribute(MARK) !== why) { el.setAttribute(MARK, why); el.style.setProperty('display', 'none', 'important'); } }
  function unhide(el) { el.removeAttribute(MARK); el.style.removeProperty('display'); }

  // smallest element under `root` whose text holds the whole row text
  function rowNode(root, key) {
    var best = null, bestLen = Infinity;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('[data-antcv-section-headline]')) continue;
      var t = norm(el.textContent);
      if (t.length >= key.length && t.length < bestLen && t.indexOf(key) >= 0) { best = el; bestLen = t.length; }
    }
    return best;
  }

  function esc(v) { v = String(v); return (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&'); }
  function secEls(id) {
    return document.querySelectorAll(PAPER + '[data-sid="' + esc(id) + '"]');
  }
  // Hide what `plan` names ({ sections: [id], rows: { id: [text] } }); bring back anything this
  // file hid earlier that the plan no longer names. Returns the count of hidden nodes.
  function applyPlan(plan) {
    var want = [];
    (plan.sections || []).forEach(function (id) {
      var els = secEls(id);
      for (var i = 0; i < els.length; i++) { hide(els[i], 'section'); want.push(els[i]); }
    });
    Object.keys(plan.rows || {}).forEach(function (id) {
      var els = secEls(id);
      plan.rows[id].forEach(function (text) {
        var key = norm(text);
        if (key.length < 3) return;
        for (var i = 0; i < els.length; i++) {
          var n = rowNode(els[i], key);
          if (n && n !== els[i]) { hide(n, 'row'); want.push(n); }
        }
      });
    });
    var now = document.querySelectorAll(PAPER + '[' + MARK + ']');
    for (var w = 0; w < now.length; w++) if (want.indexOf(now[w]) < 0) unhide(now[w]);
    return want.length;
  }

  // ── export projection -> what the preview hides (ELMA-PREVIEW-001) ─────────────
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  // same fields as antcv-academy-format.js rowText
  function rowText(it) {
    if (typeof it === 'string') return it;
    if (!it || typeof it !== 'object') return '';
    return [it.bOff ? '' : it.b, it.tOff ? '' : it.t, it.l, it.v, it.value, it.deg, it.sch, it.text, it.citation]
      .filter(function (p) { return typeof p === 'string' && p.trim(); }).join(' ');
  }
  function bulletText(b) { return typeof b === 'string' ? b : [b && b.b, b && b.t].filter(Boolean).join(' '); }
  // a kept bullet is the stored one, or its first sentence / clause (the export shortens, never
  // rewords); the internship note may be localised ("Internship:" -> "Praktik:")
  function bkey(b) {
    return norm(bulletText(b).replace(/^\s*(internship|praktik|prácticas|practicas)\s*:\s*/i, '')
      .replace(/\((internship|praktik|prácticas|practicas)\)/ig, ' '));
  }
  function sameBullet(src, kept) {
    var a = bkey(src), b = bkey(kept);
    if (!a || !b) return false;
    if (a === b) return true;
    var n = Math.min(b.length, 60);
    return n >= 24 && a.slice(0, n) === b.slice(0, n);
  }
  // stored bullet indices the projection kept (in order), or null when they cannot be mapped
  function keptBullets(src, kept) {
    var keep = {}, k = 0;
    for (var b = 0; b < src.length && k < kept.length; b++) {
      if (src[b] == null) continue;
      if (sameBullet(src[b], kept[k])) { keep[b] = 1; k++; }
    }
    return k === kept.length ? keep : null;
  }

  // Pure. { sections: [id], rows: { id: [text] }, roles: [{ ri, ord }], bullets: [{ ri, ord, bi }], exp }
  //   ri  = the role's index in the stored roles (pages 2+ wrap each role in data-antcv-role-index=ri)
  //   ord = its position among the roles with on !== false (page 1 renders those as rowkey roles.<ord>)
  // o: { lang, jdText, company, role, name, personalInfo, nowYear, exportHidden(role) }
  function projection(cv, o) {
    o = o || {};
    var out = { sections: [], rows: {}, roles: [], bullets: [], exp: null };
    var AF = (typeof window !== 'undefined' && window.AntcvAcademyFormat) || o.af;
    if (!Array.isArray(cv) || !AF || typeof AF.apply !== 'function') return out;
    var gone = typeof o.exportHidden === 'function' ? o.exportHidden : function () { return false; };
    // the export runs sanitizeForExport first: its hidden roles are off (the preview renders them
    // null already); bullets the editor hid (bulletMeta) never reach the export
    var input = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      return Object.assign({}, s, { roles: s.roles.map(function (r) {
        if (!r || typeof r !== 'object' || r.on === false) return r;
        if (gone(r)) return Object.assign({}, r, { on: false });
        var meta = Array.isArray(r.bulletMeta) ? r.bulletMeta : [];
        if (!Array.isArray(r.bullets) || !meta.some(function (m) { return m && m.hidden; })) return r;
        return Object.assign({}, r, { bullets: r.bullets.map(function (b, i) { return meta[i] && meta[i].hidden ? null : b; }) });
      }) });
    });
    var res = null;
    try {
      res = AF.apply(clone(input), {
        lang: o.lang || 'en', jdText: o.jdText || '', company: o.company || '', role: o.role || '',
        name: o.name || '', nowYear: o.nowYear, source: input, personalInfo: o.personalInfo || null,
      });
    } catch (_) { return out; }
    var proj = res && Array.isArray(res.sections) ? res.sections : [];
    var byId = {};
    proj.forEach(function (s) { if (s && s.id != null && !byId[s.id]) byId[s.id] = s; });
    input.forEach(function (s, si) {
      if (!s || typeof s !== 'object' || s.on === false || s.id == null) return;
      var id = String(s.id), p = byId[id];
      if (!p || p.on === false) { out.sections.push(id); return; }
      if (s.type === 'experience' && Array.isArray(s.roles) && Array.isArray(p.roles)) {
        out.exp = id;
        var ord = 0;
        s.roles.forEach(function (r, i) {
          var orig = cv[si].roles[i];
          if (!r || typeof r !== 'object' || !orig || orig.on === false) return;
          var R = ord++, q = p.roles[i];
          if (r.on === false) return;                     // export-hidden: rendered null already
          if (!q || q.on === false) { out.roles.push({ ri: i, ord: R }); return; }
          var src = Array.isArray(r.bullets) ? r.bullets : [];
          var kept = Array.isArray(q.bullets) ? q.bullets : [];
          if (kept.length >= src.filter(function (b) { return b != null; }).length) return;
          var keep = keptBullets(src, kept);
          if (!keep) return;
          src.forEach(function (b, bi) { if (b != null && !keep[bi]) out.bullets.push({ ri: i, ord: R, bi: bi }); });
        });
        return;
      }
      if (Array.isArray(s.items) && Array.isArray(p.items) && p.hidden && typeof p.hidden === 'object') {
        var shown = {};
        s.items.forEach(function (it, i) { if (!(s.hidden && s.hidden[i])) { var t = norm(rowText(it)); if (t) shown[t] = 1; } });
        // rows keep their index unless the projection reorders the list (languages); the stored
        // text is what the preview draws (the export strips certificate years, renames levels)
        var aligned = s.items.length === p.items.length;
        var texts = [];
        Object.keys(p.hidden).forEach(function (k) {
          if (!p.hidden[k]) return;
          [aligned ? rowText(s.items[k]) : '', rowText(p.items[k])].some(function (t) {
            if (!t || !shown[norm(t)]) return false;
            if (texts.indexOf(t) < 0) texts.push(t);
            return true;
          });
        });
        if (texts.length) out.rows[id] = texts;
      }
    });
    return out;
  }

  // Pure: the stylesheet for a projection (sections, folded roles, cut bullets).
  function cssFor(pp) {
    var sel = [];
    (pp.sections || []).forEach(function (id) { sel.push(PAPER + '[data-sid="' + esc(id) + '"]'); });
    var p1 = pp.exp != null ? PAPER + '.antcv-document-main > [data-sid="' + esc(pp.exp) + '"] ' : null;
    (pp.roles || []).forEach(function (r) {
      sel.push(PAPER + '[data-antcv-role-index="' + r.ri + '"]');
      if (p1) {
        sel.push(p1 + '[data-antcv-rowkey="roles.' + r.ord + '"]');
        sel.push(p1 + '[data-antcv-rowkey^="roles.' + r.ord + '."]');
      }
    });
    (pp.bullets || []).forEach(function (b) {
      sel.push(PAPER + '[data-antcv-role-index="' + b.ri + '"] [data-antcv-rowkey$=".bullets.' + b.bi + '"]');
      if (p1) sel.push(p1 + '[data-antcv-rowkey="roles.' + b.ord + '.bullets.' + b.bi + '"]');
    });
    return sel.length ? sel.join(',\n') + ' { display: none !important; }' : '';
  }

  function setCss(text) {
    var el = document.getElementById(STYLE_ID);
    if (!text) { if (el && el.textContent) el.textContent = ''; return false; }
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    if (el.textContent === text) return false;
    el.textContent = text;
    return true;
  }

  var lastSig = '', lastNotes = '', lastPlan = null, lastCss = '';
  function off() {
    var mine = document.querySelectorAll(PAPER + '[' + MARK + ']');
    for (var u = 0; u < mine.length; u++) unhide(mine[u]);
    setCss('');
    lastPlan = null;
  }
  // the measurer re-plans on a sections / layout change only; a new hidden set changes heights
  function remeasure() {
    try { if (window.AntcvAutoPagebreak && typeof window.AntcvAutoPagebreak.run === 'function') window.AntcvAutoPagebreak.run(); } catch (_) {}
  }
  function run() {
    try {
      if (!active()) { if (lastPlan || lastCss) { lastCss = ''; lastSig = ''; off(); remeasure(); } return; }
      var secsRaw = raw('sections');
      var secs = readJSON('sections');
      var cv = secs && Array.isArray(secs.cv) ? secs.cv : null;
      if (!cv || !document.querySelector('.antcv-preview-paper')) return;
      var lang = (str('language') || 'en').replace(/[^a-z]/gi, '').slice(0, 2).toLowerCase();
      var jd = raw('antcv:lastJdText'), metaRaw = raw('meta');
      var gone = typeof window.AntcvExportHiddenRole === 'function' ? window.AntcvExportHiddenRole : null;
      // personalInfo (the photo makes it ~300 KB) is read only on a recompute
      var sig = lang + '|' + !!gone + '|' + jd.length + '|' + jd.slice(0, 200) + '|' + metaRaw + '|' + secsRaw;
      if (sig !== lastSig || !lastPlan) {
        lastSig = sig;
        var meta = readJSON('meta') || {};
        var pi = readJSON('personalInfo') || {};
        var p = pi.personalInfo || pi;
        var pp = projection(cv, {
          lang: lang, jdText: jd, company: meta.company || '', role: meta.role || '', name: p.name || '',
          personalInfo: p, nowYear: new Date().getFullYear(), exportHidden: gone,
        });
        var live = cv.filter(function (s) { return s && s.on !== false; }).length;
        if (live - pp.sections.length < 3) pp = { sections: [], rows: {}, roles: [], bullets: [], exp: pp.exp };   // blank template
        lastPlan = pp;
        var notes = (pp.sections.length ? 'sections ' + pp.sections.join(', ') : '') +
          (pp.roles.length ? ' | ' + pp.roles.length + ' role(s) folded' : '') +
          (pp.bullets.length ? ' | ' + pp.bullets.length + ' bullet(s) cut' : '') +
          (Object.keys(pp.rows).length ? ' | rows hidden in ' + Object.keys(pp.rows).join(', ') : '');
        if (notes !== lastNotes) { lastNotes = notes; if (notes) console.info('[ELMA-PREVIEW-001] preview follows the export: ' + notes); }
      }
      applyPlan(lastPlan);
      var css = cssFor(lastPlan);
      setCss(css);
      if (css !== lastCss) { lastCss = css; remeasure(); }
    } catch (_) { /* never break the preview */ }
  }

  var timer = 0;
  function soon() { if (timer) return; timer = setTimeout(function () { timer = 0; run(); }, 120); }
  // React re-mounts nodes (busy wrappers, page rows): re-apply the last plan in the observer
  // callback itself, which runs before the next paint, then recompute on the debounce.
  function onMutations(muts) {
    try {
      if (lastPlan && active()) {
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (muts[i].addedNodes.length && t && t.closest && t.closest('.antcv-preview-paper')) { applyPlan(lastPlan); break; }
        }
      }
    } catch (_) {}
    soon();
  }
  function start() {
    try {
      // structure + text, not attributes (our own writes)
      new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', soon);
    soon();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.AntcvAcademyPreview = { version: VERSION, run: run, applyPlan: applyPlan, projection: projection, cssFor: cssFor };
})();
