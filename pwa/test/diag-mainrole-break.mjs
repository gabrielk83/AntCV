/* DIAGNOSTIC (not a committed test) — SALMON-CV-MAINROLE-BREAK-001.
 * Injects an overflowing CV into the preview and checks that:
 *   (A) page-1 experience roles carry data-antcv-role-index (the fix),
 *   (B) the measurer writes antcv:autoPages for the experience section,
 *   (C) the preview splits into >1 page-box (main column breaks with sidebar).
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

const longBullet = (n) => `Bullet ${n} — drove a cross-functional initiative that restructured the operating model, delivering measurable outcomes across multiple regions and stakeholder groups while reducing cycle time and cost over a sustained multi-quarter program of work.`;
const role = (i) => ({ id:'r'+i, title:'Senior Programme Lead '+i, company:'Northwind Logistics '+i, years:'20'+(10+i)+' – 20'+(13+i), on:true, bullets:[longBullet(1),longBullet(2),longBullet(3),longBullet(4)] });
const coreRows = [['Focus','Expertise']];
for (let i=1;i<=12;i++) coreRows.push(['Competency area '+i, 'Detailed expertise statement number '+i+' describing depth and breadth of capability across the domain and adjacent areas.']);
const sbItems = [];
for (let i=1;i<=24;i++) sbItems.push({ l:'Skill or credential line number '+i+' with a reasonably long descriptive label' });

const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Seasoned programme leader with two decades of experience across logistics, operations and transformation. '.repeat(4) },
    { id:'core', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows: coreRows },
    { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles: [role(1),role(2),role(3),role(4),role(5),role(6)] },
    { id:'skills', title:'KEY SKILLS', loc:'sidebar', on:true, type:'labeled_list', items: sbItems },
    { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items: [{l:'Languages: English, Danish, German'},{l:'Citizenship: EU'},{l:'Driving licence: Full, clean'},{l:'Available: Immediately'},{l:'References on request'}] },
  ],
  cl: [],
};
const personalInfo = { name:'Anita Myre-Kornfeldt', headline:'Programme Leadership', email:'a@example.com', phone:'+45 00 00 00 00', location:'Copenhagen' };

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
  localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);

const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t)) errs.push('console.error: '+t);} });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
// Wait for the measurer passes (400/900/1800/3500ms) + a re-render margin.
await page.waitForTimeout(6000);

const r = await page.evaluate(()=>{
  const pageRows = document.querySelectorAll('.antcv-page-row').length;
  const allRoleIdx = Array.from(document.querySelectorAll('[data-antcv-role-index]')).map(e=>e.getAttribute('data-antcv-role-index'));
  const firstBox = document.querySelector('.antcv-page-row');
  const firstBoxRoleIdx = firstBox ? Array.from(firstBox.querySelectorAll('[data-antcv-role-index]')).map(e=>e.getAttribute('data-antcv-role-index')) : [];
  let autoPages={}; try{ autoPages=JSON.parse(localStorage.getItem('antcv:autoPages')||'{}'); }catch(_){}
  return { pageRows, allRoleIdx, firstBoxRoleIdx, autoPages };
});

await browser.close();
await new Promise(r=>server.close(r));

console.log('page-boxes:', r.pageRows);
console.log('all data-antcv-role-index values:', JSON.stringify(r.allRoleIdx));
console.log('page-1 box role indices:', JSON.stringify(r.firstBoxRoleIdx));
console.log('antcv:autoPages:', JSON.stringify(r.autoPages));
console.log('app errors:', errs.length, errs.join(' | '));
const A = r.firstBoxRoleIdx.length > 0;            // fix: page-1 roles are now tagged
const B = r.autoPages && r.autoPages.experience && Object.keys(r.autoPages.experience).length>0;
const C = r.pageRows > 1;
console.log(`CHECK A (page-1 roles tagged): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (autoPages experience break written): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (preview split into >1 page-box): ${C?'PASS':'FAIL'}`);
console.log(errs.length===0 && A ? 'DIAG OK' : 'DIAG INCOMPLETE');
