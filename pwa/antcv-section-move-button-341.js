/* AntCV universal section Move button (v1.40.341-p0d)
 * ============================================================
 *
 * CA-003 (and supersedes P0-C's CL-only Move sidecar)
 * ---------------------------------------------------
 * Acceptance: "Section move button on every movable item:
 *   Candidate, cover letter body, CV sidebar, CV main.
 * Placed left of the action cluster. Tooltip and aria-label
 * name the allowed destinations."
 *
 * This sidecar is the universal version of the CL-only Move
 * button (antcv-cl-body-move-button-341 from P0-C). It targets
 * the editor-panel rows for every movable item type in both
 * CV and CL.
 *
 * Movable categories:
 *   - CL body rows (carries the same section IDs P0-C handled
 *     plus the Candidate block).
 *   - CV main + CV sidebar rows — every section that carries
 *     a [data-sid] AND has a sibling action cluster.
 *
 * Destination matrix
 * ------------------
 * The tooltip names the allowed destinations per item type:
 *   Candidate           → topbar (immovable; tooltip says so)
 *   CL body section     → topbar | main | sidebar
 *   CV main section     → main | sidebar | topbar
 *   CV sidebar section  → sidebar | main | topbar
 *
 * The CA-002 "no duplicate label" rule applies: Candidate is in
 * topbar by definition; if a destination matrix offers topbar to
 * a non-Candidate row, the actual reorder logic in P0-D's DnD
 * sidecar will reject the move. Showing the button is enough for
 * CA-003.
 *
 * Click dispatches:
 *   CustomEvent('antcv:section-move-requested',
 *               { detail: { sectionId, container, destinations,
 *                           source: 'section-move-button-341' } })
 *
 * Co-existence with P0-C's CL-only Move button
 * --------------------------------------------
 * P0-C's CL-only sidecar (antcv-cl-body-move-button-341)
 * targets CL body rows via [data-antcv-cl-body-move-341] marker.
 * THIS sidecar uses [data-antcv-section-move-341] as its marker,
 * and IGNORES rows already carrying the CL-only marker. When
 * P0-C and P0-D both merge, the CL-only sidecar continues
 * handling CL bodies; this sidecar adds Candidate + CV main +
 * CV sidebar. No double Move buttons.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0d';
  if (window.__antcvSectionMoveButton341 === SCRIPT_VERSION) return;
  window.__antcvSectionMoveButton341 = SCRIPT_VERSION;

  // CL body SIDs the CL-only sidecar (P0-C) already handles.
  var CL_BODY_SIDS = {
    'greeting': 1, 'opening': 1, 'who_am': 1, 'what_bring': 1,
    'why_position': 1, 'how_found': 1, 'foundation': 1,
    'closure': 1, 'closing': 1,
  };

  // Map container → destination set + readable label.
  var DEST_MATRIX = {
    'topbar':  { destinations: ['topbar'],                 label: 'top bar' },
    'main':    { destinations: ['main', 'sidebar', 'topbar'], label: 'main column' },
    'sidebar': { destinations: ['sidebar', 'main', 'topbar'], label: 'sidebar' },
  };

  function findContainerKind(row) {
    // Walk up looking for a container marker. Several sidecars
    // already use 'data-candidate-drop-loc' for topbar/main/sidebar
    // anchors. Fall back to inspecting parents.
    var p = row;
    for (var i = 0; p && i < 10; i++, p = p.parentElement) {
      if (!p || !p.getAttribute) continue;
      var loc = p.getAttribute('data-candidate-drop-loc');
      if (loc && DEST_MATRIX[loc]) return loc;
      var docSec = p.getAttribute('data-doc-section');
      if (docSec === 'main' || docSec === 'sidebar') return docSec;
    }
    // Heuristic fallback: rows inside an element with class
    // 'antcv-document-sidebar' are sidebar; otherwise main.
    var sb = row.closest && row.closest('.antcv-document-sidebar, [data-antcv-document-sidebar="true"]');
    if (sb) return 'sidebar';
    var topbar = row.closest && row.closest('[data-candidate-drop-loc="topbar"]');
    if (topbar) return 'topbar';
    return 'main';
  }

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function findCluster(row) {
    // Same heuristic as P0-C's CL-only Move sidecar: the first
    // inline element inside the row that has >= 2 button children.
    var bar = row.querySelector('[data-antcv-control-bar="1"]');
    if (bar) return bar;
    var spans = row.querySelectorAll('span, div');
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i];
      if (!sp.isConnected) continue;
      var btns = sp.querySelectorAll(':scope > button');
      if (btns.length >= 2) return sp;
    }
    return null;
  }

  function makeMoveButton(sectionId, container, label) {
    var matrix = DEST_MATRIX[container] || DEST_MATRIX.main;
    var destList = matrix.destinations.filter(function (d) { return d !== container; });
    var tooltip = destList.length
      ? 'Move ' + label + ' (destinations: ' + destList.join(', ') + ')'
      : 'Move ' + label;
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = '☰';
    b.title = tooltip;
    b.setAttribute('aria-label', tooltip);
    b.setAttribute('data-antcv-section-move-button', sectionId);
    b.setAttribute('data-testid', 'section.' + sectionId + '.move');
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
    b.style.order = '10'; // leftmost per GEN-003
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      try {
        window.dispatchEvent(new CustomEvent('antcv:section-move-requested', {
          detail: {
            sectionId: sectionId,
            container: container,
            destinations: matrix.destinations,
            source: 'section-move-button-341',
          },
        }));
      } catch (_) {}
    });
    return b;
  }

  function ensureMoveOnRow(row, paper) {
    if (!row || !row.isConnected) return;
    // Don't inject into the Preview paper — Move belongs in the
    // editor panel.
    if (paper && paper.contains(row)) return;
    // CL body rows already get a Move from the P0-C sidecar.
    if (row.hasAttribute('data-antcv-cl-body-move-341')) return;
    // Already done by us.
    if (row.hasAttribute('data-antcv-section-move-341')) return;
    var sid = row.getAttribute('data-sid') || '';
    if (!sid) return;
    // Skip rows that aren't movable. We use the presence of an
    // action cluster as a heuristic — sections with no cluster are
    // typically not user-movable (the wizard or system holds them).
    var cluster = findCluster(row);
    if (!cluster) return;
    var container = findContainerKind(row);
    // Topbar-only items (Candidate) get the button too — tooltip
    // declares they can be moved out of topbar. The actual reorder
    // policy is enforced by app.js / DnD sidecars on drop.
    var label = sid;
    // Friendly label fallback: the row's first heading-like text.
    var heading = row.querySelector('h1, h2, h3, h4, h5, strong, b');
    if (heading) {
      var ht = (heading.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim();
      if (ht) label = ht;
    }
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(cluster) : null;
      if (cs && cs.display.indexOf('flex') < 0) cluster.style.display = 'flex';
    } catch (_) {}
    var btn = makeMoveButton(sid, container, label);
    if (cluster.firstChild) {
      cluster.insertBefore(btn, cluster.firstChild);
    } else {
      cluster.appendChild(btn);
    }
    row.setAttribute('data-antcv-section-move-341', '1');
  }

  function sweepOnce() {
    var paper = findPreviewPaper();
    var rows = document.querySelectorAll('[data-sid]');
    for (var i = 0; i < rows.length; i++) {
      try { ensureMoveOnRow(rows[i], paper); } catch (_) {}
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

  window.AntcvSectionMoveButton341 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
  };

  try { console.debug('[section-move-button] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
