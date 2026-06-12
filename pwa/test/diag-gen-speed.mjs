/* DIAGNOSTIC — GEN-SPEED-001:
 *   1. Speed pills (Fast / Balanced / Thorough) render near Generate;
 *   2. Balanced is the highlighted default with nothing stored;
 *   3. clicking Fast persists antcv:genSpeed='fast' and moves the highlight;
 *   4. the choice survives a reload (pill highlight read back from storage).
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
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(()=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('upload'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

const state = () => page.evaluate(()=>{
  const pills=[...document.querySelectorAll('[data-antcv-genspeed]')];
  return {
    count: pills.length,
    labels: pills.map(b=>b.textContent),
    active: pills.filter(b=>b.style.borderColor.includes('1, 183, 187')||/01B7BB/i.test(b.style.borderColor)).map(b=>b.getAttribute('data-antcv-genspeed')),
    stored: localStorage.getItem('antcv:genSpeed'),
  };
});

let s = await state();
check('1. three speed pills render', s.count===3 && /Fast/.test(s.labels[0]) && /Balanced/.test(s.labels[1]) && /Thorough/.test(s.labels[2]), JSON.stringify(s));
check('2. balanced highlighted by default, nothing stored', s.active.length===1 && s.active[0]==='balanced' && s.stored===null, JSON.stringify(s));

await page.click('[data-antcv-genspeed="fast"]');
await page.waitForTimeout(300);
s = await state();
check('3. Fast click persists + re-highlights', s.stored==='"fast"' && s.active.length===1 && s.active[0]==='fast', JSON.stringify(s));

await page.reload({waitUntil:'load'});
await page.waitForTimeout(6000);
s = await state();
check('4. choice survives reload', s.stored==='"fast"' && s.active.length===1 && s.active[0]==='fast', JSON.stringify(s));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'GEN-SPEED OK':'GEN-SPEED FAIL');
process.exit(ok?0:1);
