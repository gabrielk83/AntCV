/* VERIFICATION — APPLICATION-QA-001 P1. With antcv:applicationQuestions populated, the CL gets an
 * `application_qa` rich_block page: candidate header (grp row, Name - role framing) + one {b:Q,t:A}
 * row per question, pageBreakBefore, after closure, rendered in the CL preview. With the source
 * empty, the section is hidden (on:false), not deleted. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const sections = { cv:[ { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' } ], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Team,' },
  { id:'closure', title:'Closure', loc:'main', on:true, type:'text', content:'Yours sincerely,' },
] };
const personalInfo = { name:'Gabriel Karp', headline:'Product / Project Expert | Photonics', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };
const questions = [
  { question:'Why do you want to work here?', answer:'Because your colony logistics mission matches my seasonal-risk focus, and I have run granary operations end to end.' },
  { question:'Describe a time you handled a supplier conflict.', answer:'I renegotiated an RFQ under time pressure, aligning engineering and procurement on a total-landed-cost view that cut spend 18%.' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi, qs])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:applicationQuestions', JSON.stringify(qs));
}, [sections, personalInfo, questions]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const populated = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const s = (secs.cl||[]).find(x=>x.id==='application_qa')||{};
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return { present:!!s.id, type:s.type, on:s.on, pageBreak:!!s.pageBreakBefore, afterClosure: (secs.cl||[]).findIndex(x=>x.id==='application_qa') > (secs.cl||[]).findIndex(x=>x.id==='closure'),
    header:(s.items&&s.items[0])?s.items[0].t:'', n:(s.items||[]).length,
    q1:(s.items&&s.items[1])?s.items[1].b:'', a1:(s.items&&s.items[1])?(s.items[1].t||'').slice(0,30):'',
    pvQ:/Why do you want to work here/.test(txt), pvA:/seasonal-risk focus/.test(txt) };
});

// now clear the source → section should hide (on:false), not delete
await page.evaluate(()=>{ localStorage.setItem('antcv:applicationQuestions','[]'); window.AntcvApplicationQa.run(); });
await page.waitForTimeout(500);
const cleared = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const s = (secs.cl||[]).find(x=>x.id==='application_qa')||{};
  return { stillPresent:!!s.id, on:s.on };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('populated:', JSON.stringify(populated,null,1));
console.log('cleared  :', JSON.stringify(cleared));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!populated.present) { pass=false; fails.push('application_qa section not created'); }
if (populated.type !== 'rich_block') { pass=false; fails.push('not rich_block: '+populated.type); }
if (populated.on === false) { pass=false; fails.push('should be on when questions exist'); }
if (!populated.pageBreak) { pass=false; fails.push('missing pageBreakBefore (new page)'); }
if (!populated.afterClosure) { pass=false; fails.push('not placed after closure'); }
if (!/Gabriel Karp - Product \/ Project Expert\. Responses to your application questions:/.test(populated.header)) { pass=false; fails.push('candidate header wrong: '+populated.header); }
if (populated.n !== 3) { pass=false; fails.push('expected 3 rows (header + 2 Q&A), got '+populated.n); }
if (populated.q1 !== 'Why do you want to work here?') { pass=false; fails.push('Q1 row wrong: '+populated.q1); }
if (!populated.pvQ || !populated.pvA) { pass=false; fails.push('CL preview missing Q/A: '+JSON.stringify({pvQ:populated.pvQ,pvA:populated.pvA})); }
if (!cleared.stillPresent) { pass=false; fails.push('section deleted on clear (should hide, not delete)'); }
if (cleared.on !== false) { pass=false; fails.push('section not hidden on clear, on='+cleared.on); }
console.log('\n'+(pass?'PASS':'FAIL')+' — APPLICATION-QA-001 P1');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  CL Application Q&A page: candidate header + Q/A rich_block, new page after closure, renders; hides (not deletes) when empty; zero errors.');
