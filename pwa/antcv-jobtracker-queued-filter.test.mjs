// JD-MENU-QUEUED-TAB-001 — the Job Tracker's List legend/filter gained a
// "⏰ Queued" checkbox that narrows the list to rows queued for tonight's
// generation (doc.queue[uk], the same state the nightly job-tracker runner
// toggles). These are structure tests: (1) the island SOURCE wires the filter
// end-to-end, and (2) the DEPLOYED bundle was rebuilt from that source (catches
// the "edited the .tsx but forgot `npm run build`" mistake — the bundle is what
// ships, the .tsx is not). See src/islands/JobTracker/JobTracker.tsx and
// docs/qa/NIGHT_SHIFT.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, '..', 'src', 'islands', 'JobTracker', 'JobTracker.tsx'), 'utf8');
const BUNDLE = readFileSync(join(HERE, 'antcv-react-islands.js'), 'utf8');

test('source: the JLFilters model carries queuedOnly (persisted in sessionStorage)', () => {
  assert.match(SRC, /interface JLFilters \{[^}]*queuedOnly: boolean;[^}]*\}/);
  assert.match(SRC, /queuedOnly: !!p\.queuedOnly/);          // hydrated on load
  assert.match(SRC, /queuedOnly: filterQueued/);             // saved on change
});

test('source: rowQueued is the single shared queue predicate (⏰ toggle + filter agree)', () => {
  // The module-level helper exists and mirrors the nightly-queue rule:
  // explicit doc.queue[uk] wins, else default-on until an artifact exists.
  assert.match(SRC, /function rowQueued\(doc: TrackerDoc \| null, uk: string\): boolean/);
  assert.match(SRC, /const q = doc\?\.queue\?\.\[uk\];/);
  // nightlyOn (the ⏰ per-row toggle) delegates to it, so the filter can never
  // disagree with which rows show a lit ⏰.
  assert.match(SRC, /const nightlyOn = \(uk: string\) => rowQueued\(doc, uk\);/);
});

test('source: the list filter honours the Queued checkbox', () => {
  assert.match(SRC, /if \(filterQueued && !rowQueued\(doc, uk\)\) return false;/);
  // filterQueued must be a dependency of the filteredRows memo, or toggling the
  // checkbox would not re-filter. Asserted as MEMBERSHIP, not as the exact
  // literal list: JOBLIST-FILTER-002 added filterRejected, and pinning the whole
  // array turns every future filter into a false failure in this file.
  const deps = SRC.match(/\}\), \[rows, filterBands[^\]]*\]\);/);
  assert.ok(deps, 'filteredRows memo dependency array not found');
  assert.match(deps[0], /\bfilterQueued\b/);
});

test('source: the Legend renders a ⏰ Queued checkbox wired to the toggle', () => {
  assert.match(SRC, /queuedOnly=\{filterQueued\} onToggleQueued=\{\(\) => setFilterQueued\(\(v\) => !v\)\}/);
  assert.match(SRC, /checked=\{queuedOnly\} onChange=\{onToggleQueued\}/);
  assert.match(SRC, /<b>⏰<\/b> Queued/);
});

test('deployed: antcv-react-islands.js was rebuilt with the Queued filter', () => {
  // The bundle is minified, but string literals survive verbatim. If these are
  // missing the source was edited without `npm run build` — the shipped app
  // would not have the filter.
  assert.ok(BUNDLE.includes('queuedOnly'), 'bundle missing queuedOnly — run `npm run build`');
  assert.ok(BUNDLE.includes('Queued'), 'bundle missing the Queued label — run `npm run build`');
});
