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

console.log('--- Object items must NOT render as "[object Object]" ---');
{
  // Reproduces the PUBLICATIONS & PATENT screenshot: items stored as
  // {value, on, ...} objects rather than plain strings.
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'pubs', loc: 'sidebar', on: true, type: 'list',
        title: 'PUBLICATIONS & PATENT',
        items: [
          { value: 'Suspended Carbon Nanotube Integration in Microfabricated Devices',
            citation: 'Karp et al., J. Micromech 2009', on: true },
          { value: 'Carbon Nanotube Integration Procedures',
            citation: 'Karp et al., Eurosensors 2008', on: true },
          { value: 'Patent No. 241997: Co-inventor of cover window',
            on: true },
        ],
      },
    ],
  });
  assert('no "[object Object]" anywhere in document.xml',
    !xml.includes('[object Object]'),
    'object items still leak through stringification');
  assert('publication titles present',
    xml.includes('Suspended Carbon Nanotube') && xml.includes('Carbon Nanotube Integration Procedures') && xml.includes('Patent No. 241997'));
  assert('citation joined to title',
    xml.includes('Karp et al., J. Micromech 2009') && xml.includes('Eurosensors 2008'));
}

console.log('\n--- Hidden items ({on:false}) must NOT render ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'certs', loc: 'sidebar', on: true, type: 'list',
        title: 'CERTIFICATIONS',
        items: [
          { value: 'Visible cert', on: true },
          { value: 'Hidden cert SHOULD NOT APPEAR', on: false },
          { value: 'Another visible cert', on: true },
        ],
      },
    ],
  });
  assert('visible items present',
    xml.includes('Visible cert') && xml.includes('Another visible cert'));
  assert('hidden item absent',
    !xml.includes('Hidden cert SHOULD NOT APPEAR'),
    'on:false items must be stripped');
}

console.log('\n--- All-hidden section: heading must NOT render ---');
{
  // PUBLICATIONS & PATENT case from the screenshot — every item is
  // either hidden or empty. The section heading should not appear.
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 's1', loc: 'main', on: true, type: 'text', title: 'PROFILE', content: 'Lorem ipsum.' },
      { id: 'pubs_empty', loc: 'sidebar', on: true, type: 'list',
        title: 'PUBLICATIONS & PATENT',
        items: [
          { on: false, value: 'hidden 1' },
          { on: false, value: 'hidden 2' },
          { on: false, value: 'hidden 3' },
        ],
      },
    ],
  });
  assert('PROFILE still renders',
    xml.includes('PROFILE') && xml.includes('Lorem ipsum'));
  assert('empty PUBLICATIONS heading absent',
    !xml.includes('PUBLICATIONS &amp; PATENT') && !xml.includes('PUBLICATIONS & PATENT'),
    'all-hidden section should suppress its own heading');
}

console.log('\n--- All-empty items: heading must NOT render ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 's1', loc: 'main', on: true, type: 'text', title: 'PROFILE', content: 'Body.' },
      { id: 'pubs_blank', loc: 'sidebar', on: true, type: 'list',
        title: 'PUBLICATIONS & PATENT',
        items: ['', null, undefined, '   ', {}],
      },
    ],
  });
  assert('all-empty PUBLICATIONS heading absent',
    !xml.includes('PUBLICATIONS &amp; PATENT') && !xml.includes('PUBLICATIONS & PATENT'));
}

console.log('\n--- Labeled list: hidden items skipped, all-hidden suppresses heading ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'reg', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'REGULATORY CONTEXT',
        items: [
          { label: 'Visible', value: 'item 1', on: true },
          { label: 'Hidden', value: 'item 2', on: false },
          { label: 'Empty', value: '', on: true },          // empty value → drop
        ],
      },
      { id: 'reg_all_hidden', loc: 'sidebar', on: true, type: 'labeled_list',
        title: 'EMPTY LABELED LIST',
        items: [
          { label: 'A', value: 'a', on: false },
          { label: 'B', value: 'b', on: false },
        ],
      },
    ],
  });
  assert('visible labeled item kept',
    xml.includes('Visible') && xml.includes('item 1'));
  assert('hidden labeled item dropped',
    !xml.includes('Hidden:') && !xml.includes('item 2'));
  assert('empty-value labeled item dropped (no "Empty:" prefix without value)',
    !/<w:t[^>]*>Empty:\s*<\/w:t>/.test(xml));
  assert('all-hidden labeled list heading absent',
    !xml.includes('EMPTY LABELED LIST'));
}

console.log('\n--- Education: hidden entries skipped, all-hidden suppresses heading ---');
{
  const xml = await getDocXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'edu', loc: 'sidebar', on: true, type: 'education',
        title: 'EDUCATION',
        items: [
          { degree: 'MBA', school: 'Technion', on: true },
          { degree: 'OldDegree', school: 'OldUni', on: false },
          { degree: 'M.Sc.', school: 'TAU', on: true },
        ],
      },
    ],
  });
  assert('visible degrees present',
    xml.includes('MBA') && xml.includes('Technion') && xml.includes('M.Sc.'));
  assert('hidden degree absent',
    !xml.includes('OldDegree') && !xml.includes('OldUni'));
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
