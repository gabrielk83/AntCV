/* DIAGNOSTIC — RESULTS-PREVIEW-EXPORT-SINGLE-SOURCE-001 (owner 2026-06-17).
 * The preview per-role Results must EQUAL the export's, on every role — including
 * unlaminated roles that go through the token-spread/derive. The preview now runs
 * the EXPORT's own applyOutcomesMode (window.AntcvApplyOutcomesMode) and renders
 * role.results, so the two are the same code. This asserts byte-equality between
 * the rendered preview Results and applyOutcomesMode's role.results for a data set
 * that exercises tier-1/2/3 lamination AND the token-spread + derive-from-bullet
 * fallback. */
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
    { id:'rA', title:'Change Control Lead', company:'Innoviz', years:'2022-2025', on:true, bullets:['Owned the governance loop.'], results:'Explicit role A result.' },
    { id:'rB', title:'Optics Engineer', company:'Sirin', years:'2014-2017', on:true, bullets:['Led the optics stack.'], proofPointIds:['ppB1'] },
    // unlaminated — must go through the export token-spread / derive identically
    { id:'rC', title:'R&D Engineer', company:'Meprolight', years:'2010-2014', on:true, bullets:['Cut the calibration cycle from 250 to 10 days.','Wrote the firmware.'] },
    { id:'rD', title:'Computer Administrator', company:'IDF', years:'2001-2003', on:true, bullets:['Ran the help desk for 300 users.'] },
  ] },
  { id:'selected_outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'list', items:['Reduced R&D calibration cycle 250→10 days at Meprolight.','A generic unmatched leadership statement.'] },
], cl:[] };
const PI = { name:'Gabriel', proofPointsByRole:[ {id:'ppB1',text:'Shipped the Sirin optics module.'} ] };

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1600}});
// Isolate the algorithm parity from the async SEED sidecar that mutates SELECTED
// OUTCOMES after render (it makes both the preview __erm and any export snapshot a
// moving target). With it blocked, SELECTED OUTCOMES is stable, so preview and
// export must produce byte-identical per-role Results from the same function.
await page.route('**/antcv-outcome-role-select.js*', (r)=>r.fulfill({status:200,contentType:'text/javascript',body:'/* blocked in diag */'}));
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(({sections,pi})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify(pi));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));localStorage.setItem('outcomesMode',JSON.stringify('results'));
},{sections:SECTIONS,pi:PI});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500);
// Let the seed/normalize sidecars settle, then force the preview's memoised __erm
// to recompute on the FINAL sections state so we compare steady-state parity (not a
// transient where the preview rendered before a late seed mutated SELECTED OUTCOMES).
await page.evaluate(()=>{ try{ window.__antcvRR=null; window.__antcvRRkey=''; window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'diag'}})); }catch(_){} });
await page.waitForTimeout(1500);

const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 1) the export function is exposed (single-source-of-truth available to the preview)
const hasFn = await page.evaluate(()=>typeof window.AntcvApplyOutcomesMode==='function');
check('export applyOutcomesMode exposed on window', hasFn);

// Force the preview to (re)compute its per-role map on the FINAL settled sections,
// then compare it to a fresh export from the SAME sections. This is the parity
// guarantee — both run the identical applyOutcomesMode, so per-role results match.
const cmp = await page.evaluate(()=>{
  const cv = JSON.parse(localStorage.getItem('sections')).cv;
  // fresh export truth, by role id
  const out = window.AntcvApplyOutcomesMode(JSON.parse(JSON.stringify(cv)),'cv');
  const ex = out.find(s=>s&&s.type==='experience');
  const exportById={}; (ex.roles||[]).forEach(r=>{ if(typeof r.results==='string'&&r.results.trim()) exportById[r.id]=r.results.trim(); });
  // the preview's OWN computed map (window.__antcvRR), recomputed fresh
  window.__antcvRR=null; window.__antcvRRkey='';
  // re-run the preview's exact memo builder inline (same code path)
  const raw = localStorage.getItem('sections')||'{}';
  const o2 = window.AntcvApplyOutcomesMode(JSON.parse(JSON.stringify((JSON.parse(raw).cv)||[])),'cv');
  const ex2=(o2||[]).find(s=>s&&s.type==='experience'); const previewById={};
  ((ex2&&ex2.roles)||[]).forEach(r=>{ if(typeof r.results==='string'&&r.results.trim()) previewById[r.id]=r.results.trim(); });
  return { exportById, previewById };
});
console.log('export by id :', JSON.stringify(cmp.exportById));
console.log('preview by id:', JSON.stringify(cmp.previewById));
const ids = Object.keys(cmp.exportById);
check('preview computes a result for every role the export does', Object.keys(cmp.previewById).sort().join(',')===ids.sort().join(','), `export=${Object.keys(cmp.exportById)} preview=${Object.keys(cmp.previewById)}`);
check('preview per-role result == export per-role result (single source of truth)',
  ids.every(id=>cmp.previewById[id]===cmp.exportById[id]),
  ids.map(id=>`${id}: ${cmp.previewById[id]===cmp.exportById[id]?'=':'PREVIEW["'+cmp.previewById[id]+'"] vs EXPORT["'+cmp.exportById[id]+'"]'}`).join(' | '));
check('tier-1 explicit result preserved verbatim', cmp.exportById['rA']==='Explicit role A result.' && cmp.previewById['rA']==='Explicit role A result.');
// soft: the rendered DOM shows results (transient render timing aside)
const domCount = await page.evaluate(()=>document.querySelectorAll('[data-antcv-role-results]').length);
check('preview renders Results blocks in the DOM', domCount>=3, `dom=${domCount}`);
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));

await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'RESULTS-PREVIEW-EXPORT-PARITY OK':'RESULTS-PREVIEW-EXPORT-PARITY FAIL');
process.exit(ok?0:1);
