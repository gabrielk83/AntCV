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

// 1x1 PNG data URL — enough for the photo medallion to render.
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function boot(styleCfg, opts) {
  opts = opts || {};
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  await page.addInitScript(({secs, cfg, photo, photoPos})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Tester' }));
    localStorage.setItem('meta', JSON.stringify({ subtitle:'Regulatory Affairs Specialist' }));
    if (cfg) localStorage.setItem('styleConfig', JSON.stringify(cfg));
    if (photo) localStorage.setItem('photo', JSON.stringify(photo));
    if (photoPos) localStorage.setItem('photoPosition', JSON.stringify(photoPos));
  }, { secs: sections, cfg: styleCfg, photo: opts.photo || null, photoPos: opts.photoPos || null });
  const errs = [];
  page.on('pageerror', e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(6500);
  const r = await page.evaluate(()=>{
    const rows = document.querySelectorAll('.antcv-page-row').length;
    const nums = Array.from(document.querySelectorAll('[data-antcv-page-number]')).map(e=>e.textContent);
    const strips = Array.from(document.querySelectorAll('[data-antcv-repeat-header]')).map(e=>(e.textContent||'').slice(0,50));
    const stripPhotos = document.querySelectorAll('[data-antcv-repeat-header] [data-antcv-repeat-photo]').length;
    const contHead = (document.body.textContent||'').includes('(CONT.)');
    return { rows, nums, strips, stripPhotos, contHead };
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

// AUTO-PAGEBREAK-BLOCK-001 follow-up (b): with a photo set + repeatHeader on, the
// page-2 slim strip carries a medallion; with photoPosition hidden it does not.
const c = await boot({ repeatHeader: true }, { photo: PHOTO, photoPos: 'sidebar-top' });
const cOk = c.rows === 2 && c.strips.length === 1 && c.strips[0].includes('Anita Tester')
  && c.stripPhotos === 1 && c.errs.length === 0;
console.log(`C repeatHeader photo on page 2 strip: ${cOk?'OK':'FAIL'} ${cOk?'':JSON.stringify(c)}`);

const d = await boot({ repeatHeader: true }, { photo: PHOTO, photoPos: 'hidden' });
const dOk = d.rows === 2 && d.strips.length === 1 && d.stripPhotos === 0 && d.errs.length === 0;
console.log(`D photoPosition hidden => no medallion in strip: ${dOk?'OK':'FAIL'} ${dOk?'':JSON.stringify(d)}`);

await new Promise(r=>server.close(r));
const ok = aOk && bOk && cOk && dOk;
console.log(ok ? 'PAGEFLOW-OPTIONS OK' : 'PAGEFLOW-OPTIONS FAILED');
process.exit(ok ? 0 : 1);
