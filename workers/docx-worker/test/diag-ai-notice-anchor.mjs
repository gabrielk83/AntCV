/* DIAGNOSTIC — AI-WATERMARK-EXPORT-LOCATION-001 / WM-001..005.
 * Updated 2026-07-26 (DOCX-DIAG-STALE-OR-REGRESSED-001 triage): the CV notice is a
 * bottom-corner-anchored VML text frame swapped in for a sentinel by postProcessDocx;
 * the CL notice moved OUT of document.xml into the section FOOTER (CL-AI-NOTICE-FOOTER-001,
 * teal 4D7976) — for a copenhagen/titlePg CL page 1 also gets a first-page-header VML frame
 * (CL-NOTICE-FIRSTPAGE-001), but a plain linear CL's single footer already covers page 1.
 * Notice text uses an ASCII hyphen (banned-dash policy), NOT an em-dash.
 * Asserts (spec §7): CV — (a) no flowed run / sentinel consumed; (b) exactly ONE anchored
 * shape on the LAST page; (c) page-relative vertical anchor via margin-top (LO ignores the
 * mso-position-vertical:bottom keyword) + encoded corner; (d) no fill/stroke.
 * CL — notice rendered in the footer (teal), none left flowed in the body.
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
  return buf;
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };
// Notice furniture uses an ASCII hyphen (banned-dash policy — CONTACT/610b80f + BANNED-DASH-MEASURE-001).
const NOTICE = 'AI-assisted - author retains responsibility for content.';

// ---- CV: force two pages (role.page=2) + ask for the LEFT corner. ----
const cvBuf = await build({
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
const cvXml = unzipEntry(cvBuf, 'word/document.xml').toString('utf8');

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
// AI-NOTICE-BOTTOM-CLOUDCONVERT-001 (owner 2026-07-04): LibreOffice/CloudConvert IGNORES the
// mso-position-vertical:bottom keyword from inside a table cell, so the worker anchors the notice
// to the PAGE edge via an EXPLICIT page-relative margin-top (806pt in-cell/overflow, 822pt body-level).
// The diag asserted the abandoned keyword — RED since then. Assert the shipped page-relative encoding.
check('CV: anchored to page edge (margin-top page-relative)',
  /mso-position-vertical-relative:page/.test(shape) && /margin-top:\d+pt/.test(shape), shape.slice(0, 140));
// AI-NOTICE-LEFT-CLOUDCONVERT-001 (owner 2026-07-01): LibreOffice/CloudConvert IGNORES
// the mso-position-horizontal:left|center keyword, so the worker encodes the corner as
// an EXPLICIT page-relative margin-left offset (+ matching text justification).
check('CV: left corner honoured (margin-left:0pt page-relative + jc left)',
  /margin-left:0pt/.test(shape) && /mso-position-horizontal-relative:page/.test(shape) && /<w:jc w:val="left"\/>/.test(shape),
  shape.slice(0, 160));
check('CV: no fill/stroke (WM-003)', /filled="f"/.test(shape) && /stroked="f"/.test(shape));

// ---- CL 1-page: notice moved to the FOOTER (CL-AI-NOTICE-FOOTER-001), teal, not in the body. ----
const clBuf = await build({
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: {}, style: {}, font_sizes: {},
  sections: [
    { id: 'body', title: '', loc: 'main', on: true, type: 'text', content: 'Dear hiring team, here is my letter.' },
  ],
});
const clDoc = unzipEntry(clBuf, 'word/document.xml').toString('utf8');
const clFooter = (unzipEntry(clBuf, 'word/footer1.xml') || Buffer.from('')).toString('utf8');
// The CL body carries NO VML notice shape and no leftover sentinel — it lives in the footer now.
check('CL: no VML notice / sentinel in the body', (clDoc.match(/AntCVAiNotice/g) || []).length === 0 && clDoc.indexOf('__ANTCV_AIWM_') < 0);
// The footer carries the notice run in the CL teal (4D7976).
check('CL: notice rendered in the footer (teal 4D7976)',
  clFooter.indexOf(NOTICE) >= 0 && /w:color w:val="4D7976"/.test(clFooter),
  `hasText=${clFooter.indexOf(NOTICE) >= 0} hasTeal=${/w:color w:val="4D7976"/.test(clFooter)}`);

const ok = checks.every(Boolean);
log(ok ? 'AI-NOTICE-ANCHOR OK' : 'AI-NOTICE-ANCHOR FAIL');
process.exit(ok ? 0 : 1);
