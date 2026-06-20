/* VERIFICATION — PUBLICATIONS-MAIN-001 Phase 3 (per-row controls + section bar).
 * Open the rich Publications editor and assert: the whole-section bar (move · CJLR-all · hide) and
 * the per-row controls (Page · CJLR · Enhance · Fit) render; clicking a row's Page cycles
 * antcv:itemPages[sid] and clicking its CJLR cycles antcvItemAlignment[sid]["items.0"]. */
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
    'Integration of Suspended Carbon Nanotubes — J. Smith, Journal of MEMS, 2009',
    'Carbon Nanotube Integration — A. Karp, Nano Letters',
  ] },
], cl:[] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}'); localStorage.setItem('antcvItemAlignment','{}');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

// open the pubs editor
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/Sections/i.test(b.textContent||'')); if(b) b.click(); });
await page.waitForTimeout(1200);
await page.evaluate(()=>{ const r=[...document.querySelectorAll('[data-section-row-loc]')].find(r=>/PUBLICATIONS & PATENTS/i.test(r.textContent||'')); if(r) r.click(); });
await page.waitForTimeout(2000);

const present = await page.evaluate(()=>{
  const btns = [...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim());
  return {
    fiveFields: ['Authors','Year / date','Pages'].every(p=>[...document.querySelectorAll('input')].some(i=>i.placeholder===p)),
    sectionMove: btns.some(t=>/To sidebar|To main/.test(t)),
    sectionCjlrAll: btns.some(t=>/All$/.test(t)),
    sectionHide: btns.some(t=>/Section$/.test(t)),
    rowPage: btns.some(t=>/^P[1-4]$/.test(t)),
    rowEnhance: btns.includes('✨'),
    rowFit: btns.includes('⇥'),
    rowCjlr: btns.some(t=>['↔','☰','⇤','⇥'].includes(t)),
  };
});

// click row-0 Page once, row-0 CJLR once → stores update
await page.evaluate(()=>{
  const pageBtn = [...document.querySelectorAll('button')].find(b=>/^P[1-4]$/.test((b.textContent||'').trim()));
  if (pageBtn) pageBtn.click();
});
await page.waitForTimeout(400);
await page.evaluate(()=>{
  const al = [...document.querySelectorAll('button')].find(b=>['↔','☰','⇤'].includes((b.textContent||'').trim()));
  if (al) al.click();
});
await page.waitForTimeout(600);

const stores = await page.evaluate(()=>{
  const pg = JSON.parse(localStorage.getItem('antcv:itemPages')||'{}');
  const al = JSON.parse(localStorage.getItem('antcvItemAlignment')||'{}');
  return { pubsPages: pg.pubs || null, pubsAlign: al.pubs || null };
});
await browser.close(); await new Promise(r=>server.close(r));

console.log('controls present:', JSON.stringify(present));
console.log('stores after clicks:', JSON.stringify(stores));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!present.fiveFields) { pass=false; fails.push('5-field editor not rendered'); }
if (!present.sectionMove) { pass=false; fails.push('section bar: move main↔sidebar missing'); }
if (!present.sectionCjlrAll) { pass=false; fails.push('section bar: CJLR-all missing'); }
if (!present.sectionHide) { pass=false; fails.push('section bar: hide/show section missing'); }
if (!present.rowPage) { pass=false; fails.push('per-row Page control missing'); }
if (!present.rowEnhance) { pass=false; fails.push('per-row Enhance control missing'); }
if (!present.rowFit) { pass=false; fails.push('per-row Fit control missing'); }
if (!present.rowCjlr) { pass=false; fails.push('per-row CJLR control missing'); }
if (!stores.pubsPages || !(stores.pubsPages['0'] >= 2 || stores.pubsPages['items.0'] >= 2)) { pass=false; fails.push('Page click did not write antcv:itemPages[pubs]: '+JSON.stringify(stores.pubsPages)); }
if (!stores.pubsAlign || !stores.pubsAlign['items.0']) { pass=false; fails.push('CJLR click did not write antcvItemAlignment[pubs]["items.0"]: '+JSON.stringify(stores.pubsAlign)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — PUBLICATIONS-MAIN-001 Phase 3 (controls)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  section bar + per-row Page/CJLR/Enhance/Fit render; Page & CJLR clicks persist to the standard stores.');
