/* VERIFICATION — CORE-COMP-COMPRESS-001. CL WHAT I BRING Strategic Expertise cells cap at 105 chars;
 * CV CORE COMPETENCIES caps much tighter (60); Focus Area "Documentation & traceability" → "Docs &
 * traceability"; header row untouched; word-boundary trim. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const longCL = 'RFQ/RFI evaluation, supplier scoring, total landed cost, feasibility studies, and technical-commercial trade-offs for hardware product programmes';
const longCV = 'ALM tools, decision records, audit-ready documentation, end-to-end traceability across the whole programme lifecycle';
const sections = { cv:[
  { id:'core_comp', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[
    ['Focus Area','Strategic Expertise'],
    ['Documentation & traceability', longCV],
    ['Requirements coordination', 'short cell'],
  ] },
], cl:[
  { id:'bring', title:'WHAT I BRING', loc:'main', on:true, type:'table', rows:[
    ['Focus Area','Strategic Expertise'],
    ['Documentation & traceability', longCL],
  ] },
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
  const cc = (secs.cv||[]).find(s=>s.id==='core_comp')||{};
  const br = (secs.cl||[]).find(s=>s.id==='bring')||{};
  return { cvFocus: cc.rows[1][0], cvCell: cc.rows[1][1], cvLen: cc.rows[1][1].length,
    clFocus: br.rows[1][0], clCell: br.rows[1][1], clLen: br.rows[1][1].length,
    header: cc.rows[0][1] };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('CV  focus:', JSON.stringify(r.cvFocus), '| cell len', r.cvLen, ':', JSON.stringify(r.cvCell));
console.log('CL  focus:', JSON.stringify(r.clFocus), '| cell len', r.clLen, ':', JSON.stringify(r.clCell));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.cvFocus !== 'Docs & traceability') { pass=false; fails.push('CV Focus Area not abbreviated: '+r.cvFocus); }
if (r.clFocus !== 'Docs & traceability') { pass=false; fails.push('CL Focus Area not abbreviated: '+r.clFocus); }
if (r.cvLen > 60) { pass=false; fails.push('CV cell not capped to 60: len '+r.cvLen); }
if (r.clLen > 105) { pass=false; fails.push('CL cell not capped to 105: len '+r.clLen); }
if (r.clLen <= 60) { pass=false; fails.push('CL cell over-trimmed (should be ~105, not CV-tight): len '+r.clLen); }
if (/\s$/.test(r.cvCell) || /[,;]$/.test(r.cvCell)) { pass=false; fails.push('CV cell has trailing separator'); }
if (r.header !== 'Strategic Expertise') { pass=false; fails.push('header row was modified'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — CORE-COMP-COMPRESS-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  CL bring capped 105, CV core_comp capped 60 (much tighter), Focus Area abbreviated, header untouched; zero errors.');
