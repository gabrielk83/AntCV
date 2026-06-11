/* DIAGNOSTIC — EDITOR-GEAR-UNDO-001. Boots the editor and asserts the top
 * bar now carries: (1) a ⚙ settings button that opens the Settings modal ON
 * TOP (elementFromPoint inside the panel), and (2) an ↶ undo button that is
 * present and disabled while the undo stack is empty. */
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
const sections={cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(15)}],cl:[]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
},sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);
const present=await page.evaluate(()=>{
  const undo=document.querySelector('.antcv-top-tools .antcv-top-undo');
  const gear=document.querySelector('.antcv-top-tools .antcv-top-settings');
  const vis=(el)=>{if(!el)return false;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';};
  return{undo:!!undo,undoVisible:vis(undo),undoDisabled:undo?undo.disabled:null,gear:!!gear,gearVisible:vis(gear)};
});
let settingsOnTop=false;
if(present.gear){
  await page.locator('.antcv-top-tools .antcv-top-settings').click();
  await page.waitForTimeout(2000);
  settingsOnTop=await page.evaluate(()=>{
    const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
    const cands=Array.from(document.querySelectorAll('div')).filter(n=>{
      const cs=getComputedStyle(n);
      if(cs.position!=='fixed'||cs.display==='none')return false;
      const t=norm(n.textContent);
      return /Settings/i.test(t)&&/STANDARD/i.test(t)&&/ADVANCED/i.test(t);
    });
    const panel=cands[0];if(!panel)return false;
    const inner=panel.querySelector('div');const box=(inner||panel).getBoundingClientRect();
    const el=document.elementFromPoint(Math.round(box.x+box.width/2),Math.round(box.y+box.height/2));
    return!!(el&&panel.contains(el));
  });
}
await browser.close();await new Promise(r2=>server.close(r2));
console.log('buttons:',JSON.stringify(present));
console.log('gear click → settings on top:',settingsOnTop);
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const ok=present.undo&&present.undoVisible&&present.undoDisabled===true
  &&present.gear&&present.gearVisible&&settingsOnTop&&errs.length===0;
console.log(ok?'EDITOR-GEAR-UNDO OK':'EDITOR-GEAR-UNDO FAILED');
process.exit(ok?0:1);
