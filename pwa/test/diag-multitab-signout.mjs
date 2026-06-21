/* VERIFICATION — MULTITAB-SIGNOUT-001 (handler logic). The cross-tab `storage` event is standard
 * browser behaviour (Playwright doesn't reliably propagate it between same-context pages), so we test
 * the HANDLER directly: a synthetic 'storage' event for the auth token being removed (another tab
 * signing out / deleting) must make THIS tab reload; an unrelated key must NOT. */
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
const pi = { name:'A', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1200, height:900 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, p])=>{
  localStorage.setItem('antcv:auth:token','tok'); localStorage.setItem('antcv:auth:email','a@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'a@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(p));
}, [sections, pi]);
const url = `http://127.0.0.1:${port}/index.html`;
await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(7000);
const installed = await page.evaluate(()=>!!window.__antcvMultitabSignout);

// CASE 1: an unrelated key change must NOT reload
let reloadedOnNoise = false;
{
  const p = page.waitForEvent('load', { timeout: 2500 }).then(()=>true).catch(()=>false);
  await page.evaluate(()=>{ window.dispatchEvent(new StorageEvent('storage', { key:'someUnrelatedKey', oldValue:null, newValue:'x' })); });
  reloadedOnNoise = await p;
}

// CASE 2: the auth token removed in another tab (sign-out) MUST reload
let reloadedOnSignout = false;
{
  const p = page.waitForEvent('load', { timeout: 5000 }).then(()=>true).catch(()=>false);
  await page.evaluate(()=>{ window.dispatchEvent(new StorageEvent('storage', { key:'antcv:auth:token', oldValue:'tok', newValue:null })); });
  reloadedOnSignout = await p;
}
// after the reload, the auth token should be gone (handler cleared it pre-reload)
const tokenAfter = await page.evaluate(()=>localStorage.getItem('antcv:auth:token'));

await browser.close(); await new Promise(rr=>server.close(rr));

console.log('sidecar installed:', installed);
console.log('reloaded on unrelated key (should be false):', reloadedOnNoise);
console.log('reloaded on auth-token removal (should be true):', reloadedOnSignout, '| token after:', tokenAfter);
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!installed) { pass=false; fails.push('sidecar not installed'); }
if (reloadedOnNoise) { pass=false; fails.push('reloaded on an UNRELATED key (false positive)'); }
if (!reloadedOnSignout) { pass=false; fails.push('did NOT reload when the auth token was removed (sign-out)'); }
// (tokenAfter is re-seeded by the test's addInitScript on every reload, so it is not asserted)
console.log('\n'+(pass?'PASS':'FAIL')+' — MULTITAB-SIGNOUT-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  another tab removing the auth token (sign-out/delete) reloads this tab to login; unrelated changes ignored; zero errors.');
