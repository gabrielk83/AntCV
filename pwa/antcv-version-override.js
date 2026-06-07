/* AntCV version-override sidecar (v1.40.198)
 * ============================================================
 *
 * Purpose
 * -------
 * app.js is built externally and bakes its own version constant
 * into the minified bundle. On load it logs:
 *
 *   [AntCV] 1.40.172
 *
 * and sets `window.ANTCV_VERSION = '1.40.172'` (overwriting the
 * value our boot script set earlier). Any UI element that reads
 * the version then renders 1.40.172 even though the sidecars and
 * index.html are at a newer release.
 *
 * Gabriel reported on 2026-05-19: "version stayed 1.40.172 please
 * fix."
 *
 * Strategy
 * --------
 * Three layers:
 *
 *   (a) Override `window.ANTCV_VERSION` to the current release.
 *       We Object.defineProperty it as non-writable so app.js's
 *       later assignment is silently rejected. Doing this BEFORE
 *       app.js loads is impossible without changing app.js — we
 *       can only do it just after. So we set up a polling timer
 *       that re-asserts the value until the next paint cycle
 *       after we see it stabilize.
 *
 *   (b) Wrap `console.log` so that `[AntCV] 1.40.172` becomes
 *       `[AntCV] 1.40.198`. We only rewrite the exact pattern
 *       `[AntCV] X.Y.Z` to avoid touching anything else.
 *
 *   (c) DOM text-replacer that walks the page (plus a
 *       MutationObserver) and rewrites any text node whose
 *       content matches the OLD version exactly. We use a
 *       conservative pattern that only matches stale version
 *       tokens, not arbitrary "1.40.x" numbers in user content.
 *
 * Configuration
 * -------------
 * The display version is held in TARGET_VERSION below. Bumped
 * with every release. The list of "stale" patterns to rewrite
 * (STALE_PATTERNS) is open-ended — add new patterns as we
 * discover them in the wild.
 *
 * Idempotency
 * -----------
 * - Each rewritten text node gets its parent tagged with
 *   `data-antcv-version-rewritten="1"` so we don't loop.
 * - The console.log wrap detects an already-rewritten string and
 *   passes it through unchanged.
 */
(function () {
  'use strict';

  if (window.__antcvVersionOverrideInstalled) return;
  window.__antcvVersionOverrideInstalled = '1.40.288';

  const TARGET_VERSION = '1.50.261';

  // The set of stale version tokens we'll rewrite in DOM text and
  // console output. Add older versions here as needed.
  const STALE_VERSIONS = [
    '1.40.172', '1.40.173', '1.40.174', '1.40.175', '1.40.176', '1.40.177',
    '1.40.178', '1.40.179', '1.40.180', '1.40.181', '1.40.182', '1.40.183',
    '1.40.184', '1.40.185', '1.40.186', '1.40.187', '1.40.188', '1.40.189',
    '1.40.190', '1.40.191', '1.40.192', '1.40.193', '1.40.194', '1.40.195',
    '1.40.196', '1.40.197', '1.40.198', '1.40.199', '1.40.200', '1.40.201', '1.40.202', '1.40.203', '1.40.204', '1.40.205', '1.40.206', '1.40.207', '1.40.208', '1.40.209', '1.40.210', '1.40.211', '1.40.212', '1.40.213', '1.40.214', '1.40.215', '1.40.216', '1.40.217', '1.40.218', '1.40.219', '1.40.220', '1.40.221', '1.40.222', '1.40.223', '1.40.224', '1.40.225', '1.40.226', '1.40.227', '1.40.228', '1.40.229', '1.40.230', '1.40.231', '1.40.232',
    '1.40.233', '1.40.234', '1.40.235', '1.40.236', '1.40.237', '1.40.238', '1.40.239', '1.40.240', '1.40.241', '1.40.242', '1.40.243', '1.40.244', '1.40.245', '1.40.246', '1.40.247', '1.40.248', '1.40.249', '1.40.250', '1.40.251', '1.40.252', '1.40.253', '1.40.254', '1.40.255', '1.40.256', '1.40.257', '1.40.258', '1.40.259', '1.40.260', '1.40.261', '1.40.262', '1.40.263', '1.40.264', '1.40.265', '1.40.266', '1.40.267', '1.40.268', '1.40.269', '1.40.270', '1.40.271', '1.40.272', '1.40.273', '1.40.274', '1.40.275', '1.40.276', '1.40.277', '1.40.278', '1.40.279', '1.40.280', '1.40.281', '1.40.282', '1.40.283', '1.40.284', '1.40.285', '1.40.286', '1.40.287', '1.40.288', '1.40.289',
    '1.40.290', '1.40.291', '1.40.292', '1.40.293', '1.40.294', '1.40.295', '1.40.296', '1.40.297', '1.40.298', '1.40.299', '1.40.300', '1.40.301', '1.40.302', '1.40.303', '1.40.304', '1.40.305', '1.40.306', '1.40.307', '1.40.308', '1.40.309', '1.40.310', '1.40.311', '1.40.312', '1.40.313', '1.40.314', '1.40.315', '1.40.316', '1.40.317', '1.40.318', '1.40.319', '1.40.320', '1.40.321', '1.40.322', '1.40.323', '1.40.324', '1.40.325', '1.40.326', '1.40.327', '1.40.328', '1.40.329', '1.40.330', '1.40.331', '1.40.332', '1.40.333', '1.40.334',
    '1.40.336-version-grow-fix',
    '1.40.335', '1.40.336', '1.40.337', '1.40.338', '1.40.339',
    '1.40.337-ai-notice-fix',
    '1.40.339-a', '1.40.339-b', '1.40.339-c', '1.40.339-d', '1.40.339-e',
    '1.40.339-f', '1.40.339-g', '1.40.339-h', '1.40.339-i', '1.40.339-j',
    '1.40.339-k', '1.40.339-l',
    '1.40.340-watermark',
    '1.50.0-pass1',
    '1.50.0-pass2',
    '1.50.0-pass3',
    '1.50.1',
    '1.50.2',
    '1.50.3',
    '1.50.4',
    '1.50.5',
    '1.50.6',
    '1.50.7',
    '1.50.8',
    '1.50.9',
    '1.50.10',
    '1.50.11',
    '1.50.12',
    '1.50.13',
    '1.50.14',
    '1.50.15',
    '1.50.15-p0c-fix2',
    '1.50.16',
    '1.50.17',
    '1.50.18',
    '1.50.19',
    '1.50.20',
    '1.50.21',
    '1.50.22',
    '1.50.23',
    '1.50.24',
    '1.50.25',
    '1.50.26',
    '1.50.27',
    '1.50.28',
    '1.50.29',
    '1.50.30',
    '1.50.31',
    '1.50.32',
    '1.50.33',
    '1.50.34',
    '1.50.34a',
    '1.50.35',
    '1.50.36',
    '1.50.37',
    '1.50.38',
    '1.50.39',
    '1.50.40',
    '1.50.41',
    '1.50.42', '1.50.43', '1.50.44', '1.50.45', '1.50.46', '1.50.47',
    '1.50.48', '1.50.49', '1.50.50', '1.50.51', '1.50.52', '1.50.53',
    '1.50.54', '1.50.55', '1.50.56', '1.50.57', '1.50.58', '1.50.59',
    '1.50.60', '1.50.61', '1.50.62', '1.50.63', '1.50.64', '1.50.65',
    '1.50.66', '1.50.67', '1.50.68', '1.50.69', '1.50.70', '1.50.71', '1.50.72', '1.50.73', '1.50.74', '1.50.75', '1.50.76', '1.50.77', '1.50.78', '1.50.79', '1.50.80', '1.50.81', '1.50.82', '1.50.83', '1.50.84', '1.50.85', '1.50.86', '1.50.87', '1.50.88', '1.50.89', '1.50.90', '1.50.91', '1.50.92', '1.50.93', '1.50.94', '1.50.95', '1.50.96', '1.50.97', '1.50.98', '1.50.99', '1.50.100', '1.50.101', '1.50.102', '1.50.103', '1.50.104', '1.50.105', '1.50.106', '1.50.107', '1.50.108', '1.50.109', '1.50.110', '1.50.111', '1.50.112', '1.50.113', '1.50.114', '1.50.115', '1.50.116', '1.50.117', '1.50.118', '1.50.119', '1.50.120', '1.50.121', '1.50.122', '1.50.123', '1.50.124', '1.50.125', '1.50.126', '1.50.127', '1.50.128', '1.50.129', '1.50.130', '1.50.131', '1.50.132', '1.50.133', '1.50.134', '1.50.135', '1.50.136', '1.50.137', '1.50.138', '1.50.139', '1.50.140', '1.50.141', '1.50.142', '1.50.143', '1.50.144', '1.50.145', '1.50.146', '1.50.147', '1.50.148', '1.50.149', '1.50.150', '1.50.151', '1.50.152', '1.50.153', '1.50.154', '1.50.155', '1.50.156', '1.50.157', '1.50.158', '1.50.159', '1.50.160', '1.50.161', '1.50.162', '1.50.163', '1.50.164', '1.50.165', '1.50.166', '1.50.167', '1.50.168', '1.50.169', '1.50.170', '1.50.171', '1.50.172', '1.50.173', '1.50.174', '1.50.175', '1.50.176', '1.50.177', '1.50.178', '1.50.179', '1.50.180', '1.50.181', '1.50.182', '1.50.183', '1.50.184', '1.50.185', '1.50.186', '1.50.187', '1.50.188', '1.50.189', '1.50.190', '1.50.191', '1.50.192', '1.50.193', '1.50.194', '1.50.195', '1.50.196', '1.50.197', '1.50.198', '1.50.199', '1.50.200', '1.50.201', '1.50.202', '1.50.203', '1.50.204', '1.50.205', '1.50.206', '1.50.207', '1.50.208', '1.50.209', '1.50.210', '1.50.211', '1.50.212', '1.50.213', '1.50.214', '1.50.215', '1.50.216', '1.50.217', '1.50.218', '1.50.219', '1.50.220', '1.50.221', '1.50.222', '1.50.223', '1.50.224', '1.50.225', '1.50.226', '1.50.227', '1.50.228', '1.50.229', '1.50.230', '1.50.231', '1.50.232', '1.50.233', '1.50.234', '1.50.235', '1.50.236', '1.50.237', '1.50.238', '1.50.239', '1.50.240', '1.50.241', '1.50.242', '1.50.243', '1.50.244', '1.50.245', '1.50.246', '1.50.247', '1.50.248', '1.50.249', '1.50.250', '1.50.251', '1.50.252', '1.50.253', '1.50.254', '1.50.255', '1.50.256', '1.50.257', '1.50.258', '1.50.259', '1.50.260',
    // INVARIANT: never add the current TARGET_VERSION to this list.
    // Doing so causes the rewrite loop to match its own output and
    // append the suffix on every MutationObserver cycle. See the
    // idempotency guard in rewriteTextNodes below.
  ];
  const STALE_SET = new Set(STALE_VERSIONS);

  // ─── Layer A: window.ANTCV_VERSION lock ──────────────────────────
  function lockAntcvVersion() {
    try {
      // First try Object.defineProperty so app.js's later
      // assignment is silently rejected (and doesn't throw).
      Object.defineProperty(window, 'ANTCV_VERSION', {
        configurable: false,
        writable: false,
        value: TARGET_VERSION,
      });
      return true;
    } catch (e) {
      // Property already defined (read-only or accessor). Try to
      // overwrite via descriptor mutation.
      try {
        const desc = Object.getOwnPropertyDescriptor(window, 'ANTCV_VERSION');
        if (desc && desc.configurable) {
          Object.defineProperty(window, 'ANTCV_VERSION', {
            configurable: false,
            writable: false,
            value: TARGET_VERSION,
          });
          return true;
        }
      } catch (_) {}
      // Last resort: assign — may not stick if locked, but try anyway.
      try { window.ANTCV_VERSION = TARGET_VERSION; } catch (_) {}
      return false;
    }
  }

  // Set immediately, then re-assert until 6 s post-boot (covers
  // late initialization in app.js).
  lockAntcvVersion();
  let assertCount = 0;
  const assertTimer = setInterval(function () {
    if (window.ANTCV_VERSION !== TARGET_VERSION) {
      lockAntcvVersion();
    }
    assertCount++;
    if (assertCount > 30) clearInterval(assertTimer); // ~6 s at 200 ms cadence
  }, 200);

  // ─── Layer B: console.log wrap ──────────────────────────────────
  (function wrapConsole() {
    const orig = console.log.bind(console);
    if (console.log.__antcvVersionWrapped) return;
    function rewrite(arg) {
      if (typeof arg !== 'string') return arg;
      // Only rewrite the exact "[AntCV] X.Y.Z" pattern.
      const m = /^\[AntCV\]\s+(\d+\.\d+\.\d+)\s*$/.exec(arg);
      if (m && STALE_SET.has(m[1])) {
        return '[AntCV] ' + TARGET_VERSION + ' (sidecars; bundle stamp: ' + m[1] + ')';
      }
      return arg;
    }
    console.log = function () {
      const args = new Array(arguments.length);
      for (let i = 0; i < arguments.length; i++) args[i] = rewrite(arguments[i]);
      return orig.apply(console, args);
    };
    console.log.__antcvVersionWrapped = true;
  })();

  // ─── Layer C: DOM text rewrite ──────────────────────────────────
  // We rewrite text nodes whose textContent contains a stale
  // version string. To avoid touching arbitrary user content
  // ("we shipped version 1.40.172 in production…"), we gate on
  // visible context: the node must sit inside an element whose
  // ancestry includes a tag/class hinting at version display
  // (e.g. About, Settings drawer header, login screen).
  const VERSION_CONTAINER_HINTS = /antcv|about|settings|version|drawer|footer|login|sign[\s-]?in|app[\s-]?info/i;

  function isInVersionContainer(node) {
    let p = node && node.parentNode;
    let depth = 0;
    while (p && p !== document.body && depth < 10) {
      depth++;
      if (p.nodeType === 1) {
        const id = p.id || '';
        const cls = (typeof p.className === 'string') ? p.className : '';
        const aria = (p.getAttribute && (p.getAttribute('aria-label') || p.getAttribute('data-antcv')) ) || '';
        if (VERSION_CONTAINER_HINTS.test(id) ||
            VERSION_CONTAINER_HINTS.test(cls) ||
            VERSION_CONTAINER_HINTS.test(aria)) return true;
      }
      p = p.parentNode;
    }
    return false;
  }

  // Build a regex of stale versions for fast scanning.
  const STALE_RE = new RegExp(
    '\\b(' + STALE_VERSIONS.map(function (v) {
      return v.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }).join('|') + ')\\b',
    'g'
  );

  function rewriteTextNodes(root) {
    if (!root) return 0;
    let n = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const dirty = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      // INVARIANT: idempotency guard. If the text already contains
      // TARGET_VERSION (either because we wrote it on a prior pass or
      // because the bundle's own stamp matches), do not rewrite. Without
      // this guard, the MutationObserver feedback loop (which watches
      // characterData) re-fires on every rewrite, and any STALE_VERSIONS
      // entry whose digits appear as a substring of TARGET_VERSION would
      // cause the suffix to be concatenated on every cycle.
      if (node.nodeValue.indexOf(TARGET_VERSION) !== -1) continue;
      if (!STALE_RE.test(node.nodeValue)) { STALE_RE.lastIndex = 0; continue; }
      STALE_RE.lastIndex = 0;
      // Skip editable contexts.
      let p = node.parentNode, editable = false;
      while (p && p !== document.body) {
        if (p.nodeType === 1) {
          const tag = (p.tagName || '').toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'script' || tag === 'style') { editable = true; break; }
          if (p.isContentEditable) { editable = true; break; }
        }
        p = p.parentNode;
      }
      if (editable) continue;
      // Gate on container hint.
      if (!isInVersionContainer(node)) continue;
      // Rewrite.
      const next = node.nodeValue.replace(STALE_RE, TARGET_VERSION);
      if (next !== node.nodeValue) {
        dirty.push([node, next]);
      }
    }
    for (const [nd, txt] of dirty) {
      try {
        nd.nodeValue = txt;
        if (nd.parentNode && nd.parentNode.nodeType === 1) {
          nd.parentNode.setAttribute('data-antcv-version-rewritten', '1');
        }
        n++;
      } catch (_) {}
    }
    if (n > 0) {
      try { console.debug('[version-override] rewrote', n, 'stale version string(s) → ' + TARGET_VERSION); } catch (_) {}
    }
    return n;
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { rewriteTextNodes(document.body); } catch (_) {}
    });
  }

  // First passes — many version displays appear after auth/cloud-restore.
  schedule();
  [200, 600, 1500, 3500, 8000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    const mo = new MutationObserver(function (records) {
      for (const r of records) {
        if (r.addedNodes && r.addedNodes.length) { schedule(); return; }
        if (r.type === 'characterData') { schedule(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}

  // Public API.
  window.AntcvVersionOverride = {
    version: TARGET_VERSION,
    targetVersion: TARGET_VERSION,
    staleVersions: STALE_VERSIONS,
    _lockAntcvVersion: lockAntcvVersion,
    _rewriteTextNodes: rewriteTextNodes,
  };

  try { console.debug('[version-override] installed v1.40.288 — pinning window.ANTCV_VERSION =', TARGET_VERSION); } catch (_) {}
})();
