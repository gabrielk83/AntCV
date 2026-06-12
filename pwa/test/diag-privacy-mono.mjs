/* DIAGNOSTIC — PRIVACY-FAB-COLOR-001 (owner 2026-06-12: the mobile shield's
 * white+red colour emoji "screams"). At a mobile viewport the privacy pill's
 * glyph renders as a single-colour silhouette (transparent colour +
 * fg-coloured text-shadow); at desktop width the native glyph stays.
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
async function probe(width) {
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.addInitScript(()=>{
    if (localStorage.getItem('__antcvDiagSeeded')) return;
    localStorage.setItem('__antcvDiagSeeded','1');
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  });
  const errs=[];
  page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=document.querySelector('.antcv-privacy-glyph');
    if(!g) return {found:false};
    const cs=getComputedStyle(g);
    return {found:true, color:cs.color, shadow:cs.textShadow, txt:g.textContent};
  });
  await page.close();
  return {r, errs};
}

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

const mob = await probe(420);
check('mobile: glyph is single-colour silhouette',
  mob.r.found && /rgba\(0, 0, 0, 0\)|transparent/.test(mob.r.color) && mob.r.shadow !== 'none' && mob.errs.length===0,
  JSON.stringify(mob));
const desk = await probe(1500);
check('desktop: native glyph kept (no transparent hack)',
  desk.r.found && !/rgba\(0, 0, 0, 0\)|transparent/.test(desk.r.color) && desk.errs.length===0,
  JSON.stringify(desk));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PRIVACY-MONO OK':'PRIVACY-MONO FAIL');
process.exit(ok?0:1);
