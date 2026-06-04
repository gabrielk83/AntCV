/* AntCV top-bar "Application history" -> "History" rename (v1.0.0)
 * Owner: the top-panel button label "Application history" is too long. Rename
 * it to "History" to save space.
 *
 * SCOPE: only the TOP-BAR label span — identified by its ellipsis/clamped
 * style (text-overflow:ellipsis; white-space:nowrap; max-width). We deliberately
 * do NOT touch the Settings subtab also named "Application history", because
 * antcv-settings-front-327 navigates by clicking a button whose text === that
 * string. Renaming that would break the "Open in Settings → Application history"
 * route.
 *
 * Light + idempotent: runs on load + a few timers + a 2s poll + on click. No
 * whole-document MutationObserver (keeps it out of the re-render herd). After
 * the rewrite the text is "History", so it no longer matches and is left alone.
 */
(function () {
  'use strict';
  if (window.__antcvLabelHistory) return;
  window.__antcvLabelHistory = '1.0.0';

  function rename() {
    try {
      var spans = document.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i];
        if (s.children && s.children.length) continue;
        if ((s.textContent || '').trim() !== 'Application history') continue;
        // Top-bar label only: it is the ellipsis-clamped one. The Settings
        // subtab of the same name is NOT clamped this way.
        var st = s.style || {};
        var clamped = st.textOverflow === 'ellipsis' || st.whiteSpace === 'nowrap' || st.maxWidth;
        if (!clamped) continue;
        s.textContent = 'History';
      }
    } catch (_) {}
  }

  function boot() {
    rename();
    [150, 400, 1000, 2200, 4000].forEach(function (d) { setTimeout(rename, d); });
    setInterval(rename, 2000);
    document.addEventListener('click', function () { setTimeout(rename, 0); }, true);
    window.addEventListener('antcv:sections-updated', function () { setTimeout(rename, 0); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  try { console.debug('[label-history] installed v1.0.0'); } catch (_) {}
})();
