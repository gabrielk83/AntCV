/* DIAGNOSTIC — OUTCOMES-MODE-SELECTOR-001 / OUTCOMES-RESULTS-STYLE-001:
 *   1. mode 'results': the standalone SELECTED OUTCOMES section is hidden and
 *      a bold, style-coloured "Results:" line renders under the role with NO
 *      gap (marginTop 0);
 *   2. mode 'section' (default): the SELECTED OUTCOMES section shows and no
 *      role-results line is rendered.
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
const SECTIONS = {cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[
    {b:'Cut',t:'Innoviz cycle time 95%.'},
    {b:'Led',t:'Sirin optronics integration program.'},
    {b:'Filed',t:'patent US1234567 for the optics module.'},
    {b:'Reduced',t:'supplier defects 40% across programs.'},
  ]},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r1',title:'Architect',company:'Innoviz',years:'2020-2025',on:true,bullets:['Did work.']},
    {id:'r2',title:'Engineer',company:'Sirin',years:'2016-2020',on:true,bullets:['Built.']},
  ]},
],cl:[]};
const browser=await chromium.launch();

async function run(mode) {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.addInitScript(({SECTIONS,mode})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(SECTIONS));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
    localStorage.setItem('wizardCompleted', JSON.stringify(true));
    localStorage.setItem('outcomesMode', JSON.stringify(mode));
  },{SECTIONS,mode});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  const r = await page.evaluate(()=>{
    const paper=document.querySelector('.antcv-preview-paper');
    const txt=paper?paper.textContent||'':'';
    const resAll=[...document.querySelectorAll('[data-antcv-role-results]')];
    const res=resAll[0];
    let style=null;
    if(res){ const cs=getComputedStyle(res); style={fontWeight:cs.fontWeight, marginTop:cs.marginTop, color:cs.color}; }
    // count visible experience roles in the preview
    const roleRows=[...document.querySelectorAll('[data-antcv-role-results]')].length;
    return {
      hasOutcomesHeading: /SELECTED OUTCOMES/.test(txt),
      hasResultsLine: !!res,
      resultsCount: resAll.length,
      resultsText: resAll.map(x=>x.textContent).join(' || '),
      patentInResults: /patent|US1234567/i.test(resAll.map(x=>x.textContent).join(' ')),
      style,
    };
  });
  await page.close();
  return { ...r, errs };
}

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

const res = await run('results');
check('1. results: outcomes section hidden + bold no-gap Results line',
  !res.hasOutcomesHeading && res.hasResultsLine && res.style && res.style.fontWeight==='700' && res.style.marginTop==='0px' && res.errs.length===0,
  JSON.stringify({heading:res.hasOutcomesHeading, line:res.hasResultsLine, style:res.style}));
check('1b. EVERY visible role (2) has a Results line', res.resultsCount===2, JSON.stringify({count:res.resultsCount, text:res.resultsText}));
check('1c. patent number excluded from results (Sirin + all)', res.patentInResults===false, JSON.stringify({text:res.resultsText}));

const sec = await run('section');
check('2. section (default): outcomes section shows, NO Results line',
  sec.hasOutcomesHeading && !sec.hasResultsLine && sec.resultsCount===0 && sec.errs.length===0,
  JSON.stringify({heading:sec.hasOutcomesHeading, line:sec.hasResultsLine}));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'OUTCOMES-MODE OK':'OUTCOMES-MODE FAIL');
process.exit(ok?0:1);
