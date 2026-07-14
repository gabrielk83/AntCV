/* AntCV preview spell overlay — PREVIEW-SPELL-001 (v1.50.425)
 * ============================================================================
 * Owner 2026-06-13: "implement the grammar checkers to show ALSO on preview,
 * not only in the panels." The editor annotator (antcv-spell-annotator-384)
 * deliberately skips .antcv-preview-paper. This sidecar adds spell underlines
 * to the RENDERED preview WITHOUT decorating React-owned nodes (CLAUDE.md:
 * never wrap/move React text nodes — it crashes the commit phase). Instead it:
 *   1. walks the preview's text nodes and checks them via window.AntcvSpell;
 *   2. for each misspelling, takes a Range over the word and reads its client
 *      rects;
 *   3. draws a red wavy underline mark at each rect in a SEPARATE fixed
 *      overlay layer (pointer-events on the marks only);
 *   4. click a mark -> popover with suggestions + "Add to dictionary";
 *      a suggestion edits the owning section in the sections store (scoped by
 *      its data-sid) and re-renders via antcv:sections-updated.
 * Reuses the annotator's engine + settings (master toggle antcv:spell:enabled,
 * per-language map, user dictionary). Re-scans (debounced) on preview
 * mutations / scroll / resize / sections-updated.
 */
(function () {
  'use strict';
  var VERSION = '1.50.425';
  if (window.__antcvPreviewSpellOverlay425 === VERSION) return;
  window.__antcvPreviewSpellOverlay425 = VERSION;

  var OVERLAY_ID = 'antcv-preview-spell-overlay';
  var MAX_MARKS = 400;

  function paper() { return document.querySelector('.antcv-preview-paper'); }
  function spellReady() { return !!(window.AntcvSpell && typeof window.AntcvSpell.check === 'function'); }
  function enabled() {
    try { return window.AntcvSpell && typeof window.AntcvSpell.enabled === 'function' ? window.AntcvSpell.enabled() : (localStorage.getItem('antcv:spell:enabled') !== '0'); }
    catch (_) { return true; }
  }

  function overlay() {
    var o = document.getElementById(OVERLAY_ID);
    if (!o) {
      o = document.createElement('div');
      o.id = OVERLAY_ID;
      o.className = 'no-print';
      o.setAttribute('aria-hidden', 'true');
      o.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9985;';
      document.body.appendChild(o);
    }
    return o;
  }
  function clearOverlay() { var o = document.getElementById(OVERLAY_ID); if (o) o.innerHTML = ''; }
  // GRAMMAR-MARKER-SCROLL-LAG-001 (owner 2026-06-13): the marks are fixed to
  // viewport coords, so during a scroll (esp. mobile) they lag behind the text
  // until the debounced rescan catches up. Hide them the instant a scroll starts
  // so a stale, misaligned underline is never shown; scan() shows them again once
  // it has redrawn at the new positions.
  function hideOverlayNow() { var o = document.getElementById(OVERLAY_ID); if (o) o.style.visibility = 'hidden'; }

  // collect text nodes inside the preview that carry real words
  function textNodes(root) {
    var out = [];
    try {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || !/[A-Za-zÀ-ɏ]{2,}/.test(n.nodeValue)) return NodeFilter.FILTER_SKIP;
          // skip bracketed template placeholders ("[Specialisation — …]")
          if (/^\s*\[/.test(n.nodeValue)) return NodeFilter.FILTER_SKIP;
          var p = n.parentElement;
          if (!p) return NodeFilter.FILTER_SKIP;
          if (p.closest('#' + OVERLAY_ID)) return NodeFilter.FILTER_SKIP;
          // NOTE: do NOT skip .no-print — the on-screen preview paper itself is
          // .no-print (print uses a separate render), so skipping it would
          // exclude all real content. Only skip the salmon splitter + chrome.
          if (p.closest('script,style,[data-antcv-salmon],button,select,textarea,input')) return NodeFilter.FILTER_SKIP;
          var cs = getComputedStyle(p);
          if (cs.visibility === 'hidden' || cs.display === 'none') return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nd;
      while ((nd = w.nextNode())) out.push(nd);
    } catch (_) {}
    return out;
  }

  function sidOf(node) {
    try {
      var el = node.parentElement;
      var host = el && el.closest('[data-sid]');
      return host ? host.getAttribute('data-sid') : null;
    } catch (_) { return null; }
  }

  function drawMark(rect, word, sid) {
    if (rect.width < 2 || rect.bottom < 0 || rect.top > window.innerHeight) return;
    var m = document.createElement('span');
    m.setAttribute('data-antcv-pspell-word', word);
    if (sid) m.setAttribute('data-antcv-pspell-sid', sid);
    m.style.cssText = 'position:fixed;left:' + Math.round(rect.left) + 'px;top:' + Math.round(rect.top) + 'px;'
      + 'width:' + Math.round(rect.width) + 'px;height:' + Math.round(rect.height) + 'px;'
      + 'pointer-events:auto;cursor:pointer;'
      + 'background-image:linear-gradient(45deg,transparent 65%,rgba(220,38,38,0.9) 65%,rgba(220,38,38,0.9) 80%,transparent 80%);'
      + 'background-size:4px 4px;background-repeat:repeat-x;background-position:left bottom;';
    overlay().appendChild(m);
  }

  // Cancel-token model: build all node checks, await them, and only the
  // newest scan draws — clearing AFTER the checks resolve (no flicker, no
  // sticky-flag deadlock when boot scans overlap the engine load).
  var scanToken = 0;
  function scan() {
    if (!spellReady() || !enabled()) { clearOverlay(); return; }
    var pp = paper();
    if (!pp) { clearOverlay(); return; }
    var myToken = ++scanToken;
    var nodes = textNodes(pp);
    if (!nodes.length) { clearOverlay(); return; }
    Promise.all(nodes.map(function (node) {
      return window.AntcvSpell.check(node.nodeValue || '').then(
        function (marks) { return { node: node, marks: marks || [] }; },
        function () { return { node: node, marks: [] }; }
      );
    })).then(function (results) {
      if (myToken !== scanToken) return; // superseded by a newer scan
      clearOverlay();
      overlay().style.visibility = ''; // re-show after a scroll-hide, now realigned
      var count = 0;
      results.forEach(function (res) {
        if (!res || !res.marks.length || !res.node.isConnected) return;
        res.marks.forEach(function (mk) {
          if (count >= MAX_MARKS) return;
          var r = document.createRange();
          try { r.setStart(res.node, mk.start); r.setEnd(res.node, mk.end); } catch (_) { return; }
          var rects = r.getClientRects();
          var sid = sidOf(res.node);
          for (var i = 0; i < rects.length; i++) { drawMark(rects[i], mk.word, sid); count++; }
        });
      });
    });
  }

  // ─── apply a fix into the sections store (scoped to the owning sid) ──
  function replaceWordInString(s, word, repl) {
    try {
      var re = new RegExp('(^|[^A-Za-zÀ-ɏ\'])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-zÀ-ɏ\'])');
      if (!re.test(s)) return s;
      return s.replace(re, function (_, pre) { return pre + repl; });
    } catch (_) { return s; }
  }
  function applyFix(sid, word, repl) {
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return false;
      var bundle = JSON.parse(raw);
      var changed = { done: false };
      var visit = function (obj, key) {
        if (changed.done) return;
        var v = obj[key];
        if (typeof v === 'string') {
          var nv = replaceWordInString(v, word, repl);
          if (nv !== v) { obj[key] = nv; changed.done = true; }
        } else if (Array.isArray(v)) { for (var i = 0; i < v.length && !changed.done; i++) visit(v, i); }
        else if (v && typeof v === 'object') { for (var k in v) { if (changed.done) break; visit(v, k); } }
      };
      var target = null;
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(bundle[doc])) return;
        var sec = bundle[doc].find(function (s2) { return s2 && s2.id === sid; });
        if (sec && !target) target = sec;
      });
      if (target) visit({ s: target }, 's');
      else { for (var d = 0; d < 2 && !changed.done; d++) { var doc = ['cv', 'cl'][d]; if (Array.isArray(bundle[doc])) visit(bundle, doc); } }
      if (!changed.done) return false;
      localStorage.setItem('sections', JSON.stringify(bundle));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'preview-spell-425' } })); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  // ─── popover ─────────────────────────────────────────────────────
  var pop = null;
  var popMark = null;
  function closePop() { if (pop && pop.parentElement) pop.parentElement.removeChild(pop); pop = null; popMark = null; }
  function openPop(mark) {
    closePop();
    popMark = mark;
    var word = mark.getAttribute('data-antcv-pspell-word');
    var sid = mark.getAttribute('data-antcv-pspell-sid');
    var r = mark.getBoundingClientRect();
    pop = document.createElement('div');
    pop.className = 'no-print';
    pop.style.cssText = 'position:fixed;z-index:2147483500;background:#fff;border:1px solid rgba(40,53,86,0.3);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.25);padding:6px;min-width:150px;font-family:system-ui,sans-serif;font-size:12.5px;color:#1a2433;';
    pop.style.left = Math.min(r.left, window.innerWidth - 200) + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    var loading = document.createElement('div');
    loading.textContent = 'checking…';
    loading.style.cssText = 'padding:5px 8px;color:#888;';
    pop.appendChild(loading);
    document.body.appendChild(pop);
    function btn(label, bold, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'display:block;width:100%;text-align:left;padding:5px 8px;border:none;background:none;cursor:pointer;border-radius:5px;font-size:12.5px;' + (bold ? 'font-weight:700;' : '');
      b.onmouseenter = function () { b.style.background = 'rgba(1,183,187,0.10)'; };
      b.onmouseleave = function () { b.style.background = 'none'; };
      b.onclick = fn;
      return b;
    }
    window.AntcvSpell.suggest(word).then(function (sugg) {
      if (!pop) return;
      pop.innerHTML = '';
      if (!sugg || !sugg.length) {
        var none = document.createElement('div'); none.textContent = 'No suggestions';
        none.style.cssText = 'padding:5px 8px;color:#888;'; pop.appendChild(none);
      }
      (sugg || []).forEach(function (s) {
        pop.appendChild(btn(s, true, function () { applyFix(sid, word, s); closePop(); setTimeout(scan, 120); }));
      });
      var hr = document.createElement('div'); hr.style.cssText = 'border-top:1px solid rgba(0,0,0,0.08);margin:4px 0;'; pop.appendChild(hr);
      pop.appendChild(btn('+ Add "' + word + '" to my dictionary', false, function () {
        try { window.AntcvSpell.addToDict(word); } catch (_) {}
        closePop(); setTimeout(scan, 120);
      }));
    });
    setTimeout(function () {
      document.addEventListener('pointerdown', function onDoc(ev) {
        if (pop && !pop.contains(ev.target) && ev.target !== mark) { closePop(); document.removeEventListener('pointerdown', onDoc); }
      });
    }, 0);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-antcv-pspell-word')) {
      // SPELL-MARK-EDIT-001 (owner 2026-07-14): first click shows the suggestion
      // popup; a SECOND click on the SAME underlined word closes it and lets the
      // click through so the caret lands and the word becomes editable (previously
      // preventDefault blocked editing of any spell-underlined word).
      if (pop && popMark === t) { closePop(); return; }
      ev.preventDefault(); openPop(t);
    }
  });

  // ─── scheduling ──────────────────────────────────────────────────
  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(scan, 500); }
  // Faster realign specifically after a scroll (the marks are hidden meanwhile).
  var st = null;
  function scrollSchedule() { hideOverlayNow(); clearTimeout(st); st = setTimeout(scan, 200); }
  // Ignore mutations that are ONLY our own overlay writes — otherwise drawing
  // marks re-triggers the observer and the overlay clears itself in a loop.
  function onMutations(muts) {
    for (var i = 0; i < muts.length; i++) {
      var tg = muts[i].target;
      var el = tg && (tg.nodeType === 1 ? tg : tg.parentElement);
      if (!el || !el.closest || !el.closest('#' + OVERLAY_ID)) { schedule(); return; }
    }
    // all mutations were inside the overlay — ignore
  }
  function boot() {
    schedule();
    [800, 1800, 3500].forEach(function (ms) { setTimeout(scan, ms); });
    try { new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (_) {}
    window.addEventListener('scroll', scrollSchedule, true);
    window.addEventListener('resize', scrollSchedule);
    window.addEventListener('antcv:sections-updated', schedule);
    try { window.addEventListener('antcv:language-changed', function () { setTimeout(scan, 300); }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvPreviewSpellOverlay = { version: VERSION, _scan: scan, _apply: applyFix };
  try { console.debug('[preview-spell-overlay-425] installed v' + VERSION); } catch (_) {}
})();
