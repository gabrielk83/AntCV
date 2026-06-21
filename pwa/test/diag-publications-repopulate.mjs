/* VERIFICATION — PUB-REPOPULATE-001. A pubs (richPub) section holding ONLY the placeholder is
 * re-derived from personalInfo.publicationsStructured (+ patent), composed "Name — details", with
 * the stale pubFields cleared. A section that already holds REAL items is left untouched. */
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
  // placeholder-only pubs (the owner's live state) — must repopulate from personalInfo
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true,
    items:['[Publication, patent, or conference paper]'], pubFields:[{authors:'stale'}] },
], cl:[] };
// real owner shape: publicationsStructured (clean name/details) + separate patent fields
const personalInfo = {
  name:'Gabriel', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' },
  publicationsStructured:[
    { name:'Integration of Suspended Carbon Nanotubes into Micro-Fabricated Devices', details:'Gabriel A. Karp et al., J. Micromechanics & Microengineering, 2009', visible:true },
    { name:'Carbon Nanotube Integration Procedures into NEMS Devices', details:'Gabriel A. Karp et al., Eurosensors Conference Proceedings (poster), 2008', visible:true },
    { name:'A Hidden One', details:'should not appear', visible:false },
  ],
  publications:['<b>“Integration of Suspended Carbon Nanotubes…”</b> - …'],
  patentNumber:'241997', patentDescription:'Co-inventor - cover-window geometry reducing optical crosstalk',
};

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
  const pubs = (secs.cv||[]).find(s=>s.id==='pubs')||{};
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return { items: pubs.items||[], hasPubFields: 'pubFields' in pubs,
    pvPub:/Integration of Suspended Carbon Nanotubes/.test(txt), pvPatent:/Patent no\. 241997/.test(txt) };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('pubs items:', JSON.stringify(r.items,null,1));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.items.length !== 3) { pass=false; fails.push('expected 3 items (2 visible pubs + patent), got '+r.items.length); }
// separator may be em-dash OR hyphen (the owner's em-dash→hyphen ban sidecar hyphenates it — both correct)
if (!r.items.some(i=>/^Integration of Suspended Carbon Nanotubes.* [—-] Gabriel A\. Karp et al\., J\. Micromechanics/.test(i))) { pass=false; fails.push('pub 1 not composed Name — details: '+JSON.stringify(r.items)); }
if (r.items.some(i=>/Hidden One/.test(i))) { pass=false; fails.push('hidden (visible:false) pub should be excluded'); }
if (!r.items.some(i=>/Patent no\. 241997/.test(i))) { pass=false; fails.push('patent not appended'); }
if (r.items.some(i=>/^\[.*\]$/.test(i))) { pass=false; fails.push('placeholder still present'); }
if (r.hasPubFields) { pass=false; fails.push('stale pubFields not cleared'); }
if (!r.pvPub || !r.pvPatent) { pass=false; fails.push('preview missing pub/patent: '+JSON.stringify({pvPub:r.pvPub,pvPatent:r.pvPatent})); }
console.log('\n'+(pass?'PASS':'FAIL')+' — PUB-REPOPULATE-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  placeholder pubs re-derived from personalInfo (2 visible pubs + patent, hidden excluded); pubFields cleared; preview renders.');
