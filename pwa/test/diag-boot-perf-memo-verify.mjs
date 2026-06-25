/* DIAGNOSTIC (read-only) — verifies the BOOT-*-PERF-001 memo refactor of the three
 * row-control sidecars (274 core/wib, 237 selected-outcomes, 248 embedded-controls)
 * still EXECUTES cleanly past the sign-in gate: editor renders, the three sidecars
 * loaded + exposed their run(), and NONE threw a console error during boot.
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
const regulatory = Array.from({length:31},(_,i)=> i%5===0 ? { group:'Group '+i } : { l:'Std '+i, v:'Compliance detail '+i });
const cv = [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Operations specialist with deep experience.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'Methodical, calm under pressure.' },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items:[{b:'[verb]',t:'spoilage 30%'},{b:'[verb]',t:'a plan'}] },
  { id:'core_comp', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['A','b'],['C','d'],['E','f']] },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items: tools },
  { id:'regulatory', title:'REGULATORY CONTEXT', loc:'sidebar', on:true, type:'labeled_list', items: regulatory },
  { id:'additional', title:'ADDITIONAL INFORMATION', loc:'sidebar', on:true, type:'labeled_list', items:[{l:'Languages'},{l:'English',v:'native'},{l:'Interests',v:'hiking, chess'}] },
];
const cl = [ { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' } ];
const personalInfo = { name:'Gabriel', headline:'Operations Specialist', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' }, tools, regulatory };

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
  // force a direct run of each to confirm none throws on the live editor DOM
  const ran = {};
  for (const [k,fn] of [['core274',window.AntcvCoreWibStrictRowLayout274],['outcomes237',window.AntcvSelectedOutcomesRowControls237],['embed248',window.AntcvEmbeddedControlsGuard248]]) {
    try { fn && typeof fn.run==='function' && fn.run(); ran[k]='ok'; } catch(e){ ran[k]='THREW: '+(e&&e.message); }
  }
  return {
    editorRendered: /Strategic Expertise|Focus Area|TOOLS|REGULATORY|CORE COMPETENCIES/i.test(document.body.innerText||''),
    globals: { core274:g('AntcvCoreWibStrictRowLayout274'), outcomes237:g('AntcvSelectedOutcomesRowControls237'), embed248:g('AntcvEmbeddedControlsGuard248') },
    ran,
    bodyLen: (document.body.innerText||'').length,
  };
});
await browser.close(); await new Promise(rr=>server.close(rr));

const sidecarErrors = errors.filter(e=>/core-wib-strict-row-layout-274|selected-outcomes-row-controls-237|embedded-controls-248/.test(e));
console.log('editorRendered:', probe.editorRendered, '| bodyLen:', probe.bodyLen);
console.log('globals present:', JSON.stringify(probe.globals));
console.log('direct run():', JSON.stringify(probe.ran));
console.log('sidecar console errors:', sidecarErrors.length, sidecarErrors.slice(0,5));
console.log('total console errors during boot:', errors.length);

const ok = probe.editorRendered
  && probe.globals.core274 && probe.globals.outcomes237 && probe.globals.embed248
  && probe.ran.core274==='ok' && probe.ran.outcomes237==='ok' && probe.ran.embed248==='ok'
  && sidecarErrors.length===0;
console.log(ok ? '\nPASS — all three memo-refactored sidecars boot + run clean past the gate' : '\nFAIL — see above');
process.exit(ok ? 0 : 1);
