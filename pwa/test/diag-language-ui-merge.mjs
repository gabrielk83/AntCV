/* DIAGNOSTIC — SIDECAR-CONSOLIDATE G6: antcv-language-ui-429.js merges the
 * language prefs/filter trio behind ONE shared rAF scheduler + ONE
 * MutationObserver. Asserts all three modules install: the three debug globals
 * exist, enabledLanguages is seeded (defaults), and the lang-bar-filter hides a
 * non-selected language button in a synthetic top bar. */
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
await page.waitForTimeout(4000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 0. the three module globals + suite flag
const g = await page.evaluate(()=>({
  filter: !!(window.AntcvLangBarFilter && typeof window.AntcvLangBarFilter._applyAll==='function'),
  prefs: !!(window.AntcvLanguagePrefs && typeof window.AntcvLanguagePrefs.get==='function'),
  defaults: !!(window.AntcvLanguagePrefsDefaults && typeof window.AntcvLanguagePrefsDefaults.save==='function'),
  suite: window.__antcvLanguageUI429,
  filterFlag: window.__antcvLangBarFilterInstalled,
  prefsFlag: window.__antcvLanguagePrefsInstalled,
  defFlag: window.__antcvLanguagePrefsDefaults,
}));
check('0. all three module globals exposed (filter + prefs + defaults + suite)',
  g.filter && g.prefs && g.defaults && g.suite==='1.50.429' && g.filterFlag && g.prefsFlag && g.defFlag, JSON.stringify(g));

// 1. defaults seeded enabledLanguages to EN+DA (none was stored at boot)
const seeded = await page.evaluate(()=>{
  let v=null; try{ v=JSON.parse(localStorage.getItem('enabledLanguages')||'null'); }catch(_){}
  return v;
});
check('1. defaults seeded enabledLanguages = [en,da]',
  Array.isArray(seeded) && seeded.length===2 && seeded.includes('en') && seeded.includes('da'), JSON.stringify(seeded));

// 2. lang-bar-filter hides a non-selected language button in a synthetic bar
const filtered = await page.evaluate(async ()=>{
  // preference = en,da only
  window.AntcvLangBarFilter.setPreference(['en','da']);
  // build a synthetic language bar: 3 sibling buttons EN/DA/ES
  const bar=document.createElement('div'); bar.id='__synthLangBar';
  ['EN','DA','ES'].forEach(t=>{ const b=document.createElement('button'); b.textContent=t; bar.appendChild(b); });
  document.body.appendChild(bar);
  await new Promise(r=>setTimeout(r,500));
  const btns=[...bar.querySelectorAll('button')];
  const state=btns.map(b=>({t:b.textContent,hidden:b.getAttribute('data-antcv-lang-hidden')==='1'||b.style.display==='none'}));
  return state;
});
const es = filtered.find(s=>s.t==='ES');
const en = filtered.find(s=>s.t==='EN');
check('2. lang-bar-filter hides ES, keeps EN (pref=en,da)',
  !!es && es.hidden===true && !!en && en.hidden===false, JSON.stringify(filtered));

check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'LANGUAGE-UI-MERGE OK':'LANGUAGE-UI-MERGE FAIL');
process.exit(ok?0:1);
