/* AntCV CL body Move button (v1.40.341-p0c)
 * ============================================================
 *
 * CL-005 (Cover Letter body section Move button)
 * ----------------------------------------------
 * The plan calls out that Candidate items have a Move button but
 * CL body rows do NOT. Acceptance per §4.3: "Move button visible
 * on every movable body row. Toggling visibility doesn't corrupt
 * content. Required controls remain visible."
 *
 * Scope here is *visibility* — the actual reorder semantics (which
 * destinations are allowed, drag-and-drop, restore round-trips)
 * are CA-003 / P0-D. CL-005 just ensures the button is mounted at
 * the leftmost position of the existing action cluster on every
 * movable CL body row.
 *
 * Movable body row section IDs (from CL canonical structure):
 *   greeting, opening, who_am, what_bring, why_position,
 *   how_found, foundation, closure, closing
 *
 * On click, the button dispatches:
 *   CustomEvent('antcv:section-move-requested',
 *               { detail: { sectionId, source: 'cl-body-move-341' } })
 * — app.js or the downstream drag-and-drop sidecars (P0-D)
 * subscribe and produce the actual reorder UI.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0c';
  if (window.__antcvClBodyMoveButton341 === SCRIPT_VERSION) return;
  window.__antcvClBodyMoveButton341 = SCRIPT_VERSION;

  // Section IDs we consider movable CL body rows.
  var CL_BODY_SIDS = {
    'greeting':      'Greeting',
    'opening':       'Opening',
    'who_am':        'Who I Am',
    'what_bring':    'What I Bring',
    'why_position':  'Why This Position',
    'how_found':     'How I Would Contribute',
    'foundation':    'Foundation',
    'closure':       'Closure',
    'closing':       'Closing',
  };

  function rowsInEditor() {
    // Editor-panel rows live OUTSIDE .antcv-preview-paper. Find every
    // element with data-sid that ISN'T inside the preview paper.
    var paper = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
    var all = document.querySelectorAll('[data-sid]');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el || el.nodeType !== 1) continue;
      if (paper && paper.contains(el)) continue;
      var sid = el.getAttribute('data-sid') || '';
      if (!CL_BODY_SIDS.hasOwnProperty(sid)) continue;
      // Skip rows that already carry our marker (idempotent).
      if (el.getAttribute('data-antcv-cl-body-move-341') === '1') continue;
      out.push(el);
    }
    return out;
  }

  function findClusterInRow(row) {
    // Prefer the SectionControlBar host if one already mounted here
    // (downstream P0-D would inject it there). Otherwise look for
    // any inline container with 2+ buttons next to the section label.
    var bar = row.querySelector('[data-antcv-control-bar="1"]');
    if (bar) return bar;
    // Heuristic: pick the FIRST inline-flex element inside the row
    // that has >= 2 button children.
    var spans = row.querySelectorAll('span, div');
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i];
      if (!sp.isConnected) continue;
      var btns = sp.querySelectorAll(':scope > button');
      if (btns.length >= 2) return sp;
    }
    return null;
  }

  function makeMoveButton(sid, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = '☰';
    var tooltip = 'Move ' + label;
    b.title = tooltip;
    b.setAttribute('aria-label', tooltip);
    b.setAttribute('data-antcv-cl-body-move-button', sid);
    b.setAttribute('data-testid', 'cl-body.' + sid + '.move');
    b.style.display = 'inline-flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.style.width = '23px';
    b.style.minWidth = '23px';
    b.style.maxWidth = '23px';
    b.style.height = '22px';
    b.style.padding = '0';
    b.style.margin = '0 2px 0 0';
    b.style.borderRadius = '5px';
    b.style.fontSize = '12px';
    b.style.lineHeight = '1';
    b.style.fontWeight = '700';
    b.style.cursor = 'pointer';
    b.style.boxSizing = 'border-box';
    b.style.flex = '0 0 auto';
    b.style.background = 'rgba(40,53,86,0.08)';
    b.style.color = '#283556';
    b.style.border = '1px solid #283556';
    // GEN-003: Move sits at the LEFTMOST position (order 10).
    b.style.order = '10';
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      try {
        window.dispatchEvent(new CustomEvent('antcv:section-move-requested', {
          detail: { sectionId: sid, source: 'cl-body-move-341' },
        }));
      } catch (_) {}
    });
    return b;
  }

  function ensureMoveOnRow(row) {
    var sid = row.getAttribute('data-sid') || '';
    var label = CL_BODY_SIDS[sid];
    if (!label) return;
    // Already injected on this row? Skip.
    if (row.querySelector(':scope [data-antcv-cl-body-move-button="' + sid + '"]')) return;
    var cluster = findClusterInRow(row);
    if (!cluster) return;
    // Ensure the cluster lays out as flex so `order: 10` actually
    // positions the Move button to the leftmost position.
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(cluster) : null;
      if (cs && cs.display.indexOf('flex') < 0) cluster.style.display = 'flex';
    } catch (_) {}
    var btn = makeMoveButton(sid, label);
    if (cluster.firstChild) {
      cluster.insertBefore(btn, cluster.firstChild);
    } else {
      cluster.appendChild(btn);
    }
    row.setAttribute('data-antcv-cl-body-move-341', '1');
  }

  function sweepOnce() {
    var rows = rowsInEditor();
    for (var i = 0; i < rows.length; i++) {
      try { ensureMoveOnRow(rows[i]); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepOnce(); } catch (_) {}
    });
  }

  schedule();
  var delays = [200, 600, 1500, 3000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvClBodyMoveButton341 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
  };

  try { console.debug('[cl-body-move-button] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
