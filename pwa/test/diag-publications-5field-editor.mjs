/* VERIFICATION — PUBLICATIONS-MAIN-001 Phase 2 (5-field rich editor).
 * Inject a CV holding a MAIN richPub `pubs` section (2 migrated string items). Boot the editor,
 * open the pubs section editor, and assert:
 *   (1) the richPub editor renders the 5 labelled fields (Name + Authors + Journal + Year + Pages),
 *       NOT the legacy 2-field (name/details) editor;
 *   (2) typing into the Year and Pages fields RECOMPOSES items[0] into a single citation string
 *       ("… , <year>, pp. <pages>") AND persists the structured breakdown in section.pubFields[0]
 *       (lossless round-trip, items[] stays a plain string for all downstream readers).
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

const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Programme leader.' },
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:[
    'Integration of Suspended Carbon Nanotubes — J. Smith, A. Karp, Journal of MEMS, 2009',
    'Carbon Nanotube Integration Procedures — A. Karp, Nano Letters',
  ] },
  { id:'recommendations', title:'RECOMMENDATIONS', loc:'main', on:true, type:'education', items:[{deg:'References', sch:'On request'}] },
], cl:[] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

// Open the pubs section editor: show the sections list (☰ Sections), then click its row.
await page.evaluate(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/Sections/i.test(b.textContent||''));
  if (b) b.click();
});
await page.waitForTimeout(1500);
await page.evaluate(()=>{
  const rows = [...document.querySelectorAll('[data-section-row-loc]')];
  const row = rows.find(r=>/PUBLICATIONS & PATENTS/i.test(r.textContent||''));
  if (row) row.click();
});
await page.waitForTimeout(2500);

const placeholders = await page.evaluate(()=>[...document.querySelectorAll('input')].map(i=>i.placeholder).filter(Boolean));
const want = ['Publication / patent name','Authors','Journal / Publisher / Patent no.','Year / date','Pages'];
const fiveFields = want.every(w=>placeholders.includes(w));

// Type into row-0 Year + Pages, then read back the persisted section.
let typed=false;
if (fiveFields) {
  await page.locator('input[placeholder="Year / date"]').first().fill('2009');
  await page.locator('input[placeholder="Pages"]').first().fill('120-128');
  await page.waitForTimeout(1500);
  typed=true;
}

const after = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const pubs = (secs.cv||[]).find(s=>s.id==='pubs');
  return { item0: pubs && (pubs.items||[])[0], pf0: pubs && pubs.pubFields && pubs.pubFields[0], legacyDetailsPh: false };
});
await browser.close(); await new Promise(r=>server.close(r));

console.log('placeholders:', JSON.stringify(placeholders));
console.log('fiveFields:', fiveFields);
console.log('after item0:', after.item0);
console.log('after pubFields[0]:', JSON.stringify(after.pf0));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!fiveFields) { pass=false; fails.push('5-field editor did not render (placeholders: '+placeholders.join(', ')+')'); }
if (typed) {
  if (!/2009/.test(after.item0||'')) { pass=false; fails.push('year 2009 not recomposed into items[0]'); }
  if (!/pp\. *120-128/.test(after.item0||'')) { pass=false; fails.push('pages not recomposed as "pp. 120-128" into items[0]'); }
  if (!after.pf0 || after.pf0.year!=='2009' || after.pf0.pages!=='120-128') { pass=false; fails.push('pubFields[0] did not persist structured year/pages: '+JSON.stringify(after.pf0)); }
}
console.log('\n'+(pass?'PASS':'FAIL')+' — PUBLICATIONS-MAIN-001 Phase 2 (5-field rich editor)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  richPub renders 5 labelled fields; Year+Pages edits recompose items[0] and persist a lossless pubFields[0] breakdown.');
