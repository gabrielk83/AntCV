/* DIAGNOSTIC — RESULTS-LAMINATION-001 preview sidecar (antcv-results-laminate-510.js).
 * Renders the editor past the sign-in gate with experience roles that carry their
 * OWN outcomes[] (default-visible + a JD-gated one), a SELECTED OUTCOMES section
 * (so the heuristic renders the Results divs the sidecar then overrides), and a
 * JD that matches the gated outcome. Asserts each role's rendered Results line is
 * the LAMINATED text (not the heuristic spread), the JD-gated one shows, and the
 * editor rendered with no page errors. Run from pwa/. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P.' },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items:[
    { b:'Unrelated', t:'global outcome about supplier consolidation savings.' },
    { b:'Another', t:'unrelated global outcome about optical resolution.' },
  ]},
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[
    { id:'r0', title:'Change Control Lead', company:'Innoviz', years:'2020-2025', on:true, bullets:['Owned the board.'],
      outcomes:[ { id:'a', b:'Cut', t:'change-request cycle time from 250 to 10 days.', defaultVisible:true } ] },
    { id:'r1', title:'System Architect', company:'Innoviz', years:'2017-2020', on:true, bullets:['Defined arch.'],
      outcomes:[ { id:'jd', b:'Established', t:'an FMEA-based monitoring system in SQL.', defaultVisible:false,
        visibilityRule:{ showWhenJDContainsAny:['FMEA','SQL'] } } ] },
  ]},
], cl: [] };
const PINFO = { name:'Gabriel Alexander Karp-Gershon', title:'P', email:'g@example.com', phone:'+45', location:'2300, København S', photo:'' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1400,height:1700} });
await page.addInitScript(({sections,pinfo})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@example.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@example.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify(pinfo));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
  localStorage.setItem('__antcvOutcomesMode',JSON.stringify('results'));
  localStorage.setItem('antcv:lastJdText','This role needs FMEA and SQL monitoring experience.');
},{sections:SECTIONS,pinfo:PINFO});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4000);

const res = await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('[data-antcv-role-results]').forEach(div=>{
    const t=div.getAttribute('data-antcv-role-results');
    const span=div.querySelector('[data-antcv-results-edit]');
    out.push({ t, text:(span?span.textContent:div.textContent||'').replace(/\s+/g,' ').trim() });
  });
  return out;
});
await browser.close();
await new Promise(r=>server.close(r));

const all = res.map(r=>r.text).join(' || ');
console.log('rendered Results lines:', res.length);
res.forEach(r=>console.log(`  role[${r.t}]: "${r.text}"`));
if(errs.length) console.log('pageerrors:', errs.slice(0,3).join(' | '));

const A = /250 to 10 days/.test(all);                 // r0 laminated from its own outcome
const B = /FMEA-based monitoring system in SQL/.test(all); // r1 JD-gated outcome shows (JD matches)
const C = !/supplier consolidation|optical resolution/.test(all); // heuristic global outcomes NOT shown
const D = errs.length===0;                             // editor rendered clean (no crash)
console.log(`CHECK A (r0 shows its OWN outcome 250→10): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (r1 JD-gated outcome shows when JD matches): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (heuristic global outcomes overridden away): ${C?'PASS':'FAIL'}`);
console.log(`CHECK D (editor rendered, no page errors): ${D?'PASS':'FAIL'}`);
const ok=A&&B&&C&&D;
console.log(ok?'RESULTS-LAMINATE-PREVIEW OK (4/4)':'RESULTS-LAMINATE-PREVIEW FAIL');
process.exitCode=ok?0:1;
