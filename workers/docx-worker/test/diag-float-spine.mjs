/* DIAGNOSTIC — FLOAT-SPINE-001 (register row 3, owner "_3page proper" reference).
 * FLAG-GATED default OFF. With payload float_spine:true the CONTINUATION page
 * tables become floating text-anchored tables and the body sectPr goes
 * continuous, exactly like the owner's hand-edited 3-page reference docx:
 *   - page-1 table: NO <w:tblpPr>
 *   - each continuation table: <w:tblpPr ... w:leftFromText="180"
 *     w:rightFromText="180" w:vertAnchor="text" w:tblpY="1"> + <w:tblOverlap
 *     w:val="never"/>
 *   - body <w:sectPr> carries <w:type w:val="continuous"/>
 *   - pagination itself is UNCHANGED (same tables, same single body break,
 *     no trailing break after the last table)
 * Control (no flag): zero tblpPr, no continuous type. */
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

const mod = await import('../src/index.js');
async function gen(extra) {
  const coreRows = [['Focus', 'Detail']];
  for (let i = 1; i <= 8; i++) coreRows.push(['Comp ' + i, 'Expertise detail number ' + i]);
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Test User', email: 'a@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text here.' },
      { id: 'core', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: coreRows, row_pages: { '5': 2 } },
      { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'list', items: ['ISO 111', 'ISO 222', 'ISO 333'], item_pages: { '2': 2 } },
    ],
    item_pages: { regctx: { '2': 2 } },
    ...extra,
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

// Slice the body into TOP-LEVEL table chunks (depth-tracked, same technique as
// diag-twocol-paged) and return per-table XML plus body-level break count.
function topTables(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const re = /<w:tbl>|<\/w:tbl>|<w:tc>|<\/w:tc>|<w:pageBreakBefore\b/g;
  let depth = 0, m, start = -1, breaks = 0, lastEnd = -1;
  const tables = [];
  while ((m = re.exec(body))) {
    const t = m[0];
    if (t === '<w:tbl>') { if (depth === 0) start = m.index; depth++; }
    else if (t === '</w:tbl>') { depth--; if (depth === 0) { tables.push(body.slice(start, m.index)); lastEnd = m.index; } }
    else if (t === '<w:tc>') depth++;
    else if (t === '</w:tc>') depth--;
    else if (depth === 0) breaks++;
  }
  const tail = lastEnd >= 0 ? body.slice(lastEnd) : '';
  return { tables, breaks, trailingBreak: /<w:pageBreakBefore\b/.test(tail) };
}

const on = await gen({ float_spine: true });
const off = await gen({});

const sOn = topTables(on), sOff = topTables(off);
const floatTag = (t) => (t.match(/<w:tblpPr[^>]*>/) || [''])[0];
const p1 = sOn.tables[0] || '', cont = sOn.tables.slice(1);

const paged = sOn.tables.length === 2 && sOn.breaks === 1 && !sOn.trailingBreak;
const p1Inline = !/<w:tblpPr/.test(p1);
const contFloated = cont.length > 0 && cont.every((t) => {
  const tag = floatTag(t);
  return /w:vertAnchor="text"/.test(tag) && /w:tblpY="1"/.test(tag) &&
    /w:leftFromText="180"/.test(tag) && /w:rightFromText="180"/.test(tag) &&
    /<w:tblOverlap w:val="never"\/>/.test(t);
});
const sectCont = /<w:type w:val="continuous"\/>/.test(on.slice(on.lastIndexOf('<w:sectPr')));
const offClean = !/<w:tblpPr/.test(off) && !/<w:type w:val="continuous"\/>/.test(off) &&
  sOff.tables.length === 2 && sOff.breaks === 1;

log('flag ON: 2 pages + 1 break + no trailing break:', paged, '| page-1 inline:', p1Inline);
log('flag ON: continuation tables floated (tblpPr text/1 + 180/180 + overlap never):', contFloated);
log('flag ON: body sectPr continuous:', sectCont);
log('control OFF unchanged (no tblpPr, no continuous, same pagination):', offClean);
const ok = paged && p1Inline && contFloated && sectCont && offClean;
log(ok ? 'FLOAT-SPINE OK' : 'FLOAT-SPINE FAIL');
process.exit(ok ? 0 : 1);
