/* DIAGNOSTIC (read-only) — verifies BOOT-WAITSCREEN-GATE-001 in
 * antcv-wait-screen-times.js: the new canMatchAnyReplacement() precondition
 * short-circuits the 9-selector full-document wait-screen scan when the doc
 * contains no "60"/"90"/"1-2 minutes" trigger token (the boot case), AND a real
 * overlay containing "60 seconds" is still rewritten to "4-6 minutes" (behaviour
 * preserved). Renders past the sign-in gate on the same owner-scale doc as
 * diag-boot-profile. Does NOT edit anything. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const roles = Array.from({length:12},(_,i)=>({ id:'r'+i, title:'Role '+i, company:'Company '+i, dateRange:'20'+(10+i)+'-20'+(11+i), bullets:['Did important work number '+i+' with measurable outcomes across teams.','Second bullet for role '+i+'.'] }));
const tools = Array.from({length:17},(_,i)=>({ l:'Tool '+i, v:'Detail value for tool '+i }));
const cv = [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Operations specialist.' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items: tools },
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Languages'},{l:'English',v:'native'},{l:'Interests',v:'hiking'}] },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' } ];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' }, tools };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errors = [];
page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e=>errors.push('PAGEERROR: '+(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('antcv:disable-loading-gate','1');
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [{cv,cl}, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const probe = await page.evaluate(()=>{
  const WS = window.AntcvWaitScreenTimes;
  const out = { installed: !!(WS && WS.version) };
  out.editorRendered = /TOOLS|PROFESSIONAL EXPERIENCE|ADDITIONAL/i.test(document.body.innerText||'');

  // The wait-screen 9-selector signature (case-insensitive overlay/modal/etc).
  const WS_SEL = /overlay|modal|\bwait\b|loading|progress|spinner|role="dialog"|role="alertdialog"|data-antcv-wait|data-antcv-overlay/i;
  const realQSA = document.querySelectorAll.bind(document);
  let wsScans = 0;
  document.querySelectorAll = function(sel){ if (sel && WS_SEL.test(sel)) wsScans++; return realQSA(sel); };

  // --- Phase A: gate short-circuit (boot case) ---
  // Does the live doc currently contain a trigger token?
  const t = (document.body && document.body.textContent) || '';
  out.bodyHasToken = /\b(?:60|90)/.test(t) || /\b1[–—-]2\s+minutes?\b/.test(t);
  let s0 = wsScans;
  out.applyAllReturnA = (WS && WS._applyAll) ? WS._applyAll() : 'NO_API';
  out.wsScansA = wsScans - s0;     // 0 expected when !bodyHasToken (gate skipped the scan)

  // --- Phase B: behaviour preserved (real overlay with "60 seconds") ---
  const ov = document.createElement('div');
  ov.className = 'antcv-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999';
  ov.innerHTML = '<div>Generating your documents — this may take about 60 seconds</div>';
  document.body.appendChild(ov);
  let s1 = wsScans;
  out.applyAllReturnB = (WS && WS._applyAll) ? WS._applyAll() : 'NO_API';
  out.wsScansB = wsScans - s1;     // >0 expected: token now present -> gate passes -> scan runs
  out.overlayText = ov.textContent;
  out.overlayRewritten = /4-6 minutes/.test(ov.textContent) && !/60 seconds/.test(ov.textContent);
  ov.remove();

  document.querySelectorAll = realQSA;
  return out;
});
await page.waitForTimeout(1000);
await browser.close(); await new Promise(rr=>server.close(rr));

const sidecarErrors = errors.filter(e=>/wait-screen-times/.test(e));
console.log('installed:', probe.installed, '| editorRendered:', probe.editorRendered);
console.log('Phase A (boot, no overlay): bodyHasToken=', probe.bodyHasToken,
            '| _applyAll()=', probe.applyAllReturnA, '| wait-screen doc-scans=', probe.wsScansA,
            probe.bodyHasToken ? '(token present in chrome -> gate cannot skip; expect scan ran, return 0)'
                               : '(no token -> gate short-circuited; expect 0 scans)');
console.log('Phase B (overlay "60 seconds"): _applyAll()=', probe.applyAllReturnB,
            '| wait-screen doc-scans=', probe.wsScansB, '| rewritten=', probe.overlayRewritten,
            '| text="'+probe.overlayText+'"');
console.log('sidecar console errors:', sidecarErrors.length, sidecarErrors.slice(0,5));

const gateOK = probe.bodyHasToken
  ? (probe.wsScansA > 0 && probe.applyAllReturnA === 0)   // can't skip, but must be correct (no false rewrite)
  : (probe.wsScansA === 0 && probe.applyAllReturnA === 0); // gate short-circuited the scan
const behaviourOK = probe.applyAllReturnB >= 1 && probe.wsScansB > 0 && probe.overlayRewritten;

const ok = probe.installed && probe.editorRendered && gateOK && behaviourOK && sidecarErrors.length===0;
console.log(ok
  ? '\nPASS — gate short-circuits the wait-screen scan when no trigger token (boot), and a real "60 seconds" overlay is still rewritten to "4-6 minutes".'
  : '\nFAIL — see above');
process.exit(ok ? 0 : 1);
