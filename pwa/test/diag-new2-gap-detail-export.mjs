/* DIAGNOSTIC — NEW-2 (owner 2026-07-07). The Analysis-panel gap blocks persist
 * their AI detail (SPECIFIC DETAILS / WHY IT MATTERS / HOW TO ADDRESS), the
 * owner's "I cover this" correction, and the covered flag to per-gap
 * `gapState_<company_role>_<idx>_<gapText>` localStorage keys — NOT into
 * rationale.gaps[]. The analysis-report PDF export read only `rationale`, so it
 * dropped every filled gap detail + how-I-cover answer. This asserts the export
 * (antcv-analysis-report-pdf-360.js) now folds gapState_* into the report.
 *
 * Seeds AFTER boot settles (the kernel-showcase regen wipes rationale on a
 * minimal-content boot; the export reads localStorage fresh at call time, so
 * post-boot seeding is faithful and deterministic). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Test Candidate'}));
});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500); // let boot (incl. any showcase regen) settle

const out=await page.evaluate(()=>{
  // Two gaps: a string gap and an object gap. Company/role drive the key.
  var meta={company:'Acme',role:'Engineer'};
  var gaps=['No direct Danish public-sector experience',{gap:'Limited modern frontend framework depth'}];
  var rationale={detected_language:'en',fit_summary:'Solid overall fit.',top_fit_points:['A'],gaps:gaps};
  localStorage.setItem('meta',JSON.stringify(meta));
  localStorage.setItem('rationale',JSON.stringify(rationale));
  // Build the gapState keys EXACTLY as app.src.js Be does.
  function key(gap,i){var txt=(typeof gap==='string'?gap:(gap&&(gap.text||gap.gap))||'').toString().slice(0,80).replace(/\s+/g,'_');var cr=((meta.company||'')+'_'+(meta.role||'')).slice(0,40).replace(/\s+/g,'_');return 'gapState_'+cr+'_'+i+'_'+txt;}
  localStorage.setItem(key(gaps[0],0),JSON.stringify({corrected:true,correction:'MARKER_CORRECTION_1 — I ran GDPR-heavy regulated projects.',detail:'MARKER_DETAIL_1\n1. SPECIFIC DETAILS: missing kommunal exposure.\n2. WHY IT MATTERS: shared-infra context.\n3. HOW TO ADDRESS: frame regulated-domain work.',ts:1}));
  localStorage.setItem(key(gaps[1],1),JSON.stringify({corrected:false,correction:'',detail:'MARKER_DETAIL_2 — backend/data specialist who partners with frontend.',ts:2}));
  var api=window.AntcvAnalysisReportPdf360;
  if(!api||!api._reportHtml) return {api:false};
  var html='';try{html=api._reportHtml();}catch(e){return {api:true,err:String(e)};}
  var markers=['MARKER_DETAIL_1','MARKER_CORRECTION_1','MARKER_DETAIL_2','How I cover this'];
  var present={};markers.forEach(function(m){present[m]=html.indexOf(m)>=0;});
  present.coveredTick=html.indexOf('✓ Covered')>=0;
  return {api:true,len:html.length,present};
});
await browser.close();await new Promise(r=>server.close(r));
console.log(JSON.stringify(out,null,2));
var p=out.present||{};
var ok=out.api&&p.MARKER_DETAIL_1&&p.MARKER_CORRECTION_1&&p.MARKER_DETAIL_2&&p['How I cover this']&&p.coveredTick;
console.log(ok?'NEW2-GAP-DETAIL-EXPORT OK':'NEW2-GAP-DETAIL-EXPORT FAILED');
process.exit(ok?0:1);
