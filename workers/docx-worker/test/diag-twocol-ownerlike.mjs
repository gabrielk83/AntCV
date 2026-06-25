/* DIAGNOSTIC — per-page two-column export, OWNER scenario (export review 2026-06-09).
 * Mirrors the owner's CV: a labeled_list REGULATORY CONTEXT (with a group divider)
 * drives the SIDEBAR break, EXPERIENCE drives the MAIN break, coordinated onto page 2,
 * and ai_wm_side='left' asks for the disclosure in the (empty-on-last-page) sidebar.
 * Asserts the per-page model resolves the three owner concerns:
 *   1. numPages = 2 (engaged — not the natural-flow numPages=1 fallback)
 *   2. sidebar navy shading present on EVERY page (fill to bottom — SIDEBAR-FILL)
 *   3. the AI disclosure lands ONCE, on the LAST page, in the requested column
 *   + labeled_list splits with a "(Cont.)" heading, zero content loss/dup.
 * Run: node test/diag-twocol-ownerlike.mjs */
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
      return method0(buf, p) ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found: ' + name);
}
function method0(buf, p) { return buf.readUInt16LE(p + 10) === 0; }

function topTables(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const tokens = body.match(/<\/?w:(tbl|tc)\b/g) || [];
  let depth = 0, top = 0;
  for (const t of tokens) {
    if (t === '<w:tbl') { if (depth === 0) top++; depth++; }
    else if (t === '</w:tbl') depth--;
    else if (t === '<w:tc') depth++;
    else if (t === '</w:tc') depth--;
  }
  return top;
}
function texts(xml) { return (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean); }

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return Buffer.from(ab);
}

const NAVY = '283556';
const reg = [
  { group: 'Sensing & imaging' },
  { l: 'ISO 12233', v: 'resolution' }, { l: 'ISO 15739', v: 'noise' }, { l: 'EMVA 1288', v: 'sensor' },
  { group: 'Systems & safety' },
  { l: 'ISO 26262', v: 'functional safety' }, { l: 'ASPICE', v: 'process' }, { l: 'SOTIF', v: 'intended' },
];
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: { navy: '#' + NAVY, accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
  ai_wm_side: 'left',   // request the disclosure in the sidebar (left) column
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
    // PB-WORKER-CONT-HEADER-001: outcomes precedes experience so the historic
    // wrong-cont-heading symptom (page-2 main column showing "SELECTED
    // OUTCOMES" above the EXPERIENCE continuation) has the section it used to
    // steal the heading from.
    { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: [{ b: 'Cut', t: 'cycle time 95%' }] },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['did alpha'] },
      { id: 'r2', title: 'Role Two', company: 'C2', years: '2020', bullets: ['did beta'], page: 2 },
    ] },
    // owner's actual sidebar shape: labeled_list with a group divider; item index 4
    // (start of the 2nd group) moves to page 2.
    { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list',
      items: reg.map((it, i) => i === 4 ? { ...it, _page: 2 } : it) },
  ],
};

const buf = await gen(payload);
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
const tt = topTables(xml);
const tx = texts(xml); const joined = tx.join(' | ');
const allRegs = ['ISO 12233', 'ISO 15739', 'EMVA 1288', 'ISO 26262', 'ASPICE', 'SOTIF'].every(r => joined.includes(r));
const allRoles = ['Role One', 'Role Two'].every(r => joined.includes(r));
const dup = ['Role One', 'Role Two', 'ISO 26262'].some(r => tx.filter(t => t.includes(r)).length !== 1);
const hasCont = /REGULATORY CONTEXT \(CONT\.\)/i.test(joined); // 1.14.57: ctx.contSuffix everywhere (en = "(CONT.)")
// AI disclosure: present exactly once, and after the last body-level page break (last page)
const discRe = /AI-assisted/g;
const discCount = (joined.match(discRe) || []).length;
const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
const lastBreak = body.lastIndexOf('pageBreakBefore') >= 0 ? body.lastIndexOf('pageBreakBefore') : body.search(/w:type="page"/);
const discPos = body.indexOf('AI-assisted');
const discOnLastPage = discPos > lastBreak;
// sidebar navy shading: count cell shadings with the navy fill (one sidebar cell per page)
const navyFills = (xml.match(new RegExp('w:fill="' + NAVY + '"', 'gi')) || []).length;
// PB-WORKER-SIDEBAR-FILL-001 (1.14.42): every body row carries an atLeast
// height so the sidebar shading reaches the page bottom.
// PDF-BLANK-PAGE-001 (1.14.54): the minimums dropped to 13260 / PAGE_H-600 =
// 16238 — the old exact-fill values overflowed every LibreOffice sheet by a
// sliver, rendering a BLANK PAGE after each content page in the PDF and
// swallowing the final sidebar lines on page 1. trHeight attr order varies;
// match both.
const trHeights = [...xml.matchAll(/<w:trHeight[^/]*\/>/g)].map(m => m[0]);
const atLeast = trHeights.filter(h => /w:hRule="atLeast"/.test(h));
// PDF-BLANK-PAGE-002 (1.14.83): slack doubled — page1 13260->12600, cont PAGE_H-600(16238)->-1300(15538).
const has13860 = atLeast.some(h => /w:val="12600"/.test(h));
const has16638 = atLeast.some(h => /w:val="15538"/.test(h));
// PB-WORKER-CONT-HEADER-001: split into top-level page tables and assert
// page 2's main column carries EXACTLY ONE experience heading — the
// "PROFESSIONAL EXPERIENCE (Cont.)" continuation — never the historic stray
// "SELECTED OUTCOMES" heading, and never a doubled plain heading.
const tokens2 = [...body.matchAll(/<\/?w:(tbl|tc)\b/g)];
let d2 = 0, s2 = -1; const spans = [];
for (const m of tokens2) {
  const t = m[0];
  if (t === '<w:tbl') { if (d2 === 0) s2 = m.index; d2++; }
  else if (t === '</w:tbl') { d2--; if (d2 === 0) spans.push([s2, m.index]); }
  else if (t === '<w:tc') d2++;
  else if (t === '</w:tc') d2--;
}
const pageTexts = spans.map(([s, e]) => (body.slice(s, e).match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).filter(Boolean));
const p2 = pageTexts[1] || [];
const p2ContCount = p2.filter(t => /^PROFESSIONAL EXPERIENCE \(CONT\.\)$/i.test(t.trim())).length;
const p2PlainHead = p2.filter(t => /^PROFESSIONAL EXPERIENCE$/.test(t.trim())).length;
const p2StrayOutcomes = p2.filter(t => /^SELECTED OUTCOMES/.test(t.trim())).length;
const contHeaderOk = p2ContCount === 1 && p2PlainHead === 0 && p2StrayOutcomes === 0;

log('top-level tables (=pages):', tt);
log('all regs present:', allRegs, '| all roles:', allRoles, '| no dup:', !dup, '| REG (Cont.):', hasCont);
log('AI disclosure count:', discCount, '| on last page:', discOnLastPage);
log('navy fill occurrences (>= pages):', navyFills);
log('atLeast row heights:', atLeast.length, '| page1 13860:', has13860, '| cont 16638:', has16638);
log('p2 EXPERIENCE (Cont.) x' + p2ContCount + ' | p2 plain heading x' + p2PlainHead + ' | p2 stray SELECTED OUTCOMES x' + p2StrayOutcomes + ' -> cont header', contHeaderOk ? 'OK' : 'FAIL');
const ok =
  tt === 2 &&            // per-page engaged (coordinated 2 pages), not numPages=1 natural flow
  allRegs && allRoles && !dup && hasCont &&
  discCount === 1 && discOnLastPage &&   // AI notice once, on the last page (correct column via ai_wm_side)
  navyFills >= 2 &&      // sidebar navy on every page
  atLeast.length >= 2 && has13860 && has16638 && // FILL: rows stretch to the page bottom
  contHeaderOk;          // PB-WORKER-CONT-HEADER-001: one (Cont.) heading, no stray/double
log(ok ? 'TWOCOL-OWNERLIKE OK' : 'TWOCOL-OWNERLIKE FAIL');
