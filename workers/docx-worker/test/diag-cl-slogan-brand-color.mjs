/* DIAGNOSTIC — CL slogan BRAND colour (SLOGAN-BRAND-COLOR-001, owner 2026-07-14).
 * The exported slogan follows the brand slogan colour forwarded as meta.slogan_color
 * (the SAME source the preview's var(--brand-slogan-color) reads), falling back to the
 * package head colour (teal) when absent, and NEVER shipping an unreadable colour on the
 * white page (contrast-guarded, STANDING accessibility rule). Asserts:
 *   A. a readable brand colour (dark magenta) renders as-is on the slogan run
 *   B. NO slogan_color -> the run keeps the package default head colour (differs from A)
 *   C. a too-light brand colour (yellow) is DARKENED to clear >=3:1 contrast vs white
 * Run: node test/diag-cl-slogan-brand-color.mjs */
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
async function sloganColor(meta) {
  const full = unzip(await gen(base(meta)), 'word/document.xml').toString('utf8');
  const body = full.slice(full.indexOf('<w:body'));
  const pos = body.indexOf('PROCESSES');
  if (pos < 0) return null;
  const cIdx = body.lastIndexOf('<w:color w:val="', pos);
  if (cIdx < 0) return null;
  return body.slice(cIdx + 16, cIdx + 22).toUpperCase();
}
// contrast of a hex colour against the white page
function lum(hex) {
  const c = (i) => { let v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
}
const contrastVsWhite = (hex) => 1.05 / (lum(hex) + 0.05);

// A. a readable brand colour renders as-is
const cA = await sloganColor({ slogan_color: '7A1FA2' }); // dark magenta, ~7.9:1 on white
const A = cA === '7A1FA2';
log('A brandColor=' + cA + ' contrast=' + contrastVsWhite('7A1FA2').toFixed(2));

// B. no brand colour -> package default (teal), and NOT the branded colour
const cB = await sloganColor({});
const B = !!cB && cB !== '7A1FA2';
log('B defaultColor=' + cB);

// C. a too-light brand colour is darkened until it clears contrast
const cC = await sloganColor({ slogan_color: 'FFDD00' }); // yellow, ~1.1:1 on white raw
const C = !!cC && cC !== 'FFDD00' && contrastVsWhite(cC) >= 3;
log('C rawContrast=' + contrastVsWhite('FFDD00').toFixed(2) + ' shipped=' + cC + ' guardedContrast=' + (cC ? contrastVsWhite(cC).toFixed(2) : 'n/a'));

log(`CHECK A (readable brand colour renders as-is): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (absent slogan_color -> package default): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (too-light brand colour darkened to >=3:1): ${C ? 'PASS' : 'FAIL'}`);
const ok = A && B && C;
log(ok ? 'CL-SLOGAN-BRAND-COLOR OK (3/3)' : 'CL-SLOGAN-BRAND-COLOR FAIL');
process.exitCode = ok ? 0 : 1;
