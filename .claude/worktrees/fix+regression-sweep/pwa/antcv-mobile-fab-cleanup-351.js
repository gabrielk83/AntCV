/* AntCV mobile FAB cleanup + privacy relocation (v1.40.351)
 * ============================================================================
 *
 * Mobile-only counterpart to antcv-topbar-tools-347.js.
 *
 * Problem
 * -------
 * On mobile the app renders a DIFFERENT set of floating action buttons than
 * desktop. They are plain 52x52 round buttons identified ONLY by their title
 * text — they do NOT carry the data-antcv-recheck-fab / data-antcv-privacy-led-fab
 * attributes that topbar-tools-347 keys off, so that sidecar never touches them.
 * Result: on mobile the user still sees redundant JD (🎯) and Fusion (🔀) FABs,
 * and the Privacy (🛡) status floats instead of sitting in the top bar.
 *
 * Fix (user spec)
 * ---------------
 *   1. Hide the mobile JD-analysis FAB        (title "JD Analysis").
 *   2. Hide the mobile Fusion FAB             (title "Fuse CV/CL").
 *   3. Move the mobile Privacy FAB            (title "Privacy Status") into the
 *      top-bar tools row, styled as the SAME compact pill as desktop, but with
 *      a higher-contrast fill so it reads against the navy/teal bar (the native
 *      mobile button used rgba(255,255,255,0.16) which washes out).
 *
 * Identification
 * --------------
 * Buttons are matched by exact (trimmed) title text. The native mobile glyphs
 * confirm identity: JD=🎯, Fusion=🔀, Privacy=🛡. We match on title primarily
 * and treat glyph as a secondary guard so a future title rename still works if
 * the glyph is stable, and vice-versa.
 *
 * Top-bar target
 * --------------
 * Prefer the shared tools row .antcv-top-tools (same as desktop). If it isn't
 * present on the mobile layout, fall back to the topbar title container so the
 * pill still lands in the bar rather than floating.
 *
 * Idempotent, observer-driven, additive. No app.js edits.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.351';
  if (window.__antcvMobileFabCleanup351 === SCRIPT_VERSION) return;
  window.__antcvMobileFabCleanup351 = SCRIPT_VERSION;

  var MOVED_ATTR = 'data-antcv-mobile-privacy-moved';
  var HIDDEN_ATTR = 'data-antcv-mobile-fab-hidden';

  function txt(el) { return (el && (el.getAttribute('title') || el.textContent) || '').trim(); }
  function glyph(el) { return (el && el.textContent || '').trim(); }

  // A "mobile round FAB" is a 52x52-ish round button. We don't hard-require the
  // exact size; title match is the primary key.
  function allButtons() {
    return Array.from(document.querySelectorAll('button'));
  }

  function findByTitle(title, glyphChar) {
    return allButtons().find(function (b) {
      var t = (b.getAttribute('title') || '').trim();
      if (t === title) return true;
      // secondary: glyph match when title differs but icon is the native one
      if (glyphChar && glyph(b) === glyphChar && !b.hasAttribute('data-antcv-topbar-moved')) {
        // avoid matching the desktop privacy pill (has the dot span / different title)
        return true;
      }
      return false;
    });
  }

  function hideFab(btn) {
    if (!btn) return;
    if (btn.getAttribute(HIDDEN_ATTR) === '1' && btn.style.display === 'none') return;
    btn.style.setProperty('display', 'none', 'important');
    btn.setAttribute(HIDDEN_ATTR, '1');
    btn.setAttribute('aria-hidden', 'true');
    btn.setAttribute('tabindex', '-1');
  }

  function topbarTarget() {
    return document.querySelector('.antcv-top-tools')
        || document.querySelector('.antcv-top-file-name')
        || document.querySelector('.antcv-topbar-title');
  }

  // Compact desktop-style pill, but higher contrast for the mobile bar.
  function stylePrivacyPill(el) {
    var s = el.style;
    s.setProperty('position', 'static', 'important');
    s.setProperty('inset', 'auto', 'important');
    s.setProperty('top', 'auto', 'important');
    s.setProperty('bottom', 'auto', 'important');
    s.setProperty('left', 'auto', 'important');
    s.setProperty('right', 'auto', 'important');
    s.setProperty('margin', '0 0 0 6px', 'important');
    s.setProperty('box-shadow', 'none', 'important');
    s.setProperty('z-index', 'auto', 'important');
    // Desktop-identical compact pill dimensions.
    s.setProperty('width', 'auto', 'important');
    s.setProperty('height', '28px', 'important');
    s.setProperty('min-width', '28px', 'important');
    s.setProperty('padding', '0 8px', 'important');
    s.setProperty('font-size', '13px', 'important');
    s.setProperty('border-radius', '14px', 'important');
    s.setProperty('display', 'inline-flex', 'important');
    s.setProperty('align-items', 'center', 'important');
    s.setProperty('gap', '4px', 'important');
    // Higher-contrast fill vs the navy/teal bar: solid teal-tinted chip with a
    // bright teal border, white glyph. (Native mobile used translucent white
    // 0.16 which washed out.)
    s.setProperty('background', 'rgba(1,183,187,0.22)', 'important');
    s.setProperty('border', '1px solid #01B7BB', 'important');
    s.setProperty('color', '#ffffff', 'important');
  }

  function relocatePrivacy() {
    var target = topbarTarget();
    if (!target) return;
    var priv = findByTitle('Privacy Status', '🛡');
    if (!priv) return;
    // If the desktop pill (data-antcv-privacy-led-fab) is already moved into
    // the bar, the mobile one is redundant — hide the mobile duplicate.
    var desktopMoved = document.querySelector('button[data-antcv-privacy-led-fab="1"][data-antcv-topbar-moved="1"]');
    if (desktopMoved && desktopMoved !== priv) {
      hideFab(priv);
      return;
    }
    if (priv.getAttribute(MOVED_ATTR) === '1' && priv.parentNode === (target.parentNode || target)) {
      stylePrivacyPill(priv);
      return;
    }
    stylePrivacyPill(priv);
    // Place the pill right after the title/file-name block.
    try {
      if (target.classList && target.classList.contains('antcv-top-tools')) {
        target.insertBefore(priv, target.firstChild);
      } else if (target.parentNode) {
        target.parentNode.insertBefore(priv, target.nextSibling);
      }
      priv.setAttribute(MOVED_ATTR, '1');
    } catch (_) {}
  }

  function sweep() {
    // 1 + 2: hide redundant mobile JD + Fusion FABs.
    hideFab(findByTitle('JD Analysis', '🎯'));
    hideFab(findByTitle('Fuse CV/CL', '🔀'));
    // 3: relocate + restyle the mobile privacy FAB.
    relocatePrivacy();
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweep(); } catch (_) {}
    });
  }

  schedule();
  [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvMobileFabCleanup351 = { version: SCRIPT_VERSION, sweep: sweep };

  try { console.debug('[mobile-fab-cleanup-351] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
