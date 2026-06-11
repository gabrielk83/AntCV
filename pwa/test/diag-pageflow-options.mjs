/* DIAGNOSTIC — PAGEBREAK-STYLE-OPTIONS-001 preview halves (1.50.378).
 * Boots a 2-page CV (long sidebar list → 2 native page-rows) twice:
 *   A) styleConfig { pageNumbers:'top-right', repeatHeader:true } →
 *      every page-row carries a corner number; page 2 has the slim
 *      repeated candidate strip; the sidebar continuation keeps its
 *      "(CONT.)" heading (contHeadlines default ON).
 *   B) styleConfig { contHeadlines:false } → the continuation segment
 *      renders BARE (no "(CONT.)" text), no page numbers, no strip.
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

const reg = [];
for (let g = 0; g < 3; g++) {
  reg.push({ group: 'Group ' + g });
  const per = g === 0 ? 16 : 4;
  for (let e = 0; e < per; e++) reg.push({ l: 'Reg ' + g + '.' + e, v: 'Detailed regulatory context line describing the applicable framework, scope and obligations in some depth across several wrapped lines of text.' });
}
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Short profile line.' },
  { id:'regctx', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: reg },
], cl: [] };

async function boot(styleCfg) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  await page.addInitScript(({secs, cfg})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Tester' }));
    localStorage.setItem('meta', JSON.stringify({ subtitle:'Regulatory Affairs Specialist' }));
    if (cfg) localStorage.setItem('styleConfig', JSON.stringify(cfg));
  }, { secs: sections, cfg: styleCfg });
  const errs = [];
  page.on('pageerror', e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(6500);
  const r = await page.evaluate(()=>{
    const rows = document.querySelectorAll('.antcv-page-row').length;
    const nums = Array.from(document.querySelectorAll('[data-antcv-page-number]')).map(e=>e.textContent);
    const strips = Array.from(document.querySelectorAll('[data-antcv-repeat-header]')).map(e=>(e.textContent||'').slice(0,50));
    const contHead = (document.body.textContent||'').includes('(CONT.)');
    return { rows, nums, strips, contHead };
  });
  await browser.close();
  return { ...r, errs };
}

const a = await boot({ pageNumbers: 'top-right', repeatHeader: true });
const aOk = a.rows === 2 && a.nums.length === 2 && a.nums.join(',') === '1,2'
  && a.strips.length === 1 && a.strips[0].includes('Anita Tester') && a.contHead && a.errs.length === 0;
console.log(`A pageNumbers+repeatHeader+(CONT.) default: ${aOk?'OK':'FAIL'} ${aOk?'':JSON.stringify(a)}`);

const b = await boot({ contHeadlines: false });
const bOk = b.rows === 2 && b.nums.length === 0 && b.strips.length === 0 && !b.contHead && b.errs.length === 0;
console.log(`B contHeadlines off => bare continuation, no extras: ${bOk?'OK':'FAIL'} ${bOk?'':JSON.stringify(b)}`);

await new Promise(r=>server.close(r));
const ok = aOk && bOk;
console.log(ok ? 'PAGEFLOW-OPTIONS OK' : 'PAGEFLOW-OPTIONS FAILED');
process.exit(ok ? 0 : 1);
