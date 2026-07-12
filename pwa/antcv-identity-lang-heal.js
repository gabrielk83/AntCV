/* antcv-identity-lang-heal.js — BOOT-IDENTITY-LANG-HEAL-001 (owner 2026-07-12)
 * =====================================================================
 * The LANG-IDENTITY-SWITCH-001 restore legs run only AT the moment of a
 * language switch (the app.js ribbon call site). A document that is ALREADY
 * wrong — e.g. a Latin (da/en) ribbon whose contact line / Settings Location
 * still carries 哥本哈根 from an earlier zh session on an older bundle —
 * never self-repairs, and the stale identity re-seeds the wrong language
 * into every later generation (owner: "it is in Settings too — locked on
 * Chinese").
 *
 * This sidecar heals the identity render sources toward the ribbon script on
 * load and periodically: personalInfo name / city / citizenship /
 * specialization / location, contactItems[].value, and antcv:clSignName.
 * Stash-first (the __latin_* / __zh_* stashes the app writes); when no stash
 * exists it falls back to the owner-pinned renderings via a token map —
 * NAME-GUARDED to Gabriel's profile so the pins can never contaminate
 * another persona (see persona-contamination history).
 *
 * Data-level only: writes localStorage, wraps nothing. Idempotent — no
 * changes, no writes. Kill: localStorage['antcv:disable-identity-heal']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.356-identity-heal';
  if (window.__antcvIdentityLangHeal === VERSION) return;
  window.__antcvIdentityLangHeal = VERSION;

  // LOCALFORM-DA-CONDITIONAL-001 (owner 2026-07-12): translate-prompt hook read
  // by app.js at translate time (`${window.__antcvDaTermsRule()}` in the babel
  // prompt). When the app is Danish OR the job is in Denmark, babel keeps the
  // Danish institution terms verbatim; otherwise they translate normally.
  window.__antcvDaTermsRule = function () {
    try {
      var L = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2);
      var jd = String(localStorage.getItem('antcv:app:kernel:jdText') || '') + ' ' + String(localStorage.getItem('antcv:lastJdText') || '');
      var keep = L === 'da' || /(danmark|denmark|københavn|copenhagen|aarhus|århus|odense|aalborg|ballerup|birkerød|smørum|dk-\d{4})/i.test(jd);
      return keep ? '- Keep the Danish terms "foreningsarbejde" and "Ingeniørforening" VERBATIM (Denmark-based application).\n' : '';
    } catch (_) { return ''; }
  };
  try { if (localStorage.getItem('antcv:disable-identity-heal') === '1') return; } catch (_) {}

  var WIDE_RE = /[一-鿿㐀-䶿֐-׿؀-ۿሀ-፿]/;
  var CJK_RE = /[一-鿿㐀-䶿]/;

  function lang() {
    try {
      var v = localStorage.getItem('language') || '';
      if (v && v.charAt(0) === '"') v = JSON.parse(v);
      return String(v || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
    } catch (_) { return 'en'; }
  }
  function isWideLang(L) { return L === 'zh' || L === 'he' || L === 'am' || L === 'ar'; }

  // Owner pins — applied ONLY when the profile is Gabriel's (name guard).
  function isGabriel(pi) {
    var cands = [pi.name, pi.__latin_name, pi.__zh_name];
    for (var i = 0; i < cands.length; i++) {
      var n = String(cands[i] || '');
      if (/gabriel/i.test(n) || n.indexOf('加百列') >= 0) return true; // 加百列
    }
    return false;
  }
  // Token map for the Latin direction (zh tokens -> Latin rendering; da vs en
  // spelling chosen by ribbon). Longest tokens first so 哥本哈根南 wins over 哥本哈根.
  function latinTokenMap(L) {
    var kbh = L === 'da' ? 'København' : 'Copenhagen';
    return [
      ['哥本哈根南', kbh + ' S'],          // 哥本哈根南
      ['哥本哈根', kbh],                        // 哥本哈根
      ['欧盟公民', L === 'da' ? 'EU-borger' : 'EU Citizen'], // 欧盟公民
      ['柯葛顺·加百列·亚历山大', 'Gabriel Alexander Karp-Gershon'], // full zh name pin
      ['加百列', 'Gabriel'],                        // 加百列
      ['丹麦', L === 'da' ? 'Danmark' : 'Denmark'],     // 丹麦
    ];
  }
  function applyTokens(v, map) {
    var out = String(v);
    for (var i = 0; i < map.length; i++) {
      while (out.indexOf(map[i][0]) >= 0) out = out.replace(map[i][0], map[i][1]);
    }
    // "哥本哈根 S" partial-translation artifact leaves a doubled suffix after
    // token replace ("København S S") — collapse it.
    out = out.replace(/(København|Copenhagen) S\s+S\b/, '$1 S').replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  function healToLatin(pi, L, log) {
    var changed = false;
    var gab = isGabriel(pi);
    var map = latinTokenMap(L);
    ['name', 'city', 'citizenship', 'specialization', 'location'].forEach(function (f) {
      var cur = pi[f];
      if ('string' != typeof cur || !WIDE_RE.test(cur)) return;
      var stash = pi['__latin_' + f];
      var next = ('string' == typeof stash && stash.trim() && !WIDE_RE.test(stash)) ? stash
        : (gab && CJK_RE.test(cur)) ? applyTokens(cur, map) : null;
      if (next && next !== cur && !WIDE_RE.test(next)) {
        pi['__zh_' + f] = cur; pi[f] = next; changed = true; log.push(f);
      }
    });
    if (Array.isArray(pi.contactItems)) pi.contactItems.forEach(function (ci, i) {
      if (!ci || 'string' != typeof ci.value || !WIDE_RE.test(ci.value)) return;
      var next = ('string' == typeof ci.__latin && ci.__latin.trim() && !WIDE_RE.test(ci.__latin)) ? ci.__latin
        : (gab && CJK_RE.test(ci.value)) ? applyTokens(ci.value, map) : null;
      if (next && next !== ci.value && !WIDE_RE.test(next)) {
        ci.__zh = ci.value; ci.value = next; changed = true; log.push('contact' + i);
      }
    });
    return changed;
  }

  function healToWide(pi, L, log) {
    // Stash-first only; pin fallback for zh (the only wide language with
    // owner-pinned identity renderings).
    var changed = false;
    var gab = isGabriel(pi);
    var zhPins = { name: '柯葛顺·加百列·亚历山大', city: '哥本哈根', citizenship: '欧盟公民' };
    // LOCALFORM-DA-CONDITIONAL-001 (owner 2026-07-12, refines DA-ALWAYS): the
    // Danish location ("2300, København S") stays Danish only when the app is
    // Danish OR the JOB is in Denmark; a China-job zh app localizes it.
    var __keepDaLoc = (function () {
      try {
        var L = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2);
        if (L === 'da') return true;
        var jd = String(localStorage.getItem('antcv:app:kernel:jdText') || '') + ' ' + String(localStorage.getItem('antcv:lastJdText') || '');
        return /(danmark|denmark|københavn|copenhagen|aarhus|århus|odense|aalborg|ballerup|birkerød|smørum|dk-\d{4})/i.test(jd);
      } catch (_) { return true; }
    })();
    ['name', 'city', 'citizenship', 'specialization'].concat(__keepDaLoc ? [] : ['location']).forEach(function (f) {
      var cur = pi[f];
      if ('string' != typeof cur || !cur.trim() || WIDE_RE.test(cur)) return;
      var stash = pi['__zh_' + f];
      var next = ('string' == typeof stash && WIDE_RE.test(stash)) ? stash
        : (L === 'zh' && gab && zhPins[f]) ? zhPins[f] : null;
      if (next && next !== cur) {
        pi['__latin_' + f] = cur; pi[f] = next; changed = true; log.push(f);
      }
    });
    if (Array.isArray(pi.contactItems)) pi.contactItems.forEach(function (ci, i) {
      if (!ci || 'string' != typeof ci.value || !ci.value.trim() || WIDE_RE.test(ci.value)) return;
      // LOCALFORM-DA-CONDITIONAL-001: a Danish postal location contact item only
      // stays Danish when the app is Danish or the job is in Denmark.
      if (__keepDaLoc && (/^\d{4},?\s/.test(ci.value) || /københavn/i.test(ci.value))) return;
      if ('string' == typeof ci.__zh && WIDE_RE.test(ci.__zh)) {
        ci.__latin = ci.value; ci.value = ci.__zh; changed = true; log.push('contact' + i);
      }
    });
    return changed;
  }

  function healSignName(L) {
    try {
      var sn = localStorage.getItem('antcv:clSignName');
      if (!sn) return false;
      if (isWideLang(L)) {
        if (WIDE_RE.test(sn)) return false;
        var snZ = localStorage.getItem('antcv:clSignName_zh');
        if (snZ && WIDE_RE.test(snZ)) {
          localStorage.setItem('antcv:clSignName_latin', sn);
          localStorage.setItem('antcv:clSignName', snZ);
          return true;
        }
      } else {
        if (!WIDE_RE.test(sn)) return false;
        var snL = localStorage.getItem('antcv:clSignName_latin');
        if (!snL || WIDE_RE.test(snL)) {
          // pin fallback, Gabriel only (加百列 -> Gabriel)
          if (sn.indexOf('加百列') < 0) return false;
          snL = 'Gabriel';
        }
        localStorage.setItem('antcv:clSignName_zh', sn);
        localStorage.setItem('antcv:clSignName', snL);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function heal() {
    try {
      var L = lang();
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      if (!pi || 'object' != typeof pi) return;
      var log = [];
      var changed = isWideLang(L) ? healToWide(pi, L, log) : healToLatin(pi, L, log);
      if (changed) localStorage.setItem('personalInfo', JSON.stringify(pi));
      var snChanged = healSignName(L);
      if (changed || snChanged) {
        try { console.info('[identity-heal] healed toward "' + L + '":', log.join(',') + (snChanged ? ',signName' : '')); } catch (_) {}
        try { window.dispatchEvent(new Event('antcv:sections-updated')); } catch (_) {}
      }
    } catch (_) {}
  }

  [2500, 8000].forEach(function (d) { setTimeout(heal, d); });
  setInterval(heal, 15000);
  window.addEventListener('antcv:language-changed', function () { setTimeout(heal, 900); });
  window.AntcvIdentityLangHeal = { version: VERSION, _heal: heal, _applyTokens: applyTokens, _latinTokenMap: latinTokenMap };
})();
