/* antcv-cl-no-photo-001.js — CL-NO-PHOTO-001 preview half (owner 2026-07-22)
 * ===========================================================================
 * "there should not be a visible figure in the cover letter." The DOCX export
 * already suppresses the CL candidate photo (worker CL-NO-PHOTO-001). This
 * sidecar mirrors that in the PREVIEW: when the active doc is the COVER LETTER,
 * hide the candidate headshot inside the header/candidate band. The CV is
 * unaffected (photo still shows there), and the SIGNATURE (a separate image,
 * NOT inside the band) is never touched.
 *
 * Verified live (2026-07-22): hiding the band data-URI <img> drops it to 0px
 * and the band height is unchanged (no layout disruption) — the photo is a
 * float, so the text simply reflows.
 *
 * Reversible: kill-switch localStorage['antcv:disable-cl-no-photo']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvClNoPhotoInstalled) return;
  window.__antcvClNoPhotoInstalled = '1.0';

  var KILL = 'antcv:disable-cl-no-photo';
  var STYLE_ID = 'antcv-cl-no-photo-style';
  // The band photo is the ONLY data-URI <img> inside the candidate band; the
  // signature sits outside the band, so this selector never hits it.
  var CSS = '.antcv-preview-paper [data-antcv-candidate-band="1"] img[src^="data:"]{display:none !important;}';

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function isCL() {
    try { return /cl/i.test(String(localStorage.getItem('doc') || '').replace(/["']/g, '')); } catch (_) { return false; }
  }
  function apply() {
    var on = !killed() && isCL();
    var el = document.getElementById(STYLE_ID);
    if (on) {
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = CSS;
        (document.head || document.documentElement).appendChild(el);
      }
    } else if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  window.addEventListener('storage', function (e) { if (!e || e.key === 'doc' || e.key == null) apply(); });
  window.addEventListener('antcv:sections-updated', apply);
  document.addEventListener('DOMContentLoaded', apply);
  // Same-tab CV/CL toggle doesn't fire 'storage'; a light poll catches it.
  try { setInterval(apply, 1000); } catch (_) {}
  apply();

  window.AntcvClNoPhoto = { apply: apply };
  try { console.debug('[cl-no-photo] installed'); } catch (_) {}
})();
