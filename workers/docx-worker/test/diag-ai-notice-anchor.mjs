/* DIAGNOSTIC — AI-WATERMARK-EXPORT-LOCATION-001 / WM-001..005 (worker 1.14.75).
 * The AI notice is no longer a flowed paragraph: buildAiDisclosureHangingTextbox
 * emits a SENTINEL run at the end of the last page's content, which
 * postProcessDocx swaps for a bottom-corner-anchored VML text frame.
 * Asserts (spec §7): (a) no flowed "AI-assisted" run remains; (b) exactly ONE
 * anchored AI-notice shape; (c) it lives in the LAST page's XML; (d) the sentinel
 * is fully consumed; (e) the bottom anchor + encoded corner are present.
 * Drives the real fetch handler. */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10);
  let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl);
    if (nm === name) {
      const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28);
      const d = buf.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + cs);
      return buf.readUInt16LE(p + 10) === 0 ? d : inflateRawSync(d);
    }
    p += 46 + nl + xl + cl;
  }
  return null;
}
const mod = await import('../src/index.js');

async function build(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200) { log('status', res.status, buf.toString().slice(0, 200)); process.exit(1); }
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };
const NOTICE = 'AI-assisted — author retains responsibility for content.';

// ---- CV: force two pages (role.page=2) + ask for the LEFT corner. ----
const cvXml = await build({
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  ai_wm_side: 'left',
  personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r0', title: 'Change Control Lead', company: 'Innoviz', years: '2020-2025', bullets: ['Owned the governance loop.'] },
      { id: 'r1', title: 'Optics Engineer', company: 'Sirin', years: '2014-2017', page: 2, bullets: ['Led the optics stack on page two.'] },
    ] },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'E', v: 'P' }] },
  ],
});

const noticeCount = (cvXml.match(/AntCVAiNotice/g) || []).length;
check('CV: no sentinel leftover', cvXml.indexOf('__ANTCV_AIWM_') < 0, cvXml.slice(cvXml.indexOf('__ANTCV_AIWM_'), cvXml.indexOf('__ANTCV_AIWM_') + 40));
check('CV: exactly one anchored notice shape', noticeCount === 1, `count=${noticeCount}`);
// The notice text appears exactly once, and ONLY inside the VML textbox (no flowed run).
const tCount = cvXml.split(NOTICE).length - 1;
check('CV: notice text appears exactly once', tCount === 1, `count=${tCount}`);
const ni = cvXml.indexOf('AntCVAiNotice');
const ti = cvXml.indexOf(NOTICE);
check('CV: notice text is inside the VML shape (not flowed)', ni >= 0 && ti > ni, `shape=${ni} text=${ti}`);
// Last-page only: the shape sits after the final body-level page break.
const lastBreak = cvXml.lastIndexOf('w:pageBreakBefore');
check('CV: two-page doc has a page break', lastBreak >= 0);
check('CV: shape is after the last page break (last page)', ni > lastBreak, `break=${lastBreak} shape=${ni}`);
// Anchoring + corner (ai_wm_side:'left').
const shape = cvXml.slice(ni, cvXml.indexOf('</v:rect>', ni) + 9);
check('CV: anchored to page-margin bottom', /mso-position-vertical:bottom/.test(shape) && /mso-position-vertical-relative:margin/.test(shape));
check('CV: left corner honoured', /mso-position-horizontal:left/.test(shape), shape.slice(0, 160));
check('CV: no fill/stroke (WM-003)', /filled="f"/.test(shape) && /stroked="f"/.test(shape));

// ---- CL 1-page: notice present, bottom-right, not on signature line. ----
const clXml = await build({
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: {}, style: {}, font_sizes: {},
  sections: [
    { id: 'body', title: '', loc: 'main', on: true, type: 'text', content: 'Dear hiring team, here is my letter.' },
  ],
});
const clNotice = (clXml.match(/AntCVAiNotice/g) || []).length;
check('CL: one anchored notice shape', clNotice === 1, `count=${clNotice}`);
check('CL: no sentinel leftover', clXml.indexOf('__ANTCV_AIWM_') < 0);
const clShape = clXml.slice(clXml.indexOf('AntCVAiNotice'), clXml.indexOf('</v:rect>', clXml.indexOf('AntCVAiNotice')) + 9);
check('CL: right corner', /mso-position-horizontal:right/.test(clShape));
check('CL: bottom anchor', /mso-position-vertical:bottom/.test(clShape));

const ok = checks.every(Boolean);
log(ok ? 'AI-NOTICE-ANCHOR OK' : 'AI-NOTICE-ANCHOR FAIL');
process.exit(ok ? 0 : 1);
