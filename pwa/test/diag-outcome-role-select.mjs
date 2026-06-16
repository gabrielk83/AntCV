/* DIAGNOSTIC — OUTCOME-ROLE-SELECT-001 (owner 2026-06-16).
 * Verifies the sidecar: (1) stamps _oid on outcomes; (2) SEEDS >=11 outcomes from
 * role-keyed proof points, each mapped to its role in antcv:outcomeRoleMap, with
 * every role covered; (3) injects a position <select> per SELECTED OUTCOMES row
 * (tested against the real placeholders) and persists the choice to the map. */
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

// 6 roles × 2 proof points = 12 role-keyed proof points (≥11 achievable).
const ppByRole = [];
const roles = [];
for (let n = 1; n <= 6; n++) {
  roles.push({ id:'r'+n, title:'Role '+n, company:'Co'+n, years:'201'+n+'–202'+n, on:true,
    proofPointIds:['p'+n+'a','p'+n+'b'], bullets:['Bullet for role '+n+'.'] });
  ppByRole.push({ id:'p'+n+'a', roleId:'r'+n, text:'Outcome A for role '+n+' with a 3'+n+'% gain.' });
  ppByRole.push({ id:'p'+n+'b', roleId:'r'+n, text:'Outcome B for role '+n+' covering scope.' });
}
const sections = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P.' },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets',
    items:[ { b:'[Verb]', t:'[concrete outcome]' } ] },  // placeholder only → under the floor
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript((args)=>{
  const { secs, pp } = args;
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
  localStorage.setItem('personalInfo', JSON.stringify({ name:'G Tester', proofPointsByRole: pp }));
}, { secs: sections, pp: ppByRole });
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(5500); // boot sweep + seeding

const seed = await page.evaluate(()=>{
  const b = JSON.parse(localStorage.getItem('sections')||'{}');
  const os = (b.cv||[]).find(s=>s&&s.id==='outcomes');
  const items = (os&&os.items)||[];
  const real = items.filter(it=>it && !/^\s*\[/.test(String((it.t!=null?it.t:it.b)||'')) && String((it.t!=null?it.t:it.b)||'').trim());
  const allHaveOid = items.every(it=> it && typeof it==='object' ? !!it._oid : true);
  const map = JSON.parse(localStorage.getItem('antcv:outcomeRoleMap')||'{}');
  // coverage: every role id appears as a mapped value
  const mappedRoles = new Set(Object.values(map));
  const roleIds = ['r1','r2','r3','r4','r5','r6'];
  const everyRoleCovered = roleIds.every(id=>mappedRoles.has(id));
  // each seeded outcome's _oid is in the map
  const seededMapped = real.every(it=> it._oid && map[it._oid] != null);
  return { realCount: real.length, allHaveOid, mapSize: Object.keys(map).length, everyRoleCovered, seededMapped };
});

// Dropdown injection — test against the REAL selectors via a simulated row.
const drop = await page.evaluate(()=>{
  const b = JSON.parse(localStorage.getItem('sections')||'{}');
  const os = (b.cv||[]).find(s=>s&&s.id==='outcomes');
  const firstOid = os && os.items && os.items[0] && os.items[0]._oid;
  // build a row that matches the SELECTED OUTCOMES editor structure
  const row = document.createElement('div');
  const v = document.createElement('input'); v.placeholder='[Verb]';
  const t = document.createElement('input'); t.placeholder='Outcome text';
  row.appendChild(v); row.appendChild(t); document.body.appendChild(row);
  window.AntcvOutcomeRoleSelect._inject();
  const sel = row.querySelector('select[data-antcv-outcome-role]');
  const optCount = sel ? sel.querySelectorAll('option').length : 0;
  let persisted = false;
  if (sel) {
    sel.value = 'r3'; sel.dispatchEvent(new Event('change', { bubbles:true }));
    const m = JSON.parse(localStorage.getItem('antcv:outcomeRoleMap')||'{}');
    persisted = firstOid && m[firstOid] === 'r3';
  }
  return { injected: !!sel, optCount, persisted };
});

await browser.close(); await new Promise(r=>server.close(r));
console.log('--- OUTCOME-ROLE-SELECT-001 ---');
console.log('seed:', JSON.stringify(seed));
console.log('dropdown:', JSON.stringify(drop));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['all outcome items have _oid', seed.allHaveOid],
  ['seeded >= 11 real outcomes', seed.realCount >= 11],
  ['every role covered by >=1 mapped outcome', seed.everyRoleCovered],
  ['each seeded outcome is mapped to a role', seed.seededMapped],
  ['dropdown <select> injected with position options (>=7 = blank+6 roles)', drop.injected && drop.optCount >= 7],
  ['dropdown change persists to outcomeRoleMap', drop.persisted],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'OUTCOME-ROLE-SELECT OK' : 'OUTCOME-ROLE-SELECT FAILED');
process.exit(ok ? 0 : 1);
