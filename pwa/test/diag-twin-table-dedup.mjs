/* VERIFICATION — TWIN-TABLE-DEDUP-001. CORE COMPETENCIES (CV) rows that EXACTLY duplicate a
 * WHAT I BRING (CL) row get hidden; rows that only share a Focus Area but differ in expertise, and
 * rows unique to CORE COMPETENCIES, are LEFT visible. */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'core_comp', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[
    ['Focus Area','Strategic Expertise'],
    ['Requirements Traceability','Codebeamer, DOORS, end-to-end links'],   // EXACT twin of bring -> hide
    ['Validation','HIL rigs, test automation'],                            // EXACT twin -> hide
    ['Supplier Coordination','RFQs, technical reviews'],                   // same focus, DIFFERENT expertise -> keep
    ['Systems Architecture','SysML, interface control'],                  // unique -> keep
  ] },
], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Team,' },
  { id:'bring', title:'WHAT I BRING', loc:'main', on:true, type:'table', rows:[
    ['Focus Area','Strategic Expertise'],
    ['Requirements Traceability','Codebeamer, DOORS, end-to-end links'],
    ['Validation','HIL rigs, test automation'],
    ['Supplier Coordination','Forward offer: own the sourcing pipeline'],
  ] },
] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

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
  const core = (secs.cv||[]).find(s=>s.id==='core_comp');
  return { hidden: core ? (core.hidden||{}) : null, rows: core ? core.rows.map(r=>r[0]) : [] };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('core_comp hidden:', JSON.stringify(r.hidden));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
const h = r.hidden || {};
if (!h[1]) { pass=false; fails.push('row 1 (exact twin "Requirements Traceability") should be hidden'); }
if (!h[2]) { pass=false; fails.push('row 2 (exact twin "Validation") should be hidden'); }
if (h[3]) { pass=false; fails.push('row 3 (same focus, DIFFERENT expertise) should NOT be hidden'); }
if (h[4]) { pass=false; fails.push('row 4 (unique to core_comp) should NOT be hidden'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — TWIN-TABLE-DEDUP-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  exact CORE COMPETENCIES↔WHAT I BRING duplicate rows hidden; partial/unique rows kept.');
