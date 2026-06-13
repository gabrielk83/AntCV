/* DIAGNOSTIC — PERSONALITY-KERNEL-001 quiz.
 * 0. AntcvPersonalityQuiz exposed;
 * 1. _rankTraits + _buildKernel are deterministic (top trait first, work-style
 *    line assembled, render constraints present);
 * 2. the modal flow: answering + finishing saves personalInfo.personality and
 *    shows the kernel response;
 * 3. the "PERSONALITY KERNEL" card injects under the Languages card (Settings).
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
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(2800);

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 0+1. API + deterministic kernel build
const api = await page.evaluate(()=>{
  const Q = window.AntcvPersonalityQuiz;
  if(!Q) return {has:false};
  const ranked = Q._rankTraits(['calm','calm','analytical','communicator','calm']);
  const kernel = Q._buildKernel(ranked);
  return { has:true, version:Q.version,
    topTrait: ranked[0].id, topScore: ranked[0].score,
    kTop: kernel.traits[0] && kernel.traits[0].id,
    ws: kernel.work_style_line && kernel.work_style_line.en,
    hasEvidence: !!(kernel.traits[0] && kernel.traits[0].evidence_phrasings && kernel.traits[0].evidence_phrasings.length),
    hasConstraints: !!(kernel.render_constraints && kernel.render_constraints.banned_lists_apply),
    ext: kernel.kernel_extension };
});
check('0. AntcvPersonalityQuiz exposed', api.has===true, JSON.stringify(api.version));
check('1. deterministic kernel: calm ranks top, work-style line assembled, evidence + constraints present',
  api.topTrait==='calm' && api.topScore===3 && api.kTop==='calm' && typeof api.ws==='string' && api.ws.length>5 && api.hasEvidence && api.hasConstraints && api.ext==='personality',
  JSON.stringify(api));

// 2. modal flow: open, answer all 8 (first option each), finish -> saved + result
const flow = await page.evaluate(async ()=>{
  window.AntcvPersonalityQuiz.open();
  await new Promise(r=>setTimeout(r,200));
  const modal = document.getElementById('antcv-personality-quiz-modal');
  if(!modal) return {opened:false};
  // click the first option of each question
  const blocks = [...modal.querySelectorAll('[data-q]')];
  const seen = {};
  blocks.forEach(b=>{ const q=b.getAttribute('data-q'); if(!seen[q]){ seen[q]=1; b.click(); } });
  await new Promise(r=>setTimeout(r,150));
  const finish = modal.querySelector('[data-antcv-quiz-finish]');
  finish.click();
  await new Promise(r=>setTimeout(r,250));
  let p=null; try{ p=JSON.parse(localStorage.getItem('personalInfo')).personality; }catch(_){}
  const resultShown = !!modal.querySelector('[data-antcv-quiz-result]');
  return { opened:true, saved: !!(p && p.traits && p.traits.length && p.work_style_line && p.work_style_line.en), ext: p&&p.kernel_extension, resultShown };
});
check('2. quiz flow saves personalInfo.personality + shows the kernel response',
  flow.opened && flow.saved && flow.ext==='personality' && flow.resultShown, JSON.stringify(flow));

// 3. Settings card injects under the Languages card
const card = await page.evaluate(async ()=>{
  document.getElementById('antcv-personality-quiz-modal')?.remove();
  const col=document.createElement('div'); col.style.display='flex'; col.style.flexDirection='column';
  const lang=document.createElement('div'); lang.id='antcv-react-personal-languages'; lang.style.order='20';
  col.appendChild(lang); document.body.appendChild(col);
  await new Promise(r=>setTimeout(r,700));
  const c=document.getElementById('antcv-personality-kernel-card');
  return { present: !!c, sameCol: !!(c&&c.parentElement===col), tag:c&&c.tagName, hasBtn: !!(c&&c.querySelector('[data-antcv-personality-quiz-open]')), title:/PERSONALITY KERNEL/i.test(c&&c.textContent||'') };
});
check('3. PERSONALITY KERNEL card injects under Languages with a quiz button',
  card.present && card.sameCol && card.tag==='DETAILS' && card.hasBtn && card.title, JSON.stringify(card));

check('no page errors', errs.length===0, errs.join('|').slice(0,200));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PERSONALITY-QUIZ OK':'PERSONALITY-QUIZ FAIL');
process.exit(ok?0:1);
