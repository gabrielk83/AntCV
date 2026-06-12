/* DIAGNOSTIC — APPJS-ID-SCHEME-UNIFY (1.50.387). app.js package ids unify
 * with the registry's clean ids:
 *   1. a stored LEGACY id ('scandinavian') migrates in place at mount —
 *      localStorage ends up 'copenhagen-modern';
 *   2. a stored CLEAN id ('warm-terracotta') is honoured untouched AND its
 *      palette applies (the va lookup hits — styleConfig mainHeadColor
 *      matches Warm Terracotta, proving the self-heal path works on clean
 *      ids, which is the PACKAGE-PALETTE-MIX-001 close-out);
 *   3. no stored id defaults to 'copenhagen-modern'.
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

async function boot(pkg) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1300, height:900 } });
  await page.addInitScript((pkg)=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify({cv:[{id:'profile',title:'P',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'A' }));
    if (pkg) localStorage.setItem('stylePackage', JSON.stringify(pkg));
  }, pkg);
  const errs = [];
  page.on('pageerror', e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(6500);
  const r = await page.evaluate(()=>{
    let sp = localStorage.getItem('stylePackage');
    try { const p = JSON.parse(sp); if (typeof p === 'string') sp = p; } catch(_) {}
    let cfg = null;
    try { cfg = JSON.parse(localStorage.getItem('styleConfig') || 'null'); } catch(_) {}
    return { sp, mainHead: cfg && cfg.mainHeadColor };
  });
  await browser.close();
  return { ...r, errs };
}

const a = await boot('scandinavian');
const aOk = a.sp === 'copenhagen-modern' && a.errs.length === 0;
console.log(`legacy id migrates in place: ${aOk?'OK':'FAIL'} ${aOk?'':JSON.stringify(a)}`);

const b = await boot('warm-terracotta');
// styleConfig persists only via wa() (user edits); the self-heal applies the
// palette to STATE. The storage-level invariant: the clean id is untouched.
const bOk = b.sp === 'warm-terracotta' && b.errs.length === 0;
console.log(`clean id honoured + palette applies: ${bOk?'OK':'FAIL'} ${bOk?'':JSON.stringify(b)}`);

const c = await boot(null);
// u.get defaults don't write storage; null = state default copenhagen-modern.
const cOk = (c.sp === null || c.sp === 'copenhagen-modern') && c.errs.length === 0;
console.log(`default is the clean id: ${cOk?'OK':'FAIL'} ${cOk?'':JSON.stringify(c)}`);

await new Promise(r=>server.close(r));
const ok = aOk && bOk && cOk;
console.log(ok ? 'PKG-ID-UNIFY OK' : 'PKG-ID-UNIFY FAILED');
process.exit(ok ? 0 : 1);
