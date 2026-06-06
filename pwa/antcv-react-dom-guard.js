/* AntCV React DOM guard (v1.50.185)
 * ============================================================================
 * Fixes the mobile "blue screen" crash reproduced by:
 *   Settings → Personal → tap Name → add a character.
 *
 * Root error (captured via antcv-diag-probes):
 *   NotFoundError: Failed to execute 'removeChild' on 'Node':
 *   The node to be removed is not a child of this node.
 *   …react-dom commit phase (Di/jb/Aa/Fi).
 *
 * Cause: AntCV loads many DOM-decorating sidecars (section-align,
 * photo-position, bullet-targets, lang-bar-filter, the version-override text
 * rewriter, …) that structurally mutate the SAME preview/settings DOM that
 * React renders. Editing the name triggers a React re-render; during the
 * commit React tries to removeChild / insertBefore a node that a sidecar has
 * already moved or removed, React throws, the error boundary trips, and the
 * UI is replaced by the blue screen.
 *
 * This is the well-known React vs. third-party-DOM-mutation crash (same class
 * as the Google-Translate / Grammarly NotFoundError). The canonical mitigation
 * is to make removeChild / insertBefore DEFENSIVE: when the target node is not
 * actually a child of the parent (the only case where the native method
 * throws), no-op instead of throwing. In the normal case the behaviour is
 * byte-for-byte identical, so this is safe; it only converts a hard crash into
 * a harmless no-op (worst case: a stray DOM node that the next render cleans
 * up — far better than a blue screen).
 *
 * MUST load BEFORE React commits (i.e. before app.js mounts). It is therefore
 * placed near the very top of index.html, right after the console quieter.
 *
 * Additive, idempotent, removable in one <script> line. Set
 * localStorage.antcvDomGuardVerbose=1 to log each swallowed mutation (with the
 * caller stack) so the offending sidecar can be identified and fixed at the
 * root — after which this guard can be retired.
 */
(function () {
  'use strict';

  var VERSION = '1.50.185-react-dom-guard';
  if (window.__antcvReactDomGuard) return;
  window.__antcvReactDomGuard = VERSION;

  if (typeof Node !== 'function' || !Node.prototype) return;

  var verbose = false;
  try { verbose = localStorage.getItem('antcvDomGuardVerbose') === '1'; } catch (_) {}

  var swallowed = 0;
  function note(method, parent, child) {
    swallowed++;
    if (!verbose) return;
    var where = '';
    try { throw new Error(); } catch (e) { where = (e.stack || '').split('\n').slice(3, 7).join(' | '); }
    try {
      console.warn('[antcv-dom-guard] swallowed ' + method + ' #' + swallowed +
        ' (node not a child of parent) — likely an external sidecar mutating React DOM. ' + where);
    } catch (_) {}
  }

  var _removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      // The native call would throw NotFoundError here. React treats that as
      // fatal. Return the child unchanged instead — React's intent (the node
      // is gone) is already satisfied.
      note('removeChild', this, child);
      return child;
    }
    return _removeChild.apply(this, arguments);
  };

  var _insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      // Reference node was moved/removed by an external script. The native call
      // would throw NotFoundError; fall back to appendChild so the node still
      // lands in the right parent instead of crashing the commit.
      note('insertBefore', this, referenceNode);
      try { return this.appendChild(newNode); } catch (_) { return newNode; }
    }
    return _insertBefore.apply(this, arguments);
  };

  window.AntcvReactDomGuard = {
    version: VERSION,
    get swallowed() { return swallowed; }
  };
  try { console.debug('[antcv-dom-guard] installed v' + VERSION + (verbose ? ' (verbose)' : '')); } catch (_) {}
})();
