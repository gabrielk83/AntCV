/* DIAGNOSTIC — SO-004 / ENHANCE-#185-RESIDUAL-001 repro attempt
 * (owner queue 2026-06-12). React minified error #185 = "Maximum update
 * depth exceeded", reported on editor change commits (Enhance core
 * competencies; re-scoped to a shared editor-field path). Attempt:
 *   1. open the Sections editor, select CORE COMPETENCIES and OUTCOMES;
 *   2. hammer the side-panel fields with rapid sequential edits (the
 *      change-commit path) for several seconds;
 *   3. rapid preview inline edits on the same sections in parallel bursts;
 *   4. watch pageerror/console for #185 / Maximum update depth.
 * Exit 0 = no repro under this load (documents the attempt); exit 1 with
 * the captured error = REPRODUCED.
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

const sections = {cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile.'},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[
    {b:'Cut',t:'cycle 95%.'},{b:'Ran',t:'two re-certs.'},{b:'Built',t:'the lab.'},
  ]},
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows:[
    ['Focus Area','Strategic Expertise'],['ChangeGov','Boards'],['Safety','ISO 26262'],['Delivery','On time'],
  ]},
  {id:'regulatory',title:'REGULATORY CONTEXT',loc:'sidebar',on:true,type:'labeled_list',items:[
    {group:'Systems'},{l:'ASPICE',v:'process'},{l:'ISO 26262',v:'safety'},
  ]},
],cl:[]};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(({secs})=>{
  if (localStorage.getItem('__antcvDiagSeeded')) return;
  localStorage.setItem('__antcvDiagSeeded','1');
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
},{secs:sections});
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
page.on('console',m=>{ const t=m.text(); if(/error #185|Maximum update depth/i.test(t)) errs.push('console: '+t.slice(0,200)); });
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

// 1+2: editor panel hammering
const panelResult = await page.evaluate(async ()=>{
  const out={opened:false, fieldsEdited:0};
  const open=[...document.querySelectorAll('button')].find(b=>/☰\s*Sections/.test(b.textContent||''));
  if(open){ open.click(); await new Promise(r=>setTimeout(r,900)); out.opened=true; }
  out.rows=[...document.querySelectorAll('[data-section-row-index]')].map(r2=>(r2.textContent||'').slice(0,24));
  for (const label of ['CORE COMPETENCIES','OUTCOMES','REGULATORY']) {
    const row=[...document.querySelectorAll('[data-section-row-index]')].find(r2=>new RegExp(label,'i').test(r2.textContent||''));
    if(!row) continue;
    row.click(); await new Promise(r=>setTimeout(r,900));
    let fields=[...document.querySelectorAll('.antcv-editor-side-panel textarea, .antcv-editor-side-panel input[type="text"]')];
    if(!fields.length) fields=[...document.querySelectorAll('textarea, input[type="text"]')].filter(f=>f.offsetParent);
    fields=fields.slice(0,6);
    out['fields_'+label]=fields.length;
    // rapid sequential commits — native setter + input event, 25 edits/field burst
    const setter=(el,v)=>{
      const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const d=Object.getOwnPropertyDescriptor(proto,'value');
      d.set.call(el,v);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    };
    for (const f of fields) {
      for (let i=0;i<25;i++) setter(f, (f.value||'x')+'!');
      f.dispatchEvent(new Event('change',{bubbles:true}));
      out.fieldsEdited++;
      await new Promise(r=>setTimeout(r,40));
    }
  }
  return out;
});
await page.waitForTimeout(2500);

// 3: rapid preview inline-edit bursts (focus/type/blur cycles)
for (let burst=0;burst<3;burst++){
  const spans = page.locator('.antcv-preview-paper [data-antcv-editable-text]');
  const n = Math.min(await spans.count(), 8);
  for (let i=0;i<n;i++){
    try {
      await spans.nth(i).click({timeout:1500});
      await page.keyboard.type('!');
      await page.keyboard.press('Enter');
    } catch(_){}
  }
}
await page.waitForTimeout(3000);

const blue = await page.evaluate(()=>!!document.querySelector('#root') && (document.getElementById('root').children.length===0));
console.log('panel:', JSON.stringify(panelResult));
console.log('errors captured:', errs.length, errs.slice(0,5).join(' || ').slice(0,500));
console.log('root unmounted (blue screen):', blue);
await browser.close(); server.close();
const repro = errs.some(e=>/185|Maximum update depth/i.test(e)) || blue;
console.log(repro ? 'SO-004 REPRODUCED' : 'SO-004 NO-REPRO under editor+preview hammering (loop-guard holding)');
process.exit(repro ? 1 : 0);
