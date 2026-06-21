/* VERIFICATION — RICHPUB-CJLR-001. The richPub list_italic PREVIEW must honour per-row alignment
 * from antcvItemAlignment[sid] (items.<n> / __group__), not a hard-coded justify. Inject a richPub
 * section with row 0 = center and a section __group__ = right; assert the rendered rows reflect it. */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Lead.' },
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:[
    'PUBROW_A — J. Smith, Journal of MEMS, 2009',
    'PUBROW_B — A. Karp, Nano Letters, 2011',
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
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}');
  // row 0 = center; section group = right (row 1 has no per-row → falls back to __group__ = right)
  localStorage.setItem('antcvItemAlignment', JSON.stringify({ pubs:{ '__group__':'right', 'items.0':'center' } }));
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(()=>{
  // the row div is the direct parent of the <b><i>title</i></b>
  const rowFor = (txt)=>{ const b=[...document.querySelectorAll('.antcv-preview-paper b')].find(el=>(el.textContent||'').includes(txt)); return (b && b.parentElement) ? b.parentElement : null; };
  const a = rowFor('PUBROW_A'); const b = rowFor('PUBROW_B');
  return { aAlign: a ? getComputedStyle(a).textAlign : null, bAlign: b ? getComputedStyle(b).textAlign : null };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('row aligns:', JSON.stringify(r));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.aAlign !== 'center') { pass=false; fails.push('row 0 should be center (per-row), got '+r.aAlign); }
if (r.bAlign !== 'right') { pass=false; fails.push('row 1 should be right (section __group__ fallback), got '+r.bAlign); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICHPUB-CJLR-001 (preview honours per-row + section alignment)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  richPub preview rows honour per-row items.<n> + section __group__ alignment (export already did via renderSimpleList).');
