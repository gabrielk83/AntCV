/* VERIFICATION — RICH-BLOCK-001 Phase B. Inject a CV with a legacy `foundation` section.
 * Assert antcv-foundation-to-rich-block-758.js converts it to a `rich_block` with two rows
 * (Hands-on / Professionally), keeping id/title/loc, and that it renders as bold-lead
 * paragraphs in the preview with the FOUNDATION title shown. */
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
  { id:'foundation', title:'FOUNDATION', loc:'main', on:true, type:'foundation',
    hands_on:'I have built and operated MEMS test rigs end to end.',
    professionally:'That translates into disciplined product ownership.' },
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

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const f = (secs.cv||[]).find(s=>s.id==='foundation');
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  const bolds = [...document.querySelectorAll('.antcv-preview-paper b')].map(b=>(b.textContent||'').trim());
  return {
    type: f && f.type,
    rowCount: f && Array.isArray(f.items) ? f.items.length : -1,
    leads: f && Array.isArray(f.items) ? f.items.map(x=>x.b) : [],
    bodies: f && Array.isArray(f.items) ? f.items.map(x=>x.t) : [],
    noLegacyFields: f ? (f.hands_on === undefined && f.professionally === undefined) : false,
    title: /FOUNDATION/.test(txt),
    previewBody: /built and operated/.test(txt) && /disciplined product ownership/.test(txt),
    previewBolds: bolds.filter(x=>/Hands-on|Professionally/.test(x)),
  };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log(JSON.stringify(r,null,2));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.type !== 'rich_block') { pass=false; fails.push('foundation NOT converted (type='+r.type+')'); }
if (r.rowCount !== 2) { pass=false; fails.push('expected 2 rows, got '+r.rowCount); }
if (JSON.stringify(r.leads) !== JSON.stringify(['Hands-on','Professionally'])) { pass=false; fails.push('leads wrong: '+JSON.stringify(r.leads)); }
if (!/built and operated/.test(r.bodies[0]||'') ) { pass=false; fails.push('hands_on body not migrated'); }
if (!r.noLegacyFields) { pass=false; fails.push('legacy hands_on/professionally fields not removed'); }
if (!r.title) { pass=false; fails.push('FOUNDATION title not shown in preview'); }
if (!r.previewBody) { pass=false; fails.push('migrated bodies not in preview'); }
if (r.previewBolds.length < 2) { pass=false; fails.push('lead-ins not bold in preview: '+JSON.stringify(r.previewBolds)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICH-BLOCK-001 Phase B (foundation → rich_block)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  foundation converted to a rich_block with two bold-lead rows; renders in preview with title + bold leads.');
