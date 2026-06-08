/* DIAGNOSTIC — PB-WORKER-SIDEBAR-RATIO-001 follow-up. Sets a user-adjusted
 * cvSidebarRatio in localStorage, calls window.exportDocxViaWorker, intercepts
 * the /generate POST and asserts the payload forwards sidebar_ratio (clamped to
 * the worker's [0.2,0.55] band). Also confirms an UNSET ratio omits the field. */
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
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',text:'X'},
  {id:'skills',title:'KEY SKILLS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'X'},{l:'Y'}]},
],cl:[]};

async function runOnce(ratioRaw) {
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  let captured=null;
  await page.route('**/antcv-auto-pagebreak-block-001.js*', route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* blocked */'}));
  await page.route('**/generate', async route=>{ try{ captured=JSON.parse(route.request().postData()||'{}'); }catch(e){ captured={__err:String(e)}; } await route.fulfill({status:200,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',headers:{'Access-Control-Allow-Origin':'*'},body:'PK'}); });
  await page.addInitScript(([secs, rr])=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    if (rr !== null) localStorage.setItem('cvSidebarRatio', rr);   // JSON-stringified by app; we pass the raw string
    localStorage.setItem('antcv:autoPages','{}');localStorage.setItem('antcv:itemPages','{}');
    window.ANTCV_DOCX_WORKER='https://docx-worker.example.com';
    window.__DIAG_SECTIONS=secs;
  }, [sections, ratioRaw]);
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(1200);
  await page.evaluate(async ()=>{ try{ await window.exportDocxViaWorker({ sections: window.__DIAG_SECTIONS, doc:'cv', personalInfo:{name:'A'}, styleConfig:{}, fontSizes:{}, language:'en', navyColor:'#283556' }); }catch(e){} });
  await page.waitForTimeout(400);
  await browser.close();
  return captured;
}

const setVal = await runOnce(JSON.stringify(0.42));   // in-band adjusted ratio
const clamp  = await runOnce(JSON.stringify(0.62));    // above worker band → clamp to 0.55
const unset  = await runOnce(null);                    // not set → field omitted
await new Promise(r=>server.close(r));

console.log('set 0.42  -> sidebar_ratio =', setVal && setVal.sidebar_ratio);
console.log('set 0.62  -> sidebar_ratio =', clamp && clamp.sidebar_ratio);
console.log('unset     -> sidebar_ratio =', unset && unset.sidebar_ratio);
const A = setVal && setVal.sidebar_ratio === 0.42;
const B = clamp && clamp.sidebar_ratio === 0.55;
const C = unset && !('sidebar_ratio' in unset);
console.log('CHECK A (adjusted 0.42 forwarded):', A?'PASS':'FAIL');
console.log('CHECK B (0.62 clamped to 0.55):', B?'PASS':'FAIL');
console.log('CHECK C (unset omits field → worker default 0.33):', C?'PASS':'FAIL');
console.log(A&&B&&C ? 'SIDEBAR-RATIO-FORWARD OK' : 'SIDEBAR-RATIO-FORWARD FAIL');
process.exit(A&&B&&C ? 0 : 1);
