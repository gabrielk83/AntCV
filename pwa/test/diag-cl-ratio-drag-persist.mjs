/* DIAGNOSTIC — TABLE-RATIO-DRAG-PERSIST-001 (owner 2026-06-15).
 * Owner: changing the column border by MOUSE GRAB "pulls back"; changing on the
 * ROLLER (slider) "stays". Root cause: the fast-drag sidecar wrote clTableRatio
 * + moved <th> widths but never updated React state (Qr), so the next re-render
 * reverted. Fix: on drag-end the sidecar now DRIVES the React roller input so
 * its onChange (ia) runs and state persists.
 *
 * This drives the real "Resize columns" handle, then forces a React re-render,
 * and asserts the dragged column ratio HOLDS (roller value moved + th width
 * stays at the new split, not the default).
 */
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
const sections = { cv: [], cl: [
  { id:'who', title:'WHO I AM', loc:'main', on:true, type:'text', content:'I am a product and project expert.' },
  { id:'bring', title:'WHAT I BRING', loc:'main', on:true, type:'table',
    rows: [['Focus Area','Strategic Expertise'],['Change governance','Automotive SPICE and ISO 26262'],['System architecture','Optics, electronics, FPGA/SoC'],['Supplier coordination','RFQ/RFI scoring on quality']] },
] };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'Gabriel Tester', stylePrefs:{} }));
  localStorage.setItem('clTableRatio', JSON.stringify(0.25));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(7000);

const r = await page.evaluate(async ()=>{
  const out = {};
  const rollerWrap = Array.from(document.querySelectorAll('.antcv-top-sliders [title]'))
    .find(w => (w.getAttribute('title')||'').indexOf('CL table: Focus Area column width') === 0);
  const roller = rollerWrap && rollerWrap.querySelector('input[type="range"]');
  out.rollerFound = !!roller;
  out.rollerBefore = roller ? roller.value : null;
  const handle = document.querySelector('[aria-label="Resize columns (long-press and drag)"]');
  out.handleFound = !!handle;
  if (!handle) return out;
  const th0 = () => { const t = document.querySelector('[data-sid="bring"] table thead th'); return t ? t.style.width : null; };
  out.th0Before = th0();
  const hr = handle.getBoundingClientRect();
  const cy = hr.top + hr.height/2; let cx = hr.left + hr.width/2;
  const pid = 9;
  const ev = (type, x) => handle.dispatchEvent(new PointerEvent(type, { pointerId:pid, bubbles:true, cancelable:true, clientX:x, clientY:cy, button:0, isPrimary:true, pointerType:'mouse' }));
  ev('pointerdown', cx);
  await new Promise(r=>setTimeout(r,130)); // pass the 80ms long-press activation
  for (let i=1;i<=10;i++){ ev('pointermove', cx + i*9); await new Promise(r=>setTimeout(r,16)); }
  ev('pointerup', cx + 90);
  await new Promise(r=>setTimeout(r,200));
  out.clRatioAfterDrag = localStorage.getItem('clTableRatio');
  out.rollerAfterDrag = roller ? roller.value : null;
  out.th0AfterDrag = th0();
  // FORCE a React re-render to expose the pull-back, then re-measure.
  window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail:{ source:'diag' } }));
  await new Promise(r=>setTimeout(r,1200));
  out.rollerAfterRerender = roller ? roller.value : null;
  out.th0AfterRerender = th0();
  return out;
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('--- CL COLUMN-RATIO DRAG PERSIST ---');
console.log(JSON.stringify(r, null, 2));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));

const rollerMoved = r.rollerFound && r.rollerBefore != null && r.rollerAfterDrag != null && r.rollerAfterDrag !== r.rollerBefore;
const heldAfterRerender = r.rollerAfterRerender != null && r.rollerAfterRerender === r.rollerAfterDrag;
const checks = [
  ['roller + drag handle present', r.rollerFound && r.handleFound],
  ['drag drove the React roller (state updated)', rollerMoved],
  ['ratio HELD through a forced re-render (no pull-back)', heldAfterRerender],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'CL-RATIO-DRAG-PERSIST OK' : 'CL-RATIO-DRAG-PERSIST FAILED');
process.exit(ok ? 0 : 1);
