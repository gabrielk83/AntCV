/* DIAGNOSTIC — SIDEBAR-BREATHING-001. Scrolling the preview must NOT make the
 * sidebar reflow. Boots the editor, scrolls repeatedly, asserts the sidebar rect
 * is stable and the equalize sidecar is not looping (no runaway height writes). */
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
// tall main (many roles) + a short sidebar section → equalize will extend the sidebar.
const roles=[]; for(let i=0;i<8;i++) roles.push({id:'r'+i,title:'Role '+i,company:'Co '+i,years:'20'+(10+i),on:true,bullets:['Did a lot of things in this role number '+i+' across many lines to make the main column tall.','Second bullet here too for height.']});
const SECTIONS={cv:[
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles},
  {id:'tools',title:'TOOLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'A',v:'one'},{l:'B',v:'two'}]},
],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:900}});
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
await page.waitForTimeout(3500);
// instrument: count style-attribute mutations on the sidebar during scrolling.
const result = await page.evaluate(async ()=>{
  const sc = document.querySelector('.antcv-preview-scroll');
  const side = document.querySelector('.antcv-document-sidebar');
  if(!sc||!side) return { err:'no sidebar/scroll '+(!!sc)+'/'+(!!side) };
  // let it settle
  await new Promise(r=>setTimeout(r,400));
  let writes=0;
  const mo=new MutationObserver(muts=>{ muts.forEach(m=>{ if(m.type==='attributes'&&m.attributeName==='style') writes++; }); });
  mo.observe(side,{attributes:true,attributeFilter:['style']});
  const w0=side.getBoundingClientRect().width, h0=side.getBoundingClientRect().height;
  // scroll repeatedly
  for(let i=0;i<12;i++){ sc.scrollTop = (i%2? 60: 220); sc.dispatchEvent(new Event('scroll')); await new Promise(r=>setTimeout(r,80)); }
  await new Promise(r=>setTimeout(r,400));
  mo.disconnect();
  const side2=document.querySelector(".antcv-document-sidebar")||side; const w1=side2.getBoundingClientRect().width, h1=side2.getBoundingClientRect().height;
  return { writes, w0,w1,h0,h1, stable: Math.abs(w1-w0)<1 && Math.abs(h1-h0)<2 };
});
const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
console.log('result:', JSON.stringify(result));
if(result.err){ check('sidebar present', false, result.err); }
else {
  check('sidebar width/height stable across 12 scrolls', result.stable, JSON.stringify(result));
  check('no runaway style writes on the sidebar during scroll (<=2)', result.writes<=2, 'writes='+result.writes);
}
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));
await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'SIDEBAR-STABLE OK':'SIDEBAR-STABLE FAIL');
process.exit(ok?0:1);
