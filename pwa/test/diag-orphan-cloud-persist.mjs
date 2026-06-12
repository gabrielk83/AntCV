/* DIAGNOSTIC — DATA-PORTABILITY-CLOUD (1.50.385). The orphan-cloud-persist
 * sidecar pushes corrected stylePackage/toneRegister to PUT /api/prefs:
 *   1. with clean values + token + relay set, ONE PUT carrying both keys
 *      fires (intercepted), and the marker records them;
 *   2. a second pass with unchanged values does NOT re-PUT;
 *   3. the known-orphan value 'scandinavian' is never pushed.
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

async function boot({ tone, pkg }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1200, height:900 } });
  await page.addInitScript(({tone, pkg})=>{
    window.__antcvPrefsPuts = [];
    const of = window.fetch;
    window.fetch = function (url, opts) {
      try {
        if (String(url).includes('/api/prefs') && opts && opts.method === 'PUT') {
          window.__antcvPrefsPuts.push(JSON.parse(opts.body));
          return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
        }
      } catch (_) {}
      return of.apply(this, arguments);
    };
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify({cv:[{id:'profile',title:'P',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'A' }));
    localStorage.setItem('proxyUrl', JSON.stringify('https://relay.example.workers.dev'));
    if (tone) localStorage.setItem('toneRegister', JSON.stringify(tone));
    if (pkg) localStorage.setItem('stylePackage', JSON.stringify(pkg));
  }, { tone, pkg });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(7500);
  const r = await page.evaluate(async ()=>{
    const first = window.__antcvPrefsPuts.slice();
    // second pass with unchanged values — bypass the 60s throttle via forced
    window.AntcvOrphanCloudPersist.push();
    await new Promise(r2=>setTimeout(r2,800));
    return { puts: window.__antcvPrefsPuts, firstCount: first.length, marker: localStorage.getItem('antcv:orphanSync:v1') };
  });
  await browser.close();
  return r;
}

const a = await boot({ tone: 'nordic-minimal', pkg: 'copenhagen-modern' });
const orphanKeysOnly = (p) => p && Object.keys(p).every(k => k === 'stylePackage' || k === 'toneRegister');
const aPut = a.puts.find(p => p.toneRegister === 'nordic-minimal' && p.stylePackage === 'copenhagen-modern' && orphanKeysOnly(p));
const aOk = !!aPut && a.puts.filter(orphanKeysOnly).length === 1 && (a.marker||'').includes('nordic-minimal');
console.log(`clean values push once + marker: ${aOk?'OK':'FAIL'} ${aOk?'':JSON.stringify(a)}`);

// seeding ORPHANS end-to-end: the login-loading-gate migrates toneRegister
// to 'nordic-minimal' during boot, and THIS sidecar then pushes the
// CORRECTED value — the literal orphan must never reach the cloud.
const b = await boot({ tone: 'scandinavian', pkg: 'scandinavian' });
const bOrphanPushed = b.puts.some(p => p.toneRegister === 'scandinavian' || p.stylePackage === 'scandinavian');
const bMigratedPushed = b.puts.some(p => p.toneRegister === 'nordic-minimal');
const bOk = !bOrphanPushed && bMigratedPushed;
console.log(`orphan never pushed; migrated value persisted: ${bOk?'OK':'FAIL'} ${bOk?'':JSON.stringify(b.puts)}`);

await new Promise(r=>server.close(r));
const ok = aOk && bOk;
console.log(ok ? 'ORPHAN-CLOUD-PERSIST OK' : 'ORPHAN-CLOUD-PERSIST FAILED');
process.exit(ok ? 0 : 1);
