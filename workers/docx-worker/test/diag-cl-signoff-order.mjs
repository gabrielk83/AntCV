import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name){let i=buf.length-22;for(;i>=0;i--)if(buf.readUInt32LE(i)===0x06054b50)break;const cdo=buf.readUInt32LE(i+16),n=buf.readUInt16LE(i+10);let p=cdo;for(let e=0;e<n;e++){const cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lho=buf.readUInt32LE(p+42);const en=buf.toString('utf8',p+46,p+46+nl);if(en===name){const lnl=buf.readUInt16LE(lho+26),lel=buf.readUInt16LE(lho+28),ds=lho+30+lnl+lel;const c=buf.slice(ds,ds+cs);return buf.readUInt16LE(p+10)===0?c:inflateRawSync(c);}p+=46+nl+el+cl;}throw new Error('no '+name);}
const mod = await import('../src/index.js');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
async function gen(meta){
  const res=await mod.default.fetch(new Request('https://x/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema_version:'1.0',doc:'cl',language:'en',layout:'linear',filename:'t',personal_info:{name:'Gabriel Alexander',email:'g@b.c',signature_b64:png,signature_align:'right',signature_size_px:120,signature_aspect:0.4},meta:Object.assign({subtitle:'X',role:'PM',company:'X'},meta||{}),style:{navy:'#283556',accent:'#01B7BB',teal:'#00746E'},font_sizes:{mainBody:10.5},sections:[{id:'greeting',title:'Greeting',on:true,type:'text',content:'Dear X,'},{id:'opening',title:'Opening',on:true,type:'text',content:'Body.'}]})}),{},{waitUntil(){},passThroughOnException(){}});
  const ab=await res.arrayBuffer(); if(res.status!==200) throw new Error('status '+res.status+' '+Buffer.from(ab).toString().slice(0,150));
  return unzip(Buffer.from(ab),'word/document.xml').toString('utf8');
}
const xml=await gen({});
const body=xml.slice(xml.indexOf('<w:body'));
const closePos=body.indexOf('At your service,');
const namePos=body.lastIndexOf('>Gabriel<');         // sign-off name (standalone first word)
const sigPos=body.indexOf('<w:drawing', closePos);   // signature image
// ORDER: closing < name < signature
const order = closePos>=0 && namePos>closePos && sigPos>namePos;
// closing centered by default: the closeWord paragraph's jc = center
const jcAfterClose = body.lastIndexOf('<w:jc w:val="', closePos);
const jcVal = jcAfterClose>=0 ? body.slice(jcAfterClose+13, jcAfterClose+25).split('"')[0] : '';
log('closePos',closePos,'namePos',namePos,'sigPos',sigPos,'| closing jc:',jcVal);
log('ORDER closing<name<sig:', order, '| closing centered:', jcVal==='center');
log((order && jcVal==='center') ? 'CL-SIGNOFF-ORDER OK (2/2)' : 'CL-SIGNOFF-ORDER FAIL');
process.exitCode = (order && jcVal==='center') ? 0 : 1;
