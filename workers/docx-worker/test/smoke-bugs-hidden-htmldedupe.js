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

console.log('--- BUG: publications duplicated across plain + <b>...</b> forms ---');
{
  // Exact reproduction of the user's data: 3 publications, each
  // appearing TWICE — once as flat string and once with inline
  // <b> markup. The <b> tag broke dedupe in v1.7.5 because the
  // 'b' leaked into the normalised key as a leading char.
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'pubs', loc: 'sidebar', on: true, type: 'list',
        title: 'PUBLICATIONS & PATENT',
        items: [
          'Suspended Carbon Nanotube Integration in Microfabricated Devices, Karp et al., J. Micromech. Microeng., 2009',
          'Carbon nanotube integration procedures into NEMS devices, Karp et al., Eurosensors, 2008',
          'Patent 241997 — A Cover Window for a Device',
          '<b>"Suspended Carbon Nanotube Integration in Microfabricated Devices"</b> — Karp et al., J. Micromechanics & Microengineering, 2009',
          '<b>"Carbon Nanotube Integration Procedures into NEMS Devices"</b> — Karp et al., Eurosensors Conference Proceedings, 2008',
          '<b>Patent No. 241997:</b> Co-inventor of cover window reducing crosstalk between optical components',
        ],
      },
    ],
  });
  const ts = texts(xml);
  // Count occurrences of distinctive substrings
  const suspendedCount = ts.filter(t => /Suspended Carbon Nanotube/.test(t)).length;
  const cntCount = ts.filter(t => /[Cc]arbon nanotube|[Cc]arbon Nanotube/.test(t) && !/Suspended/.test(t)).length;
  const patentCount = ts.filter(t => /241997/.test(t)).length;
  assert('"Suspended..." appears ≤2 (1 title text run + maybe 1 author run; not twice)',
    suspendedCount <= 2,
    `got ${suspendedCount} occurrences`);
  assert('"Carbon nanotube..." appears ≤2',
    cntCount <= 2,
    `got ${cntCount}`);
  assert('Patent 241997 appears ≤2',
    patentCount <= 2,
    `got ${patentCount}`);
}

console.log('\n--- BUG: certifications dedupe (AI Practitioner CNX-CAIP vs AI-Practitioner) ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          'Six Sigma Black Belt (CSSC)',
          'FMEA & APIS (Wanders Engineering)',
          'AI Practitioner CNX-CAIP (Teknologisk Institut)',
          'Automotive SPICE (Intecs)',
          'Business Analysis BABOK (University of Toronto)',
          'Prøve i dansk 2 (Studieskolen)',
          'AI-Practitioner (Teknologisk Institut)',         // dup of #3 (shorter form)
          'Business Analysis (Uni. of Toronto)',            // dup of #5 (shorter form)
        ],
      },
    ],
  });
  const ts = texts(xml);
  const aiPracCount = ts.filter(t => /AI[- ]Practitioner/i.test(t)).length;
  const baCount = ts.filter(t => /Business Analysis/i.test(t)).length;
  const sixSigmaCount = ts.filter(t => /Six Sigma Black Belt/i.test(t)).length;
  // Wanders is unique, should appear exactly once
  const wandersCount = ts.filter(t => /Wanders/i.test(t)).length;

  assert('AI Practitioner appears once (longer form kept)',
    aiPracCount === 1,
    `got ${aiPracCount} — should keep "AI Practitioner CNX-CAIP" and drop "AI-Practitioner"`);
  assert('Long-form "CNX-CAIP" survives',
    ts.some(t => /CNX-CAIP/.test(t)));
  assert('Short-form "AI-Practitioner" alone is dropped',
    !ts.some(t => /^AI-Practitioner/.test(t)));
  assert('Business Analysis appears once',
    baCount === 1,
    `got ${baCount}`);
  assert('Long-form "BABOK" survives',
    ts.some(t => /BABOK/.test(t)));
  assert('Six Sigma Black Belt kept (not over-collapsed)',
    sixSigmaCount === 1);
  assert('Wanders cert kept (unique)',
    wandersCount === 1);
}

console.log('\n--- BUG: prefix dedupe does NOT collapse legitimately-different items ---');
{
  // Guard test: prefix-containment should NOT match "Six Sigma
  // Black Belt" with "Six Sigma Yellow Belt" — both share an 8-char
  // prefix but diverge after.
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          'Six Sigma Black Belt',
          'Six Sigma Yellow Belt',
          'Six Sigma Green Belt',
        ],
      },
    ],
  });
  const ts = texts(xml);
  assert('Black belt kept', ts.some(t => /Black Belt/.test(t)));
  assert('Yellow belt kept (not collapsed with Black)',
    ts.some(t => /Yellow Belt/.test(t)));
  assert('Green belt kept', ts.some(t => /Green Belt/.test(t)));
}

console.log('\n--- BUG: labeled_list — Volunteer vs Volunteering dedupes ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'add', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'ADDITIONAL INFORMATION',
        items: [
          { l: 'Languages', v: 'English, Hebrew, Spanish, Danish (B1)' },
          { l: 'Accessibility', v: 'Hearing-impaired' },
          { l: 'Volunteering', v: 'Rugby Team Operations Manager, Copenhagen Wolves RFC' },
          { l: 'Hobbies', v: 'Rugby, Hiking, tai-chi, reading' },
          { l: 'Volunteer', v: 'Rugby Operations Manager, Pan Idæt (Copenhagen Wolves RFC)' },
        ],
      },
    ],
  });
  const ts = texts(xml);
  const volCount = ts.filter(t => /^Volunteer/i.test(t)).length;
  assert('Volunteer/Volunteering label appears once',
    volCount === 1,
    `got ${volCount} occurrences of the label`);
  assert('Languages kept', ts.some(t => /Languages/.test(t)));
  assert('Hobbies kept (not collapsed with Volunteer)',
    ts.some(t => /Hobbies/.test(t)));
  assert('Accessibility kept', ts.some(t => /Accessibility/.test(t)));
}

console.log('\n--- BUG: section.hidden[i] respected for labeled_list (REGULATORY CONTEXT) ---');
{
  // The user's actual case: 21 regulatory items but only 3 visible
  // in the preview. The PWA marks items 3-20 as hidden via the
  // section.hidden map. Worker should render only visible items.
  const items = [
    { group: 'Sensing, imaging and optics' },
    { l: 'ISO 12233', v: 'Imaging resolution measurement' },
    { l: 'EMVA 1288', v: 'Image sensor characterization' },
    { l: 'IEC 60825-1', v: 'Laser product safety' },
    { l: 'ISO 15739', v: 'Noise and SNR characterization' },
    { group: 'Systems, safety & cybersecurity' },
    { l: 'ASPICE', v: 'Requirements, traceability' },
    { l: 'ISO 26262', v: 'Functional safety' },
    { l: 'ISO/PAS 21448', v: 'SOTIF' },
    { l: 'ISO/SAE 21434', v: 'Cybersecurity' },
    { group: 'Electrical and EMC' },
    { l: 'DIN EN 61010', v: 'Electrical safety' },
  ];
  // Mark indexes 4 onward hidden via section.hidden map (preview
  // only shows the first 3 items under the first subhead)
  const hidden = {};
  for (let i = 4; i < items.length; i++) hidden[i] = true;

  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'REGULATORY CONTEXT',
        items, hidden,
      },
    ],
  });
  const ts = texts(xml);
  // Visible items should appear
  assert('ISO 12233 (visible) rendered', ts.some(t => /ISO 12233/.test(t)));
  assert('EMVA 1288 (visible) rendered', ts.some(t => /EMVA 1288/.test(t)));
  assert('IEC 60825-1 (visible) rendered', ts.some(t => /IEC 60825-1/.test(t)));
  // First subhead visible
  assert('"Sensing, imaging and optics" subhead rendered',
    ts.some(t => /Sensing, imaging and optics/.test(t)));
  // Hidden items should NOT appear
  assert('ISO 15739 (hidden via s.hidden[4]) NOT rendered',
    !ts.some(t => /ISO 15739/.test(t)));
  assert('ASPICE (hidden) NOT rendered',
    !ts.some(t => /ASPICE/.test(t)));
  assert('ISO 26262 (hidden) NOT rendered',
    !ts.some(t => /ISO 26262/.test(t)));
  assert('"Systems, safety & cybersecurity" subhead NOT rendered (entire group hidden)',
    !ts.some(t => /Systems, safety/.test(t)));
}

console.log('\n--- BUG: group cascade — hidden group divider hides all items until next group ---');
{
  // When a group divider has hidden:true, all items under it are
  // hidden too (until the next group divider).
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'REGULATORY CONTEXT',
        items: [
          { group: 'Visible group' },
          { l: 'Item A', v: 'visible' },
          { group: 'Hidden group', hidden: true },
          { l: 'Item B', v: 'should not appear' },
          { l: 'Item C', v: 'should not appear either' },
          { group: 'Another visible group' },
          { l: 'Item D', v: 'visible again' },
        ],
      },
    ],
  });
  const ts = texts(xml);
  assert('Visible group rendered', ts.some(t => /Visible group/.test(t)));
  assert('Item A under visible group rendered', ts.some(t => /Item A/.test(t)));
  assert('Hidden group divider NOT rendered',
    !ts.some(t => /Hidden group/.test(t)));
  // v1.10.2: hidden group no longer cascades to its items. The user
  // controls per-item visibility independently — Items B and C have
  // no individual hidden flag, so they should still render.
  assert('Item B (under hidden group) STILL renders (no cascade)',
    ts.some(t => /Item B/.test(t)));
  assert('Item C (under hidden group) STILL renders (no cascade)',
    ts.some(t => /Item C/.test(t)));
  assert('"Another visible group" rendered',
    ts.some(t => /Another visible group/.test(t)));
  assert('Item D under new visible group rendered',
    ts.some(t => /Item D/.test(t)));
}

console.log('\n--- BUG: education s.hidden[i] respected ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'edu', loc: 'sidebar', on: true, type: 'education',
        title: 'EDUCATION',
        items: [
          { degree: 'M.Sc. Electrical Engineering', school: 'TAU' },
          { degree: 'Visible degree 2', school: 'Visible school 2' },
          { degree: 'Hidden via section.hidden[2]', school: 'Hidden' },
        ],
        hidden: { 2: true },
      },
    ],
  });
  const ts = texts(xml);
  assert('M.Sc. rendered', ts.some(t => /M.Sc./.test(t)));
  assert('"Visible degree 2" rendered',
    ts.some(t => /Visible degree 2/.test(t)));
  assert('"Hidden via section.hidden" NOT rendered',
    !ts.some(t => /Hidden via section/.test(t)));
}

console.log('\n--- BUG: simple-list s.hidden[i] respected ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          'Six Sigma Black Belt',
          'Hidden cert via map',
          'Automotive SPICE',
        ],
        hidden: { 1: true },
      },
    ],
  });
  const ts = texts(xml);
  assert('Six Sigma rendered', ts.some(t => /Six Sigma/.test(t)));
  assert('"Hidden cert via map" NOT rendered',
    !ts.some(t => /Hidden cert/.test(t)));
  assert('Automotive SPICE rendered (gap-jumps the hidden one)',
    ts.some(t => /Automotive SPICE/.test(t)));
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
