/* DIAGNOSTIC — BANNED-WORDS-MERGE-001 (WIZARD_SETTINGS_UX #8): the island Writing-Style card is the single banned-words surface; the native collapsed Banned Words <details> in Personal must be hidden by the island mount (marker data-antcv-native-banned-hidden + display:none). Asserts island mounted + native block hidden. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent((req.url||'/').split('?')[0]);if(rel==='/')rel='/index.html';const fp=path.join(ROOT,rel);const s=await stat(fp).catch(()=>null);if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(await readFile(fp));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:950}});
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify(7));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'A',stylePrefs:{banned_words:'synergy, leverage'}}));
});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000);
await page.evaluate(()=>window._antcvOpenSettingsRoute({tier:'standard',subtab:'personal',source:'diag'}));
await page.waitForTimeout(4000);
const r=await page.evaluate(()=>{
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const vis=el=>{try{if(!el||!el.isConnected)return false;const rr=el.getClientRects();if(!rr.length)return false;const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden';}catch(e){return false;}};
  const own=el=>norm(Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' '));
  const banned=Array.from(document.querySelectorAll('div,span,h3,h4,label,strong,b,summary,button')).filter(el=>/banned/i.test(own(el)))
    .map(el=>({tag:el.tagName,own:own(el).slice(0,45),vis:vis(el),inIsland:!!el.closest('[data-antcv-react-mount],[data-antcv-react-island]')}));
  const banks=Array.from(document.querySelectorAll('button')).filter(b=>/from the bank/i.test(norm(b.textContent)))
    .map(b=>({t:norm(b.textContent).slice(0,45),vis:vis(b),inIsland:!!b.closest('[data-antcv-react-mount],[data-antcv-react-island]')}));
  const nativeBlock=document.querySelector('[data-antcv-native-banned-hidden]');
  const wsIsland=document.getElementById('antcv-react-writing-style')||document.querySelector('[data-antcv-react-mount*=writing]');
  return {nativeBannedHidden: nativeBlock? getComputedStyle(nativeBlock).display==='none' : 'NO-MARKER',
  wsIslandMounted: !!wsIsland, panelOpen:/WRITING STYLE/i.test(document.body.textContent||''),banned,banks};
});
console.log(JSON.stringify(r,null,1));
await browser.close();server.close();
