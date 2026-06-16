/* DIAGNOSTIC — LANGUAGES-CARD-PERSONAL-001 (owner regression).
 * The Personal subtab must be an order-based flex COLUMN so the LanguageCard
 * island anchors IN PLACE (findSettingsFlexColumn) instead of falling below
 * "Done". Opens Settings -> STANDARD -> Personal via the programmatic route and
 * asserts: (a) the island #antcv-react-personal-languages mounts; (b) its parent
 * is a display:flex;flex-direction:column container; (c) that column also holds
 * the native WRITING STYLE / ADVANCED TONE / BANNED WORDS sections (proving it's
 * the real Personal column, not the Done-button fallback). */
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

const SECTIONS = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'IT expert.' },
  { id:'languages', title:'LANGUAGES', loc:'sidebar', on:true, type:'text', content:'EN, DA' },
], cl:[] };

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1280,height:1400}});
await page.addInitScript(({sections})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Gabriel'}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
},{sections:SECTIONS});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(2500);

const opened = await page.evaluate(()=>{
  if(typeof window._antcvOpenSettingsRoute!=='function') return false;
  window._antcvOpenSettingsRoute({tier:'standard',subtab:'personal',source:'diag'});
  return true;
});
await page.waitForTimeout(3000);

const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
check('settings route available + opened', opened);

const r = await page.evaluate(()=>{
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const anchor=document.getElementById('antcv-react-personal-languages');
  if(!anchor) return {anchor:false, hasStandard:/STANDARD/.test(document.body.textContent||'')};
  const col=anchor.parentElement; const cs=getComputedStyle(col);
  const colText=norm(col.textContent);
  return {
    anchor:true,
    disp:cs.display, dir:cs.flexDirection,
    islandOrder:getComputedStyle(anchor).order,
    hasWriting:/WRITING STYLE/i.test(colText),
    hasTone:/ADVANCED TONE/i.test(colText),
    hasBanned:/BANNED WORDS/i.test(colText),
    hasImport:/Import profile from Word or PDF/i.test(colText),
    kidCount:col.childElementCount,
  };
});
check('LanguageCard island mounted (#antcv-react-personal-languages)', r.anchor, JSON.stringify(r));
if(r.anchor){
  check('island parent is a flex COLUMN (order layout now active)', r.disp==='flex' && r.dir==='column', `disp=${r.disp} dir=${r.dir}`);
  // It's the real Personal column (not the Done-button fallback): it holds the
  // yl-unique import control + WRITING STYLE + the order-based Advanced Tone /
  // Banned Words sections, and the island sits in a real order slot.
  check('island is IN PLACE in the Personal column (not the Done fallback)',
    r.hasImport && r.hasWriting && r.hasTone && r.hasBanned && r.kidCount>=8, JSON.stringify(r));
  check('island has a real CSS order slot (pre-authored order layout active)',
    Number(r.islandOrder) > 0, `order=${r.islandOrder}`);
}
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));

await browser.close(); await new Promise(r2=>server.close(r2));
const ok=checks.every(Boolean);
console.log(ok?'LANGUAGES-CARD-PERSONAL OK':'LANGUAGES-CARD-PERSONAL FAIL');
process.exit(ok?0:1);
