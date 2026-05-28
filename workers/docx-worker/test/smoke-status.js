import { generateDocx } from '../src/generate.js';
import { unzipSync, strFromU8 } from '../src/vendor/fflate.mjs';

let pass = 0, fail = 0;
function assert(label, cond, hint) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ' — ' + hint : ''}`); }
}

console.log('--- Post-process status threading ---');

// Case 1: typical CV with titled sections → post-process should run + succeed
{
  const buf = await generateDocx({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'Test User' }, meta: {},
    sections: [
      { id: 's1', loc: 'main', on: true, type: 'text', title: 'PROFILE', content: 'Lorem ipsum dolor sit amet.' },
      { id: 's2', loc: 'main', on: true, type: 'bullets', title: 'OUTCOMES',
        items: [{lead:'Built', body:'a system.'}, {lead:'Led', body:'a team.'}] },
    ],
  });

  assert('buffer returned', buf && buf.length > 1000);
  assert('post-process status = ok',
    buf.__antcv_post_process_status === 'ok',
    `got ${buf.__antcv_post_process_status}`);
  assert('replacements > 0', buf.__antcv_cont_replacements > 0);
  assert('markers_remaining = 0', buf.__antcv_markers_remaining === 0);
  assert('post-process error = null', buf.__antcv_post_process_error === null);

  // v1.9.0 — verify the docx does NOT contain the complex IF/PAGEREF
  // field (those broke Word's strict parser inside doubly-nested
  // table-header rows). The placeholder runs must be stripped instead.
  const xml = strFromU8(unzipSync(buf)['word/document.xml']);
  assert('NO PAGEREF field injected (v1.9.0 Word-safe)',
    !xml.includes('PAGEREF antcv_sec_'),
    'post-process should strip placeholders, not inject complex fields');
  assert('no leftover placeholders',
    !xml.includes('__ANTCV_CONT_'));
}

// Case 2: no titled sections → post-process status should be 'skipped'
{
  const buf = await generateDocx({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'Test User' }, meta: {},
    sections: [
      { id: 's1', loc: 'main', on: true, type: 'text', title: '', content: 'Just body text.' },
    ],
  });

  assert('untitled-sections buffer returned', buf && buf.length > 1000);
  assert('untitled-sections status = skipped',
    buf.__antcv_post_process_status === 'skipped',
    `got ${buf.__antcv_post_process_status}`);
  assert('untitled-sections replacements = 0', buf.__antcv_cont_replacements === 0);
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
