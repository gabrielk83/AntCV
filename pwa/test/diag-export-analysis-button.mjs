/* DIAGNOSTIC — EXPORT-PREVIEW-FEATURES-001(a) (1.50.377). The document-export
 * modal offers "Analysis (PDF)" as a third quick-export WHEN an analysis
 * report exists, delegating to the 360 exporter's window hook; with no
 * analysis data the button must NOT render. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const sections = { cv: [{ id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P. '.repeat(20) }], cl: [] };

async function boot(withRationale) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  await page.addInitScript(({secs, rat})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Tester' }));
    if (rat) {
      localStorage.setItem('rationale', JSON.stringify({ fit_summary:'Strong fit for the role.', assumptions:['a1'], recommendations:['r1'] }));
      localStorage.setItem('meta', JSON.stringify({ role:'PM', company:'NKT' }));
    }
  }, { secs: sections, rat: withRationale });
  const errs = [];
  page.on('pageerror', e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async ()=>{
    let hookCalls = 0;
    const orig = window.AntcvAnalysisReportExport;
    window.AntcvAnalysisReportExport = function(){ hookCalls++; };
    window.AntcvPdfPreviewGate.open();
    await new Promise(r2=>setTimeout(r2,900));
    const btn = document.getElementById('antcv-pdf-preview-modal-analysis');
    const present = !!btn;
    if (btn) { btn.click(); await new Promise(r2=>setTimeout(r2,200)); }
    window.AntcvAnalysisReportExport = orig;
    return { present, hookCalls, hookDefined: typeof orig === 'function',
      available: typeof window.AntcvAnalysisReportAvailable === 'function' ? window.AntcvAnalysisReportAvailable() : null };
  });
  await browser.close();
  return { ...r, errs };
}

const a = await boot(true);
const aOk = a.present && a.hookCalls === 1 && a.hookDefined && a.available === true;
console.log(`with analysis: button + click delegates: ${aOk?'OK':'FAIL'} ${aOk?'':JSON.stringify(a)}`);
const b = await boot(false);
const bOk = !b.present && b.available === false;
console.log(`without analysis: button hidden: ${bOk?'OK':'FAIL'} ${bOk?'':JSON.stringify(b)}`);
await new Promise(r=>server.close(r));
const errsAll = [...a.errs, ...b.errs];
console.log('app errors:', errsAll.length, errsAll.slice(0,2).join('|'));
const ok = aOk && bOk && errsAll.length === 0;
console.log(ok ? 'EXPORT-ANALYSIS-BUTTON OK' : 'EXPORT-ANALYSIS-BUTTON FAILED');
process.exit(ok ? 0 : 1);
