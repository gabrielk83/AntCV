/* DIAGNOSTIC — PREVIEW-PDF-GEOMETRY-001 (owner 2026-06-10). The CV preview
 * renders the core-competency table full main-column width, left-aligned, flush
 * with the body text; the worker used mainW-640 centered (narrower + inset),
 * which wrapped more, ran taller, and shifted the page-1 break vs the preview
 * measurer → "page slide". Worker 1.14.43: CV table = mainW-288 (full content
 * width), LEFT-aligned; CL stays 0.8-width CENTERED. Generates a CV and a CL
 * with a competency table and asserts the table width + alignment.
 * Run: node test/diag-cv-table-width.mjs */
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
      return (buf.readUInt16LE(p + 10) === 0) ? comp : inflateRawSync(comp);
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
  if (res.status !== 200) throw new Error('status ' + res.status);
  return Buffer.from(ab);
}

const competency = {
  id: 'comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
  rows: [['Area', 'Detail'], ['Optics', 'Electro-optics, single-photon detection, LiDAR, SPAD/SiPM/TCSPC across many wrapped words to force width-dependent wrapping'], ['Systems', 'Architecture, requirements, traceability, ASPICE, ISO 26262']],
};
function payload(doc) {
  return {
    schema_version: '1.0', doc, language: 'en', layout: doc === 'cl' ? 'linear' : 'two_column', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
    sections: doc === 'cl'
      ? [{ id: 'greeting', title: '', loc: 'main', on: true, type: 'text', text: 'Dear Team,' }, competency]
      : [{ id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' }, competency],
  };
}

// The competency table is NESTED inside the outer two-column page-layout table
// (width = PAGE_W 11906). Scan every <w:tbl>, read its tblPr (tblW + jc), and
// return the inner one — the table whose width is < PAGE_W (the page table is
// always exactly PAGE_W). Returns {width, jc}.
const PAGE_W = 11906;
function innerTable(xml) {
  const tbls = [];
  let from = 0;
  while (true) {
    const s = xml.indexOf('<w:tbl>', from);
    if (s < 0) break;
    const prEnd = xml.indexOf('</w:tblPr>', s);
    const tblPr = xml.slice(s, prEnd < 0 ? s + 400 : prEnd);
    const wM = /<w:tblW[^>]*w:w="(\d+)"/.exec(tblPr);
    const jcM = /<w:jc[^>]*w:val="(\w+)"/.exec(tblPr);
    tbls.push({ width: wM ? Number(wM[1]) : null, jc: jcM ? jcM[1] : null });
    from = s + 7;
  }
  // inner = first table whose width is set and < PAGE_W
  return tbls.find(t => t.width != null && t.width < PAGE_W) || tbls[tbls.length - 1] || { width: null, jc: null };
}
const firstTable = innerTable;

const cvXml = unzipEntry(await gen(payload('cv')), 'word/document.xml').toString('utf8');
const clXml = unzipEntry(await gen(payload('cl')), 'word/document.xml').toString('utf8');
const cv = firstTable(cvXml);
const cl = firstTable(clXml);

// mainW for a default two-column split: PAGE_W 11906; sidebar ratio ~0.34 →
// mainW ~7800-7900. Full content width = mainW-288 ~7500-7600. We assert the
// CV table is LEFT and WIDE (> mainW-640 would have been), and CL is CENTER + narrower.
log('CV table:', JSON.stringify(cv), '| CL table:', JSON.stringify(cl));
// mainW for the default split ≈ 7977 DXA → full content width (mainW-288) ≈
// 7689; the OLD inset width (mainW-640) ≈ 7337. So the new CV table must be
// > 7400 (clearly the full content width, not the old narrow inset). (CL is a
// LINEAR doc — its 0.8-width table spans the full page, so it's wider than the
// CV main-column table; a CV-vs-CL width comparison is not meaningful.)
const A = cv.jc === 'left';
const B = cl.jc === 'center';
const C = cv.width != null && cv.width > 7400;
const D = cl.width != null && cl.width < PAGE_W && cl.width > 7400; // CL stays inset (0.8), not edge-to-edge
log(`CHECK A (CV competency table LEFT-aligned): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (CL table stays CENTER): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (CV table = full main-column width, not the old narrow inset): ${C ? 'PASS' : 'FAIL'}`);
log(`CHECK D (CL table still inset 0.8-width, not edge-to-edge): ${D ? 'PASS' : 'FAIL'}`);
// TABLE-WRAP-PARITY-001 (1.14.49, measured against the preview at 100% A4):
// Focus Area ratio 0.30 of the table, cell margins 90 DXA (6px), and the
// expertise DATA cells LEFT-aligned (no justified rivers; same wrap as the
// preview).
// several two-col grids exist (the page sidebar/main grid sums to PAGE_W);
// the competency table's grid is the one summing to the inner table width.
const grids = [...cvXml.matchAll(/<w:gridCol w:w="(\d+)"\/><w:gridCol w:w="(\d+)"\/>/g)]
  .map((m) => [Number(m[1]), Number(m[2])]);
const compGrid = grids.find(([a, b]) => Math.abs(a + b - cv.width) <= 2);
const ratio = compGrid ? compGrid[0] / (compGrid[0] + compGrid[1]) : null;
const E = ratio != null && Math.abs(ratio - 0.30) < 0.005;
const F = /<w:left w:type="dxa" w:w="90"\/>/.test(cvXml);
const G = !/<w:jc w:val="both"\/>/.test(cvXml.slice(cvXml.indexOf('Strategic Expertise')));
log(`CHECK E (Focus Area ratio 0.30, got ${ratio == null ? 'n/a' : ratio.toFixed(3)}): ${E ? 'PASS' : 'FAIL'}`);
log(`CHECK F (cell margins 90 DXA = preview 6px): ${F ? 'PASS' : 'FAIL'}`);
log(`CHECK G (expertise cells not justified): ${G ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && E && F && G;
log(ok ? 'CV-TABLE-WIDTH OK (7/7)' : 'CV-TABLE-WIDTH FAIL');
process.exitCode = ok ? 0 : 1;
