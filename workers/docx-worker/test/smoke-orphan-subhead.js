// Tests for orphan-subhead suppression in renderLabeledList.
//
// User report: "DOCX generating a ghost sub-title Systems, safety
// and cybersecurity Electrical and EMC". The pattern: she hides
// every item under a regulatory subsection but doesn't toggle the
// subsection header itself. The header is therefore "visible" in
// data but has no content under it. The render must drop such
// dangling subheads — otherwise the docx shows a bold sectional
// heading with empty space below it.

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

console.log('--- subhead with all items hidden becomes orphan and is dropped ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'REGULATORY CONTEXT',
        items: [
          { group: 'Sensing, imaging and optics' },
          { l: 'IEC 60825-1', v: 'Laser product safety' },
          { group: 'Systems, safety and cybersecurity' },  // visible
          { l: 'ASPICE',      v: 'Requirements',        hidden: true },
          { l: 'ISO 26262',   v: 'Functional safety',   hidden: true },
          { group: 'Electrical and EMC' },                  // visible
          { l: 'DIN EN 61010', v: 'Electrical safety',  hidden: true },
        ],
      },
    ],
  });
  assert('Visible subhead "Sensing…" rendered',
    xml.includes('Sensing, imaging and optics'));
  assert('Orphan subhead "Systems, safety…" suppressed',
    !xml.includes('Systems, safety and cybersecurity'));
  assert('Orphan subhead "Electrical and EMC" suppressed',
    !xml.includes('Electrical and EMC'));
  assert('Non-hidden item "IEC 60825-1" rendered',
    xml.includes('IEC 60825-1'));
  assert('Hidden item ASPICE not rendered',
    !xml.includes('ASPICE'));
}

console.log('\n--- trailing orphan subhead with no content after is dropped ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list', title: 'REG',
        items: [
          { l: 'IEC 60825-1', v: 'Laser product safety' },
          { group: 'Orphan subhead at end' },
        ],
      },
    ],
  });
  assert('Trailing orphan subhead suppressed',
    !xml.includes('Orphan subhead at end'));
}

console.log('\n--- consecutive subheads, only the one with content survives ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list', title: 'REG',
        items: [
          { group: 'First subhead' },
          { group: 'Second subhead' },
          { group: 'Third subhead with content' },
          { l: 'X', v: 'content under third' },
        ],
      },
    ],
  });
  assert('First orphan dropped',
    !xml.includes('First subhead'));
  assert('Second orphan dropped',
    !xml.includes('Second subhead'));
  assert('Third subhead (with content) kept',
    xml.includes('Third subhead with content'));
}

console.log('\n--- subhead with content NOT dropped (sanity) ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list', title: 'REG',
        items: [
          { group: 'Visible group' },
          { l: 'Item', v: 'visible' },
          { group: 'Also visible group' },
          { l: 'Another', v: 'also visible' },
        ],
      },
    ],
  });
  assert('First visible subhead kept', xml.includes('Visible group'));
  assert('Second visible subhead kept', xml.includes('Also visible group'));
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
