/* mutation-source probe — finds WHAT mutates the DOM ~13/sec (the pump that
 * wakes the whole sidecar+island herd). The rAF probe only shows reactors;
 * this shows the actual mutation targets. Read-only. Results on
 * window.__antcvMut. Filter the console with  -Violation  first, paste, wait 5s.
 */
(function () {
  function tag(t) {
    if (!t || t.nodeType !== 1) return (t && t.nodeName) || '?';
    var cls = '';
    try { cls = (t.className && t.className.toString) ? t.className.toString().slice(0, 40) : ''; } catch (_) {}
    var id = t.id ? '#' + t.id : '';
    var sid = t.getAttribute && t.getAttribute('data-sid') ? '[data-sid=' + t.getAttribute('data-sid') + ']' : '';
    return (t.tagName || '?') + id + (cls ? '.' + cls.replace(/\s+/g, '.') : '') + sid;
  }
  var hits = Object.create(null);
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      var key = (m.type === 'attributes' ? 'attr:' + m.attributeName + ' on ' : 'childList on ') + tag(m.target);
      hits[key] = (hits[key] || 0) + 1;
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  setTimeout(function () {
    mo.disconnect();
    var arr = Object.keys(hits).map(function (k) { return { what: k, perSec: +(hits[k] / 5).toFixed(1), count: hits[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
    window.__antcvMut = arr.slice(0, 25);
    console.warn('READ window.__antcvMut');
    try { console.table(window.__antcvMut); } catch (_) {}
  }, 5000);
  console.warn('[mutation-source probe] sampling 5s…');
})();
