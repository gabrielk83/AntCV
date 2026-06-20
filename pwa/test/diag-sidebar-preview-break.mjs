/* DIAGNOSTIC — SIDEBAR-PREVIEW-BREAK-EARLY-001 (owner 2026-06-21).
 * The PREVIEW sidebar salmon sat too LOW (broke at the full A4 line ~1053px) while the
 * DOCX/worker breaks the sidebar higher (~924px). antcv-auto-pagebreak-block-001.js now
 * pulls an ALREADY-EXISTING preview sidebar break UP by SIDEBAR_PREVIEW_INFLATE, PREVIEW
 * MAP ONLY (export/DOCX break untouched), ONLY-ADJUST (never forces a new break).
 *
 * This drives the REAL measurer in a browser against a CV whose SIDEBAR overflows page 1
 * on its own (short main, long sidebar — so a baseline sidebar break exists) and asserts:
 *   (A) baseline (factor 1.0) HAS a sidebar PREVIEW break and a sidebar EXPORT break;
 *   (B) with the factor the sidebar PREVIEW break index moves UP (earlier → salmon higher);
 *   (C) the sidebar EXPORT break (antcv:autoPages — the DOCX break) is UNCHANGED;
 *   (D) the preview break is STABLE across repeats (no oscillation);
 *   (E) no app errors and the preview paginated into >1 page-box.
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

// SHORT main (fits ~1 page → no main break), so the SIDEBAR is the column that overflows.
const role = (i) => ({ id:'r'+i, title:'Programme Lead '+i, company:'Northwind '+i, years:'201'+i+' – 201'+(i+2), on:true, bullets:['Led a regional initiative reducing cycle time.','Owned governance and stakeholder alignment.'] });
const coreRows = [['Focus','Expertise']];
for (let i=1;i<=4;i++) coreRows.push(['Competency '+i, 'Short expertise statement '+i+'.']);

// LONG grouped sidebar: many small subsubsections (group header + 2 rows each) so the
// page boundary straddles several and the factor can lift the break a couple of them.
const skills = [];
for (let i=1;i<=8;i++) skills.push({ l:'Skill line '+i+' with a descriptive label', v:'Skill line '+i+' with a descriptive label' });
const additional = [];
const subs = ['LANGUAGES','INTERESTS','ACCESSIBILITY','MEMBERSHIPS','CERTIFICATIONS','VOLUNTEERING','AVAILABILITY','REFERENCES','TOOLS','METHODS','DOMAINS','STANDARDS'];
for (const g of subs) {
  additional.push({ group:g });
  additional.push({ l:g+' detail one with a reasonably long value', v:g+' detail one with a reasonably long value' });
  additional.push({ l:g+' detail two with a reasonably long value', v:g+' detail two with a reasonably long value' });
}

const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Programme leader with two decades across logistics and operations.' },
    { id:'core', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows: coreRows },
    { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles: [role(1),role(2)] },
    { id:'skills', title:'KEY SKILLS', loc:'sidebar', on:true, type:'labeled_list', items: skills },
    { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items: additional },
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
  localStorage.setItem('antcv:autoPagesPreview','{}');
  localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);

const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(!/CORS|workers\.dev|Failed to load|net::ERR|relay/i.test(t)) errs.push('console.error: '+t);} });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(8000);

async function measure(factor) {
  return await page.evaluate(async (f) => {
    const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
    const AP = window.AntcvAutoPagebreak;
    if (!AP) return { error:'no AntcvAutoPagebreak' };
    AP.clear();
    AP.config({ SIDEBAR_PREVIEW_INFLATE: f });
    await sleep(300); AP.run(); await sleep(2600);
    const prev = JSON.parse(localStorage.getItem('antcv:autoPagesPreview')||'{}');
    const exp  = JSON.parse(localStorage.getItem('antcv:autoPages')||'{}');
    const k = (o,s)=> (o && o[s] && typeof o[s]==='object') ? (Object.keys(o[s])[0] ?? null) : null;
    return {
      cfg: AP.config().SIDEBAR_PREVIEW_INFLATE,
      prevAdditional: k(prev,'additional'), prevSkills: k(prev,'skills'),
      expAdditional: k(exp,'additional'), expSkills: k(exp,'skills'),
      pageRows: document.querySelectorAll('.antcv-page-row').length,
    };
  }, factor);
}

const off  = await measure(1.0);
const on1  = await measure(1.16);
const on2  = await measure(1.16);

await browser.close();
await new Promise(r=>server.close(r));

const N = (x)=> x==null ? null : Number(x);
// pick whichever sidebar section carries the break (prefer additional, else skills)
const sbOff = N(off.prevAdditional) ?? N(off.prevSkills);
const sbOn  = N(on1.prevAdditional) ?? N(on1.prevSkills);

console.log('baseline (1.0) :', JSON.stringify(off));
console.log('shipped  (1.16):', JSON.stringify(on1));
console.log('repeat   (1.16):', JSON.stringify(on2));
console.log('app errors:', errs.length, errs.slice(0,4).join(' | '));

let fail = 0;
const check=(c,l)=>{ console.log((c?'PASS':'FAIL')+' — '+l); if(!c) fail++; };

// (A) baseline has a sidebar PREVIEW break (mechanism precondition).
check(sbOff != null && sbOff >= 1, `baseline sidebar PREVIEW break exists (additional=${off.prevAdditional}, skills=${off.prevSkills})`);
// (B) the factor pulls the preview sidebar break UP (earlier index → salmon higher).
check(sbOff != null && sbOn != null && sbOn < sbOff, `preview sidebar break moved UP (${sbOff} → ${sbOn})`);
// (C) EXPORT (DOCX) sidebar break is UNCHANGED by the factor.
check(String(off.expAdditional) === String(on1.expAdditional) && String(off.expSkills) === String(on1.expSkills),
  `EXPORT/DOCX sidebar break unchanged (additional ${off.expAdditional}→${on1.expAdditional}, skills ${off.expSkills}→${on1.expSkills})`);
// (D) preview break stable across repeats (no oscillation).
check(String(on1.prevAdditional) === String(on2.prevAdditional) && String(on1.prevSkills) === String(on2.prevSkills),
  `preview sidebar break stable across repeat (no oscillation)`);
// (E) no errors + paginated.
check(errs.length === 0, 'no app errors');
check((on1.pageRows||0) > 1, `preview split into >1 page-box (${on1.pageRows})`);

console.log('\n' + (fail===0 ? 'ALL SIDEBAR-BREAK DIAG CHECKS PASS' : fail+' CHECK(S) FAILED'));
process.exitCode = fail===0 ? 0 : 1;
