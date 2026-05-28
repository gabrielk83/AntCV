// v1.10.1 spot checks:
//   1. Sidebar group subhead colour reverted to sidebarHeadColor (teal),
//      NOT sidebarTextColor (white).
//   2. PROFILE heading has spacing.before = 0 (no special 4pt anymore).
//   3. After a competency table, the trailing paragraph carries 4pt
//      (= 80 dxa) of `after` spacing so the next heading has room.
//   4. Profile photo's preset geometry is rewritten to `ellipse` AND
//      an `<a:ln>` outline element is present on the picture shape.

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
  personal_info: {
    name: 'Test Person',
    email: 'a@b.c',
    phone: '+45',
    linkedin: 'in/test',
    location: 'Cph',
    citizenship: 'EU',
  },
  meta: {},
  sections: [],
  style: {},
  font_sizes: {},
};

let passed = 0, failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { console.log('  ✓ ' + name); passed++; }
  else      { console.log('  ✗ ' + name + (detail ? ' — ' + detail.slice(0, 250) : '')); failed++; }
};

// 1. Sidebar group subhead is teal (sidebarHeadColor), not white.
{
  console.log('--- 1. Sidebar group subhead teal (not white) ---');
  const xml = await getDocXml({
    ...basePayload,
    style: { sidebarHeadColor: '01B7BB', sidebarTextColor: 'FFFFFF' },
    sections: [{
      id: 'tools', title: 'TOOLS & METHODS', type: 'labeled_list',
      loc: 'sidebar',
      items: [
        { group: 'Domain' },
        { l: 'Python', v: 'scripts' },
      ],
      on: true,
    }],
  });
  const domainRun = xml.match(/<w:r\b[^>]*>(?:(?!<\/w:r>).)*?Domain.*?<\/w:r>/s);
  check('Domain subhead colour = 01B7BB (teal)',
        !!domainRun && /w:val="01B7BB"/.test(domainRun[0]),
        domainRun && domainRun[0]);
  check('Domain subhead colour is NOT FFFFFF',
        !!domainRun && !/w:val="FFFFFF"/.test(domainRun[0]),
        domainRun && domainRun[0]);
}

// 2. PROFILE heading no longer gets 80 dxa before (was the special case).
{
  console.log('--- 2. PROFILE heading has spacing.before = 0 ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'profile', title: 'PROFILE', type: 'text',
      content: 'My profile here.',
      loc: 'main',
      on: true,
    }],
  });
  // headingParagraph for the PROFILE section.
  const profilePara = xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?PROFILE.*?<\/w:p>/s);
  check('PROFILE paragraph has w:before="80"',
        !!profilePara && /<w:spacing[^>]*\bw:before="80"/.test(profilePara[0]),
        profilePara && profilePara[0]);
}

// 3. The paragraph emitted RIGHT AFTER the competency table has w:after >= 80.
{
  console.log('--- 3. Table trailing paragraph adds 4pt after ---');
  const xml = await getDocXml({
    ...basePayload,
    sections: [{
      id: 'core_comp', title: 'CORE COMPETENCIES', type: 'table',
      rows: [
        ['Focus Area', 'Strategic Expertise'],
        ['Leadership', 'Cross-functional teams'],
      ],
      loc: 'main',
      on: true,
    }],
  });
  // Find the </w:tbl> close, then the next <w:p ...> after it.
  const tblEnd = xml.indexOf('</w:tbl>');
  check('competency table emitted', tblEnd > 0);
  if (tblEnd > 0) {
    const after = xml.slice(tblEnd, tblEnd + 2000);
    const firstP = after.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?<\/w:p>/s);
    check('first paragraph after table has w:after="40" (8pt, v1.10.3)',
          !!firstP && /<w:spacing[^>]*\bw:after="40"/.test(firstP[0]),
          firstP && firstP[0]);
  }
}

// 4. Profile photo: prstGeom=ellipse AND <a:ln> outline present.
{
  console.log('--- 4. Photo is circular + outlined ---');
  // A 1x1 white PNG (base64) — minimum-valid image so ImageRun emits a pic.
  const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
  const xml = await getDocXml({
    ...basePayload,
    style: { sidebarHeadColor: '01B7BB' },
    personal_info: { ...basePayload.personal_info, photo_b64: TINY_PNG_B64 },
    sections: [],
  });
  check('<a:prstGeom prst="ellipse"> present (circular crop)',
        /<a:prstGeom\s+prst="ellipse"/.test(xml));
  check('<a:prstGeom prst="rect"> in pic context absent (rewritten)',
        !/<pic:spPr\b[^>]*>[\s\S]*?<a:prstGeom\s+prst="rect"/.test(xml));
  check('<a:ln ...> outline element present on picture',
        /<a:ln\s+w="12700"/.test(xml));
  check('outline colour is 01B7BB',
        /<a:ln\s+w="12700"[^>]*>[\s\S]*?<a:srgbClr\s+val="01B7BB"/.test(xml));
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
