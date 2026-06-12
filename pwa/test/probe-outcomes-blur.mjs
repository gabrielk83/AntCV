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
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Original profile text.'},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[{b:'Cut',t:'cycle time markedly.'}]},
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
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const ceOwner = await page.evaluate(()=>{
  const span=[...document.querySelectorAll('[data-antcv-editable-text]')].find(s=>/cycle time/.test(s.textContent||''));
  let p=span, hits=[];
  while (p && p !== document.body) {
    if (p.getAttribute && p.getAttribute('contenteditable')==='true') {
      hits.push({tag:p.tagName, attrs:[...p.attributes].map(a=>a.name+'='+String(a.value).slice(0,40)).join(' ')});
    }
    p=p.parentElement;
  }
  return hits;
});
console.log('contenteditable ancestors of outcomes span:', JSON.stringify(ceOwner, null, 1));
// A/B in one session: profile first
const pspan = page.locator('[data-antcv-editable-text]', { hasText: 'Original profile text.' }).last();
await pspan.click(); await page.keyboard.press('Control+a'); await page.keyboard.type('EDITED profile.'); await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
console.log('profile stored after edit:', await page.evaluate(()=>JSON.parse(localStorage.getItem('sections')).cv.find(s=>s.id==='profile').content));
const fiberInfo = await page.evaluate(()=>{
  const out=[];
  for (const el of document.querySelectorAll('[data-antcv-editable-text]')) {
    const txt=(el.textContent||'').slice(0,30);
    const fk=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
    const pk=Object.keys(el).find(k=>k.startsWith('__reactProps$'));
    let rootReached=false, hops=0;
    if (fk) { let f=el[fk]; while (f && hops<200) { if (f.tag===3) { rootReached=true; break; } f=f.return; hops++; } }
    out.push({txt, ce: el.isContentEditable, propKeys: pk ? Object.keys(el[pk]).join(',') : null, rootReached, hops});
  }
  return out;
});
console.log('fibers:', JSON.stringify(fiberInfo, null, 1));
const span = page.locator('[data-antcv-editable-text]', { hasText: 'cycle time markedly.' }).last();
await span.click();
await page.keyboard.press('Control+a');
await page.keyboard.type('EDITED outcome persists.');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const afterEnter = await page.evaluate(()=>({
  active: document.activeElement && document.activeElement.tagName,
  stillEditable: document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-antcv-editable-text')==='true',
  stored: JSON.parse(localStorage.getItem('sections')).cv.find(s=>s.id==='outcomes').items[0],
  domText: [...document.querySelectorAll('[data-antcv-editable-text]')].map(s=>s.textContent).filter(t=>/EDITED|cycle/.test(t)),
}));
console.log('after Enter:', JSON.stringify(afterEnter));
// force blur by clicking far away
await page.mouse.click(50, 50);
await page.waitForTimeout(1200);
const afterClickAway = await page.evaluate(()=>({
  stored: JSON.parse(localStorage.getItem('sections')).cv.find(s=>s.id==='outcomes').items[0],
  domText: [...document.querySelectorAll('[data-antcv-editable-text]')].map(s=>s.textContent).filter(t=>/EDITED|cycle/.test(t)),
}));
console.log('after click-away:', JSON.stringify(afterClickAway));
await browser.close(); server.close();
