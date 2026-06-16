/* DIAGNOSTIC — TENSE-RENDER-001 (owner 2026-06-16). The STORED WORK HISTORY builder
 * (GABRIEL_BG) must tag a role "CURRENT ROLE" from the isCurrent FLAG (never from the
 * date string), and the generation prompt's AUTO tense rule must read that tag. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const personalInfo = { name:'G', workHistory: [
  // a CURRENT role (isCurrent flag true) with PAST-looking dates → must still tag CURRENT.
  { role:'Current Job', company:'CoA', years:'2023 - 2024', isCurrent:true, bullets:['Did X.'] },
  // a NOT-current role whose dates LOOK open-ended ("present") → must NOT be tagged.
  { role:'Old Job', company:'CoB', years:'2010 - present', bullets:['Did Y.'] },
] };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((pi)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
}, personalInfo);
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>{ try { return typeof window.GABRIEL_BG === 'string' && /STORED WORK HISTORY/.test(window.GABRIEL_BG); } catch(_) { return false; } }, { timeout: 20000 }).catch(()=>{});

const r = await page.evaluate(()=>{
  let bg = '';
  try { bg = String(window.GABRIEL_BG || ''); } catch (_) {}
  const curLine = (bg.split('\n').find(l => /Current Job/.test(l)) || '');
  const oldLine = (bg.split('\n').find(l => /Old Job/.test(l)) || '');
  return { hasSWH: /STORED WORK HISTORY/.test(bg), curLine, oldLine };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('--- TENSE-RENDER-001 ---');
console.log('current role line:', JSON.stringify(r.curLine));
console.log('past role line   :', JSON.stringify(r.oldLine));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['STORED WORK HISTORY built from injected workHistory', r.hasSWH && !!r.curLine && !!r.oldLine],
  ['CURRENT (isCurrent flag) role tagged "CURRENT ROLE"', /CURRENT ROLE/.test(r.curLine)],
  ['NON-current role NOT tagged, even with "present" dates', !/CURRENT ROLE/.test(r.oldLine)],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'TENSE-RENDER OK' : 'TENSE-RENDER FAILED');
process.exit(ok ? 0 : 1);
