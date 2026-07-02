/* DIAGNOSTIC — STICKY-LEAK-005 (owner 2026-07-03, screenshot): the PackagePicker
 * ("WITHIN-PACKAGE STYLE") + ExportOptions islands stay VISIBLE on Settings →
 * Account after visiting Layout. Both gate on isLayoutSubtab(); this repro
 * opens Layout (islands mount), switches to Account (chip click, like the
 * owner), and reports:
 *   - island mounts still connected/visible?
 *   - the chip-detection signals getTabState relies on (per matching chip:
 *     text, aria-selected, className, accent colors)
 *   - is the "Open Advanced → Style" hand-off button visible (the fallback
 *     that historically caused STICKY leaks)?
 * Exit 0 = leak reproduced or clean state reported; FAIL only on harness error. */
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
const sections={cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text. '.repeat(8)}],cl:[]};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:600,height:900}});
await page.addInitScript(({secs})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify(7));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
},{secs:sections});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);

// 1. open Settings on the LAYOUT subtab so the islands mount
await page.evaluate(()=>window._antcvOpenSettingsRoute({tier:'standard',subtab:'layout',source:'diag'}));
await page.waitForTimeout(3500);

const snap=async(label)=>page.evaluate((label)=>{
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const vis=el=>{try{if(!el||!el.isConnected)return false;const r=el.getClientRects();if(!r.length)return false;const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden';}catch(e){return false;}};
  const mounts=Array.from(document.querySelectorAll('[data-antcv-react-mount],[data-antcv-react-island]'))
    .map(m=>({tag:m.getAttribute('data-antcv-react-mount')||m.getAttribute('data-antcv-react-island')||'?',visible:vis(m),text:norm(m.textContent).slice(0,60)}));
  // chip signals: buttons matching getTabState's sub regex
  const subRe=/^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i;
  const chips=Array.from(document.querySelectorAll('button,[role="button"],a'))
    .filter(b=>subRe.test(norm(b.textContent)))
    .map(b=>{const cs=getComputedStyle(b);return{t:norm(b.textContent),aria:b.getAttribute('aria-selected')||b.getAttribute('aria-pressed')||'',cls:String(b.className||'').slice(0,60),bg:cs.backgroundColor,bc:cs.borderColor,col:cs.color,vis:vis(b)};});
  const handoff=Array.from(document.querySelectorAll('button,[role="button"],a'))
    .filter(b=>/open advanced.*style|advanced.*style for/i.test(norm(b.textContent)))
    .map(b=>({t:norm(b.textContent).slice(0,50),vis:vis(b)}));
  const withinPkg=Array.from(document.querySelectorAll('div,h3,h4,span'))
    .some(el=>/WITHIN-PACKAGE STYLE/i.test(norm(el.textContent).slice(0,40))&&vis(el));
  const exportOpts=Array.from(document.querySelectorAll('div,h3,h4,span,summary'))
    .some(el=>/^.{0,4}EXPORT OPTIONS/i.test(norm(el.textContent).slice(0,30))&&vis(el));
  return {label,mounts,chips,handoff,withinPkg,exportOpts};
},label);

const onLayout=await snap('on-layout');
console.log(JSON.stringify(onLayout,null,1));

// churn: mutate body every 60ms so island applyOnce keeps re-running against
// freshly primed 300ms memos (models the owner-scale settings churn)
await page.evaluate(()=>{
  const d=document.createElement('div');d.id='churn';d.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(d);
  window.__churn=setInterval(()=>{d.textContent=String(Math.random());},60);
});
// owner recipe: scroll the settings panel to the very END while on Layout
await page.evaluate(()=>{
  const norm=s=>String(s||'').replace(/s+/g,' ').trim();
  const sc=Array.from(document.querySelectorAll('div')).filter(el=>{
    const cs=getComputedStyle(el);
    return el.scrollHeight>el.clientHeight+50&&cs.overflowY!=='visible'&&/WITHIN-PACKAGE|STYLE PACKAGE|Visual package/i.test(norm(el.textContent));
  }).sort((a,b)=>a.scrollHeight-b.scrollHeight)[0];
  if(sc)sc.scrollTop=sc.scrollHeight;
});
await page.waitForTimeout(900);
// 2. switch to ACCOUNT by clicking the chip, like the owner
const clicked=await page.evaluate(()=>{
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const chip=Array.from(document.querySelectorAll('button,[role="button"],a')).find(b=>/^Account$/i.test(norm(b.textContent)));
  if(!chip)return false; chip.click(); return true;
});
await page.evaluate(()=>{
  const sc=Array.from(document.querySelectorAll('div')).filter(el=>el.scrollHeight>el.clientHeight+50).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];
  if(sc)sc.scrollTop=sc.scrollHeight;
});
await page.waitForTimeout(2500);
const onAccount=await snap('on-account (clicked='+clicked+')');
console.log(JSON.stringify(onAccount,null,1));

await browser.close(); server.close();
const leaked=onAccount.withinPkg||onAccount.exportOpts;
console.log('LAYOUT mounted islands:',onLayout.withinPkg,onLayout.exportOpts,'| ACCOUNT leak:',leaked?'REPRODUCED':'clean');
process.exit(0);
