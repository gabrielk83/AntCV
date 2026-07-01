/* SIGNATURE-THUMB-ADAPT-001 — the signature thumbnail must fit its panel (transparent bg) and
 * flip the ink light on a DARK panel (brightness(0) invert(1)), stay as-is on a LIGHT panel, and
 * default to the dark treatment when the background can't be resolved. Tests the REAL bgLum +
 * adaptThumb extracted verbatim from source, with a stubbed getComputedStyle + fake ancestor chain. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-cl-signature-control.js');
const src = readFileSync(SRC, 'utf8');
function extract(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' found');
  let i = src.indexOf('{', start), depth = 0, end = -1;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
  return src.slice(start, end);
}
const body = extract('bgLum') + '\n' + extract('adaptThumb') + '\nreturn adaptThumb;';

function makeAdapt(bgByNode) {
  // fake DOM: a thumb whose parent chain carries background colors; getComputedStyle reads __bg.
  const getComputedStyle = (n) => ({ backgroundColor: (n && n.__bg) || '' });
  return new Function('getComputedStyle', body)(getComputedStyle);
}
function chain(bgs) {
  // build parent chain bottom-up; bgs[0] is the thumb's parent, etc.
  let parent = null;
  for (let i = bgs.length - 1; i >= 0; i--) parent = { __bg: bgs[i], parentElement: parent };
  return { style: {}, parentElement: parent };
}

test('dark panel -> transparent bg + light-flip filter', () => {
  const adapt = makeAdapt();
  const thumb = chain(['rgb(26, 35, 50)']); // dark navy
  adapt(thumb);
  assert.equal(thumb.style.background, 'transparent');
  assert.equal(thumb.style.filter, 'brightness(0) invert(1)');
});

test('light panel -> transparent bg + no filter (dark ink stays)', () => {
  const adapt = makeAdapt();
  const thumb = chain(['rgb(255, 255, 255)']);
  adapt(thumb);
  assert.equal(thumb.style.background, 'transparent');
  assert.equal(thumb.style.filter, '');
});

test('unresolvable bg (all transparent) -> defaults to dark treatment', () => {
  const adapt = makeAdapt();
  const thumb = chain(['rgba(255,255,255,0.02)', 'rgba(0,0,0,0)']); // low-alpha -> skipped
  adapt(thumb);
  assert.equal(thumb.style.filter, 'brightness(0) invert(1)', 'null luminance -> dark default');
});

test('picks the first opaque ancestor background', () => {
  const adapt = makeAdapt();
  const thumb = chain(['rgba(0,0,0,0)', 'rgb(240, 240, 240)']); // skip transparent, hit light
  adapt(thumb);
  assert.equal(thumb.style.filter, '', 'light opaque ancestor -> no flip');
});
