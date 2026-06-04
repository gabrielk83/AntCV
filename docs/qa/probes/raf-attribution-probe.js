/* rAF-attribution probe — names the sidecar scheduling requestAnimationFrame
 * every frame (the self-feeding re-render loop behind the bleep + the
 * "[Violation] requestAnimationFrame handler took Nms" flood).
 *
 * HOW TO USE
 *  1. In the DevTools Console filter box, type  -Violation  to hide the spam.
 *  2. Paste this whole block, press Enter.
 *  3. Wait ~5 seconds. It prints a table AND stores it on window.__antcvRAF.
 *  4. Read/send window.__antcvRAF  (or just the printed table).
 * Read-only: it restores the original requestAnimationFrame when done.
 */
(function () {
  if (window.__antcvRAFprobeRunning) { console.warn('[rAF probe] already running'); return; }
  window.__antcvRAFprobeRunning = true;

  var orig = window.requestAnimationFrame.bind(window);
  var bySource = Object.create(null);
  var total = 0;
  var fileRe = /(antcv-[a-z0-9-]+\.js|app\.js|antcv-react-islands\.js)(?:\?[^:)]*)?:(\d+)/i;

  function attribute() {
    var stack = '';
    try { throw new Error(); } catch (e) { stack = e.stack || ''; }
    var lines = stack.split('\n');
    // Skip frame 0 (Error) and 1 (this wrapper); find the first app file.
    for (var i = 2; i < lines.length; i++) {
      var m = lines[i].match(fileRe);
      if (m) return m[1] + ':' + m[2];
    }
    // Fall back to the first non-probe frame.
    return (lines[2] || 'unknown').trim().slice(0, 80);
  }

  window.requestAnimationFrame = function (cb) {
    total++;
    var key = attribute();
    bySource[key] = (bySource[key] || 0) + 1;
    return orig(cb);
  };

  setTimeout(function () {
    window.requestAnimationFrame = orig;
    window.__antcvRAFprobeRunning = false;
    var arr = Object.keys(bySource).map(function (k) {
      return { source: k, callsPerSec: +(bySource[k] / 5).toFixed(1), calls: bySource[k] };
    }).sort(function (a, b) { return b.calls - a.calls; });
    var report = { seconds: 5, totalRAF: total, rafPerSec: +(total / 5).toFixed(1), bySource: arr };
    window.__antcvRAF = report;
    console.warn('%c[rAF ATTRIBUTION] top schedulers (read window.__antcvRAF):', 'font-weight:700;color:#ff8a00');
    try { console.table(arr.slice(0, 12)); } catch (_) {}
    console.warn(JSON.stringify(report, null, 2));
  }, 5000);

  console.warn('[rAF probe] sampling 5s… (filter the console with  -Violation  to read the result)');
})();
