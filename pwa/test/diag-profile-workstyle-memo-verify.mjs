/* DIAGNOSTIC (read-only) — verifies BOOT-CJLR-PERF-003: the per-run sectionFromElement
 * memo added to antcv-profile-workstyle-cjlr-238.js still (a) boots + runs clean past the
 * sign-in gate and (b) is BEHAVIOUR-PRESERVING — it must still classify the PROFILE and
 * WORK_STYLE sections DISTINCTLY (a wrongly-keyed memo would cross-contaminate the two).
 * Strategy: after boot, inject two editable elements tagged data-sid=profile / work_style,
 * seed distinct alignments, force run(), and assert each element resolved to ITS OWN
 * alignment (proving sectionFromElement still maps each element to the right section
 * through the memoised path). Does NOT edit anything. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const cv = [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Operations specialist with deep experience.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'Methodical, calm under pressure.' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[{ id:'r0', title:'Role 0', company:'Co', dateRange:'2010-2011', bullets:['A bullet with measurable outcomes across teams.'] }] },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Tool 0',v:'Detail'}] },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' } ];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errors = [];
page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e=>errors.push('PAGEERROR: '+(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('antcv:disable-loading-gate','1');
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  // seed distinct alignments for the two sections so we can prove they don't cross-contaminate
  localStorage.setItem('antcv.profileWorkstyleParagraphAlignment.v1', JSON.stringify({ profile:'center', work_style:'right' }));
}, [{cv,cl}, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const probe = await page.evaluate(async ()=>{
  const out = { global:false, ranThrew:null, alignProfile:null, alignWorkstyle:null };
  out.global = !!(window.AntcvProfileWorkstyleCjlr238 && window.AntcvProfileWorkstyleCjlr238.version);
  // Inject two KNOWN editable elements tagged with each section's data-sid, plus
  // matching preview sections, so the editorBlocks/applyPreview paths (which call the
  // memoised sectionFromElement) have unambiguous targets to resolve.
  const mk = (sid, txt) => {
    const wrap = document.createElement('div'); wrap.setAttribute('data-sid', sid);
    const ta = document.createElement('textarea'); ta.value = txt; wrap.appendChild(ta);
    const p = document.createElement('p'); p.setAttribute('data-antcv-editable-text','true'); p.textContent = txt; wrap.appendChild(p);
    document.body.appendChild(wrap); return { wrap, ta, p };
  };
  const prof = mk('profile', 'Operations specialist with deep experience across teams.');
  const work = mk('work_style', 'Methodical and calm under pressure in delivery.');
  try { window.AntcvProfileWorkstyleCjlr238.run(); } catch(e){ out.ranThrew = String(e&&e.message); }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); // let run()'s RAF complete
  out.alignProfile = prof.ta.style.textAlign || prof.p.style.textAlign || null;
  out.alignWorkstyle = work.ta.style.textAlign || work.p.style.textAlign || null;
  return out;
});
await browser.close(); await new Promise(rr=>server.close(rr));

const sidecarErrors = errors.filter(e=>/profile-workstyle-cjlr-238/.test(e));
console.log('global present:', probe.global);
console.log('run() threw:', probe.ranThrew);
console.log('profile element align (expect center):', probe.alignProfile);
console.log('work_style element align (expect right):', probe.alignWorkstyle);
console.log('238 console errors:', sidecarErrors.length, sidecarErrors.slice(0,5));

const ok = probe.global
  && !probe.ranThrew
  && probe.alignProfile === 'center'
  && probe.alignWorkstyle === 'right'
  && sidecarErrors.length === 0;
console.log(ok ? '\nPASS — 238 memo boots + runs clean AND classifies profile/work_style distinctly (no cross-contamination)' : '\nFAIL — see above');
process.exit(ok ? 0 : 1);
