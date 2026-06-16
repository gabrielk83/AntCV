/* DIAGNOSTIC — GROUP-NAME-VISIBILITY-001 (owner 2026-06-16).
 * The labeled_list PREVIEW render must honor a per-row `labelHidden` flag: a flagged
 * row shows its VALUE only (the bold group name + leading space dropped), a normal
 * row shows "label: value". Verifies the minified app.js render change. */
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

const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'A product professional.' },
  { id:'tools', title:'TOOLS & METHODS', loc:'main', on:true, type:'labeled_list', items:[
    { l:'VisibleCat', v:'ALPHAVALUE' },
    { l:'HiddenCat', v:'BETAVALUE', labelHidden:true },
  ] },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1100 } });
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4000);

const r = await page.evaluate(()=>{
  // PREVIEW labeled_list rows carry data-antcv-row-path; inspect their <b> label.
  const rows = Array.from(document.querySelectorAll('[data-antcv-row-path]'));
  const info = rows.map(el=>({ text:(el.textContent||'').replace(/\s+/g,' ').trim(), hasB: !!el.querySelector('b') }));
  const visible = info.find(x=>/ALPHAVALUE/.test(x.text));
  const hidden = info.find(x=>/BETAVALUE/.test(x.text));
  return { count: rows.length, visible, hidden };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('--- GROUP-NAME-VISIBILITY-001 ---');
console.log('rows:', r.count, '| visible:', JSON.stringify(r.visible), '| hidden:', JSON.stringify(r.hidden));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['preview rendered the labeled_list rows', r.count >= 2 && r.visible && r.hidden],
  ['normal row shows the bold label + value', !!r.visible && r.visible.hasB && /VisibleCat/.test(r.visible.text)],
  ['labelHidden row shows VALUE only (no bold label)', !!r.hidden && !r.hidden.hasB && /BETAVALUE/.test(r.hidden.text) && !/HiddenCat/.test(r.hidden.text)],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'GROUP-NAME OK' : 'GROUP-NAME FAILED');
process.exit(ok ? 0 : 1);
