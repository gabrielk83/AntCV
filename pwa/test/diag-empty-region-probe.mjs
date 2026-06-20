/* DIAGNOSTIC (read-only probe) — SALMON-EMPTY-REGION-001 cause.
 * Renders a CV where the MAIN column breaks (experience → page 2) and the SIDEBAR is shorter on
 * page 1, then measures page-row[0]: its box height vs each column's content height vs the
 * min-height style — to determine if the empty region is (a) min-height padding the row beyond
 * its content, or (b) the shorter column's intrinsic gap within a content-height row.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

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
await page.waitForTimeout(11000);

const r = await page.evaluate(()=>{
  const rows = document.querySelectorAll('.antcv-page-row');
  if (!rows.length) return { err:'no page-rows' };
  const r0 = rows[0];
  const cs = getComputedStyle(r0);
  const box = r0.getBoundingClientRect().height;
  const main = r0.querySelector('.antcv-document-main, [data-antcv-document-main="true"]');
  const side = r0.querySelector('.antcv-document-sidebar, [data-antcv-document-sidebar="true"]');
  const colH = (el)=>{ if(!el) return null; // measure content height = last visible child bottom - col top
    const top = el.getBoundingClientRect().top; let maxB = top;
    el.querySelectorAll('*').forEach(c=>{ const b=c.getBoundingClientRect().bottom; if(b>maxB && c.getBoundingClientRect().height>0) maxB=b; });
    return Math.round(maxB - top); };
  return {
    pageRows: rows.length,
    row0BoxH: Math.round(box),
    row0MinHeight: cs.minHeight,
    mainContentH: colH(main),
    sideContentH: colH(side),
  };
});
await browser.close(); await new Promise(r=>server.close(r));

console.log(JSON.stringify(r, null, 2));
if (r.err) { console.log('PROBE FAILED:', r.err); process.exitCode = 1; }
else {
  const padded = r.row0BoxH - Math.max(r.mainContentH||0, r.sideContentH||0);
  console.log(`\nrow0 box height: ${r0h(r)}  | taller column content: ${Math.max(r.mainContentH||0,r.sideContentH||0)}`);
  console.log(`=> box exceeds content by ~${padded}px  (min-height: ${r.row0MinHeight})`);
  console.log(padded > 40
    ? 'DIAGNOSIS: min-height PADS the row beyond content → Option A = relax min-height for short rows (easy, sidecar antcv-page-fit).'
    : 'DIAGNOSIS: row is already content-height → the gap is the SHORTER COLUMN intrinsic gap (compact-vs-PDF), not min-height.');
  console.log(`sidebar shorter than main by ~${(r.mainContentH||0)-(r.sideContentH||0)}px (the visible empty region under the sidebar).`);
}
function r0h(r){ return r.row0BoxH; }
