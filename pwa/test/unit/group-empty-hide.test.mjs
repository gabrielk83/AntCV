/* Unit — GROUP-EMPTY-HIDE-001 (owner 2026-07-06).
 * A {grp} sub-heading (TOOLS & METHODS / "Project & delivery management") with NO rendered
 * child row must be hidden entirely (heading + label), not left as a bare dangling label.
 * The guard lives inline at BOTH render sites — the preview map in app.src.js/app.js and the
 * worker renderRichBlock in docx-worker. This test brace-extracts the real __grpHasChild from
 * the SOURCE (app.src.js) and the WORKER, runs one shared fixture table through both, and
 * asserts they agree AND give the expected result — pinning the owner-required preview↔export
 * parity. A mirror-lock string check confirms the minified app.js carries the same logic. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const appSrc = readFileSync(path.join(root, 'pwa', 'app.src.js'), 'utf8');
const appMin = readFileSync(path.join(root, 'pwa', 'app.js'), 'utf8');
const worker = readFileSync(path.join(root, 'workers', 'docx-worker', 'src', 'index.js'), 'utf8');

// Brace-match a "const NAME = (gi) => { ... };" arrow body out of a bundle.
function extractArrow(src, decl) {
  const start = src.indexOf(decl);
  assert.ok(start >= 0, 'declaration not found: ' + decl);
  const braceOpen = start + decl.length - 1; // decl ends with the arrow's own '{'
  let depth = 0, i = braceOpen;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i); // "const NAME = (gi) => {...}"
}

// Preview helper closes over the section `e`.
const previewBody = extractArrow(appSrc, 'const __grpHasChild = (gi) => {');
const makePreview = new Function('e', previewBody + '\n; return __grpHasChild;');
const previewHasChild = (section, gi) => makePreview(section)(gi);

// Worker helper closes over `s` (section) and `items`.
const workerBody = extractArrow(worker, 'const __grpHasChild = (gi) => {');
const makeWorker = new Function('s', 'items', workerBody + '\n; return __grpHasChild;');
const workerHasChild = (section, gi) => makeWorker(section, section.items || [])(gi);

// section, group-index, expected — cases where preview and export MUST agree.
const CASES = [
  ['empty group immediately followed by another group', { items: [{ grp: true, t: 'A' }, { grp: true, t: 'B' }, { b: 'x', t: 'y' }] }, 0, false],
  ['non-empty group (its own child before end)',         { items: [{ grp: true, t: 'A' }, { grp: true, t: 'B' }, { b: 'x', t: 'y' }] }, 1, true],
  ['only child renders nothing (blank + tOff)',          { items: [{ grp: true, t: 'A' }, { b: '', t: '', tOff: true }] }, 0, false],
  ['only child is a bracket placeholder body',           { items: [{ grp: true, t: 'A' }, { t: '[Sub-group]' }] }, 0, false],
  ['headlineOff lead-only placeholder child',            { headlineOff: true, items: [{ grp: true, t: 'A' }, { b: 'Work style', t: '[WORK STYLE - x]' }] }, 0, false],
  ['real lead+body child',                               { items: [{ grp: true, t: 'A' }, { b: 'Tools', t: 'Jira' }] }, 0, true],
  ['marker (bullet) child with body',                    { items: [{ grp: true, t: 'A' }, { mk: true, t: 'bullet' }] }, 0, true],
  ['"Hidden - <cat>" residue child does not count',      { items: [{ grp: true, t: 'A' }, { b: 'Hidden - tools', t: 'x' }] }, 0, false],
  ['group at end of items with no following rows',       { items: [{ b: 'x', t: 'y' }, { grp: true, t: 'A' }] }, 1, false],
];

for (const [label, section, gi, expected] of CASES) {
  test(`preview __grpHasChild: ${label}`, () => {
    assert.equal(previewHasChild(section, gi), expected);
  });
  test(`export __grpHasChild: ${label}`, () => {
    assert.equal(workerHasChild(section, gi), expected);
  });
  test(`preview↔export parity: ${label}`, () => {
    assert.equal(previewHasChild(section, gi), workerHasChild(section, gi));
  });
}

test('mirror-lock: minified app.js carries the empty-group guard', () => {
  assert.ok(/__gc=g=>/.test(appMin), 'app.js has the __gc helper');
  assert.ok(appMin.includes('if(!r.grpKeep&&!__gc(n))return null'), 'app.js grp branch calls __gc (grpKeep-guarded)');
  assert.ok(/x&&"object"==typeof x&&x\.grp\)break/.test(appMin), 'app.js helper scans to next group boundary');
});

test('mirror-lock: source app.src.js and worker both carry GROUP-EMPTY-HIDE-001', () => {
  assert.ok(appSrc.includes('GROUP-EMPTY-HIDE-001'), 'app.src.js sentinel');
  assert.ok(appSrc.includes('if (!row.grpKeep && !__grpHasChild(i)) return null'), 'app.src.js grp branch guarded (grpKeep-aware)');
  assert.ok(worker.includes('GROUP-EMPTY-HIDE-001'), 'worker sentinel');
  assert.ok(worker.includes('if (!row.grpKeep && !__grpHasChild(i)) return;'), 'worker grp branch guarded (grpKeep-aware)');
});
