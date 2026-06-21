/* DIAGNOSTIC — RICH-BLOCK-001 worker export. A rich_block section (N rows of bold lead-in + body)
 * must export: the lead-in text + body text per row, the section heading + rule by default, and
 * honour headlineOff (no heading) and ruleOff (heading present, no bottom border).
 * Run: node test/diag-rich-block-export.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdOffset = buf.readUInt32LE(i + 16); const nEntries = buf.readUInt16LE(i + 10); let p = cdOffset;
  for (let e = 0; e < nEntries; e++) { const compSize = buf.readUInt32LE(p+20), nameLen = buf.readUInt16LE(p+28), extraLen = buf.readUInt16LE(p+30), commentLen = buf.readUInt16LE(p+32), lho = buf.readUInt32LE(p+42); const en = buf.toString('utf8', p+46, p+46+nameLen); if (en === name) { const lN = buf.readUInt16LE(lho+26), lE = buf.readUInt16LE(lho+28), ds = lho+30+lN+lE, comp = buf.slice(ds, ds+compSize); return (buf.readUInt16LE(p+10)===0)?comp:inflateRawSync(comp); } p += 46+nameLen+extraLen+commentLen; }
  throw new Error('entry not found ' + name);
}
const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }), {}, { waitUntil(){}, passThroughOnException(){} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status);
  return Buffer.from(ab);
}
function richSection(extra) {
  return Object.assign({ id:'profile2', title:'PROFILE', loc:'main', on:true, type:'rich_block', items:[
    { b:'Hands-on', t:'I have built and operated MEMS test rigs end to end.' },
    { b:'Professionally', t:'That translates into disciplined product ownership.' },
  ] }, extra || {});
}
function payload(sec) {
  return {
    schema_version:'1.0', doc:'cl', language:'en', layout:'linear', filename:'t',
    personal_info:{ name:'Anita Myre', email:'a@b.c' }, meta:{ subtitle:'Application' },
    style:{ navy:'#283556' }, font_sizes:{ mainBody:10.5 },
    sections:[
      { id:'greeting', title:'', loc:'main', on:true, type:'text', text:'Dear Team,' },
      sec,
    ],
  };
}
async function inspect(sec) {
  const xml = unzipEntry(await gen(payload(sec)), 'word/document.xml').toString('utf8');
  const texts = (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean);
  const joined = texts.join(' | ');
  return {
    title: /PROFILE/.test(joined),
    handsOn: /Hands-on/.test(joined),
    professionally: /Professionally/.test(joined),
    bodyA: /built and operated/.test(joined),
    bodyB: /disciplined product ownership/.test(joined),
    pBdr: (xml.match(/<w:pBdr>/g) || []).length,
    numPr: (xml.match(/<w:numPr>/g) || []).length,
  };
}

const normal = await inspect(richSection());
const noHead = await inspect(richSection({ headlineOff:true }));
const noRule = await inspect(richSection({ ruleOff:true }));
// marker rows: bullets with mk:true must export with list numbering (<w:numPr>).
const markered = await inspect({ id:'profile2', title:'PROFILE', loc:'main', on:true, type:'rich_block', items:[
  { b:'', t:'built and operated rigs', mk:true },
  { b:'', t:'disciplined product ownership', mk:true },
] });
// custom per-row emoji markers: rendered as a literal prefix run, NOT list numbering.
const emojiXml = unzipEntry(await gen(payload({ id:'profile2', title:'PROFILE', loc:'main', on:true, type:'rich_block', items:[
  { b:'', t:'built and operated rigs', mk:'🚀' },
  { b:'', t:'disciplined product ownership', mk:'✅' },
] })), 'word/document.xml').toString('utf8');
const emojiMk = { rocket: emojiXml.includes('🚀'), check: emojiXml.includes('✅'), numPr: (emojiXml.match(/<w:numPr>/g) || []).length };
// group rows + leadColon: a grp row exports a bold sub-heading; leadColon makes the lead "Label: ".
const grpXml = unzipEntry(await gen(payload({ id:'tools', title:'TOOLS & METHODS', loc:'main', on:true, type:'rich_block', leadColon:true, items:[
  { grp:true, t:'Engineering' },
  { b:'CAD', t:'SolidWorks' },
] })), 'word/document.xml').toString('utf8');
const grpTexts = (grpXml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, ''));
const grp = { heading: grpTexts.includes('Engineering'), colonLead: grpTexts.some(t => t === 'CAD: '), body: grpTexts.includes('SolidWorks') };
// whole-section lead style: bold off + italic on + custom colour applied to the lead run.
const leadXml = unzipEntry(await gen(payload({ id:'profile2', title:'PROFILE', loc:'main', on:true, type:'rich_block',
  leadBold:false, leadItalic:true, leadColor:'#FF0000', items:[ { b:'Hands-on', t:'built and operated rigs' } ] })), 'word/document.xml').toString('utf8');
// isolate the run that carries the lead text "Hands-on"
const leadRunM = leadXml.match(/<w:r>(?:(?!<w:r>).)*?Hands-on/s);
const leadRun = leadRunM ? leadRunM[0] : '';
const leadStyle = { color: /w:color w:val="FF0000"/i.test(leadRun), italic: /<w:i\/>/.test(leadRun), notBold: !/<w:b\/>/.test(leadRun) };

log('normal   :', JSON.stringify(normal));
log('headlineOff:', JSON.stringify(noHead));
log('ruleOff  :', JSON.stringify(noRule));
log('markered :', JSON.stringify(markered));
log('emojiMk  :', JSON.stringify(emojiMk));

const checks = [];
checks.push(['rows export (leads + bodies)', normal.handsOn && normal.professionally && normal.bodyA && normal.bodyB]);
checks.push(['heading + rule by default', normal.title && normal.pBdr >= 1]);
checks.push(['headlineOff hides heading, keeps body', !noHead.title && noHead.handsOn && noHead.bodyA]);
checks.push(['ruleOff keeps heading, drops the rule', noRule.title && noRule.pBdr === normal.pBdr - 1 && noRule.handsOn]);
checks.push(['plain rows have no list numbering', normal.numPr === 0]);
checks.push(['marker rows export as a numbered list', markered.numPr >= 2 && markered.bodyA]);
checks.push(['per-row emoji markers export as literal glyphs (no numbering)', emojiMk.rocket && emojiMk.check && emojiMk.numPr === 0]);
checks.push(['group row exports a sub-heading + leadColon makes "Label: "', grp.heading && grp.colonLead && grp.body]);
checks.push(['whole-section lead style (bold-off + italic + colour) applies to the lead run', leadStyle.color && leadStyle.italic && leadStyle.notBold]);

let pass = true;
for (const [name, ok] of checks) { log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) pass = false; }
log('\n' + (pass ? 'PASS' : 'FAIL') + ' — RICH-BLOCK-001 worker export');
process.exit(pass ? 0 : 1);
