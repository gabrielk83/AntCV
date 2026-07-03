// META-DRIFT-GUARD coverage lock (register row 31) — BOTH cloud-adoption
// blocks (cold-start restore AND Read-from-Cloud) must refuse to downgrade a
// live targeted draft to an unsolicited/empty row's meta+sections, in BOTH
// bundles. History: the two files had the guard on OPPOSITE blocks (the
// minified guarded cold-start only, the source guarded Read-from-Cloud only)
// — the unguarded block was "writer #2" flipping exports to Unsolicited.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

for (const [name, text] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: both cloud-adoption blocks carry a META-DRIFT guard`, () => {
    const g1 = (text.match(/META-DRIFT-GUARD(?!-002)/g) || []).length;
    const g2 = (text.match(/META-DRIFT-GUARD-002/g) || []).length;
    assert.ok(g1 >= 1, `${name}: original META-DRIFT-GUARD missing`);
    assert.ok(g2 >= 1, `${name}: META-DRIFT-GUARD-002 missing`);
    // every unconditional meta adoption is gone: each jd_company meta-adoption
    // site must have a draftDrift check within the preceding 900 chars
    const re = /company:\s*e\.jd_company\s*\|\|\s*""/g;
    let m, unguarded = 0;
    while ((m = re.exec(text)) !== null) {
      const pre = text.slice(Math.max(0, m.index - 900), m.index);
      if (!/draftDrift|__ddB|__dd2/i.test(pre)) unguarded++;
    }
    assert.equal(unguarded, 0, `${name}: ${unguarded} unguarded meta-adoption site(s)`);
  });
}
