/* DIAGNOSTIC — RERENDER-STORM-001. Boots the editor and runs the
 * mutation-source probe for 5s of steady state (no user input): tallies DOM
 * mutations by (type:attr/childList + attribute name + tag.class) and counts
 * rAF callbacks. The historic storm ran at 150+ mutations/sec; the damper
 * rounds (1.50.80–85) are supposed to hold steady-state near zero. PASS when
 * total steady-state mutations < 30/sec AND no single source > 10/sec. */
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
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text for the preview. '.repeat(6)},
  {id:'contribute',title:'HOW I WOULD CONTRIBUTE',loc:'main',on:true,type:'text_bullets',intro:'Intro line.',items:['First concrete action with outcome.','Second concrete action with outcome.'],closing:'Closing value line.'},
],cl:[]};
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
// Let boot churn settle (sidecar staggered timers run up to ~3s; give 8s).
await page.waitForTimeout(8000);
const r=await page.evaluate(async()=>{
  const tally=new Map();
  const key=(m)=>{
    const t=m.target&&m.target.nodeType===1?m.target:null;
    const tag=t?t.tagName+(t.className&&typeof t.className==='string'?'.'+t.className.trim().split(/\s+/).slice(0,2).join('.'):''):String(m.target&&m.target.nodeName||'?');
    return m.type==='attributes'?`attr:${m.attributeName} on ${tag}`:`${m.type} on ${tag}`;
  };
  const mo=new MutationObserver((recs)=>{for(const m of recs){const k=key(m);tally.set(k,(tally.get(k)||0)+1);}});
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});
  let rafCount=0;const origRaf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=(cb)=>origRaf((ts)=>{rafCount++;return cb(ts);});
  const SECONDS=5;
  await new Promise(r=>setTimeout(r,SECONDS*1000));
  mo.disconnect();
  const total=[...tally.values()].reduce((a,b)=>a+b,0);
  const top=[...tally.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)
    .map(([k,v])=>({src:k,perSec:+(v/SECONDS).toFixed(1)}));
  return {totalPerSec:+(total/SECONDS).toFixed(1),rafPerSec:+(rafCount/SECONDS).toFixed(1),top};
});
await browser.close();await new Promise(r2=>server.close(r2));
console.log('steady-state mutations/sec:',r.totalPerSec,'| rAF callbacks/sec:',r.rafPerSec);
console.log('top sources:');
for(const t of r.top)console.log(`  ${t.perSec}/s  ${t.src}`);
console.log('app errors:',errs.length,errs.slice(0,2).join(' | '));
const worst=r.top.length?r.top[0].perSec:0;
const ok=r.totalPerSec<30&&worst<10&&errs.length===0;
console.log(ok?'RERENDER-STORM OK':'RERENDER-STORM FAILED');
process.exit(ok?0:1);
