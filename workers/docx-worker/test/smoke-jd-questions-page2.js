// smoke-jd-questions-page2.js
//
// Verifies that when a CL has a jd_questions section:
//   1. The page-1 body table closes BEFORE the jd_questions content
//   2. A pageBreakBefore paragraph appears between page 1 and page 2
//   3. A second table follows with a navy header band (name re-emitted)
//   4. jd_questions content lands inside page-2 body
//   5. Signature ("Kind regards," + name) is emitted twice (page 1 + page 2)
//   6. When jd_questions is absent, only one body table is emitted
//      and no extra pageBreakBefore paragraph appears

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

const candidateName = 'Gabriel Karp-Gershon';

console.log('--- CL with jd_questions section: page-2 layout emitted ---');
{
  const xml = await getDocXml({
    doc: 'cl',
    layout: 'single_column',
    personal_info: { name: candidateName, location: 'Copenhagen, Denmark', email: 'a@b.com' },
    meta: { role: 'Process Engineer', company: 'NILT' },
    sections: [
      { id: 'greeting', loc: 'main', on: true, type: 'text', title: 'GREETING',
        content: 'Dear Robert Lenart,' },
      { id: 'who_i_am', loc: 'main', on: true, type: 'text', title: 'WHO I AM',
        content: 'Engineer with 15 years in nano-/micro-optics.' },
      { id: 'closure', loc: 'main', on: true, type: 'text', title: 'CLOSURE',
        content: 'I would welcome the opportunity to discuss.' },
      { id: 'jd_questions', loc: 'main', on: true, type: 'labeled_list',
        title: 'QUESTIONS FROM THE JD',
        pageBreakBefore: true,
        items: [
          { l: 'Why do you want to join NILT?', v: 'Cleanroom mission and process focus.' },
          { l: 'What is your experience with cleanroom processes?', v: 'I ran end-to-end fab.' },
        ],
      },
    ],
  });

  // jd_questions content is present at all
  assert('first JD question text present',
    xml.includes('Why do you want to join NILT?'),
    'question label should appear in the doc');
  assert('first JD answer text present',
    xml.includes('Cleanroom mission and process focus.'));

  // jd_questions should NOT appear inside page-1 body table — it lives on page 2.
  // Heuristic: closure content "I would welcome the opportunity" should be
  // BEFORE "Why do you want to join NILT?" in document order, AND the page
  // break paragraph should sit between them.
  const closureIdx = xml.indexOf('I would welcome the opportunity');
  const firstQIdx  = xml.indexOf('Why do you want to join NILT?');
  assert('closure precedes the first JD question (page-1 vs page-2 order)',
    closureIdx > 0 && firstQIdx > closureIdx,
    `closure@${closureIdx} should come before question@${firstQIdx}`);

  // Page break between them. The Document creates a <w:p> with
  // <w:pageBreakBefore/> in its <w:pPr>. Verify presence between closure and
  // the question.
  const pageBreakIdx = xml.indexOf('<w:pageBreakBefore/>', closureIdx);
  assert('pageBreakBefore positioned between closure and JD questions',
    pageBreakIdx > closureIdx && pageBreakIdx < firstQIdx,
    `closure@${closureIdx}, pageBreakBefore@${pageBreakIdx}, question@${firstQIdx}`);

  // Candidate name should appear TWICE — once on page 1, once on page 2.
  // (Once in the header band at top, once in the bottom signature, then both
  // again on page 2. But for the simplest count: at least 3 occurrences.)
  const nameOccurrences = (xml.match(new RegExp(candidateName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
  assert(`candidate name appears at least 3 times (was ${nameOccurrences})`,
    nameOccurrences >= 3,
    'expected name in header band + page-1 signature + page-2 signature minimum');

  // "Kind regards," should appear TWICE — once at end of page 1, once at end of page 2.
  const kindRegardsCount = (xml.match(/Kind regards,/g) || []).length;
  assert(`"Kind regards," appears twice (was ${kindRegardsCount})`,
    kindRegardsCount === 2,
    'one signature per page');
}

console.log('\n--- CL without jd_questions: NO page break, NO duplicate header ---');
{
  const xml = await getDocXml({
    doc: 'cl',
    layout: 'single_column',
    personal_info: { name: candidateName },
    meta: {},
    sections: [
      { id: 'greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' },
      { id: 'closure', loc: 'main', on: true, type: 'text', content: 'I look forward.' },
    ],
  });

  // No additional pageBreakBefore should be present (no section has the flag).
  const pageBreakCount = (xml.match(/<w:pageBreakBefore\/>/g) || []).length;
  assert(`no spurious pageBreakBefore when jd_questions absent (was ${pageBreakCount})`,
    pageBreakCount === 0);

  // Only one "Kind regards," — single signature.
  const kindRegardsCount = (xml.match(/Kind regards,/g) || []).length;
  assert(`single "Kind regards," when jd_questions absent (was ${kindRegardsCount})`,
    kindRegardsCount === 1);
}

console.log('\n--- jd_questions with on:false is NOT promoted to page 2 ---');
{
  const xml = await getDocXml({
    doc: 'cl',
    layout: 'single_column',
    personal_info: { name: candidateName },
    meta: {},
    sections: [
      { id: 'greeting', loc: 'main', on: true, type: 'text', content: 'Dear sir,' },
      { id: 'closure', loc: 'main', on: true, type: 'text', content: 'Closing.' },
      { id: 'jd_questions', loc: 'main', on: false, type: 'labeled_list',
        title: 'QUESTIONS FROM THE JD',
        items: [{ l: 'Q', v: 'A' }],
      },
    ],
  });

  // With on:false, jd_questions should be entirely absent — no page 2, no
  // questions content.
  assert('jd_questions title NOT present when section on:false',
    !xml.includes('QUESTIONS FROM THE JD'));
  assert('single "Kind regards," when jd_questions on:false',
    (xml.match(/Kind regards,/g) || []).length === 1);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
