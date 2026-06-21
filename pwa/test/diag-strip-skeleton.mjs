/* VERIFICATION — SKELETON-LEAK-001. Real content with a trailing me() authoring instruction
 * ("…workflows.[PROFILE - 2-3 tight sentences … NO numbers …]") is stripped back to just the real
 * content. A legit trailing bracket WITHOUT the instruction signature (e.g. a year) is preserved.
 * Idempotent. Covers content / items[].t / foundation fields. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const sections = { cv:[
  // rich_block (post-conversion shape) with leaked instruction on items[0].t
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'rich_block', headlineOff:false,
    items:[{ b:'', t:'Hardware-software product engineer with 15+ years.[PROFILE - 2-3 tight sentences positioning who you are professionally. NO numbers, NO named systems.]' }] },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'rich_block',
    items:[{ b:'Work style', t:'Structured and calm under pressure.[Work style] [Work style - 1-2 sentences describing how you operate (e.g., methodical).]' }] },
  // a legit trailing bracket that must be KEPT (no instruction signature)
  { id:'pubs', title:'PUBLICATIONS', loc:'main', on:true, type:'list_italic', richPub:true,
    items:['Some Paper — Author, Journal [2009]'] },
], cl:[
  { id:'foundation', title:'FOUNDATION', loc:'main', on:true, type:'rich_block',
    items:[{ b:'Hands-on', t:'I have built and shipped products.[Hands-on - what you have built or operated yourself, in 1-2 sentences.]' }] },
] };
const personalInfo = { name:'Gabriel', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const t = (doc,id)=>{ const s=(secs[doc]||[]).find(x=>x.id===id)||{}; return (s.items&&s.items[0]) ? (typeof s.items[0]==='string'?s.items[0]:s.items[0].t) : ''; };
  return { profile:t('cv','profile'), work_style:t('cv','work_style'), foundation:t('cl','foundation'), pub:t('cv','pubs'),
    txt:[...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n') };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('profile   :', JSON.stringify(r.profile));
console.log('work_style:', JSON.stringify(r.work_style));
console.log('foundation:', JSON.stringify(r.foundation));
console.log('pub(keep) :', JSON.stringify(r.pub));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (/\[/.test(r.profile)) { pass=false; fails.push('profile still has a bracket: '+r.profile); }
if (r.profile !== 'Hardware-software product engineer with 15+ years.') { pass=false; fails.push('profile not clean: '+r.profile); }
if (/\[/.test(r.work_style)) { pass=false; fails.push('work_style still has a bracket: '+r.work_style); }
if (/\[/.test(r.foundation)) { pass=false; fails.push('foundation still has a bracket: '+r.foundation); }
// separator may be hyphenated by the em-dash ban sidecar; the point is [2009] is KEPT
if (!/Some Paper [—-] Author, Journal \[2009\]/.test(r.pub)) { pass=false; fails.push('legit [2009] bracket was wrongly stripped: '+r.pub); }
if (/\[PROFILE|sentences|NO numbers/i.test(r.txt)) { pass=false; fails.push('leaked instruction visible in preview'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — SKELETON-LEAK-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  leaked [INSTRUCTION] blocks stripped from profile/work_style/foundation; legit [2009] kept; preview clean; zero errors.');
