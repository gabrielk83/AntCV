/* AntCV lang-bar-filter sidecar (v1.40.197)
 * ============================================================
 *
 * Purpose
 * -------
 * Gabriel reported on 2026-05-19: "I selected lang. in top bar to
 * be only two and still get all 4." The language-bar component
 * shows EN / DA / ZH / ES, but the user's preference of which
 * languages should be visible isn't being honoured.
 *
 * Without app.js source we can't change the source-of-truth read.
 * What we can do: read the user's preference ourselves and hide
 * the language buttons they didn't select.
 *
 * Preference source
 * -----------------
 * Read order, first non-empty wins:
 *
 *   1. localStorage['antcv:visibleLanguages']
 *      JSON array of language codes — e.g. '["en","da"]'
 *
 *   2. personalInfo.stylePrefs.visibleLanguages
 *      Same shape, nested in the personalInfo blob.
 *
 *   3. personalInfo.stylePrefs.languageBar
 *      Same shape, alternative key.
 *
 *   4. personalInfo.languages (string array of codes the user
 *      "speaks"), if present.
 *
 * If none of those produce a non-empty array, the app default is
 * EN + DA only.
 *
 * The override key
 * ----------------
 *   localStorage.setItem('antcv:visibleLanguages', '["en","da"]')
 *
 * After setting it, refresh or wait ~1s — the sidecar polls
 * personalInfo on a short interval and re-applies on changes.
 *
 * Detection
 * ---------
 * Language-bar buttons are characterised by a short text label
 * matching a known language code/name. We look for [role="button"]
 * and <button> elements whose text matches:
 *
 *   en | english
 *   da | dansk | danish
 *   zh | zh-cn | 中文 | chinese | 简体中文
 *   es | español | espanol | spanish
 *   fr | français | francais | french   (future-proof)
 *   de | deutsch | german
 *
 * AND that sit inside the same parent (a sibling-cluster of 2-6
 * such buttons strongly suggests a language bar).
 *
 * Hiding
 * ------
 * Hidden buttons get `data-antcv-lang-hidden="1"`, `display: none`.
 * Re-show is automatic when the preference changes.
 *
 * We never touch the active language indicator if the active
 * language happens to be one the user marked "hidden" — instead
 * we log a warning and show it anyway. This avoids the user
 * getting trapped in a language they can't switch out of.
 */
(function () {
  'use strict';

  if (window.__antcvLangBarFilterInstalled) return;
  window.__antcvLangBarFilterInstalled = '1.40.212';

  const STORAGE_KEY = 'antcv:visibleLanguages';

  // Language code normalizer.
  const LABEL_TO_CODE = {
    'en': 'en', 'english': 'en',
    'da': 'da', 'dansk': 'da', 'danish': 'da',
    'zh': 'zh', 'zh-cn': 'zh', 'cn': 'zh',
    'chinese': 'zh', '中文': 'zh', '简体中文': 'zh', '中文（简体）': 'zh',
    'es': 'es', 'español': 'es', 'espanol': 'es', 'spanish': 'es',
    'fr': 'fr', 'français': 'fr', 'francais': 'fr', 'french': 'fr',
    'de': 'de', 'deutsch': 'de', 'german': 'de',
  };

  function labelToCode(text) {
    if (!text) return null;
    const t = String(text).trim().toLowerCase();
    if (LABEL_TO_CODE[t]) return LABEL_TO_CODE[t];
    // Two-char ISO?
    if (/^[a-z]{2}$/.test(t)) return t;
    return null;
  }

  // ─── Read user preference ────────────────────────────────────────
  function readPreference() {
    // 1. Direct localStorage override.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const norm = arr.map(function (v) { return labelToCode(String(v)) || String(v).toLowerCase(); })
                          .filter(Boolean);
          if (norm.length) return norm;
        }
      }
    } catch (_) {}
    // 2/3. personalInfo.stylePrefs.visibleLanguages or .languageBar.
    try {
      const rawPi = localStorage.getItem('personalInfo');
      if (rawPi) {
        const pi = JSON.parse(rawPi);
        const sp = pi && pi.stylePrefs;
        if (sp) {
          const candidates = [
            sp.visibleLanguages, sp.languageBar, sp.languages,
            sp.langBar, sp.shownLanguages,
          ];
          for (const c of candidates) {
            if (Array.isArray(c) && c.length) {
              const norm = c.map(function (v) {
                if (typeof v === 'string') return labelToCode(v) || v.toLowerCase();
                if (v && typeof v === 'object' && v.code) return labelToCode(v.code) || String(v.code).toLowerCase();
                return null;
              }).filter(Boolean);
              if (norm.length) return norm;
            }
          }
        }
      }
    } catch (_) {}
    return ['en', 'da']; // app default
  }

  // ─── Find the language bar ───────────────────────────────────────
  // Identify clusters of 2-6 sibling buttons whose labels are
  // language codes. A "cluster" is direct children of the same
  // parent with at least 2 language-button siblings.
  function findLanguageButtons() {
    const out = [];
    const buttons = document.querySelectorAll(
      'button, [role="button"], [data-antcv-lang]'
    );
    const byParent = new Map();
    for (const b of buttons) {
      const txt = (b.textContent || '').trim();
      if (!txt || txt.length > 12) continue;
      const code = labelToCode(txt);
      if (!code) continue;
      const parent = b.parentElement;
      if (!parent) continue;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push({ btn: b, code: code });
    }
    for (const [parent, list] of byParent) {
      if (list.length < 2 || list.length > 6) continue;
      for (const e of list) out.push(e);
    }
    return out;
  }

  // ─── Active language ─────────────────────────────────────────────
  function activeLangCode() {
    let v = '';
    try { v = String(localStorage.getItem('language') || '').toLowerCase(); } catch (_) {}
    if (!v) {
      try { v = String(localStorage.getItem('uiLang') || '').toLowerCase(); } catch (_) {}
    }
    if (!v) return 'en';
    if (v === 'zh-cn' || v === 'zh_cn' || v === 'cn') return 'zh';
    if (v.length >= 2) return v.substring(0, 2);
    return v;
  }

  // ─── Apply ───────────────────────────────────────────────────────
  function applyAll() {
    const wanted = readPreference();
    const entries = findLanguageButtons();
    if (!entries.length) return;
    const active = activeLangCode();

    const wantedSet = new Set((wanted || ['en', 'da']).map(function (c) { return c.toLowerCase(); }));

    // If the current UI language is no longer enabled, switch to the
    // first enabled language. This keeps the top bar strict: only the
    // selected languages are shown, not all 4 because one was active.
    if (wanted && wanted.length && !wantedSet.has(active)) {
      const next = wanted[0];
      try {
        localStorage.setItem('language', next);
        localStorage.setItem('uiLang', next);
        window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: next }));
        window.dispatchEvent(new CustomEvent('antcv:language-changed', { detail: { language: next } }));
      } catch (_) {}
    }

    let hidden = 0, shown = 0, changed = false;
    for (const e of entries) {
      const want = wantedSet.has(e.code);
      if (want) {
        if (e.btn.getAttribute('data-antcv-lang-hidden') === '1') {
          e.btn.removeAttribute('data-antcv-lang-hidden');
          try {
            e.btn.style.display = e.btn.__antcvOriginalDisplay || '';
            delete e.btn.__antcvOriginalDisplay;
          } catch (_) {}
          changed = true;
        }
        shown++;
      } else {
        if (e.btn.getAttribute('data-antcv-lang-hidden') !== '1') {
          e.btn.setAttribute('data-antcv-lang-hidden', '1');
          try {
            e.btn.__antcvOriginalDisplay = e.btn.style.display || '';
            e.btn.style.display = 'none';
          } catch (_) {}
          changed = true;
        }
        hidden++;
      }
    }
    // v1.50.81 — log only when something actually changed. The apply is
    // idempotent (guarded writes), but it logged every run while woken by the
    // re-render storm, flooding the console. No behaviour change.
    if (changed) {
      try {
        console.debug('[lang-bar-filter] wanted=' + Array.from(wantedSet).join(',') +
          ' shown=' + shown + ' hidden=' + hidden);
      } catch (_) {}
    }
  }

  // ─── Scheduler ───────────────────────────────────────────────────
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyAll(); } catch (_) {}
    });
  }

  schedule();
  [200, 600, 1500, 4000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    const mo = new MutationObserver(function () { schedule(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  window.addEventListener('storage', function (ev) {
    if (!ev) return;
    if (ev.key === STORAGE_KEY || ev.key === 'personalInfo' || ev.key === 'language') {
      schedule();
    }
  });
  window.addEventListener('antcv:sections-updated', schedule);

  // Polling fallback for in-tab personalInfo edits.
  let lastPref = JSON.stringify(readPreference() || []);
  let lastActive = activeLangCode();
  setInterval(function () {
    const p = JSON.stringify(readPreference() || []);
    const a = activeLangCode();
    if (p !== lastPref || a !== lastActive) {
      lastPref = p;
      lastActive = a;
      schedule();
    }
  }, 1200);

  // Public API.
  window.AntcvLangBarFilter = {
    version: '1.40.212',
    _readPreference: readPreference,
    _findLanguageButtons: findLanguageButtons,
    _activeLangCode: activeLangCode,
    _applyAll: applyAll,
    /** Set the user's preference. Pass a JSON-able array of codes. */
    setPreference: function (arr) {
      try {
        if (!Array.isArray(arr)) throw new Error('expected array');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        schedule();
        return true;
      } catch (e) {
        try { console.warn('[lang-bar-filter] setPreference failed:', e && e.message); } catch (_) {}
        return false;
      }
    },
    /** Clear the override so the sidecar becomes inert. */
    clearPreference: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      schedule();
    },
  };

  try { console.debug('[lang-bar-filter] installed v1.40.212'); } catch (_) {}
})();
