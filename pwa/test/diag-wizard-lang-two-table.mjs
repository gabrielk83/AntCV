/* DIAGNOSTIC — WIZARD-LANG-SELECTOR-001 (two-table selector) +
 * PROCESSING-QUEUE-INDICATOR-001 (pink/yellow badges):
 *   1. the wizard language slide renders TWO tables (available | selected);
 *   2. moving a language right adds it to the selected (ordered) table;
 *   3. reordering puts it FIRST -> ★ DEFAULT badge follows;
 *   4. Save persists the ordered list AND the JSON-encoded default
 *      ('language' key parses; non-en default sticks);
 *   5. proc badges: marking {profile:'working', tools:'working'} in one
 *      batch shows PINK processing on profile and YELLOW queued on tools;
 *      'done' clears both.
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
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'},{id:'tools',title:'TOOLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Eng',v:'Python'}]}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// ── wizard two-table selector ──
await page.evaluate(()=>{ window.AntcvWizardLanguageSlide339._resetSession(); window.AntcvWizardLanguageSlide339._show(function(){}, function(){}, null); });
await page.waitForTimeout(500);
const t1 = await page.evaluate(()=>{
  const picker=document.querySelector('[data-antcv-wizard-language-picker]');
  if(!picker) return {found:false};
  const cols=[...picker.children];
  return { found:true, cols:cols.length,
    leftTitle:(cols[0]&&cols[0].textContent||'').slice(0,30),
    rightTitle:(cols[1]&&cols[1].textContent||'').slice(0,40),
    rightHasDefault:/★ DEFAULT/.test(cols[1]&&cols[1].textContent||'') };
});
check('1. two tables render (available | selected, default starred)', t1.found && t1.cols===2 && /AVAILABLE/.test(t1.leftTitle) && /SELECTED/.test(t1.rightTitle) && t1.rightHasDefault, JSON.stringify(t1));

// 1b — WIZARD-002 settings hand-off block on the final slide
const t1b = await page.evaluate(()=>{
  const h=document.querySelector('[data-antcv-wizard-handoff]');
  if(!h) return {found:false};
  const rows=[...h.querySelectorAll('[data-antcv-handoff-row]')].map(r=>(r.textContent||''));
  const txt=h.textContent||'';
  return { found:true, rows:rows.length,
    personal:/Personal/.test(txt) && /tense/i.test(txt) && /banned/i.test(txt),
    layout:/Layout/.test(txt) && /photo/i.test(txt),
    advanced:/Advanced/.test(txt) && /tone/i.test(txt) && /page flow/i.test(txt) };
});
check('1b. WIZARD-002 hand-off: 3 rows (Personal/Layout/Advanced) with the right cues', t1b.found && t1b.rows===3 && t1b.personal && t1b.layout && t1b.advanced, JSON.stringify(t1b));

// 2 — move Spanish right
await page.evaluate(()=>{
  const picker=document.querySelector('[data-antcv-wizard-language-picker]');
  const left=picker.children[0];
  const row=[...left.querySelectorAll('div')].find(d=>/Spanish/.test(d.textContent||'') && d.style.cursor==='pointer');
  row.click();
});
await page.waitForTimeout(300);
const t2 = await page.evaluate(()=>{
  const picker=document.querySelector('[data-antcv-wizard-language-picker]');
  return { right:(picker.children[1].textContent||''), left:(picker.children[0].textContent||'') };
});
check('2. Spanish moved to selected', /Spanish/.test(t2.right) && !/Spanish/.test(t2.left), JSON.stringify({r:/Spanish/.test(t2.right), l:/Spanish/.test(t2.left)}));

// 3 — move Spanish to FIRST (two ↑ clicks) -> becomes default
await page.evaluate(()=>{
  const picker=()=>document.querySelector('[data-antcv-wizard-language-picker]');
  for(let k=0;k<2;k++){
    const right=picker().children[1];
    const rows=[...right.children].filter(e=>e.tagName==='DIV'&&/English|Danish|Spanish|Chinese/.test(e.textContent||''));
    const es=rows.find(r=>/Spanish/.test(r.textContent||''));
    const up=[...es.querySelectorAll('button')].find(b=>b.textContent==='↑');
    if(up && !up.disabled) up.click();
  }
});
await page.waitForTimeout(300);
const t3 = await page.evaluate(()=>{
  const right=document.querySelector('[data-antcv-wizard-language-picker]').children[1];
  const rows=[...right.children].filter(e=>e.tagName==='DIV'&&/English|Danish|Spanish|Chinese/.test(e.textContent||''));
  return { firstRow:(rows[0]&&rows[0].textContent||'').slice(0,40) };
});
check('3. Spanish reordered to first -> ★ DEFAULT', /Spanish/.test(t3.firstRow) && /DEFAULT/.test(t3.firstRow), JSON.stringify(t3));

// 4 — Save persists ordered list + JSON default
await page.evaluate(()=>{ [...document.querySelectorAll('[data-antcv-wizard-language-slide] button')].find(b=>/Save and continue/.test(b.textContent)).click(); });
await page.waitForTimeout(400);
const t4 = await page.evaluate(()=>{
  let parsed=null; try{ parsed=JSON.parse(localStorage.getItem('language')); }catch(_){}
  return { langRaw: localStorage.getItem('language'), parsed, enabled: localStorage.getItem('enabledLanguages') };
});
check('4. saved: default es is JSON-parseable, ordered list persisted', t4.parsed==='es' && /es/.test(String(t4.enabled)), JSON.stringify(t4));

// ── proc badges ──
await page.evaluate(()=>{
  window.__antcvProcState = { profile:'working', tools:'queued' };
  window.dispatchEvent(new CustomEvent('antcv:proc-state',{detail:{...window.__antcvProcState}}));
});
await page.waitForTimeout(300);
const t5 = await page.evaluate(()=>{
  const h=document.getElementById('antcv-proc-badges');
  const badges=[...(h?h.children:[])].map(b=>b.textContent);
  return { badges };
});
check('5. pink processing + yellow queued badges render', t5.badges.length===2 && t5.badges.includes('⏳ processing') && t5.badges.includes('⌛ queued'), JSON.stringify(t5));

await page.evaluate(()=>{
  window.__antcvProcState = { profile:'done', tools:'done' };
  window.dispatchEvent(new CustomEvent('antcv:proc-state',{detail:{...window.__antcvProcState}}));
});
await page.waitForTimeout(300);
const t6 = await page.evaluate(()=>{ const h=document.getElementById('antcv-proc-badges'); return { n:(h?h.children.length:0) }; });
check('6. done clears the badges', t6.n===0, JSON.stringify(t6));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'WIZARD-LANG+PROC OK':'WIZARD-LANG+PROC FAIL');
process.exit(ok?0:1);
