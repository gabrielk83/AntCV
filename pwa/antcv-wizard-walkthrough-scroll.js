/* AntCV — wizard walk-through scroll fix (ONBOARD-001 / WIZARD-001)
 * ============================================================
 *
 * Symptom (owner, mobile screenshot): the "How should AntCV write?" /
 * "Step 6B — walk-through" writing-register picker runs off the bottom of the
 * screen. The register cards below "Cold Outreach" and the Next/Continue button
 * are unreachable because the wizard overlay does not scroll on mobile.
 *
 * Root: the step renders in app.js as a full-screen overlay with inline styles
 * (no stable class to target from CSS) — typically position:fixed, display:flex,
 * align-items:center, with no overflow-y. When the content is taller than the
 * viewport (every phone), flex-centering pins it and there is no scroll, so the
 * lower options + the Next button are clipped.
 *
 * Fix: locate the overlay by the unique heading text, and ON MOBILE ONLY make it
 * scrollable — overflow-y:auto + start content at the top (align-items:flex-start)
 * so the whole step (heading → all register cards → Next) scrolls into reach. The
 * immediate card child is de-clipped (max-height:none) so it can't re-trap the
 * overflow. Desktop is untouched; originals are restored if we leave the screen.
 *
 * Light + idempotent: a textContent guard (no reflow) skips all work off-screen;
 * an applied-marker prevents re-styling the same node; an 800ms poll re-applies if
 * the wizard re-renders a fresh overlay.
 */
(function () {
  'use strict';
  var VERSION = '1.50.122-walkthrough-scroll';
  if (window.__antcvWalkthroughScroll === VERSION) return;
  window.__antcvWalkthroughScroll = VERSION;

  var MARK = 'data-antcv-walkthrough-scroll';
  var MARKER_TEXT = 'How should AntCV write';
  var orig = new WeakMap();

  function isMobile() {
    try { return window.matchMedia('(max-width: 900px)').matches; }
    catch (_) { return (window.innerWidth || 999) <= 900; }
  }
  function viewportH() { return Math.max(320, window.innerHeight || 640); }

  // Cheap off-screen guard (textContent = no reflow), then a bounded scan for the
  // heading element itself.
  function findHeading() {
    var bt = '';
    try { bt = String((document.body && document.body.textContent) || ''); } catch (_) {}
    if (bt.indexOf(MARKER_TEXT) < 0) return null;
    var nodes = document.querySelectorAll('h1,h2,h3,p,div,span');
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || '').trim();
      if (t.indexOf(MARKER_TEXT) === 0 && t.length < 60) return nodes[i];
    }
    return null;
  }

  // Walk up from the heading to the full-screen overlay (fixed/absolute, ~full
  // height, anchored to the top). Fall back to the outermost ancestor below body.
  function findOverlay(heading) {
    var el = heading, chain = [];
    for (var i = 0; el && el !== document.body && el !== document.documentElement && i < 14; i++) {
      chain.push(el); el = el.parentElement;
    }
    var vpH = viewportH();
    for (var j = chain.length - 1; j >= 0; j--) {
      var cs; try { cs = getComputedStyle(chain[j]); } catch (_) { continue; }
      var r = chain[j].getBoundingClientRect();
      if ((cs.position === 'fixed' || cs.position === 'absolute') && r.height >= vpH * 0.8 && r.top <= 2) {
        return chain[j];
      }
    }
    return chain[chain.length - 1] || null;
  }

  function save(el, keys) {
    if (orig.has(el)) return;
    var o = {};
    for (var i = 0; i < keys.length; i++) o[keys[i]] = el.style.getPropertyValue(keys[i]);
    orig.set(el, o);
  }
  function setImp(el, k, v) { try { el.style.setProperty(k, v, 'important'); } catch (_) {} }

  function apply() {
    if (!isMobile()) return restore();
    var heading = findHeading();
    if (!heading) return restore();
    var overlay = findOverlay(heading);
    if (!overlay || overlay.getAttribute(MARK) === '1') return;

    save(overlay, ['overflow-y', 'align-items', 'justify-content', '-webkit-overflow-scrolling']);
    setImp(overlay, 'overflow-y', 'auto');
    overlay.style.setProperty('-webkit-overflow-scrolling', 'touch');
    var cs; try { cs = getComputedStyle(overlay); } catch (_) { cs = null; }
    if (cs && String(cs.display).indexOf('flex') >= 0) {
      setImp(overlay, 'align-items', 'flex-start');           // start at top so tall content can scroll
      if (cs.justifyContent === 'center') setImp(overlay, 'justify-content', 'flex-start');
    }
    overlay.setAttribute(MARK, '1');

    // De-clip the immediate card child that holds the heading so it can't re-trap
    // the overflow with its own max-height.
    var card = heading;
    while (card && card.parentElement && card.parentElement !== overlay) card = card.parentElement;
    if (card && card !== heading && card.parentElement === overlay) {
      save(card, ['max-height', 'overflow', 'overflow-y']);
      setImp(card, 'max-height', 'none');
      setImp(card, 'overflow-y', 'visible');
      card.setAttribute(MARK, '1');
    }
  }

  function restore() {
    var marked = document.querySelectorAll('[' + MARK + '="1"]');
    for (var i = 0; i < marked.length; i++) {
      var el = marked[i], o = orig.get(el);
      if (o) {
        for (var k in o) { if (o[k]) el.style.setProperty(k, o[k]); else el.style.removeProperty(k); }
      }
      el.removeAttribute(MARK);
    }
  }

  function tick() { try { apply(); } catch (_) {} }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  }
  window.addEventListener('load', tick);
  window.addEventListener('resize', tick);
  window.addEventListener('orientationchange', tick);
  setInterval(tick, 800);
  tick();

  window.AntcvWalkthroughScroll = { _apply: apply, _restore: restore, _find: findHeading };
})();
