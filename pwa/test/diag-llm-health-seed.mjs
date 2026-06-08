/* DIAGNOSTIC — LLM-QUALITY-PERSIST-001. Confirms the PWA fetches the relay
 * /api/llm-health snapshot on startup (the cross-session quality seed). */
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
const RELAY='https://antcv-access-relay.karp-gabriel-a.workers.dev';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
let healthHit=null;
// Intercept the relay /api/llm-health call and return a mock with a degraded provider.
await page.route('**/api/llm-health**', async route=>{
  healthHit = route.request().url();
  await route.fulfill({ status:200, contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*'},
    body: JSON.stringify({ ok:true, window_minutes:60, window_start:1780881659, rows:[
      { provider:'gemini', task:'parse_jd', status:'down', health_score:0.2 },
      { provider:'mistral', task:'generate_cv', status:'degraded', health_score:0.5 },
      { provider:'openai', task:'parse_jd', status:'ok', health_score:1 },
    ]}) });
});
await page.addInitScript((relay)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('proxyUrl',JSON.stringify(relay));
  localStorage.setItem('step',JSON.stringify('upload'));
}, RELAY);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5000); // startup kick fires at ~2.5s
await browser.close();await new Promise(r=>server.close(r));
console.log('llm-health request made:', healthHit || 'NONE');
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
const ok = !!healthHit && /\/api\/llm-health\?window=60/.test(healthHit) && errs.length===0;
console.log(ok ? 'SEED-FETCH OK (startup kick hit /api/llm-health)' : 'SEED-FETCH CHECK INCOMPLETE');
