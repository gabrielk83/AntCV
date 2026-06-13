/* AntCV mobile UI — consolidated (SIDECAR-MERGE-G5, 2026-06-13)
 * ============================================================================
 * Folds four independent mobile-UI sidecars into ONE file behind a SINGLE
 * shared rAF scheduler + a SINGLE MutationObserver (was 4 observers + 4
 * scheduler fans). Each module's behaviour + guards are preserved verbatim:
 *
 *   [275] topbar-cleanup    — hide the floating panel-escape X + stray
 *                             Compress/Enhance/CJLR controls in the export row.
 *   [351] fab-cleanup       — hide the mobile JD (🎯) + Fusion (🔀) FABs and
 *                             relocate/restyle the Privacy (🛡) FAB into the bar.
 *   [352] bottom-compact    — CSS-only: shrink the bottom-nav buttons so they
 *                             fit on narrow viewports.
 *   [354] alt-circles       — collapse the topbar palette swatches to a single
 *                             tap-to-open dropdown on mobile (stateful, capture-
 *                             phase click handling preserved exactly).
 *
 * Pure DOM + CSS, no fetch wrap, no app.js edit. The old per-file globals
 * (window.AntcvMobileTopbarCleanup275 / …Fab351 / …BottomCompact352 /
 * …AltCirclesDropdown354) are re-exposed for any debug callers.
 */
(function () {
  'use strict';
  var VERSION = '1.50.418';
  if (window.__antcvMobileUi418 === VERSION) return;
  window.__antcvMobileUi418 = VERSION;

  var MQ = '(max-width: 900px)';
  function isMobile() { try { return window.matchMedia(MQ).matches; } catch (_) { return window.innerWidth <= 900; } }

  // ───────────────────────── [275] topbar cleanup ─────────────────────────
  function t275_txt(el) { return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function t275_meta(el) { return (t275_txt(el) + ' ' + String(el && el.title || '') + ' ' + String(el && el.getAttribute && el.getAttribute('aria-label') || '')).toLowerCase(); }
  function t275_visible(el) { return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }
  function t275_isExportButton(b) { return /^pdf$/i.test(t275_txt(b)) || /^docx$/i.test(t275_txt(b)) || /\b(pdf|docx)\b/.test(t275_meta(b)); }
  function t275_isStray(b) {
    if (!b || t275_isExportButton(b)) return false;
    var t = t275_meta(b), s = t275_txt(b);
    return /compress|enhance|enrich|cjlr|alignment/.test(t) || /^(✨|↹|⇥⇤|⇤⇥|↔|☰|⇤|⇥)$/.test(s);
  }
  function t275_roots() {
    var roots = [];
    Array.from(document.querySelectorAll('button,[role="button"],a')).filter(t275_visible).forEach(function (b) {
      if (!t275_isExportButton(b)) return;
      var p = b.parentElement;
      for (var i = 0; p && p !== document.body && i < 6; i++, p = p.parentElement) {
        var tx = t275_meta(p);
        if (tx.indexOf('pdf') >= 0 && tx.indexOf('docx') >= 0) { if (roots.indexOf(p) < 0) roots.push(p); break; }
      }
    });
    return roots;
  }
  function run275() {
    try {
      var b = document.getElementById('antcv-panel-escape-btn');
      if (b) { b.setAttribute('data-antcv-mobile-top-x-hidden-275', '1'); b.style.display = 'none'; b.style.visibility = 'hidden'; b.style.pointerEvents = 'none'; }
      t275_roots().forEach(function (root) {
        Array.from(root.querySelectorAll('button,[role="button"],a')).forEach(function (bb) {
          if (!t275_isStray(bb)) return;
          bb.setAttribute('data-antcv-mobile-export-hidden-275', '1'); bb.style.display = 'none'; bb.style.visibility = 'hidden';
        });
      });
    } catch (e) { try { console.warn('[mobile-ui-418/275]', e && e.message); } catch (_) {} }
  }

  // ───────────────────────── [351] FAB cleanup ────────────────────────────
  var MOVED_ATTR = 'data-antcv-mobile-privacy-moved', HIDDEN_ATTR = 'data-antcv-mobile-fab-hidden';
  function f351_glyph(el) { return (el && el.textContent || '').trim(); }
  function f351_find(title, glyphChar) {
    return Array.from(document.querySelectorAll('button')).find(function (b) {
      var t = (b.getAttribute('title') || '').trim();
      if (t === title) return true;
      if (glyphChar && f351_glyph(b) === glyphChar && !b.hasAttribute('data-antcv-topbar-moved')) return true;
      return false;
    });
  }
  function f351_hide(btn) {
    if (!btn) return;
    if (btn.getAttribute(HIDDEN_ATTR) === '1' && btn.style.display === 'none') return;
    btn.style.setProperty('display', 'none', 'important'); btn.setAttribute(HIDDEN_ATTR, '1'); btn.setAttribute('aria-hidden', 'true'); btn.setAttribute('tabindex', '-1');
  }
  function f351_target() { return document.querySelector('.antcv-top-tools') || document.querySelector('.antcv-top-file-name') || document.querySelector('.antcv-topbar-title'); }
  function f351_stylePill(el) {
    var s = el.style;
    ['position:static', 'inset:auto', 'top:auto', 'bottom:auto', 'left:auto', 'right:auto', 'box-shadow:none', 'z-index:auto', 'width:auto', 'height:28px', 'min-width:28px', 'font-size:13px', 'border-radius:14px', 'display:inline-flex', 'align-items:center', 'gap:4px', 'color:#ffffff']
      .forEach(function (kv) { var i = kv.indexOf(':'); s.setProperty(kv.slice(0, i), kv.slice(i + 1), 'important'); });
    s.setProperty('margin', '0 0 0 6px', 'important');
    s.setProperty('padding', '0 8px', 'important');
    s.setProperty('background', 'rgba(1,183,187,0.22)', 'important');
    s.setProperty('border', '1px solid #01B7BB', 'important');
  }
  function f351_relocatePrivacy() {
    var target = f351_target(); if (!target) return;
    var priv = f351_find('Privacy Status', '🛡'); if (!priv) return;
    var desktopMoved = document.querySelector('button[data-antcv-privacy-led-fab="1"][data-antcv-topbar-moved="1"]');
    if (desktopMoved && desktopMoved !== priv) { f351_hide(priv); return; }
    if (priv.getAttribute(MOVED_ATTR) === '1' && priv.parentNode === (target.parentNode || target)) { f351_stylePill(priv); return; }
    f351_stylePill(priv);
    try {
      if (target.classList && target.classList.contains('antcv-top-tools')) target.insertBefore(priv, target.firstChild);
      else if (target.parentNode) target.parentNode.insertBefore(priv, target.nextSibling);
      priv.setAttribute(MOVED_ATTR, '1');
    } catch (_) {}
  }
  function run351() {
    try {
      f351_hide(f351_find('JD Analysis', '🎯'));
      f351_hide(f351_find('Fuse CV/CL', '🔀'));
      f351_relocatePrivacy();
    } catch (_) {}
  }

  // ───────────────────────── [354] alt-circles dropdown ───────────────────
  function c354_isCircle(el) {
    if (!el || el.nodeType !== 1 || el.tagName !== 'DIV') return false;
    var s = el.getAttribute('style') || '';
    if (!/border-radius:\s*50%/.test(s)) return false;
    if (!/cursor:\s*pointer/.test(s)) return false;
    if (!/width:\s*1[0-9]px/.test(s)) return false;
    return /^#[0-9a-fA-F]{3,8}$/.test((el.getAttribute('title') || '').trim());
  }
  function c354_isActive(el) {
    return /border:[^;]*\brgb\(255,\s*255,\s*255\)/.test(el.getAttribute('style') || '')
        || /border:[^;]*\bsolid\s*#fff\b/i.test(el.getAttribute('style') || '');
  }
  function c354_groups() {
    var seen = [], out = [];
    Array.prototype.forEach.call(document.querySelectorAll('div[title^="#"]'), function (c) {
      if (!c354_isCircle(c)) return;
      var p = c.parentElement; if (!p || seen.indexOf(p) >= 0) return;
      var kids = Array.prototype.filter.call(p.children, c354_isCircle);
      if (kids.length < 2) return;
      var r; try { r = p.getBoundingClientRect(); } catch (_) { r = { top: 0 }; }
      if (r.top > 140) return;
      seen.push(p); out.push({ host: p, circles: kids });
    });
    return out;
  }
  function c354_clearAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-antcv-altdrop="1"]'), function (h) { h.removeAttribute('data-antcv-altdrop'); h.removeAttribute('data-antcv-altdrop-open'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-antcv-altcircle="1"]'), function (c) { c.removeAttribute('data-antcv-altcircle'); c.removeAttribute('data-antcv-alttrigger'); });
  }
  function c354_paint() {
    if (!isMobile()) { c354_clearAll(); return; }
    c354_groups().forEach(function (g) {
      g.host.setAttribute('data-antcv-altdrop', '1');
      if (g.host.getAttribute('data-antcv-altdrop-open') !== '1') g.host.setAttribute('data-antcv-altdrop-open', '0');
      var open = g.host.getAttribute('data-antcv-altdrop-open') === '1';
      var trigger = null;
      for (var i = 0; i < g.circles.length; i++) { if (c354_isActive(g.circles[i])) { trigger = g.circles[i]; break; } }
      if (!trigger) trigger = g.circles[0];
      var tr = null; if (open) { try { tr = trigger.getBoundingClientRect(); } catch (_) { tr = null; } }
      var below = 0;
      g.circles.forEach(function (c) {
        c.setAttribute('data-antcv-altcircle', '1');
        if (c === trigger) { c.setAttribute('data-antcv-alttrigger', '1'); c.style.removeProperty('left'); c.style.removeProperty('top'); }
        else {
          c.removeAttribute('data-antcv-alttrigger');
          if (open && tr) { below++; c.style.setProperty('left', Math.round(tr.left) + 'px', 'important'); c.style.setProperty('top', Math.round(tr.bottom + 4 + (below - 1) * 20) + 'px', 'important'); }
          else { c.style.removeProperty('left'); c.style.removeProperty('top'); }
        }
      });
    });
  }
  // 354 capture-phase click: collapsed → open (swallow); open → switch + close.
  document.addEventListener('click', function (ev) {
    if (!isMobile()) return;
    var t = ev.target; if (!t || !t.closest) return;
    var host = t.closest('[data-antcv-altdrop="1"]'); if (!host) return;
    var circle = t.closest('[data-antcv-altcircle="1"]'); if (!circle || !host.contains(circle)) return;
    if (host.getAttribute('data-antcv-altdrop-open') === '1') {
      setTimeout(function () { host.setAttribute('data-antcv-altdrop-open', '0'); c354_paint(); }, 0);
    } else {
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      host.setAttribute('data-antcv-altdrop-open', '1'); c354_paint();
    }
  }, true);
  // tap elsewhere closes any open group
  document.addEventListener('click', function (ev) {
    if (!isMobile()) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-antcv-altdrop="1"][data-antcv-altdrop-open="1"]'), function (h) {
      if (!h.contains(ev.target)) h.setAttribute('data-antcv-altdrop-open', '0');
    });
  }, false);

  // ───────────────────────── shared CSS (275 + 352 + 354) ─────────────────
  function injectCss() {
    if (document.getElementById('antcv-mobile-ui-418-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-mobile-ui-418-css';
    s.textContent = [
      /* [275] */
      '#antcv-panel-escape-btn,[data-antcv-mobile-top-x-hidden-275="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;}',
      '[data-antcv-mobile-export-hidden-275="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;}',
      '@media (max-width:900px),(pointer:coarse){#antcv-panel-escape-btn{display:none!important;visibility:hidden!important;pointer-events:none!important;}}',
      /* [352] */
      '@media (max-width:640px){',
      '.antcv-react-bottom-nav{gap:2px!important;padding-left:2px!important;padding-right:2px!important;overflow-x:auto!important;}',
      '.antcv-react-bottom-nav button,.antcv-react-bottom-nav [role="button"]{font-size:10px!important;padding:0 6px!important;min-width:0!important;height:38px!important;line-height:1.05!important;letter-spacing:0!important;}',
      '.antcv-react-bottom-nav button svg{width:12px!important;height:12px!important;margin-right:3px!important;}',
      '}',
      '@media (max-width:380px){.antcv-react-bottom-nav button,.antcv-react-bottom-nav [role="button"]{font-size:9px!important;padding:0 4px!important;}}',
      /* [354] */
      '@media ' + MQ + '{',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="0"] [data-antcv-altcircle="1"]:not([data-antcv-alttrigger="1"]){display:none!important;}',
      '[data-antcv-altdrop="1"]{position:relative;}',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="1"]{z-index:9002;}',
      '[data-antcv-alttrigger="1"]{position:relative;}',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="1"] [data-antcv-altcircle="1"]:not([data-antcv-alttrigger="1"]){position:fixed!important;margin:0!important;z-index:2147483000!important;}',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="0"] [data-antcv-alttrigger="1"]::after{content:"";position:absolute;right:-2px;bottom:-2px;width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid rgba(255,255,255,.9);}',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  // ───────────────────────── shared scheduler + observer ──────────────────
  var pending = false;
  function sweep() { injectCss(); run275(); run351(); c354_paint(); }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; try { sweep(); } catch (_) {} });
  }

  function boot() {
    injectCss(); schedule();
    [80, 100, 200, 300, 500, 800, 1000, 1500, 1600, 2000, 3000, 4000].forEach(function (ms) { setTimeout(schedule, ms); });
    try {
      new MutationObserver(schedule).observe(document.body || document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'style', 'title', 'aria-label']
      });
    } catch (_) {}
    window.addEventListener('click', function () { setTimeout(schedule, 0); }, true);
    window.addEventListener('antcv:sections-updated', schedule);
    try { window.matchMedia(MQ).addEventListener('change', schedule); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // back-compat debug handles
  window.AntcvMobileTopbarCleanup275 = { version: '1.40.275', run: schedule };
  window.AntcvMobileFabCleanup351 = { version: '1.40.351', sweep: run351 };
  window.AntcvMobileBottomCompact352 = { version: '1.50.104' };
  window.AntcvMobileAltCirclesDropdown354 = { version: '1.50.113', paint: c354_paint };
  window.AntcvMobileUi418 = { version: VERSION, sweep: sweep };
  try { console.debug('[mobile-ui-418] consolidated 275+351+352+354 installed v' + VERSION); } catch (_) {}
})();
