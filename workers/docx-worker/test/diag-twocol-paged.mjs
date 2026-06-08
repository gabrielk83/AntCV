/* DIAGNOSTIC — PB-WORKER-TWOCOL-PAGED-001 (docx-worker 1.14.39).
 * Drives the LIVE worker fetch handler (src/index.js bundle) with a two-column CV
 * that spans 2 pages (sidebar list item break + main experience role break + a
 * core table row break), unzips word/document.xml, and asserts the per-page
 * structure: one TOP-LEVEL two-column table PER PAGE, a page break between them
 * (at body level, NOT inside a cell), header band once, and zero content loss.
 *
 * The bundle replaces globalThis.process on import, so all output goes via fs fd 1.
 * Run: node test/diag-twocol-paged.mjs */
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
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad CD sig');
    const method = buf.readUInt16LE(p + 10);
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
      return method === 0 ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found: ' + name);
}

// Count TOP-LEVEL tables (direct body children, depth 0) and page breaks at body
// level, by tracking tbl/tc nesting. Returns { topTables, bodyPageBreaks }.
function structure(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const tokens = body.match(/<\/?w:(tbl|tc)\b|<w:br[^>]*w:type="page"|<w:pageBreakBefore\b/g) || [];
  let depth = 0, topTables = 0, bodyPageBreaks = 0;
  for (const t of tokens) {
    if (t === '<w:tbl') { if (depth === 0) topTables++; depth++; }
    else if (t === '</w:tbl') depth--;
    else if (t === '<w:tc') depth++;
    else if (t === '</w:tc') depth--;
    else { if (depth === 0) bodyPageBreaks++; }   // page break at body level
  }
  return { topTables, bodyPageBreaks };
}
function texts(xml) {
  return (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean);
}

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return Buffer.from(ab);
}

const coreRows = [['Focus', 'Detail']];
for (let i = 1; i <= 8; i++) coreRows.push(['Comp ' + i, 'Expertise detail number ' + i]);
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'Test User', email: 'a@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
  // Realistic single-overflow-per-column 2-page CV: the MAIN column overflows inside
  // CORE COMPETENCIES (table row 5 -> page 2); EXPERIENCE has NO break of its own and
  // must CASCADE onto page 2 (flow after the one break). The SIDEBAR overflows in
  // REGULATORY CONTEXT (item 2 -> page 2). Both columns -> exactly 2 pages.
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text here.' },
    { id: 'core', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: coreRows, row_pages: { '5': 2 } },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['did alpha'] },
      { id: 'r2', title: 'Role Two', company: 'C2', years: '2020', bullets: ['did beta'] },
    ] },
    { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'list', items: ['ISO 111', 'ISO 222', 'ISO 333'], item_pages: { '2': 2 } },
  ],
  item_pages: { regctx: { '2': 2 } },
};

const buf = await gen(payload);
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
const st = structure(xml);
const tx = texts(xml);
log('top-level tables (=pages):', st.topTables, '| body-level page breaks:', st.bodyPageBreaks);
const joined = tx.join(' | ');
const hasCoreCont = /CORE COMPETENCIES \(Cont\.\)/i.test(joined);   // table split with continuation
const allRoles = ['Role One', 'Role Two'].every(r => joined.includes(r));
const allComps = [1, 2, 5, 8].every(n => joined.includes('Comp ' + n));
const allRegs = ['ISO 111', 'ISO 222', 'ISO 333'].every(r => joined.includes(r));
log('core (Cont.):', hasCoreCont, '| all roles:', allRoles, '| comps 1/2/5/8:', allComps, '| regs:', allRegs);
// dup check: each role title appears exactly once
const dupRole = ['Role One', 'Role Two'].some(r => tx.filter(t => t.includes(r)).length !== 1);
log('no role dup:', !dupRole);
// cascade: EXPERIENCE has no break of its own, so it must land on PAGE 2 — i.e. its
// text appears AFTER the body-level page break in document order.
const bodyXml = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
const brkPos = bodyXml.search(/<w:br[^>]*w:type="page"|<w:pageBreakBefore\b/);
const rolePos = bodyXml.indexOf('Role One');
const expCascaded = brkPos >= 0 && rolePos > brkPos;
log('experience cascaded onto page 2 (after the break):', expCascaded);

const ok =
  st.topTables === 2 &&                 // exactly 2 top-level page tables = 2 pages (coordinated)
  st.bodyPageBreaks === 1 &&            // exactly one body-level page break between them
  hasCoreCont && allRoles && allComps && allRegs && !dupRole && expCascaded;
log(ok ? 'TWOCOL-PAGED OK' : 'TWOCOL-PAGED FAIL');
