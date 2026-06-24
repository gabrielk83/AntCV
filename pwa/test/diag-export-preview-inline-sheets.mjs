/* DIAGNOSTIC — EXPORT-PREVIEW-PRINT-SETUP-REFRESH-001. Boots the full app past
 * the sign-in gate into the editor (a CV paper renders), waits for the gate's
 * prefetchSheetText() to warm the same-origin stylesheet cache, opens the export
 * modal, and asserts the iframe srcdoc INLINES the same-origin package CSS
 * instead of carrying it as a render-blocking external <link rel=stylesheet>.
 *
 * Root cause: those <link>s gate the iframe's first paint (and fitWidth), so on a
 * cold load the modal showed the blank "print setup" shell until a manual refresh
 * warmed the CSS cache. Inlining the sheet text lets the iframe paint immediately.
 *
 * PASS = (A) with the fix: zero same-origin <link rel=stylesheet> inside the
 * iframe + >=1 inlined-sheet <style> + the paper fit gets applied (not blank).
 *        (B) negative control: with the kill switch set, the same-origin <link>
 * remains (proves the inlining path is what changed). */
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
const sections={cl:[],cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'IT professional with fifteen years across regulated markets.'},
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {id:'r1',title:'Product Expert',company:'Kanzen',years:'2022-2026',bullets:['Built KPI structures linking delivery to analytics.']}
  ]},
  {id:'tools',title:'TOOLS & METHODS',loc:'sidebar',on:true,type:'labeled_list',items:[{l:'Software',v:'Jira, SQL, Python'}]},
]};

async function run(killSwitch){
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.addInitScript((args)=>{
    const [secs,kill]=args;
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(secs));localStorage.setItem('personalInfo',JSON.stringify({name:'Gabriel Test'}));
    localStorage.setItem('antcv:autoPages','{}');localStorage.setItem('antcv:itemPages','{}');
    if(kill) localStorage.setItem('antcv:disable-sheet-inline','1');
  },[sections,killSwitch]);
  const errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/CORS|workers\.dev|Failed to load|net::ERR/i.test(t))errs.push(t);}});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000); // editor settle + prefetchSheetText warms cache

  const r=await page.evaluate(async()=>{
    const out={origin:location.origin};
    const fab=document.getElementById('antcv-pdf-preview-fab');
    out.fab=!!fab;
    if(!fab) return out;
    fab.click();
    await new Promise(r=>setTimeout(r,400));
    const ifr=document.getElementById('antcv-pdf-preview-modal-iframe');
    out.iframe=!!ifr;
    if(!ifr) return out;
    // count same-origin <link rel=stylesheet> the PAGE has (the candidates for inlining)
    out.pageSameOriginLinks=Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(l=>l.href.indexOf(location.origin)===0).length;
    const srcdoc=ifr.getAttribute('srcdoc')||'';
    out.inlinedStyleCount=(srcdoc.match(/data-antcv-inlined-sheet/g)||[]).length;
    // parse the iframe doc for residual same-origin render-blocking links
    const d=ifr.contentDocument;
    out.idocLinks = d? Array.from(d.querySelectorAll('link[rel="stylesheet"]')).map(l=>l.href.indexOf(location.origin)===0?'same':'cross') : null;
    out.idocSameOriginLinks = out.idocLinks? out.idocLinks.filter(x=>x==='same').length : -1;
    // give fitWidth a moment, then read whether the page got a fit (not blank)
    await new Promise(r=>setTimeout(r,1200));
    const d2=ifr.contentDocument; const b=d2&&d2.body;
    out.idocPaper = d2? d2.querySelectorAll('.antcv-preview-paper').length : -1;
    out.fitApplied = b? (getComputedStyle(b).getPropertyValue('--antcv-fit')||'').trim() : '';
    return out;
  });
  await browser.close();
  return {r,errs};
}

console.log('=== A: with fix (inline enabled) ===');
const A=await run(false);
console.log(JSON.stringify(A.r));
console.log('errors:',A.errs.length, A.errs.slice(0,3).join(' | '));

console.log('=== B: negative control (kill switch -> fallback to <link>) ===');
const B=await run(true);
console.log(JSON.stringify(B.r));

await new Promise(r2=>server.close(r2));

const aOk = A.r.fab && A.r.iframe && A.r.pageSameOriginLinks>=1 &&
            A.r.inlinedStyleCount>=1 && A.r.idocSameOriginLinks===0 &&
            A.r.idocPaper>=1 && A.r.fitApplied!=='' && A.errs.length===0;
const bOk = B.r.iframe && B.r.idocSameOriginLinks>=1 && B.r.inlinedStyleCount===0;
console.log('A (inlined, no same-origin <link>, paper fit applied):', aOk);
console.log('B (kill switch keeps same-origin <link>):', bOk);
const ok = aOk && bOk;
console.log(ok ? 'EXPORT-PREVIEW-INLINE-SHEETS OK' : 'EXPORT-PREVIEW-INLINE-SHEETS FAILED');
process.exit(ok?0:1);
