/* DIAGNOSTIC — OUTCOMES-METRIC-GUARD-001 (1.50.390).
 *   1. metric-free SELECTED OUTCOMES → amber chip pinned to the section;
 *   2. fixing the data (adding a number) clears the chip on re-check;
 *   3. outcomes WITH numbers from the start → no chip;
 *   4. written multipliers count as metrics (no chip).
 */
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

async function boot(items) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  await page.addInitScript((items)=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify({ cv:[
      { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Profile.' },
      { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items },
    ], cl:[] }));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita' }));
  }, items);
  const errs = [];
  page.on('pageerror', e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(6500);
  return { browser, page, errs };
}

// 1+2 — metric-free flags, fix clears
{
  const { browser, page, errs } = await boot([{ b:'Delivered', t:'requirements into executable scope.' }]);
  const r = await page.evaluate(async ()=>{
    const chip1 = document.querySelectorAll('.antcv-metric-guard-chip').length;
    // fix the data: add a number, re-check
    const root = JSON.parse(localStorage.getItem('sections'));
    root.cv[1].items[0].t = 'change cycle from 250 to 10 days.';
    localStorage.setItem('sections', JSON.stringify(root));
    window.AntcvMetricGuard.check();
    await new Promise(r2=>setTimeout(r2,400));
    return { chip1, chip2: document.querySelectorAll('.antcv-metric-guard-chip').length };
  });
  await browser.close();
  const ok = r.chip1 === 1 && r.chip2 === 0 && errs.length === 0;
  console.log(`metric-free flags, fix clears: ${ok?'OK':'FAIL'} ${ok?'':JSON.stringify({...r, errs: errs.slice(0,2)})}`);
  if (!ok) { await new Promise(r2=>server.close(r2)); console.log('METRIC-GUARD FAILED'); process.exit(1); }
}
// 3 — numeric from the start: no chip
{
  const { browser, page, errs } = await boot([{ b:'Cut', t:'cycle time 95% across 7 teams.' }]);
  const n = await page.evaluate(()=>document.querySelectorAll('.antcv-metric-guard-chip').length);
  await browser.close();
  const ok = n === 0 && errs.length === 0;
  console.log(`numeric outcomes: no chip: ${ok?'OK':'FAIL'}`);
  if (!ok) { await new Promise(r2=>server.close(r2)); console.log('METRIC-GUARD FAILED'); process.exit(1); }
}
// 4 — written multiplier: no chip
{
  const { browser, page, errs } = await boot([{ b:'Raised', t:'throughput threefold across the line.' }]);
  const n = await page.evaluate(()=>document.querySelectorAll('.antcv-metric-guard-chip').length);
  await browser.close();
  const ok = n === 0 && errs.length === 0;
  console.log(`written multiplier counts: ${ok?'OK':'FAIL'}`);
  if (!ok) { await new Promise(r2=>server.close(r2)); console.log('METRIC-GUARD FAILED'); process.exit(1); }
}
await new Promise(r=>server.close(r));
console.log('METRIC-GUARD OK');
process.exit(0);
