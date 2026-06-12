/* DIAGNOSTIC — RECOMMENDATIONS placement (owner 2026-06-13) + SPEC-SEPARATOR:
 *   1. a stored CV ordered experience -> RECOMMENDATIONS -> PROFESSIONAL
 *      EXPERTISE is REPOSITIONED so recommendations follows the expertise
 *      section (the owner's live layout);
 *   2. a CV with no expertise section keeps recommendations after experience;
 *   3. a stored meta.subtitle "Processes*Products*People" is rewritten to
 *      "Processes • Products • People".
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

async function boot(cv, meta) {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.addInitScript(({cv, meta})=>{
    if (localStorage.getItem('__antcvDiagSeeded')) return;
    localStorage.setItem('__antcvDiagSeeded','1');
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify({cv, cl:[]}));
    if (meta) localStorage.setItem('meta',JSON.stringify(meta));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
    localStorage.setItem('wizardCompleted', JSON.stringify(true));
  },{cv, meta});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6500);
  const out = await page.evaluate(()=>({
    order: (JSON.parse(localStorage.getItem('sections')||'{}').cv||[]).map(s=>s.id),
    subtitle: (JSON.parse(localStorage.getItem('meta')||'{}')||{}).subtitle,
  }));
  await page.close();
  return out;
}

const exp = {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[{id:'r1',title:'T',company:'C',years:'2020-2024',on:true,bullets:['Did x.']}]};
const rec = {id:'recommendations',title:'RECOMMENDATIONS',loc:'main',on:true,type:'text',content:'Danish and international recommenders on request.'};
const xpt = {id:'expertise',title:'PROFESSIONAL EXPERTISE',loc:'main',on:true,type:'table',rows:[['Focus Area','Strategic Expertise'],['A','B']]};
const prof = {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'};

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// 1 — wrong order (the owner's live layout) gets repositioned
const r1 = await boot([prof, exp, rec, xpt], {subtitle:'Processes*Products*People'});
check('1. rec moves AFTER the expertise section', JSON.stringify(r1.order)===JSON.stringify(['profile','experience','expertise','recommendations']), JSON.stringify(r1.order));
check('3. stored subtitle * -> •', r1.subtitle==='Processes • Products • People', JSON.stringify(r1.subtitle));

// 2 — no expertise section: stays directly after experience
const r2 = await boot([prof, exp, rec], null);
check('2. no expertise -> rec stays after experience', JSON.stringify(r2.order)===JSON.stringify(['profile','experience','recommendations']), JSON.stringify(r2.order));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'RECS-PLACEMENT OK':'RECS-PLACEMENT FAIL');
process.exit(ok?0:1);
