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

console.log('--- CERTIFICATIONS dedupe (exact case from screenshot) ---');
{
  // Real screenshot items: same certifications listed twice with
  // slightly different formatting. Worker should keep first occurrence.
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          'Business Analysis (BABOK): University of Toronto',
          'Six Sigma Black Belt: CSSC',
          'Automotive SPICE: Intecs',
          'FMEA & APIS: Wanders Eng.',
          'Prøve i dansk 2: Studieskolen',
          'AI-Practitioner (CNX-CAIP): Teknologisk Institut',
          // duplicates with different formatting:
          'AI-Practitioner (Teknologisk Institut)',
          'Six Sigma Black Belt (CSSC)',
          'Automotive SPICE (Intecs)',
          'FMEA & APIS (Wanders Eng.)',
          'Business Analysis (Uni. of Toronto)',
          'Prøve i dansk 2 (Studieskolen)',
        ],
      },
    ],
  });

  // Helper: count occurrences of a literal in the XML
  const count = (needle) => (xml.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  assert('Business Analysis appears exactly once',
    count('Business Analysis') === 1,
    `got ${count('Business Analysis')} occurrences`);
  assert('Six Sigma Black Belt appears exactly once',
    count('Six Sigma Black Belt') === 1,
    `got ${count('Six Sigma Black Belt')} occurrences`);
  assert('Automotive SPICE appears exactly once',
    count('Automotive SPICE') === 1);
  assert('FMEA &amp; APIS appears exactly once',
    count('FMEA &amp; APIS') === 1);
  assert('Prøve i dansk 2 appears exactly once',
    count('Prøve i dansk 2') === 1);
  assert('AI-Practitioner appears exactly once',
    count('AI-Practitioner') === 1);
  // first occurrence should be the one with school as suffix after colon
  assert('first occurrence preserved (with ": University of Toronto")',
    xml.includes('Business Analysis (BABOK): University of Toronto'),
    'first item should win — original BABOK form is preserved');
}

console.log('\n--- EDUCATION dedupe (MBA Technion duplicated) ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'edu', loc: 'sidebar', on: true, type: 'education',
        title: 'EDUCATION',
        items: [
          { degree: 'MBA', school: 'Technion. Strategy, Finance, Operations' },
          { degree: 'M.Sc. Electrical Engineering', school: 'Tel Aviv University' },
          { degree: 'B.Sc., Physics & B.Sc., Electrical Engineering', school: 'Tel Aviv University' },
          // duplicates with subtle differences:
          { degree: 'MBA', school: 'Technion, Strategy & finance. China Biz plan' },
          { degree: 'M.Sc. Electrical Engineering (EE)', school: 'Tel Aviv University, Photonics, nanotech.' },
          { degree: 'B.Sc., Physics & B.Sc., EE', school: 'Tel Aviv University' },
          { degree: 'Dansk FVU', school: 'KVUC' },
        ],
      },
    ],
  });

  const count = (needle) => (xml.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  // MBA should appear once (degree key dedupes both MBA Technion entries)
  assert('MBA appears once',
    count('>MBA<') === 1,
    `got ${count('>MBA<')} occurrences`);
  // M.Sc. EE appears once
  assert('M.Sc. Electrical Engineering appears once',
    count('M.Sc. Electrical Engineering') === 1,
    `got ${count('M.Sc. Electrical Engineering')} occurrences`);
  // Dansk FVU is unique, should pass through
  assert('Dansk FVU still appears',
    xml.includes('Dansk FVU'));
  // First MBA description should be kept ("Strategy, Finance, Operations")
  assert('first MBA description preserved',
    xml.includes('Technion. Strategy, Finance, Operations'),
    'first occurrence wins');
}

console.log('\n--- ADDITIONAL INFORMATION dedupe (labeled list) ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'addl', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'ADDITIONAL INFORMATION',
        items: [
          { label: 'Languages', value: 'English (native), Hebrew (native), Spanish (full professional), Danish (B1)' },
          { label: 'Volunteer', value: 'Copenhagen Wolves RFC, Operations Manager' },
          { label: 'Hobbies', value: 'Rugby, hiking, cooking' },
          // duplicates:
          { label: 'Languages', value: 'EN/HE native, ES professional, DA B1' },
          { label: 'Volunteer', value: 'Copenhagen Wolves RFC' },
        ],
      },
    ],
  });

  const count = (needle) => (xml.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  assert('Languages label appears once',
    count('Languages:') === 1,
    `got ${count('Languages:')} occurrences`);
  assert('Volunteer label appears once',
    count('Volunteer:') === 1);
  assert('Hobbies (unique) still appears',
    count('Hobbies:') === 1);
  // First Languages entry wins
  assert('first Languages value preserved',
    xml.includes('English (native), Hebrew (native)'),
    'first occurrence wins');
}

console.log('\n--- Truly distinct items survive (no false-positive dedupe) ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          'Six Sigma Black Belt: CSSC',
          'Six Sigma Yellow Belt: CSSC',     // legitimately different
          'AI-Practitioner: CNX',
          'Project Management: PMI',         // legitimately different
        ],
      },
    ],
  });

  const count = (needle) => (xml.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  assert('Six Sigma Black Belt kept',
    xml.includes('Six Sigma Black Belt'));
  assert('Six Sigma Yellow Belt kept (NOT deduped as same)',
    xml.includes('Six Sigma Yellow Belt'),
    'different belt colors must remain distinct');
  assert('AI-Practitioner kept',
    xml.includes('AI-Practitioner'));
  assert('Project Management kept',
    xml.includes('Project Management'));
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
