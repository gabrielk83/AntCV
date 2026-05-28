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

console.log('--- BUG 1: subhead with object-shaped value never renders as "[object Object]" ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'CERTIFICATIONS',
        items: [
          // a sub-head where the value is an object (the real-world
          // failure mode from the user's DOCX)
          { group: { text: 'Quality', extra: 1 } },
          { l: 'Six Sigma', v: 'Black Belt (CSSC)' },
          { l: 'FMEA', v: 'Wanders Eng.' },
          // a sub-head whose value is a plain string (still works)
          { group: 'Industry' },
          { l: 'Automotive SPICE', v: 'Intecs' },
          // a sub-head whose value can't be coerced to a string —
          // worker should silently skip it, NOT emit [object Object]
          { group: { foo: { bar: 'no string anywhere' } } },
          { l: 'Business Analysis', v: 'Uni. of Toronto' },
        ],
      },
    ],
  });

  assert('NO "[object Object]" in output',
    !xml.includes('[object Object]'),
    'this was the exact bug reported');
  assert('subhead with .text field renders the text',
    xml.includes('Quality'));
  assert('plain-string subhead still renders',
    xml.includes('Industry'));
  assert('value-bearing item still rendered',
    xml.includes('Six Sigma') && xml.includes('Black Belt'));
  // The "no string anywhere" subhead is silently skipped, so the
  // next labeled item (Business Analysis) still appears
  assert('item after unrenderable subhead still appears',
    xml.includes('Business Analysis'));
}

console.log('\n--- BUG 2: B.Sc. degree dedupes across "Electrical Engineering" vs "EE" ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'edu', loc: 'sidebar', on: true, type: 'education', title: 'EDUCATION',
        items: [
          { degree: 'M.Sc. Electrical Engineering', school: 'Tel Aviv University — Optics, nanotech.' },
          { degree: 'B.Sc., Physics & B.Sc., Electrical Engineering', school: 'Tel Aviv University' },
          { degree: 'MBA', school: 'Technion. Strategy, Finance, Operations' },
          // The duplicate from the user's actual output
          { degree: 'B.Sc., Physics & B.Sc.,EE', school: 'Tel Aviv University' },
          { degree: 'Dansk FVU', school: 'KVUC' },
        ],
      },
    ],
  });

  const count = (needle) => (xml.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  // The longer "Electrical Engineering" should appear ONCE (first occurrence wins)
  assert('B.Sc. degree appears exactly once (no duplicate)',
    count('B.Sc., Physics &amp;') === 1,
    `got ${count('B.Sc., Physics &amp;')} occurrences`);
  // Long form preserved (first wins)
  assert('first-occurrence "Electrical Engineering" form preserved',
    xml.includes('Electrical Engineering'),
    'first occurrence wins');
  // Abbreviation form was dropped
  assert('abbreviated "B.Sc.,EE" form NOT in output',
    !xml.includes('B.Sc.,EE'));
  // Other unique degrees still present
  assert('MBA still present', xml.includes('>MBA<'));
  assert('M.Sc. still present', xml.includes('M.Sc.'));
  assert('Dansk FVU still present', xml.includes('Dansk FVU'));
}

console.log('\n--- BUG 2: education dedupe does NOT false-positive on different degrees ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'edu', loc: 'sidebar', on: true, type: 'education', title: 'EDUCATION',
        items: [
          { degree: 'PhD Computer Science', school: 'MIT' },
          { degree: 'PhD Mathematics', school: 'MIT' },  // legit different
          { degree: 'PhD Physics', school: 'Stanford' }, // legit different
        ],
      },
    ],
  });
  assert('PhD Computer Science kept', xml.includes('Computer Science'));
  assert('PhD Mathematics kept (different field from CS)',
    xml.includes('Mathematics'),
    'different fields must not collapse');
  assert('PhD Physics kept (different school)',
    xml.includes('Physics'));
}

console.log('\n--- BUG 3: heading spacing reduced (0pt above for ALL headings; 4pt comes from preceding-table trailing paragraph) ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'profile', loc: 'main', on: true, type: 'text', title: 'PROFILE',
        content: 'Electro-optical engineer with 15 years.' },
      { id: 'outcomes', loc: 'main', on: true, type: 'list', title: 'SELECTED OUTCOMES',
        items: ['Outcome 1', 'Outcome 2'] },
      { id: 'tools', loc: 'sidebar', on: true, type: 'labeled_list', title: 'TOOLS & METHODS',
        items: [{ l: 'Python', v: 'Real value' }] },
    ],
  });
  // v1.10.1: All headings now use before=0. The 4pt breathing room
  // that PROFILE used to have above itself was removed (user spec);
  // headings that follow a competency table get their space from the
  // table's trailing paragraph emitting `after=80`.
  const before240 = (xml.match(/w:before="240"/g) || []).length;
  const before80  = (xml.match(/<w:spacing[^>]*w:before="80"[^>]*>/g) || []).length;

  // We don't want ANY headings to use 240 anymore (that was the bug).
  assert('no heading uses w:before="240" anymore',
    before240 === 0,
    `still ${before240} occurrences`);
  // v1.10.4: headings now use before=80 (4pt) so the gap appears above
  // each heading — Word collapses paragraph-after-table spacing, so
  // pushing the gap onto the heading itself is the only thing that
  // actually renders. All three CV headings (PROFILE, SELECTED OUTCOMES,
  // TOOLS & METHODS) should now use before=80.
  assert('all headings use w:before="80" (PROFILE included, v1.10.4)',
    before80 >= 3,
    `expected ≥3 before=80 spacings, got ${before80}`);
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
