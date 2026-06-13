/* DIAGNOSTIC — SPELL-RELOCATE-001 + SPELL-EN-VARIANT-001:
 * 1. the SPELLING settings block injects as a collapsible <details> UNDER the
 *    Languages card (Settings → Personal, order 21), not the Account zone;
 * 2. it carries the master toggle + English with a UK/US variant selector
 *    (default UK) + Dansk + Español;
 * 3. clicking US flips AntcvSpell._enVariant() to 'us' (dictionary reloads);
 * 4. it is NOT sticky — removed when the Languages anchor is gone.
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
  localStorage.setItem('language', JSON.stringify('en'));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 0. API present + default variant UK
const api = await page.evaluate(()=>({ has: !!(window.AntcvSpell && window.AntcvSpell.version), v: window.AntcvSpell && window.AntcvSpell._enVariant && window.AntcvSpell._enVariant(), inv: !!(window.AntcvSpell && window.AntcvSpell._invalidate) }));
check('0. AntcvSpell present, default variant = gb (UK), _invalidate exposed', api.has && api.v==='gb' && api.inv, JSON.stringify(api));

// inject a synthetic Personal column with the languages anchor; the annotator
// MutationObserver places the SPELLING <details> under it.
const placed = await page.evaluate(async ()=>{
  const col=document.createElement('div'); col.style.display='flex'; col.style.flexDirection='column';
  const lang=document.createElement('div'); lang.id='antcv-react-personal-languages'; lang.style.order='20';
  col.appendChild(lang); document.body.appendChild(col);
  await new Promise(r=>setTimeout(r,900));
  const b=document.getElementById('antcv-spell-settings');
  return {
    present: !!b, tag: b&&b.tagName, sameCol: !!(b&&b.parentElement===col), order: b&&b.style.order,
    summary: !!(b&&/SPELLING/.test(b.querySelector('summary')?.textContent||'')),
    uk: !!(b&&b.querySelector('[data-antcv-en-variant="gb"]')), us: !!(b&&b.querySelector('[data-antcv-en-variant="us"]')),
    da: /Dansk/.test(b&&b.textContent||''), es: /Español/.test(b&&b.textContent||''),
    master: /Spelling underlines/.test(b&&b.textContent||''),
  };
});
check('1. SPELLING is a <details> under the Languages card (order 21) with master + EN/UK/US + DA + ES',
  placed.present && placed.tag==='DETAILS' && placed.sameCol && placed.order==='21' && placed.summary &&
  placed.uk && placed.us && placed.da && placed.es && placed.master, JSON.stringify(placed));

// 2. click US → variant flips to us
const variant = await page.evaluate(async ()=>{
  document.querySelector('#antcv-spell-settings [data-antcv-en-variant="us"]').click();
  await new Promise(r=>setTimeout(r,150));
  return { v: window.AntcvSpell._enVariant(), stored: localStorage.getItem('antcv:spell:enVariant') };
});
check('2. clicking US sets English variant to us (dictionary reloads)', variant.v==='us' && variant.stored==='us', JSON.stringify(variant));

// 3. not sticky — remove the languages anchor → SPELLING removed
const sticky = await page.evaluate(async ()=>{
  const l=document.getElementById('antcv-react-personal-languages'); if(l) l.remove();
  await new Promise(r=>setTimeout(r,900));
  return { stillThere: !!document.getElementById('antcv-spell-settings') };
});
check('3. SPELLING removed when Languages anchor gone (not sticky)', sticky.stillThere===false, JSON.stringify(sticky));

check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'SPELL-RELOCATE-VARIANT OK':'SPELL-RELOCATE-VARIANT FAIL');
process.exit(ok?0:1);
