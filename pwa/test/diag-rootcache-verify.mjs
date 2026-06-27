/* DIAGNOSTIC (read-only) — verifies the BOOT-*-ROOTCACHE-001 cross-run root cache
 * in 274 (panelRoot) + 249 (editorRoot) still resolves the SAME editor root and
 * mounts its row controls past the sign-in gate, with no console errors. The cache
 * is exercised by running each sidecar TWICE: the 2nd run must return the same root
 * (consistent findRows length) via the cheap revalidation path, not a re-scan.
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
  { id:'wib', title:'WHAT I BRING', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['Leadership','Led teams'],['Delivery','Shipped'],['Quality','Tested']] },
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
  const ran = {};
  for (const [k,fn] of [['core274',window.AntcvCoreWibStrictRowLayout274],['wib249',window.AntcvWhatIBringHeaderCjlr249]]) {
    try { fn && typeof fn.run==='function' && fn.run(); ran[k]='ok'; } catch(e){ ran[k]='THREW: '+(e&&e.message); }
  }

  // Build a synthetic WHAT I BRING editor block so the resolvers have a real root to
  // find (the headless preview doesn't mount the inline section editors). This lets
  // us PROVE the cross-run cache short-circuits the full-document scan on the 2nd call.
  const host = document.createElement('div'); host.id='synthetic-wib';
  host.innerHTML =
    '<h3>WHAT I BRING</h3>'
    + '<div class="rc-meta">Focus Area Strategic Expertise + Row</div>'
    + '<div class="rc-row"><input placeholder="Focus Area"><input placeholder="Strategic Expertise"></div>'
    + '<div class="rc-row"><input placeholder="Focus Area"><input placeholder="Strategic Expertise"></div>';
  // Prepend so the synthetic focus-area inputs are FIRST in document order (editorRoot
  // seeds on seeds[0]); otherwise any pre-existing app field wins the seed.
  document.body.insertBefore(host, document.body.firstChild);

  // Instrument document.querySelectorAll to count the two expensive full-document
  // scans the resolvers do: the seed scan (input,textarea,[contenteditable]) used by
  // 249.editorRoot, and the head scan (h1,h2,h3,...) used by 274.panelRoot.
  const realQSA = document.querySelectorAll.bind(document);
  let seedScans=0, headScans=0;
  document.querySelectorAll = function(sel){
    if(sel && /^input,textarea/.test(sel)) seedScans++;
    if(sel && /h1,h2,h3/.test(sel)) headScans++;
    return realQSA(sel);
  };

  const f = window.AntcvWhatIBringHeaderCjlr249 && window.AntcvWhatIBringHeaderCjlr249.findRows;
  const run274 = window.AntcvCoreWibStrictRowLayout274 && window.AntcvCoreWibStrictRowLayout274.run;

  // 249: call findRows twice; record the document-level seed-scan delta of each.
  let rows1=-1, rows2=-1, seed1=0, seed2=0;
  if(f){ const s0=seedScans; rows1=f().length; seed1=seedScans-s0; const s1=seedScans; rows2=f().length; seed2=seedScans-s1; }
  // 274: call run twice; record the document-level head-scan delta of each.
  let head1=0, head2=0;
  if(run274){ const h0=headScans; run274(); head1=headScans-h0; const h1=headScans; run274(); head2=headScans-h1; }

  document.querySelectorAll = realQSA;
  return {
    editorRendered: /Strategic Expertise|Focus Area|TOOLS|REGULATORY|CORE COMPETENCIES|WHAT I BRING/i.test(document.body.innerText||''),
    globals: { core274:g('AntcvCoreWibStrictRowLayout274'), wib249:g('AntcvWhatIBringHeaderCjlr249') },
    ran,
    rows1, rows2, seed1, seed2,
    head1, head2,
    bodyLen: (document.body.innerText||'').length,
  };
});
await browser.close(); await new Promise(rr=>server.close(rr));

const sidecarErrors = errors.filter(e=>/core-wib-strict-row-layout-274|what-i-bring-header-cjlr-249/.test(e));
console.log('editorRendered:', probe.editorRendered, '| bodyLen:', probe.bodyLen);
console.log('globals present:', JSON.stringify(probe.globals));
console.log('direct run():', JSON.stringify(probe.ran));
console.log('249 findRows() rows:', probe.rows1, '->', probe.rows2, '(consistent:', (probe.rows1===probe.rows2)+')',
            '| doc seed-scans:', probe.seed1, '->', probe.seed2, '(2nd cached:', (probe.seed2===0)+')');
console.log('274 run() doc head-scans:', probe.head1, '->', probe.head2, '(2nd cached:', (probe.head2===0)+')');
console.log('sidecar console errors:', sidecarErrors.length, sidecarErrors.slice(0,5));
console.log('total console errors during boot:', errors.length);

const ok = probe.editorRendered
  && probe.globals.core274 && probe.globals.wib249
  && probe.ran.core274==='ok' && probe.ran.wib249==='ok'
  && probe.rows1>0 && probe.rows1===probe.rows2 // a real root resolved + consistent across calls
  && probe.seed1>0 && probe.seed2===0          // 1st call scanned the document, 2nd hit the cache
  && probe.head1>0 && probe.head2===0          // same for 274 panelRoot
  && sidecarErrors.length===0;
console.log(ok ? '\nPASS — both root caches resolve a real root, then short-circuit the full-document scan' : '\nFAIL — see above');
process.exit(ok ? 0 : 1);
