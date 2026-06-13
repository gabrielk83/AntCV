/* DIAGNOSTIC — LEAK-FIX (cloud restore replaces, never merges).
 * Seeds a PARTIAL "Gabriel" local personalInfo + a substantive "Anita" cloud
 * personalInfo at GET /api/prefs, runs the restore, and asserts the result is
 * Anita WHOLESALE — proving the old field-by-field fillMissing bleed is gone:
 *   - name becomes 'Anita' (cloud wins; merge would have kept local 'Gabriel'),
 *   - a Gabriel-ONLY field absent from the cloud is DROPPED (merge would keep it),
 *   - a cloud-only field is present.
 * Also asserts a SPARSE cloud still falls back to the gentle fill (no wipe).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };

let PREFS = { personalInfo: {} };
const server = http.createServer(async (req,res)=>{
  const url = (req.url||'').split('?')[0];
  if (req.method==='GET' && url==='/api/prefs') {
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});
    res.end(JSON.stringify(PREFS)); return;
  }
  try{ let rel=decodeURIComponent(url); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const GABRIEL_LOCAL = { name:'Gabriel', headline:'Process · Products · People', gabrielOnly:'KEEP-ONLY-IF-MERGED' };
const ANITA_CLOUD   = { name:'Anita',   headline:'Logistics',                  specialization:'Seasonal Operations' };

const browser=await chromium.launch();
const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

async function run(localPi, cloudPi) {
  PREFS = { personalInfo: cloudPi };
  const page=await browser.newPage();
  await page.addInitScript(({b, lp})=>{
    localStorage.setItem('antcv:auth:token','t');
    localStorage.setItem('proxyUrl', b);
    localStorage.setItem('personalInfo', JSON.stringify(lp));
  }, { b: base, lp: localPi });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(base + '/index.html', {waitUntil:'load',timeout:30000});
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async ()=>{
    const api = window.AntcvPersonalInfoCloudRestore282;
    if (!api) return { err:'no-api' };
    api._clearSession();
    await api.restore('test');
    await new Promise(r=>setTimeout(r,300));
    let pi=null; try{ pi=JSON.parse(localStorage.getItem('personalInfo')); }catch(_){}
    return { pi, ver: api.version };
  });
  await page.close();
  return { ...out, errs };
}

// 1. substantive cloud → wholesale replace (no merge)
const a = await run(GABRIEL_LOCAL, ANITA_CLOUD);
check('0. no-merge sidecar loaded (version)', a.ver==='1.50.432-no-merge', JSON.stringify(a.ver));
check('1. substantive cloud REPLACES wholesale (name=Anita, gabrielOnly DROPPED, cloud field present)',
  a.pi && a.pi.name==='Anita' && a.pi.gabrielOnly===undefined && a.pi.specialization==='Seasonal Operations' && a.errs.length===0,
  JSON.stringify(a.pi));

// 2. sparse cloud → gentle fill (does NOT wipe a fuller local)
const sparse = { headline:'x' }; // 1 key, no name → not substantive
const b = await run(GABRIEL_LOCAL, sparse);
check('2. sparse cloud falls back to fill (keeps local name + gabrielOnly)',
  b.pi && b.pi.name==='Gabriel' && b.pi.gabrielOnly==='KEEP-ONLY-IF-MERGED' && b.errs.length===0,
  JSON.stringify(b.pi));

await browser.close(); await new Promise(r=>server.close(r));
const ok=checks.every(Boolean);
console.log(ok?'CLOUD-RESTORE-NO-MERGE OK':'CLOUD-RESTORE-NO-MERGE FAIL');
process.exit(ok?0:1);
