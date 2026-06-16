/* DIAGNOSTIC — CW-CANON-001 (owner 2026-06-16). The two Copenhagen Wolves variants
 * ("(foreningsarbejde)" + "(Volunteer)") are the same job → merge to ONE with the
 * canonical compressed title, company "Pan Idræt Rugby", and "Copenhagen Wolves RFC"
 * in the content. Distinct roles (e.g. Innoviz) must NOT be touched. */
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

const roles = [
  { id:'kanzen', title:'Product / Project Expert', company:'Kanzen Konsulenter ApS', years:'2022 - 2026', on:true, bullets:['Consulting.'] },
  { id:'cw1', title:'Team Operations Manager & Assistant Coach (foreningsarbejde)', company:'Pan Idræt Rugby - Copenhagen Wolves RFC', years:'2023 - present', on:true, bullets:['Managed logistics for ~25 players.'] },
  { id:'cw2', title:'Team Operations Manager & Assistant Coach (Volunteer)', company:'Copenhagen Wolves RFC, Pan Idræt', years:'2023 - present', on:true, bullets:['Co-organised annual events.'] },
];
const sections = { cv: [
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
], cl: [] };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((secs)=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs));
}, sections);
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(4500);

const r = await page.evaluate(()=>{
  const b = JSON.parse(localStorage.getItem('sections')||'{}');
  const e = (b.cv||[]).find(s=>s&&s.type==='experience');
  const rs = (e&&e.roles)||[];
  const cw = rs.filter(x=>/copenhagen wolves|foreningsarbejde|pan idr/i.test((x.company||'')+(x.title||'')));
  return {
    total: rs.length,
    cwCount: cw.length,
    cwTitle: cw[0] && cw[0].title,
    cwCompany: cw[0] && cw[0].company,
    cwHasRfcBullet: !!(cw[0] && (cw[0].bullets||[]).some(b=>/copenhagen wolves rfc/i.test(String(b)))),
    kanzenIntact: rs.some(x=>x.id==='kanzen' && x.title==='Product / Project Expert'),
  };
});
await browser.close(); await new Promise(r=>server.close(r));
console.log('--- CW-CANON-001 ---');
console.log(JSON.stringify(r));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['the two CW variants merge to ONE role', r.cwCount === 1 && r.total === 2],
  ['canonical compressed title kept', r.cwTitle === 'Team Operations Manager & Assi. Coach (foreningsarbejde)'],
  ['company is "Pan Idræt Rugby"', r.cwCompany === 'Pan Idræt Rugby'],
  ['"Copenhagen Wolves RFC" is in the content (a bullet)', r.cwHasRfcBullet],
  ['the distinct Kanzen role is untouched', r.kanzenIntact],
  ['no app errors', errs.length === 0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'CW-CANON OK' : 'CW-CANON FAILED');
process.exit(ok ? 0 : 1);
