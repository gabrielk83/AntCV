/* DIAGNOSTIC — PUB-CHAIN-001. A non-academic CV shows publication TITLE + YEAR only
 * (drop the journal/publisher chain); academic (research-formal) keeps the full
 * citation. Drives the real fetch handler + inspects word/document.xml. */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name){let i=buf.length-22;for(;i>=0;i--)if(buf.readUInt32LE(i)===0x06054b50)break;const cd=buf.readUInt32LE(i+16),n=buf.readUInt16LE(i+10);let p=cd;for(let e=0;e<n;e++){const cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),xl=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lho=buf.readUInt32LE(p+42),nm=buf.toString('utf8',p+46,p+46+nl);if(nm===name){const ln=buf.readUInt16LE(lho+26),lx=buf.readUInt16LE(lho+28);const d=buf.slice(lho+30+ln+lx,lho+30+ln+lx+cs);return buf.readUInt16LE(p+10)===0?d:inflateRawSync(d);}p+=46+nl+xl+cl;}return null;}
const mod = await import('../src/index.js');
async function build(payload){const req=new Request('https://x/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const res=await mod.default.fetch(req,{},{waitUntil(){},passThroughOnException(){}});const buf=Buffer.from(await res.arrayBuffer());if(res.status!==200){log('status',res.status,buf.toString().slice(0,200));process.exit(1);}return unzipEntry(buf,'word/document.xml').toString('utf8');}
const PUB = 'Self-assembling SWCNT-FET sensors — Journal of Nanotechnology, Vol 12, Elsevier, pp 45-60, 2018';
function payload(style){ return {
  schema_version:'1.0', doc:'cv', language:'en', layout:'two_column', filename:'t',
  writing_style: style,
  personal_info:{name:'G K',email:'g@b.c'}, meta:{subtitle:'S'}, style:{}, font_sizes:{},
  sections:[
    {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text.'},
    {id:'publications',title:'PUBLICATIONS & PATENTS',loc:'sidebar',on:true,type:'list_italic',items:[PUB]},
  ],
};}
const nonAcad = await build(payload('measured-professional'));
const acad = await build(payload('research-formal'));
const checks=[]; const check=(n,ok,d)=>{checks.push(ok);log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
check('non-academic: title shown', nonAcad.includes('Self-assembling SWCNT-FET sensors'));
check('non-academic: year shown', nonAcad.includes('2018'));
check('non-academic: publisher chain DROPPED (no Journal/Elsevier)', !nonAcad.includes('Journal of Nanotechnology') && !nonAcad.includes('Elsevier'), 'chain leaked');
check('academic: full chain KEPT (Journal + Elsevier present)', acad.includes('Journal of Nanotechnology') && acad.includes('Elsevier'));
const ok=checks.every(Boolean);
log(ok?'PUB-CHAIN OK':'PUB-CHAIN FAIL');
process.exit(ok?0:1);
