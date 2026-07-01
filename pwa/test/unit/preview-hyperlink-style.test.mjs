/* PREVIEW-HYPERLINK-STYLE-002 — markup(text, color) turns markdown [text](url) and bare URLs into
 * styled <a> for the preview (raw markdown hidden), escaping HTML, using the passed link colour.
 * Tests the REAL markup() extracted verbatim from source. (Colour-by-background + no-blink idempotency
 * were verified live: LinkedIn -> white on the navy header, second pass = 0 changes, zero errors.) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-preview-hyperlink-style.js');
const src = readFileSync(SRC, 'utf8');
const a = src.indexOf('function esc(');
const marker = 'return touched ? out : null;';
const b = src.indexOf(marker, src.indexOf('function markup(')) + marker.length;
const block = src.slice(a, b) + '\n  }\nreturn markup;';
// markup needs esc + the MD/BARE regex constants — pull the constants in too
const consts = "var MD = " + src.match(/var MD = (\/[^\n]*\/g);/)[1] + ";\nvar BARE = " + src.match(/var BARE = (\/[^\n]*\/g);/)[1] + ";\n";
const markup = new Function(consts + block)();

test('markdown [text](url) -> styled anchor in the given colour, raw markdown hidden', () => {
  const out = markup('Details via [Google Scholar](https://scholar.google.com/x)', '#00746E');
  assert.match(out, /<a href="https:\/\/scholar\.google\.com\/x"[^>]*>Google Scholar<\/a>/);
  assert.ok(!out.includes('[Google Scholar]'), 'raw markdown removed');
  assert.match(out, /color:#00746E/);
  assert.match(out, /text-decoration:underline/);
});

test('white colour (dark background) is honoured', () => {
  const out = markup('[LinkedIn](https://linkedin.com/in/x)', 'rgba(255,255,255,0.95)');
  assert.match(out, /color:rgba\(255,255,255,0\.95\)/);
});

test('bare http URL -> styled anchor', () => {
  const out = markup('see https://example.com/page here', '#00746E');
  assert.match(out, /<a href="https:\/\/example\.com\/page"[^>]*>https:\/\/example\.com\/page<\/a>/);
});

test('plain text with no link -> null (no change)', () => {
  assert.equal(markup('just some plain text, no links', '#00746E'), null);
});

test('HTML in the text is escaped (no injection)', () => {
  const out = markup('x <b>hi</b> [L](https://a.co/1)', '#00746E');
  assert.ok(out.includes('&lt;b&gt;hi&lt;/b&gt;'), 'angle brackets escaped');
  assert.match(out, /<a href="https:\/\/a\.co\/1"/);
});
