/* AI-NOTICE-POSITION-CONTROL-001 — the manual notice corner (auto/left/center/right) must flow:
 *  - worker aiNoticeVmlRun(side) -> mso-position-horizontal: left|center|right
 *  - worker AIWM_RE matches the __ANTCV_AIWM_center__ sentinel
 *  - preview manualNoticePos() reads antcv:aiNoticePos, returns the manual value or null (auto)
 * Tests the REAL functions extracted verbatim from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
function extractFrom(file, name) {
  const src = readFileSync(path.resolve(here, file), 'utf8');
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' found in ' + file);
  let i = src.indexOf('{', start), depth = 0, end = -1;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
  return src.slice(start, end);
}

test('worker aiNoticeVmlRun maps side -> mso-position-horizontal', () => {
  const fn = new Function(extractFrom('../../../workers/docx-worker/src/index.js', 'aiNoticeVmlRun') + '\nreturn aiNoticeVmlRun;')();
  assert.match(fn('left'), /mso-position-horizontal:left;/);
  assert.match(fn('center'), /mso-position-horizontal:center;/);
  assert.match(fn('right'), /mso-position-horizontal:right;/);
  assert.match(fn('whatever'), /mso-position-horizontal:right;/, 'unknown -> right');
  // the paragraph justification inside the box follows too
  assert.match(fn('center'), /w:jc w:val="center"/);
});

test('worker AIWM_RE matches the center sentinel', () => {
  const wsrc = readFileSync(path.resolve(here, '../../../workers/docx-worker/src/index.js'), 'utf8');
  const m = wsrc.match(/AIWM_RE = (\/[^\n]*\/);/);
  assert.ok(m, 'AIWM_RE literal found');
  // eslint-disable-next-line no-eval
  const re = eval(m[1]);
  const mk = (s) => '<w:r><w:rPr></w:rPr><w:t>__ANTCV_AIWM_' + s + '__</w:t></w:r>';
  assert.ok(re.test(mk('center')), 'center sentinel matches');
  assert.equal(mk('center').match(re)[1], 'center', 'captures center');
  assert.ok(re.test(mk('left')) && re.test(mk('right')), 'left/right still match');
});

test('preview manualNoticePos reads antcv:aiNoticePos', () => {
  const body = extractFrom('../../antcv-watermark-page-anchor-341.js', 'manualNoticePos') + '\nreturn manualNoticePos;';
  const make = (val) => new Function('localStorage', body)({ getItem: (k) => (k === 'antcv:aiNoticePos' ? val : null) });
  assert.equal(make('left')(), 'left');
  assert.equal(make('center')(), 'center');
  assert.equal(make('right')(), 'right');
  assert.equal(make('auto')(), null, 'auto -> null (measured)');
  assert.equal(make(null)(), null, 'absent -> null');
  assert.equal(make('bogus')(), null, 'invalid -> null');
});
