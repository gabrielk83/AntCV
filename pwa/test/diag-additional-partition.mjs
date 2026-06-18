/* DIAGNOSTIC — G-GROUPS-003 / ADDITIONAL-INFO-SPLIT-001. The 415 normalizer splits a
 * FLAT additional section into Languages/Accessibility/Interests {group} blocks, and
 * the preview renders the subheads. Verifies the partition survives the live render. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port, base=`http://127.0.0.1:${port}`;
const SECTIONS={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'IT expert.'},
  {id:'additional',title:'ADDITIONAL INFORMATION',loc:'sidebar',on:true,type:'labeled_list',items:[
    {l:'English',v:'Fluent'},
    {l:'Danish',v:'Intermediate (B1)'},
    {l:'Hearing',v:'Hearing impaired — no impact on performance'},
    {l:'Rugby',v:'Operations manager & assistant coach, Copenhagen Wolves RFC'},
    {l:'Tai-chi',v:'Weekly practice'},
  ]},
],cl:[]};
// keep personalInfo.additional EMPTY so the restore-hydration (which would override
// section items from a flat personalInfo.additional) does not fire — proves the
// section-level partition holds. (A populated personalInfo.additional is covered by
// the 415 re-heal poll; tested separately if needed.)
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:1400}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(({sections})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));localStorage.setItem('personalInfo',JSON.stringify({name:'G'}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
},{sections:SECTIONS});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500); // let the 415 boot sweep (400/1200/3000) run
const r = await page.evaluate(()=>{
  const cv=JSON.parse(localStorage.getItem('sections')).cv;
  const add=cv.find(s=>s.id==='additional');
  const groups=(add&&add.items||[]).filter(it=>it&&it.group!==undefined).map(it=>it.group);
  const sidebar=document.querySelector('.antcv-document-sidebar');
  return { groups, itemSeq:(add&&add.items||[]).map(it=>it.group!==undefined?('['+it.group+']'):it.l), preview:(sidebar?sidebar.innerText:'').replace(/\s+/g,' ').trim() };
});
await browser.close(); await new Promise(x=>server.close(x));
const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
console.log('item sequence:', JSON.stringify(r.itemSeq));
console.log('preview sidebar:', JSON.stringify(r.preview.slice(0,300)));
check('stored: Languages group present', r.groups.includes('Languages'), JSON.stringify(r.groups));
check('stored: Accessibility group present', r.groups.includes('Accessibility'));
check('stored: Interests group present', r.groups.includes('Interests'));
check('preview shows the group subheads', /Languages/.test(r.preview)&&/Accessibility/.test(r.preview)&&/Interests/.test(r.preview), r.preview);
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));
const ok=checks.every(Boolean);
console.log(ok?'ADDITIONAL-PARTITION OK':'ADDITIONAL-PARTITION FAIL');
process.exit(ok?0:1);
