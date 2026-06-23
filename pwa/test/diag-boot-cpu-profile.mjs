/* DIAGNOSTIC — CPU profile of boot on an owner-scale doc. Captures a V8 CPU profile
 * via CDP during the first ~14s and ranks functions by SELF time, so we can see where
 * the ~15s of main-thread blocking actually goes (measurer was only ~1%). */
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
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Languages'},{l:'English',v:'native'},{l:'Spanish',v:'full professional, Uruguayan variant'},{l:'Interests',v:'hiking, chess'}] },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' } ];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' },
  tools, regulatory, certifications:['Cert A','Cert B','Cert C'], additional:[{l:'English',v:'native'}], publicationsStructured:[{name:'Paper One',details:'Author, Journal, 2009',visible:true}] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [{cv,cl}, personalInfo]);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); // 200µs
await cdp.send('Profiler.start');
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(14000);
const { profile } = await cdp.send('Profiler.stop');
await browser.close(); await new Promise(rr=>server.close(rr));

// Aggregate SELF time per node, then group by function+url.
const nodesById = new Map(); for (const n of profile.nodes) nodesById.set(n.id, n);
const selfByNode = new Map();
const dt = profile.timeDeltas, samples = profile.samples;
for (let i=0;i<samples.length;i++){ const id=samples[i]; const d=dt[i]||0; selfByNode.set(id,(selfByNode.get(id)||0)+d); }
const byFn = new Map();
for (const [id, us] of selfByNode){ const n=nodesById.get(id); if(!n)continue; const cf=n.callFrame||{}; const url=(cf.url||'').split('/').pop()||cf.url||'(native)'; const key=(cf.functionName||'(anonymous)')+'  @'+url+(cf.lineNumber>=0?':'+(cf.lineNumber+1):''); byFn.set(key,(byFn.get(key)||0)+us); }
const total = [...selfByNode.values()].reduce((a,b)=>a+b,0);
const ranked = [...byFn.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30);
console.log('total sampled self time:', Math.round(total/1000), 'ms  (', samples.length, 'samples )');
console.log('TOP self-time functions:');
for (const [k,us] of ranked){ console.log('  '+String(Math.round(us/1000)).padStart(6)+'ms  '+String(Math.round(100*us/total)).padStart(3)+'%  '+k); }
// also group by URL (file)
const byUrl = new Map();
for (const [id, us] of selfByNode){ const n=nodesById.get(id); if(!n)continue; const url=((n.callFrame||{}).url||'(native)').split('/').pop()||'(native)'; byUrl.set(url,(byUrl.get(url)||0)+us); }
console.log('\nTOP self-time by FILE:');
for (const [k,us] of [...byUrl.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15)){ console.log('  '+String(Math.round(us/1000)).padStart(6)+'ms  '+String(Math.round(100*us/total)).padStart(3)+'%  '+k); }
