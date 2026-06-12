/* DIAGNOSTIC — PREVIEW-CHATBOT-001 stage 1:
 *   1. selecting preview text raises the ✨ AI edit pill;
 *   2. the panel opens with quote, quick actions, input, step-2 containers;
 *   3. a quick action calls the proxy (mocked) and renders rewrite + Why;
 *   4. Apply replaces the text in the sections store + re-renders;
 *   5. Undo restores the exact pre-edit state.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{
  if (req.method==='POST' && (req.url==='/' || req.url==='')) {
    let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
      res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'http://127.0.0.1:'+server.address().port,'access-control-allow-credentials':'true'});
      res.end(JSON.stringify({content:[{type:'text',text:'{"rewrite":"Cut cycle time 95% via the Change Control Board.","reason":"Shortened; kept the number per the keep-numbers rule."}'}]}));
    });
    return;
  }
  if (req.method==='OPTIONS') { res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type, x-provider','access-control-allow-methods':'POST, GET'}); res.end(); return; }
  if (req.method==='GET' && (req.url||'').split('?')[0]==='/config') {
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});
    res.end(JSON.stringify({server_keys:{anthropic:true},demo:false}));
    return;
  }
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(({port})=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Reduced the change cycle time by ninety five percent through structured analysis.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('proxyUrl', JSON.stringify('http://127.0.0.1:'+port));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('wizardSkipped', JSON.stringify(false));
},{port});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6500);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 1 — select text in the preview, mouseup raises the pill
const pillUp = await page.evaluate(()=>{
  const all=[...document.querySelectorAll('[data-antcv-editable-text]')];
  const span=all.find(s=>/change cycle time/.test(s.textContent||''));
  if(!span) return {found:false, spanCount:all.length, paper:!!document.querySelector('.antcv-preview-paper'), bot:!!window.__antcvPreviewChatbot, body:(document.body.innerText||'').slice(0,200)};
  const range=document.createRange();
  range.selectNodeContents(span.firstChild||span);
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return {found:true};
});
await page.waitForTimeout(400);
check('1. pill appears on selection', pillUp.found && await page.locator('#antcv-aibot-pill').count()===1, JSON.stringify(pillUp));

// 2 — open the panel
await page.click('#antcv-aibot-pill');
await page.waitForTimeout(300);
const panel = await page.evaluate(()=>{
  const p=document.getElementById('antcv-aibot-panel');
  if(!p) return {open:false};
  return {open:true,
    quote: /change cycle time/.test(p.textContent||''),
    quick: [...p.querySelectorAll('button')].filter(b=>/Shorten|More concrete|Calmer tone|Fix wording/.test(b.textContent||'')).length,
    input: !!p.querySelector('#antcv-aibot-input'),
    step2: !!p.querySelector('[data-antcv-aibot-log]') && !!p.querySelector('[data-antcv-aibot-rules]')};
});
check('2. panel: quote + 4 quick actions + input + step-2 containers', panel.open && panel.quote && panel.quick===4 && panel.input && panel.step2, JSON.stringify(panel));

// 3 — quick action -> mocked LLM -> result + Why
await page.evaluate(()=>{ [...document.querySelectorAll('#antcv-aibot-panel button')].find(b=>b.textContent==='Shorten').click(); });
await page.waitForTimeout(1500);
const result = await page.evaluate(()=>{
  const log=document.querySelector('[data-antcv-aibot-log]');
  return { rewrite: /Cut cycle time 95%/.test(log&&log.textContent||''), why: /Why: Shortened/.test(log&&log.textContent||'') };
});
check('3. rewrite + Why rendered from the LLM response', result.rewrite && result.why, JSON.stringify(result));

// 4 — Apply persists into the sections store + re-renders
await page.evaluate(()=>{ [...document.querySelectorAll('[data-antcv-aibot-log] button')].find(b=>b.textContent==='Apply').click(); });
await page.waitForTimeout(1200);
const applied = await page.evaluate(()=>({
  stored: JSON.parse(localStorage.getItem('sections')).cv[0].content,
  rendered: (document.querySelector('.antcv-preview-paper')||{}).textContent||'',
}));
check('4. Apply persists + re-renders', /Cut cycle time 95% via the Change Control Board\./.test(applied.stored) && /Cut cycle time 95%/.test(applied.rendered), JSON.stringify(applied.stored));

// 5 — Undo restores
await page.evaluate(()=>{ [...document.querySelectorAll('[data-antcv-aibot-log] button')].find(b=>/Undo/.test(b.textContent)).click(); });
await page.waitForTimeout(900);
const undone = await page.evaluate(()=>JSON.parse(localStorage.getItem('sections')).cv[0].content);
check('5. Undo restores the pre-edit text', /Reduced the change cycle time by ninety five percent/.test(undone), JSON.stringify(undone));
check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PREVIEW-CHATBOT-S1 OK':'PREVIEW-CHATBOT-S1 FAIL');
process.exit(ok?0:1);
