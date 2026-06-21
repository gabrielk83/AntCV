/* DIAGNOSTIC — boot-time main-thread blocking + sections-updated dispatch storm on an owner-scale
 * document (all migration-triggering shapes + 12 roles + big sidebar). Measures: how many times
 * 'antcv:sections-updated' fires, total long-task blocking time, and the longest single block, over
 * the first 16s. Tells us whether the "gate hangs / refresh twice" freeze is a dispatch storm. */
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
const cl = [
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' },
  { id:'opening', title:'Opening', loc:'main', on:true, type:'text', content:'I am writing about the role.' },
  { id:'who', title:'WHO I AM', loc:'main', on:true, type:'text', content:'I am an operations specialist.' },
  { id:'bring', title:'WHAT I BRING', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['X','y']] },
  { id:'why', title:'WHY THIS POSITION', loc:'main', on:true, type:'text', content:'Your network matches my focus.' },
  { id:'contribute', title:'HOW I WOULD CONTRIBUTE', loc:'main', on:true, type:'text_bullets', items:[{content:'My priorities:'},{content:'audit'},{content:'map gaps'},{content:'so the colony gains.'}] },
  { id:'foundation', title:'FOUNDATION', loc:'main', on:true, type:'foundation', hands_on:'I have run operations.', professionally:'Disciplined ownership.' },
  { id:'closure', title:'Closure', loc:'main', on:true, type:'text', content:'I welcome a conversation.' },
];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' },
  tools, regulatory, certifications:['Cert A','Cert B','Cert C'], additional:[{l:'English',v:'native'},{l:'Spanish',v:'full professional, Uruguayan variant'}],
  publicationsStructured:[{name:'Paper One',details:'Author, Journal, 2009',visible:true}], patentNumber:'241997', patentDescription:'Co-inventor, a thing' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  // instrument BEFORE app boots
  window.__suCount = 0; window.__suTimes = [];
  window.addEventListener('antcv:sections-updated', ()=>{ window.__suCount++; window.__suTimes.push(Math.round(performance.now())); });
  window.__longTasks = []; try { new PerformanceObserver(list=>{ for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration)); }).observe({entryTypes:['longtask']}); } catch(_){}
}, [{cv,cl}, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(16000);

const r = await page.evaluate(()=>{
  const lt = window.__longTasks||[];
  const total = lt.reduce((a,b)=>a+b,0);
  const su = window.__suTimes||[];
  // dispatches in tight bursts (within 50ms of the prior) = storm signal
  let bursts=0; for (let i=1;i<su.length;i++){ if (su[i]-su[i-1] < 50) bursts++; }
  return { suCount: window.__suCount||0, longTaskCount: lt.length, totalBlockingMs: total, longestTaskMs: lt.length?Math.max(...lt):0, burstDispatches: bursts, firstPaper: /Paper One/.test(document.body.textContent||'') };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('sections-updated dispatches :', r.suCount);
console.log('  of which back-to-back(<50ms):', r.burstDispatches, '(storm signal)');
console.log('long tasks (>50ms)           :', r.longTaskCount);
console.log('total main-thread blocking   :', r.totalBlockingMs, 'ms');
console.log('longest single block         :', r.longestTaskMs, 'ms');
console.log('app errors                   :', errs.length, errs.slice(0,2).join(' | '));
console.log('pubs repopulated             :', r.firstPaper);
