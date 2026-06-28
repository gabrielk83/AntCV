/* DIAGNOSTIC — RICH-BLOCK-MIDSECTION-SPLIT-001 (docx-worker 1.14.90).
 * A SIDEBAR rich_block (REGULATORY CONTEXT) with multiple {grp} groups that spans
 * pages used to emit its per-row break INSIDE the section-wrapper body cell, which
 * splitChildrenByPage (top-level only) ignores — so the page-2 group header + rows
 * stayed trapped on page 1 (owner's orphaned "Environmental, Durability & Compliance"
 * + a value split mid-sentence). The fix chunks the rich_block into TOP-LEVEL page
 * segments by row_pages.
 *
 * Proof (structural, render-independent):
 *  CONTROL  (row_pages {}):   exactly 1 top-level page table (no spurious break).
 *  MIDSPLIT (row_pages {9:2}): exactly 2 top-level page tables + a body-level page
 *    break; the page-2 group header AND its first row appear AFTER the break,
 *    together (header rides with its rows); the long value is present intact; a
 *    "(CONT.)" continuation heading appears; no content loss.
 *
 * The bundle replaces globalThis.process on import, so output goes via fs fd 1.
 * Run: node test/diag-richblock-midsplit.mjs */
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
// Count TOP-LEVEL tables (=pages) and body-level page breaks (tracks tbl/tc nesting).
function structure(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const tokens = body.match(/<\/?w:(tbl|tc)\b|<w:br[^>]*w:type="page"|<w:pageBreakBefore\b/g) || [];
  let depth = 0, topTables = 0, bodyPageBreaks = 0;
  for (const t of tokens) {
    if (t === '<w:tbl') { if (depth === 0) topTables++; depth++; }
    else if (t === '</w:tbl') depth--;
    else if (t === '<w:tc') depth++;
    else if (t === '</w:tc') depth--;
    else { if (depth === 0) bodyPageBreaks++; }
  }
  return { topTables, bodyPageBreaks };
}
const texts = (xml) => (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean);

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return Buffer.from(ab);
}

const MILSTD = 'Environmental qualification, including Method 514 vibration';
const regItems = [
  { grp: true, t: 'Systems, Safety & Cybersecurity' },               // 0
  { b: 'STANAG 4355', t: 'Ballistics / fire-control context' },      // 1
  { b: 'DO-178C', t: 'Airborne software' },                          // 2
  { b: 'DO-254', t: 'Airborne hardware' },                           // 3
  { grp: true, t: 'Electrical & EMC' },                              // 4
  { b: 'CISPR 25', t: 'EMC emissions' },                             // 5
  { b: 'ISO 11452', t: 'EMC immunity' },                             // 6
  { b: 'DIN EN 61010', t: 'Electrical safety, lab & measurement equipment' }, // 7
  { b: 'IEC 60529', t: 'Ingress protection' },                       // 8
  { grp: true, t: 'Environmental, Durability & Compliance' },        // 9  <- break to page 2
  { b: 'MIL-STD-810G', t: MILSTD },                                  // 10
  { b: 'ISO 16750', t: 'Automotive environmental conditions and testing' }, // 11
  { b: 'IEC 60068', t: 'Environmental testing' },                    // 12
  { b: 'RoHS', t: 'Restricted substances' },                         // 13
  { b: 'REACH', t: 'Chemical substances compliance' },              // 14
];
function payload(rowPages) {
  return {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Test User', email: 'a@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Short profile.' },
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
        { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['did alpha'] },
      ] },
      { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'rich_block', items: regItems, row_pages: rowPages },
    ],
  };
}

// --- CONTROL: no break -> 1 page, no spurious split ---
const ctlXml = unzipEntry(await gen(payload({})), 'word/document.xml').toString('utf8');
const ctl = structure(ctlXml);
log('CONTROL (row_pages {}): top-level page tables =', ctl.topTables, '(expect 1) | body breaks =', ctl.bodyPageBreaks, '(expect 0)');

// --- MIDSPLIT: break the Environmental group (index 9) to page 2 ---
const xml = unzipEntry(await gen(payload({ '9': 2 })), 'word/document.xml').toString('utf8');
const st = structure(xml);
const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
const brkPos = body.search(/<w:br[^>]*w:type="page"|<w:pageBreakBefore\b/);
const posOf = (s) => body.indexOf(s);
const tx = texts(xml).join(' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// NOTE: search raw XML by ASCII-only tokens — the body encodes '&' as '&amp;',
// so 'Environmental, Durability & Compliance' would never indexOf-match. 'Durability'
// is unique to the Environmental group header; 'STANAG'/'CISPR' are page-1 rows.
const page1GroupBeforeBreak = brkPos >= 0 && posOf('STANAG 4355') >= 0 && posOf('STANAG 4355') < brkPos && posOf('CISPR 25') >= 0 && posOf('CISPR 25') < brkPos;
const envHdrAfterBreak = brkPos >= 0 && posOf('Durability') > brkPos;
const milstdAfterBreak  = brkPos >= 0 && posOf('MIL-STD-810G') > brkPos;
const headerRidesWithRow = posOf('Durability') >= 0 && posOf('Durability') < posOf('MIL-STD-810G'); // header before its first row
const valueIntact = tx.includes('MIL-STD-810G : ' + MILSTD) || tx.includes('MIL-STD-810G ' + MILSTD) || tx.includes(MILSTD);
const contHeading = /REGULATORY CONTEXT \(CONT/i.test(tx);
const noLoss = ['STANAG 4355', 'CISPR 25', 'ISO 16750', 'REACH', MILSTD].every((s) => tx.includes(s));
// each group header appears exactly once (no in-cell duplicate)
const envHdrOnce = (tx.match(/Environmental, Durability & Compliance/g) || []).length === 1;

log('MIDSPLIT (row_pages {9:2}): top-level page tables =', st.topTables, '(expect 2) | body breaks =', st.bodyPageBreaks, '(expect >=1)');
log('  page-1 groups before break:', page1GroupBeforeBreak);
log('  Environmental header after break (rode to page 2):', envHdrAfterBreak);
log('  MIL-STD row after break:', milstdAfterBreak, '| header rides with its row:', headerRidesWithRow);
log('  long value intact:', valueIntact, '| env header appears once:', envHdrOnce);
log('  (CONT.) continuation heading:', contHeading, '| no content loss:', noLoss);

const ok =
  ctl.topTables === 1 && ctl.bodyPageBreaks === 0 &&
  st.topTables === 2 && st.bodyPageBreaks >= 1 &&
  page1GroupBeforeBreak && envHdrAfterBreak && milstdAfterBreak &&
  headerRidesWithRow && valueIntact && envHdrOnce && contHeading && noLoss;
log(ok ? '\nRICHBLOCK-MIDSPLIT OK' : '\nRICHBLOCK-MIDSPLIT FAIL');
process.exit(ok ? 0 : 1);
