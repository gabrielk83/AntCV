/* DIAGNOSTIC — VISUAL-PKG-001 (owner): the native Layout heading "STYLE PACKAGE"
 * is relabelled "Visual package", and the PackagePicker island anchors on it via
 * the widened STYLE_PACKAGE_RE (/^(STYLE PACKAGE|Visual package)$/i). Opens
 * Settings -> STANDARD -> Layout via the programmatic route and asserts: (a) the
 * heading reads "Visual package"; (b) the old "STYLE PACKAGE" string is gone;
 * (c) the PackagePicker island (#antcv-react-package-picker) still mounts (anchor
 * survived the rename). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port; const base = `http://127.0.0.1:${port}`;

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1280,height:1400}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'G'}));
  localStorage.setItem('wizardCompleted',JSON.stringify(true));localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(2500);
const opened = await page.evaluate(()=>{ if(typeof window._antcvOpenSettingsRoute!=='function') return false; window._antcvOpenSettingsRoute({tier:'standard',subtab:'layout',source:'diag'}); return true; });
await page.waitForTimeout(3000);

const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
check('layout route opened', opened);
const r = await page.evaluate(()=>{
  const t=(document.body.textContent||'').replace(/\s+/g,' ');
  return { hasVisualPackage:/Visual package/.test(t), noOldHeading:!/STYLE PACKAGE/i.test(t), pickerMounted:!!document.getElementById('antcv-react-package-picker') };
});
check('heading relabelled "Visual package"', r.hasVisualPackage, JSON.stringify(r));
check('old "STYLE PACKAGE" string gone', r.noOldHeading, JSON.stringify(r));
check('PackagePicker island still anchors after rename', r.pickerMounted, JSON.stringify(r));
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));

await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'VISUAL-PKG-RELABEL OK':'VISUAL-PKG-RELABEL FAIL');
process.exit(ok?0:1);
