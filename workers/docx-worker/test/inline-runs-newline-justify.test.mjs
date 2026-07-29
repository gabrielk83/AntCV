/* NEWLINE-JUSTIFY-001 regression guard.
 *
 * Owner report (2026-07-05, live PDF): "roles and results has both many
 * orphans and justification issues" — several multi-line bullets showed a
 * short, ragged line ENDING WELL SHORT OF THE MARGIN mid-paragraph (not just
 * at the natural end), e.g. "...Sigma-Connectivity ODM / site in Sweden for
 * a high-security smartphone / product; own...". Root cause: a stray
 * literal \n in generated bullet/prose text becomes a REAL Word line break
 * once it reaches a TextRun (the docx library auto-splits \n into separate
 * runs joined by <w:br/>), and Word's paragraph-justify never stretches a
 * manually-broken line to the margin — only a natural word-wrap does.
 *
 * Fix: inlineRuns() now collapses any whitespace run containing a newline/CR
 * to a single space before building runs, so the whole paragraph reflows
 * and justifies naturally. This guards that specifically, plus confirms the
 * pre-existing markdown-link / bold-tag behaviour still works afterward.
 *
 * Run: node --test workers/docx-worker/test/inline-runs-newline-justify.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start) + endMarker.length;
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

const decodeSrc = extract('function decodeBasicEntities(s) {', '\n}');
const styledSrc = extract('function styledRuns(s, baseRun) {', '\n}');
const inlineSrc = extract('function inlineRuns(text, baseRun) {', '\n}');

// Minimal stand-ins for the real `docx` library classes — the functions
// under test only ever read back .text/.bold/.italics/.link/.children off
// what they construct, so plain recording objects are sufficient.
class TextRun { constructor(opts) { Object.assign(this, opts); } }
class ExternalHyperlink { constructor(opts) { Object.assign(this, opts); } }

const ctx = { console, String, RegExp, TextRun, ExternalHyperlink };
vm.createContext(ctx);
vm.runInContext(
  decodeSrc + '\n' + styledSrc + '\n' + inlineSrc +
  '\nthis.inlineRuns = inlineRuns; this.styledRuns = styledRuns;',
  ctx,
);
const { inlineRuns } = ctx;

const baseRun = { color: '#000000', size: 20, font: 'Calibri' };

test('a single embedded newline collapses to one space — no stranded short line', () => {
  const runs = inlineRuns(
    'Direct technical work across a 7-person EO and optics team at the Sigma-Connectivity ODM\nsite in Sweden for a high-security smartphone\nproduct; own camera, display, and biometric optical stack.',
    baseRun,
  );
  assert.equal(runs.length, 1);
  assert.equal(
    runs[0].text,
    'Direct technical work across a 7-person EO and optics team at the Sigma-Connectivity ODM site in Sweden for a high-security smartphone product; own camera, display, and biometric optical stack.',
  );
  assert.ok(!runs[0].text.includes('\n'), 'no literal newline reaches the TextRun');
});

test('CRLF and bare CR both collapse the same as LF', () => {
  assert.equal(inlineRuns('a\r\nb', baseRun)[0].text, 'a b');
  assert.equal(inlineRuns('a\rb', baseRun)[0].text, 'a b');
});

test('surrounding spaces around a newline do not produce a double space', () => {
  assert.equal(inlineRuns('a \n b', baseRun)[0].text, 'a b');
  assert.equal(inlineRuns('a\n b', baseRun)[0].text, 'a b');
  assert.equal(inlineRuns('a \nb', baseRun)[0].text, 'a b');
});

test('multiple consecutive newlines (a blank line) still collapse to one space', () => {
  assert.equal(inlineRuns('a\n\n\nb', baseRun)[0].text, 'a b');
});

test('text with no newline is completely unaffected', () => {
  assert.equal(inlineRuns('Nothing to collapse here.', baseRun)[0].text, 'Nothing to collapse here.');
});

test('bold/italic tag styling still works after newline normalization spans a tag boundary', () => {
  const runs = inlineRuns('Own change governance for the LiDAR\n<b>product line</b> under Automotive SPICE.', baseRun);
  const texts = runs.map((r) => r.text);
  assert.equal(JSON.stringify(texts), JSON.stringify(['Own change governance for the LiDAR ', 'product line', ' under Automotive SPICE.']));
  assert.equal(runs[1].bold, true);
  assert.equal(runs[0].bold, false);
});

test('a markdown link surviving a newline in the surrounding text still becomes a real hyperlink', () => {
  const runs = inlineRuns('See [our site](https://example.com)\nfor more details.', baseRun);
  const link = runs.find((r) => r instanceof ExternalHyperlink);
  assert.ok(link, 'hyperlink run present');
  assert.equal(link.link, 'https://example.com');
  assert.equal(link.children[0].text, 'our site');
  const plain = runs.filter((r) => !(r instanceof ExternalHyperlink)).map((r) => r.text).join('');
  assert.equal(plain, 'See  for more details.'); // newline collapsed to a space around the link segment
});

test('null/undefined text still returns an empty array (unchanged behaviour)', () => {
  assert.equal(inlineRuns(null, baseRun).length, 0);
  assert.equal(inlineRuns(undefined, baseRun).length, 0);
});
