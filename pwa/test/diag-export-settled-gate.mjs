/* VERIFICATION — EXPORT-SETTLED-001. An export triggered DURING boot (before the doc settles) is
 * swallowed + a toast shown, then AUTO-FIRES once settled. An export after settling passes straight
 * through. Uses a synthetic button[title="Export as PDF"] whose click is recorded. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const sections = { cv:[ { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' } ], cl:[] };
const personalInfo = { name:'A', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:disable-login-warmup','1');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });

// ASAP after load (well before settle): inject an export button + click it ONCE.
await page.evaluate(()=>{
  window.__exportFired = [];
  const b = document.createElement('button');
  b.id='__test_export'; b.title='Export as PDF';
  b.addEventListener('click', ()=>{ window.__exportFired.push(1); });
  document.body.appendChild(b);
  b.click();   // early click — should be GATED
});
const early = await page.evaluate(()=>({
  gateLoaded: !!window.__antcvExportSettledGate,
  fired: (window.__exportFired||[]).length,
  toast: !!document.getElementById('antcv-export-settling-toast'),
  settledNow: window.AntcvExportSettledGate ? window.AntcvExportSettledGate.settled() : null,
}));

// wait past the cover (MAX_MS 9s) + settle window, then confirm the gated export auto-fired.
await page.waitForTimeout(12000);
const late = await page.evaluate(()=>({
  fired: (window.__exportFired||[]).length,
  toast: !!document.getElementById('antcv-export-settling-toast'),
  settledNow: window.AntcvExportSettledGate ? window.AntcvExportSettledGate.settled() : null,
}));

// after settled, a fresh click should pass straight through (fire immediately).
await page.evaluate(()=>{ document.getElementById('__test_export').click(); });
const passthrough = await page.evaluate(()=>({ fired:(window.__exportFired||[]).length }));

await browser.close(); await new Promise(rr=>server.close(rr));

console.log('early :', JSON.stringify(early));
console.log('late  :', JSON.stringify(late));
console.log('passthrough fired total:', passthrough.fired);
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!early.gateLoaded) { pass=false; fails.push('gate did not load'); }
if (early.fired !== 0) { pass=false; fails.push('early export was NOT gated (fired '+early.fired+')'); }
if (!early.toast) { pass=false; fails.push('no settling toast on the gated export'); }
if (early.settledNow !== false) { pass=false; fails.push('settled() should be false during boot, got '+early.settledNow); }
if (late.fired !== 1) { pass=false; fails.push('gated export did NOT auto-fire after settle (fired '+late.fired+')'); }
if (late.toast) { pass=false; fails.push('toast not cleared after settle'); }
if (late.settledNow !== true) { pass=false; fails.push('settled() should be true after the window, got '+late.settledNow); }
if (passthrough.fired !== 2) { pass=false; fails.push('post-settle click did not pass straight through (total '+passthrough.fired+')'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — EXPORT-SETTLED-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  early export gated + toast → auto-fired on settle → post-settle export passes straight through; zero errors.');
