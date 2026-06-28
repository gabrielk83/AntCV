/* DIAGNOSTIC (read-only) — verifies EXPORT-WARMUP-001 (antcv-pdf-worker-warmup.js):
 * after boot, the warmup proactively calls the docx-worker /health probe (via
 * window.isPdfWorkerAvailable) WITHOUT any user export click, so the availability
 * cache is populated before the first PDF export. Asserts: editor boots, the sidecar
 * installed (__antcvPdfWarmup), at least one /health fetch fired proactively, and no
 * sidecar console errors. Does NOT edit anything. */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Operations specialist.' },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'A',v:'b'}] },
];
const personalInfo = { name:'Gabriel', headline:'Ops', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errors = [];
page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e=>errors.push('PAGEERROR: '+(e&&e.message)));
// Count /health requests + stub them so we don't depend on the real worker being reachable.
let healthHits = 0;
await page.route('**/health', (route)=>{ healthHits++; route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ ok:true, pdf_via:'cloudconvert' }) }); });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('antcv:disable-loading-gate','1');
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [{cv,cl:[{id:'greeting',title:'Greeting',loc:'main',on:true,type:'text',content:'Dear'}]}, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
// warmup fires at ~2500ms; allow margin for the probe + a possible retry.
await page.waitForTimeout(7000);

const probe = await page.evaluate(()=>({
  installed: window.__antcvPdfWarmup === 1,
  hasProbeFn: typeof window.isPdfWorkerAvailable === 'function',
  editorRendered: /TOOLS|PROFILE/i.test(document.body.innerText||''),
}));
await browser.close(); await new Promise(rr=>server.close(rr));

const sidecarErrors = errors.filter(e=>/pdf-worker-warmup/.test(e));
console.log('installed:', probe.installed, '| probe fn present:', probe.hasProbeFn, '| editor rendered:', probe.editorRendered);
console.log('proactive /health hits (no user click):', healthHits, '(expect >=1)');
console.log('sidecar console errors:', sidecarErrors.length, sidecarErrors.slice(0,3));

const ok = probe.installed && probe.editorRendered && healthHits >= 1 && sidecarErrors.length === 0;
console.log(ok ? '\nPDF-WARMUP OK — warmup proactively probed /health after boot, before any export click.' : '\nPDF-WARMUP FAIL — see above');
process.exit(ok ? 0 : 1);
