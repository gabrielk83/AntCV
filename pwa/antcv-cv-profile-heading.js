/* antcv-cv-profile-heading.js — PROFILE-SLOGAN-001 (owner 2026-10-01)
 *
 * Owner: "it should be possible to replace the word PROFILE in the heading with a slogan (like
 * the line in the cover letter); make sure they are not repeating each other … open the
 * interface for profile header editing, and by default replace the profile line with this
 * slogan line."
 *
 * 1. Generation hook. The gen prompt returns cv_overrides.profile_slogan (gold-rules.json
 *    prompt_block, PROFILE-SLOGAN-001). app.js calls window.__antcvProfileHeading.applyGen()
 *    on the CV profile section when it applies cv_overrides. Default: the slogan becomes the
 *    section title. It is NOT applied when it shares a content word with the cover-letter slogan
 *    (meta.cl_slogan) — the heading stays/falls back to the plain label and the Layout control
 *    flags the repeat. The slogan is also kept on the section as `sloganTitle` so the user can
 *    switch back to it.
 * 2. Layout-tab control "CV PROFILE HEADING", mounted after the cover-letter slogan control:
 *    edit the heading text, switch Slogan / PROFILE, and see the profile checks from
 *    antcv-profile-rules.js (I-voice, personal opening then company-focused, no buzzword list,
 *    slogan distinct from the cover-letter slogan).
 *
 * Keys:
 *   antcv:cvProfileHeadingMode  'slogan' (default) | 'label'   — standing preference for gen
 * Data: sections.cv[id=profile].title (the rendered heading), .sloganTitle (last slogan).
 * Writes go to localStorage 'sections' + 'antcv:sections-updated' (same path as 759).
 * Kill: localStorage['antcv:disable-cv-profile-heading'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.4790-profile-slogan';
  if (window.__antcvProfileHeading && window.__antcvProfileHeading.version === VERSION) return;

  var K_MODE = 'antcv:cvProfileHeadingMode';
  var K_OPEN = 'antcv:cvProfileHeadingCtrlOpen';
  var ACCENT = 'rgb(1,183,187)';
  var LABEL = 'PROFILE';

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function disabled() { return get('antcv:disable-cv-profile-heading', '') === '1'; }
  function mode() { return String(get(K_MODE, 'slogan')).replace(/"/g, '') === 'label' ? 'label' : 'slogan'; }
  function rules() { return window.__antcvProfileRules || null; }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/[.]+$/, ''); }
  function isLabel(t) { var r = rules(); return r ? r.isPlainLabel(t) : /^(profile|profil)$/i.test(clean(t)); }
  function overlap(a, b) { var r = rules(); return r && a && b ? r.sloganOverlap(a, b) : []; }

  // ---- 1. generation hook (called from app.js; must never throw) ----
  function applyGen(sec, cvo, meta) {
    try {
      if (disabled() || !sec || sec.id !== 'profile') return sec;
      var sl = clean((cvo && cvo.profile_slogan) || (meta && meta.profile_slogan) || '');
      if (!sl || isLabel(sl)) return sec;
      var cl = clean((meta && meta.cl_slogan) || get('antcv:clSlogan', ''));
      var rep = overlap(sl, cl);
      var out = Object.assign({}, sec, { sloganTitle: sl });
      var fallback = isLabel(sec.title) ? sec.title : LABEL;
      if (rep.length) { out.sloganRepeat = rep; out.title = fallback; return out; }
      delete out.sloganRepeat;
      out.title = mode() === 'label' ? fallback : sl;
      return out;
    } catch (_) { return sec; }
  }

  // ---- storage helpers ----
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function profileSec() {
    var cv = readSections().cv;
    if (!Array.isArray(cv)) return null;
    for (var i = 0; i < cv.length; i++) if (cv[i] && cv[i].id === 'profile') return cv[i];
    return null;
  }
  function writeProfile(patch) {
    try {
      var secs = readSections();
      if (!Array.isArray(secs.cv)) return;
      var hit = false;
      secs.cv = secs.cv.map(function (s) {
        if (!s || s.id !== 'profile') return s;
        hit = true;
        var n = Object.assign({}, s, patch);
        Object.keys(n).forEach(function (k) { if (n[k] === undefined) delete n[k]; });
        return n;
      });
      if (!hit) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cv-profile-heading' } }));
    } catch (_) {}
  }
  function profileText(s) {
    if (!s) return '';
    if (Array.isArray(s.items)) return s.items.filter(function (q) { return q && !q.hidden; })
      .map(function (q) { return String(q.t || ''); }).join(' ');
    return String(s.content || '');
  }

  // ---- 2. Layout-tab control ----
  function btn(txt, on) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = 'padding:4px 9px;margin:0;border-radius:5px;border:1px solid rgba(1,183,187,0.45);' +
      'background:rgba(1,183,187,0.10);color:' + ACCENT + ';font-size:10px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); on(b); });
    return b;
  }
  function paint(b, on) { b.style.background = on ? ACCENT : 'rgba(1,183,187,0.10)'; b.style.color = on ? '#04231f' : ACCENT; }

  function build() {
    var box = document.createElement('div');
    box.setAttribute('data-antcv-cv-profile-heading-control', '1');
    box.style.cssText = 'margin:8px 0 0 0;padding:8px 10px;border:1px solid rgba(1,183,187,0.25);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);';
    var head = document.createElement('div');
    head.style.cssText = 'cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';' +
      'display:flex;align-items:center;gap:6px;user-select:none;';
    var caret = document.createElement('span');
    var htxt = document.createElement('span');
    htxt.textContent = 'CV PROFILE HEADING';
    head.appendChild(caret); head.appendChild(htxt);
    var body = document.createElement('div');
    body.style.cssText = 'flex-direction:column;gap:6px;margin-top:6px;';

    var textIn = document.createElement('input');
    textIn.type = 'text';
    textIn.placeholder = 'Slogan, e.g. MAKE THE CASE BEFORE THE SPEC';
    textIn.style.cssText = 'width:100%;box-sizing:border-box;padding:5px 7px;border-radius:5px;border:1px solid rgba(1,183,187,0.35);' +
      'background:rgba(0,0,0,0.15);color:inherit;font-size:11px;text-transform:uppercase;';
    textIn.addEventListener('change', function () {
      var v = clean(textIn.value);
      if (!v) v = LABEL;
      var patch = { title: v };
      if (!isLabel(v)) { patch.sloganTitle = v; patch.sloganRepeat = undefined; set(K_MODE, 'slogan'); }
      else set(K_MODE, 'label');
      writeProfile(patch);
      refresh();
    });

    var modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;';
    modeRow.appendChild(document.createTextNode('Heading:'));
    var bSlogan = btn('Slogan', function () {
      set(K_MODE, 'slogan');
      var s = profileSec();
      if (s && s.sloganTitle) writeProfile({ title: s.sloganTitle });
      refresh();
    });
    var bLabel = btn('PROFILE', function () { set(K_MODE, 'label'); writeProfile({ title: LABEL }); refresh(); });
    modeRow.appendChild(bSlogan); modeRow.appendChild(bLabel);

    var note = document.createElement('div');
    note.style.cssText = 'font-size:10px;color:#9ab;line-height:1.35;';
    note.textContent = 'Replaces the word PROFILE above the CV profile. Must not repeat the cover-letter slogan.';

    var checks = document.createElement('div');
    checks.style.cssText = 'font-size:10px;line-height:1.45;color:#cdd;';

    body.appendChild(textIn); body.appendChild(modeRow); body.appendChild(note); body.appendChild(checks);
    box.appendChild(head); box.appendChild(body);

    head.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      set(K_OPEN, get(K_OPEN, '1') === '1' ? '0' : '1'); box.__refresh();
    });

    box.__refresh = function () {
      var open = get(K_OPEN, '1') === '1';
      caret.textContent = open ? '▾' : '▸';
      body.style.display = open ? 'flex' : 'none';
      var s = profileSec();
      var title = s ? clean(s.title) : '';
      if (document.activeElement !== textIn) textIn.value = title;
      var m = mode();
      paint(bSlogan, m === 'slogan'); paint(bLabel, m === 'label');
      bSlogan.disabled = !(s && s.sloganTitle);
      bSlogan.title = s && s.sloganTitle ? 'Use: ' + s.sloganTitle : 'No slogan yet: type one above or regenerate';
      checks.textContent = '';
      var r = rules();
      if (!r || !s) return;
      var slogan = isLabel(title) ? (s.sloganTitle || '') : title;
      var res = r.checkProfile(profileText(s), { slogan: slogan, clSlogan: get('antcv:clSlogan', '') });
      if (s.sloganRepeat && s.sloganRepeat.length && isLabel(title)) {
        res.unshift({ ok: false, msg: 'Generated slogan "' + s.sloganTitle + '" repeated the cover letter (' + s.sloganRepeat.join(', ') + '); type a new one' });
      }
      res.forEach(function (x) {
        var row = document.createElement('div');
        row.style.color = x.ok ? '#9fd' : '#f9a';
        row.textContent = (x.ok ? '✓ ' : '✗ ') + x.msg;
        checks.appendChild(row);
      });
    };
    box.__refresh();
    return box;
  }

  var mounted = null;
  function refresh() { if (mounted && mounted.__refresh) mounted.__refresh(); }
  function anchor() {
    return document.querySelector('[data-antcv-cl-slogan-control]') || document.querySelector('[data-antcv-cl-sig-control]');
  }
  function scan() {
    if (disabled()) return;
    var all = document.querySelectorAll('[data-antcv-cv-profile-heading-control]');
    for (var j = 1; j < all.length; j++) if (all[j].parentNode) all[j].parentNode.removeChild(all[j]);
    if (mounted && mounted.isConnected) return;
    var a = anchor();
    if (!a || !a.parentNode) return;
    if (all.length) { mounted = all[0]; refresh(); return; }
    mounted = build();
    a.parentNode.insertBefore(mounted, a.nextSibling);
  }
  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 200); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; }
  });
  function start() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    schedule();
  }
  window.addEventListener('antcv:sections-updated', function () { setTimeout(refresh, 50); });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.__antcvProfileHeading = { version: VERSION, applyGen: applyGen, mode: mode, refresh: refresh };
})();
