/* DIAGNOSTIC (read-only) — dump the .antcv-page-row structure to find the REAL source of the
 * 1123px page-box height (so SALMON-EMPTY-REGION-001 Option A targets the right element). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const lb=(n)=>`Bullet ${n} — drove a cross-functional initiative restructuring the operating model, delivering measurable outcomes across regions while cutting cycle time and cost over a multi-quarter programme.`;
const role=(i)=>({id:'r'+i,title:'Role '+i,company:'Co '+i,years:'201'+i+'–201'+(i+2),on:true,bullets:[lb(1),lb(2),lb(3),lb(4)]});
const roles=[]; for(let i=1;i<=5;i++) roles.push(role(i));
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',text:'Programme leader. '.repeat(6)},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles},
  {id:'skills',title:'KEY SKILLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'A',v:'A'},{l:'B',v:'B'}]},
],cl:[]};
const personalInfo={name:'Anita',headline:'X',email:'a@e.com',phone:'+45',location:'CPH'};
const browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(([secs,pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000})); localStorage.setItem('step',JSON.stringify('editor')); localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs)); localStorage.setItem('personalInfo',JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}');
},[sections,personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(11000);

const r = await page.evaluate(()=>{
  const desc=(el)=>!el?null:{ tag:el.tagName.toLowerCase(), cls:(el.className&&el.className.toString().slice(0,60))||'', h:Math.round(el.getBoundingClientRect().height), minH:el.style.minHeight||getComputedStyle(el).minHeight };
  const rows=[...document.querySelectorAll('.antcv-page-row')];
  const out = rows.map((row,i)=>{
    // tallest direct child
    let tallest=null, th=0;
    [...row.children].forEach(c=>{ const h=c.getBoundingClientRect().height; if(h>th){th=h; tallest=c;} });
    return {
      i, row:desc(row), parentTag:row.parentElement&&row.parentElement.tagName.toLowerCase(),
      parentCls:(row.parentElement&&row.parentElement.className&&row.parentElement.className.toString().slice(0,50))||'',
      sameParentAsPrev: i>0 ? (row.parentElement===rows[i-1].parentElement) : null,
      nChildren: row.children.length,
      tallestChild: desc(tallest), tallestChildH: Math.round(th),
    };
  });
  // also: is there a salmon element and where?
  const salmon = document.querySelector('[class*="salmon" i], [data-antcv-salmon]');
  return { count:rows.length, rows:out, salmonFound: !!salmon };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log(JSON.stringify(r,null,2));
