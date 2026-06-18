/* accessibility-comment-strip.test.mjs — ACCESS-NO-COMMENT-001 (owner 2026-06-19)
 * The CV ACCESSIBILITY labeled_list row's `item.v` must have the trailing
 * 3rd-person "it has not limited his/their/her career" sentence stripped, while
 * the rest of the prose survives, the field is never blanked, the operation is
 * idempotent, and the COVER LETTER copy is left untouched (allowed there).
 *
 * The sidecar is a <script> IIFE (not an ES module): stub window/document/
 * localStorage + the timers, then eval the file so it publishes
 * window.AntcvAccessibilityCommentStrip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(path.join(ROOT, 'antcv-accessibility-comment-strip.js'), 'utf8');

let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
globalThis.window = globalThis.window || {};
globalThis.window.addEventListener = () => {};
globalThis.window.dispatchEvent = () => {};
globalThis.window.requestAnimationFrame = (fn) => { fn(); return 0; };
globalThis.document = { activeElement: null };
// Neutralise the sidecar's scheduled ticks so the node process doesn't hang and
// no async write fires during the synchronous assertions; we drive _apply()
// directly.
const _setTimeout = globalThis.setTimeout, _setInterval = globalThis.setInterval;
globalThis.setTimeout = () => 0;
globalThis.setInterval = () => 0;

// Run the IIFE -> publishes window.AntcvAccessibilityCommentStrip.
(0, eval)(SRC);

globalThis.setTimeout = _setTimeout;
globalThis.setInterval = _setInterval;

const API = globalThis.window.AntcvAccessibilityCommentStrip;
assert.ok(API && typeof API._strip === 'function', 'sidecar published _strip');

const KEEP = 'Hearing-impaired; appreciates clear visual contact and written follow-up';

test('_strip removes the trailing his/their/her-career comment, keeps the prose', () => {
  for (const tail of [
    '. It has not limited his career.',
    '. It has not limited their career.',
    '. It has not limited her career.',
    ' — it has not limited his career',
    '. This has not limited his career trajectory.',
  ]) {
    const out = API._strip(KEEP + tail);
    assert.equal(out, KEEP, `stripped: ${JSON.stringify(tail)}`);
  }
});

test('_strip is a no-op when there is no trailing career comment', () => {
  assert.equal(API._strip(KEEP), null);
  assert.equal(API._strip('Wheelchair access required.'), null);
  assert.equal(API._strip('Career-long focus on accessible documentation.'), null);
});

test('_strip never blanks the field', () => {
  // Field that is ONLY the comment -> returning null preserves the data.
  assert.equal(API._strip('It has not limited his career.'), null);
});

test('_strip is idempotent', () => {
  const once = API._strip(KEEP + '. It has not limited his career.');
  assert.equal(once, KEEP);
  assert.equal(API._strip(once), null, 'second pass is a no-op');
});

test('_apply cleans the CV accessibility row but leaves the CL copy intact', () => {
  store = {
    sections: JSON.stringify({
      cv: [
        { id: 'accessibility', title: 'ACCESSIBILITY', loc: 'sidebar', on: true, type: 'labeled_list',
          items: [{ l: 'Accessibility', v: KEEP + '. It has not limited his career.' }] },
        { id: 'languages', title: 'LANGUAGES', type: 'labeled_list',
          items: [{ l: 'Languages', v: 'English (native), Danish (B1)' }] },
      ],
      cl: [
        { id: 'accessibility', title: 'ACCESSIBILITY', type: 'labeled_list',
          items: [{ l: 'Accessibility', v: KEEP + '. It has not limited his career.' }] },
      ],
    }),
  };
  API._apply();
  const out = JSON.parse(store.sections);
  assert.equal(out.cv[0].items[0].v, KEEP, 'CV row stripped');
  assert.equal(out.cv[1].items[0].v, 'English (native), Danish (B1)', 'other CV section untouched');
  assert.equal(out.cl[0].items[0].v, KEEP + '. It has not limited his career.', 'CL copy preserved');

  const before = store.sections;
  API._apply();
  assert.equal(store.sections, before, 'second apply is a no-op');
});
