import { generateDocx } from '../src/generate.js';
import { unzipSync, strFromU8 } from '../src/vendor/fflate.mjs';

let pass = 0, fail = 0;
function assert(label, cond, hint) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ' — ' + hint : ''}`); }
}

async function getDocXml(payload) {
  const buf = await generateDocx(payload);
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return strFromU8(unzipSync(bytes)['word/document.xml']);
}

console.log('--- pageBreakBefore on a labeled_list section (JD questions case) ---');
{
  const xml = await getDocXml({
    doc: 'cl', layout: 'single_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'who_i_am', loc: 'main', on: true, type: 'text', title: 'WHO I AM',
        content: 'Engineer with 15 years.' },
      { id: 'foundation', loc: 'main', on: true, type: 'foundation', title: 'FOUNDATION',
        hands_on: 'Built cleanroom processes.',
        professionally: 'Coordinated cross-functional teams.' },
      { id: 'jd_questions', loc: 'main', on: true, type: 'labeled_list',
        title: 'QUESTIONS FROM THE JD',
        pageBreakBefore: true,
        items: [
          { l: 'Why do you want to join NILT?', v: 'Your hands-on cleanroom mission and..' },
          { l: 'What is your experience with cleanroom processes?', v: 'I ran end-to-end..' },
        ],
      },
    ],
  });

  // The page-break is emitted as <w:pageBreakBefore/> inside paragraph properties
  assert('pageBreakBefore tag present',
    xml.includes('<w:pageBreakBefore/>'),
    'no <w:pageBreakBefore/> found in document.xml');

  // Question text + answer text both present
  assert('first question text present',
    xml.includes('Why do you want to join NILT?'));
  assert('first answer text present',
    xml.includes('Your hands-on cleanroom mission'));
  assert('section title present',
    xml.includes('QUESTIONS FROM THE JD'));

  // Earlier section title also present (page break shouldn't omit prior content)
  assert('previous WHO I AM section retained',
    xml.includes('WHO I AM'));
  assert('previous FOUNDATION section retained',
    xml.includes('FOUNDATION'));

  // Page-break should appear BEFORE the questions section, not before
  // earlier ones — verify ordering
  const pbIdx = xml.indexOf('<w:pageBreakBefore/>');
  const qIdx = xml.indexOf('QUESTIONS FROM THE JD');
  const wIdx = xml.indexOf('WHO I AM');
  assert('page-break is positioned BEFORE the questions section title',
    pbIdx > 0 && qIdx > 0 && pbIdx < qIdx,
    `pageBreak at ${pbIdx}, questions at ${qIdx}`);
  assert('page-break is positioned AFTER the earlier WHO I AM section',
    pbIdx > wIdx,
    `pageBreak at ${pbIdx}, who_i_am at ${wIdx}`);
}

console.log('\n--- pageBreakBefore is absent when flag is missing/false ---');
{
  const xml = await getDocXml({
    doc: 'cl', layout: 'single_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'who_i_am', loc: 'main', on: true, type: 'text', title: 'WHO I AM',
        content: 'Engineer.' },
      { id: 'questions', loc: 'main', on: true, type: 'labeled_list',
        title: 'QUESTIONS', items: [{ l: 'Q?', v: 'A.' }],
        // no pageBreakBefore field
      },
    ],
  });
  assert('no pageBreakBefore when flag omitted',
    !xml.includes('<w:pageBreakBefore/>'));
}

console.log('\n--- pageBreakBefore: false is treated as no break ---');
{
  const xml = await getDocXml({
    doc: 'cl', layout: 'single_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'questions', loc: 'main', on: true, type: 'labeled_list',
        title: 'QUESTIONS', items: [{ l: 'Q?', v: 'A.' }],
        pageBreakBefore: false,
      },
    ],
  });
  assert('no pageBreakBefore when flag is false',
    !xml.includes('<w:pageBreakBefore/>'));
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
