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
// A huge CORE COMPETENCIES table that must overflow A4 and split by row.
const rows=[['Focus','Expertise']];
for(let i=1;i<=30;i++) rows.push(['Competency '+i, 'Expertise statement '+i+' '.repeat(8)+'describing depth and breadth across the domain.']);
const sections={cv:[
  {id:'core',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows},
  {id:'skills',title:'KEY SKILLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'A'},{l:'B'},{l:'C'}]},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
  localStorage.setItem('antcv:autoPages','{}');localStorage.setItem('antcv:itemPages','{}');
},sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t))errs.push(t);}});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);
const r=await page.evaluate(()=>{
  const boxes=document.querySelectorAll('.antcv-page-row');
  // collect every CORE table data-row's first-cell text across all page boxes
  const main=document.querySelectorAll('.antcv-document-main');
  const firstCells=[];
  main.forEach(col=>{
    col.querySelectorAll('table tbody tr').forEach(tr=>{
      const td=tr.querySelector('td'); if(td) firstCells.push(td.innerText.trim());
    });
  });
  let autoPages={};try{autoPages=JSON.parse(localStorage.getItem('antcv:autoPages')||'{}');}catch(_){}
  // count header occurrences (repeated header on continuation is expected, not a dup of data)
  const headers=[];
  main.forEach(col=>col.querySelectorAll('table thead tr td, table thead tr th').forEach(()=>{}));
  return {boxes:boxes.length, firstCells, autoPages};
});
await browser.close();await new Promise(r=>server.close(r));
// Expected unique data rows: Competency 1..30
const expected=[];for(let i=1;i<=30;i++)expected.push('Competency '+i);
const got=r.firstCells.filter(t=>/^Competency \d+$/.test(t));
const uniq=[...new Set(got)];
const dups=got.filter((v,i)=>got.indexOf(v)!==i);
const missing=expected.filter(e=>!uniq.includes(e));
console.log('page-boxes:',r.boxes);
console.log('autoPages:',JSON.stringify(r.autoPages));
console.log('total data-row cells rendered:',got.length,'unique:',uniq.length);
console.log('duplicated rows:',JSON.stringify([...new Set(dups)]));
console.log('missing rows:',JSON.stringify(missing));
console.log('app errors:',errs.length, errs.slice(0,3).join(' | '));
const ok = r.boxes>1 && dups.length===0 && missing.length===0 && uniq.length===30 && errs.length===0;
console.log(ok?'TABLE-SPLIT OK (no loss, no dup)':'TABLE-SPLIT CHECK INCOMPLETE');
