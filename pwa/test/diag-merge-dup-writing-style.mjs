/* DIAGNOSTIC — MERGE-DUP-001 (owner: "we are using the old buttons").
 * The WritingStylePicker island owns the canonical writing-style control; app.js
 * still renders a DUPLICATE legacy <select> in Settings → Personal. The island
 * mount hides ONLY that <select> (scoped to the element, never its container —
 * the two legacy buttons stay). Asserts: the legacy writing-style select is
 * display:none + tagged; the custom-slots select and the island's own select
 * remain visible. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port; const base = `http://127.0.0.1:${port}`;

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1280,height:1600}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'G'}));localStorage.setItem('wizardCompleted',JSON.stringify(true));localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(2500);
await page.evaluate(()=>window._antcvOpenSettingsRoute&&window._antcvOpenSettingsRoute({tier:'standard',subtab:'personal',source:'diag'}));
await page.waitForTimeout(3500);

const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
const r = await page.evaluate(()=>{
  const sels = Array.from(document.querySelectorAll('select')).map(s=>{
    const opts = Array.from(s.options).map(o=>(o.textContent||'').trim());
    const txt = opts.join(' | ');
    const cs = getComputedStyle(s);
    return { isLegacyWS: /nordic minimal/i.test(txt) && /achievement[- ]?driven/i.test(txt) && !s.closest('#antcv-react-writing-style-picker'),
      isIsland: !!s.closest('#antcv-react-writing-style-picker'),
      isCustomSlots: /custom 1 \(empty\)/i.test(txt),
      display: cs.display, hiddenTag: s.getAttribute('data-antcv-hidden-writing-style-stray') };
  });
  return sels;
});
const legacy = r.find(s=>s.isLegacyWS);
const island = r.find(s=>s.isIsland);
const custom = r.find(s=>s.isCustomSlots);
check('island writing-style select present + visible', !!island && island.display!=='none', JSON.stringify(island));
check('legacy duplicate writing-style select is HIDDEN (display:none + tagged)', !!legacy && legacy.display==='none' && legacy.hiddenTag==='1', JSON.stringify(legacy));
check('custom-slots select untouched (still visible)', !!custom && custom.display!=='none', JSON.stringify(custom));
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));

await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'MERGE-DUP-WRITING-STYLE OK':'MERGE-DUP-WRITING-STYLE FAIL');
process.exit(ok?0:1);
