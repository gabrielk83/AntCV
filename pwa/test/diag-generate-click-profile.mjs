/* DIAGNOSTIC — PERF-001 remaining leg. The owner's console reported
 * "'setTimeout' handler took ~3270ms" pointing at antcv-generate-cloud-sync-277.js.
 * Reading that callback shows five lines of DOM work plus a SYNCHRONOUS
 * btn.dispatchEvent(...) — so the 3.27s belongs to whatever runs inside that
 * dispatch, not to the sidecar. This harness settles it by measurement instead
 * of inference: boot an owner-scale doc (photo data URI included, the suspected
 * JSON cost), block the network so nothing waits on a relay, click Generate for
 * real, and capture a V8 CPU profile of that click alone.
 *
 * Reports, in order: the sidecar's own long-task cost (its JSON round-trips),
 * the longtask durations the browser attributes to the click, and self-time
 * ranked by function and by file. Run: node pwa/test/diag-generate-click-profile.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

// ── Owner-scale seed (same shape as diag-boot-cpu-profile, plus a photo) ──
const roles = Array.from({length:12},(_,i)=>({ id:'r'+i, title:'Role '+i, company:'Company '+i, dateRange:'20'+(10+i)+'-20'+(11+i), bullets:['Did important work number '+i+' with measurable outcomes across teams.','Second bullet for role '+i+'.'] }));
const tools = Array.from({length:17},(_,i)=>({ l:'Tool '+i, v:'Detail value for tool '+i }));
const regulatory = Array.from({length:31},(_,i)=> i%5===0 ? { group:'Group '+i } : { l:'Std '+i, v:'Compliance detail '+i });
const cv = [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Operations specialist with deep experience.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'Methodical, calm under pressure.' },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items:[{b:'Reduced',t:'spoilage 30%'},{b:'Built',t:'a plan'}] },
  { id:'core_comp', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['A','b'],['C','d'],['E','f']] },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:['[Publication, patent, or conference paper]'] },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items: tools },
  { id:'certs', title:'CERTIFICATIONS', loc:'sidebar', on:true, type:'list', items:['Cert A','Cert B','Cert C'] },
  { id:'education', title:'EDUCATION', loc:'sidebar', on:true, type:'education', items:[{deg:'MSc',sch:'Uni, 2014'}] },
  { id:'regulatory', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: regulatory },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' } ];
// A realistic photo payload — the register named this as the unconfirmed suspect
// behind the sidecar's JSON.stringify cost. ~180KB of base64, phone-camera scale.
const photo = 'data:image/jpeg;base64,' + 'A'.repeat(180 * 1024);
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH',
  photo, stylePrefs:{ style:'nordic-minimal' }, tools, regulatory,
  certifications:['Cert A','Cert B','Cert C'], additional:[{l:'English',v:'native'}] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });

// Block the relay/LLM network so nothing in the profile is network wait — but
// let the CDN vendor bundles (React, pdf.js, mammoth, jszip) through, or the
// app never boots and there is no Generate button to click.
const CDN = /^https:\/\/(unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;
await page.route('**/*', (route) => {
  const u = route.request().url();
  if (u.startsWith(`http://127.0.0.1:${port}/`) || CDN.test(u)) return route.continue();
  return route.abort();
});

await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com');
  localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('doc', JSON.stringify('cv'));
  // The Generate button renders disabled ("Connect an API to generate") without
  // a key, and locked without a JD — both are gates on the click we profile.
  localStorage.setItem('apiKey', JSON.stringify('sk-ant-test-000'));
  localStorage.setItem('jdText', JSON.stringify('We seek an operations engineer to run optical assembly lines, own supplier qualification, and drive yield. Requirements: 5+ years, metrology, Six Sigma, cross-functional leadership, and fluent English.'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('meta', JSON.stringify({ company:'Acme', role:'Engineer' }));
  // Record every long task the browser attributes to the click window.
  window.__longTasks = [];
  try {
    new PerformanceObserver((l)=>{ for (const e of l.getEntries()) window.__longTasks.push({ name:e.name, dur:Math.round(e.duration), start:Math.round(e.startTime) }); })
      .observe({ entryTypes:['longtask'] });
  } catch (_) {}
}, [{cv,cl}, personalInfo]);

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message)));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);   // let boot + first render settle

// ── Isolate the sidecar's OWN cost first (its JSON round-trips) ──
const sidecar = await page.evaluate(async () => {
  const S = window.AntcvGenerateCloudSync277;
  if (!S) return { present:false };
  const t0 = performance.now();
  let r = null;
  try { r = await S.syncBothWays(); } catch (e) { r = { ok:false, reason:String(e && e.message) }; }
  return { present:true, ms: Math.round(performance.now() - t0), reason: (r && r.reason) || (r && r.ok ? 'ok' : 'unknown') };
});

const btn = await page.evaluate(() => {
  const re = /generate/i;
  const all = Array.from(document.querySelectorAll('button,[role=button]'));
  const hit = all.filter(b => !b.disabled && re.test((b.textContent||'').trim()) && (b.textContent||'').trim().length <= 80);
  return { count: hit.length, texts: hit.slice(0,4).map(b => (b.textContent||'').trim().slice(0,60)) };
});

let profile = null, clickMs = 0, longTasks = [];
if (btn.count > 0) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await page.evaluate(() => { window.__longTasks.length = 0; });
  await cdp.send('Profiler.start');
  clickMs = await page.evaluate(() => {
    const re = /generate/i;
    const b = Array.from(document.querySelectorAll('button,[role=button]'))
      .find(x => !x.disabled && re.test((x.textContent||'').trim()) && (x.textContent||'').trim().length <= 80);
    const t0 = performance.now();
    b.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
    return Math.round(performance.now() - t0);   // synchronous span of the click only
  });
  await page.waitForTimeout(12000);              // let the gated re-dispatch land
  ({ profile } = await cdp.send('Profiler.stop'));
  longTasks = await page.evaluate(() => window.__longTasks.slice().sort((a,b)=>b.dur-a.dur).slice(0,8));
}

await browser.close();
await new Promise(rr=>server.close(rr));

console.log('generate buttons found:', btn.count, btn.texts);
console.log('sidecar syncBothWays (its own JSON + blocked fetch):', sidecar.present ? sidecar.ms + 'ms  reason=' + sidecar.reason : 'NOT INSTALLED');
console.log('synchronous span of the dispatched click:', clickMs + 'ms');
console.log('longest long-tasks in the click window:', JSON.stringify(longTasks));
console.log('page errors:', pageErrors.length, pageErrors.slice(0,3));

if (!profile) { console.log('\nNO PROFILE — no enabled Generate button on this seed.'); process.exit(0); }

const nodesById = new Map(); for (const n of profile.nodes) nodesById.set(n.id, n);
const selfByNode = new Map();
const dt = profile.timeDeltas, samples = profile.samples;
for (let i=0;i<samples.length;i++){ const id=samples[i]; selfByNode.set(id,(selfByNode.get(id)||0)+(dt[i]||0)); }
const idle = [...selfByNode.entries()].filter(([id])=>{ const cf=(nodesById.get(id)||{}).callFrame||{}; return cf.functionName==='(idle)'||cf.functionName==='(program)'; }).reduce((a,[,us])=>a+us,0);
const byFn = new Map(), byUrl = new Map();
for (const [id, us] of selfByNode){
  const n=nodesById.get(id); if(!n)continue; const cf=n.callFrame||{};
  if (cf.functionName==='(idle)'||cf.functionName==='(program)') continue;
  const url=(cf.url||'').split('/').pop()||'(native)';
  const k=(cf.functionName||'(anonymous)')+'  @'+url+(cf.lineNumber>=0?':'+(cf.lineNumber+1):'');
  byFn.set(k,(byFn.get(k)||0)+us);
  byUrl.set(url,(byUrl.get(url)||0)+us);
}
const busy = [...byFn.values()].reduce((a,b)=>a+b,0);
console.log('\nsampled BUSY self time:', Math.round(busy/1000), 'ms   (idle/program:', Math.round(idle/1000), 'ms )');
console.log('TOP self-time functions:');
for (const [k,us] of [...byFn.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20))
  console.log('  '+String(Math.round(us/1000)).padStart(6)+'ms  '+String(Math.round(100*us/busy)).padStart(3)+'%  '+k);
console.log('\nTOP self-time by FILE:');
for (const [k,us] of [...byUrl.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12))
  console.log('  '+String(Math.round(us/1000)).padStart(6)+'ms  '+String(Math.round(100*us/busy)).padStart(3)+'%  '+k);
