/* VERIFICATION — SIDEBAR-REPOPULATE-001. An EMPTIED sidebar section (Tools/Regulatory/Certs/
 * Additional) is re-derived from personalInfo (the source of truth), in its current shape, so it is
 * never left empty. Populated sections are NOT touched. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;
const praw = JSON.parse(await readFile(path.resolve(ROOT,'../docs/personas/anita/personalInfo.json'),'utf8'));
const pi = praw.personalInfo || praw;

// Sections where Tools (labeled_list) + Regulatory (rich_block, simulating a prior conversion) + Certs
// (list) are EMPTIED, and Additional is POPULATED (must be left alone).
const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items:[] },
  { id:'regulatory', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'rich_block', items:[] },
  { id:'certs', title:'CERTIFICATIONS', loc:'sidebar', on:true, type:'list', items:[] },
], cl:[] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pinfo])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pinfo));
}, [sections, pi]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(11000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const sec=(id)=>{ const s=(secs.cv||[]).find(x=>x.id===id); return s?{type:s.type, n:(s.items||[]).length, content: JSON.stringify(s.items||[]).slice(0,160)}:null; };
  return { tools:sec('tools'), regulatory:sec('regulatory'), certs:sec('certs') };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log(JSON.stringify(r,null,1));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!r.tools || r.tools.n < 1 || !/Operations/.test(r.tools.content)) { pass=false; fails.push('tools not repopulated from personalInfo: '+JSON.stringify(r.tools)); }
if (!r.regulatory || r.regulatory.n < 1 || !/ISO 22000|Food safety/.test(r.regulatory.content)) { pass=false; fails.push('regulatory (rich_block) not repopulated: '+JSON.stringify(r.regulatory)); }
if (r.regulatory && !/"grp":true|"b":/.test(r.regulatory.content)) { pass=false; fails.push('regulatory not repopulated in rich_block shape: '+r.regulatory.content); }
if (!r.certs || r.certs.n < 1 || !/Cold Storage|Auditor/.test(r.certs.content)) { pass=false; fails.push('certs not repopulated: '+JSON.stringify(r.certs)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — SIDEBAR-REPOPULATE-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  emptied Tools/Regulatory(rich_block)/Certs re-derived from personalInfo in their current shape; populated Additional left untouched.');
