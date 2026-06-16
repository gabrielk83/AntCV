/* DIAGNOSTIC — RESULTS-PREVIEW-LAMINATION-PARITY-001 (owner 2026-06-17).
 * The CV PREVIEW per-role Results must mirror the EXPORT (applyOutcomesMode
 * tiers 1-3): a role's OWN laminated results — explicit role.results, then
 * role.outcomes[], then proofPointIds resolved against
 * personalInfo.proofPointsByRole — win over the SELECTED-OUTCOMES token spread.
 * Before the fix the preview skipped tiers 1-3, so Results showed on only SOME
 * roles and with mismatched content. Boots the editor and reads each role's
 * [data-antcv-role-results] text. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port; const base = `http://127.0.0.1:${port}`;

const SECTIONS = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'IT expert.' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[
    // tier 1: explicit role.results
    { id:'rA', title:'Change Control Lead', company:'Innoviz', years:'2022-2025', on:true, bullets:['Owned the governance loop.'], results:'Explicit laminated result for role A.' },
    // tier 2: role.outcomes[]
    { id:'rB', title:'System Architect', company:'Innoviz', years:'2020-2023', on:true, bullets:['Owned the architecture.'], outcomes:['Outcome-B-one.','Outcome-B-two.'] },
    // tier 3: proofPointIds -> personalInfo.proofPointsByRole
    { id:'rC', title:'Optics Engineer', company:'Sirin', years:'2014-2017', on:true, bullets:['Led the optics stack.'], proofPointIds:['ppC1','ppC2'] },
    // no lamination, no matching SELECTED OUTCOMES token -> may be empty (token-spread fallback)
    { id:'rD', title:'Computer Administrator', company:'IDF', years:'2001-2003', on:true, bullets:['Ran the help desk.'] },
  ] },
  { id:'selected_outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'list', items:['A generic outcome about leadership and delivery.'] },
], cl:[] };
const PI = { name:'Gabriel', proofPointsByRole:[ {id:'ppC1',text:'Tier3 proof one for Sirin optics.'}, {id:'ppC2',text:'Tier3 proof two for Sirin optics.'} ] };

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1600}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(({sections,pi})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify(pi));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
  localStorage.setItem('outcomesMode',JSON.stringify('results'));
},{sections:SECTIONS,pi:PI});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4000);

const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
const texts = await page.evaluate(()=>Array.from(document.querySelectorAll('[data-antcv-role-results]')).map(el=>(el.textContent||'').replace(/\s+/g,' ').trim()));
const joined = texts.join(' || ');
check('preview rendered some role-results blocks', texts.length>=3, `count=${texts.length} :: ${joined}`);
check('tier 1 (explicit role.results) shows verbatim', /Explicit laminated result for role A\./.test(joined), joined);
check('tier 2 (role.outcomes[]) shows', /Outcome-B-one/.test(joined), joined);
check('tier 3 (proofPointIds) shows the proof-point text', /Tier3 proof one for Sirin optics/.test(joined), joined);
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));

await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'RESULTS-PREVIEW-LAMINATION OK':'RESULTS-PREVIEW-LAMINATION FAIL');
process.exit(ok?0:1);
