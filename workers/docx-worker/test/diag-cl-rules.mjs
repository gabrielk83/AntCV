/* DIAGNOSTIC — CL-BOTTOM-RULE-MATCH-002 (worker 1.14.113). Owner: "the CL horizontal lines don't
 * match and only the lower one is visible in export." Verifies: with a REAL why rich_block
 * (headlineOff + headlineRule) AND a real closure, BOTH horizontal rules render and their border
 * spec is IDENTICAL (bottom border, size 8, mainHeadColor). Also shows that a PLACEHOLDER why drops
 * its body -> the upper rule vanishes (explaining "only lower visible" on a semi-empty CL). */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cd;
  for (let e = 0; e < n; e++) { const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl); if (nm === name) { const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28); const d = buf.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + cs); return buf.readUInt16LE(p + 10) === 0 ? d : inflateRawSync(d); } p += 46 + nl + xl + cl; }
  return null;
}
const mod = await import('../src/index.js');
async function build(sections) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: {}, style: {}, font_sizes: {}, sections,
  }) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200) { log('status', res.status); process.exit(1); }
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}
// count paragraph-level single borders (the horizontal rules)
function countRules(xml) { return (xml.match(/<w:pBdr>/g) || []).length; }

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

const realWhy = { id: 'why', title: 'WHY THIS COMPANY', loc: 'main', on: true, type: 'rich_block', headlineOff: true, headlineRule: true, items: [{ b: 'Why this company', t: 'Your move into deep-tech hardware maps directly onto my product and validation background.' }] };
const closure = { id: 'closure', title: '', loc: 'main', on: true, type: 'text', content: 'I would welcome the chance to talk through how I can help.' };
const phWhy = { id: 'why', title: 'WHY THIS COMPANY', loc: 'main', on: true, type: 'rich_block', headlineOff: true, headlineRule: true, items: [{ b: 'Why this company', t: '[NO-JD RULE placeholder]' }] };

const realXml = await build([realWhy, closure]);
const phXml = await build([phWhy, closure]);

const realRules = countRules(realXml);
const phRules = countRules(phXml);
log(`rules with REAL why = ${realRules}, with PLACEHOLDER why = ${phRules}`);
check('REAL why: both rules render (>=2 pBdr)', realRules >= 2, `got ${realRules}`);
check('PLACEHOLDER why: upper rule vanishes (fewer rules)', phRules < realRules, `real=${realRules} ph=${phRules}`);
// the two rule borders should be the SAME spec (bottom border, sz 8, same colour)
const borders = (realXml.match(/<w:pBdr>[\s\S]*?<\/w:pBdr>/g) || []).map((b) => b.replace(/\s+/g, ' '));
// the why headlineRule + closure rule are BOTTOM-ONLY (the candidate-header contact rule has BOTH
// top and bottom, so exclude those).
const sectionRules = borders.filter((b) => /<w:bottom /.test(b) && !/<w:top /.test(b));
log('bottom-only section rules: ' + JSON.stringify(sectionRules));
check('REAL why: the why + closure section rules exist (>=2 bottom-only)', sectionRules.length >= 2, `got ${sectionRules.length}`);
const allSame = sectionRules.length >= 2 && sectionRules.every((b) => b === sectionRules[0]);
check('REAL why: the why + closure rules are IDENTICAL', allSame, sectionRules.slice(0, 2).join(' || '));

const ok = checks.every(Boolean);
log(ok ? 'CL-RULES OK' : 'CL-RULES FAIL');
process.exit(ok ? 0 : 1);
