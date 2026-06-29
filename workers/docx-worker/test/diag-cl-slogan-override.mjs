/* DIAGNOSTIC — CL slogan EDITABLE override (SLOGAN-CL-EDIT-001, owner 2026-06-29).
 * The slogan now reads meta.slogan / slogan_hidden / slogan_align (forwarded from the client's
 * standalone keys), falling back to meta.subtitle when no override is set. Asserts:
 *   A. an override (meta.slogan) renders INSTEAD of the subtitle, uppercased, before the greeting
 *   B. slogan_hidden:true drops the slogan entirely (no uppercased tagline in the body)
 *   C. slogan_align:'left' emits a left-aligned slogan paragraph (default is center)
 * Run: node test/diag-cl-slogan-override.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdo = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cdo;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const en = buf.toString('utf8', p + 46, p + 46 + nl);
    if (en === name) { const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28), ds = lho + 30 + lnl + lel; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); }
    p += 46 + nl + el + cl;
  }
  throw new Error('no ' + name);
}
const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 200));
  return Buffer.from(ab);
}
function base(meta) {
  return {
    schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' },
    meta: Object.assign({ subtitle: 'Processes | Products | People', role: 'PM', company: 'X' }, meta),
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' },
      { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'text', content: 'Opening paragraph here.' },
    ],
  };
}
async function bodyXml(meta) {
  const full = unzip(await gen(base(meta)), 'word/document.xml').toString('utf8');
  return full.slice(full.indexOf('<w:body'));
}

// A. override replaces the subtitle
const xmlA = await bodyXml({ slogan: 'Custom One | Custom Two' });
const ovPos = xmlA.indexOf('CUSTOM ONE');
const greetA = xmlA.indexOf('Dear Hiring');
const A = ovPos >= 0 && xmlA.includes('CUSTOM TWO') && greetA > 0 && ovPos < greetA && !xmlA.includes('PROCESSES');
log('A override@' + ovPos + ' greet@' + greetA + ' subtitleLeaked=' + xmlA.includes('PROCESSES'));

// B. hidden drops the slogan
const xmlB = await bodyXml({ slogan_hidden: true });
const B = !xmlB.includes('PROCESSES') && !xmlB.includes('CUSTOM ONE');
log('B hiddenSlogan absent=' + B);

// C. align left
const xmlC = await bodyXml({ slogan_align: 'left' });
const cPos = xmlC.indexOf('PROCESSES');
const jcBefore = xmlC.lastIndexOf('<w:jc w:val="', cPos);
const jcVal = jcBefore >= 0 ? xmlC.slice(jcBefore + 13, jcBefore + 25) : '';
const C = cPos >= 0 && jcVal.startsWith('left');
log('C slogan@' + cPos + ' nearest jc=' + jcVal.split('"')[0]);

log(`CHECK A (override replaces subtitle, before greeting): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (slogan_hidden drops the tagline): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (slogan_align:left -> left-aligned paragraph): ${C ? 'PASS' : 'FAIL'}`);
const ok = A && B && C;
log(ok ? 'CL-SLOGAN-OVERRIDE OK (3/3)' : 'CL-SLOGAN-OVERRIDE FAIL');
process.exitCode = ok ? 0 : 1;
