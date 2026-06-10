/* DIAGNOSTIC — SETTINGS-SUBTAB-001 / SETTINGS-NAV-Z-001. For BOTH routes
 * (editor and upload) opens Settings via the Application-History route hook
 * (the path "Open in Settings →" uses) and asserts the settings panel mounts
 * and actually PAINTS on top: elementFromPoint over the panel resolves inside
 * it, and the Application history subtab is active. Guards the 1.50.355
 * __antcvSettingsModal hoist (modal now mounts in the editor route too). */
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
const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text for the preview so the editor has content. '.repeat(8)},
],cl:[]};

async function checkRoute(browser,step){
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.addInitScript(({secs,step})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify(step));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
  },{secs:sections,step});
  const errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t))errs.push(t);}});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(5000);
  const opened=await page.evaluate(()=>{
    if(typeof window._antcvOpenSettingsRoute!=='function')return false;
    window._antcvOpenSettingsRoute({tier:'standard',subtab:'apps',source:'diag'});
    return true;
  });
  await page.waitForTimeout(2500);
  const r=await page.evaluate(()=>{
    const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
    const cands=Array.from(document.querySelectorAll('div')).filter(n=>{
      const cs=getComputedStyle(n);
      if(cs.position!=='fixed'||cs.display==='none')return false;
      const t=norm(n.textContent);
      return /Settings/i.test(t)&&/STANDARD/i.test(t)&&/ADVANCED/i.test(t);
    });
    const panel=cands[0]||null;
    if(!panel)return{panelFound:false};
    const inner=panel.querySelector('div');
    const box=(inner||panel).getBoundingClientRect();
    const pts=[[0.5,0.5],[0.3,0.3],[0.7,0.3],[0.3,0.7],[0.7,0.7]].map(([fx,fy])=>{
      const x=Math.round(box.x+box.width*fx),y=Math.round(box.y+box.height*fy);
      const el=document.elementFromPoint(x,y);
      return {inside:!!(el&&panel.contains(el))};
    });
    const text=norm(panel.textContent);
    const appHistActive=/Application history/i.test(text)&&(/APPLICATIONS/i.test(text)||/No applications saved yet/i.test(text));
    return {panelFound:true,z:getComputedStyle(panel).zIndex,onTop:pts.every(p=>p.inside),appHistActive};
  });
  await page.close();
  return {step,opened,errs,...r};
}

const browser=await chromium.launch();
const editor=await checkRoute(browser,'editor');
const upload=await checkRoute(browser,'upload');
await browser.close();await new Promise(r2=>server.close(r2));
for(const r of [editor,upload]){
  console.log(`[${r.step}] opened:${r.opened} panel:${r.panelFound} z:${r.z} onTop:${r.onTop} appHist:${r.appHistActive} errors:${r.errs.length}${r.errs.length?' '+r.errs[0]:''}`);
}
const ok=[editor,upload].every(r=>r.opened&&r.panelFound&&r.onTop&&r.appHistActive&&r.errs.length===0);
console.log(ok?'SETTINGS-FRONT OK':'SETTINGS-FRONT FAILED');
process.exit(ok?0:1);
