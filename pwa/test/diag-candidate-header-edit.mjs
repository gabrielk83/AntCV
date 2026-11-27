/* DIAGNOSTIC — APP-SENTENCE-STYLE-001 + SPECIALISATION-EDIT-001.
 * CL doc: the "Application: Role - Company" sentence host must exist in the
 * candidate header and carry the TEMPLATE's color (matching the hidden
 * original anchor it replaced — never the black browser default).
 * CV doc: the [Specialisation — …] line must be wrapped contenteditable;
 * typing into it must persist to meta.subtitle.
 * Updated 2026-11-27 (DIAG-FLEET-ROT-001), two later owner changes:
 *  - UNSOLICITED-SHOWS-NVIDIA-001 (06-23): with no JD in antcv:lastJdText the
 *    identity guard resets meta to Open Application / Unsolicited, so the CL leg
 *    now seeds a JD (a targeted application is the only case with a sentence).
 *  - The specialisation line is now the sidebar card's own contenteditable
 *    ("Click to edit the specialisation"), writing personalInfo.specialization +
 *    personalInfo.subtitle; the 341 sidecar no longer wraps it on Path C.
 *  - HEADER-APP-LINE-001 (07-22, native since 1.51.2741): the CL heading shows the
 *    SPECIALISATION, never "Application: role - company"; one native line
 *    "Application for <role> at <company>" sits under the slogan. The old
 *    3-span application-sentence host is retired. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const mkSections=()=>({cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(10)},
],cl:[
  {id:'who',title:'WHO I AM',loc:'main',on:true,type:'text',content:'Who text. '.repeat(10)},
]});

async function boot(browser,doc,meta){
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.addInitScript(({secs,doc,meta})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify(doc));
    localStorage.setItem('sections',JSON.stringify(secs));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester',email:'a@t.dk'}));
    if(meta)localStorage.setItem('meta',JSON.stringify(meta));
    if(meta&&meta.company)localStorage.setItem('antcv:lastJdText','Portfolio Project Manager at Kvadrat Acoustics. You will lead a portfolio of acoustic product projects from concept to launch, own stage gates, budgets and supplier plans, and report to the R&D director.');
  },{secs:mkSections(),doc,meta});
  page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  return page;
}
const errs=[];
const browser=await chromium.launch();

// ── CL: application sentence styling ───────────────────────────────
const cl=await boot(browser,'cl',{role:'Portfolio Project Manager',company:'Kvadrat Acoustics',subtitle:''});
const sentence=await cl.evaluate(()=>{
  const paper=document.querySelector('.antcv-preview-paper');
  if(!paper)return{present:false};
  const leaves=[...paper.querySelectorAll('*')].filter(e=>e.children.length===0);
  const lines=leaves.filter(e=>/^Application for Portfolio Project Manager at Kvadrat Acoustics$/.test((e.textContent||'').replace(/\s+/g,' ').trim()));
  const colon=leaves.filter(e=>/^Application:/.test((e.textContent||'').trim())).length;
  const legacyHost=!!document.querySelector('[data-antcv-candidate-application-sentence="1"]');
  if(!lines.length)return{present:false,colon,legacyHost};
  const cs=getComputedStyle(lines[0]);
  return{present:true,count:lines.length,colon,legacyHost,color:cs.color,notDefaultBlack:cs.color!=='rgb(0, 0, 0)'};
});
await cl.close();

// ── CV: specialisation line editability ────────────────────────────
const cv=await boot(browser,'cv',{role:'',company:'',subtitle:''});
const SPEC_SEL='.antcv-preview-paper [data-antcv-sidebar-card] [contenteditable="true"], .antcv-preview-paper [data-antcv-candidate-edit="subtitle"]';
const specHandle=await cv.evaluateHandle((sel)=>[...document.querySelectorAll(sel)].find(e=>/Speciali/.test(e.textContent||''))||null,SPEC_SEL);
const spec=await specHandle.evaluate(el=>el?{present:true,editable:el.isContentEditable,text:(el.textContent||'').trim().slice(0,60)}:{present:false});
let specPersist=null;
if(spec.present&&spec.editable){
  await specHandle.click();
  await cv.keyboard.press('Control+A');
  await cv.keyboard.type('Optics • Change Governance • EO Validation');
  await cv.mouse.click(5,5);
  await cv.waitForTimeout(1500);
  specPersist=await cv.evaluate(()=>{
    try{const p=JSON.parse(localStorage.getItem('personalInfo')||'{}');return p.specialization||p.subtitle||'';}catch(_){return null;}
  });
}
await cv.close();
await browser.close();await new Promise(r2=>server.close(r2));

console.log('CL application sentence:',JSON.stringify(sentence));
console.log('CV specialisation wrap:',JSON.stringify(spec));
console.log('personalInfo.specialization after edit:',JSON.stringify(specPersist));
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const sentenceOk=sentence.present&&sentence.count===1&&sentence.colon===0&&!sentence.legacyHost&&sentence.notDefaultBlack;
const specOk=spec.present&&spec.editable&&specPersist==='Optics • Change Governance • EO Validation';
console.log('sentence style/edit:',sentenceOk?'OK':'FAIL','| specialisation edit:',specOk?'OK':'FAIL');
const ok=sentenceOk&&specOk&&errs.length===0;
console.log(ok?'CANDIDATE-HEADER-EDIT OK':'CANDIDATE-HEADER-EDIT FAILED');
process.exit(ok?0:1);
