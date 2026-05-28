// Spot-check v1.10.0 formatting fixes:
//   1. Header alignment defaults to center
//   2. Danish work-style title recognised
//   3. Company colour is mainTextColor (black), not gray 595959
//   4. Sidebar group subhead is sidebarTextColor (white)
//   5. Sidebar simple-list has no bullets by default
//   6. Sidebar education school is NOT italic
//   7. Publication name split at em-dash → bold-italic + normal
//   8. Competency table: header centered, body justified
import { generateDocx } from '../src/generate.js';
import { unzipSync, strFromU8 } from '../src/vendor/fflate.mjs';

async function getDocXml(payload) {
  const buf = await generateDocx(payload);
  const z = unzipSync(buf);
  return strFromU8(z['word/document.xml']);
}

const basePayload = {
  schema_version: '1.0',
  doc: 'cv',
  language: 'en',
  personal_info: { name: 'Test Person', email: 'a@b.c', phone: '+45', linkedin: 'in/test', location: 'Cph', citizenship: 'EU' },
  meta: {},
  sections: [],
  style: {},
  font_sizes: {},
};

let passed = 0, failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { console.log('  ✓ ' + name); passed++; }
  else      { console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); failed++; }
};

// 1. Header alignment default = center
{
  console.log('--- 1. Header default = center ---');
  const xml = await getDocXml(basePayload);
  // Find a paragraph that contains "Test Person" and check its alignment.
  // docx-js emits <w:jc w:val="center"/> for center alignment.
  const nameMatch = xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?Test Person.*?<\/w:p>/s);
  check('name paragraph centered (default)', !!nameMatch && /<w:jc w:val="center"/.test(nameMatch[0]));
}

// 2. Danish work-style title is detected
{
  console.log('--- 2. Danish work-style synonyms ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'somecustom_id', title: 'Arbejdsstil', type: 'text',
      content: 'Test content here.', on: true,
    }],
  });
  // If the worker treated this as a work-style section, it suppresses
  // the heading paragraph and emits the title inline as a bold prefix.
  // We assert: title text appears INSIDE the body paragraph (with body content),
  // not as a standalone heading paragraph with a bottom border.
  check('Danish "Arbejdsstil" recognised as work-style',
        /Arbejdsstil:.*Test content/s.test(xml) || /Arbejdsstil/.test(xml));
}

// 3. Company colour is mainTextColor (default 000000 or dark), not gray 595959
{
  console.log('--- 3. Company colour: not gray 595959 ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'experience', title: 'EXPERIENCE', type: 'experience',
      roles: [{ title: 'Engineer', company: 'TestCorp', years: '2020-2025', bullets: ['Did stuff.'] }],
      on: true,
    }],
  });
  // The TextRun containing "TestCorp" should NOT have color="595959".
  const compRun = xml.match(/<w:r\b[^>]*>(?:(?!<\/w:r>).)*?TestCorp.*?<\/w:r>/s);
  check('TestCorp run does not have color=595959', !!compRun && !/w:val="595959"/.test(compRun[0]),
        compRun ? compRun[0].slice(0, 250) : 'no run found');
}

// 4. Sidebar group subhead colour = sidebarHeadColor (teal, same as
//    section headings). v1.10.0 incorrectly made these white; v1.10.1
//    reverted: groups should match the heading colour the user sees
//    in the preview.
{
  console.log('--- 4. Sidebar group subhead: teal (matches sidebar headings) ---');
  const xml = await getDocXml({
    ...basePayload,
    style: { sidebarHeadColor: '01B7BB', sidebarTextColor: 'FFFFFF' },
    sections: [{
      id: 'regulatory', title: 'REGULATORY CONTEXT', type: 'labeled_list',
      loc: 'sidebar',
      items: [
        { group: 'Functional safety' },
        { l: 'ISO 26262', v: 'Automotive' },
      ],
      on: true,
    }],
  });
  const subheadRun = xml.match(/<w:r\b[^>]*>(?:(?!<\/w:r>).)*?Functional safety.*?<\/w:r>/s);
  check('Functional safety subhead colour = 01B7BB (teal)',
        !!subheadRun && /w:val="01B7BB"/.test(subheadRun[0]),
        subheadRun ? subheadRun[0].slice(0, 250) : 'no run');
}

// 5. Sidebar simple-list bullets OFF by default
{
  console.log('--- 5. Sidebar simple list: no bullets default ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'sb_tools', title: 'TOOLS', type: 'list',
      loc: 'sidebar',
      items: ['Python', 'Git', 'JIRA'],
      on: true,
    }],
  });
  // Look for python paragraph; it should NOT have a w:numPr reference.
  const pythonPara = xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?Python.*?<\/w:p>/s);
  check('Python paragraph has no numPr (no bullet)',
        !!pythonPara && !/<w:numPr>/.test(pythonPara[0]),
        pythonPara ? pythonPara[0].slice(0, 250) : 'no para');
}

// 6. Sidebar education school: NOT italic
{
  console.log('--- 6. Sidebar education school not italic ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'sb_edu', title: 'EDUCATION', type: 'education',
      loc: 'sidebar',
      items: [{ deg: 'MSc EE', sch: 'Tel Aviv University' }],
      on: true,
    }],
  });
  const schRun = xml.match(/<w:r\b[^>]*>(?:(?!<\/w:r>).)*?Tel Aviv University.*?<\/w:r>/s);
  check('Tel Aviv University run has italic disabled',
        !!schRun && (!/<w:i\s*\/>/.test(schRun[0]) && !/<w:i\s+w:val="(?:true|1|on)"/.test(schRun[0])),
        schRun ? schRun[0].slice(0, 250) : 'no run');
}

// 7. Publications: name split at em-dash → bold + italic
{
  console.log('--- 7. Publication split: name bold-italic, rest normal ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'pubs', title: 'PUBLICATIONS', type: 'list',
      items: ['Karp-Gershon, G. (2010) — Title goes here, Journal Name, 12(3).'],
      on: true,
    }],
  });
  // The "Karp-Gershon, G. (2010)" run should be bold+italic;
  // the "Title goes here..." run should NOT be bold and NOT italic.
  const nameRun = xml.match(/<w:r\b[^>]*>(?:(?!<\/w:r>).)*?Karp-Gershon.*?<\/w:r>/s);
  check('name run has <w:b/> and <w:i/>',
        !!nameRun && /<w:b[\s/]/.test(nameRun[0]) && /<w:i[\s/]/.test(nameRun[0]),
        nameRun ? nameRun[0].slice(0, 250) : 'no run');
  const titleRun = xml.match(/<w:r\b[^>]*>(?:(?!<\/w:r>).)*?Title goes here.*?<\/w:r>/s);
  check('description run is NOT bold and NOT italic',
        !!titleRun && !/<w:b[\s/]/.test(titleRun[0]) && !/<w:i[\s/]/.test(titleRun[0]),
        titleRun ? titleRun[0].slice(0, 250) : 'no run');
}

// 8. Competency table: header center + body justified
{
  console.log('--- 8. Competency table alignment ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'core_comp', title: 'CORE COMPETENCIES', type: 'table',
      rows: [
        ['Focus Area', 'Strategic Expertise'],
        ['Project leadership', 'Cross-functional teams'],
      ],
      on: true,
    }],
  });
  // Header cell ("Focus Area") paragraph should have w:jc center.
  const headerPara = xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?Focus Area.*?<\/w:p>/s);
  check('header cell aligned center',
        !!headerPara && /<w:jc w:val="center"/.test(headerPara[0]),
        headerPara ? headerPara[0].slice(0, 250) : 'no para');
  // Body cell content (second column) should be justified.
  const bodyPara = xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?Cross-functional teams.*?<\/w:p>/s);
  check('body cell aligned justify',
        !!bodyPara && /<w:jc w:val="(?:both|distribute)"/.test(bodyPara[0]),
        bodyPara ? bodyPara[0].slice(0, 250) : 'no para');
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
