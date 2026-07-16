/* TEST — LEAD-UNDERLINE-001 worker export. A rich_block whole-section `leadUnderline`
 * must emit a coloured character underline (<w:u w:val="single" w:color="…"/>) on the
 * lead-in run; `leadUnderlineColor` sets the colour, else it defaults to the lead colour;
 * absent → no underline. Run: node test/leadin-underline.test.mjs */
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
// isolate the run carrying the "Foundation" lead text and read its <w:u> (if any)
async function leadRunOf(extra) {
  const sec = Object.assign({ id:'p2', title:'PROFILE', loc:'main', on:true, type:'rich_block',
    leadColor:'#0B4F8A', items:[ { b:'Foundation', t:'measured optical behaviour into decisions.' } ] }, extra || {});
  const xml = unzipEntry(await gen(payload(sec)), 'word/document.xml').toString('utf8');
  const m = xml.match(/<w:r>(?:(?!<w:r>).)*?Foundation/s);
  return m ? m[0] : '';
}

const amber = await leadRunOf({ leadUnderline:true, leadUnderlineColor:'#D97706' });
const dflt  = await leadRunOf({ leadUnderline:true });            // no colour → defaults to leadColor 0B4F8A
const none  = await leadRunOf({});                                // no underline field

const checks = [];
checks.push(['leadUnderline + colour emits <w:u single w:color=D97706>', /<w:u\s+w:val="single"\s+w:color="D97706"\s*\/>/i.test(amber)]);
checks.push(['default underline colour = leadColor (0B4F8A)', /<w:u\s+w:val="single"\s+w:color="0B4F8A"\s*\/>/i.test(dflt)]);
checks.push(['no leadUnderline → no <w:u> on the lead run', !/<w:u\b/.test(none)]);
checks.push(['lead run still carries the text + colour', /Foundation/.test(amber) && /w:color w:val="0B4F8A"/i.test(amber)]);

let pass = true;
for (const [name, ok] of checks) { log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) pass = false; }
log('\n' + (pass ? 'PASS' : 'FAIL') + ' — LEAD-UNDERLINE-001 worker export');
process.exit(pass ? 0 : 1);
