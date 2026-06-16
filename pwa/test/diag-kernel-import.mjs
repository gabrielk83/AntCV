/* DIAGNOSTIC — kernel v2 §4f slice 3 (import UI). A dropped CV file runs the tested
 * engine and the preview modal shows roles + gaps; a second import against a staged
 * kernel with a different metric surfaces a CONFLICT (keep-existing default). */
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

const CV = [
  'Gabriel Karp','karp@example.com','+45 31 71 00 72','','WORK EXPERIENCE','',
  'Product Manager — Acme Corp (2022 – Present)','- Built the product roadmap.','- Cut cycle time from 250 to 10 days.','',
  'System Architect — Acme Corp (2020 – 2023)','- Owned the system architecture.','',
  'Computer Administrator — IDF (2001 – 2003)','- Ran the unit help desk.',''
].join('\n');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>!!(window.AntcvKernelIngest&&window.AntcvKernelImport), { timeout: 20000 }).catch(()=>{});

// A) fresh import → modal shows 3 roles + gaps + create
const a = await page.evaluate(async (cv)=>{
  const file = new File([cv], 'cv.txt', { type:'text/plain' });
  const res = await window.AntcvKernelImport.runImport(file);
  const m = document.getElementById('antcv-kimport-modal');
  return { ok:!!m, text:(m&&m.textContent||'').replace(/\s+/g,' '), mode:res&&res.mode, roles:res&&res.kernel.experience.length, gaps:res&&res.gaps.length };
}, CV);

// B) stage an existing kernel with a DIFFERENT metric, re-import same → CONFLICT
const b = await page.evaluate(async (cv)=>{
  // different START year → a date conflict the parser can actually produce; the
  // existing metric must survive (keep-both, never overwritten).
  const existing = { experience:[ { id:'pm', title:'Product Manager', company:'Acme Corp', start:'2021', end:'present',
    outcomes:[{title:'cycle', result:'Cut cycle from 999 to 99 days.'}], scope:['Old scope.'] } ] };
  localStorage.setItem('antcv:ingestedKernel', JSON.stringify(existing));
  const file = new File([cv], 'cv.txt', { type:'text/plain' });
  const res = await window.AntcvKernelImport.runImport(file);
  const m = document.getElementById('antcv-kimport-modal');
  return { mode:res&&res.mode, conflicts:res&&res.conflicts.length, hasConflictText:/Conflicts/.test(m&&m.textContent||''), metricPreserved:/999 to 99/.test(JSON.stringify(res&&res.kernel)) };
}, CV);

// C) saveToAccount POSTs the kernel to the relay /api/profile/kernel-v2
const c = await page.evaluate(async ()=>{
  window.ANTCV_RELAY_URL = 'https://relay.example.com';
  let captured = null;
  const orig = window.fetch;
  window.fetch = async (url, opts)=>{ captured = { url:String(url), method:opts&&opts.method, cred:opts&&opts.credentials, body:opts&&opts.body }; return { ok:true, status:200, json: async ()=>({ ok:true, roles:2 }) }; };
  await window.AntcvKernelImport.saveToAccount({ experience:[{id:'a'},{id:'b'}] });
  window.fetch = orig;
  return captured;
});

await browser.close(); await new Promise(r=>server.close(r));
console.log('--- kernel-import UI ---');
console.log('A fresh:', JSON.stringify(a));
console.log('B merge:', JSON.stringify(b));
console.log('C save :', JSON.stringify(c));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['engine + UI loaded and ran', a.ok && a.mode==='create'],
  ['modal lists the extracted roles', /Product Manager/.test(a.text) && /System Architect/.test(a.text) && a.roles===3],
  ['modal shows gaps (missing outcomes/proofPoints)', a.gaps>=1 && /Gaps/.test(a.text)],
  ['re-import against staged kernel = merge with a conflict', b.mode==='merge' && b.conflicts>=1 && b.hasConflictText],
  ['existing metric preserved (keep-both, not overwritten)', b.metricPreserved],
  ['saveToAccount POSTs the kernel to /api/profile/kernel-v2 (credentials included)', !!c && /\/api\/profile\/kernel-v2$/.test(c.url) && c.method==='POST' && c.cred==='include' && /"experience"/.test(c.body||'')],
  ['no app errors', errs.length===0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'KERNEL-IMPORT UI OK' : 'KERNEL-IMPORT UI FAILED');
process.exit(ok ? 0 : 1);
