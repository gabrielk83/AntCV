/* PREVIEW-HYPERLINK-STYLE-001 — markup() turns markdown [text](url) and bare URLs into styled
 * <a> for the preview (raw markdown hidden), escaping HTML. Tests the REAL markup() + its helpers
 * extracted verbatim from source. (DOM safety was verified live: the preview survives the React
 * re-render with zero console errors.) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-preview-hyperlink-style.js');
const src = readFileSync(SRC, 'utf8');
// grab the self-contained block: constants + esc + inHeaderBand + linkStyle + markup
const a = src.indexOf("var LINK_TEAL");
const marker = 'return touched ? out : null;';
const b = src.indexOf(marker, src.indexOf('function markup(')) + marker.length;
const block = src.slice(a, b) + '\n  }\nreturn markup;';
const markup = new Function(block)();

const bodyEl = { closest: () => null };          // body context -> teal link style

test('markdown [text](url) -> styled anchor, raw markdown hidden', () => {
  const out = markup('Details via [Google Scholar](https://scholar.google.com/x)', bodyEl);
  assert.match(out, /<a href="https:\/\/scholar\.google\.com\/x"[^>]*>Google Scholar<\/a>/);
  assert.ok(!out.includes('[Google Scholar]'), 'raw markdown removed');
  assert.match(out, /color:#00746E/);
  assert.match(out, /text-decoration:underline/);
});

test('bare http URL -> styled anchor', () => {
  const out = markup('see https://example.com/page here', bodyEl);
  assert.match(out, /<a href="https:\/\/example\.com\/page"[^>]*>https:\/\/example\.com\/page<\/a>/);
});

test('plain text with no link -> null (no change)', () => {
  assert.equal(markup('just some plain text, no links', bodyEl), null);
});

test('HTML in the text is escaped (no injection)', () => {
  const out = markup('x <b>hi</b> [L](https://a.co/1)', bodyEl);
  assert.ok(out.includes('&lt;b&gt;hi&lt;/b&gt;'), 'angle brackets escaped');
  assert.match(out, /<a href="https:\/\/a\.co\/1"/);
});

test('header-band element -> inherit colour (light contact line stays)', () => {
  const headerEl = { closest: (sel) => (/header/.test(sel) ? {} : null) };
  const out = markup('[LinkedIn](https://linkedin.com/in/x)', headerEl);
  assert.match(out, /color:inherit/);
});
