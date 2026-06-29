import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name){let i=buf.length-22;for(;i>=0;i--)if(buf.readUInt32LE(i)===0x06054b50)break;const cdo=buf.readUInt32LE(i+16),n=buf.readUInt16LE(i+10);let p=cdo;for(let e=0;e<n;e++){const cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lho=buf.readUInt32LE(p+42);const en=buf.toString('utf8',p+46,p+46+nl);if(en===name){const lnl=buf.readUInt16LE(lho+26),lel=buf.readUInt16LE(lho+28),ds=lho+30+lnl+lel;const c=buf.slice(ds,ds+cs);return buf.readUInt16LE(p+10)===0?c:inflateRawSync(c);}p+=46+nl+el+cl;}throw new Error('no '+name);}
const mod = await import('../src/index.js');
async function gen(meta){
  const res=await mod.default.fetch(new Request('https://x/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema_version:'1.0',doc:'cl',language:'en',layout:'linear',filename:'t',personal_info:{name:'Gabriel Alexander Karp',email:'g@b.c'},meta:Object.assign({subtitle:'X',role:'PM',company:'X'},meta||{}),style:{navy:'#283556',accent:'#01B7BB',teal:'#00746E'},font_sizes:{mainBody:10.5},sections:[{id:'greeting',title:'Greeting',on:true,type:'text',content:'Dear X,'},{id:'opening',title:'Opening',on:true,type:'text',content:'Body.'}]})}),{},{waitUntil(){},passThroughOnException(){}});
  const ab=await res.arrayBuffer(); if(res.status!==200) throw new Error('status '+res.status+' '+Buffer.from(ab).toString().slice(0,150));
  return unzip(Buffer.from(ab),'word/document.xml').toString('utf8');
}
const def=await gen({});                                  // default -> first word "Gabriel", header keeps full
const ov=await gen({cl_sign_name:'GK'});                  // override
const al=await gen({cl_sign_name_align:'left'});          // align left
// the sign-off name is the LAST occurrence of the name text; the header has the full name "Gabriel Alexander Karp"
const A = def.includes('Gabriel Alexander Karp') && def.lastIndexOf('>Gabriel<') > def.indexOf('Gabriel Alexander Karp'); // full in header, "Gabriel" alone later
const Adef = /<w:t[^>]*>Gabriel<\/w:t>/.test(def);        // a standalone "Gabriel" run (the sign-off)
const B = /<w:t[^>]*>GK<\/w:t>/.test(ov);                 // override "GK" present
// align: find the sign-off name paragraph (the standalone first-word run) and its jc
const gi = al.lastIndexOf('Gabriel<');
const jc = al.lastIndexOf('<w:jc w:val="', gi);
const jcVal = jc>=0 ? al.slice(jc+13, jc+25) : '';
const C = jcVal.startsWith('left');
log('default first-word standalone:', Adef, '| header full kept:', def.includes('Gabriel Alexander Karp'), '| override GK:', B, '| align jc:', jcVal.split('"')[0]);
log((Adef && def.includes('Gabriel Alexander Karp') && B && C) ? 'CL-SIGNNAME OK (4/4)' : 'CL-SIGNNAME FAIL');
process.exitCode = (Adef && def.includes('Gabriel Alexander Karp') && B && C) ? 0 : 1;
