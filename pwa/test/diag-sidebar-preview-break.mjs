/* DIAGNOSTIC — SIDEBAR-PREVIEW-BREAK-EARLY-001 (owner 2026-06-21).
 * The PREVIEW sidebar salmon broke 2-3 subsubsections too LATE vs the PDF.
 * antcv-auto-pagebreak-block-001.js now shrinks the PREVIEW sidebar usable line by
 * SIDEBAR_PREVIEW_INFLATE so the break lands earlier. This drives the REAL measurer
 * in a browser against an overflowing CV and asserts, in one run:
 *   (A) with the factor the SIDEBAR preview break index is STRICTLY EARLIER than with
 *       the factor disabled (more sidebar moves to page 2);
 *   (B) the MAIN/experience break is UNCHANGED by the factor;
 *   (C) the EXPORT map (antcv:autoPages) sidebar entry is UNCHANGED (PDF not touched);
 *   (D) the break is STABLE across repeated measure cycles (no create/clear dance);
 *   (E) no app errors and the preview rendered into >1 page-box.
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

const longBullet = (n) => `Bullet ${n} — drove a cross-functional initiative that restructured the operating model, delivering measurable outcomes across multiple regions and stakeholder groups while reducing cycle time and cost over a sustained multi-quarter program.`;
const role = (i) => ({ id:'r'+i, title:'Senior Programme Lead '+i, company:'Northwind '+i, years:'20'+(10+i)+' – 20'+(13+i), on:true, bullets:[longBullet(1),longBullet(2),longBullet(3),longBullet(4)] });
const coreRows = [['Focus','Expertise']];
for (let i=1;i<=10;i++) coreRows.push(['Competency '+i, 'Detailed expertise statement '+i+' describing depth and breadth across the domain.']);

// Long KEY SKILLS list to push the page-1 sidebar near the A4 line, then a GROUPED
// ADDITIONAL INFORMATION whose subsubsections (LANGUAGES / INTERESTS / ACCESSIBILITY)
// straddle the boundary — exactly the owner's Languages/Interests scenario.
const skills = [];
for (let i=1;i<=16;i++) skills.push({ l:'Skill or credential line '+i+' with a fairly long descriptive label here', v:'Skill or credential line '+i+' with a fairly long descriptive label here' });
// ADDITIONAL INFORMATION as MANY small subsubsections (group header + 2 rows ≈ one
// subsubsection) so the page boundary straddles several of them and the factor can move
// the break by 2-3 whole subsubsections — the owner's exact scenario.
const additional = [];
const subs = ['LANGUAGES','INTERESTS','ACCESSIBILITY','MEMBERSHIPS','CERTIFICATIONS','VOLUNTEERING','PUBLICATIONS NOTE','AVAILABILITY','REFERENCES','TOOLS'];
for (const g of subs) {
  additional.push({ group:g });
  additional.push({ l:g+' detail one with a reasonably long descriptive value', v:g+' detail one with a reasonably long descriptive value' });
  additional.push({ l:g+' detail two with a reasonably long descriptive value', v:g+' detail two with a reasonably long descriptive value' });
}

const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Seasoned programme leader with two decades across logistics, operations and transformation. '.repeat(4) },
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
// Let the measurer settle NATURALLY (its own timer passes 400/900/1800/3500 + interval),
// no clear/run churn — that's the realistic shipped state at the default factor (1.20).
await page.waitForTimeout(10000);

function readState() {
  return page.evaluate(() => {
    const prev = JSON.parse(localStorage.getItem('antcv:autoPagesPreview')||'{}');
    const exp  = JSON.parse(localStorage.getItem('antcv:autoPages')||'{}');
    const firstKey = (o)=> (o && typeof o==='object') ? (Object.keys(o)[0] ?? null) : null;
    const AP = window.AntcvAutoPagebreak;
    return {
      cfg: AP ? AP.config().SIDEBAR_PREVIEW_INFLATE : null,
      prevAdditional: firstKey(prev.additional),
      prevSkills: firstKey(prev.skills),
      prevExperience: firstKey(prev.experience),
      expExperience: firstKey(exp.experience),
      expAdditional: firstKey(exp.additional),
      expSkills: firstKey(exp.skills),
      pageRows: document.querySelectorAll('.antcv-page-row').length,
      sbRows: document.querySelectorAll('.antcv-document-sidebar [data-antcv-row-path^="items."], [data-antcv-document-sidebar="true"] [data-antcv-row-path^="items."]').length,
    };
  });
}

const s1 = await readState();
await page.waitForTimeout(5000);   // let several more natural cycles run
const s2 = await readState();

await browser.close();
await new Promise(r=>server.close(r));

console.log('settled state  :', JSON.stringify(s1));
console.log('re-read (+5s)   :', JSON.stringify(s2));
console.log('app errors:', errs.length, errs.slice(0,4).join(' | '));

const sbPrev1 = s1.prevAdditional != null ? Number(s1.prevAdditional) : (s1.prevSkills != null ? Number(s1.prevSkills) : null);

let fail = 0;
function check(cond, label){ console.log((cond?'PASS':'FAIL')+' — '+label); if(!cond) fail++; }

// (A) the default factor (1.20) is active and the mechanism produced a sidebar PREVIEW break.
check(s1.cfg === 1.2, `default SIDEBAR_PREVIEW_INFLATE active (${s1.cfg})`);
check(sbPrev1 != null && sbPrev1 >= 1, `sidebar PREVIEW break written (additional=${s1.prevAdditional}, skills=${s1.prevSkills})`);
// (B) SAFETY: the EXPORT map carries NO sidebar break — the PDF path is untouched
//     (the worker owns sidebar pagination; a forwarded sidebar break scrambles the PDF).
check(s1.expAdditional == null && s1.expSkills == null,
  `EXPORT map has NO sidebar break (additional=${s1.expAdditional}, skills=${s1.expSkills}) — PDF safe`);
// (C) main/experience break present and consistent across preview+export.
check(s1.prevExperience != null && s1.expExperience != null, `experience break present (prev=${s1.prevExperience}, exp=${s1.expExperience})`);
// (D) STABLE across natural cycles (no create/clear dance).
check(String(s1.prevAdditional) === String(s2.prevAdditional) && String(s1.prevSkills) === String(s2.prevSkills) &&
      String(s1.expAdditional) === String(s2.expAdditional) && String(s1.expSkills) === String(s2.expSkills),
  `maps STABLE across +5s (no oscillation)`);
// (E) no errors + preview paginated.
check(errs.length === 0, 'no app errors');
check((s1.pageRows||0) > 1, `preview split into >1 page-box (${s1.pageRows})`);

console.log('\n' + (fail===0 ? 'ALL SIDEBAR-BREAK DIAG CHECKS PASS' : fail+' CHECK(S) FAILED'));
process.exitCode = fail===0 ? 0 : 1;
