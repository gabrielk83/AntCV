/* DIAGNOSTIC — CL-SIGNATURE-001 (docx-worker 1.14.93). Drives the worker with a COVER LETTER payload
 * carrying personal_info.signature_b64 (+ align/size/aspect) and asserts the exported document.xml has
 * a trailing inline image (the signature) AFTER the sign-off name, with the requested alignment; and
 * that omitting the signature produces NO trailing image. Run: node test/diag-cl-signature.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const n = buf.readUInt16LE(i + 10); let p = buf.readUInt32LE(i + 16);
  for (let e = 0; e < n; e++) { const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), en = buf.toString('utf8', p + 46, p + 46 + nl); if (en === name) { const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); } p += 46 + nl + el + cl; }
  throw new Error('no ' + name);
}
// 1x1 PNG (aspect 1).
const SIG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mod = await import('../src/index.js');
async function gen(extraPi) {
  const payload = {
    schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c', ...extraPi },
    meta: { subtitle: 'S', role: 'R' }, style: { navy: '#283556' },
    sections: [
      { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Team,' },
      { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'text', content: 'I am applying for the role.' },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 200));
  return unzip(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

// Count <w:drawing> / a:blip (inline images) in the body.
const drawings = (xml) => (xml.match(/<w:drawing>/g) || []).length;
// Alignment of the LAST paragraph that contains a drawing.
function sigAlign(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const paras = body.split('<w:p>'); // crude split; find the para with the drawing
  for (let i = paras.length - 1; i >= 0; i--) { if (/<w:drawing>/.test(paras[i])) { const m = paras[i].match(/<w:jc w:val="(\w+)"/); return m ? m[1] : '(none)'; } }
  return '(no drawing)';
}

const withSig = await gen({ signature_b64: SIG, signature_align: 'right', signature_size_px: 160, signature_aspect: 0.4 });
const noSig = await gen({});
const dW = drawings(withSig), dN = drawings(noSig);
const al = sigAlign(withSig);
const namePos = withSig.indexOf('Gabriel K');
const drawPos = withSig.indexOf('<w:drawing>');
const afterName = drawPos > namePos;

log('with signature: <w:drawing> count =', dW, '(expect >=1)');
log('without signature: <w:drawing> count =', dN, '(expect 0)');
log('signature paragraph alignment =', al, '(expect right)');
log('signature appears AFTER the sign-off name =', afterName);

const ok = dW >= 1 && dN === 0 && al === 'right' && afterName;
log(ok ? '\nCL-SIGNATURE OK' : '\nCL-SIGNATURE FAIL');
process.exit(ok ? 0 : 1);
