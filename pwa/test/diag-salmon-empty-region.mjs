/* VERIFICATION — SALMON-EMPTY-REGION-001 (1.50.753).
 * A 2-page CV whose MAIN column breaks to page 2 and whose SIDEBAR is short on page 1.
 * Asserts:
 *   (1) the NON-LAST page-row collapses to its main CONTENT height (~931, not the padded 1123);
 *   (2) the LAST page-row keeps the full A4 height (1123) — the final sheet still looks like a page;
 *   (3) the salmon separator (▼ PAGE 2 ▼, first child of box[1]) sits FLUSH under the page-1 content
 *       (gap < 40px), not ~190px below it;
 *   (4) the layout is STABLE across many re-measure cycles (no oscillation / breathing).
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

const lb = (n)=>`Bullet ${n} — drove a cross-functional initiative restructuring the operating model, delivering measurable outcomes across regions while cutting cycle time and cost over a multi-quarter programme.`;
const role = (i)=>({ id:'r'+i, title:'Role '+i, company:'Co '+i, years:'201'+i+'–201'+(i+2), on:true, bullets:[lb(1),lb(2),lb(3),lb(4)] });
const roles=[]; for(let i=1;i<=5;i++) roles.push(role(i));
const skills=[]; for(let i=1;i<=5;i++) skills.push({l:'Skill '+i,v:'Skill '+i});  // SHORT sidebar
const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Programme leader. '.repeat(6) },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'skills', title:'KEY SKILLS', loc:'sidebar', on:true, type:'labeled_list', items: skills },
], cl:[] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com');
  localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(12000);

const measure = ()=>page.evaluate(()=>{
  const rows = [...document.querySelectorAll('.antcv-page-row')];
  if (!rows.length) return { err:'no page-rows' };
  const colContentH = (el)=>{ if(!el) return null; const top=el.getBoundingClientRect().top; let maxB=top;
    for (const c of el.children){ const rc=c.getBoundingClientRect(); if(rc.height>0&&rc.bottom>maxB) maxB=rc.bottom; } return Math.ceil(maxB-top); };
  const row0 = rows[0], rowL = rows[rows.length-1];
  const main0 = row0.querySelector('.antcv-document-main,[data-antcv-document-main="true"]');
  // salmon = the red "▼ PAGE 2 ▼" strip. It is the first child of the 2nd page-box.
  // page-boxes are <div key=page-N> siblings; find the one containing rows[1], take its top.
  let salmonTop = null;
  if (rows[1]) {
    let box1 = rows[1].parentElement; // .antcv-page-row's wrapper -> page-box
    // climb until the previous sibling exists (the page-box level under the boxes container)
    while (box1 && box1.previousElementSibling == null && box1.parentElement) box1 = box1.parentElement;
    const sep = box1 && box1.firstElementChild;
    if (sep) salmonTop = Math.round(sep.getBoundingClientRect().top);
  }
  const row0Bottom = Math.round(row0.getBoundingClientRect().bottom);
  const main0Bottom = main0 ? Math.round(main0.getBoundingClientRect().top + colContentH(main0)) : null;
  return {
    pageRows: rows.length,
    row0BoxH: Math.round(row0.getBoundingClientRect().height),
    rowLastBoxH: Math.round(rowL.getBoundingClientRect().height),
    main0ContentH: colContentH(main0),
    salmonTop, main0Bottom, row0Bottom,
    salmonGapFromContent: (salmonTop!=null && main0Bottom!=null) ? salmonTop - main0Bottom : null,
  };
});

const samples = [];
for (let i=0;i<6;i++){ samples.push(await measure()); await page.waitForTimeout(900); }
await browser.close(); await new Promise(r=>server.close(r));

const last = samples[samples.length-1];
console.log('samples:'); samples.forEach((s,i)=>console.log('  #'+i, JSON.stringify(s)));

let pass = true; const fails = [];
if (last.err){ pass=false; fails.push(last.err); }
else {
  if (last.pageRows < 2){ pass=false; fails.push('expected >=2 page-rows, got '+last.pageRows); }
  if (!(last.row0BoxH < 1050)){ pass=false; fails.push('row0 box did not collapse to content (got '+last.row0BoxH+', want <1050)'); }
  if (Math.abs(last.row0BoxH - last.main0ContentH) > 30){ pass=false; fails.push('row0 box != main content (box '+last.row0BoxH+' vs content '+last.main0ContentH+')'); }
  if (Math.abs(last.rowLastBoxH - 1123) > 4){ pass=false; fails.push('last row not A4 (got '+last.rowLastBoxH+', want 1123)'); }
  if (last.salmonGapFromContent != null && last.salmonGapFromContent > 40){ pass=false; fails.push('salmon not flush (gap '+last.salmonGapFromContent+'px > 40)'); }
  // STABILITY: row0 box height must not oscillate across the last 4 samples.
  const stab = samples.slice(2).map(s=>s.row0BoxH);
  const spread = Math.max(...stab) - Math.min(...stab);
  if (spread > 4){ pass=false; fails.push('row0 box OSCILLATES across cycles (spread '+spread+'px: '+stab.join(',')+')'); }
}
console.log('\n'+(pass?'PASS':'FAIL')+' — SALMON-EMPTY-REGION-001');
if (!pass){ fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode = 1; }
else { console.log('  row0 collapsed to '+last.row0BoxH+'px (content '+last.main0ContentH+'), last row '+last.rowLastBoxH+'px A4, salmon gap '+last.salmonGapFromContent+'px, stable.'); }
