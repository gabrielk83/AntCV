/* AntCV per-subsection processing/queue badges.
 * ============================================================
 * PROCESSING-QUEUE-INDICATOR-001 (owner feature): while a command works a
 * subsection (language change, new JD/kernel, compress, enhance,
 * consensus reinforce) the section shows a PINK "processing" badge; the
 * sections SCHEDULED later in the same command show a YELLOW "queued"
 * badge. Both disappear on done/idle.
 *
 * Feed: app.js's per-section status setter (fo) mirrors every update into
 * window.__antcvProcState and fires 'antcv:proc-state'. This sidecar is
 * read-only DOM: badges are absolutely-positioned chips anchored on the
 * preview sections' [data-sid] containers — no React-managed nodes are
 * touched.
 */
(function () {
  'use strict';

  var VERSION = '1.50.412';
  if (window.__antcvProcQueue === VERSION) return;
  window.__antcvProcQueue = VERSION;

  var HOST_ID = 'antcv-proc-badges';

  function host() {
    var h = document.getElementById(HOST_ID);
    if (!h) {
      h = document.createElement('div');
      h.id = HOST_ID;
      h.setAttribute('aria-hidden', 'true');
      h.className = 'no-print';
      h.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9990;';
      document.body.appendChild(h);
    }
    return h;
  }

  function render() {
    try {
      var st = window.__antcvProcState || {};
      var h = host();
      h.innerHTML = '';
      var paper = document.querySelector('.antcv-preview-paper');
      if (!paper) return;
      Object.keys(st).forEach(function (sid) {
        var v = st[sid];
        if (v !== 'working' && v !== 'queued') return;
        var el = paper.querySelector('[data-sid="' + sid + '"]');
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (r.width < 10 || r.bottom < 0 || r.top > innerHeight) return;
        var pink = v === 'working';
        var b = document.createElement('span');
        b.textContent = pink ? '⏳ processing' : '⌛ queued';
        b.style.cssText = 'position:fixed;left:' + Math.round(r.right - 86) + 'px;top:' + Math.round(r.top + 2) + 'px;'
          + 'font:600 9px Calibri,Arial,sans-serif;padding:2px 7px;border-radius:9px;pointer-events:none;'
          + (pink
            ? 'background:rgba(255,77,148,0.16);border:1px solid #ff4d94;color:#ff4d94;'
            : 'background:rgba(250,204,21,0.14);border:1px solid #eab308;color:#a16207;')
          + 'animation:antcv_pulse 1.4s ease-in-out infinite;';
        h.appendChild(b);
      });
    } catch (_) {}
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(render, 80); }
  window.addEventListener('antcv:proc-state', schedule);
  // keep badges glued to their sections while scrolling/resizing
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  // safety sweep: a stuck 'working' older than 3 min clears itself
  setInterval(function () {
    try {
      var st = window.__antcvProcState || {};
      var live = Object.keys(st).some(function (k) { return st[k] === 'working' || st[k] === 'queued'; });
      if (live) render(); else { var h = document.getElementById(HOST_ID); h && (h.innerHTML = ''); }
    } catch (_) {}
  }, 5000);

  try { console.debug('[proc-queue] badges installed v' + VERSION); } catch (_) {}
})();
