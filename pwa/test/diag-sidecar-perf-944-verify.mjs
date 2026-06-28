/* DIAGNOSTIC (read-only) — verifies the 1.50.944 boot-perf batch on the THREE
 * patched sidecars renders past the sign-in gate, loads each sidecar, runs each
 * run() with no throw + no sidecar console errors, and PROVES the new cross-run
 * caches short-circuit a repeat scan:
 *   - antcv-foundation-controls-327.js  __fndRootCache (foundationPreviewParas):
 *       _applyPreview() twice -> 2nd call does 0 document [data-sid=foundation] scans.
 *   - antcv-embedded-controls-248.js     __addinfoCache (addinfoRoot) + 245
 *       __previewSecCache (previewSection): load + run() clean (the cache logic is
 *       the proven 274/249 pattern; re-validate with the SAME predicate => identical).
 * Same owner-scale doc as diag-boot-profile. Does NOT edit anything. */
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
  { id:'how_i_would_contribute', title:'HOW I WOULD CONTRIBUTE', loc:'main', on:true, type:'rich_block', content:'Intro framing.', items:[{t:'Map the flow.'},{t:'Set up KPIs.'}] },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items: tools },
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Languages'},{l:'English',v:'native'},{l:'Interests',v:'hiking'}] },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' },
  { id:'foundation', title:'FOUNDATION', loc:'main', on:true, type:'rich_block', content:'Hands-on and professionally.' } ];
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
  const g = n => !!(window[n] && window[n].version);
  const ran = {};
  for (const [k,fn] of [
    ['emb248',window.AntcvEmbeddedControlsGuard248],
    ['hiwc245',window.AntcvHowContributeControls239],
    ['fnd327',window.AntcvFoundationControls327],
  ]) {
    try { fn && typeof fn.run==='function' && fn.run(); ran[k]='ok'; } catch(e){ ran[k]='THREW: '+(e&&e.message); }
  }

  // --- Prove 327 __fndRootCache: build a synthetic foundation preview section ---
  const paper = document.createElement('div'); paper.className='antcv-preview-paper';
  const fnd = document.createElement('div'); fnd.setAttribute('data-sid','foundation');
  fnd.innerHTML = '<p>My hands-on background means I build.</p><p>Professionally I deliver outcomes.</p>';
  // Prepend so inPreview()'s document.querySelector('.antcv-preview-paper') resolves
  // to OUR paper first (a competing real preview paper would otherwise win the lookup
  // and make inPreview(fnd) false -> cache never set). Matches diag-rootcache-verify.
  paper.appendChild(fnd); document.body.insertBefore(paper, document.body.firstChild);

  const realQS = document.querySelector.bind(document);
  const realQSA = document.querySelectorAll.bind(document);
  let fndScans=0;
  const count = sel => { if (sel && /\[data-sid="foundation"\]/.test(sel)) fndScans++; };
  document.querySelector = function(sel){ count(sel); return realQS(sel); };
  document.querySelectorAll = function(sel){ count(sel); return realQSA(sel); };

  let applyThrew=null, scan1=0, scan2=0;
  const ap = window.AntcvFoundationControls327 && window.AntcvFoundationControls327._applyPreview;
  if (ap) {
    try { const s0=fndScans; ap(); scan1=fndScans-s0; const s1=fndScans; ap(); scan2=fndScans-s1; }
    catch(e){ applyThrew=(e&&e.message)||String(e); }
  }
  document.querySelector = realQS; document.querySelectorAll = realQSA;

  return {
    editorRendered: /TOOLS|HOW I WOULD CONTRIBUTE|PROFESSIONAL EXPERIENCE|ADDITIONAL/i.test(document.body.innerText||''),
    globals: { emb248:g('AntcvEmbeddedControlsGuard248'), hiwc245:g('AntcvHowContributeControls239'), fnd327:g('AntcvFoundationControls327') },
    ran, applyThrew, scan1, scan2,
    bodyLen: (document.body.innerText||'').length,
  };
});
// allow the rAF-debounced run()s + their observers to flush, then re-check errors.
await page.waitForTimeout(1500);
await browser.close(); await new Promise(rr=>server.close(rr));

const sidecarErrors = errors.filter(e=>/embedded-controls-248|how-contribute-controls-245|foundation-controls-327/.test(e));
console.log('editorRendered:', probe.editorRendered, '| bodyLen:', probe.bodyLen);
console.log('globals present:', JSON.stringify(probe.globals));
console.log('direct run():', JSON.stringify(probe.ran));
console.log('327 _applyPreview() foundation doc-scans:', probe.scan1, '->', probe.scan2,
            '(2nd cached:', (probe.scan2===0)+')', probe.applyThrew?('THREW: '+probe.applyThrew):'');
console.log('sidecar console errors:', sidecarErrors.length, sidecarErrors.slice(0,5));
console.log('total console errors during boot:', errors.length);

const ok = probe.editorRendered
  && probe.globals.emb248 && probe.globals.hiwc245 && probe.globals.fnd327
  && probe.ran.emb248==='ok' && probe.ran.hiwc245==='ok' && probe.ran.fnd327==='ok'
  && !probe.applyThrew
  && probe.scan1>0 && probe.scan2===0    // 327: 1st _applyPreview scanned the doc, 2nd hit __fndRootCache
  && sidecarErrors.length===0;
console.log(ok ? '\nPASS — 3 sidecars load + run clean past the gate; 327 root cache short-circuits the repeat scan' : '\nFAIL — see above');
process.exit(ok ? 0 : 1);
