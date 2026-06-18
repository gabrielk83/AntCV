/* DIAGNOSTIC — PREVIEW-RESULTS-EDITABLE-REFRESH-001. The preview Results span must
 * show the COMPUTED laminated value (v2 outcome.result), not a stale first-paint
 * bullet. Keying the contentEditable span on __display forces the remount. */
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
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'kanzen',title:'Product / Project Expert',company:'Kanzen',years:'2022-2026',on:true,bullets:['Bridged product dev.'],outcomes:[{title:'AntCV',result:'Built and shipped AntCV solo.',numeric:false}]},
    {id:'innoviz',title:'Change Control Lead',company:'Innoviz',years:'2018-2022',on:true,bullets:['Owned change governance.'],outcomes:[{title:'Cycle',result:'Cut the OEM LiDAR change-request cycle from 250 to 10 days.',numeric:true}]},
  ]},
  {id:'selected_outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'list',items:['Security Guard, Tel Aviv 2010.']},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1600}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(({sections})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));localStorage.setItem('personalInfo',JSON.stringify({name:'G'}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));localStorage.setItem('outcomesMode',JSON.stringify('results'));
},{sections:SECTIONS});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500);
const data = await page.evaluate(()=>Array.from(document.querySelectorAll('[data-antcv-results-edit]')).map(el=>({k:el.getAttribute('data-antcv-results-edit'),t:(el.textContent||'').replace(/\s+/g,' ').trim()})));
console.log('RESULTS:', JSON.stringify(data,null,1));
const j = JSON.stringify(data);
const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
check('Product/Project Expert preview shows its OWN outcome (AntCV), not the bullet', /AntCV/.test(j) && !/Bridged product dev/.test(j), j);
check('Change Control preview shows its OWN outcome (250 to 10 days), not the bullet', /250 to 10 days/.test(j) && !/Owned change governance/.test(j), j);
check('no Security-Guard cross-role bleed', !/Security Guard/.test(j), j);
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));
await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'PREVIEW-REFRESH OK':'PREVIEW-REFRESH FAIL');
process.exit(ok?0:1);
