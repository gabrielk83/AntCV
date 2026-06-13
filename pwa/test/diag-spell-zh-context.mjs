/* DIAGNOSTIC — SPELL-ZH-CONTEXT-001 (Chinese symbol-in-sentence fit).
 * Mocks the proxy LLM (POST /) to return one 错别字, sets the document language
 * to Chinese, and asserts:
 *   0. spelling is ENABLED for zh (master on, no Hunspell dict needed);
 *   1. AntcvSpell.check(zh text) returns a positioned mark for the wrong chars;
 *   2. AntcvSpell.suggest(wrong) returns the LLM correction;
 *   3. text with no Han characters returns no marks (no LLM call needed).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
let llmCalls = 0;
const server = http.createServer(async (req,res)=>{
  if (req.method==='OPTIONS') { res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET'}); res.end(); return; }
  if (req.method==='POST') {
    llmCalls++;
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});
    res.end(JSON.stringify({ content:[{ type:'text', text:'{"errors":[{"wrong":"错的字","correct":"对的字"}]}' }] }));
    return;
  }
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(({b})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
  localStorage.setItem('proxyUrl', JSON.stringify(b));
  localStorage.setItem('language', JSON.stringify('zh'));
  localStorage.setItem('wizardCompleted', JSON.stringify(true));
}, { b: base });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base + '/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3000);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 0. zh enabled
const en = await page.evaluate(()=>({ has: !!window.AntcvSpell, lang: window.AntcvSpell && window.AntcvSpell.lang(), enabled: window.AntcvSpell && window.AntcvSpell.enabled() }));
check('0. spelling enabled for zh (lang=zh)', en.has && en.lang==='zh' && en.enabled===true, JSON.stringify(en));

// 1. check returns a positioned mark
const TEXT = '这是一个错的字的句子。';
const marks = await page.evaluate(async (t)=>{ return await window.AntcvSpell.check(t); }, TEXT);
const expectStart = TEXT.indexOf('错的字');
check('1. zh check returns a mark at the wrong-character offset', Array.isArray(marks) && marks.length===1 && marks[0].word==='错的字' && marks[0].start===expectStart && marks[0].end===expectStart+3, JSON.stringify(marks));

// 2. suggest returns the LLM correction
const sug = await page.evaluate(async ()=>{ return await window.AntcvSpell.suggest('错的字'); });
check('2. zh suggest returns the correction 对的字', Array.isArray(sug) && sug[0]==='对的字', JSON.stringify(sug));

// 3. no Han → no marks, no LLM call
const callsBefore = llmCalls;
const empty = await page.evaluate(async ()=>{ return await window.AntcvSpell.check('hello world 123'); });
check('3. non-Han text returns no marks and triggers no LLM call', Array.isArray(empty) && empty.length===0 && llmCalls===callsBefore, JSON.stringify({empty, delta: llmCalls-callsBefore}));

check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); await new Promise(r=>server.close(r));
const ok=checks.every(Boolean);
console.log(ok?'SPELL-ZH-CONTEXT OK':'SPELL-ZH-CONTEXT FAIL');
process.exit(ok?0:1);
