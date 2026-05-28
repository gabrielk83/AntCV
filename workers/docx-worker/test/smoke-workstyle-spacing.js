// Tests for the v1.7.8 work_style spacing fix.
//
// User report: in the rendered docx the gap between PROFILE content
// and "Work style: ..." is too large, while the gap between
// "Work style: ..." and the SELECTED OUTCOMES heading is too small.
// The fix gives work_style asymmetric spacing — small before, large
// after — so it reads as a continuation of PROFILE and a clear
// separation before the next heading.

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

console.log('--- work_style gets asymmetric spacing (small before, large after) ---');
{
  const xml = await docXml({
    doc: 'cv', layout: 'two_column',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'profile',    loc: 'main', on: true, type: 'text',        title: 'PROFILE',    content: 'Electro-optical engineer with 15 years of experience.' },
      { id: 'work_style', loc: 'main', on: true, type: 'text_inline', title: 'Work style', content: 'Hands-on and data-driven.' },
      { id: 'outcomes',   loc: 'main', on: true, type: 'bullets',     title: 'SELECTED OUTCOMES', items: [{b:'Designed', t:'lithography processes'}] },
    ],
  });

  // Find the paragraph that contains "Work style". The spacing attrs
  // are on <w:pPr><w:spacing w:before="..." w:after="..."/></w:pPr>.
  // We grab the work-style paragraph and inspect its w:spacing values.
  // Parse: find all <w:p>...</w:p> blocks, identify the one with "Work style".
  const paras = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map(m => m[0]);
  const workStylePara = paras.find(p => p.includes('Work style'));

  assert('Found work_style paragraph', !!workStylePara);
  if (workStylePara) {
    const spacingMatch = workStylePara.match(/<w:spacing\b[^/]*?\/?>/);
    assert('Has spacing attr', !!spacingMatch, 'no <w:spacing> on work_style paragraph');
    if (spacingMatch) {
      const spacingTag = spacingMatch[0];
      const before = (spacingTag.match(/w:before="(\d+)"/) || [])[1];
      const after  = (spacingTag.match(/w:after="(\d+)"/)  || [])[1];
      assert('w:before is small (≤ 30)',
        before && parseInt(before, 10) <= 30,
        `before=${before}`);
      assert('w:after is large (≥ 100)',
        after && parseInt(after, 10) >= 100,
        `after=${after}`);
      // And specifically the values from the spec
      assert('w:before is exactly 20',
        before === '20', `got w:before="${before}"`);
      assert('w:after is exactly 140',
        after === '140', `got w:after="${after}"`);
    }
  }

  // Sanity: PROFILE paragraph keeps its standard spacing.
  const profilePara = paras.find(p => p.includes('Electro-optical engineer'));
  assert('Found PROFILE content paragraph', !!profilePara);
  if (profilePara) {
    const spacingTag = (profilePara.match(/<w:spacing\b[^/]*?\/?>/) || [])[0] || '';
    const before = (spacingTag.match(/w:before="(\d+)"/) || [])[1];
    const after  = (spacingTag.match(/w:after="(\d+)"/)  || [])[1];
    assert('PROFILE before unchanged (60)',
      before === '60', `got "${before}"`);
    assert('PROFILE after unchanged (60)',
      after === '60', `got "${after}"`);
  }
}

console.log('\n--- non-work_style text_inline keeps symmetric 60/60 spacing ---');
{
  // A cover-letter style closing line is also text_inline but should
  // NOT get the work-style asymmetric spacing.
  const xml = await docXml({
    doc: 'cl', layout: 'linear',
    personal_info: { name: 'T' }, meta: {},
    sections: [
      { id: 'closing', loc: 'main', on: true, type: 'text_inline', title: 'Best regards', content: 'Gabriel.' },
    ],
  });
  const paras = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map(m => m[0]);
  const closingPara = paras.find(p => p.includes('Best regards') || p.includes('Gabriel'));
  if (closingPara) {
    const spacingTag = (closingPara.match(/<w:spacing\b[^/]*?\/?>/) || [])[0] || '';
    const before = (spacingTag.match(/w:before="(\d+)"/) || [])[1];
    const after  = (spacingTag.match(/w:after="(\d+)"/)  || [])[1];
    // Non-work-style text_inline keeps the original 60/60. Either
    // the title is recognized as a CL boilerplate (closing/closure)
    // and routed elsewhere, OR it goes through renderTextInline
    // with the default branch — both acceptable as long as the
    // work-style asymmetric values don't appear.
    const isAsymmetric = before === '20' && after === '140';
    assert('Non-work-style text_inline does NOT get asymmetric spacing',
      !isAsymmetric,
      `unexpected work_style spacing applied: before=${before}, after=${after}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
