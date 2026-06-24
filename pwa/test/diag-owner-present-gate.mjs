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
const baseSections = (interestsItems)=>({ cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles:[{id:'r1',title:'Role',company:'Co',dateRange:'2020-2021',bullets:['x']}] },
  { id:'interests', title:'INTERESTS', loc:'sidebar', on:true, type:'rich_block', items:interestsItems||[] },
], cl:[] });

// the full leaked Gabriel canon, rich_block {b,t} shape (what a contaminated cloud slot carries)
const GABRIEL_CANON = [
  { b:'Rugby & inclusive sport', t:'Team operations, coach assist, literally a team player' },
  { b:'Tai-chi', t:'Stability and calm under pressure' },
  { b:'Cultural exchange', t:'Languages, food culture and board games' },
  { b:'Hiking', t:'Outdoor recovery and mental reset' },
  { b:'Reading', t:'Technology, society and systems thinking' },
  { b:'Supervision', t:'Handling three feline strategic napping experts (cats)' },
];

const browser = await chromium.launch();
async function boot(personalInfo, interestsItems){
  const page = await browser.newPage({ viewport:{ width:1300, height:900 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([secs, pi])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  }, [baseSections(interestsItems), personalInfo]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(9000);
  const r = await page.evaluate(()=>{
    const secs = JSON.parse(localStorage.getItem('sections')||'{}');
    const intr = (secs.cv||[]).find(s=>s.id==='interests')||{};
    const rec = (secs.cv||[]).find(s=>s.id==='recommendations');
    const blob = JSON.stringify(secs.cv||[]);
    return { interestsN:(intr.items||[]).length, interestsOn:intr.on!==false, hasRugby:/Rugby & inclusive sport/.test(blob), hasCats:/three feline strategic napping/.test(blob), recsCreated:!!rec, recsGabriel:/Danish and international recommenders/.test(blob) };
  });
  const e=errs.slice(); await page.close();
  return { ...r, errs:e };
}

const fresh = await boot({});                                   // deleted/fresh — empty personalInfo
const owner = await boot({ name:'Gabriel Karp', email:'g@e.com', interests:[{title:'X',content:'y'}] });
// INTERESTS-LEAK-SOURCE-001: a NAMED non-Gabriel persona must never be FILLED with Gabriel's
// CANON_INTERESTS (Part 1 name-guard), and a persona whose section ALREADY carries his leaked
// canon (contaminated cloud slot) must have it STRIPPED (Part 2 isolation sidecar).
const anitaEmpty = await boot({ name:'Anita Aarup', email:'anita@example.com', experience:[{title:'Ops',company:'Acme'}] });
const anitaLeaked = await boot({ name:'Anita Aarup', email:'anita@example.com', experience:[{title:'Ops',company:'Acme'}] }, GABRIEL_CANON.map(x=>({...x})));
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('FRESH (empty PI)      :', JSON.stringify(fresh));
console.log('OWNER (real PI)       :', JSON.stringify(owner));
console.log('ANITA (empty interests):', JSON.stringify(anitaEmpty));
console.log('ANITA (leaked canon)   :', JSON.stringify(anitaLeaked));
const errs = fresh.errs.concat(owner.errs, anitaEmpty.errs, anitaLeaked.errs);

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
// fresh user: NO Gabriel data injected
if (fresh.hasRugby) { pass=false; fails.push('FRESH user got Gabriel CANON_INTERESTS (rugby) injected'); }
if (fresh.recsGabriel) { pass=false; fails.push('FRESH user got Gabriel recommendations created'); }
// owner: canon still works
if (!owner.hasRugby) { pass=false; fails.push('OWNER did NOT get CANON_INTERESTS pinned (regression)'); }
if (!owner.recsGabriel) { pass=false; fails.push('OWNER did NOT get recommendations created (regression)'); }
// Part 1 — named non-Gabriel persona: pinInterests/scrubJuniorRugby must NOT inject his hobbies
if (anitaEmpty.hasRugby || anitaEmpty.hasCats) { pass=false; fails.push('ANITA (empty) got Gabriel CANON_INTERESTS injected (Part 1 name-guard failed)'); }
// Part 2 — contaminated section: the leaked canon must be stripped (cats + rugby gone), section emptied+hidden
if (anitaLeaked.hasCats) { pass=false; fails.push('ANITA (leaked) still shows Gabriel "three feline" canon (Part 2 isolation failed)'); }
if (anitaLeaked.hasRugby) { pass=false; fails.push('ANITA (leaked) still shows Gabriel rugby canon (Part 2 isolation failed)'); }
if (anitaLeaked.interestsN !== 0 || anitaLeaked.interestsOn !== false) { pass=false; fails.push('ANITA (leaked) interests not emptied+hidden after strip (got n='+anitaLeaked.interestsN+', on='+anitaLeaked.interestsOn+')'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — OWNER-PRESENT-GATE-001 + INTERESTS-LEAK-SOURCE-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  fresh/deleted + named non-Gabriel get no Gabriel interests; contaminated section is stripped+hidden; owner still pins his canon; zero errors.');
