/* VERIFICATION — OWNER-PRESENT-GATE-001. A FRESH/deleted user (empty personalInfo) must NOT get
 * Gabriel's CANON_INTERESTS pinned or his "Danish and international recommenders…" recommendations
 * created. An OWNER (personalInfo with real data) still does (no regression). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

// sections with an experience ANCHOR + an EMPTY interests section (the post-delete skeleton shape)
const baseSections = ()=>({ cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[{id:'r1',title:'Role',company:'Co',dateRange:'2020-2021',bullets:['x']}] },
  { id:'interests', title:'INTERESTS', loc:'sidebar', on:true, type:'rich_block', items:[] },
], cl:[] });

const browser = await chromium.launch();
async function boot(personalInfo){
  const page = await browser.newPage({ viewport:{ width:1300, height:900 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([secs, pi])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  }, [baseSections(), personalInfo]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(9000);
  const r = await page.evaluate(()=>{
    const secs = JSON.parse(localStorage.getItem('sections')||'{}');
    const intr = (secs.cv||[]).find(s=>s.id==='interests')||{};
    const rec = (secs.cv||[]).find(s=>s.id==='recommendations');
    const blob = JSON.stringify(secs.cv||[]);
    return { interestsN:(intr.items||[]).length, hasRugby:/Rugby & inclusive sport/.test(blob), recsCreated:!!rec, recsGabriel:/Danish and international recommenders/.test(blob) };
  });
  const e=errs.slice(); await page.close();
  return { ...r, errs:e };
}

const fresh = await boot({});                                   // deleted/fresh — empty personalInfo
const owner = await boot({ name:'Gabriel Karp', email:'g@e.com', interests:[{title:'X',content:'y'}] });
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('FRESH (empty PI):', JSON.stringify(fresh));
console.log('OWNER (real PI) :', JSON.stringify(owner));
const errs = fresh.errs.concat(owner.errs);

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
// fresh user: NO Gabriel data injected
if (fresh.hasRugby) { pass=false; fails.push('FRESH user got Gabriel CANON_INTERESTS (rugby) injected'); }
if (fresh.recsGabriel) { pass=false; fails.push('FRESH user got Gabriel recommendations created'); }
// owner: canon still works
if (!owner.hasRugby) { pass=false; fails.push('OWNER did NOT get CANON_INTERESTS pinned (regression)'); }
if (!owner.recsGabriel) { pass=false; fails.push('OWNER did NOT get recommendations created (regression)'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — OWNER-PRESENT-GATE-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  fresh/deleted user gets no Gabriel interests/recs; owner still does; zero errors.');
