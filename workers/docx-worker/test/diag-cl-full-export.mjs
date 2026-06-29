import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log=(...a)=>writeSync(1,a.join(' ')+'\n');
function unzip(buf,name){let i=buf.length-22;for(;i>=0;i--)if(buf.readUInt32LE(i)===0x06054b50)break;const cdo=buf.readUInt32LE(i+16),n=buf.readUInt16LE(i+10);let p=cdo;for(let e=0;e<n;e++){const cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lho=buf.readUInt32LE(p+42);const en=buf.toString('utf8',p+46,p+46+nl);if(en===name){const lnl=buf.readUInt16LE(lho+26),lel=buf.readUInt16LE(lho+28),ds=lho+30+lnl+lel;const c=buf.slice(ds,ds+cs);return buf.readUInt16LE(p+10)===0?c:inflateRawSync(c);}p+=46+nl+el+cl;}throw new Error('no '+name);}
const mod=await import('../src/index.js');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const sections=[
 {id:'greeting',title:'Greeting',loc:'main',on:true,type:'text',content:'Dear Hiring Manager,'},
 {id:'opening',title:'Opening',loc:'main',on:true,type:'rich_block',headlineOff:true,items:[{b:'',t:'I am applying for a role.'}]},
 {id:'why',title:'WHY THIS POSITION',loc:'main',on:true,type:'rich_block',headlineOff:true,items:[{b:'Why this company',t:'This role aligns with my experience.'}]},
 {id:'who',title:'WHO I AM',loc:'main',on:true,type:'rich_block',headlineOff:true,items:[{b:'Who I am',t:'an IT professional.'}]},
 {id:'foundation',title:'FOUNDATION',loc:'main',on:true,type:'rich_block',headlineOff:true,items:[{b:'Foundation',t:'I connect engineering.'},{b:'Hands-on',t:'across the path.',mk:true},{b:'Professionally',t:'ownership.',mk:true}]},
 {id:'bring',title:'WHAT I BRING',loc:'main',on:true,type:'rich_block',headlineOff:true,items:[{b:'What I bring',t:''},{b:'Validation & quality',t:'Define DV/PV test plans.',mk:true}]},
 {id:'contribute',title:'HOW I WOULD CONTRIBUTE',loc:'main',on:true,type:'rich_block',headlineOff:true,items:[{b:'How I would contribute',t:'my immediate priority would be to close the gap:'},{b:'',t:'Map current change-request workflows.',mk:true},{b:'',t:'Set up a shared decision log.',mk:true},{b:'Goal',t:'My aim is to help your team.'}]},
 {id:'closure',title:'Closure',loc:'main',on:true,type:'text',content:'I would welcome the chance to talk.'},
];
const res=await mod.default.fetch(new Request('https://x/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema_version:'1.0',doc:'cl',language:'en',layout:'linear',filename:'t',personal_info:{name:'Gabriel Alexander Karp-Gershon',email:'g@b.c',signature_b64:png,signature_align:'center',signature_size_px:140,signature_aspect:0.4},meta:{subtitle:'Application: Product / Project Expert',slogan:'PROCESSES • PRODUCTS • PEOPLE',slogan_align:'center'},style:{navy:'#283556',accent:'#01B7BB',teal:'#00746E'},font_sizes:{mainBody:10.5},sections})}),{},{waitUntil(){},passThroughOnException(){}});
const ab=await res.arrayBuffer();if(res.status!==200){log('STATUS',res.status,Buffer.from(ab).toString().slice(0,200));process.exit(1);}
const xml=unzip(Buffer.from(ab),'word/document.xml').toString('utf8');
log('SLOGAN override present (PROCESSES):', xml.includes('PROCESSES')&&xml.includes('PEOPLE'));
log('SLOGAN subtitle leaked (APPLICATION):', xml.toUpperCase().includes('APPLICATION: PRODUCT'));
log('SIGNATURE drawing present:', xml.includes('<w:drawing'));
log('HWIC intro present:', xml.includes('immediate priority'));
log('HWIC bullets present:', xml.includes('Map current change-request'));
log('HWIC Goal present:', xml.includes('My aim is to help'));
