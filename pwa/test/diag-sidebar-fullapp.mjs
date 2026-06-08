/* DIAGNOSTIC (not a committed test) — PB-PREVIEW-SIDEBAR-SALMON-PUSH-001.
 * Full-app render. A LONG sidebar labeled_list (REGULATORY CONTEXT, grouped,
 * one hidden group) overflows the A4 line; the MAIN column is SHORT. Checks:
 *   (A) the measurer writes antcv:autoPagesPreview for the sidebar section,
 *   (B) the preview splits into >1 page-box (sidebar flows THROUGH the salmon),
 *   (C) every page-box height <= A4 (~1123px) → salmon NOT pushed below A4.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

// Build a grouped REGULATORY CONTEXT sidebar whose FIRST group alone overflows
// the A4 line — so the first overflow item snaps back to group-start 0 and (pre-fix)
// NO break is written → whole sidebar renders in one page-box and pushes the salmon.
const reg = [];
const GROUPS = ['Sensing & imaging', 'Optics & photonics', 'Materials'];
for (let g = 0; g < GROUPS.length; g++) {
  reg.push({ group: GROUPS[g] });
  const per = g === 0 ? 16 : 4;   // first group huge
  for (let e = 0; e < per; e++) reg.push({ l: 'Reg ' + g + '.' + e, v: 'Detailed regulatory context line describing the applicable framework, scope and obligations in some depth across several wrapped lines of text.' });
}

const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Short profile line.' },
    { id:'regctx', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: reg },
  ],
  cl: [],
};
const personalInfo = { name:'Anita Myre-Kornfeldt', headline:'Regulatory Affairs', email:'a@example.com', phone:'+45 00 00 00 00', location:'Copenhagen' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token', 'diag-token');
  localStorage.setItem('antcv:auth:email', 'diag@example.com');
  localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'diag@example.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}');
  localStorage.setItem('antcv:autoPagesPreview','{}');
  localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);

const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t)) errs.push('console.error: '+t);} });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
await page.waitForTimeout(6000);

const r = await page.evaluate(()=>{
  const boxes = Array.from(document.querySelectorAll('.antcv-page-row'));
  const boxHeights = boxes.map(b=>Math.round(b.getBoundingClientRect().height));
  const sidebars = Array.from(document.querySelectorAll('.antcv-document-sidebar')).map(s=>Math.round(s.getBoundingClientRect().height));
  const j=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'{}');}catch(_){return {};}};
  // count regctx rows rendered per page-box
  const regPerBox = boxes.map(b=>b.querySelectorAll('.antcv-document-sidebar [data-antcv-row-path^="items."]').length);
  return { pageRows: boxes.length, boxHeights, sidebars, regPerBox, autoPages:j('antcv:autoPages'), autoPagesPreview:j('antcv:autoPagesPreview') };
});

await browser.close();
await new Promise(r=>server.close(r));

console.log('page-boxes:', r.pageRows);
console.log('page-box heights:', JSON.stringify(r.boxHeights));
console.log('sidebar col heights:', JSON.stringify(r.sidebars));
console.log('regctx rows per box:', JSON.stringify(r.regPerBox));
console.log('antcv:autoPages       :', JSON.stringify(r.autoPages));
console.log('antcv:autoPagesPreview:', JSON.stringify(r.autoPagesPreview));
console.log('app errors:', errs.length, errs.join(' | '));
const A = r.autoPagesPreview && r.autoPagesPreview.regctx && Object.keys(r.autoPagesPreview.regctx).length>0;
const B = r.pageRows > 1;
const C = r.boxHeights.every(h=>h<=1140); // A4 page-box ~1123 + small tolerance
console.log(`CHECK A (preview map has sidebar break): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (preview split into >1 page-box): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (no page-box taller than A4): ${C?'PASS':'FAIL'}`);
console.log(errs.length===0 && A && B && C ? 'SIDEBAR-PUSH FIXED' : 'SIDEBAR-PUSH REPRODUCED (bug present)');
