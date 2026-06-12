/* AntCV — SPELL-ANNOTATOR-001 (v1.50.384)
 * ============================================================
 *
 * Basic spelling annotator for the CV/CL EDITOR fields (owner spec
 * 2026-06-07, decisions locked in FEATURES_REGISTRY):
 *
 *  - Scope: editable text INSIDE section editor rows
 *    ([data-section-row-index] textareas + text inputs — bullets,
 *    role/company/subtitle, section content). NOT the topbar, NOT the JD
 *    textarea, NOT Signals, NOT the rendered preview.
 *  - Engine: nspell (vendored browser bundle, pwa/vendor/nspell.browser.js,
 *    loaded lazily on first focus) + Hunspell dictionaries fetched on demand
 *    from jsDelivr (dictionary-en / dictionary-da / dictionary-es), cached
 *    in IndexedDB. Chinese has no usable Hunspell dictionary (no word
 *    boundaries) — zh is a documented no-op.
 *  - UI: ghost overlay behind the field renders the text transparently with
 *    a red wavy underline under misspelled words; click a mark → popover
 *    with up to 6 suggestions + "Add to my dictionary"
 *    (localStorage antcv:userDict:{lang}).
 *  - Language: follows localStorage 'language' (en default).
 *  - Toggles: master 'antcv:spell:enabled' ('0' disables; default on) and a
 *    per-language map 'antcv:spell:langs' ({"en":false} disables one).
 *    window.AntcvSpell = { setEnabled, check, version } for Settings/power
 *    use. Test hook: window.__antcvSpellDictBase overrides the CDN
 *    ('{lang}' placeholder), e.g. '/test/fixtures/dict-{lang}/'.
 */
(function () {
  'use strict';

  if (window.__antcvSpellAnnotatorInstalled) return;
  var VERSION = '1.50.384';
  window.__antcvSpellAnnotatorInstalled = VERSION;

  var DICT_LANGS = { en: 'dictionary-en', da: 'dictionary-da', es: 'dictionary-es' };
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var DEBOUNCE_MS = 600;
  var MAX_SUGGEST = 6;

  // ─── settings ────────────────────────────────────────────────────
  function lang() {
    try {
      var raw = localStorage.getItem('language') || 'en';
      try { var p = JSON.parse(raw); if (typeof p === 'string') raw = p; } catch (_) {}
      var s = String(raw).toLowerCase();
      if (/^da/.test(s)) return 'da';
      if (/^es/.test(s)) return 'es';
      if (/^zh/.test(s)) return 'zh';
      return 'en';
    } catch (_) { return 'en'; }
  }
  function enabled() {
    try {
      if (localStorage.getItem('antcv:spell:enabled') === '0') return false;
      var l = lang();
      if (!DICT_LANGS[l]) return false; // zh / unknown — no dictionary
      var per = JSON.parse(localStorage.getItem('antcv:spell:langs') || '{}');
      if (per && per[l] === false) return false;
      return true;
    } catch (_) { return true; }
  }
  function userDict(l) {
    try { return new Set(JSON.parse(localStorage.getItem('antcv:userDict:' + l) || '[]')); }
    catch (_) { return new Set(); }
  }
  function addToUserDict(l, word) {
    try {
      var arr = JSON.parse(localStorage.getItem('antcv:userDict:' + l) || '[]');
      if (arr.indexOf(word) < 0) arr.push(word);
      localStorage.setItem('antcv:userDict:' + l, JSON.stringify(arr));
    } catch (_) {}
  }

  // ─── dictionary loading (IndexedDB-cached) ───────────────────────
  function idb() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open('antcv-spell', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('dicts'); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function idbGet(db, key) {
    return new Promise(function (res) {
      try {
        var rq = db.transaction('dicts').objectStore('dicts').get(key);
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { res(null); };
      } catch (_) { res(null); }
    });
  }
  function idbPut(db, key, val) {
    return new Promise(function (res) {
      try {
        var tx = db.transaction('dicts', 'readwrite');
        tx.objectStore('dicts').put(val, key);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { res(); };
      } catch (_) { res(); }
    });
  }
  function dictUrls(l) {
    var base = window.__antcvSpellDictBase
      ? String(window.__antcvSpellDictBase).replace('{lang}', l)
      : CDN + DICT_LANGS[l] + '@latest/';
    return { aff: base + 'index.aff', dic: base + 'index.dic' };
  }
  async function loadDict(l) {
    var db = null;
    try { db = await idb(); } catch (_) {}
    if (db) {
      var cached = await idbGet(db, l);
      if (cached && cached.aff && cached.dic) return cached;
    }
    var u = dictUrls(l);
    var aff = await (await fetch(u.aff)).text();
    var dic = await (await fetch(u.dic)).text();
    var rec = { aff: aff, dic: dic, ts: 0 };
    if (db) await idbPut(db, l, rec);
    return rec;
  }
  function loadVendor() {
    return new Promise(function (res, rej) {
      if (window.nspell) return res();
      var s = document.createElement('script');
      s.src = 'vendor/nspell.browser.js?v=' + VERSION;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('nspell vendor load failed')); };
      document.head.appendChild(s);
    });
  }

  var engine = null, engineLang = null, engineLoading = null;
  function getEngine() {
    var l = lang();
    if (engine && engineLang === l) return Promise.resolve(engine);
    if (engineLoading) return engineLoading;
    engineLoading = (async function () {
      await loadVendor();
      var d = await loadDict(l);
      engine = window.nspell(d);
      engineLang = l;
      engineLoading = null;
      return engine;
    })().catch(function (e) {
      engineLoading = null;
      try { console.warn('[spell] engine init failed:', e && e.message); } catch (_) {}
      return null;
    });
    return engineLoading;
  }

  // ─── word scan ───────────────────────────────────────────────────
  var WORD_RE = /[A-Za-zÀ-ɏ']{2,}/g;
  function misspellings(text, eng, l) {
    var out = [], m, ud = userDict(l);
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text)) !== null) {
      var w = m[0].replace(/^'+|'+$/g, '');
      if (w.length < 2) continue;
      if (/[A-Z].*[A-Z]/.test(w)) continue;            // acronyms / CamelCase
      if (ud.has(w) || ud.has(w.toLowerCase())) continue;
      var ok = false;
      try { ok = eng.correct(w) || eng.correct(w.toLowerCase()); } catch (_) { ok = true; }
      if (!ok) out.push({ word: w, start: m.index, end: m.index + m[0].length });
    }
    return out;
  }

  // ─── ghost overlay ───────────────────────────────────────────────
  var COPY_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'lineHeight', 'textTransform', 'wordSpacing', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'whiteSpace', 'wordWrap',
    'overflowWrap', 'textAlign'];
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function ensureOverlay(field) {
    var ov = field._antcvSpellOv;
    if (ov && ov.isConnected) return ov;
    ov = document.createElement('div');
    ov.className = 'antcv-spell-overlay';
    ov.setAttribute('aria-hidden', 'true');
    var host = field.parentElement;
    if (!host) return null;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(ov, field);
    field._antcvSpellOv = ov;
    return ov;
  }
  function syncOverlay(field, marks) {
    var ov = ensureOverlay(field);
    if (!ov) return;
    var cs = getComputedStyle(field);
    var st = ov.style;
    st.position = 'absolute';
    st.left = field.offsetLeft + 'px';
    st.top = field.offsetTop + 'px';
    st.width = field.offsetWidth + 'px';
    st.height = field.offsetHeight + 'px';
    st.pointerEvents = 'none';
    st.overflow = 'hidden';
    st.color = 'transparent';
    st.background = 'transparent';
    st.zIndex = 1;
    if (field.tagName === 'INPUT') { st.whiteSpace = 'pre'; }
    COPY_PROPS.forEach(function (p) { if (p !== 'whiteSpace' || field.tagName !== 'INPUT') st[p] = cs[p]; });
    if (field.tagName === 'TEXTAREA') { st.whiteSpace = 'pre-wrap'; }
    var text = field.value || '';
    var html = '', pos = 0;
    marks.forEach(function (mk) {
      html += esc(text.slice(pos, mk.start));
      html += '<span class="antcv-spell-mark" data-antcv-spell-word="' + esc(mk.word) + '" style="pointer-events:auto;color:transparent;border-bottom:2px solid rgba(220,38,38,0.85);border-bottom-style:dotted;cursor:pointer;">' + esc(text.slice(mk.start, mk.end)) + '</span>';
      pos = mk.end;
    });
    html += esc(text.slice(pos));
    ov.innerHTML = html || '';
    ov.scrollTop = field.scrollTop;
    ov.scrollLeft = field.scrollLeft;
    ov.style.display = marks.length ? '' : 'none';
  }

  // ─── popover ─────────────────────────────────────────────────────
  var pop = null;
  function closePopover() { if (pop && pop.parentElement) pop.parentElement.removeChild(pop); pop = null; }
  function setNativeValue(field, value) {
    try {
      var proto = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(field, value); else field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }
  function openPopover(field, word, anchorRect) {
    closePopover();
    getEngine().then(function (eng) {
      if (!eng) return;
      var sugg = [];
      try { sugg = (eng.suggest(word) || []).slice(0, MAX_SUGGEST); } catch (_) {}
      pop = document.createElement('div');
      pop.className = 'antcv-spell-popover';
      pop.style.cssText = 'position:fixed;z-index:2147483500;background:#fff;border:1px solid rgba(40,53,86,0.3);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.25);padding:6px;min-width:140px;font-family:system-ui,sans-serif;font-size:12.5px;color:#1a2433;';
      pop.style.left = Math.min(anchorRect.left, window.innerWidth - 200) + 'px';
      pop.style.top = (anchorRect.bottom + 4) + 'px';
      function row(label, bold, onClick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = 'display:block;width:100%;text-align:left;padding:5px 8px;border:none;background:none;cursor:pointer;border-radius:5px;font-size:12.5px;' + (bold ? 'font-weight:700;' : '');
        b.addEventListener('mouseenter', function () { b.style.background = 'rgba(1,183,187,0.10)'; });
        b.addEventListener('mouseleave', function () { b.style.background = 'none'; });
        b.addEventListener('click', onClick);
        pop.appendChild(b);
        return b;
      }
      if (!sugg.length) {
        var none = document.createElement('div');
        none.textContent = 'No suggestions';
        none.style.cssText = 'padding:5px 8px;color:#888;';
        pop.appendChild(none);
      }
      sugg.forEach(function (s) {
        row(s, true, function () {
          var v = field.value || '';
          // replace the FIRST whole-word occurrence of `word`
          var re = new RegExp('(^|[^A-Za-zÀ-ɏ\'])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-zÀ-ɏ\'])');
          var nv = v.replace(re, function (_, pre) { return pre + s; });
          setNativeValue(field, nv);
          closePopover();
          schedule(field);
        });
      });
      var hr = document.createElement('div');
      hr.style.cssText = 'border-top:1px solid rgba(0,0,0,0.08);margin:4px 0;';
      pop.appendChild(hr);
      row('+ Add "' + word + '" to my dictionary', false, function () {
        addToUserDict(lang(), word);
        closePopover();
        schedule(field);
      });
      document.body.appendChild(pop);
      setTimeout(function () {
        document.addEventListener('pointerdown', function onDoc(ev) {
          if (pop && !pop.contains(ev.target)) { closePopover(); document.removeEventListener('pointerdown', onDoc); }
        });
      }, 0);
    });
  }

  // ─── field wiring ────────────────────────────────────────────────
  function eligible(el) {
    if (!el || (el.tagName !== 'TEXTAREA' && !(el.tagName === 'INPUT' && (el.type === 'text' || el.type === '')))) return false;
    // CV/CL editor fields live in the editor side panel (the expanded
    // section editors render OUTSIDE their [data-section-row-index] row).
    if (!el.closest('.antcv-editor-side-panel')) return false;
    if (el.closest('.antcv-preview-paper')) return false;
    // exclusions per spec: JD input block + JD/Signals textareas
    if (el.closest('#antcv-analysis-panel-jd-block')) return false;
    if (/jd|job description|signal/i.test(el.placeholder || '')) return false;
    return true;
  }
  var timers = new WeakMap();
  function schedule(field) {
    if (!enabled()) return;
    clearTimeout(timers.get(field));
    timers.set(field, setTimeout(function () { runCheck(field); }, DEBOUNCE_MS));
  }
  function runCheck(field) {
    if (!field.isConnected || !enabled()) return;
    getEngine().then(function (eng) {
      if (!eng || !field.isConnected) return;
      var marks = misspellings(field.value || '', eng, lang());
      syncOverlay(field, marks);
    });
  }
  document.addEventListener('focusin', function (ev) {
    var f = ev.target;
    if (!eligible(f) || f._antcvSpellWired) return;
    f._antcvSpellWired = true;
    f.addEventListener('input', function () { schedule(f); });
    f.addEventListener('scroll', function () {
      var ov = f._antcvSpellOv;
      if (ov) { ov.scrollTop = f.scrollTop; ov.scrollLeft = f.scrollLeft; }
    });
    f.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== f) closePopover(); }, 200); });
    schedule(f);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t && t.classList && t.classList.contains('antcv-spell-mark')) {
      var word = t.getAttribute('data-antcv-spell-word');
      var ovHost = t.closest('.antcv-spell-overlay');
      var field = ovHost && ovHost.parentElement
        ? ovHost.parentElement.querySelector('textarea,input')
        : null;
      if (word && field) openPopover(field, word, t.getBoundingClientRect());
    }
  });

  // ─── public API ──────────────────────────────────────────────────
  window.AntcvSpell = {
    version: VERSION,
    setEnabled: function (on) {
      try { localStorage.setItem('antcv:spell:enabled', on ? '1' : '0'); } catch (_) {}
    },
    check: function (text) {
      return getEngine().then(function (eng) {
        return eng ? misspellings(String(text || ''), eng, lang()) : [];
      });
    },
  };
})();
