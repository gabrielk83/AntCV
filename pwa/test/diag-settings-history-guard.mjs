/* DIAGNOSTIC — SETTINGS-ROLLER-RESET-001 fix (antcv-settings-history-guard.js).
 * Live-confirmed mechanism: mouse side/tilt buttons send Back/Forward; with
 * Settings open, Back was a REAL navigation → app reboot (Loading gate) →
 * restored Settings ("mini-reset"). The guard pushes a sentinel history state
 * while the panel is open; Back consumes the sentinel, the popstate handler
 * re-pushes it and closes the panel like ✕.
 * Asserts: after history.back() with Settings open — (1) NO navigation/reload
 * (a window marker survives), (2) the panel CLOSED, (3) the sentinel is back
 * on top. Control: guard disabled via kill-switch → back navigates (marker
 * lost). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;

async function run(killSwitch){
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1300,height:950}});
  await page.addInitScript((kill)=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify(7));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
    localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
    if(kill)localStorage.setItem('antcv:no-settings-history-guard','1');
  },killSwitch);
  // give the tab a REAL prior history entry so back() has somewhere to go
  await page.goto(`http://127.0.0.1:${port}/manifest.json`,{waitUntil:'load'});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(5000);
  await page.evaluate(()=>{window.__guardProbe='alive';window._antcvOpenSettingsRoute({tier:'standard',subtab:'account',source:'diag'});});
  await page.waitForTimeout(2500);
  const openBefore=await page.evaluate(()=>({open:Array.from(document.querySelectorAll('div')).some(d=>{const cs=getComputedStyle(d);return cs.position==='fixed'&&/Settings/.test(d.textContent||'')&&/Standard/i.test(d.textContent||'');}),sentinel:!!(history.state&&history.state.antcvSettingsGuard===1)}));
  await page.evaluate(()=>history.back()).catch(()=>{});
  await page.waitForTimeout(2000);
  const after=await page.evaluate(()=>({marker:window.__guardProbe||'GONE',url:location.pathname,
    open:Array.from(document.querySelectorAll('div')).some(d=>{const cs=getComputedStyle(d);return cs.position==='fixed'&&/Settings/.test(d.textContent||'')&&/Standard/i.test(d.textContent||'');}),
    sentinel:!!(history.state&&history.state.antcvSettingsGuard===1)})).catch(()=>({marker:'GONE',url:'(navigated)',open:false,sentinel:false}));
  await browser.close();
  return {openBefore,after};
}

const guarded=await run(false);
const control=await run(true);
console.log('guarded:',JSON.stringify(guarded));
console.log('control(kill-switch):',JSON.stringify(control));
const ok =
  guarded.openBefore.open && guarded.openBefore.sentinel &&        // panel open, sentinel armed
  guarded.after.marker==='alive' &&                                 // NO reload/navigation
  guarded.after.url==='/index.html' &&
  !guarded.after.open &&                                            // panel closed like ✕
  guarded.after.sentinel &&                                         // sentinel re-pushed
  control.after.marker==='GONE';                                    // kill-switch: back navigates as before
server.close();
console.log(ok?'SETTINGS-HISTORY-GUARD OK':'SETTINGS-HISTORY-GUARD FAIL');
process.exit(ok?0:1);
