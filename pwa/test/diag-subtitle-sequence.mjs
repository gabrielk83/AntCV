/* DIAGNOSTIC — PREVIEW-SUBTITLE-RACE-001. Confirms antcv-subtitle-sequence-368.js
 * is wired + working: with meta.subtitle holding the TEMPLATE placeholder and a
 * local applications cache carrying the REAL subtitle, the sidecar must commit
 * the resolved value into meta.subtitle on boot (so the first preview paint is
 * correct without an app switch). */
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
const REAL='Optics & Photonics Regulatory Specialist';
const PLACEHOLDER='[Specialisation — 1-3 focus areas]';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.addInitScript(([real, ph])=>{
  localStorage.setItem('meta', JSON.stringify({ subtitle: ph, company:'', role:'' }));
  localStorage.setItem('antcv:applications', JSON.stringify([{ id:'a1', subtitle: real, company:'' }]));
  localStorage.setItem('doc', JSON.stringify('cv'));
}, [REAL, PLACEHOLDER]);
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3000);
const r = await page.evaluate(()=>{
  let meta={}; try{ meta=JSON.parse(localStorage.getItem('meta')||'{}'); }catch(_){}
  const api = window.AntcvSubtitleSequence368 || null;
  return { installed: api ? api.version : null, subtitle: meta.subtitle || '',
           isResolvedFn: api ? api._isResolved('[Specialisation — x]') : null,
           localCache: api ? api._fromLocalAppCache() : null };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('sidecar installed:', r.installed);
console.log('meta.subtitle now :', JSON.stringify(r.subtitle));
console.log('local-cache resolve:', JSON.stringify(r.localCache));
console.log('placeholder flagged not-resolved:', r.isResolvedFn === false);
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
const A = !!r.installed;
const B = r.subtitle === REAL;
const C = r.isResolvedFn === false;
console.log(`CHECK A (sidecar installed): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (placeholder replaced with real subtitle on boot): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (placeholder correctly detected): ${C?'PASS':'FAIL'}`);
console.log(A&&B&&C&&errs.length===0 ? 'SUBTITLE-SEQUENCE OK' : 'SUBTITLE-SEQUENCE FAIL');
process.exit(A&&B&&C ? 0 : 1);
