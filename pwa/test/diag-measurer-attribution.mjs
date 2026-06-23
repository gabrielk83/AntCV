/* DIAGNOSTIC — attribute boot-time main-thread blocking to the autoPages MEASURER.
 * Runs the SAME owner-scale doc twice: (A) measurer ON (current), (B) measurer OFF
 * (antcv:disable-autopagebreak=1 set before boot). The delta is the measurer's share
 * of the ~18s boot freeze. Reuses the synthetic doc shape from diag-boot-storm.mjs. */
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
];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' },
  tools, regulatory, certifications:['Cert A','Cert B','Cert C'], additional:[{l:'English',v:'native'},{l:'Spanish',v:'full professional, Uruguayan variant'}],
  publicationsStructured:[{name:'Paper One',details:'Author, Journal, 2009',visible:true}], patentNumber:'241997', patentDescription:'Co-inventor, a thing' };

async function runOnce(disableMeasurer) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([secs, pi, off])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
    if (off) localStorage.setItem('antcv:disable-autopagebreak','1');
    window.__longTasks = []; try { new PerformanceObserver(list=>{ for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration)); }).observe({entryTypes:['longtask']}); } catch(_){}
    // count measurer write-cycles (auto-pages-changed) to confirm it actually ran when ON
    window.__apc = 0; window.addEventListener('antcv:auto-pages-changed', ()=>{ window.__apc++; });
  }, [{cv,cl}, personalInfo, !!disableMeasurer]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(16000);
  const r = await page.evaluate(()=>{
    const lt = window.__longTasks||[];
    return { longTaskCount: lt.length, totalBlockingMs: lt.reduce((a,b)=>a+b,0), longestTaskMs: lt.length?Math.max(...lt):0, autoPagesChanged: window.__apc||0,
      salmonCount: document.querySelectorAll('[class*="salmon" i],[data-antcv-salmon]').length };
  });
  await browser.close();
  return { ...r, errs: errs.length };
}

const on  = await runOnce(false);
const off = await runOnce(true);
await new Promise(rr=>server.close(rr));

function line(label, r){ console.log(label.padEnd(18), 'blocking', String(r.totalBlockingMs).padStart(6)+'ms', '| longest', String(r.longestTaskMs).padStart(5)+'ms', '| tasks', String(r.longTaskCount).padStart(3), '| auto-pages-changed', r.autoPagesChanged, '| salmon', r.salmonCount, '| errs', r.errs); }
line('measurer ON', on);
line('measurer OFF', off);
console.log('—'.repeat(40));
console.log('measurer share    :', (on.totalBlockingMs - off.totalBlockingMs), 'ms  (', Math.round(100*(on.totalBlockingMs-off.totalBlockingMs)/Math.max(1,on.totalBlockingMs)), '% of ON )');
