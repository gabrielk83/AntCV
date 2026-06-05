/* AntCV console quieter (v1.50.149)
 * ============================================================================
 * Problem
 * -------
 * The PWA loads ~70 sidecars, each printing a "[name] installed vX" banner at
 * boot, plus app.js prints repeated [ServerConfig] / [wizard@render] /
 * [cloud-restore] status. The result is hundreds of lines of benign chatter
 * that bury real errors and make the console unusable.
 *
 * There is no central logger to turn down, so this wraps console.{log,info,
 * debug,warn} once, at the very top of the document, and DROPS lines that match
 * a curated list of known-benign boot/status patterns. Everything else passes
 * through unchanged. console.error is NEVER touched.
 *
 * Default is QUIET. To see everything again (for debugging):
 *   localStorage.antcvVerboseConsole = '1'   // then reload
 *
 * Safety
 * ------
 *   - Console is not control flow; a dropped log cannot change behaviour.
 *   - Only messages matching the curated NOISE list are dropped. Unknown logs,
 *     all warnings that don't match, and ALL errors pass through.
 *   - Re-checks the verbose flag on every call, so flipping it + reload is the
 *     only step needed; no rebuild.
 *   - Note: Chrome's own "[Violation] Forced reflow / requestAnimationFrame
 *     handler took Nms" lines are emitted by the browser, not via console.*,
 *     so they cannot be filtered here.
 */
(function () {
  'use strict';
  if (window.__antcvConsoleQuiet) return;
  window.__antcvConsoleQuiet = '1.50.149';

  function verbose() {
    try {
      var v = localStorage.getItem('antcvVerboseConsole');
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  // Curated benign-noise matchers. A line is dropped only if it matches one of
  // these AND verbose mode is off. Keep these specific to AntCV's own output.
  var NOISE = [
    /\binstalled\b/i,                              // "[xxx] installed vN", "installed (v=...)"
    /\bwrapped (window\.|AntcvAuth|AntcvShowAiNotice)/i,
    /\bbootstrapped\b/i,
    /injected \d+ sidecar/i,
    /present but OFF/i,
    /\[version-override\]/,
    /\[ServerConfig\]/,
    /\[wizard@render\]/,
    /\[shape-guard\]/,                             // boot + benign "missing bullets" diagnostic
    /\[cloud-restore\]/,
    /cloud-restore-282/,
    /personal-info-cloud-restore/,
    /sections refreshed from external write/,
    /\bforceRebuild\b/,
    /reconciled local mode/,
    /promoted nested personalInfo/,
    /\[consent-restore-339\]/,
    /photo restored from cloud/,
    /\[cloud-put-shrink-guard/,
    /not signed in yet, skipping/,
    /eager-normalized/
  ];

  function asText(args) {
    var s = '';
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (typeof a === 'string') s += a;
      else { try { s += JSON.stringify(a); } catch (_) { s += String(a); } }
      s += ' ';
      if (s.length > 600) break; // bound the cost on big objects
    }
    return s;
  }

  function isNoise(args) {
    if (!args || !args.length) return false;
    var s = asText(args);
    for (var i = 0; i < NOISE.length; i++) {
      if (NOISE[i].test(s)) return true;
    }
    return false;
  }

  ['log', 'info', 'debug', 'warn'].forEach(function (level) {
    var orig = console[level];
    if (typeof orig !== 'function') return;
    console[level] = function () {
      if (!verbose() && isNoise(arguments)) return;
      return orig.apply(console, arguments);
    };
  });

  // Debug API + a one-line note (itself routed through the unfiltered path
  // since it doesn't match NOISE, so the user can see the quieter is active).
  window.AntcvConsoleQuiet = {
    version: '1.50.149',
    verbose: verbose,
    patterns: NOISE
  };
  try {
    console.log('[antcv] console quieter active — set localStorage.antcvVerboseConsole=1 for full logs');
  } catch (_) {}
})();
