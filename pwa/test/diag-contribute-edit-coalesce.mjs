/* DIAGNOSTIC — CONTRIBUTE-EDIT-JUMPS-WIB-TABLE-001. Boots the full app past the
 * sign-in gate with a CL containing a WHAT I BRING ('bring') table + a HOW I
 * WOULD CONTRIBUTE ('contribute') section, then exercises the REAL sidecar code
 * path (antcv-how-contribute-controls-245.js): injects a faithful contribute
 * editor panel, calls the sidecar's exposed run() so it binds its
 * input->syncSectionField listener to the live intro field, then simulates a fast
 * typing burst (each keystroke a DISTINCT value, so syncSectionField registers a
 * real change every time — a same-value burst would pulse only once even WITHOUT
 * the fix, defeating the test) and counts the how-contribute-controls
 * source-tagged antcv:item-pages-changed / antcv:sections-updated re-dispatches.
 *
 * With the 180ms trailing debounce on pulse() a burst of N distinct keystrokes
 * coalesces to ~1 flush; without it, each changed keystroke fires its own pair
 * (~N), which re-measures the whole CL flow and visibly shifts the WIB table.
 *
 * PASS = path exercised (>=1 flush) AND strongly coalesced (flushes << burst). */
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
const sections={cv:[],cl:[
  {id:'greeting',title:'Greeting',loc:'main',on:true,type:'text',content:'Dear Hiring Manager,'},
  {id:'bring',title:'WHAT I BRING',loc:'main',on:true,type:'table',
   rows:[['Focus area','Expertise'],['Compliance','GDPR, ISO 27001'],['Delivery','Agile, CI/CD']]},
  {id:'contribute',title:'HOW I WOULD CONTRIBUTE',loc:'main',on:true,type:'text_bullets',
   intro:'In the first quarter I would focus on three things.',
   items:['Ship the Q3 compliance dashboard within the first 60 days','Cut the regression suite runtime','Document the on-call runbook'],
   closing:'The team gains a faster release cycle and a calmer on-call.'},
  {id:'closing',title:'Closing',loc:'main',on:true,type:'text',content:'Kind regards, Test Candidate'},
]};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cl'));
  localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'A'}));
  localStorage.setItem('antcv:autoPages','{}');localStorage.setItem('antcv:itemPages','{}');
},sections);
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t))errs.push(t);}});
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const BURST=15;
const r=await page.evaluate(async(burst)=>{
  // Build a faithful contribute editor panel OUTSIDE the preview paper so the
  // sidecar's root()/findIntro detection binds to it (matches the real editor's
  // "Intro line / Bullets / Closing line" cluster with the expected placeholders).
  const panel=document.createElement('div');
  panel.id='diag-hiwc-panel';
  panel.style.cssText='position:fixed;left:0;top:0;width:600px;background:#fff;z-index:99999';
  panel.innerHTML=
    '<div>HOW I WOULD CONTRIBUTE</div>'+
    '<div>Intro line</div>'+
    '<div class="diag-row"><input id="diag-intro" style="width:400px" placeholder="Intro — one sentence framing your contribution"></div>'+
    '<div>Bullets</div>'+
    '<div class="diag-row"><textarea id="diag-bullets" style="width:400px;height:60px" placeholder="bullets"></textarea></div>'+
    '<div>Closing line</div>'+
    '<div class="diag-row"><textarea id="diag-closing" style="width:400px;height:40px" placeholder="Closing — one sentence summarising your contribution"></textarea></div>';
  document.body.appendChild(panel);
  const intro=panel.querySelector('#diag-intro');
  intro.value=(()=>{try{const all=JSON.parse(localStorage.getItem('sections')||'{}');const s=(all.cl||[]).find(x=>x&&x.id==='contribute');return s&&s.intro||'';}catch(_){return '';}})();

  // Bind via the sidecar's own run() (it binds input->syncSectionField).
  const api=window.AntcvHowContributeControls239;
  if(!api||typeof api.run!=='function') return {error:'no sidecar api'};
  api.run();
  await new Promise(r=>setTimeout(r,150));
  api.run();
  await new Promise(r=>setTimeout(r,150));
  if(!intro.__antcvHiwcInputBound) return {bound:false, fieldAttr:intro.getAttribute('data-antcv-hiwc-field')};

  // Install source-tagged counters.
  const counts={su:0,ipc:0};
  const onSu=e=>{ if((e.detail||{}).source==='how-contribute-controls') counts.su++; };
  const onIpc=e=>{ if((e.detail||{}).source==='how-contribute-controls') counts.ipc++; };
  window.addEventListener('antcv:sections-updated',onSu);
  window.addEventListener('antcv:item-pages-changed',onIpc);

  // Burst: each keystroke a DISTINCT growing value -> syncSectionField changed=true every time.
  const base=intro.value;
  let fired=0;
  for(let i=0;i<burst;i++){ intro.value=base+' '+'x'.repeat(i+1); intro.dispatchEvent(new Event('input',{bubbles:true})); fired++; await new Promise(r=>setTimeout(r,8)); }
  // Wait past the 180ms debounce so the trailing flush lands.
  await new Promise(r=>setTimeout(r,500));
  window.removeEventListener('antcv:sections-updated',onSu);
  window.removeEventListener('antcv:item-pages-changed',onIpc);

  // Confirm the final edit persisted (no data loss).
  let persisted=false;
  try{const all=JSON.parse(localStorage.getItem('sections')||'{}');const s=(all.cl||[]).find(x=>x&&x.id==='contribute');persisted=!!(s&&typeof s.intro==='string'&&s.intro.indexOf(base)===0&&s.intro.length>base.length);}catch(_){ }
  return {bound:true,burst,fired,counts,persisted};
},BURST);
await browser.close();await new Promise(r2=>server.close(r2));

console.log('result:', JSON.stringify(r));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
if(r.error){ console.log('CONTRIBUTE-EDIT-COALESCE INCONCLUSIVE —', r.error); process.exit(2); }
if(!r.bound){ console.log('CONTRIBUTE-EDIT-COALESCE INCONCLUSIVE — intro field not bound by sidecar run(); fieldAttr=', r.fieldAttr); process.exit(2); }
// Coalescing assertion: a burst of `burst` distinct-value keystrokes must produce
// far fewer source-tagged re-dispatches (debounced) but at least one trailing flush.
const ipcOk = r.counts.ipc>=1 && r.counts.ipc<=5;
const suOk  = r.counts.su>=1 && r.counts.su<=5;
const ok = ipcOk && suOk && r.persisted && errs.length===0;
console.log('keystrokes fired:', r.fired);
console.log('item-pages-changed flushes:', r.counts.ipc, '(expect 1-5 with fix, ~'+r.burst+' before fix)');
console.log('sections-updated  flushes:', r.counts.su,  '(expect 1-5 with fix, ~'+r.burst+' before fix)');
console.log('final edit persisted (no data loss):', r.persisted);
console.log(ok ? 'CONTRIBUTE-EDIT-COALESCE OK' : 'CONTRIBUTE-EDIT-COALESCE FAILED');
process.exit(ok?0:1);
