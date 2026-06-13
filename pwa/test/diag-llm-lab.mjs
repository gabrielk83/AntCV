/* DIAGNOSTIC — LLM-ONBOARD-001:
 *   1. the LLM-lab section anchors into the Settings API-keys form;
 *   2. adding an LLM stores it with status 'pending';
 *   3. Approve is locked before any audit;
 *   4. the audit battery runs against the (mocked) endpoint and passes
 *      (instruction OK-AUDIT, strict JSON, banned-word-free rewrite);
 *   5. Approve unlocks, approval persists + writes the registry entry;
 *   6. the dispatcher-facing filter (approved + baseUrl + model) sees it.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{
  if (req.method==='POST' && /\/chat\/completions$/.test(req.url||'')) {
    let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
      let reply='OK-AUDIT';
      try{
        const body=JSON.parse(b); const user=(body.messages.find(m=>m.role==='user')||{}).content||'';
        if (/JSON object/.test(user)) reply='{"role":"engineer","years":7,"tools":["jira","git"]}';
        else if (/responsible for leading/.test(user)) reply='I led a capable team across departments and can walk you through the results.';
      }catch(_){}
      res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});
      res.end(JSON.stringify({choices:[{message:{role:'assistant',content:reply}}],usage:{prompt_tokens:60,completion_tokens:25}}));
    });
    return;
  }
  if (req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type, Authorization','access-control-allow-methods':'POST'});res.end();return;}
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(()=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// open Settings -> the keys panel via the app's own settings router.
// The lab sidecar polls every 1.2s for a form with >=2 password inputs.
await page.evaluate(()=>{ window._antcvOpenSettingsRoute && window._antcvOpenSettingsRoute({ tier:'standard', subtab:'keys' }); });
await page.waitForTimeout(3000);

const anchored = await page.evaluate(()=>!!document.getElementById('antcv-llm-lab'));
check('1. lab section anchors into the keys form', anchored, '');

if (anchored) {
  // 2 — add an LLM
  // field order now: label, base, key(password), model(+Discover), $in, $out
  await page.evaluate(({port})=>{
    const host=document.getElementById('antcv-llm-lab');
    const inputs=[...host.querySelectorAll('input')];
    inputs[0].value='Mock-70B'; inputs[1].value='http://127.0.0.1:'+port+'/v1';
    inputs[2].value='k'; inputs[3].value='mock-70b'; inputs[4].value='0.5'; inputs[5].value='1.5';
    [...host.querySelectorAll('button')].find(b=>/Save \+ audit now/.test(b.textContent)).click();
  },{port});
  // 2 + 4 — saved, then auto-audited (no second click)
  await page.waitForTimeout(2800);
  let store = await page.evaluate(()=>JSON.parse(localStorage.getItem('antcv:customLlms')||'[]'));
  check('2. added (model id set)', store.length===1 && store[0].model==='mock-70b', JSON.stringify(store.map(s=>({m:s.model,st:s.status}))));
  const audit = store[0] && store[0].audit;
  check('4. AUTO-audit on save passes (instruction+JSON+banned)', !!(audit && audit.pass && audit.probes.instruction.pass && audit.probes.json.pass && audit.probes.banned.pass), JSON.stringify(audit));

  // 3 — Approve unlocks after the auto-audit pass
  const preApprove = await page.evaluate(()=>{
    const b=[...document.getElementById('antcv-llm-lab').querySelectorAll('button')].find(b=>b.textContent==='Approve');
    return { present: !!b, disabled: !!(b && b.disabled) };
  });
  check('3. Approve present + unlocked after passing audit', preApprove.present && !preApprove.disabled, JSON.stringify(preApprove));

  // 5 — approve + registry
  await page.evaluate(()=>{ [...document.getElementById('antcv-llm-lab').querySelectorAll('button')].find(b=>b.textContent==='Approve').click(); });
  await page.waitForTimeout(400);
  const fin = await page.evaluate(()=>({
    llm: JSON.parse(localStorage.getItem('antcv:customLlms')||'[]')[0],
    reg: JSON.parse(localStorage.getItem('antcv:llmRegistry')||'[]'),
  }));
  check('5. approved + registry entries written', fin.llm.status==='approved' && fin.reg.some(e=>e.kind==='llm-audit') && fin.reg.some(e=>e.kind==='llm-approved'), JSON.stringify({status:fin.llm.status, regKinds:fin.reg.map(e=>e.kind)}));

  // 6 — the dispatcher-facing filter sees it (approved + baseUrl + model)
  const eligible = await page.evaluate(()=>{
    const arr=JSON.parse(localStorage.getItem('antcv:customLlms')||'[]');
    return arr.filter(e=>e && e.status==='approved' && e.baseUrl && e.model).map(e=>'custom:'+e.id);
  });
  check('6. routing-eligible as custom:<id>', eligible.length===1 && /^custom:llm/.test(eligible[0]), JSON.stringify(eligible));
} else {
  // mark remaining as failed
  for (let i=2;i<=6;i++) check(`${i}. (skipped — no anchor)`, false, '');
}
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'LLM-LAB OK':'LLM-LAB FAIL');
process.exit(ok?0:1);
