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
  var VERSION = '1.50.569';
  window.__antcvSpellAnnotatorInstalled = VERSION;

  // SPELLERS-MATRIX-001 (owner 2026-06-17): full language matrix. Each language
  // is VARIANT-based (a default + selectable regional spellings), SINGLE (one
  // dictionary, no variants), or CONTEXT (zh — an LLM check, no Hunspell;
  // SPELL-ZH-CONTEXT-001). Variants WITHOUT a distinct Hunspell package map to
  // the language base dictionary (e.g. Danish Østdansk/Jysk dialects; Farsi
  // Iranian/Afghani; French regional) — the variant CHOICE is still recorded
  // (it informs the generation locale/register), spelling just falls back to
  // the base dictionary so it never breaks as the matrix grows.
  // Predecessors: SPELL-EN-VARIANT-001/002, SPELL-ES-VARIANT-001.
  var SPELL = {
    en: { def: 'gb', variants: { gb: 'dictionary-en-gb', us: 'dictionary-en-us', in: 'dictionary-en-in', ca: 'dictionary-en-ca', au: 'dictionary-en-au', za: 'dictionary-en-za' } },
    es: { def: 'uy', variants: { uy: 'dictionary-es-uy', es: 'dictionary-es-es', mx: 'dictionary-es-mx', ar: 'dictionary-es-ar', co: 'dictionary-es-co', cl: 'dictionary-es-cl', gq: 'dictionary-es-gq' } },
    da: { def: 'ost', variants: { ost: 'dictionary-da', jysk: 'dictionary-da' } },   // Østdansk (default) / Jysk dialects → same Hunspell base
    fr: { def: 'fr', variants: { fr: 'dictionary-fr', ca: 'dictionary-fr', be: 'dictionary-fr', ch: 'dictionary-fr' } },
    de: { def: 'de', variants: { de: 'dictionary-de', at: 'dictionary-de-at', ch: 'dictionary-de-ch' } },
    it: { def: 'it', variants: { it: 'dictionary-it', ch: 'dictionary-it' } },
    ar: { def: 'ar', variants: { ar: 'dictionary-ar', eg: 'dictionary-ar', ma: 'dictionary-ar', sa: 'dictionary-ar' } },
    fa: { def: 'ir', variants: { ir: 'dictionary-fa', af: 'dictionary-fa' } },        // Iranian (default) / Afghani Dari → same base
    he: { single: 'dictionary-he' },
    ru: { single: 'dictionary-ru' },
    tr: { single: 'dictionary-tr' },
    ku: { single: 'dictionary-ku' },
    sw: { single: 'dictionary-sw' },
    am: { single: 'dictionary-am' },
    fo: { single: 'dictionary-fo' },   // Faroese — real Hunspell dictionary
    vi: { single: 'dictionary-vi' },   // Vietnamese — real Hunspell dictionary
    kl: { single: 'dictionary-kl' },   // Greenlandic — no published dict yet → graceful no-op (loadDict 404s, no underline)
    zu: { single: 'dictionary-zu' },   // Zulu — no published dict yet → graceful no-op
    zh: { context: true },             // Chinese — NO Hunspell possible (no word boundaries) → AI 错别字 check
    th: { noHunspell: true },          // Thai — NO word boundaries either → no Hunspell; spelling cleanly disabled (avoids flagging a whole run)
  };
  // Flatten to key → npm package for the loader. Key is the dictKey identity:
  // 'en-gb', 'da-ost', 'fr-fr', or a bare 'he'/'ru' for single-dictionary langs.
  var DICT_PKG = {};
  (function () {
    for (var l in SPELL) {
      var c = SPELL[l];
      if (c.single) DICT_PKG[l] = c.single;
      else if (c.variants) for (var v in c.variants) DICT_PKG[l + '-' + v] = c.variants[v];
    }
  })();
  // The selected variant for a language. Reads the generic store
  // 'antcv:spell:variant:{lang}', honouring the legacy en/es-specific keys for
  // back-compat, and falls back to the language's default variant.
  function variantOf(l) {
    var c = SPELL[l];
    if (!c || !c.variants) return '';
    var stored = '';
    try {
      if (l === 'en') stored = localStorage.getItem('antcv:spell:enVariant') || '';
      else if (l === 'es') stored = localStorage.getItem('antcv:spell:esVariant') || '';
      if (!stored) stored = localStorage.getItem('antcv:spell:variant:' + l) || '';
    } catch (_) {}
    return (stored && c.variants[stored]) ? stored : c.def;
  }
  function enVariant() { return variantOf('en'); }   // kept for the public API + legacy settings card
  function esVariant() { return variantOf('es'); }
  // dictKey: cache + engine identity. Variant langs resolve to '{l}-{variant}';
  // single/context langs are the bare code.
  function dictKey(l) { var c = SPELL[l]; return (c && c.variants) ? l + '-' + variantOf(l) : l; }
  function hasDict(l) { var c = SPELL[l]; return !!(c && (c.single || c.variants)); }
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var DEBOUNCE_MS = 600;
  var MAX_SUGGEST = 6;

  // ─── settings ────────────────────────────────────────────────────
  function lang() {
    try {
      var raw = localStorage.getItem('language') || 'en';
      try { var p = JSON.parse(raw); if (typeof p === 'string') raw = p; } catch (_) {}
      var s = String(raw).toLowerCase();
      if (/^iw/.test(s)) return 'he';   // legacy ISO code for Hebrew
      // match the leading ISO 639-1 code against the configured matrix
      for (var code in SPELL) {
        if (s === code || s.indexOf(code + '-') === 0 || s.indexOf(code + '_') === 0) return code;
      }
      return 'en';
    } catch (_) { return 'en'; }
  }
  function enabled() {
    try {
      if (localStorage.getItem('antcv:spell:enabled') === '0') return false;
      var l = lang();
      // zh is allowed (LLM context check, SPELL-ZH-CONTEXT-001); only an unknown
      // non-zh language with no Hunspell dictionary is disabled.
      if (l !== 'zh' && !hasDict(l)) return false;
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
  function dictUrlsFor(key) {
    var base = window.__antcvSpellDictBase
      ? String(window.__antcvSpellDictBase).replace('{lang}', key)
      : CDN + DICT_PKG[key] + '@latest/';
    return { aff: base + 'index.aff', dic: base + 'index.dic' };
  }
  // Fetch one dictionary package; returns null (not a broken record) on any
  // 404 / network error so callers can fall back. (fetch() does NOT reject on
  // 404, so res.ok must be checked or nspell gets the 404 HTML as a dictionary.)
  async function fetchDictPkg(key) {
    if (!DICT_PKG[key]) return null;
    try {
      var u = dictUrlsFor(key);
      var ra = await fetch(u.aff); if (!ra.ok) return null;
      var rd = await fetch(u.dic); if (!rd.ok) return null;
      var aff = await ra.text(); var dic = await rd.text();
      if (!aff || !dic) return null;
      return { aff: aff, dic: dic, ts: 0 };
    } catch (_) { return null; }
  }
  async function loadDict(l) {
    var key = dictKey(l);
    var db = null;
    try { db = await idb(); } catch (_) {}
    if (db) {
      var cached = await idbGet(db, key);
      if (cached && cached.aff && cached.dic) return cached;
    }
    var rec = await fetchDictPkg(key);
    // Regional/dialect package missing on the CDN → fall back to the language's
    // DEFAULT variant package so spelling still works (e.g. de-at → de-de).
    if (!rec && key.indexOf('-') > 0) {
      var base = key.split('-')[0];
      var c = SPELL[base];
      if (c && c.variants) {
        var defKey = base + '-' + c.def;
        if (defKey !== key) rec = await fetchDictPkg(defKey);
      }
    }
    if (!rec) throw new Error('dictionary fetch failed for ' + key);
    if (db) await idbPut(db, key, rec);
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
    var k = dictKey(l);
    if (engine && engineLang === k) return Promise.resolve(engine);
    if (engineLoading) return engineLoading;
    engineLoading = (async function () {
      await loadVendor();
      var d = await loadDict(l);
      engine = window.nspell(d);
      engineLang = k;
      engineLoading = null;
      return engine;
    })().catch(function (e) {
      engineLoading = null;
      try { console.warn('[spell] engine init failed:', e && e.message); } catch (_) {}
      return null;
    });
    return engineLoading;
  }

  // ─── SPELL-ZH-CONTEXT-001: Chinese symbol-in-sentence fit (LLM) ─────
  // Hunspell can't segment Chinese, so zh uses a CONTEXT check instead of a
  // dictionary: an LLM finds 错别字 (characters that don't fit the sentence —
  // wrong homophone / mistyped / context-unfitting) and returns {wrong,correct}.
  // Results are cached per text + debounced through the same schedule(); marks
  // reuse the {word,start,end} shape so syncOverlay underlines them exactly like
  // a Hunspell miss, and the popover offers the correction. Only fires when the
  // document language is Chinese, so non-zh users never incur an LLM call.
  var ZH_MODEL = 'claude-opus-4-7';
  var ZH_SYS = 'You are a meticulous Simplified-Chinese proofreader. Find 错别字 — characters that are WRONG for the sentence (wrong homophone, mistyped, or context-unfitting character). Flag ONLY clear character errors; ignore wording, style, punctuation and grammar. Return STRICT JSON only, no markdown fences: {"errors":[{"wrong":"<exact wrong substring copied verbatim from the text>","correct":"<corrected substring>"}]}. Return {"errors":[]} if there are none.';
  var zhCache = Object.create(null);    // text -> marks[]
  var zhSuggest = Object.create(null);  // wrong substring -> [correct]
  var zhInflight = Object.create(null); // text -> Promise<marks>
  function hasHan(s) { return /[㐀-鿿]/.test(String(s || '')); }
  function zhProxyBase() {
    try {
      var v = JSON.parse(localStorage.getItem('proxyUrl') || '""');
      var b = String(v || '').replace(/\/+$/, '');
      if (!b && typeof window.ANTCV_RELAY_URL === 'string') b = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
      return b;
    } catch (_) { return ''; }
  }
  async function llmZhErrors(text) {
    var base = zhProxyBase();
    if (!base) return [];
    var res = await fetch(base + '/', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
      body: JSON.stringify({ model: ZH_MODEL, max_tokens: 700, stream: false, system: ZH_SYS, messages: [{ role: 'user', content: String(text || '') }] }),
    });
    var j = await res.json().catch(function () { return null; });
    var raw = (j && j.content && j.content[0] && j.content[0].text) || '';
    try {
      var parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
      return Array.isArray(parsed && parsed.errors) ? parsed.errors : [];
    } catch (_) { return []; }
  }
  function zhMarksFrom(text, errors) {
    var out = [];
    for (var i = 0; i < errors.length; i++) {
      var w = String((errors[i] && errors[i].wrong) || '');
      var c = String((errors[i] && errors[i].correct) || '');
      if (!w || w.length > 20) continue;
      if (c) zhSuggest[w] = [c];
      var from = 0, idx;
      while ((idx = text.indexOf(w, from)) >= 0) {
        out.push({ word: w, start: idx, end: idx + w.length });
        from = idx + w.length;
        if (out.length > 200) return out;
      }
    }
    return out;
  }
  function checkZh(text) {
    text = String(text || '');
    if (!text.trim() || !hasHan(text)) return Promise.resolve([]);
    if (zhCache[text]) return Promise.resolve(zhCache[text]);
    if (zhInflight[text]) return zhInflight[text];
    zhInflight[text] = llmZhErrors(text).then(function (errors) {
      var marks = zhMarksFrom(text, errors);
      zhCache[text] = marks;
      delete zhInflight[text];
      var keys = Object.keys(zhCache);
      if (keys.length > 40) delete zhCache[keys[0]];
      return marks;
    }).catch(function () { delete zhInflight[text]; return []; });
    return zhInflight[text];
  }

  // ─── word scan ───────────────────────────────────────────────────
  // Unicode letters so non-Latin scripts (Cyrillic ru, Arabic ar/fa, Hebrew he,
  // Ge'ez am) are scanned too, not just Latin. Apostrophes stay in-word.
  var WORD_RE = /[\p{L}’']{2,}/gu;
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
    // zh suggestions come from the LLM context check's cache; other languages
    // from the Hunspell engine.
    var suggP = (lang() === 'zh')
      ? Promise.resolve((zhSuggest[word] || []).slice(0, MAX_SUGGEST))
      : getEngine().then(function (eng) {
          try { return eng ? (eng.suggest(word) || []).slice(0, MAX_SUGGEST) : []; }
          catch (_) { return []; }
        });
    suggP.then(function (sugg) {
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
          var nv;
          if (lang() === 'zh') {
            // Chinese has no word boundaries — replace the first literal occurrence.
            var zi = v.indexOf(word);
            nv = zi >= 0 ? v.slice(0, zi) + s + v.slice(zi + word.length) : v;
          } else {
            // replace the FIRST whole-word occurrence of `word`
            var re = new RegExp('(^|[^A-Za-zÀ-ɏ\'])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-zÀ-ɏ\'])');
            nv = v.replace(re, function (_, pre) { return pre + s; });
          }
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
    if (lang() === 'zh') {
      checkZh(field.value || '').then(function (marks) {
        if (field.isConnected) syncOverlay(field, marks);
      });
      return;
    }
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

  // ─── Settings toggle UI (1.50.389 — the deferred half of the spec) ──
  // A small SPELLING block injected after the Settings PRIVACY providers
  // box (the same anchor the data-export button uses): master toggle +
  // per-language checkboxes bound to antcv:spell:enabled /
  // antcv:spell:langs. Idempotent; re-injects when Settings remounts.
  var UI_ID = 'antcv-spell-settings';
  function readLangsMap() {
    try { return JSON.parse(localStorage.getItem('antcv:spell:langs') || '{}') || {}; } catch (_) { return {}; }
  }
  function removeSettings() { var e = document.getElementById(UI_ID); if (e) e.remove(); }
  function injectSettings() {
    // SPELL-RELOCATE-001 (owner 2026-06-13): the SPELLING block used to sit in
    // the Account privacy zone. It now lives as a COLLAPSIBLE <details> directly
    // under the "Languages in the top bar" card in Settings → Personal, because
    // spelling is language-driven. Removed when that anchor is absent so it is
    // NOT sticky across subtabs.
    // LANGUAGES-CARD-CONSOLIDATE-001 (1.50.537): the Spelling controls now live
    // INSIDE the LanguageCard island's expand/collapse (fixes the intermittent
    // "fade"). When that island is present, remove this standalone card + skip.
    if (document.querySelector('[data-antcv-react-island="language-card"]')) { removeSettings(); return; }
    var langCard = document.getElementById('antcv-react-personal-languages');
    if (!langCard || !langCard.parentElement) { removeSettings(); return; }
    var col = langCard.parentElement;
    var existing = document.getElementById(UI_ID);
    if (existing) {
      if (existing.parentElement !== col) existing.remove();
      else return;
    }
    var box = document.createElement('details');
    box.id = UI_ID;
    // order:21 → directly under the Languages card (20), before Experience Tense (22).
    box.style.cssText = 'order:21;margin:6px 0 0;padding:0;width:100%;flex:0 0 100%;box-sizing:border-box;border:1px solid rgba(1,183,187,0.35);border-radius:8px;font-size:12px;color:#cfe9ea;';
    var sum = document.createElement('summary');
    sum.textContent = 'SPELLING';
    sum.style.cssText = 'cursor:pointer;user-select:none;font-size:10px;font-weight:700;letter-spacing:0.8px;color:#01B7BB;padding:9px 12px;list-style:none;text-transform:uppercase;';
    box.appendChild(sum);
    var body = document.createElement('div');
    body.style.cssText = 'padding:2px 12px 10px;';
    box.appendChild(body);

    function row(parent, label, checked, onChange) {
      var lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:7px;margin:3px 0;cursor:pointer;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.style.cursor = 'pointer';
      cb.addEventListener('change', function () { onChange(cb.checked); });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(label));
      parent.appendChild(lab);
      return cb;
    }

    var masterOn = (function () { try { return localStorage.getItem('antcv:spell:enabled') !== '0'; } catch (_) { return true; } })();
    row(body, 'Spelling underlines (editor + preview)', masterOn, function (v) {
      try { localStorage.setItem('antcv:spell:enabled', v ? '1' : '0'); } catch (_) {}
    });

    var per = readLangsMap();

    // English row + a UK / US variant selector (default UK).
    var enWrap = document.createElement('div');
    enWrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin:3px 0;flex-wrap:wrap;';
    var enLab = document.createElement('label');
    enLab.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:pointer;';
    var enCb = document.createElement('input');
    enCb.type = 'checkbox'; enCb.checked = per.en !== false; enCb.style.cursor = 'pointer';
    enCb.addEventListener('change', function () {
      var m = readLangsMap(); m.en = enCb.checked;
      try { localStorage.setItem('antcv:spell:langs', JSON.stringify(m)); } catch (_) {}
    });
    enLab.appendChild(enCb); enLab.appendChild(document.createTextNode('· English'));
    enWrap.appendChild(enLab);
    function paintVariants() {
      box.querySelectorAll('[data-antcv-en-variant]').forEach(function (x) {
        var on = enVariant() === x.getAttribute('data-antcv-en-variant');
        x.style.borderColor = on ? '#01B7BB' : 'rgba(255,255,255,0.18)';
        x.style.background = on ? 'rgba(1,183,187,0.12)' : 'transparent';
        x.style.color = on ? '#01B7BB' : 'rgba(255,255,255,0.7)';
      });
    }
    function variantBtn(code, label) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.setAttribute('data-antcv-en-variant', code);
      b.style.cssText = 'padding:2px 9px;font-size:10px;font-weight:700;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.18);background:transparent;color:rgba(255,255,255,0.7);';
      b.addEventListener('click', function () {
        try { localStorage.setItem('antcv:spell:enVariant', code); } catch (_) {}
        if (window.AntcvSpell && window.AntcvSpell._invalidate) window.AntcvSpell._invalidate();
        paintVariants();
        try { window.dispatchEvent(new CustomEvent('antcv:spell-variant-changed', { detail: { variant: code } })); } catch (_) {}
      });
      return b;
    }
    enWrap.appendChild(variantBtn('gb', 'UK'));
    enWrap.appendChild(variantBtn('us', 'US'));
    body.appendChild(enWrap);
    paintVariants();

    [['da', 'Dansk'], ['es', 'Español']].forEach(function (pair) {
      row(body, '· ' + pair[1], per[pair[0]] !== false, function (v) {
        var m = readLangsMap();
        m[pair[0]] = v;
        try { localStorage.setItem('antcv:spell:langs', JSON.stringify(m)); } catch (_) {}
      });
    });

    var note = document.createElement('div');
    note.innerHTML = 'Dictionaries follow the document language. English defaults to <strong>UK</strong>. Chinese uses a <strong>symbol-in-sentence-fit</strong> check (an AI proofreader for 错别字) since Hunspell can’t segment Chinese — it runs only when the document language is Chinese.';
    note.style.cssText = 'font-size:10.5px;color:rgba(255,255,255,0.42);margin-top:6px;line-height:1.45;';
    body.appendChild(note);

    col.appendChild(box);
  }
  var settingsTimer = null;
  var settingsMo = new MutationObserver(function () {
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(injectSettings, 600);
  });
  try { settingsMo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
  setTimeout(injectSettings, 2500);

  // ─── public API ──────────────────────────────────────────────────
  // PREVIEW-SPELL-001 (owner 2026-06-13): expose suggest / addToDict / lang /
  // enabled so the preview spell overlay (antcv-preview-spell-overlay-425.js)
  // can REUSE this engine + settings instead of loading a second copy.
  window.AntcvSpell = {
    version: VERSION,
    setEnabled: function (on) {
      try { localStorage.setItem('antcv:spell:enabled', on ? '1' : '0'); } catch (_) {}
    },
    check: function (text) {
      if (lang() === 'zh') return checkZh(String(text || ''));
      return getEngine().then(function (eng) {
        return eng ? misspellings(String(text || ''), eng, lang()) : [];
      });
    },
    suggest: function (word) {
      if (lang() === 'zh') return Promise.resolve((zhSuggest[String(word || '')] || []).slice(0, MAX_SUGGEST));
      return getEngine().then(function (eng) {
        try { return eng ? (eng.suggest(String(word || '')) || []).slice(0, MAX_SUGGEST) : []; }
        catch (_) { return []; }
      });
    },
    addToDict: function (word) { try { addToUserDict(lang(), String(word || '')); } catch (_) {} },
    lang: lang,
    enabled: enabled,
    // SPELL-EN-VARIANT-001: drop the cached engine so the next check() reloads
    // the dictionary for the current language + English variant (UK/US).
    _invalidate: function () { engine = null; engineLang = null; engineLoading = null; },
    _enVariant: enVariant,
    _esVariant: esVariant,
  };
})();
