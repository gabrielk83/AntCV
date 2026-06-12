/* DIAGNOSTIC — PREVIEW-EDIT-PERSIST-001 (owner 2026-06-12: "make sure all
 * text edits in preview do persist (not just groups)").
 * Empirical audit: boot the editor, inline-edit ONE element of EVERY
 * editable preview type via the real contentEditable spans (focus →
 * replace text → blur), RELOAD the page, and assert each edit survived in
 * localStorage AND re-renders.
 * Covered types: text content (profile), bullets item text (outcomes),
 * labeled_list GROUP name + item value (tools), plain list item (certs),
 * experience role title + bullet, section title, table cell (core_comp).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const sections = {cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Original profile text.'},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[{b:'Cut',t:'cycle time markedly.'}]},
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows:[['Focus Area','Strategic Expertise'],['ChangeGov','Multi-vendor boards']]},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r1',title:'RoleAlpha',company:'CompanyOne',years:'2020-2025',on:true,bullets:['Did the alpha work.']},
  ]},
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[
    {group:'GroupOriginal'},{l:'Workflow',v:'Jira, Confluence'},
  ]},
  {id:'certs',title:'CERTIFICATES & COURSES',loc:'sidebar',on:true,type:'list',items:['CertOriginal (2020)']},
],cl:[]};

// [label, locate the span by current text, replacement, verify fn(storedCv)]
const EDITS = [
  ['text content (profile)', 'Original profile text.', 'EDITED profile persists.',
    (cv)=>cv.find(s=>s.id==='profile').content==='EDITED profile persists.'],
  ['bullets item (outcomes)', 'cycle time markedly.', 'EDITED outcome persists.',
    (cv)=>cv.find(s=>s.id==='outcomes').items[0].t==='EDITED outcome persists.'],
  ['labeled_list GROUP name', 'GroupOriginal', 'GroupEdited',
    (cv)=>cv.find(s=>s.id==='tools').items[0].group==='GroupEdited'],
  ['labeled_list item value', 'Jira, Confluence', 'Jira, EDITED',
    (cv)=>cv.find(s=>s.id==='tools').items[1].v==='Jira, EDITED'],
  ['plain list item (certs)', 'CertOriginal (2020)', 'CertEdited (2021)',
    (cv)=>{const it=cv.find(s=>s.id==='certs').items[0];return (typeof it==='string'?it:it&&it.v||it.text)==='CertEdited (2021)'||JSON.stringify(it).includes('CertEdited');}],
  ['experience role title', 'RoleAlpha', 'RoleEdited',
    (cv)=>cv.find(s=>s.id==='experience').roles[0].title==='RoleEdited'],
  ['experience bullet', 'Did the alpha work.', 'EDITED bullet persists.',
    (cv)=>{const b=cv.find(s=>s.id==='experience').roles[0].bullets[0];return (typeof b==='string'?b:b&&b.text)==='EDITED bullet persists.'||JSON.stringify(b).includes('EDITED bullet persists');}],
  ['table cell (core_comp)', 'Multi-vendor boards', 'EDITED expertise',
    (cv)=>JSON.stringify(cv.find(s=>s.id==='core_comp').rows[1]).includes('EDITED expertise')],
  ['section title', 'SELECTED OUTCOMES', 'KEY OUTCOMES',
    (cv)=>/KEY OUTCOMES/i.test(cv.find(s=>s.id==='outcomes').title)],
];

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1100}});
await page.addInitScript(({secs})=>{
  // addInitScript re-runs on EVERY navigation — guard the seed so the
  // post-edit RELOAD doesn't restore the original fixtures (that artifact
  // produced a false "reload wipes edits" reading on the first run).
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
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

// perform every edit in one session — REAL interactions (click → select-all
// → type → Enter); synthetic focus/blur via evaluate does NOT reach React's
// delegated onBlur and falsely reports non-persistence.
const editResults = [];
for (const [label, find, repl] of EDITS) {
  try {
    const span = page.locator('[data-antcv-editable-text]', { hasText: find }).last();
    if (await span.count() === 0) { editResults.push([label, 'NOT FOUND']); continue; }
    await span.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(repl);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    editResults.push([label, 'edited']);
  } catch (e) {
    editResults.push([label, 'ERROR ' + String(e && e.message).slice(0, 80)]);
  }
}
await page.waitForTimeout(1500);

// capture storage BEFORE reload to split "commit failed" from "reload wiped"
const preStored = await page.evaluate(()=>JSON.parse(localStorage.getItem('sections')||'{}'));

// reload and verify storage + render
await page.reload({waitUntil:'load'});
await page.waitForTimeout(6000);
const stored = await page.evaluate(()=>JSON.parse(localStorage.getItem('sections')||'{}'));
const rendered = await page.evaluate(()=>document.body.innerText||'');

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
for (let i=0;i<EDITS.length;i++){
  const [label,,repl,verify]=EDITS[i];
  const located=editResults[i] && editResults[i][1]==='edited';
  let committed=false, persisted=false;
  try { committed=verify(preStored.cv||[]); } catch(e){ committed=false; }
  try { persisted=verify(stored.cv||[]); } catch(e){ persisted=false; }
  const rerendered=rendered.includes(repl.replace(/\.$/,''));
  check(`${label} — located+committed+persisted+rerendered`, located&&committed&&persisted&&rerendered,
    JSON.stringify({located, committed, persisted, rerendered, res: editResults[i] && editResults[i][1]}));
}
check('no page errors', errs.length===0, errs.join(' | ').slice(0,300));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PREVIEW-EDIT-PERSIST OK':'PREVIEW-EDIT-PERSIST FAIL');
process.exit(ok?0:1);
