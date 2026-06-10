/* DIAGNOSTIC — REACT-185-EDIT-REGULATORY-001 (owner 2026-06-09).
 * React #185 (= "Maximum update depth exceeded": a setState that synchronously
 * schedules another render in a loop) crashed the app while the owner edited a
 * REGULATORY experience section with many rapid button(submit) taps. This
 * full-app harness mounts the editor with a Regulatory labeled_list + an
 * experience section and HAMMERS edits (typing, group toggles, blur/enter,
 * add/delete) to try to reproduce a render-oscillation, capturing any #185 /
 * "Maximum update depth" / removeChild error. PASS = no such error (the build
 * is stable under the stress); FAIL prints the captured stack so the
 * setState-in-render source can be pinned.
 * Run: node test/diag-react185-regulatory.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

// Owner-like REGULATORY experience + a grouped regulatory labeled_list sidebar.
const reg = [];
for (let g = 0; g < 2; g++) { reg.push({ group: 'Group ' + g }); for (let e = 0; e < 4; e++) reg.push({ l: 'ISO ' + g + e, v: 'context line ' + g + e }); }
const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Profile.' },
    { id:'regexp', title:'REGULATORY EXPERIENCE', loc:'main', on:true, type:'experience', roles:[
      { id:'r1', title:'Regulatory Lead', company:'Acme', years:'2020', bullets:['Owned ISO 26262 compliance','Led ASPICE assessments'] },
      { id:'r2', title:'QA Engineer', company:'Beta', years:'2018', bullets:['SOTIF analysis'] },
    ] },
    { id:'regctx', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: reg },
  ],
  cl: [],
};
const personalInfo = { name:'Anita Myre', headline:'Regulatory Affairs', email:'a@example.com', phone:'+45 00', location:'Copenhagen' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token', 'diag-token');
  localStorage.setItem('antcv:auth:email', 'diag@example.com');
  localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'diag@example.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [sections, personalInfo]);

const errs=[];
const fatal=[];
page.on('pageerror',e=>{ const m=(e&&e.message)||String(e); errs.push(m);
  if(/Minified React error #185|Maximum update depth|removeChild|insertBefore/i.test(m)) fatal.push(m); });
page.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(/#185|Maximum update depth/i.test(t)) fatal.push('console: '+t); }});

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
await page.waitForTimeout(4000);

// Open a section editor (reveals per-field inputs) and IMMEDIATELY hammer them
// in the SAME evaluate so the live fields don't collapse between steps. Skip
// hide/visibility toggles (🙈/👁) so the panel stays open while we stress it.
const stress = await page.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const vis = (el) => el && el.offsetParent !== null;
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value');
    try { set.set.call(el, v); } catch (_) { el.value = v; }
  };
  // Open: click section-title-ish nodes mentioning "regulatory" (NOT the hide eye).
  const opens = Array.from(document.querySelectorAll('button, [role=button], div, span'))
    .filter(el => vis(el) && /regulatory/i.test(el.textContent || '') && (el.textContent || '').length < 60 && !/🙈|👁/.test(el.textContent || ''));
  for (const el of opens.slice(0, 4)) { try { el.click(); } catch (_) {} }
  await sleep(800);

  let typed = 0, clicked = 0, maxInputs = 0;
  // 4 aggressive passes: type into every visible field, fire input+Enter+blur,
  // then click the section's add/compress/enrich/+ buttons (the owner's submit
  // taps) — all while re-reading the live DOM each pass.
  for (let pass = 0; pass < 4; pass++) {
    const inputs = Array.from(document.querySelectorAll('input, textarea')).filter(vis);
    maxInputs = Math.max(maxInputs, inputs.length);
    for (const el of inputs.slice(0, 16)) {
      el.focus();
      setVal(el, (el.value || '') + 'q');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      typed++;
      await sleep(1);
    }
    const buttons = Array.from(document.querySelectorAll('button')).filter(b =>
      vis(b) && !/sign out|log out|delete account|hard refresh|reset|🙈|👁/i.test((b.title || '') + (b.textContent || '')));
    for (const b of buttons.slice(0, 30)) { try { b.click(); clicked++; } catch (_) {} await sleep(1); }
    await sleep(20);
  }
  await sleep(50);
  return { typed, clicked, maxInputs };
});

await page.waitForTimeout(2500);

await browser.close();
await new Promise(r=>server.close(r));

console.log('stress:', JSON.stringify(stress));
console.log('total page errors:', errs.length);
if (errs.length) console.log('first errors:', errs.slice(0, 3).join(' || '));
console.log('FATAL (#185 / update-depth / DOM-mutation):', fatal.length);
if (fatal.length) console.log('fatal stacks:', fatal.slice(0, 3).join(' || '));
const ok = fatal.length === 0;
console.log(ok ? 'REACT185-REGULATORY OK (no oscillation crash reproduced under stress)' : 'REACT185-REGULATORY REPRODUCED');
process.exitCode = ok ? 0 : 1;
