/* VERIFICATION — RICH-BLOCK-GROUP-001. Fold labeled_list + list into rich_block (with group rows).
 * Inject Tools (labeled_list w/ a group + l/v rows), Regulatory (labeled_list w/ a label-only
 * subhead), Certs (list of strings). Assert each converts to rich_block: group rows (grp:true),
 * {b,t} rows, leadColon on the labeled ones; CV-sidebar preview renders the sub-headings + label/
 * value; certs default-centered; zero app errors. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const sections = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Lead.' },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'labeled_list', items:[
    { group:'Engineering' },
    { l:'CAD', v:'SolidWorks, CATIA' },
    { l:'ALM', v:'Codebeamer, Jira' },
  ] },
  { id:'regulatory', title:'STANDARDS & COMPLIANCE', loc:'sidebar', on:true, type:'labeled_list', items:[
    { l:'Automotive' },
    { l:'ISO 26262', v:'Functional safety' },
  ] },
  { id:'certs', title:'CERTIFICATIONS', loc:'sidebar', on:true, type:'list', items:[
    'Six Sigma Black Belt','Automotive SPICE',
  ] },
], cl:[] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}'); localStorage.setItem('antcvItemAlignment','{}');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const al = JSON.parse(localStorage.getItem('antcvItemAlignment')||'{}');
  const get = (id)=> (secs.cv||[]).find(s=>s.id===id);
  const desc = (s)=> s ? { type:s.type, leadColon:!!s.leadColon, rows:(s.items||[]).map(x=>x.grp?('G:'+x.t):((x.b||'')+'|'+(x.t||''))) } : null;
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return {
    tools: desc(get('tools')), regulatory: desc(get('regulatory')), certs: desc(get('certs')),
    certsCenter: al.certs && al.certs.__group__,
    pvEngineering:/Engineering/.test(txt), pvCAD:/SolidWorks/.test(txt), pvAutomotive:/Automotive/.test(txt), pvCert:/Six Sigma Black Belt/.test(txt),
  };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log(JSON.stringify(r,null,1));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (!r.tools || r.tools.type!=='rich_block') { pass=false; fails.push('tools not rich_block'); }
if (r.tools && !r.tools.leadColon) { pass=false; fails.push('tools should have leadColon'); }
if (r.tools && r.tools.rows[0] !== 'G:Engineering') { pass=false; fails.push('tools group row wrong: '+JSON.stringify(r.tools.rows)); }
if (r.tools && r.tools.rows[1] !== 'CAD|SolidWorks, CATIA') { pass=false; fails.push('tools l/v row wrong: '+JSON.stringify(r.tools.rows)); }
// regulatory converts to rich_block again (un-excluded); its label-only "Automotive" becomes a group.
if (!r.regulatory || r.regulatory.type !== 'rich_block') { pass=false; fails.push('regulatory should convert to rich_block, got '+(r.regulatory&&r.regulatory.type)); }
if (r.regulatory && r.regulatory.rows[0] !== 'G:Automotive') { pass=false; fails.push('regulatory label-only should become a group: '+JSON.stringify(r.regulatory&&r.regulatory.rows)); }
if (!r.certs || r.certs.type!=='rich_block') { pass=false; fails.push('certs not rich_block'); }
if (r.certs && r.certs.rows[0] !== '|Six Sigma Black Belt') { pass=false; fails.push('certs row wrong: '+JSON.stringify(r.certs.rows)); }
if (r.certsCenter !== 'center') { pass=false; fails.push('certs not default-centered (got '+r.certsCenter+')'); }
if (!r.pvEngineering || !r.pvCAD || !r.pvAutomotive || !r.pvCert) { pass=false; fails.push('sidebar preview missing content: '+JSON.stringify(r)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICH-BLOCK-GROUP-001 (labeled_list + list → rich_block w/ groups)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  Tools/Regulatory (labeled_list) + Certs (list) → rich_block: group rows + label/value + leadColon; certs centered; sidebar preview renders; zero app errors.');
