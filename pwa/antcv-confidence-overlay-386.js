/* AntCV — FEATURE-CONF-001 (v1.50.386)
 * ============================================================
 *
 * Confidence overlay (owner spec 2026-06-04): a toggle (default OFF) that
 * tints document content by the app's confidence in it — low = reddish,
 * medium = yellowish; hovering shows the issue.
 *
 * v1 scoring is a DETERMINISTIC GROUNDING CHECK, not an LLM pass: each
 * sentence in the preview is scored against the candidate's own source
 * facts (personalInfo strings + work/education history). Content tokens and
 * NUMBERS that don't appear anywhere in the source lower the confidence —
 * exactly the "unsupported claim" signal the spec describes, at zero LLM
 * cost. The scorer is pluggable: window.AntcvConfidence.setScores(map)
 * (e.g. from a future worker self-check pass) overrides the heuristic per
 * normalized sentence.
 *
 * Granularity: tints apply per preview BLOCK (bullet/paragraph element),
 * coloured by its LOWEST-confidence sentence; the tooltip lists every
 * flagged sentence + issue. Style-only mutation (background + title), the
 * same class of preview decoration as the item-align sidecar — no DOM
 * structure changes inside React-owned text.
 *
 * UI: a "🎚 Confidence" chip injected into the Analysis panel's report row
 * (the Application tab), plus window.AntcvConfidence.{toggle,setEnabled}.
 * State: localStorage antcv:confidence:on. Export output is never touched.
 */
(function () {
  'use strict';

  if (window.__antcvConfidenceOverlayInstalled) return;
  var VERSION = '1.50.386';
  window.__antcvConfidenceOverlayInstalled = VERSION;

  var KEY = 'antcv:confidence:on';
  var LOW = 0.4, MED = 0.7;
  var TINT_LOW = 'rgba(200,40,40,0.14)', TINT_MED = 'rgba(217,160,20,0.16)';
  var overrides = {};   // normalized sentence -> { confidence, issue }

  function on() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
  function setOn(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {} apply(); paintChip(); }

  // ─── source corpus ───────────────────────────────────────────────
  var corpusCache = null, corpusAt = 0;
  function corpus() {
    if (corpusCache && Date.now() - corpusAt < 5000) return corpusCache;
    var words = new Set(), numbers = new Set();
    function eat(v) {
      if (v == null) return;
      if (typeof v === 'string') {
        var m = v.toLowerCase().match(/[a-zà-ɏ]{4,}|\d+(?:[.,]\d+)?/g) || [];
        m.forEach(function (t) { (/^\d/.test(t) ? numbers : words).add(t.replace(',', '.')); });
      } else if (Array.isArray(v)) v.forEach(eat);
      else if (typeof v === 'object') Object.keys(v).forEach(function (k) { eat(v[k]); });
    }
    try { eat(JSON.parse(localStorage.getItem('personalInfo') || '{}')); } catch (_) {}
    try { eat(JSON.parse(localStorage.getItem('kernel') || 'null')); } catch (_) {}
    corpusCache = { words: words, numbers: numbers };
    corpusAt = Date.now();
    return corpusCache;
  }

  // ─── scoring ─────────────────────────────────────────────────────
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function scoreSentence(sentence) {
    var n = norm(sentence);
    if (overrides[n]) return overrides[n];
    var c = corpus();
    var toks = n.match(/[a-zà-ɏ]{4,}/g) || [];
    var nums = n.match(/\d+(?:[.,]\d+)?/g) || [];
    if (toks.length + nums.length < 3) return { confidence: 1, issue: '' };
    var hit = 0;
    toks.forEach(function (t) { if (c.words.has(t)) hit++; });
    var support = toks.length ? hit / toks.length : 1;
    var missingNums = nums.filter(function (x) { return !c.numbers.has(x.replace(',', '.')); });
    var conf = support;
    var issues = [];
    if (missingNums.length) {
      conf = Math.min(conf, 0.35);
      issues.push('number' + (missingNums.length > 1 ? 's' : '') + ' ' + missingNums.join(', ') + ' not found in your source facts');
    }
    if (support < LOW) issues.push('low overlap with your background (' + Math.round(100 * support) + '%)');
    else if (support < MED) issues.push('partial overlap with your background (' + Math.round(100 * support) + '%)');
    return { confidence: conf, issue: issues.join('; ') };
  }
  function splitSentences(text) {
    return String(text || '').split(/(?<=[.!?])\s+|•/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 8; });
  }

  // ─── apply / strip ───────────────────────────────────────────────
  function blocks() {
    var out = [];
    document.querySelectorAll('.antcv-preview-paper [data-sid]').forEach(function (sec) {
      sec.querySelectorAll('[data-antcv-row-path], li, p').forEach(function (el) { out.push(el); });
      // text sections: the edit-path leaf's BLOCK parent
      sec.querySelectorAll('[data-edit-path]').forEach(function (sp) {
        var b = sp.parentElement;
        if (b && out.indexOf(b) < 0 && !b.closest('[data-antcv-row-path]')) out.push(b);
      });
    });
    return out;
  }
  function apply() {
    var enabled = on();
    blocks().forEach(function (el) {
      if (!enabled) {
        if (el.dataset.antcvConfTint) {
          el.style.background = el.dataset.antcvConfBgOrig || '';
          if (el.dataset.antcvConfTitleOrig !== undefined) el.title = el.dataset.antcvConfTitleOrig;
          else el.removeAttribute('title');
          delete el.dataset.antcvConfTint;
          delete el.dataset.antcvConfBgOrig;
          delete el.dataset.antcvConfTitleOrig;
        }
        return;
      }
      var text = el.textContent || '';
      var worst = 1, notes = [];
      splitSentences(text).forEach(function (s) {
        var r = scoreSentence(s);
        if (r.confidence < worst) worst = r.confidence;
        if (r.confidence < MED && r.issue) notes.push('"' + s.slice(0, 60) + (s.length > 60 ? '…' : '') + '" — ' + r.issue + ' (' + Math.round(100 * r.confidence) + '%)');
      });
      var tint = worst < LOW ? TINT_LOW : worst < MED ? TINT_MED : '';
      if (tint) {
        if (!el.dataset.antcvConfTint) {
          el.dataset.antcvConfBgOrig = el.style.background || '';
          if (el.hasAttribute('title')) el.dataset.antcvConfTitleOrig = el.getAttribute('title');
        }
        el.dataset.antcvConfTint = worst < LOW ? 'low' : 'med';
        el.style.background = tint;
        el.title = 'Confidence ' + Math.round(100 * worst) + '%\n' + notes.join('\n');
      } else if (el.dataset.antcvConfTint) {
        el.style.background = el.dataset.antcvConfBgOrig || '';
        el.removeAttribute('title');
        delete el.dataset.antcvConfTint;
        delete el.dataset.antcvConfBgOrig;
      }
    });
  }

  // ─── toggle chip in the Analysis (Application) panel ─────────────
  var CHIP_ID = 'antcv-confidence-chip';
  function paintChip() {
    var c = document.getElementById(CHIP_ID);
    if (!c) return;
    var en = on();
    c.style.background = en ? '#b45309' : '#fff';
    c.style.color = en ? '#fff' : '#7a5410';
    c.textContent = '🎚 Confidence ' + (en ? 'ON' : 'OFF');
  }
  function injectChip() {
    if (document.getElementById(CHIP_ID)) return;
    var report = document.getElementById('antcv-analysis-report');
    if (!report) return;
    var anchor = report.querySelector('.arx-dl');
    var host = anchor ? anchor.parentElement : report;
    var chip = document.createElement('button');
    chip.id = CHIP_ID;
    chip.type = 'button';
    chip.title = 'Tint document content by confidence: red = low, yellow = medium. Hover a tinted block for the issue. Heuristic grounding check against your own source facts; preview-only, never exported.';
    chip.style.cssText = 'padding:8px 14px;font-size:12px;font-weight:700;border:1px solid #b45309;border-radius:8px;cursor:pointer;margin-left:6px;';
    chip.addEventListener('click', function () { setOn(!on()); });
    host.appendChild(chip);
    paintChip();
  }

  // ─── wiring ──────────────────────────────────────────────────────
  var t = null;
  var mo = new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () { injectChip(); if (on()) apply(); }, 500);
  });
  function boot() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    injectChip();
    if (on()) setTimeout(apply, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvConfidence = {
    version: VERSION,
    toggle: function () { setOn(!on()); },
    setEnabled: setOn,
    isEnabled: on,
    apply: apply,
    score: scoreSentence,
    setScores: function (map) {
      overrides = {};
      try { Object.keys(map || {}).forEach(function (k) { overrides[norm(k)] = map[k]; }); } catch (_) {}
      if (on()) apply();
    },
  };
})();
