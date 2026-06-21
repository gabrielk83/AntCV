/* VERIFICATION — INTERESTS-JUNIOR-RUGBY-SCRUB-001. A rich_block interests carrying the fabricated
 * "Coaching junior rugby / assistant coach" row is scrubbed: dropped when a canonical "Rugby &
 * inclusive sport" row exists, else replaced with the canonical rugby entry. No junior-rugby text
 * survives, in preview or data. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

// rich_block interests with the fabricated junior-rugby row PRESENT (and no canonical rugby) → must replace
const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'interests', title:'INTERESTS', loc:'sidebar', on:true, type:'rich_block', leadColon:true, items:[
    { b:'Coaching junior rugby', t:'Weekly sessions as assistant coach for the youth side' },
    { b:'Tai-chi', t:'Stability and calm under pressure' },
    { b:'Hiking', t:'Outdoor recovery and mental reset' },
  ] },
], cl:[] };
const personalInfo = { name:'Gabriel', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(10000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const s = (secs.cv||[]).find(x=>x.id==='interests')||{};
  const blob = JSON.stringify(s.items||[]);
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return { type:s.type, rows:(s.items||[]).map(it=>it.b||it.l), juniorInData:/junior rugby|assistant coach|coaching junior/i.test(blob),
    juniorInPreview:/junior rugby|assistant coach/i.test(txt), hasCanon:/Rugby & inclusive sport/i.test(blob), pvCanon:/Rugby & inclusive sport/.test(txt) };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('interests rows:', JSON.stringify(r.rows));
console.log('junior in data:', r.juniorInData, '| junior in preview:', r.juniorInPreview, '| canonical present:', r.hasCanon);
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.juniorInData) { pass=false; fails.push('junior-rugby fabrication STILL in data: '+JSON.stringify(r.rows)); }
if (r.juniorInPreview) { pass=false; fails.push('junior-rugby fabrication STILL in preview'); }
if (!r.hasCanon) { pass=false; fails.push('canonical "Rugby & inclusive sport" not present (replacement failed)'); }
if (!r.pvCanon) { pass=false; fails.push('canonical rugby not rendered in preview'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — INTERESTS-JUNIOR-RUGBY-SCRUB-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  junior-rugby fabrication scrubbed from rich_block interests (replaced with canonical Rugby & inclusive sport); zero errors.');
