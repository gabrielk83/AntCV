/* HIWC-RERENDER-LOOP / BLEEP-MULTI live probe.
 * Paste into the running AntCV devtools console while the preview is visible
 * (the screen where Name/Location/Privacy bleep). Read-only. Runs ~6s then
 * prints a summary — copy it back.
 */
(function () {
  var WINDOW_MS = 6000;
  var t0 = performance.now();

  // 1) Mutation rate on the candidate header + topbar.
  var counts = { headerChildList: 0, headerAttr: 0, topbarChildList: 0, bodyChildList: 0 };
  var header = document.querySelector('[data-antcv-candidate-edit="name"]');
  header = header ? (header.closest('[data-antcv-candidate-application-sentence]') || header.parentElement || header) : null;
  var topbar = document.querySelector('.antcv-top-tools, .antcv-topbar, header');

  var obsHeader = header && new MutationObserver(function (ms) {
    ms.forEach(function (m) { if (m.type === 'childList') counts.headerChildList++; else counts.headerAttr++; });
  });
  if (obsHeader) obsHeader.observe(header, { childList: true, subtree: true, attributes: true });

  var obsTop = topbar && new MutationObserver(function (ms) { counts.topbarChildList += ms.length; });
  if (obsTop) obsTop.observe(topbar, { childList: true, subtree: true });

  var obsBody = new MutationObserver(function (ms) { counts.bodyChildList += ms.length; });
  obsBody.observe(document.body, { childList: true, subtree: true });

  // 2) antcv:sections-updated emit rate + last source.
  var sectionsEvents = 0, lastSource = null;
  function onSec(e) { sectionsEvents++; try { lastSource = (e.detail && e.detail.source) || lastSource; } catch (_) {} }
  window.addEventListener('antcv:sections-updated', onSec, true);

  // 3) Node-identity churn: is the FAB / name node being recreated?
  var fab0 = document.querySelector('.antcv-fab[data-antcv-privacy-led-fab="1"]');
  var name0 = document.querySelector('[data-antcv-candidate-edit="name"]');
  var fabRecreated = 0, nameRecreated = 0, alignFlips = 0, lastAlign = null;
  var sampler = setInterval(function () {
    var fab = document.querySelector('.antcv-fab[data-antcv-privacy-led-fab="1"]');
    if (fab && fab !== fab0) { fabRecreated++; fab0 = fab; }
    var nm = document.querySelector('[data-antcv-candidate-edit="name"]');
    if (nm && nm !== name0) { nameRecreated++; name0 = nm; }
    if (nm) { var a = getComputedStyle(nm).textAlign; if (lastAlign !== null && a !== lastAlign) alignFlips++; lastAlign = a; }
  }, 200);

  setTimeout(function () {
    if (obsHeader) obsHeader.disconnect();
    if (obsTop) obsTop.disconnect();
    obsBody.disconnect();
    window.removeEventListener('antcv:sections-updated', onSec, true);
    clearInterval(sampler);
    var secs = (performance.now() - t0) / 1000;
    var out = {
      seconds: +secs.toFixed(1),
      version: window.ANTCV_VERSION || null,
      perSecond: {
        headerChildList: +(counts.headerChildList / secs).toFixed(1),
        headerAttr: +(counts.headerAttr / secs).toFixed(1),
        topbarChildList: +(counts.topbarChildList / secs).toFixed(1),
        bodyChildList: +(counts.bodyChildList / secs).toFixed(1),
        sectionsUpdatedEvents: +(sectionsEvents / secs).toFixed(1),
      },
      lastSectionsSource: lastSource,
      fabRecreatedTimes: fabRecreated,
      nameRecreatedTimes: nameRecreated,
      nameAlignFlips: alignFlips,
      headerFound: !!header, topbarFound: !!topbar,
    };
    console.log('%c[RERENDER-LOOP PROBE]', 'font-weight:700;color:#01B7BB', out);
    console.log(JSON.stringify(out, null, 2));
  }, WINDOW_MS);

  console.log('[RERENDER-LOOP PROBE] sampling for ' + (WINDOW_MS / 1000) + 's…');
})();
