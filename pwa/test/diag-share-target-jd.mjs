/* DIAGNOSTIC — SHARE-TARGET-JD-URL-001 (1.50.375). Three checks:
 *   1. signed-in boot with ?shared_url=… → the JD URL input (controlled
 *      React input) carries the shared link, and the share params are
 *      stripped from the address bar;
 *   2. the URL is extracted from shared_text too (Android shares links as
 *      text), picking the FIRST http(s) token;
 *   3. our own origin in shared_url is rejected (no self-ingestion) and
 *      nothing is filled.
 */
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
const BASE = `http://127.0.0.1:${port}`;

const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Profile.' },
], cl: [] };

const JOB_URL = 'https://www.linkedin.com/jobs/view/4012345678/';

async function boot(query, { signedIn = true } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  await page.addInitScript(({secs, auth})=>{
    if (auth) {
      localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
      localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
      localStorage.setItem('step', JSON.stringify('editor'));
      localStorage.setItem('doc', JSON.stringify('cv'));
      localStorage.setItem('sections', JSON.stringify(secs));
      localStorage.setItem('personalInfo', JSON.stringify({ name:'Anita Tester' }));
    }
  }, { secs: sections, auth: signedIn });
  const errs = [];
  page.on('pageerror', e=>errs.push('pageerror: '+(e&&e.message)));
  await page.goto(`${BASE}/index.html${query}`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(6500);
  const r = await page.evaluate(()=>{
    const inputs = Array.from(document.querySelectorAll('input[type="url"]'));
    const jd = inputs.find(i=>/paste jd url/i.test(i.placeholder||''));
    return {
      hook: window.__antcvShareTargetJd || null,
      inputFound: !!jd,
      value: jd ? jd.value : null,
      search: location.search,
      stash: sessionStorage.getItem('antcv:sharedJdUrl:v1'),
    };
  });
  await browser.close();
  return { ...r, errs };
}

// 1 — signed-in, shared_url fills the field + address bar cleaned
const a = await boot(`?shared_url=${encodeURIComponent(JOB_URL)}&shared_title=Job`);
const aOk = a.inputFound && a.value === JOB_URL && !/shared_url/.test(a.search) && a.hook && a.hook.applied;
console.log(`shared_url fills JD input + bar cleaned: ${aOk?'OK':'FAIL'} ${aOk?'':JSON.stringify(a)}`);

// 2 — URL inside shared_text (Android pattern), first http token wins
const b = await boot(`?shared_text=${encodeURIComponent('Look at this role! ' + JOB_URL + ' via LinkedIn')}`);
const bOk = b.inputFound && b.value === JOB_URL;
console.log(`shared_text URL extraction: ${bOk?'OK':'FAIL'} ${bOk?'':JSON.stringify(b)}`);

// 3 — own-origin URL rejected: nothing captured, nothing stashed, and the
// step is NOT hijacked to the intake (the editor stays up → no JD input).
const c = await boot(`?shared_url=${encodeURIComponent(BASE + '/index.html')}`);
const cOk = !(c.hook && (c.hook.url || c.hook.applied)) && !c.stash && !c.inputFound;
console.log(`own-origin rejected: ${cOk?'OK':'FAIL'} ${cOk?'':JSON.stringify(c)}`);

await new Promise(r=>server.close(r));
const allErrs = [...a.errs, ...b.errs, ...c.errs];
console.log('app errors:', allErrs.length, allErrs.slice(0,2).join(' | '));
const ok = aOk && bOk && cOk && allErrs.length === 0;
console.log(ok ? 'SHARE-TARGET-JD OK' : 'SHARE-TARGET-JD FAILED');
process.exit(ok ? 0 : 1);
