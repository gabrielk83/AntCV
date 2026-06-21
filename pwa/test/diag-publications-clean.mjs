/* VERIFICATION — PUB-CLEAN-001. Migrated citations carried HTML bold/italic + smart quotes around the
 * title (<b>"Title"</b> — …). Assert: (1) the 757 pass strips them from the stored item; (2) the
 * 5-field editor's seedPF parses the detail blob into Authors / Journal / Year (not crammed). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const dirty = '<b>"Integration of Suspended Carbon Nanotubes"</b> — Gabriel A. Karp et al., J. Micromechanics & Microengineering, 2009';
const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:[ dirty ] },
  { id:'recommendations', title:'RECOMMENDATIONS', loc:'main', on:true, type:'education', items:[{deg:'Refs',sch:'On request'}] },
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

// stored item should be cleaned
const stored = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const p = (secs.cv||[]).find(s=>s.id==='pubs');
  return p && p.items && p.items[0];
});
// open the pubs editor and read the field values
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/Sections/i.test(b.textContent||'')); if(b) b.click(); });
await page.waitForTimeout(1200);
await page.evaluate(()=>{ const r=[...document.querySelectorAll('[data-section-row-loc]')].find(r=>/PUBLICATIONS & PATENTS/i.test(r.textContent||'')); if(r) r.click(); });
await page.waitForTimeout(2000);
const fields = await page.evaluate(()=>{
  const val = (ph)=>{ const i=[...document.querySelectorAll('input')].find(i=>i.placeholder===ph); return i?i.value:null; };
  return { name: val('Publication / patent name'), authors: val('Authors'), journal: val('Journal / Publisher / Patent no.'), year: val('Year / date') };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('stored item:', JSON.stringify(stored));
console.log('fields:', JSON.stringify(fields));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (/<b>|<\/b>|<i>/.test(stored||'')) { pass=false; fails.push('stored item still has HTML tags: '+stored); }
if (/^[\s"'“”]/.test(stored||'')) { pass=false; fails.push('stored item still has a leading quote: '+stored); }
if ((stored||'').indexOf('Integration of Suspended Carbon Nanotubes') !== 0) { pass=false; fails.push('title not clean at start: '+stored); }
if (fields.name && (/<b>/.test(fields.name) || /^["“]/.test(fields.name))) { pass=false; fails.push('Name field still shows markup: '+fields.name); }
if (fields.authors !== 'Gabriel A. Karp et al.') { pass=false; fails.push('Authors not parsed (got "'+fields.authors+'")'); }
if (fields.journal !== 'J. Micromechanics & Microengineering') { pass=false; fails.push('Journal not parsed (got "'+fields.journal+'")'); }
if (fields.year !== '2009') { pass=false; fails.push('Year not parsed (got "'+fields.year+'")'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — PUB-CLEAN-001 (HTML/quote strip + author/journal/year parse)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  pub item HTML/quotes stripped; Name clean; seedPF parsed Authors/Journal/Year into separate cells.');
