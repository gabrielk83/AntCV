/* DIAGNOSTIC — indent-controls export parity (1.14.47). Drives the live
 * worker fetch handler twice:
 *   default  -> main bullet numbering indents 210/210 DXA (14px) and main
 *               cell edge margins 150 DXA (10px, matching the preview's
 *               default "8px 10px" main padding);
 *   custom   -> style {bulletIndent:24, mainEdgeIndent:20} lands as 360/360
 *               numbering indents and 300 DXA cell margins (px x 15).
 * Run: node test/diag-indent-parity.mjs */
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
async function gen(style) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E', ...style },
    font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
      { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: [{ b: 'Cut', t: 'cycle time 95%' }, { b: 'Built', t: 'the test bench' }] },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return Buffer.from(ab);
}

function probe(buf) {
  const numbering = unzipEntry(buf, 'word/numbering.xml').toString('utf8');
  const doc = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const inds = [...numbering.matchAll(/<w:ind w:left="(\d+)" w:hanging="(\d+)"\/>/g)]
    .map((m) => m[1] + '/' + m[2]);
  const tcLefts = [...doc.matchAll(/<w:left w:type="dxa" w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
  return { inds, tcLefts };
}

const def = probe(await gen({}));
const cus = probe(await gen({ bulletIndent: 24, mainEdgeIndent: 20 }));

log('default numbering inds:', def.inds.join(','), '| tcMar lefts:', [...new Set(def.tcLefts)].join(','));
log('custom  numbering inds:', cus.inds.join(','), '| tcMar lefts:', [...new Set(cus.tcLefts)].join(','));

const defOk = def.inds.includes('210/210') && def.tcLefts.includes(150);
const cusOk = cus.inds.includes('360/360') && cus.tcLefts.includes(300) && !cus.tcLefts.includes(150);
const noLeak = !cus.inds.includes('210/210') || cus.inds.filter((x) => x === '210/210').length < cus.inds.length;
log('default 210/210 + edge 150:', defOk, '| custom 360/360 + edge 300:', cusOk);
const ok = defOk && cusOk && noLeak;
log(ok ? 'INDENT-PARITY OK' : 'INDENT-PARITY FAIL');
process.exit(ok ? 0 : 1);
