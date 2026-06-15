/* DIAGNOSTIC — ACCOUNT-ISOLATION-001 (owner 2026-06-15): two users on one machine
 * must not contaminate each other. Seeds user A's CV data + secrets + a session
 * for A, then boots signed in as user B (different email). The auth-subscribe
 * email-mismatch path must WIPE A's local data/secrets before restoring B.
 * Run from pwa/. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1200,height:1400} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
// 1) open the app, 2) seed ONCE (not via addInitScript, which would re-seed on the
// app's own reload), 3) reload so the app boots signed-in as B with A's leftover data.
await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
await page.evaluate(()=>{
  localStorage.setItem('antcv:auth:token','tokenB');
  localStorage.setItem('antcv:auth:email','userB@example.com');
  localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'userA@example.com', ts: 1717000000000 }));
  localStorage.setItem('sections', JSON.stringify({ cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'USER A SECRET PROFILE'}], cl:[] }));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'User A', email:'userA@example.com' }));
  localStorage.setItem('apiKey','sk-ant-USER-A-SECRET-KEY');
  localStorage.setItem('antcv:lastJdText','user A private job description');
  localStorage.setItem('antcv:resultsOverride', JSON.stringify({ 'r|x|y|0':'A override' }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('language', JSON.stringify('en'));
  localStorage.setItem('proxyUrl', JSON.stringify('https://relay.example.com')); // deployment-level, must be KEPT
});
await page.reload({waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
await page.waitForTimeout(6000); // let the app detect the mismatch, wipe, and self-reload as B

const ls = await page.evaluate(()=>{
  const g=(k)=>localStorage.getItem(k);
  let sess=null; try{ sess=JSON.parse(g('session')||'null'); }catch(_){}
  return {
    sections: g('sections'), personalInfo: g('personalInfo'), apiKey: g('apiKey'),
    jd: g('antcv:lastJdText'), override: g('antcv:resultsOverride'),
    sessionEmail: sess && sess.email, proxyUrl: g('proxyUrl'), authEmail: g('antcv:auth:email'),
  };
});
await browser.close();
await new Promise(r=>server.close(r));

console.log('after B login:', JSON.stringify(ls, null, 1));
if(errs.length) console.log('pageerrors:', errs.slice(0,3).join(' | '));

const A = !ls.sections || !/USER A SECRET/.test(ls.sections);     // A's sections wiped
const B = !ls.apiKey;                                              // A's API secret wiped
const C = !ls.jd && !ls.override && (!ls.personalInfo || !/User A/.test(ls.personalInfo)); // A's local-only data wiped
const D = ls.sessionEmail === 'userB@example.com';                 // session switched to B
const E = !!ls.proxyUrl;                                           // deployment proxyUrl KEPT (restore works)
const F = errs.length===0;
console.log(`CHECK A (user A sections wiped): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (user A API secret wiped): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (A's personalInfo/JD/override wiped): ${C?'PASS':'FAIL'}`);
console.log(`CHECK D (session switched to user B): ${D?'PASS':'FAIL'}`);
console.log(`CHECK E (deployment proxyUrl kept for restore): ${E?'PASS':'FAIL'}`);
console.log(`CHECK F (no page errors): ${F?'PASS':'FAIL'}`);
const ok=A&&B&&C&&D&&E&&F;
console.log(ok?'ACCOUNT-ISOLATION OK (6/6)':'ACCOUNT-ISOLATION FAIL');
process.exitCode=ok?0:1;
