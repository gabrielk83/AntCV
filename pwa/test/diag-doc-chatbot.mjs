/* DIAGNOSTIC — DOC-WIDE-CHATBOT-001.
 * 0. the always-visible "Ask AI" launcher appears in the editor;
 * 1. opening the panel + sending a message (mocked LLM) renders the reply + an
 *    edit card;
 * 2. Apply writes the cross-section edit into the sections store;
 * 3. Undo restores it;
 * 4. the system prompt carries the document context + rules + JSON contract.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{
  if (req.method==='OPTIONS') { res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET'}); res.end(); return; }
  if (req.method==='POST') {
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});
    res.end(JSON.stringify({ content:[{ type:'text', text: JSON.stringify({ reply:'Here is a tighter version.', edits:[{ sid:'profile', find:'Spearheaded', replace:'Led', why:"removed the banned word 'spearhead'" }] }) }] }));
    return;
  }
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const CONTENT = 'Spearheaded the migration across teams.';

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(({b,c})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:c}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita',stylePrefs:{banned_words:'spearhead'}}));
  localStorage.setItem('proxyUrl', JSON.stringify(b));
  localStorage.setItem('language', JSON.stringify('en'));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
},{b:base,c:CONTENT});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base + '/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 0. launcher present
const launcher = await page.evaluate(()=>!!document.querySelector('[data-antcv-doc-chatbot-launch]'));
check('0. always-visible Ask-AI launcher present in editor', launcher===true, String(launcher));

// 4. system prompt content
const sys = await page.evaluate(()=> window.AntcvDocChatbot._buildSystem());
check('4. system prompt carries doc context + rules + JSON contract',
  /\[profile\]/.test(sys) && /banned words: spearhead/.test(sys) && /STRICT JSON/.test(sys) && /"edits"/.test(sys), sys.slice(0,80));

// 1. open + send → reply + edit card
const sent = await page.evaluate(async ()=>{
  window.AntcvDocChatbot.open();
  await new Promise(r=>setTimeout(r,150));
  const panel = document.getElementById('antcv-doc-chatbot-panel');
  panel.querySelector('textarea').value = 'remove banned words';
  panel.querySelector('[data-antcv-doc-chat-send]').click();
  await new Promise(r=>setTimeout(r,500));
  const log = panel.querySelector('[data-antcv-doc-chat-log]');
  return { reply: /tighter version/.test(log.textContent||''), editCard: !!panel.querySelector('[data-antcv-doc-edit="profile"]'), applyBtn: !!panel.querySelector('[data-antcv-doc-edit-apply]') };
});
check('1. send renders the reply + a cross-section edit card', sent.reply && sent.editCard && sent.applyBtn, JSON.stringify(sent));

// 2. apply writes the edit
const applied = await page.evaluate(async ()=>{
  let updated=0; window.addEventListener('antcv:sections-updated',(e)=>{ if(e.detail&&/doc-chatbot/.test(e.detail.source||'')) updated++; });
  document.querySelector('[data-antcv-doc-edit-apply]').click();
  await new Promise(r=>setTimeout(r,150));
  let content=null; try{ content=JSON.parse(localStorage.getItem('sections')).cv[0].content; }catch(_){}
  return { content, updated };
});
check('2. Apply writes the edit into sections (Spearheaded→Led)', applied.content==='Led the migration across teams.' && applied.updated>=1, JSON.stringify(applied));

// 3. undo
const undone = await page.evaluate(async ()=>{
  document.querySelector('[data-antcv-doc-edit-undo]').click();
  await new Promise(r=>setTimeout(r,150));
  let content=null; try{ content=JSON.parse(localStorage.getItem('sections')).cv[0].content; }catch(_){}
  return content;
});
check('3. Undo restores the original text', undone===CONTENT, JSON.stringify(undone));

check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); await new Promise(r=>server.close(r));
const ok=checks.every(Boolean);
console.log(ok?'DOC-CHATBOT OK':'DOC-CHATBOT FAIL');
process.exit(ok?0:1);
