/* antcv-cl-close-space.js — CL-CLOSE-SPACE-001 (owner 2026-09-30)
 * "in the cover letter: give for the last line 'I welcome...' a paragraph space of 5 pts from top and
 * bottom of it." The preview's closing paragraph (app.src.js ~47597, the contentEditable <p> titled
 * "Click to edit the closing paragraph") gets 5 pt (6.67 px) above and below; the docx-worker
 * renderText gives the closure section the same 100-twip before/after. CSS only, no app.js edit.
 * Kill: localStorage antcv:disable-cl-close-space=1.
 */
(function () {
  'use strict';
  var VERSION = '1.51.4726-cl-close-space';
  if (window.__antcvClCloseSpace === VERSION) return;
  window.__antcvClCloseSpace = VERSION;
  try { if (localStorage.getItem('antcv:disable-cl-close-space') === '1') return; } catch (_) {}
  function add() {
    if (document.getElementById('antcv-cl-close-space-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-cl-close-space-style';
    st.textContent = '.antcv-preview-paper p[title^="Click to edit the closing"]{margin-top:6.67px !important;margin-bottom:6.67px !important;}';
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
})();
