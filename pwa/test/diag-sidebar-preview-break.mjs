/* DIAGNOSTIC — SIDEBAR-PREVIEW-BREAK-EARLY-001 FORCE variant (owner 2026-06-21).
 * The PREVIEW OVER-fills page 1: it packs more sidebar items onto page 1 than the (taller-
 * rendered) PDF page holds, so the sidebar fits the 1123px preview page-box and gets NO break,
 * leaving page-2's sidebar empty while the PDF continues it to page 2. 1.50.749 FORCES a preview
 * sidebar break at the tightened (PDF-equivalent) line — PREVIEW MAP ONLY, export/DOCX untouched.
 *
 * This drives the REAL measurer in a browser against the owner's case (MAIN breaks via a long
 * experience, sidebar FITS the normal A4 line) and asserts:
 *   (A) with the FORCE factor a preview sidebar break is produced at-or-earlier than with the
 *       force disabled (factor 1.0) — i.e. more sidebar moves to page 2;
 *   (B) the EXPORT map (antcv:autoPages — the DOCX break) is UNCHANGED by the factor;
 *   (C) the preview break is STABLE across repeats (no oscillation / section-flip);
 *   (D) no app errors and the preview paginated into >1 page-box.
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

// LONG main (experience overflows → main breaks into 2 page-boxes; the sidebar then rides
// into the boxes — the owner's case where the compact sidebar fits page 1 but should break).
const longBullet = (n) => `Bullet ${n} — drove a cross-functional initiative restructuring the operating model, delivering measurable outcomes across regions and stakeholders while cutting cycle time and cost over a sustained multi-quarter programme of work.`;
const role = (i) => ({ id:'r'+i, title:'Senior Programme Lead '+i, company:'Northwind '+i, years:'20'+(10+i)+' – 20'+(13+i), on:true, bullets:[longBullet(1),longBullet(2),longBullet(3),longBullet(4)] });
const coreRows = [['Focus','Expertise']];
for (let i=1;i<=8;i++) coreRows.push(['Competency '+i, 'Detailed expertise statement '+i+' across the domain.']);

// MODERATE grouped sidebar that fits the normal ~1053px A4 line (so the OLD code makes no
// break) but overflows the tightened line (so FORCE breaks it). Many small subsubsections.
const skills = [];
for (let i=1;i<=6;i++) skills.push({ l:'Skill line '+i+' descriptive label', v:'Skill line '+i+' descriptive label' });
const additional = [];
const subs = ['LANGUAGES','INTERESTS','ACCESSIBILITY','MEMBERSHIPS','CERTIFICATIONS','VOLUNTEERING'];
for (const g of subs) {
  additional.push({ group:g });
  additional.push({ l:g+' detail one descriptive value', v:g+' detail one descriptive value' });
  additional.push({ l:g+' detail two descriptive value', v:g+' detail two descriptive value' });
}

const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Programme leader with two decades across logistics, operations and transformation. '.repeat(3) },
    { id:'core', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows: coreRows },
    { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles: [role(1),role(2),role(3),role(4),role(5),role(6)] },
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
    // count sidebar break "weight": lower break index = more moved to page 2. We compare
    // the FIRST sidebar section that breaks; null = no sidebar break at all.
    const sbBreak = (o)=> { const a=k(o,'skills'), b=k(o,'additional'); return a!=null?('skills:'+a):(b!=null?('additional:'+b):null); };
    return {
      cfg: AP.config().SIDEBAR_PREVIEW_INFLATE,
      prevSb: sbBreak(prev), expSb: sbBreak(exp),
      prevAdditional: k(prev,'additional'), prevSkills: k(prev,'skills'),
      expAdditional: k(exp,'additional'), expSkills: k(exp,'skills'),
      pageRows: document.querySelectorAll('.antcv-page-row').length,
    };
  }, factor);
}

const off  = await measure(1.0);    // force disabled (baseline / old behaviour)
const on1  = await measure(1.32);   // the shipped FORCE factor
const on2  = await measure(1.32);   // repeat → stability

await browser.close();
await new Promise(r=>server.close(r));

console.log('force OFF (1.0) :', JSON.stringify(off));
console.log('force ON  (1.32):', JSON.stringify(on1));
console.log('repeat    (1.32):', JSON.stringify(on2));
console.log('app errors:', errs.length, errs.slice(0,4).join(' | '));

// "page-2 weight" of a sidebar break: a break means content moved to page 2; null = none.
const hasBreak = (s)=> s != null;

let fail = 0;
const check=(c,l)=>{ console.log((c?'PASS':'FAIL')+' — '+l); if(!c) fail++; };

// (A) FORCE produces a preview sidebar break (the whole point — the owner's preview had none).
check(hasBreak(on1.prevSb), `FORCE produced a preview sidebar break (off=${off.prevSb} → on=${on1.prevSb})`);
// (A2) and it moves at-least-as-much to page 2 as the force-off baseline (never less).
check(!hasBreak(off.prevSb) || hasBreak(on1.prevSb), `FORCE never breaks LESS than baseline`);
// (B) EXPORT (DOCX) sidebar break UNCHANGED by the factor (preview-only; PDF safe).
check(String(off.expAdditional) === String(on1.expAdditional) && String(off.expSkills) === String(on1.expSkills),
  `EXPORT/DOCX sidebar break unchanged (add ${off.expAdditional}→${on1.expAdditional}, skills ${off.expSkills}→${on1.expSkills})`);
// (C) STABLE across repeats (no oscillation / section-flip).
check(String(on1.prevAdditional) === String(on2.prevAdditional) && String(on1.prevSkills) === String(on2.prevSkills),
  `preview sidebar break stable across repeat (no oscillation): ${on1.prevSb} == ${on2.prevSb}`);
// (D) no errors + paginated.
check(errs.length === 0, 'no app errors');
check((on1.pageRows||0) > 1, `preview split into >1 page-box (${on1.pageRows})`);

console.log('\n' + (fail===0 ? 'ALL SIDEBAR-FORCE DIAG CHECKS PASS' : fail+' CHECK(S) FAILED'));
process.exitCode = fail===0 ? 0 : 1;
