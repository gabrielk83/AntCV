/* DIAGNOSTIC (read-only) — attributes the boot main-thread blocking to specific
 * functions via a V8 CPU profile, on the same owner-scale doc as diag-boot-storm.
 * Output: top self-time functions (file:line) during the first ~14s of boot, so
 * the pagination/measurer refactor (BOOT-FREEZE-LIVE) can target the real cost,
 * not guess. Does NOT edit anything. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const roles = Array.from({length:12},(_,i)=>({ id:'r'+i, title:'Role '+i, company:'Company '+i, dateRange:'20'+(10+i)+'-20'+(11+i), bullets:['Did important work number '+i+' with measurable outcomes across teams.','Second bullet for role '+i+'.'] }));
const tools = Array.from({length:17},(_,i)=>({ l:'Tool '+i, v:'Detail value for tool '+i }));
const regulatory = Array.from({length:31},(_,i)=> i%5===0 ? { group:'Group '+i } : { l:'Std '+i, v:'Compliance detail '+i });
const cv = [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Operations specialist with deep experience.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'Methodical, calm under pressure.' },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items:[{b:'Reduced',t:'spoilage 30%'},{b:'Built',t:'a plan'}] },
  { id:'core_comp', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['A','b'],['C','d'],['E','f']] },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:['[Publication, patent, or conference paper]'] },
  { id:'recommendations', title:'RECOMMENDATIONS', loc:'main', on:true, type:'education', items:[{deg:'References',sch:'On request'}] },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items: tools },
  { id:'certs', title:'CERTIFICATIONS', loc:'sidebar', on:true, type:'list', items:['Cert A','Cert B','Cert C'] },
  { id:'education', title:'EDUCATION', loc:'sidebar', on:true, type:'education', items:[{deg:'MSc',sch:'Uni, 2014'}] },
  { id:'regulatory', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: regulatory },
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Languages'},{l:'English',v:'native'},{l:'Spanish',v:'full professional'},{l:'Interests',v:'hiking, chess'}] },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' } ];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' }, tools, regulatory, certifications:['Cert A','Cert B','Cert C'], publicationsStructured:[{name:'Paper One',details:'Author, Journal, 2009',visible:true}] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [{cv,cl}, personalInfo]);

const client = await page.context().newCDPSession(page);
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 200 }); // 200us
await client.send('Profiler.start');
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(14000);
const { profile } = await client.send('Profiler.stop');
await browser.close(); await new Promise(rr=>server.close(rr));

// Aggregate self-time (sample count * interval) per node, then group by function@file:line.
const nodes = new Map();
for (const n of profile.nodes) nodes.set(n.id, n);
const selfMs = new Map(); // key -> ms
const intervalMs = 0.2; // 200us
let totalSamples = 0;
const counts = new Map();
for (const id of profile.samples) counts.set(id, (counts.get(id)||0)+1);
for (const [id, c] of counts) {
  totalSamples += c;
  const n = nodes.get(id); if (!n) continue;
  const cf = n.callFrame || {};
  let name = cf.functionName || '(anonymous)';
  let url = (cf.url||'').split('/').pop() || '(native)';
  if (!cf.url) url = '(native/gc)';
  const key = name + ' @ ' + url + ':' + (cf.lineNumber!=null?cf.lineNumber+1:'?');
  selfMs.set(key, (selfMs.get(key)||0) + c*intervalMs);
}
const top = [...selfMs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,28);
console.log('total profiled samples:', totalSamples, '(~', Math.round(totalSamples*intervalMs), 'ms on-CPU over 14s)');
console.log('--- TOP self-time functions during boot ---');
for (const [k,v] of top) console.log(String(Math.round(v)).padStart(6),'ms  ', k);
// also group by file to see which sidecar/app file dominates
const byFile = new Map();
for (const [k,v] of selfMs) { const f = k.split(' @ ')[1].split(':')[0]; byFile.set(f,(byFile.get(f)||0)+v); }
console.log('--- by file (top 14) ---');
for (const [f,v] of [...byFile.entries()].sort((a,b)=>b[1]-a[1]).slice(0,14)) console.log(String(Math.round(v)).padStart(6),'ms  ',f);
