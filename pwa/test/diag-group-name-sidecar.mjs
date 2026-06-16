/* DIAGNOSTIC — GROUP-NAME-VISIBILITY-001 sidecar rules (owner 2026-06-16).
 * antcv-group-name-visibility.js must set labelHidden per: Rule 1 (single-group
 * subsubsection → hide its lone name), Rule 2 (tools/methods → keep <=4 names, hide
 * the rest), and honor the manual re-show override. */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P.' },
  // tools/methods: 6 named groups → keep first 4 (no JD), hide last 2.
  { id:'tools', title:'TOOLS & METHODS', loc:'main', on:true, type:'labeled_list', items:[
    { l:'Project workflow', v:'Jira' }, { l:'Reporting', v:'SQL' }, { l:'Architecture', v:'MBSE' },
    { l:'Methods', v:'Lean' }, { l:'Domain', v:'Optics' }, { l:'Engineering', v:'Python' },
  ] },
  // single-group section (one labeled row, no {group}) → hide its name.
  { id:'access', title:'ACCESSIBILITY', loc:'sidebar', on:true, type:'labeled_list', items:[
    { l:'Accessibility', v:'Structured comms work well' },
  ] },
  // regulatory: a {group} subsubsection with MULTIPLE rows → keep names.
  { id:'regulatory', title:'STANDARDS', loc:'main', on:true, type:'labeled_list', items:[
    { group:'Safety' }, { l:'ISO 26262', v:'Functional safety' }, { l:'ASPICE', v:'Traceability' },
    // ...and a {group} with a single row → hide that lone name.
    { group:'Lasers' }, { l:'IEC 60825', v:'Laser safety' },
  ] },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500);

const read = async ()=> page.evaluate(()=>{
  const b = JSON.parse(localStorage.getItem('sections')||'{}');
  const m = {};
  (b.cv||[]).forEach(s=>{ if(s&&s.type==='labeled_list') m[s.id]=(s.items||[]).map(it=> it&&it.group!==undefined ? ('group:'+it.group) : (it.l+'='+(it.labelHidden?'HID':'shown'))); });
  return m;
});
const before = await read();
// manual override: re-show the hidden "Engineering" name in tools.
await page.evaluate(()=> window.AntcvGroupNameVisibility.showName('tools','Engineering',true));
await page.waitForTimeout(1500);
const after = await read();

await browser.close(); await new Promise(r=>server.close(r));
console.log('--- GROUP-NAME sidecar ---');
console.log('tools  :', JSON.stringify(before.tools));
console.log('access :', JSON.stringify(before.access));
console.log('regs   :', JSON.stringify(before.regulatory));
console.log('tools after re-show Engineering:', JSON.stringify(after.tools));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const hid = (arr, key)=> (arr||[]).some(x=>x===key+'=HID');
const shown = (arr, key)=> (arr||[]).some(x=>x===key+'=shown');
const checks = [
  ['tools: first 4 names kept (Project workflow shown)', shown(before.tools,'Project workflow') && shown(before.tools,'Methods')],
  ['tools: groups beyond 4 hidden (Domain, Engineering)', hid(before.tools,'Domain') && hid(before.tools,'Engineering')],
  ['single-group section: lone name hidden (Accessibility)', hid(before.access,'Accessibility')],
  ['multi-row subsubsection: names kept (ISO 26262, ASPICE shown)', shown(before.regulatory,'ISO 26262') && shown(before.regulatory,'ASPICE')],
  ['single-row subsubsection: lone name hidden (IEC 60825)', hid(before.regulatory,'IEC 60825')],
  ['manual override re-shows Engineering', shown(after.tools,'Engineering')],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'GROUP-NAME SIDECAR OK' : 'GROUP-NAME SIDECAR FAILED');
process.exit(ok ? 0 : 1);
