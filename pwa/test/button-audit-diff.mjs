// AUDIT-DIFF-NOISE-001 (2026-10-08, register row 23): compare two
// PANEL_BUTTON_AUDIT_<date>.json runs by LABEL and sort the differences by
// what they mean, so a nightly stops hand-rolling a diff and stops listing
// timing noise as findings.
//
// Why: two runs of diag-panel-button-audit.mjs at the SAME HEAD differed on
// 11 labels (active <-> ui-only, visible <-> not-visible). The active/ui-only
// split only asks whether a localStorage write landed inside the settle
// window, and the autosave debounce sometimes lands after it; visibility
// depends on what an earlier click in the same round left open. Neither is a
// regression. A regression is a label that stopped responding (DEAD / THROWS /
// unclickable) or disappeared.
//
// Pure, no I/O. Used by the diag's --diff leg and by its unit test.

export const RESPONDS = new Set(['active', 'ui-only']);
export const NOT_RESPONDING = new Set(['DEAD', 'THROWS', 'unclickable']);
export const HIDDEN = new Set(['not-visible-or-disabled']);

const LABEL_LEN = 80;
export const labelKey = (r) => String((r && (r.label || r.text)) || '').slice(0, LABEL_LEN);

function tally(results) {
  const m = new Map();
  for (const r of results || []) {
    const k = labelKey(r);
    const t = m.get(k) || { responds: 0, active: 0, uiOnly: 0, dead: 0, hidden: 0, skipped: 0, total: 0 };
    const v = String(r && r.verdict);
    t.total++;
    if (RESPONDS.has(v)) { t.responds++; if (v === 'active') t.active++; else t.uiOnly++; }
    else if (NOT_RESPONDING.has(v)) t.dead++;
    else if (HIDDEN.has(v)) t.hidden++;
    else t.skipped++;
    m.set(k, t);
  }
  return m;
}

/**
 * @param {{results:object[]}|object[]} prev  the earlier audit (parsed JSON or its results array)
 * @param {{results:object[]}|object[]} next  the later audit
 * @returns {{gone:string[], added:string[], regressions:object[], recoveries:object[],
 *            visibility:object[], respondsFlips:number, respondsFlipLabels:string[],
 *            prevTotal:number, nextTotal:number}}
 */
export function diffAudits(prev, next) {
  const P = Array.isArray(prev) ? prev : (prev && prev.results) || [];
  const N = Array.isArray(next) ? next : (next && next.results) || [];
  const a = tally(P), b = tally(N);
  const out = {
    gone: [], added: [], regressions: [], recoveries: [], visibility: [],
    respondsFlips: 0, respondsFlipLabels: [], prevTotal: P.length, nextTotal: N.length,
  };
  for (const k of a.keys()) if (!b.has(k)) out.gone.push(k);
  for (const k of b.keys()) if (!a.has(k)) out.added.push(k);
  for (const [k, x] of a) {
    const y = b.get(k);
    if (!y) continue;
    if (y.dead > x.dead) out.regressions.push({ label: k, before: x.dead, after: y.dead });
    else if (y.dead < x.dead) out.recoveries.push({ label: k, before: x.dead, after: y.dead });
    if (y.hidden !== x.hidden) out.visibility.push({ label: k, before: x.hidden, after: y.hidden });
    // Same number of responding buttons, split differently between active and
    // ui-only: the settle-window race, not a behaviour change.
    if (y.responds === x.responds && y.responds > 0 && (y.active !== x.active)) {
      out.respondsFlips++;
      out.respondsFlipLabels.push(k);
    }
  }
  return out;
}

export function formatDiff(d, prevName) {
  const lines = [
    `## Diff vs ${prevName || 'previous audit'} (by label)`,
    '',
    `- buttons: ${d.prevTotal} -> ${d.nextTotal}`,
    `- regressions (responding -> DEAD/THROWS/unclickable): ${d.regressions.length}`,
    ...d.regressions.map((r) => `  - "${r.label}" ${r.before} -> ${r.after}`),
    `- recoveries (DEAD/THROWS/unclickable -> responding): ${d.recoveries.length}`,
    ...d.recoveries.map((r) => `  - "${r.label}" ${r.before} -> ${r.after}`),
    `- visibility changes (not-visible count moved; state left by an earlier click, verify only if a label stays hidden across runs): ${d.visibility.length}`,
    ...d.visibility.map((r) => `  - "${r.label}" hidden ${r.before} -> ${r.after}`),
    `- active <-> ui-only flips: ${d.respondsFlips} (settle-window timing, not findings)`,
    `- labels gone: ${d.gone.length}${d.gone.length ? ' — ' + d.gone.map((g) => `"${g}"`).join(', ') : ''}`,
    `- labels added: ${d.added.length}${d.added.length ? ' — ' + d.added.map((g) => `"${g}"`).join(', ') : ''}`,
  ];
  return lines.join('\n');
}
