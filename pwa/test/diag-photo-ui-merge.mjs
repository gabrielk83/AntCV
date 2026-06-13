/* DIAGNOSTIC — SIDECAR-CONSOLIDATE G10: antcv-photo-ui-427.js merges the three
 * photo sidecars (position sweeper + pentagon shape + bridge button) behind ONE
 * shared rAF scheduler + ONE MutationObserver. Asserts all three modules still
 * install: the three debug globals exist, the Pentagon button injects into a
 * synthetic shape row, and the ◐ Sidebar bridge button injects into a synthetic
 * PROFILE PHOTO section. */
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
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 0. the three debug globals from the merged file
const globals = await page.evaluate(()=>({
  pos: !!(window.AntcvPhotoPosition && Array.isArray(window.AntcvPhotoPosition.POSITIONS)),
  pent: !!(window.AntcvPentagonShape && typeof window.AntcvPentagonShape._apply==='function'),
  bridge: window.__antcvPhotoBridgeButtonInstalled,
  suite: window.__antcvPhotoUI427,
}));
check('0. all three module globals exposed (position + pentagon + bridge + suite)',
  globals.pos && globals.pent && globals.bridge==='1.50.422' && globals.suite==='1.50.427', JSON.stringify(globals));

// 1. Pentagon button injects into a synthetic shape row
const pent = await page.evaluate(async ()=>{
  const row=document.createElement('div'); row.className='antcv-fp-shape-row';
  ['circle','rounded','square'].forEach(s=>{ const b=document.createElement('button'); b.className='antcv-fp-shape-btn'; b.setAttribute('data-shape',s); b.textContent=s; row.appendChild(b); });
  document.body.appendChild(row);
  await new Promise(r=>setTimeout(r,400));
  const p=row.querySelector('button[data-shape="pentagon"]');
  return { present: !!p, afterSquare: !!(p && p.previousElementSibling && p.previousElementSibling.getAttribute('data-shape')==='square') };
});
check('1. Pentagon button injected after Square', pent.present && pent.afterSquare, JSON.stringify(pent));

// 2. ◐ Sidebar bridge button injects into a synthetic PROFILE PHOTO section
const bridge = await page.evaluate(async ()=>{
  const sec=document.createElement('div');
  const h=document.createElement('div'); h.textContent='PROFILE PHOTO'; sec.appendChild(h);
  const rowWrap=document.createElement('div');
  ['📍Sidebar top','♦ Header left','× Hidden'].forEach(t=>{ const b=document.createElement('button'); b.textContent=t; rowWrap.appendChild(b); });
  sec.appendChild(rowWrap);
  document.body.appendChild(sec);
  await new Promise(r=>setTimeout(r,500));
  const b=sec.querySelector('[data-antcv-bridge-button="1"]');
  return { present: !!b, label: b && b.textContent, beforeHidden: !!(b && b.nextElementSibling && /hidden/i.test(b.nextElementSibling.textContent||'')) };
});
check('2. ◐ Sidebar bridge button injected before Hidden', bridge.present && /bridge/i.test(bridge.label||'') && bridge.beforeHidden, JSON.stringify(bridge));

// 3. exactly ONE MutationObserver-driven suite (single shared scheduler) — sanity: no page errors
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PHOTO-UI-MERGE OK':'PHOTO-UI-MERGE FAIL');
process.exit(ok?0:1);
