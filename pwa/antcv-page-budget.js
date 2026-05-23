/* AntCV page-budget sidecar (v1.40.172)
 * ============================================================
 *
 * Adds a "Target CV length" dropdown to the LINE TARGETS panel in
 * Advanced Styles. Lets the user pick how many pages their CV should
 * aim for (1pp / 1.5pp / 2pp / 2.5pp / 3pp). The value is persisted
 * to localStorage["pageBudget"] in the same JSON-stringified form
 * the app's own `u.get/u.set` wrapper uses, so app.js reads the
 * value back natively via `u.get("pageBudget", 1.5)`.
 *
 * The system prompt for CV generation interpolates this value into
 * its LENGTH BUDGETS preamble so the LLM aims for the chosen page
 * count rather than the previously-hardcoded 1.5pp default.
 *
 * Why a sidecar rather than direct app.js modification
 * ----------------------------------------------------
 * The line-targets UI is built inside a heavily-minified React
 * render block. Surgically inserting a new field into the React
 * tree requires identifying exact minified variable names and is
 * fragile across versions. A sidecar that watches for the panel
 * and injects a DOM row is robust: matching the LINE TARGETS
 * heading text is stable across releases.
 *
 * Storage convention
 * ------------------
 * app.js's `u` wrapper does `JSON.stringify` on writes and
 * `JSON.parse` on reads with a default fallback. We follow the
 * same convention: write `JSON.stringify(value)` to
 * localStorage["pageBudget"]. Direct localStorage access is fine
 * since `u` is a thin wrapper, not a value-validation layer.
 *
 * Public API
 * ----------
 *   window.AntcvPageBudget.get()         — current budget (number)
 *   window.AntcvPageBudget.set(n)        — set budget; persists +
 *                                          dispatches change event
 *   window.AntcvPageBudget.OPTIONS       — array of supported values
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.172';
  if (window.__antcvPageBudgetInstalled) return;
  window.__antcvPageBudgetInstalled = SCRIPT_VERSION;

  const STORAGE_KEY = 'pageBudget';
  const DEFAULT = 1.5;
  const OPTIONS = [
    { v: 1.0, label: '1 page',     hint: 'One page total — strict cap. Best for entry-level or single-role focus.' },
    { v: 1.5, label: '1.5 pages',  hint: 'Default. Scandinavian-style: dense first page + half-page continuation.' },
    { v: 2.0, label: '2 pages',    hint: 'Mid-senior. Two full pages — fits 5-7 roles with 3 bullets each.' },
    { v: 2.5, label: '2.5 pages',  hint: 'Senior. More breathing room for selected outcomes + 7-8 roles.' },
    { v: 3.0, label: '3 pages',    hint: 'Executive / academic / LATAM. Full role descriptions + responsibilities + outcomes.' },
  ];

  // ─── Storage ────────────────────────────────────────────────────
  function readBudget() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null || raw === '') return DEFAULT;
      const v = JSON.parse(raw);
      return (typeof v === 'number' && v > 0 && v <= 5) ? v : DEFAULT;
    } catch (e) { return DEFAULT; }
  }

  function writeBudget(v) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
      // Mirror the cloud-sync hook used by app.js (Qn → cloud writer).
      // We dispatch a CustomEvent so any listener wired by app.js or
      // another sidecar can persist to the user's relay backend.
      window.dispatchEvent(new CustomEvent('antcv:page-budget-changed', { detail: { value: v } }));
    } catch (e) {
      console.warn('[page-budget] setItem failed:', e && e.message);
    }
  }

  window.AntcvPageBudget = {
    get: readBudget,
    set: writeBudget,
    OPTIONS,
    DEFAULT,
    STORAGE_KEY,
    SCRIPT_VERSION,
  };

  // ─── UI injection ───────────────────────────────────────────────
  // The LINE TARGETS panel is rendered by app.js's React tree. It
  // has a heading element with the exact text "LINE TARGETS". We
  // walk up from that heading to find its container, then inject
  // our row right after the description div that explains line
  // targets — same visual context, just one row above the sliders.

  function findLineTargetsContainer() {
    const headings = document.querySelectorAll('div, span, summary');
    for (const h of headings) {
      const txt = (h.textContent || '').trim();
      if (txt === 'LINE TARGETS') {
        // Walk up until we find the panel container — the heading's
        // parent is the wrapper that contains the description + sliders.
        let parent = h.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
          // Look for sibling content with "Set min/max line counts"
          if ((parent.textContent || '').includes('Set min/max line counts')) {
            return parent;
          }
          parent = parent.parentElement;
        }
        // Fall back to the heading's immediate parent
        return h.parentElement;
      }
    }
    return null;
  }

  function buildRow() {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-antcv-page-budget-row', '1');
    wrap.style.cssText =
      'margin: 0 0 14px 0; padding: 10px 12px;' +
      'background: rgba(1,183,187,0.06);' +
      'border: 1px solid rgba(1,183,187,0.25);' +
      'border-radius: 6px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);font-weight:600;margin-bottom:6px;letter-spacing:0.3px;';
    lbl.textContent = 'Target CV length';
    wrap.appendChild(lbl);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    wrap.appendChild(row);

    const select = document.createElement('select');
    select.style.cssText =
      'flex: 1 1 140px; min-width: 140px;' +
      'padding: 5px 8px; font-size: 11px;' +
      'background: rgba(255,255,255,0.06); color: #fff;' +
      'border: 1px solid rgba(255,255,255,0.18); border-radius: 4px;' +
      'font-family: inherit;';
    const current = readBudget();
    for (const opt of OPTIONS) {
      const o = document.createElement('option');
      o.value = String(opt.v);
      o.textContent = opt.label;
      o.style.color = '#1a1a1a';
      o.style.background = '#ffffff';
      if (Math.abs(opt.v - current) < 0.001) o.selected = true;
      select.appendChild(o);
    }
    row.appendChild(select);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:9.5px;color:rgba(255,255,255,0.5);margin-top:6px;line-height:1.45;';
    function refreshHint(v) {
      const opt = OPTIONS.find(o => Math.abs(o.v - v) < 0.001) || OPTIONS[1];
      hint.textContent = opt.hint;
    }
    refreshHint(current);
    wrap.appendChild(hint);

    select.addEventListener('change', function () {
      const v = parseFloat(select.value);
      if (isNaN(v)) return;
      writeBudget(v);
      refreshHint(v);
    });

    // Note + reset
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4);margin-top:8px;line-height:1.4;';
    note.innerHTML = 'This target informs the LLM during CV generation. The line-target sliders below give fine control within the chosen length.';
    wrap.appendChild(note);

    return wrap;
  }

  function inject() {
    if (document.querySelector('[data-antcv-page-budget-row="1"]')) return;
    const container = findLineTargetsContainer();
    if (!container) return;

    // Insert after the description div (the one that contains "Set min/max line counts")
    let inserted = false;
    const kids = Array.from(container.children);
    for (let i = 0; i < kids.length; i++) {
      if ((kids[i].textContent || '').includes('Set min/max line counts')) {
        const row = buildRow();
        if (i + 1 < kids.length) {
          container.insertBefore(row, kids[i + 1]);
        } else {
          container.appendChild(row);
        }
        inserted = true;
        break;
      }
    }
    // Fallback: prepend if we couldn't find the description div
    if (!inserted) {
      const row = buildRow();
      container.insertBefore(row, container.firstChild);
    }
  }

  // The LINE TARGETS panel is inside a collapsible <details> — it
  // may not be in the DOM when our sidecar boots. Re-inject on
  // every UI change via MutationObserver, debounced.
  let scheduled = false;
  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      try { inject(); } catch (e) { console.warn('[page-budget] inject failed:', e && e.message); }
    });
  }

  function start() {
    scheduleInject();
    const mo = new MutationObserver(scheduleInject);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
