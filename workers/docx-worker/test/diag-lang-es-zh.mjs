/* DIAGNOSTIC — LANG-ES-ZH-001 (worker 1.14.57). The export accepts the full
 * UI language set (the writing engine + PWA supported en/da/es/zh; the worker
 * 422'd everything but en|da, so es/zh users always got English exports):
 *   1. es CL → 200, "Atentamente," closing + "Tu nombre" placeholder;
 *   2. zh CL → 200, "此致敬礼，" closing + "姓名" placeholder;
 *   3. zh CV with a page-2 sidebar item → "（续）" continuation suffix;
 *   4. unknown language still 422s;
 *   5. /schema enum advertises all four.
 */
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
  return null;
}

const mod = await import('../src/index.js');
const ctxStub = { waitUntil() {}, passThroughOnException() {} };
async function gen(lang, doc = 'cl', extraSections = null) {
  const payload = {
    schema_version: '1.0', doc, language: lang, layout: doc === 'cl' ? 'linear' : 'two_column', filename: 't',
    personal_info: { email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
    sections: extraSections || [{ id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'Texto.' }],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, ctxStub);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, xml: res.status === 200 ? unzipEntry(buf, 'word/document.xml').toString('utf8') : buf.toString().slice(0, 200) };
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

{
  const { status, xml } = await gen('es');
  check('es CL 200 + Atentamente + Tu nombre', status === 200 && xml.includes('Atentamente,') && xml.includes('Tu nombre'), 'status ' + status);
}
{
  const { status, xml } = await gen('zh');
  check('zh CL 200 + 此致敬礼 + 姓名', status === 200 && xml.includes('此致敬礼，') && xml.includes('姓名'), 'status ' + status);
}
{
  const reg = [{ group: 'G0' }, { l: 'R0', v: 'Line' }, { l: 'R1', v: 'Cont line', _page: 2 }];
  const secs = [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Texto.' },
    { id: 'regctx', title: 'REGULATORY', loc: 'sidebar', on: true, type: 'labeled_list', items: reg },
  ];
  const { status, xml } = await gen('zh', 'cv', secs);
  check('zh CV continuation suffix （续）', status === 200 && xml.includes('（续）'), 'status ' + status);
}
{
  const { status } = await gen('fr');
  check('unknown language still 422s', status === 422, '');
}
{
  const res = await mod.default.fetch(new Request('https://x/schema'), {}, ctxStub);
  const txt = await res.text();
  check('/schema advertises en,da,es,zh', txt.includes('"es"') && txt.includes('"zh"'), '');
}

const ok = checks.every(Boolean);
log(ok ? 'LANG-ES-ZH OK' : 'LANG-ES-ZH FAIL');
process.exit(ok ? 0 : 1);
