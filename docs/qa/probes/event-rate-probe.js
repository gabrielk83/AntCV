/* event-rate probe — finds what drives the React-islands re-render (the
 * remaining ~39/sec) and the 12/sec sidecar herd. Counts every dispatched
 * event by type for 5s. Read-only (restores dispatchEvent). Results on
 * window.__antcvEvents. Filter the console with  -Violation  first.
 */
(function () {
  var counts = Object.create(null);
  var orig = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    try { if (ev && ev.type) counts[ev.type] = (counts[ev.type] || 0) + 1; } catch (_) {}
    return orig.apply(this, arguments);
  };
  setTimeout(function () {
    EventTarget.prototype.dispatchEvent = orig;
    var arr = Object.keys(counts)
      .map(function (k) { return { type: k, perSec: +(counts[k] / 5).toFixed(1), total: counts[k] }; })
      .sort(function (a, b) { return b.total - a.total; });
    window.__antcvEvents = arr;
    console.warn('READ window.__antcvEvents');
    try { console.table(arr.slice(0, 20)); } catch (_) {}
  }, 5000);
  console.warn('[event-rate probe] sampling 5s…');
})();
