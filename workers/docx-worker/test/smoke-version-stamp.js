// Verifies the worker version stamp lands in the generated .docx's
// core.xml description property — so a user can inspect any docx
// and tell which version of the worker built it.

import { generateDocx } from '../src/generate.js';
import { unzipSync, strFromU8 } from '../src/vendor/fflate.mjs';

let pass = 0, fail = 0;
function assert(label, cond, hint) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ' — ' + hint : ''}`); }
}

const PAYLOAD = {
  doc: 'cv', layout: 'two_column',
  personal_info: { name: 'Test User' },
  meta: { role: 'Tester' },
  sections: [
    { id: 'profile', loc: 'main', on: true, type: 'text', title: 'PROFILE', content: 'A test profile.' },
  ],
  _workerVersion: '1.7.10-version-stamp-test',
};

console.log('--- workerVersion appears in core.xml description ---');
{
  const buf = await generateDocx(PAYLOAD);
  const files = unzipSync(new Uint8Array(buf));
  const core = files['docProps/core.xml'] ? strFromU8(files['docProps/core.xml']) : '';
  assert('core.xml exists', !!core);
  assert('description contains worker version',
    core.includes('1.7.10-version-stamp-test'),
    'core.xml description should embed _workerVersion');
  assert('description format mentions "docx-worker"',
    /AntCV docx-worker/.test(core),
    'description should label this as docx-worker output');
}

console.log('\n--- workerVersion omitted gracefully when not provided ---');
{
  const buf = await generateDocx({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'X' },
    meta: {},
    sections: [{ id: 'profile', loc: 'main', on: true, type: 'text', title: 'PROFILE', content: 'X.' }],
  });
  const files = unzipSync(new Uint8Array(buf));
  const core = strFromU8(files['docProps/core.xml']);
  assert('core.xml still generates without crash', !!core);
  // The description should still be present but with a blank
  // version (trimmed). Should NOT contain the literal "undefined".
  assert('description does NOT say "undefined"',
    !core.includes('undefined'),
    'when _workerVersion is missing, description must not leak "undefined"');
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
