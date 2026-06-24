/* DIAGNOSTIC — BALANCE-OVERFLOW-001 (docx-worker). When the SIDEBAR paginates
 * deeper than the MAIN, style.balanceOverflow re-flows the overflow sidebar as ONE
 * FULL-WIDTH navy table (natural flow) instead of [sidebar | EMPTY main] pages.
 * Drives the live worker with a sidebar deeper than the main (sidebar items on
 * pages 1-3, main roles on pages 1-2), once WITHOUT the flag and once WITH it, and
 * asserts: (off) the overflow slot renders a 2-cell body row (sidebar+empty main);
 * (on) the overflow renders a FULL-WIDTH 1-cell table, content preserved, the
 * two-column main slots kept, and the AI disclosure present once. Run: node test/diag-balance-overflow.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdOffset = buf.readUInt32LE(i + 16), nEntries = buf.readUInt16LE(i + 10); let p = cdOffset;
  for (let e = 0; e < nEntries; e++) {
    const compSize = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const ename = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (ename === name) { const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE; const comp = buf.slice(ds, ds + compSize); return buf.readUInt16LE(p + 10) === 0 ? comp : inflateRawSync(comp); }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('no ' + name);
}
function topTableSpans(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const toks = [...body.matchAll(/<\/?w:(tbl|tc)\b/g)]; let d = 0, s = -1; const spans = [];
  for (const m of toks) { const t = m[0]; if (t === '<w:tbl') { if (d === 0) s = m.index; d++; } else if (t === '</w:tbl') { d--; if (d === 0) spans.push([s, m.index]); } else if (t === '<w:tc') d++; else if (t === '</w:tc') d--; }
  return spans.map(([a, b]) => body.slice(a, b));
}
function topLevelCellCount(tblXml) { // count w:tc at depth 1 (direct cells, not nested)
  const toks = [...tblXml.matchAll(/<\/?w:(tbl|tc)\b/g)]; let d = 0, n = 0;
  for (const m of toks) { const t = m[0]; if (t === '<w:tbl') d++; else if (t === '</w:tbl') d--; else if (t === '<w:tc') { if (d === 1) n++; d++; } else if (t === '</w:tc') d--; }
  return n;
}
const texts = xml => (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean);
const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer(); if (res.status !== 200) throw new Error('status ' + res.status + ' ' + Buffer.from(ab).toString().slice(0, 200));
  return Buffer.from(ab);
}
// sidebar deeper (items on pages 1,2,3) than main (roles on pages 1,2)
const sidebarItems = [];
for (let i = 0; i < 12; i++) sidebarItems.push(i === 4 ? { l: 'SB' + i, v: 'val' + i, _page: 2 } : i === 8 ? { l: 'SB' + i, v: 'val' + i, _page: 3 } : { l: 'SB' + i, v: 'val' + i });
function payload(flag) {
  return {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'S', role: 'R' },
    style: Object.assign({ navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, flag ? { balanceOverflow: true } : {}),
    sections: [
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
        { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['alpha'] },
        { id: 'r2', title: 'Role Two', company: 'C2', years: '2020', bullets: ['beta'], page: 2 },
      ] },
      { id: 'reg', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: sidebarItems },
    ],
  };
}
const off = unzipEntry(await gen(payload(false)), 'word/document.xml').toString('utf8');
const on = unzipEntry(await gen(payload(true)), 'word/document.xml').toString('utf8');
const offTbls = topTableSpans(off), onTbls = topTableSpans(on);
const offLastCells = topLevelCellCount(offTbls[offTbls.length - 1] || '');
const onLastCells = topLevelCellCount(onTbls[onTbls.length - 1] || '');
const onText = texts(on).join(' | ');
const allSb = sidebarItems.map(it => it.l).every(l => onText.includes(l));
const wmOn = (onText.match(/AI-assisted/g) || []).length;
const offHasMultiCellLast = offLastCells >= 2; // off: overflow slot is 2-col (sidebar+empty main)
const onLastFullWidth = onLastCells === 1;      // on: overflow is one full-width cell
log('OFF: top tables', offTbls.length, '| last-table top-cells', offLastCells, '(expect >=2, two-column)');
log('ON : top tables', onTbls.length, '| last-table top-cells', onLastCells, '(expect 1, full-width overflow)');
log('ON : all sidebar items present', allSb, '| AI disclosure x' + wmOn);
const ok = offHasMultiCellLast && onLastFullWidth && allSb && wmOn === 1;
log(ok ? 'BALANCE-OVERFLOW OK' : 'BALANCE-OVERFLOW FAIL');
process.exit(ok ? 0 : 1);
