/* VERIFICATION — PUBLICATIONS-MAIN-001 (1.50.757) Phase 1.
 * Inject a CV holding the OLD sidebar `publications` (list_italic, 4 string items) plus experience
 * and recommendations. Assert antcv-publications-main-757.js:
 *   (1) creates a new MAIN `pubs` section (richPub) and DROPS the old sidebar one;
 *   (2) places it BETWEEN experience and recommendations;
 *   (3) migrates all old items across;
 *   (4) renders the FULL citation in the preview (richPub skips the year-only strip) — i.e. the
 *       journal/authors text survives, not just the year.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const PUBS = [
  'Integration of Suspended Carbon Nanotubes into Micro-Fabricated Devices — J. Smith, A. Karp, Journal of MEMS, 2009',
  'Carbon Nanotube Integration Procedures into NEMS Devices — A. Karp, Nano Letters, 2008',
  'A Nanomanipulator with Integrated Mechanical De-amplifier — A. Karp et al., Review of Scientific Instruments, 2010',
  'Patent No. 241997 / US Patent Application No. 20190072836 — Co-inventor, 2018',
];
const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Programme leader.' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[
    { id:'r1', title:'Product Expert', company:'Kanzen', years:'2022-2026', on:true, bullets:['Did things.'] },
  ] },
  { id:'recommendations', title:'RECOMMENDATIONS', loc:'main', on:true, type:'education', items:[{deg:'References', sch:'Available on request'}] },
  { id:'publications', title:'PUBLICATIONS & PATENT', loc:'sidebar', on:true, type:'list_italic', items: PUBS },
  { id:'education', title:'EDUCATION', loc:'sidebar', on:true, type:'education', items:[{deg:'BSc', sch:'DTU'}] },
], cl:[] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(12000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const cv = secs.cv||[];
  const ids = cv.map(s=>s.id);
  const pubs = cv.find(s=>s.id==='pubs');
  const oldPub = cv.find(s=>s.id==='publications');
  const expIdx = cv.findIndex(s=>s.type==='experience');
  const recIdx = cv.findIndex(s=>s.id==='recommendations');
  const pubsIdx = cv.findIndex(s=>s.id==='pubs');
  // preview: read the rendered PUBLICATIONS & PATENTS section text in the main column
  const heads = [...document.querySelectorAll('.antcv-preview-paper *')].filter(el=>/PUBLICATIONS & PATENT/i.test(el.textContent||'') && (el.textContent||'').length<40);
  let previewText = '';
  // find the rendered citation lines (contain a known author/journal token)
  const allText = ([...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n'));
  return {
    ids,
    hasNewPubs: !!pubs,
    pubsLoc: pubs && pubs.loc,
    pubsRichPub: pubs && pubs.richPub === true,
    pubsItemCount: pubs && (pubs.items||[]).length,
    oldGone: !oldPub,
    placedBetween: (pubsIdx>expIdx && (recIdx<0 || pubsIdx<=recIdx)),
    previewHasJournal: /Journal of MEMS|Nano Letters|Review of Scientific/i.test(allText),
    previewHasYearOnlyStrip: /PUBLICATIONS & PATENTS[\s\S]{0,400}/.test(allText) && !/Journal of MEMS/i.test(allText),
  };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log(JSON.stringify(r,null,2));

let pass = true; const fails = [];
if (!r.hasNewPubs) { pass=false; fails.push('new pubs section not created'); }
if (r.pubsLoc !== 'main') { pass=false; fails.push('pubs not in main (loc='+r.pubsLoc+')'); }
if (!r.pubsRichPub) { pass=false; fails.push('pubs not flagged richPub'); }
if (r.pubsItemCount !== 4) { pass=false; fails.push('expected 4 migrated items, got '+r.pubsItemCount); }
if (!r.oldGone) { pass=false; fails.push('old sidebar publications still present'); }
if (!r.placedBetween) { pass=false; fails.push('pubs not placed between experience and recommendations'); }
if (!r.previewHasJournal) { pass=false; fails.push('preview did NOT show full citation (journal text missing — year-only strip not bypassed)'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — PUBLICATIONS-MAIN-001 Phase 1');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode = 1; }
else console.log('  migrated 4 items to a main richPub section between experience & recommendations; old retired; full citations render.');
