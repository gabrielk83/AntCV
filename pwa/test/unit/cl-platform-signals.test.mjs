// cl-platform-signals.test.mjs
// ============================================================
// CL-PLATFORM-SIGNALS-001 (register row 32). Locks the platform-class CL
// gen-prompt rule into BOTH bundles: the platform-class JD gate (detector regex)
// and the rule's load-bearing instruction fragments must be present in app.src.js
// AND the minified app.js mirror, and the rule must be wired into the prompt chain
// between the cluster rule and the brand-fit rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

for (const [name, text] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: platform-class detector gate present`, () => {
    assert.match(text, /\/platform\|modular\|reuse\|product\\s\*fami\/i/);
  });

  test(`${name}: rule text carries the owner spec`, () => {
    assert.match(text, /CL-PLATFORM-SIGNALS-001/);
    assert.match(text, /PLATFORM THINKING/);
    assert.match(text, /modular platforms, reuse across products/);
    assert.match(text, /NEVER a keyword list/);
    assert.match(text, /REQUIREMENTS, ARCHITECTURE, CHANGE GOVERNANCE and PRIORITISATION/);
    assert.match(text, /TONE IS CURIOSITY/);
    assert.match(text, /I was curious how you/);
    assert.match(text, /'innovation', 'cutting-edge' and 'world-class' are BANNED/);
  });

  test(`${name}: rule is gated on a present JD (not unsolicited)`, () => {
    assert.match(text, /(if\s*\(\s*__noJD\s*\)\s*return\s*"";|if\(g\)return"";)[^]{0,140}product\\s\*fami/);
  });

  test(`${name}: rule text uses hyphens, not em dashes`, () => {
    // scope: just the platform rule fragment
    const i = text.indexOf('CL-PLATFORM-SIGNALS-001): this JD is a HARDWARE');
    const frag = i >= 0 ? text.slice(i, i + 1400) : '';
    assert.ok(frag.length > 200, 'rule fragment found');
    assert.ok(!/[—–]/.test(frag), 'no em/en dash in the platform rule text');
  });
}

test('app.src.js: rule wired into the prompt chain after the cluster rule', () => {
  assert.match(src, /\$\{__clusterRule\}\$\{__platformRule\}\$\{__brandFitRule\}/);
});

test('app.js: minified mirror wired into the prompt chain after the cluster rule', () => {
  assert.match(app, /\$\{__cr\}\$\{__pr\}\$\{w\}/);
});
