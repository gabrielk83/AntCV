/* AntCV Sections button icon — paragraph mark (v1.40.346)
 * ============================================================================
 *
 * Bundle 2 follow-up. Adds a paragraph mark to the bottom-bar "Sections"
 * button, matching the target-emoji prefix the "Analysis" button gained in
 * v1.40.344. Keeps the bottom nav's three view tabs visually parallel:
 *   [paragraph Section]  [target Analysis]  [Preview]
 *
 * Anchor (verified against live app.js)
 * -------------------------------------
 * The Sections button is rendered inside the minified app.js React tree as:
 *   React.createElement("button",{onClick:...ti("sections")...},
 *     "da"===je?"Sektion":"Section")
 * It has no aria-label, so we anchor on its text content within the bottom
 * nav (.antcv-react-bottom-nav). The button reads exactly "Section" (en) or
 * "Sektion" (da) before we touch it.
 *
 * Robustness against app.js re-renders
 * ------------------------------------
 * app.js re-renders the bottom nav on view-switch and language change,
 * resetting the button's textContent back to the plain word. So we do NOT
 * rely on a one-shot "already decorated" flag. Each sweep: find any bottom-nav
 * button whose text is exactly Section/Sektion (i.e. missing our prefix) and
 * (re)apply it. A button that already shows the prefixed label no longer
 * matches the plain-label set, so it's left alone — idempotent and self-healing.
 *
 * Why a sidecar, not an app.js edit
 * ---------------------------------
 * Per CLAUDE.md hotfix discipline and to avoid another large-bundle commit.
 * The pilcrow (U+00B6) is Latin-1, so it renders consistently everywhere
 * without emoji-font variance.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.346';
  if (window.__antcvSectionsIcon346 === SCRIPT_VERSION) return;
  window.__antcvSectionsIcon346 = SCRIPT_VERSION;

  var PILCROW = '\u00B6';      // paragraph mark
  var THINSP = '\u2009';       // thin space between mark and word
  var PREFIX = PILCROW + THINSP;
  var NAV_SEL = '.antcv-react-bottom-nav';

  // The Sections button's exact label text, EN + DA, as app.js renders it.
  var PLAIN_LABELS = ['Section', 'Sektion'];

  function decorate() {
    // Scope to the bottom nav so we never touch a "Section"-labelled button
    // elsewhere (e.g. inside a panel). Fall back to document if not present.
    var scopes = document.querySelectorAll(NAV_SEL);
    var roots = scopes.length ? scopes : [document];
    for (var r = 0; r < roots.length; r++) {
      var btns = roots[r].querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var txt = (b.textContent || '').trim();
        // Only act on the PLAIN label — a button already showing the prefixed
        // label won't match, so this is idempotent and self-heals after a
        // re-render.
        if (PLAIN_LABELS.indexOf(txt) >= 0) {
          b.textContent = PREFIX + txt;
        }
      }
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { decorate(); } catch (_) {}
    });
  }

  schedule();
  [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  // app.js re-renders the bottom nav on view/language change; listening to its
  // own event makes the re-add snappier than waiting for the observer.
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvSectionsIcon346 = { version: SCRIPT_VERSION, sweep: decorate };

  try { console.debug('[sections-icon-346] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
