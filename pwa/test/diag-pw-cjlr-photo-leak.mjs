/* DIAGNOSTIC — PW-CJLR-PHOTO-LEAK-001: the profile/work-style CJLR cycler must
 * NOT inject into the PROFILE PHOTO card's Shape/Contour/Shadow rows (where it
 * flickered against the photo-bridge stripper). Injects a synthetic "PROFILE
 * PHOTO" card with an .antcv-fp-shape-row (3 buttons incl. Off/On) and asserts
 * no [data-antcv-profile-workstyle-cjlr] button appears in it. */
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
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(2500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// build a synthetic PROFILE PHOTO card with a SHADOW shape-row.
const leaked = await page.evaluate(async ()=>{
  const card=document.createElement('div');
  const h=document.createElement('div'); h.textContent='PROFILE PHOTO'; card.appendChild(h);
  const row=document.createElement('div'); row.className='antcv-fp-shape-row';
  ['Off','reset','On'].forEach(t=>{ const b=document.createElement('button'); b.className='antcv-fp-shape-btn'; b.textContent=t; row.appendChild(b); });
  card.appendChild(row); document.body.appendChild(card);
  await new Promise(r=>setTimeout(r,800)); // let the 238 sweep run
  return {
    leakInShapeRow: row.querySelectorAll('[data-antcv-profile-workstyle-cjlr]').length,
    leakInCard: card.querySelectorAll('[data-antcv-profile-workstyle-cjlr]').length,
  };
});
check('1. no workstyle CJLR button injected into the PROFILE PHOTO shape row', leaked.leakInShapeRow===0 && leaked.leakInCard===0, JSON.stringify(leaked));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PW-CJLR-PHOTO-LEAK OK':'PW-CJLR-PHOTO-LEAK FAIL');
process.exit(ok?0:1);
