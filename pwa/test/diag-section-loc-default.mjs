/* DIAGNOSTIC — SECTION-PREVIEW-LOC-001 (owner 2026-06-15: "new sections visible
 * in DOCX but not preview"). A section whose `loc` is missing/invalid renders in
 * neither preview column (preview filters "main"===loc / "sidebar"===loc) but
 * DOES export (no loc filter). antcv-sections-normalize-415.js now stamps
 * loc:'main' on any section with an invalid loc. This boots the editor with a
 * loc-less main-content section and asserts: (1) 415 rewrites its loc to 'main';
 * (2) its content then renders in the preview. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const MARKER = 'ZZLOCLESSMARKER electro free-text content';
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Profile text.' },
  // loc-less section (as an import/parse can produce): should be stamped main + render.
  { id:'work_style', title:'WORK STYLE', on:true, type:'text', content: MARKER },
  { id:'tools', title:'TOOLS', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Eng',v:'Python'}] },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'Gabriel Tester' }));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
// 415 boot sweep fires at 400/1200/3000ms + poll; give it time.
await page.waitForTimeout(5000);

const r = await page.evaluate((marker)=>{
  let locAfter = null, typeAfter = null;
  try { const b = JSON.parse(localStorage.getItem('sections')||'{}'); const ws = (b.cv||[]).find(s=>s.id==='work_style'); locAfter = ws ? ws.loc : '(missing section)'; typeAfter = ws ? ws.type : null; } catch(_) { locAfter='ERR'; }
  const rendered = document.body.innerText.includes('ZZLOCLESSMARKER');
  // the text_inline render emits a bold "WORK STYLE:" / "Work style:" inline label
  const labelRendered = /work style:/i.test(document.body.innerText);
  return { locAfter, typeAfter, rendered, labelRendered };
}, MARKER);
await browser.close(); await new Promise(r2=>server.close(r2));

console.log('--- SECTION-PREVIEW-LOC-001 + TYPE-NORMALIZE-INLINE-001 ---');
console.log('work_style loc after 415:', r.locAfter, '| type after 415:', r.typeAfter);
console.log('loc-less section renders in preview:', r.rendered, '| inline label rendered:', r.labelRendered);
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['415 stamped loc=main', r.locAfter === 'main'],
  ['415 promoted work_style text→text_inline', r.typeAfter === 'text_inline'],
  ['loc-less section now renders in preview', r.rendered === true],
  ['work_style inline label renders', r.labelRendered === true],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'SECTION-LOC-DEFAULT OK' : 'SECTION-LOC-DEFAULT FAILED');
process.exit(ok ? 0 : 1);
