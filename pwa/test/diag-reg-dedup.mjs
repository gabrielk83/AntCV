/* DIAGNOSTIC — REG-DEDUP-001 (owner 2026-06-18). A kernel upload must DEDUPE the
 * grouped regulatory section by CODE, not append near-dup standards (ASPICE×2,
 * ISO 26262×2, MIL-STD-810G×3). Drives the real window.AntCVImporter.mergePath. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port=server.address().port, base=`http://127.0.0.1:${port}`;
const browser=await chromium.launch();
const page=await browser.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
});
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>window.AntCVImporter && typeof window.AntCVImporter.mergePath==='function',{timeout:15000});
const r = await page.evaluate(()=>{
  const M = window.AntCVImporter.mergePath;
  // EXISTING (live, already duplicated): two near-identical group taxonomies +
  // ASPICE×2, ISO 26262×2, MIL-STD-810G×3, some grouped items eye-off (hidden).
  const existing = [
    { group: 'Systems, Safety and Cybersecurity' },
    { l: 'ASPICE', v: 'Automotive SPICE process assessment', hidden: true },
    { l: 'ISO 26262', v: 'Functional safety for road vehicles' },
    { l: 'MIL-STD-810G', v: 'Environmental engineering considerations' },
    { group: 'Systems, safety & cybersec' },
    { l: 'aspice', v: 'ASPICE capability levels' },           // dup code, reworded v, lowercased
    { l: 'ISO 26262', v: 'ASIL decomposition' },              // dup code
    { group: 'Environmental' },
    { l: 'MIL-STD-810G', v: 'Method 514 vibration' },         // dup code
    { l: 'MIL-STD-810G', v: 'Method 501 high temperature' },  // dup code (×3 total)
  ];
  // INCOMING (clean kernel re-upload): one canonical set.
  const incoming = [
    { group: 'Systems, Safety and Cybersecurity' },
    { l: 'ASPICE', v: 'Automotive SPICE' },
    { l: 'ISO 26262', v: 'Functional safety' },
    { group: 'Environmental' },
    { l: 'MIL-STD-810G', v: 'Environmental test methods' },
  ];
  // combine + per-key write (mergePath runs twice in the real flow).
  let merged = M(existing, incoming, 'personalInfo.regulatory');
  merged = M(merged, incoming, 'personalInfo.regulatory');
  const items = merged.filter(x=>x && x.l != null);
  const codeCount = {};
  items.forEach(it=>{ const k=String(it.l).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); codeCount[k]=(codeCount[k]||0)+1; });
  return { codeCount, anyHidden: items.some(it=>it.hidden===true||it.on===false), items: items.map(it=>it.l) };
});
// CLOUD-LOAD-ITEMS-001: importing a small bannedContextual set must UNION, not replace.
const r2 = await page.evaluate(()=>{
  const M = window.AntCVImporter.mergePath;
  const existing = [ { avoid:'utilize', prefer:'use' }, { avoid:'leverage', prefer:'use' }, { avoid:'synergy', prefer:'teamwork' } ];
  const smallImport = [ { avoid:'utilize', prefer:'use' } ]; // subset — must NOT wipe the rest
  const merged = M(existing, smallImport, 'personalInfo.stylePrefs.bannedContextual');
  return { len: merged.length, avoids: merged.map(c=>c.avoid).sort() };
});
const checks=[]; const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};
check('bannedContextual import UNIONS (small import does not shrink the set)', r2.len===3, JSON.stringify(r2));
check('bannedContextual keeps all originals (leverage+synergy survive)', r2.avoids.join(',')==='leverage,synergy,utilize', JSON.stringify(r2.avoids));
check('ASPICE appears exactly once', r.codeCount['aspice']===1, JSON.stringify(r.codeCount));
check('ISO 26262 appears exactly once', r.codeCount['iso 26262']===1, JSON.stringify(r.codeCount));
check('MIL-STD-810G appears exactly once', r.codeCount['mil std 810g']===1, JSON.stringify(r.codeCount));
check('no grouped item left hidden/on:false (default visible)', r.anyHidden===false, 'items='+JSON.stringify(r.items));
check('no page errors', errs.length===0, errs.slice(0,2).join(' | '));
await browser.close(); await new Promise(x=>server.close(x));
const ok=checks.every(Boolean);
console.log(ok?'REG-DEDUP OK':'REG-DEDUP FAIL');
process.exit(ok?0:1);
