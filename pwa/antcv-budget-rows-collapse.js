/* antcv-budget-rows-collapse.js — BUDGET-ROWS-COLLAPSE-001 (owner 2026-06-26)
 * ============================================================================
 * The two generation-length cards — "Target CV length" (data-antcv-page-budget-row,
 * antcv-page-budget.js) and "Target cover-letter length" (data-antcv-cl-budget-row,
 * antcv-cl-length-560.js) — were always fully expanded. Owner: make them
 * COLLAPSED by default, expandable on click (like the other Settings disclosures).
 *
 * Additive + non-destructive: wraps each card's body (everything after its title)
 * in a toggle container and turns the title into a caret button. The injecting
 * sidecars are untouched. Idempotent (MARK guard); per-card collapse state
 * persists in localStorage. Self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.927-budget-collapse';
  if (window.__antcvBudgetRowsCollapse === VERSION) return;
  window.__antcvBudgetRowsCollapse = VERSION;

  var SEL = '[data-antcv-page-budget-row],[data-antcv-cl-budget-row]';
  var MARK = 'data-antcv-budget-collapse';

  function keyFor(row) {
    return 'antcv:budgetCollapse:' + (row.getAttribute('data-antcv-page-budget-row') ? 'cv' : 'cl');
  }

  function apply(row) {
    try {
      if (!row || row.getAttribute(MARK) === '1') return;
      var kids = Array.prototype.filter.call(row.children, function (c) { return c && c.nodeType === 1; });
      if (kids.length < 2) return;          // need a title + at least one body element
      row.setAttribute(MARK, '1');
      var title = kids[0];
      // Move everything after the title into a collapsible body wrapper.
      var body = document.createElement('div');
      body.setAttribute('data-antcv-budget-body', '1');
      for (var i = 1; i < kids.length; i++) body.appendChild(kids[i]);
      row.appendChild(body);
      // Title becomes a caret toggle.
      var caret = document.createElement('span');
      caret.setAttribute('aria-hidden', 'true');
      caret.style.cssText = 'margin-right:6px;opacity:.6;font-size:10px;display:inline-block;';
      title.insertBefore(caret, title.firstChild);
      title.style.cursor = 'pointer';
      title.setAttribute('role', 'button');
      var key = keyFor(row);
      var collapsed = true;                 // collapsed by default
      try { if (localStorage.getItem(key) === '0') collapsed = false; } catch (_) {}
      function render() {
        body.style.display = collapsed ? 'none' : '';
        caret.textContent = collapsed ? '▸' : '▾';   // ▸ / ▾
        title.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      }
      render();
      title.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        collapsed = !collapsed;
        try { localStorage.setItem(key, collapsed ? '1' : '0'); } catch (_) {}
        render();
      });
    } catch (_) { /* per-row failure must not break the panel */ }
  }

  function run() { try { Array.prototype.forEach.call(document.querySelectorAll(SEL), apply); } catch (_) {} }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; run(); });
  }

  schedule();
  [200, 600, 1500, 3000].forEach(function (ms) { setTimeout(schedule, ms); });
  try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}

  window.AntcvBudgetRowsCollapse = { version: VERSION, run: run };
})();
