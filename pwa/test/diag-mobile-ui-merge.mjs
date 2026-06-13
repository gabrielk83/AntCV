/* DIAGNOSTIC — SIDECAR-MERGE-G5: the consolidated mobile-ui sidecar installs
 * at a mobile viewport, injects its CSS (275+352+354 rules), exposes the
 * back-compat globals, and boots with no page errors. The old 4 files are
 * no longer referenced.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();
// mobile viewport
const page=await browser.newPage({viewport:{width:380,height:820}, isMobile:true, hasTouch:true});
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

const r = await page.evaluate(()=>({
  installed: window.__antcvMobileUi418,
  api: !!window.AntcvMobileUi418,
  backcompat: !!(window.AntcvMobileTopbarCleanup275 && window.AntcvMobileFabCleanup351 && window.AntcvMobileBottomCompact352 && window.AntcvMobileAltCirclesDropdown354),
  css: !!document.getElementById('antcv-mobile-ui-418-css'),
  cssHas275: (document.getElementById('antcv-mobile-ui-418-css')||{}).textContent?.includes('antcv-panel-escape-btn'),
  cssHas352: (document.getElementById('antcv-mobile-ui-418-css')||{}).textContent?.includes('antcv-react-bottom-nav'),
  cssHas354: (document.getElementById('antcv-mobile-ui-418-css')||{}).textContent?.includes('antcv-altdrop'),
}));
check('1. merged sidecar installed + API + back-compat globals', r.installed==='1.50.418' && r.api && r.backcompat, JSON.stringify(r));
check('2. one combined stylesheet carries 275+352+354 rules', r.css && r.cssHas275 && r.cssHas352 && r.cssHas354, JSON.stringify(r));
check('3. no page errors at mobile viewport', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'MOBILE-UI-MERGE OK':'MOBILE-UI-MERGE FAIL');
process.exit(ok?0:1);
