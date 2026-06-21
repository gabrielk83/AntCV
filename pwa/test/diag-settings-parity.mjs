/* VERIFICATION — RICH-BLOCK-001 settings parity. The old per-type control stores must carry over to
 * the rich_block stores after conversion:
 *  - profile/work_style CJLR (antcv.profileWorkstyleParagraphAlignment.v1) -> antcvItemAlignment[id].__group__ + items.0
 *  - HWIC line align (antcv.hiwc.alignment.v1: intro/bullet_k/closing) -> antcvItemAlignment[contribute].items.<rowIdx>
 *  - HWIC line pages (antcv:itemPages[contribute]: bullet_k) -> antcv:itemPages[contribute].items.<rowIdx> */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Programme leader.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'Methodical.' },
], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Team,' },
  { id:'contribute', title:'HOW I WOULD CONTRIBUTE', loc:'main', on:true, type:'text_bullets',
    intro:'Intro line.', items:['Bullet zero','Bullet one','Bullet two'], closing:'Closing line.' },
] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cl'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}');
  localStorage.setItem('antcvItemAlignment','{}');
  // OLD per-type control stores (set by the retired sidecars):
  localStorage.setItem('antcv.profileWorkstyleParagraphAlignment.v1', JSON.stringify({ profile:'center', work_style:'right' }));
  localStorage.setItem('antcv.hiwc.alignment.v1', JSON.stringify({ intro:'center', bullet_0:'right', closing:'left' }));
  localStorage.setItem('antcv:itemPages', JSON.stringify({ contribute:{ bullet_1:2 } }));
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(()=>{
  const al = JSON.parse(localStorage.getItem('antcvItemAlignment')||'{}');
  const pg = JSON.parse(localStorage.getItem('antcv:itemPages')||'{}');
  return { al, pg };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('antcvItemAlignment:', JSON.stringify(r.al));
console.log('antcv:itemPages:', JSON.stringify(r.pg));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

const al=r.al, pg=r.pg;
let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
// profile/work_style CJLR carried
if (!al.profile || al.profile.__group__ !== 'center' || al.profile['items.0'] !== 'center') { pass=false; fails.push('profile CJLR not carried: '+JSON.stringify(al.profile)); }
if (!al.work_style || al.work_style.__group__ !== 'right') { pass=false; fails.push('work_style CJLR not carried: '+JSON.stringify(al.work_style)); }
// HWIC line align carried: rows = [intro(0), b0(1), b1(2), b2(3), closing(4)]
const c = al.contribute || {};
if (c['items.0'] !== 'center') { pass=false; fails.push('HWIC intro align not carried to items.0: '+JSON.stringify(c)); }
if (c['items.1'] !== 'right') { pass=false; fails.push('HWIC bullet_0 align not carried to items.1: '+JSON.stringify(c)); }
if (c['items.4'] !== 'left') { pass=false; fails.push('HWIC closing align not carried to items.4: '+JSON.stringify(c)); }
// HWIC page carried: bullet_1 -> items.2
const cp = pg.contribute || {};
if (Number(cp['items.2']) !== 2) { pass=false; fails.push('HWIC bullet_1 page not carried to items.2: '+JSON.stringify(cp)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICH-BLOCK-001 settings parity (old control stores → rich_block stores)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  profile/work_style CJLR + HWIC per-line align/page carried into antcvItemAlignment / antcv:itemPages.');
