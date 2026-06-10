/* DIAGNOSTIC — APP-SENTENCE-STYLE-001 + SPECIALISATION-EDIT-001.
 * CL doc: the "Application: Role - Company" sentence host must exist in the
 * candidate header and carry the TEMPLATE's color (matching the hidden
 * original anchor it replaced — never the black browser default).
 * CV doc: the [Specialisation — …] line must be wrapped contenteditable;
 * typing into it must persist to meta.subtitle. */
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
  const host=document.querySelector('[data-antcv-candidate-application-sentence="1"]');
  if(!host)return{present:false};
  const cs=getComputedStyle(host);
  const anchor=document.querySelector('[data-antcv-candidate-anchor-hidden="1"]');
  const anchorColor=anchor?getComputedStyle(anchor).color:null;
  const text=(host.textContent||'').replace(/\s+/g,' ').trim();
  const editable=['applicationLabel','role','company'].every(f=>{
    const sp=host.querySelector(`[data-antcv-candidate-edit="${f}"]`);
    return!!(sp&&sp.isContentEditable);
  });
  return{present:true,text,color:cs.color,anchorColor,fontFamily:cs.fontFamily,
    matchesTemplate:anchorColor?cs.color===anchorColor:null,
    notDefaultBlack:cs.color!=='rgb(0, 0, 0)',editable};
});
await cl.close();

// ── CV: specialisation line editability ────────────────────────────
const cv=await boot(browser,'cv',{role:'',company:'',subtitle:''});
const spec=await cv.evaluate(()=>{
  const el=document.querySelector('[data-antcv-candidate-edit="subtitle"]');
  if(!el)return{present:false};
  return{present:true,editable:el.isContentEditable,text:(el.textContent||'').trim().slice(0,60)};
});
let specPersist=null;
if(spec.present&&spec.editable){
  await cv.evaluate(()=>{
    const el=document.querySelector('[data-antcv-candidate-edit="subtitle"]');
    el.focus();el.textContent='Optics • Change Governance • EO Validation';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.blur();el.dispatchEvent(new Event('blur',{bubbles:true}));
  });
  await cv.waitForTimeout(1200);
  specPersist=await cv.evaluate(()=>{
    try{return (JSON.parse(localStorage.getItem('meta')||'{}').subtitle)||'';}catch(_){return null;}
  });
}
await cv.close();
await browser.close();await new Promise(r2=>server.close(r2));

console.log('CL application sentence:',JSON.stringify(sentence));
console.log('CV specialisation wrap:',JSON.stringify(spec));
console.log('meta.subtitle after edit:',JSON.stringify(specPersist));
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const sentenceOk=sentence.present&&sentence.editable&&sentence.notDefaultBlack&&sentence.matchesTemplate!==false;
const specOk=spec.present&&spec.editable&&specPersist==='Optics • Change Governance • EO Validation';
console.log('sentence style/edit:',sentenceOk?'OK':'FAIL','| specialisation edit:',specOk?'OK':'FAIL');
const ok=sentenceOk&&specOk&&errs.length===0;
console.log(ok?'CANDIDATE-HEADER-EDIT OK':'CANDIDATE-HEADER-EDIT FAILED');
process.exit(ok?0:1);
