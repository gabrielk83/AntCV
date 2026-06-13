/* DIAGNOSTIC — TENSE-RELOCATE-001: the EXPERIENCE TENSE control injects beside
 * the languages card in Personal (order 28), reads styleConfig.expTense, and
 * writing it persists to styleConfig (via the live hook _antcvSetExpTense,
 * WITHOUT flipping the package to "custom").
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
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
  // seed a known package so we can assert it is NOT flipped to "custom"
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// the live hook must exist (set during the editor render)
const hook = await page.evaluate(()=>typeof window._antcvSetExpTense);
check('0. live hook _antcvSetExpTense exists', hook==='function', hook);

// inject a synthetic Personal flex column with the language-card anchor,
// then let the sidecar observer place the tense control beside it.
const placed = await page.evaluate(async ()=>{
  const col = document.createElement('div');
  col.style.display='flex'; col.style.flexDirection='column';
  const lang = document.createElement('div'); lang.id='antcv-react-personal-languages'; lang.style.order='27';
  col.appendChild(lang); document.body.appendChild(col);
  await new Promise(r=>setTimeout(r,400));
  const t=document.getElementById('antcv-tense-control-422');
  return { present: !!t, sameCol: !!(t && t.parentElement===col), order: t&&t.style.order, buttons: t? [...t.querySelectorAll('button[data-antcv-tense]')].map(b=>b.getAttribute('data-antcv-tense')) : [] };
});
check('1. tense control placed beside languages (order 22)', placed.present && placed.sameCol && placed.order==='22' && placed.buttons.join(',')==='auto,present,past', JSON.stringify(placed));

// click "Past" -> styleConfig.expTense persists, package NOT flipped to custom
const after = await page.evaluate(async ()=>{
  const t=document.getElementById('antcv-tense-control-422');
  [...t.querySelectorAll('button[data-antcv-tense]')].find(b=>b.getAttribute('data-antcv-tense')==='past').click();
  await new Promise(r=>setTimeout(r,300));
  let sc={}; try{ sc=JSON.parse(localStorage.getItem('styleConfig')||'{}'); }catch(_){}
  let pkg=null; try{ pkg=JSON.parse(localStorage.getItem('stylePackage')||'null'); }catch(_){}
  return { expTense: sc.expTense, pkg };
});
check('2. clicking Past persists styleConfig.expTense=past, package unchanged', after.expTense==='past' && after.pkg==='copenhagen-modern', JSON.stringify(after));

// TENSE-STICKY-FIX-001: remove the languages anchor (simulate switching to
// another subtab) -> the tense control must be removed (not sticky).
const sticky = await page.evaluate(async ()=>{
  const lang=document.getElementById('antcv-react-personal-languages');
  if(lang) lang.remove();
  await new Promise(r=>setTimeout(r,700)); // let the sidecar observer re-run
  return { stillThere: !!document.getElementById('antcv-tense-control-422') };
});
check('3. tense control removed when languages anchor gone (not sticky)', sticky.stillThere===false, JSON.stringify(sticky));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'TENSE-CONTROL OK':'TENSE-CONTROL FAIL');
process.exit(ok?0:1);
