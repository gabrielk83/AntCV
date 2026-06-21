/* VERIFICATION — HWIC intro/closure fix + interests/additional restore.
 * (1) HWIC generated shape: contribute with items=[intro, b, b, closing] (no intro/closing fields) ->
 *     rich_block where row0=intro (no marker), middle=bullets (mk), last=closing (no marker).
 * (2) HWIC repair: a contribute ALREADY rich_block with all-marker rows -> first+last lose their mk.
 * (3) interests restore: `additional` (labeled_list) is NOT converted to rich_block (so 415 can split
 *     it into Interests), and a mis-converted rich_block `additional` is restored to labeled_list. */
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
  // additional already MIS-converted to rich_block (simulates production 1.50.763) — must be restored.
  { id:'additional', title:'ADDITIONAL', loc:'sidebar', on:true, type:'rich_block', leadColon:true, items:[
    { b:'Hobbies', t:'Rugby, hiking' }, { b:'Driving licence', t:'Yes' },
  ] },
], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Team,' },
  // generated HWIC shape: everything in items[], no intro/closing fields.
  { id:'contribute', title:'HOW I WOULD CONTRIBUTE', loc:'main', on:true, type:'text_bullets', items:[
    { content:'INTRO_X my first priorities would be:' },
    { content:'BULLET_A learn the architecture' },
    { content:'BULLET_B map the gaps' },
    { content:'CLOSING_X so the team gains traceability.' },
  ] },
] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(10000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const c = (secs.cl||[]).find(s=>s.id==='contribute');
  const add = (secs.cv||[]).find(s=>s.id==='additional');
  const intr = (secs.cv||[]).find(s=>s.id==='interests');
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return {
    cType: c && c.type,
    cRows: c && Array.isArray(c.items) ? c.items.map(x=>({ t:(x.t||'').slice(0,8), mk:!!x.mk })) : [],
    addType: add && add.type,
    interestsExists: !!intr,
    interestsHasHobby: intr ? JSON.stringify(intr.items||[]).match(/Rugby|hiking/i)!==null : false,
    previewHasRugby: /Rugby/i.test(txt),
  };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log(JSON.stringify(r,null,1));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
// HWIC: 4 rows = intro(no mk), b(mk), b(mk), closing(no mk)
if (r.cType !== 'rich_block') { pass=false; fails.push('contribute not rich_block'); }
if (r.cRows.length !== 4) { pass=false; fails.push('expected 4 HWIC rows, got '+r.cRows.length+': '+JSON.stringify(r.cRows)); }
if (r.cRows[0] && r.cRows[0].mk) { pass=false; fails.push('HWIC intro should have NO marker'); }
if (r.cRows[3] && r.cRows[3].mk) { pass=false; fails.push('HWIC closing should have NO marker'); }
if (r.cRows.slice(1,3).some(x=>!x.mk)) { pass=false; fails.push('HWIC middle rows should be markered bullets'); }
if (r.cRows[0] && !/INTRO_X/.test(r.cRows[0].t)) { pass=false; fails.push('HWIC intro text missing'); }
// additional restored to labeled_list (so 415 splits it -> Interests populated with the hobby)
if (r.addType !== 'labeled_list') { pass=false; fails.push('additional NOT restored to labeled_list (got '+r.addType+') — Interests would stay empty'); }
if (!(r.interestsHasHobby || r.previewHasRugby)) { pass=false; fails.push('Interests NOT repopulated from additional (415 split): interestsExists='+r.interestsExists+' hasHobby='+r.interestsHasHobby+' preview='+r.previewHasRugby); }
console.log('\n'+(pass?'PASS':'FAIL')+' — HWIC intro/closure + interests/additional restore');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  HWIC generated shape -> intro/closing markerless + bullets markered; mis-converted additional restored to labeled_list so 415 re-populates Interests.');
