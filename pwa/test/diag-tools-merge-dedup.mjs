/* VERIFICATION — TOOLS-MERGE-DEDUP-001. The duplicated TOOLS & METHODS (concise top rows that repeat
 * the grouped tools) collapses: the overlapping leading rows are STASHED on section.trimmedItems
 * (preserved) and removed from visible items, leaving the deduplicated groups. A genuinely-unique
 * leading row is KEPT. Idempotent. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

// mirrors the PDF: concise top (Data&analytics/Project workflow/Methods/Documentation) + groups that repeat them
const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'rich_block', leadColon:true, items:[
    { b:'Data & analytics', t:'SQL, Power BI, Python, Jupyter' },
    { b:'Project workflow', t:'Jira, Confluence, Codebeamer ALM, Git' },
    { b:'Methods', t:'Six Sigma Black Belt, BABOK, ASPICE, FMEA, MBSE' },
    { b:'Documentation', t:'LaTeX, Excel, VBA, PowerPoint' },
    { b:'Niche unique tool', t:'SomethingNotRepeatedAnywhere, AnotherUniqueThing' },  // genuinely unique → keep
    { grp:true, t:'Expertise' },
    { b:'Optics, photonics & sensing', t:'Electro-optics, photonics, LiDAR' },
    { grp:true, t:'Tools' },
    { b:'Software', t:'Jira, Confluence, Codebeamer ALM, Git, Power BI, Excel, SQL, VBA, Python, Jupyter, Docker, LaTeX' },
    { grp:true, t:'Methods' },
    { b:'Quality & process', t:'Lean, Six Sigma Black Belt, FMEA, DFMEA, MBSE, BPMN' },
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
await page.waitForTimeout(9000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const s = (secs.cv||[]).find(x=>x.id==='tools')||{};
  const items = s.items||[];
  const leads = items.filter(it=>!it.grp).map(it=>it.b);
  const stashed = (s.trimmedItems||[]).map(it=>it.b);
  // TOOLS-GROUP-FOLD-001: after the fold there must be NO headerless ungrouped
  // preamble — i.e. no ungrouped row appears before the first {grp} marker.
  let firstGrp = items.findIndex(it=>it&&it.grp);
  let ungroupedBeforeFirstGrp = firstGrp < 0 ? leads.length : items.slice(0,firstGrp).filter(it=>it&&!it.grp).length;
  return { visibleLeads:leads, stashedLeads:stashed, nItems:items.length, firstGrp, ungroupedBeforeFirstGrp };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('visible leads:', JSON.stringify(r.visibleLeads));
console.log('stashed (trimmed):', JSON.stringify(r.stashedLeads));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
// the concise-top duplicates must be stashed, not visible
['Data & analytics','Project workflow','Methods','Documentation'].forEach(l=>{
  if (r.visibleLeads.filter(x=>x===l).length > 1 || (r.visibleLeads.indexOf(l)>-1 && r.visibleLeads.indexOf(l) < r.visibleLeads.indexOf('Software'))) {
    // 'Methods' also appears as a GROUP header; the leading ITEM "Methods" should be stashed
  }
});
if (!r.stashedLeads.includes('Data & analytics')) { pass=false; fails.push('"Data & analytics" concise row not stashed'); }
if (!r.stashedLeads.includes('Project workflow')) { pass=false; fails.push('"Project workflow" concise row not stashed'); }
if (!r.stashedLeads.includes('Documentation')) { pass=false; fails.push('"Documentation" concise row not stashed'); }
if (!r.visibleLeads.includes('Niche unique tool')) { pass=false; fails.push('genuinely-unique leading row was wrongly stashed'); }
if (!r.visibleLeads.includes('Software')) { pass=false; fails.push('detailed "Software" group row lost'); }
if (r.visibleLeads.indexOf('Data & analytics') > -1) { pass=false; fails.push('concise "Data & analytics" still visible (not collapsed)'); }
// TOOLS-GROUP-FOLD-001: no headerless ungrouped preamble before the first group
console.log('ungrouped rows before first group:', r.ungroupedBeforeFirstGrp, '(expect 0 — folded)');
if (r.ungroupedBeforeFirstGrp !== 0) { pass=false; fails.push('"tools group broke apart": '+r.ungroupedBeforeFirstGrp+' ungrouped row(s) still render before the first group header'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — TOOLS-MERGE-DEDUP-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  duplicated concise-top rows stashed on trimmedItems; detailed groups kept; unique leading row kept; zero errors.');
