// linear-pagination.test.mjs - owner 2026-09-30 "reduce page jumping" (Linear layout).
// LINEAR-WHOLE-MOVE-001 (app.js): a map that moves a WHOLE main section to a later page is honoured in Linear.
// LINEAR-PART-KEYS-001 (paginator): continuation parts restart at items.0 - keys are mapped back to original indices.
// LINEAR-CONVERGE-001 (paginator): an A-B-A map oscillation is stopped instead of re-armed every 2.5 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('app.js: whole-section move honoured in Linear only, at both split sites (mirrored in app.src.js)', () => {
  const app = read('app.js');
  const G = 'page:(a.length&&document.body&&document.body.getAttribute("data-antcv-cv-layout")==="linear"?a[0].page:t)}]';
  assert.equal(app.split(G).length - 1, 2, 'rows + items branches');
  assert.equal(app.split('return a.length<=1?[{...e,page:t}]').length - 1, 0, 'no unguarded base-page return left');
  assert.equal(read('app.src.js').split('LINEAR-WHOLE-MOVE-001').length - 1, 2, 'source mirror');
});

test('paginator: part keys mapped to original indices for main columns, Linear only', () => {
  const src = read('antcv-auto-pagebreak-block-001.js');
  assert.ok(src.includes("kind: 'item', key: isMainCol ? __origKey(__rSidEl, __rSid, __rm[1]) : __rm[1],"));
  assert.ok(/function __origKey\(sidEl, sid, key\) \{\s*if \(!__linearKeys/.test(src), 'no-op outside Linear');
});

test('paginator: A-B-A guard keeps the current maps in Linear', () => {
  const src = read('antcv-auto-pagebreak-block-001.js');
  assert.ok(/__isLinearLayout\(\) && __writtenPairs\.length >= 2 && __writtenPairs\[__writtenPairs\.length - 2\] === __pair/.test(src));
  assert.ok(src.indexOf('__writtenPairs.push(__pair)') > src.indexOf('LINEAR-CONVERGE-001'), 'recorded only after a real write');
});
