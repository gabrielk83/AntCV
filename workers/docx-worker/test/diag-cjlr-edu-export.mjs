/* DIAGNOSTIC — EDU-ROW-CJLR-EXPORT-001 (worker 1.14.160). Per-row EDUCATION /
 * RECOMMENDATIONS CJLR export parity with the PWA preview (1.51.1424-edu-row-cjlr).
 * Drives /generate in node and asserts document.xml jc for education rows keyed by
 * item_alignment["items.N.deg"] / ["items.N"], and that __group__ does NOT move
 * education rows (GROUP-CJLR-SCOPE-001). Run: node test/diag-cjlr-edu-export.mjs */
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
  throw new Error('entry not found: ' + name);
}

const mod = await import('../src/index.js');
async function gen(extra) {
  const base = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
  };
  const payload = { ...base, ...extra };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200) throw new Error('status ' + res.status + ' ' + buf.toString().slice(0, 200));
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}

function jcOf(xml, text) {
  const i = xml.indexOf(text);
  if (i < 0) return 'NOT FOUND';
  let ps = xml.lastIndexOf('<w:p>', i);
  const psAttr = xml.lastIndexOf('<w:p ', i);
  if (psAttr > ps) ps = psAttr;
  const m = xml.slice(ps, i).match(/<w:jc w:val="(\w+)"\/>/);
  return m ? m[1] : 'none';
}

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  [' + detail + ']' : '')); }

// distinct degrees so the eduKey dedup never collapses a row
const items = () => [
  { deg: 'DEGALPHA', sch: 'SchoolAlpha' },
  { deg: 'DEGBETA', sch: 'SchoolBeta' },
  { deg: 'DEGGAMMA', sch: 'SchoolGamma' },
];

// ─── per-row education CJLR: items.N.deg and items.N both move THAT row only ───
{
  const xml = await gen({ sections: [
    { id: 'education', title: 'EDUCATION', loc: 'main', on: true, type: 'education',
      item_alignment: { 'items.1.deg': 'center', 'items.2': 'right' }, items: items() },
  ] });
  check('edu row 0 (no override) -> default LEFT (no jc)', jcOf(xml, 'DEGALPHA') === 'none', 'jc=' + jcOf(xml, 'DEGALPHA'));
  check('edu row 1 items.1.deg=center -> center', jcOf(xml, 'DEGBETA') === 'center', 'jc=' + jcOf(xml, 'DEGBETA'));
  check('edu row 2 items.2=right -> right', jcOf(xml, 'DEGGAMMA') === 'right', 'jc=' + jcOf(xml, 'DEGGAMMA'));
}

// ─── explicit per-row 'left' emits jc=left (distinct from default 'none') ───
{
  const xml = await gen({ sections: [
    { id: 'education', title: 'EDUCATION', loc: 'main', on: true, type: 'education',
      item_alignment: { 'items.0.deg': 'left' }, items: items() },
  ] });
  check('edu row 0 items.0.deg=left -> explicit left', jcOf(xml, 'DEGALPHA') === 'left', 'jc=' + jcOf(xml, 'DEGALPHA'));
}

// ─── RECOMMENDATIONS shares the education renderer — per-row CJLR works there too ───
{
  const xml = await gen({ sections: [
    { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'main', on: true, type: 'education',
      item_alignment: { 'items.1.deg': 'right' }, items: items() },
  ] });
  check('recommendations row 1 items.1.deg=right -> right', jcOf(xml, 'DEGBETA') === 'right', 'jc=' + jcOf(xml, 'DEGBETA'));
}

// ─── GROUP-CJLR-SCOPE: __group__ must NOT move education rows (parity w/ preview) ───
{
  const xml = await gen({ sections: [
    { id: 'education', title: 'EDUCATION', loc: 'main', on: true, type: 'education',
      item_alignment: { '__group__': 'right' }, items: items() },
  ] });
  check('__group__=right does NOT move edu row 0 (stays LEFT)', jcOf(xml, 'DEGALPHA') === 'none', 'jc=' + jcOf(xml, 'DEGALPHA'));
  check('__group__=right does NOT move edu row 1 (stays LEFT)', jcOf(xml, 'DEGBETA') === 'none', 'jc=' + jcOf(xml, 'DEGBETA'));
}

// ─── byte-identical control: no item_alignment at all -> every row default (no jc) ───
{
  const xml = await gen({ sections: [
    { id: 'education', title: 'EDUCATION', loc: 'main', on: true, type: 'education', items: items() },
  ] });
  check('no alignment -> row 0 default (no jc)', jcOf(xml, 'DEGALPHA') === 'none', 'jc=' + jcOf(xml, 'DEGALPHA'));
  check('no alignment -> row 1 default (no jc)', jcOf(xml, 'DEGBETA') === 'none', 'jc=' + jcOf(xml, 'DEGBETA'));
  check('no alignment -> row 2 default (no jc)', jcOf(xml, 'DEGGAMMA') === 'none', 'jc=' + jcOf(xml, 'DEGGAMMA'));
}

const fails = results.filter((r) => !r.ok);
log('');
log(fails.length === 0 ? ('ALL ' + results.length + ' CHECKS PASS — CJLR-EDU-EXPORT OK') : (fails.length + '/' + results.length + ' CHECKS FAIL'));
process.exit(fails.length === 0 ? 0 : 1);
