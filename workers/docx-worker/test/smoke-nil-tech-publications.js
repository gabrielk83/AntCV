// Reproduces the user's exact NIL Technology docx duplicate bug
// from the v1.7.6 → v1.7.7 fix cycle. The user reported that even
// after v1.7.6 the PUBLICATIONS section showed 6 entries (3 unique
// in two formats) and REGULATORY CONTEXT had duplicate group
// subheads ("Systems, safety and cybersecurity" + "Systems, safety
// & cybersecurity").
//
// v1.7.6 dedupe missed these because:
//   - Item 3 "Patent 241997 — A Cover Window..." vs item 6
//     "Patent No. 241997: Co-inventor..." — dedupeKey split on
//     colon but not on em-dash, so the keys diverged at the
//     suffix (one had "...coverwindow..." in the key, the other
//     stopped at "patentno241997").
//   - Items 1/4 and 2/5 both shared 50+ chars of normalised LCP
//     but neither was a strict prefix of the other (different
//     journal-name spellings), so prefix-containment missed them.
//   - Subhead dedupe was a no-op — subheads passed through
//     unchanged.

import { generateDocx } from '../src/generate.js';
import { unzipSync, strFromU8 } from '../src/vendor/fflate.mjs';

let pass = 0, fail = 0;
function assert(label, cond, hint) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ' — ' + hint : ''}`); }
}

async function docXml(payload) {
  const buf = await generateDocx(payload);
  return strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']);
}

function texts(xml) {
  const out = [];
  const re = /<w:t[^>]*>([^<]+)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
  return out;
}

console.log('--- USER REPORT: PUBLICATIONS & PATENT (user\'s exact 6 entries) ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'pubs', loc: 'sidebar', on: true, type: 'list_italic',
        title: 'PUBLICATIONS & PATENT',
        items: [
          // Primary format (no em-dash, comma-separated suffix)
          'Suspended Carbon Nanotube Integration in Microfabricated Devices, Karp et al., J. Micromech. Microeng., 2009',
          'Carbon nanotube integration procedures into NEMS devices, Karp et al., Eurosensors, 2008',
          'Patent 241997 — A Cover Window for a Device',
          // Secondary format (quoted title + em-dash + author/journal)
          '\u201CSuspended Carbon Nanotube Integration in Microfabricated Devices\u201D — Karp et al., J. Micromechanics & Microengineering, 2009',
          '\u201CCarbon Nanotube Integration Procedures into NEMS Devices\u201D — Karp et al., Eurosensors Conference Proceedings, 2008',
          'Patent No. 241997: Co-inventor of cover window reducing crosstalk between optical components',
        ],
      },
    ],
  });
  const ts = texts(xml);

  // Use distinctive substrings that appear in only ONE of the two
  // formats. "Microeng." (abbreviated) is in the primary only.
  // "Microengineering" (full) is in the secondary only.
  // If dedupe works, exactly one of each surviving paper survives.
  const microengAbbrev = ts.filter(t => /Microeng\./.test(t)).length;
  const microengFull = ts.filter(t => /Microengineering/.test(t)).length;
  const eurosensorsShort = ts.filter(t => /Eurosensors, 2008/.test(t)).length;
  const eurosensorsLong = ts.filter(t => /Eurosensors Conference/.test(t)).length;
  const patentEmDash = ts.filter(t => /A Cover Window for a Device/.test(t)).length;
  const patentColon = ts.filter(t => /Co-inventor of cover window/.test(t)).length;

  assert('"Microeng." (primary format) survives exactly once',
    microengAbbrev === 1, `got ${microengAbbrev}`);
  assert('"Microengineering" (secondary format) is dropped — duplicate of primary',
    microengFull === 0, `got ${microengFull}`);
  assert('"Eurosensors, 2008" (primary) survives exactly once',
    eurosensorsShort === 1, `got ${eurosensorsShort}`);
  assert('"Eurosensors Conference" (secondary) dropped',
    eurosensorsLong === 0, `got ${eurosensorsLong}`);
  assert('"A Cover Window for a Device" (em-dash patent) survives once',
    patentEmDash === 1, `got ${patentEmDash}`);
  assert('"Co-inventor of cover window" (colon-format patent) dropped',
    patentColon === 0, `got ${patentColon}`);

  // Total surviving publications: exactly 3 (1 paper + 1 paper + 1 patent)
  const survivingTitles = ts.filter(t =>
    /Suspended Carbon|Carbon nanotube|Patent 241997/.test(t)).length;
  assert('Exactly 3 surviving distinct publications (not 6)',
    survivingTitles === 3,
    `got ${survivingTitles} title-bearing runs`);
}

console.log('\n--- USER REPORT: REGULATORY CONTEXT duplicate subheads ---');
{
  // Reproduce the exact ordering from the user's docx. Note: the
  // "& cybersecurity" / "& materials compliance" subheads appear
  // back-to-back at the end of the list, after the "and"-versions
  // were already used. Some STANAG items follow them.
  const items = [
    { group: 'Sensing, imaging and optics' },
    { l: 'IEC 60825-1', v: 'Laser product safety' },
    { l: 'ISO 12233', v: 'Imaging resolution measurement' },
    { l: 'EMVA 1288', v: 'Image sensor characterisation' },
    { l: 'ISO 15739', v: 'Noise and SNR characterisation' },
    { l: 'ISO 14524', v: 'Opto-electronic conversion function' },
    { group: 'Environmental, durability and materials compliance' },
    { l: 'IEC 60068', v: 'Environmental testing' },
    { l: 'RoHS', v: 'Restricted substances' },
    { l: 'REACH', v: 'Chemical substances compliance' },
    { l: 'IEC 60529', v: 'Ingress protection' },
    { l: 'MIL-STD-810G', v: 'Environmental qualification' },
    { l: 'ISO 16750', v: 'Automotive environmental conditions' },
    { group: 'Systems, safety and cybersecurity' },
    { l: 'ASPICE', v: 'Requirements, traceability' },
    { l: 'ISO 26262', v: 'Functional safety' },
    { l: 'ISO/PAS 21448', v: 'SOTIF' },
    { l: 'ISO/SAE 21434', v: 'Cybersecurity' },
    { group: 'Electrical and EMC' },
    { l: 'DIN EN 61010', v: 'Electrical safety, lab equipment' },
    { l: 'CISPR 25', v: 'EMC emissions' },
    { l: 'ISO 11452', v: 'EMC immunity' },
    { group: 'Systems, safety & cybersecurity' },          // DUP of above
    { group: 'Environmental, durability & materials compliance' }, // DUP of above
    { l: 'STANAG 4694', v: 'Weapon-mounted sight interface context' },
    { l: 'STANAG 4355', v: 'Ballistics / fire-control context' },
  ];

  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'REGULATORY CONTEXT', items,
      },
    ],
  });
  const ts = texts(xml);

  // The 4 unique subheads should each appear exactly once.
  // The 2 "& "-version duplicates should NOT appear.
  const systemsAnd = ts.filter(t => /^Systems, safety and cybersecurity$/.test(t)).length;
  const systemsAmp = ts.filter(t => /^Systems, safety & cybersecurity$/.test(t)).length;
  const envAnd = ts.filter(t => /^Environmental, durability and materials compliance$/.test(t)).length;
  const envAmp = ts.filter(t => /^Environmental, durability & materials compliance$/.test(t)).length;

  assert('"Systems, safety and cybersecurity" subhead appears once',
    systemsAnd === 1, `got ${systemsAnd}`);
  assert('"Systems, safety & cybersecurity" (DUP) dropped',
    systemsAmp === 0, `got ${systemsAmp}`);
  assert('"Environmental, durability and materials compliance" appears once',
    envAnd === 1, `got ${envAnd}`);
  assert('"Environmental, durability & materials compliance" (DUP) dropped',
    envAmp === 0, `got ${envAmp}`);

  // Other subheads still present:
  assert('"Sensing, imaging and optics" subhead kept',
    ts.some(t => /Sensing, imaging and optics/.test(t)));
  assert('"Electrical and EMC" subhead kept',
    ts.some(t => /^Electrical and EMC$/.test(t)));

  // Content items still rendered:
  assert('IEC 60825-1 still renders', ts.some(t => /IEC 60825-1/.test(t)));
  assert('STANAG 4694 still renders', ts.some(t => /STANAG 4694/.test(t)));
}

console.log('\n--- GUARD: dedupe must NOT collapse legitimately-different items ---');
{
  // The aggressive Level-2 LCP fallback could in theory over-merge
  // items that happen to share a long literal prefix. These should
  // all survive intact.
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          // Different cert levels — share "Six Sigma" prefix (8 chars)
          'Six Sigma Black Belt',
          'Six Sigma Yellow Belt',
          'Six Sigma Green Belt',
          // Same standard family, different parts — share "ISO" only
          'ISO 9001:2015 Quality Management',
          'ISO 27001:2022 Information Security',
          'ISO 14001:2015 Environmental Management',
        ],
      },
    ],
  });
  const ts = texts(xml);
  assert('Black belt kept', ts.some(t => /Black Belt/.test(t)));
  assert('Yellow belt kept (not over-merged with Black)',
    ts.some(t => /Yellow Belt/.test(t)));
  assert('Green belt kept', ts.some(t => /Green Belt/.test(t)));
  assert('ISO 9001 kept', ts.some(t => /ISO 9001/.test(t)));
  assert('ISO 27001 kept (different ISO number)', ts.some(t => /ISO 27001/.test(t)));
  assert('ISO 14001 kept', ts.some(t => /ISO 14001/.test(t)));
}

console.log('\n--- GUARD: "and" stripping must not collapse different concepts ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'add', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'ADDITIONAL INFORMATION',
        items: [
          // Both contain "and" — kept distinct because content differs
          { l: 'Hands-on and lab', v: 'Cleanroom operations' },
          { l: 'Off-site and travel', v: 'European supplier visits' },
          // These DIFFER after "and" removal
          { l: 'Programs', v: 'Various programs' },
          { l: 'Travel', v: 'International travel' },
        ],
      },
    ],
  });
  const ts = texts(xml);
  assert('"Hands-on and lab" kept', ts.some(t => /Hands-on/.test(t)));
  assert('"Off-site and travel" kept (not collapsed with Hands-on)',
    ts.some(t => /Off-site/.test(t)));
  assert('Programs kept', ts.some(t => /^Programs:?\s*$/.test(t)));
  assert('Travel kept', ts.some(t => /^Travel:?\s*$/.test(t)));
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
