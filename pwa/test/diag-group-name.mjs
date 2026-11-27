/* DIAGNOSTIC — GROUP-NAME-VISIBILITY-001 (owner 2026-06-16).
 * The labeled_list PREVIEW render must honor a per-row `labelHidden` flag: a flagged
 * row shows its VALUE only (the bold group name + leading space dropped), a normal
 * row shows "label: value". Verifies the minified app.js render change.
 * Updated 2026-11-27 (DIAG-FLEET-ROT-001): TOOLS-METHODS-LABELS-SHOW-001 (owner
 * 2026-06-18) shows EVERY tools/methods label and strips labelHidden there;
 * RULE 1 (a lone labeled row in a sub-group hides its name) still holds for the
 * other labeled_list sections. labeled_list is folded into rich_block since
 * 1.50.763 (labelHidden -> bOff), and the bold label is a font-weight span, not <b>. */
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
    { l:'ToolsCat', v:'BETAVALUE', labelHidden:true },
  ] },
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'main', on:true, type:'labeled_list', items:[
    { group:'GroupOne' }, { l:'LoneCat', v:'GAMMAVALUE' },
    { group:'GroupTwo' }, { l:'PairA', v:'DELTAVALUE' }, { l:'PairB', v:'EPSVALUE' },
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
  const bold = (el)=>Array.from(el.querySelectorAll('b,strong,span')).some(n=>parseInt(getComputedStyle(n).fontWeight,10)>=600 && /Cat|Pair/.test(n.textContent||''));
  const info = rows.map(el=>({ text:(el.textContent||'').replace(/\s+/g,' ').trim(), hasB: bold(el) }));
  const f = (re)=>info.find(x=>re.test(x.text));
  return { count: rows.length, visible: f(/ALPHAVALUE/), tools2: f(/BETAVALUE/), lone: f(/GAMMAVALUE/), pair: f(/DELTAVALUE/) };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('--- GROUP-NAME-VISIBILITY-001 ---');
console.log('rows:', r.count, JSON.stringify({ visible: r.visible, tools2: r.tools2, lone: r.lone, pair: r.pair }));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['preview rendered the rows', r.count >= 4 && r.visible && r.tools2 && r.lone && r.pair],
  ['tools row shows the bold label + value', !!r.visible && r.visible.hasB && /VisibleCat: ALPHAVALUE/.test(r.visible.text)],
  ['tools row flagged labelHidden still shows its label (owner 06-18)', !!r.tools2 && r.tools2.hasB && /ToolsCat: BETAVALUE/.test(r.tools2.text)],
  ['RULE 1: lone row in a sub-group shows VALUE only', !!r.lone && !/LoneCat/.test(r.lone.text) && /GAMMAVALUE/.test(r.lone.text)],
  ['RULE 1: rows in a two-row sub-group keep their label', !!r.pair && r.pair.hasB && /PairA: DELTAVALUE/.test(r.pair.text)],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'GROUP-NAME OK' : 'GROUP-NAME FAILED');
process.exit(ok ? 0 : 1);
