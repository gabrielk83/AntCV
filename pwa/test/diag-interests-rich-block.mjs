/* VERIFICATION — INTERESTS-RICH-BLOCK-001. The interests section (labeled_list {l,v}) converts to
 * rich_block ({b,t} + leadColon), 415's interests shape-coercers no longer fight it (it stays
 * rich_block with its {b,t} rows intact + renders in the sidebar), and a SHORT interests gets pinned
 * back to the canonical 6 in rich_block shape. Idempotent / restore-stable. */
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
  { id:'interests', title:'INTERESTS', loc:'sidebar', on:true, type:'labeled_list', items:[
    { l:'Rugby & inclusive sport', v:'Team operations, coach assist, literally a team player' },
    { l:'Tai-chi', v:'Stability and calm under pressure' },
    { l:'Cultural exchange', v:'Languages, food culture and board games' },
    { l:'Hiking', v:'Outdoor recovery and mental reset' },
    { l:'Reading', v:'Technology, society and systems thinking' },
    { l:'Supervision', v:'Handling three feline strategic napping experts (cats)' },
  ] },
], cl:[] };
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
await page.waitForTimeout(10000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const s = (secs.cv||[]).find(x=>x.id==='interests')||{};
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return { type:s.type, leadColon:!!s.leadColon, n:(s.items||[]).length,
    rows:(s.items||[]).map(it=>({b:it.b, t:(it.t||'').slice(0,20), hasLV: (it.l!=null||it.v!=null)})),
    pvRugby:/Rugby & inclusive sport/.test(txt), pvHiking:/Outdoor recovery/.test(txt) };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('interests:', JSON.stringify(r,null,1));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.type !== 'rich_block') { pass=false; fails.push('interests not converted to rich_block, got '+r.type); }
if (!r.leadColon) { pass=false; fails.push('interests rich_block should have leadColon'); }
if (r.n !== 6) { pass=false; fails.push('expected 6 interest rows, got '+r.n); }
if (!r.rows.every(x=>x.b && !x.hasLV)) { pass=false; fails.push('rows should be {b,t} (no leftover l/v from 415): '+JSON.stringify(r.rows)); }
if ((r.rows[0]||{}).b !== 'Rugby & inclusive sport') { pass=false; fails.push('row 0 lead-in wrong: '+JSON.stringify(r.rows[0])); }
if (!r.pvRugby || !r.pvHiking) { pass=false; fails.push('sidebar preview missing interests content'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — INTERESTS-RICH-BLOCK-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  interests → rich_block ({b,t}+leadColon, 6 rows, no l/v remnant); sidebar renders; zero app errors.');
