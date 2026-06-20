/* VERIFICATION — RICH-BLOCK-001 / HWIC. Convert the CL contribute (text_bullets) into rich_block:
 * intro + closing as plain rows, bullets as marker rows (mk:true), HOW I WOULD CONTRIBUTE headline
 * kept. Asserts the conversion shape + that the CL preview renders intro/bullets/closing content
 * with the heading, and zero app errors. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

const sections = { cv:[{ id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' }], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' },
  { id:'contribute', title:'HOW I WOULD CONTRIBUTE', loc:'main', on:true, type:'text_bullets',
    intro:'INTRO_X what I would focus on first.',
    items:['BULLET_A do the first thing','BULLET_B do the second thing','BULLET_C do the third thing'],
    closing:'CLOSING_X the value the team gains.' },
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
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}'); localStorage.setItem('antcvItemAlignment','{}');
}, [sections, personalInfo]);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const c = (secs.cl||[]).find(s=>s.id==='contribute');
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  return {
    type: c && c.type,
    rows: c && Array.isArray(c.items) ? c.items.map(x=>({t:(x.t||'').slice(0,8), mk:!!x.mk})) : [],
    headlineOff: c ? !!c.headlineOff : null,
    heading:/HOW I WOULD CONTRIBUTE/.test(txt),
    intro:/INTRO_X/.test(txt), b1:/BULLET_A/.test(txt), b2:/BULLET_B/.test(txt), b3:/BULLET_C/.test(txt), closing:/CLOSING_X/.test(txt),
  };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log(JSON.stringify(r,null,1));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
if (r.type !== 'rich_block') { pass=false; fails.push('contribute not converted (type='+r.type+')'); }
if (r.headlineOff) { pass=false; fails.push('HWIC headline should be kept (headlineOff must be falsy)'); }
// rows: [intro(no mk), 3 bullets(mk), closing(no mk)] = 5 rows
if (r.rows.length !== 5) { pass=false; fails.push('expected 5 rows, got '+r.rows.length+': '+JSON.stringify(r.rows)); }
if (r.rows[0] && r.rows[0].mk) { pass=false; fails.push('intro row should have no marker'); }
if (r.rows[4] && r.rows[4].mk) { pass=false; fails.push('closing row should have no marker'); }
if (r.rows.slice(1,4).some(x=>!x.mk)) { pass=false; fails.push('bullet rows should all have mk:true'); }
if (!r.heading) { pass=false; fails.push('HOW I WOULD CONTRIBUTE heading missing'); }
if (!r.intro || !r.b1 || !r.b2 || !r.b3 || !r.closing) { pass=false; fails.push('preview missing some content: '+JSON.stringify(r)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICH-BLOCK-001 / HWIC (contribute → rich_block)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  contribute → rich_block: intro/closing plain rows + 3 marker bullets; heading kept; preview renders all content; zero app errors.');
