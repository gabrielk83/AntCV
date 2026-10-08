// AUDIT-DIFF-NOISE-001 — the button-audit diff sorts label changes by meaning:
// a label that stops responding is a regression; active <-> ui-only is the
// settle-window race and is only counted; visibility moves are listed, not flagged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffAudits, formatDiff } from '../button-audit-diff.mjs';

const r = (label, verdict) => ({ label, verdict, tag: 'button' });

const prev = {
  results: [
    r('Save', 'active'), r('Close', 'active'), r('Refresh', 'ui-only'),
    r('CJLR', 'not-visible-or-disabled'), r('CJLR', 'not-visible-or-disabled'), r('CJLR', 'active'),
    r('Undo', 'DEAD'), r('Fit', 'active'), r('Gone-only', 'active'),
    r('Generate', 'skipped-dangerous'),
  ],
};
const next = {
  results: [
    r('Save', 'ui-only'),            // responds both times: timing flip, not a finding
    r('Close', 'DEAD'),              // regression
    r('Refresh', 'ui-only'),         // unchanged
    r('CJLR', 'not-visible-or-disabled'), r('CJLR', 'active'), r('CJLR', 'active'), // one fewer hidden
    r('Undo', 'active'),             // recovery
    r('Fit', 'THROWS'),              // regression
    r('Added-only', 'active'),
    r('Generate', 'skipped-dangerous'),
  ],
};

test('regressions are labels that stopped responding', () => {
  const d = diffAudits(prev, next);
  assert.deepEqual(d.regressions.map((x) => x.label).sort(), ['Close', 'Fit']);
});

test('recoveries are labels that started responding', () => {
  const d = diffAudits(prev, next);
  assert.deepEqual(d.recoveries.map((x) => x.label), ['Undo']);
});

test('active <-> ui-only with the same responding count is counted, not flagged', () => {
  const d = diffAudits(prev, next);
  assert.equal(d.respondsFlips, 1);
  assert.deepEqual(d.respondsFlipLabels, ['Save']);
  assert.ok(!d.regressions.some((x) => x.label === 'Save'));
});

test('visibility moves are listed per label with before/after hidden counts', () => {
  const d = diffAudits(prev, next);
  assert.deepEqual(d.visibility, [{ label: 'CJLR', before: 2, after: 1 }]);
});

test('gone and added labels are reported; totals carried', () => {
  const d = diffAudits(prev, next);
  assert.deepEqual(d.gone, ['Gone-only']);
  assert.deepEqual(d.added, ['Added-only']);
  assert.equal(d.prevTotal, 10);
  assert.equal(d.nextTotal, 10);
});

test('identical runs diff to nothing', () => {
  const d = diffAudits(prev, prev);
  assert.equal(d.regressions.length + d.recoveries.length + d.visibility.length + d.respondsFlips + d.gone.length + d.added.length, 0);
});

test('accepts a bare results array and formats a markdown block', () => {
  const d = diffAudits(prev.results, next.results);
  const md = formatDiff(d, 'PANEL_BUTTON_AUDIT_2026-10-06.json');
  assert.match(md, /^## Diff vs PANEL_BUTTON_AUDIT_2026-10-06\.json/);
  assert.match(md, /regressions .*: 2/);
  assert.match(md, /"Close" 0 -> 1/);
  assert.match(md, /active <-> ui-only flips: 1/);
  assert.match(md, /labels gone: 1 — "Gone-only"/);
});
