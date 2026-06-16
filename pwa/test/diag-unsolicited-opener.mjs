/* DIAGNOSTIC — PROFILE-UNSOLICITED-GENERIC-001 (owner, repeated): an unsolicited
 * CV PROFILE must not OPEN by leading with a niche deep-tech identity. 415 now
 * deterministically rewrites the leading subject. Asserts: (1) no JD + niche
 * opener → subject neutralised, rest preserved; (2) WITH a JD → left as-is. */
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

const OPENER = 'Electro-optics and hardware-software product architect with 15+ years spanning consumer devices, automotive LiDAR, and defence optics. Specialises in structured evaluation.';
function mkSections(){ return { cv: [ { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content: OPENER } ], cl: [] }; }

async function run(withJd){
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1200, height:900 } });
  await page.addInitScript((args)=>{
    const { secs, jd } = args;
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
    localStorage.setItem('step', JSON.stringify('editor'));
    localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs));
    localStorage.setItem('personalInfo', JSON.stringify({ name:'G Tester' }));
    if (jd) localStorage.setItem('antcv:lastJdText', jd); else localStorage.removeItem('antcv:lastJdText');
  }, { secs: mkSections(), jd: withJd ? 'Seeking an electro-optics systems engineer for automotive LiDAR program.' : '' });
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(5000);
  const content = await page.evaluate(()=>{ try { const b=JSON.parse(localStorage.getItem('sections')||'{}'); const p=(b.cv||[]).find(s=>s.id==='profile'); return p?p.content:''; } catch(_){ return 'ERR'; } });
  await browser.close();
  return content;
}

const noJd = await run(false);
const withJd = await run(true);
await new Promise(r=>server.close(r));

console.log('--- PROFILE-UNSOLICITED-GENERIC-001 ---');
console.log('no-JD opener  :', noJd.slice(0, 70));
console.log('with-JD opener:', withJd.slice(0, 70));
const neutralised = /^Product and project professional with 15\+ years/.test(noJd);
const restPreserved = /spanning consumer devices.*defence optics/.test(noJd) && /Specialises in structured evaluation/.test(noJd);
const niceClean = !/^[^.]*electro/i.test(noJd); // first sentence no longer LEADS with electro
const jdPreserved = withJd === 'Electro-optics and hardware-software product architect with 15+ years spanning consumer devices, automotive LiDAR, and defence optics. Specialises in structured evaluation.';
const checks = [
  ['no-JD: subject neutralised to product/project', neutralised],
  ['no-JD: rest of sentence preserved', restPreserved],
  ['no-JD: opener no longer leads with electro-optics', niceClean],
  ['with-JD: niche opener LEFT as-is (targeted app)', jdPreserved],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'UNSOLICITED-OPENER OK' : 'UNSOLICITED-OPENER FAILED');
process.exit(ok ? 0 : 1);
