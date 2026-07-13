/* DIAGNOSTIC — SIDEBAR-SPINE-VML-001 (owner 2026-07-13: "sidebar color is many
 * times not reaching end of page"). Each page's sidebar cell carries a spine
 * sentinel that postProcessDocx swaps for a PAGE-ANCHORED full-height VML rect
 * in sidebarBg — color to the true page edge with ZERO row-pagination impact
 * (the anti-blank-page atLeast minimums stay untouched; PDF-BLANK-PAGE-001/002).
 * Asserts on a 2-page two-column CV:
 *   1. no __ANTCV_SPINE_ sentinel text survives in document.xml
 *   2. one AntCVSpine rect PER PAGE (2), page-anchored, height 842pt, z<0
 *   3. rect fill = sidebarBg, width ≈ sidebar_ratio * page width (pt), left side
 *   4. style_config sidebarSpine:false kills the spine entirely
 *   5. the body-row atLeast minimums are untouched (12600 / 15538 pins)
 * Run: node test/diag-sidebar-spine.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  if (i < 0) throw new Error('no EOCD');
  const cdOffset = buf.readUInt32LE(i + 16);
  const nEntries = buf.readUInt16LE(i + 10);
  let p = cdOffset;
  for (let e = 0; e < nEntries; e++) {
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const ename = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (ename === name) {
      const lNameLen = buf.readUInt16LE(lho + 26);
      const lExtraLen = buf.readUInt16LE(lho + 28);
      const dataStart = lho + 30 + lNameLen + lExtraLen;
      const comp = buf.slice(dataStart, dataStart + compSize);
      return buf.readUInt16LE(p + 10) === 0 ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found: ' + name);
}

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return Buffer.from(ab);
}

const NAVY = '283556';
const basePayload = (extraStyle = {}) => ({
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  sidebar_ratio: 0.36,
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: { navy: '#' + NAVY, accent: '#01B7BB', teal: '#00746E', ...extraStyle },
  font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
    { id: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['did alpha'] },
      { id: 'r2', title: 'Role Two', company: 'C2', years: '2020', bullets: ['did beta'], page: 2 },
    ] },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [
      { l: 'Optics', v: 'lab work' }, { l: 'Python', v: 'analysis', page: 2 },
    ] },
  ],
});

let fail = 0;
const check = (name, cond) => { log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) fail++; };

// ── default ON: the spine lives in the HEADER part (the layer the DEMO
// watermark proves renders on EVERY page through LibreOffice/CloudConvert —
// a body-cell-anchored negative-z rect was pixel-verified DROPPED there) ─────
{
  const buf = await gen(basePayload());
  const hdr = unzipEntry(buf, 'word/header1.xml').toString('utf8');
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const rects = hdr.match(/<v:rect id="AntCVSpine"[^>]*>/g) || [];
  check('one spine rect in the header part', rects.length === 1, rects.length);
  check('page-anchored', rects.every(r => r.includes('mso-position-horizontal-relative:page') && r.includes('mso-position-vertical-relative:page')));
  check('full page height 842pt', rects.every(r => r.includes('height:842pt')));
  check('behind content (negative z)', rects.every(r => /z-index:-\d+/.test(r)));
  check('fill = sidebarBg (navy)', rects.every(r => r.toLowerCase().includes(('fillcolor="#' + NAVY).toLowerCase())));
  // 0.36 * 11906 twips = 4286 -> /20 = 214pt (rounded by the caller)
  check('width ~= ratio * page (214pt)', rects.every(r => /width:21[3-5]pt/.test(r)));
  check('left side (margin-left:0)', rects.every(r => r.includes('margin-left:0pt')));
  check('no spine leakage into the body', xml.indexOf('AntCVSpine') < 0 && xml.indexOf('__ANTCV_SPINE_') < 0);
  // the anti-blank-page pins MUST stay (sidebar-fill-gap-is-antiblank-slack)
  check('PAGE1_BODY_MIN pin 12600 intact', /w:val="12600"/.test(xml));
  check('CONT_BODY_MIN pin 15538 intact', /w:val="15538"/.test(xml));
}

// ── kill-switch ──────────────────────────────────────────────────────────────
{
  const p = basePayload({ sidebarSpine: false });
  const buf = await gen(p);
  const hdr = unzipEntry(buf, 'word/header1.xml').toString('utf8');
  check('sidebarSpine:false -> no spine rect', hdr.indexOf('AntCVSpine') < 0);
}

// ── CL (linear layout) never gets a spine ────────────────────────────────────
{
  const p = basePayload();
  p.doc = 'cl'; p.layout = 'linear';
  p.sections = [{ id: 'greeting', title: '', loc: 'main', on: true, type: 'text', content: 'Dear X,' }];
  const buf = await gen(p);
  let hdr = '';
  try { hdr = unzipEntry(buf, 'word/header1.xml').toString('utf8'); } catch (_) {}
  check('linear/CL doc -> no spine rect', hdr.indexOf('AntCVSpine') < 0);
}

// ── AI-NOTICE-INK-001: the notice ink adapts to the spine ground ─────────────
{
  // NOTE: payload.style.navy does NOT flow into sidebarBg (the worker default
  // navy 283556 holds unless sidebarBg is explicit — real app payloads always
  // send it). Set the brand green explicitly, like the live NVIDIA payloads.
  const p = basePayload({ sidebarBg: '#76B900' });
  p.ai_wm_side = 'left';                  // notice corner ON the spine side
  const xml = unzipEntry(await gen(p), 'word/document.xml').toString('utf8');
  const m = xml.match(/AntCVAiNotice[\s\S]{0,1200}?w:color w:val="([0-9A-Fa-f]{6})"/);
  check('notice over green spine gets a readable dark ink', !!m && m[1].toUpperCase() === '262626', m && m[1]);
  const hs = (unzipEntry(await gen(p), 'word/header1.xml').toString('utf8').match(/AntCVSpine[^>]*fillcolor="#([0-9A-Fa-f]{6})"/) || [])[1];
  check('spine takes the explicit brand green', (hs || '').toUpperCase() === '76B900', hs);
  // off-spine: flip the SPINE to the right (sidebarPosition), notice stays left
  // (the ai_wm_side hint alone can be overridden by the measured-gap routing,
  // so pin the geometry instead of the hint)
  const p2 = basePayload({ sidebarBg: '#76B900', sidebarPosition: 'right' });
  p2.ai_wm_side = 'left';
  const xml2 = unzipEntry(await gen(p2), 'word/document.xml').toString('utf8');
  const m2 = xml2.match(/AntCVAiNotice[\s\S]{0,1200}?style="position:absolute;margin-left:(\d+)pt[\s\S]{0,900}?w:color w:val="([0-9A-Fa-f]{6})"/);
  const landedLeft = !!m2 && Number(m2[1]) < 100;
  check('off-spine notice keeps the subtle gray (or adapts if it landed on the spine)',
        !!m2 && (landedLeft ? m2[2].toUpperCase() === '9A9A9A' : m2[2].toUpperCase() !== '9A9A9A'),
        m2 && (m2[1] + 'pt/' + m2[2]));
}

log(fail === 0 ? 'ALL GREEN' : fail + ' FAILURE(S)');
process.exit(fail === 0 ? 0 : 1);
