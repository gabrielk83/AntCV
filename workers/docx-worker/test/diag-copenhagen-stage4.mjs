// diag-copenhagen-stage4.mjs — COPENHAGEN-STAGE4-DOCX-PARITY structural checks
// (spec docs/design/COPENHAGEN_MODERN_NORDIC_PALETTE_SPEC.md "Stage 4").
// Generates a copenhagen-modern CV + CL offline and asserts the tuned-preview
// OOXML: rounded VML band box in a first-page header (titlePg), un-shaded band
// cells, 17.5pt tracked name, cyan spec, w:w=73 one-line contact, white band
// links, no default header rules, 1.4in photo with 1.5pt cyan ring, grey app
// line + teal 1.5pt rule, teal sign-off with cyan w:u. A legacy (package-less)
// payload must keep the OLD look untouched.
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) { let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break; const cdo = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cdo; for (let e = 0; e < n; e++) { const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42); const en = buf.toString('utf8', p + 46, p + 46 + nl); if (en === name) { const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28), ds = lho + 30 + lnl + lel; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); } p += 46 + nl + el + cl; } return null; }
const mod = await import('../src/index.js');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const cvSections = [
  { id: 'summary', title: 'PROFESSIONAL SUMMARY', loc: 'main', on: true, type: 'text', content: 'Project manager bridging optics and delivery.' },
  { id: 'skills', title: 'CORE SKILLS', loc: 'sidebar', on: true, type: 'list', items: ['Optics', 'Delivery'] },
];
const clSections = [
  { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' },
  { id: 'why', title: 'WHY', loc: 'main', on: true, type: 'rich_block', headlineOff: true, items: [{ b: 'Why', t: 'Because it fits.' }] },
  // ORPHAN-RULE-GATE-001 parity: headline-off + rule requested but content is
  // ALL placeholder -> the standalone rule must NOT render.
  { id: 'ghost', title: 'GHOST', loc: 'main', on: true, type: 'rich_block', headlineOff: true, headlineRule: true, items: [{ b: '', t: '[Employer priority 1]' }] },
  { id: 'closure', title: 'Closure', loc: 'main', on: true, type: 'text', content: 'I would welcome a talk.' },
];
const pi = { name: 'Anita Test Person', email: 'anita@example.com', phone: '+45 12 34 56 78', linkedin: 'linkedin.com/in/anita', location: 'Copenhagen', photo_b64: png, photoPosition: 'band-overlap', photoSizePx: 134 };

async function gen(body) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) { log('STATUS', res.status, Buffer.from(ab).toString().slice(0, 300)); process.exit(1); }
  return Buffer.from(ab);
}

let fails = 0;
const check = (label, ok) => { log((ok ? 'PASS' : 'FAIL'), label); if (!ok) fails++; };

// ── Copenhagen CV ──
const cv = await gen({ schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't', package: 'copenhagen-modern', personal_info: pi, meta: { subtitle: 'Project Management • Optics' }, style: { headerBg: '33446F', sidebarBg: 'DCE5EA', photoBorderColor: '01B9BD', headerSpecColor: '01B9BD' }, font_sizes: {}, sections: cvSections });
const cvXml = unzip(cv, 'word/document.xml').toString('utf8');
const cph = unzip(cv, 'word/headerCph.xml');
const cphXml = cph ? cph.toString('utf8') : '';
check('CV: first-page header part exists (headerCph.xml)', !!cph);
check('CV: roundrect navy fill + cyan 1.5pt stroke', /v:roundrect[^>]*fillcolor="#33446F" strokecolor="#01B9BD" strokeweight="1.5pt"/.test(cphXml));
check('CV: roundrect rounded (arcsize)', cphXml.includes('arcsize="15000f"'));
check('CV: first-page spine starts below the box', cphXml.includes('margin-top:158pt') || !cphXml.includes('AntCVSpine'));
check('CV: titlePg present', cvXml.includes('<w:titlePg/>'));
check('CV: headerReference first present', /w:headerReference w:type="first"/.test(cvXml));
check('CV: band cells NOT navy-shaded (no 33446F shd)', !/w:shd[^>]*w:fill="33446F"/.test(cvXml));
// CPH-NAME-WIDTH-001 (wk 1.14.166) superseded the pinned 17.5pt/49: the name
// AUTO-SCALES to the contact width. Assert the model instead: a sane fitted
// size (15-30pt) whose tracking is .14em of it (round(0.14 * pt * 20)).
{
  const nameRun = (cvXml.match(/<w:r><w:rPr>(?:(?!<\/w:r>).)*?Anita Test Person/s) || [''])[0];
  const sz = Number((nameRun.match(/<w:sz w:val="(\d+)"\/>/) || [])[1] || 0);
  const track = Number((nameRun.match(/<w:spacing w:val="(-?\d+)"\/>/) || [])[1] || 0);
  const pt = sz / 2;
  check('CV: name fitted 15-30pt (CPH-NAME-WIDTH)', pt >= 15 && pt <= 30);
  check('CV: name tracking = .14em of fitted size', track === Math.round(0.14 * pt * 20));
}
check('CV: spec cyan 01B9BD', /w:color w:val="01B9BD"/.test(cvXml));
check('CV: contact char-scaled w:w=73', /<w:w w:val="73"\/>/.test(cvXml));
check('CV: band link white (FFFFFF colored run)', /w:color w:val="FFFFFF"/.test(cvXml));
check('CV: no default spec/contact header rules (no bottom border on contact para)', !/<w:pBdr>(?:(?!<\/w:pBdr>).)*w:sz w:val="6"(?:(?!<\/w:pBdr>).)*<\/w:pBdr>/s.test(cvXml.slice(0, cvXml.indexOf('PROFESSIONAL SUMMARY'))));
check('CV: photo 1.29in / 124px (cx 1181100 EMU; CPH-PHOTO-124)', cvXml.includes('cx="1181100"'));
check('CV: photo ring 1.5pt (a:ln w="19050")', /a:ln w="19050"/.test(cvXml));

// ── Copenhagen CL ──
const cl = await gen({ schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't', package: 'copenhagen-modern', personal_info: { name: 'Anita Test Person', email: 'anita@example.com' }, meta: { subtitle: 'Project Management • Optics', role: 'Project Manager', company: 'Ibsen Photonics', slogan: 'MOVES HARDWARE FROM LAB TO DELIVERY' }, style: { headerBg: '33446F', photoBorderColor: '01B9BD', headerSpecColor: '01B9BD' }, font_sizes: {}, sections: clSections });
const clXml = unzip(cl, 'word/document.xml').toString('utf8');
const clCph = unzip(cl, 'word/headerCph.xml');
check('CL: first-page header box part exists', !!clCph);
check('CL: app line grey 808080', /w:color w:val="808080"/.test(clXml));
check('CL: app-line rule teal 1.5pt (border 00746E sz 12)', /w:bottom w:val="single" w:color="00746E" w:sz="12" w:space="5"/.test(clXml));
check('CL: sign-off teal 00746E', /w:color w:val="00746E"/.test(clXml));
check('CL: sign-off cyan underline (w:u color 01B9BD)', /<w:u w:val="single" w:color="01B9BD"\/>/.test(clXml));
check('CL: orphan rule gated (placeholder-only section draws no standalone rule)', (clXml.match(/w:bottom w:val="single"/g) || []).length <= 3);
check('CL: band cell NOT navy-shaded', !/w:shd[^>]*w:fill="33446F"/.test(clXml));

// ── Legacy payload (no package) keeps the old look ──
const legacy = await gen({ schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't', personal_info: { name: 'Anita Test Person', email: 'anita@example.com' }, meta: { subtitle: 'Spec' }, style: { headerBg: '1B627F' }, font_sizes: {}, sections: cvSections });
const lgXml = unzip(legacy, 'word/document.xml').toString('utf8');
check('LEGACY: no first-page header box part', !unzip(legacy, 'word/headerCph.xml'));
check('LEGACY: band still shaded', /w:shd[^>]*w:fill="1B627F"/.test(lgXml));
check('LEGACY: name keeps 16pt (w:sz 32)', /<w:sz w:val="32"\/>/.test(lgXml));
check('LEGACY: no titlePg', !lgXml.includes('<w:titlePg/>'));
check('LEGACY: default spec/contact rules still drawn', /w:val="single" w:color="01B7BB" w:sz="6"/.test(lgXml));

log(fails ? 'RESULT: ' + fails + ' FAILURES' : 'RESULT: ALL PASS');
process.exit(fails ? 1 : 0);
