import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name){let i=buf.length-22;for(;i>=0;i--)if(buf.readUInt32LE(i)===0x06054b50)break;const cdo=buf.readUInt32LE(i+16),n=buf.readUInt16LE(i+10);let p=cdo;for(let e=0;e<n;e++){const cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lho=buf.readUInt32LE(p+42);const en=buf.toString('utf8',p+46,p+46+nl);if(en===name){const lnl=buf.readUInt16LE(lho+26),lel=buf.readUInt16LE(lho+28),ds=lho+30+lnl+lel;const c=buf.slice(ds,ds+cs);return buf.readUInt16LE(p+10)===0?c:inflateRawSync(c);}p+=46+nl+el+cl;}throw new Error('no '+name);}
const mod = await import('../src/index.js');
async function close(lang, meta){
  const res=await mod.default.fetch(new Request('https://x/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema_version:'1.0',doc:'cl',language:lang,layout:'linear',filename:'t',personal_info:{name:'Gabriel K',email:'g@b.c'},meta:Object.assign({subtitle:'X',role:'PM',company:'X'},meta||{}),style:{navy:'#283556',accent:'#01B7BB',teal:'#00746E'},font_sizes:{mainBody:10.5},sections:[{id:'greeting',title:'Greeting',on:true,type:'text',content:'Dear X,'},{id:'opening',title:'Opening',on:true,type:'text',content:'Body.'}]})}),{},{waitUntil(){},passThroughOnException(){}});
  const ab=await res.arrayBuffer();
  if(res.status!==200){ log('STATUS',res.status,Buffer.from(ab).toString().slice(0,200)); throw new Error('status '+res.status); }
  return unzip(Buffer.from(ab),'word/document.xml').toString('utf8');
}
const en=await close('en',{}); const da=await close('da',{}); const ov=await close('en',{cl_closing:'Yours sincerely,'});
const A=en.includes('At your service,')&&!en.includes('Kind regards,');
const B=da.includes('Med venlig hilsen,');
const C=ov.includes('Yours sincerely,')&&!ov.includes('At your service,');
log('EN default At-your-service:',A,'| DA default:',B,'| override:',C);
log((A&&B&&C)?'CL-CLOSING OK (3/3)':'CL-CLOSING FAIL');
process.exitCode=(A&&B&&C)?0:1;
