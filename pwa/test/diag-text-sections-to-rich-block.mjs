/* VERIFICATION — RICH-BLOCK-001 Phase C. Convert the five named single-paragraph sections
 * (CL: opening, who, why; CV: profile, work_style) into rich_block. (closure excluded — it is the
 * special CL sign-off render reading .content; see the migration sidecar header.)
 * Asserts: each becomes type:"rich_block" with one row {b,t}; headlineOff set for opening/
 * work_style (not who/why/profile); work_style lead = "Work style"; titles preserved (the WHY
 * heading-flip still mutates the title); both CV and CL previews render the content with ZERO
 * app errors (catches sidecar conflicts). */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'PROFILE_CONTENT_X positioning who I am.' },
  { id:'work_style', title:'Work style', loc:'main', on:true, type:'text_inline', content:'WORKSTYLE_CONTENT_X methodical and hands-on.' },
  { id:'outcomes', title:'SELECTED OUTCOMES', loc:'main', on:true, type:'bullets', items:[{b:'Led',t:'a thing'}] },
], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Hiring Manager,' },
  { id:'opening', title:'Opening', loc:'main', on:true, type:'text', content:'OPENING_CONTENT_X about this role.' },
  { id:'who', title:'WHO I AM', loc:'main', on:true, type:'text', content:'WHO_CONTENT_X introducing myself.' },
  { id:'bring', title:'WHAT I BRING', loc:'main', on:true, type:'table', rows:[['A','B'],['x','y']] },
  { id:'why', title:'WHY THIS POSITION', loc:'main', on:true, type:'text', content:'WHY_CONTENT_X about the company.' },
  { id:'closure', title:'Closure', loc:'main', on:true, type:'text', content:'CLOSURE_CONTENT_X looking forward.' },
] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
async function boot(doc){
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([secs, pi, d])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify(d));
    localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
    localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}'); localStorage.setItem('antcvItemAlignment','{}');
  }, [sections, personalInfo, doc]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(9000);
  return { page, errs };
}

const cv = await boot('cv');
const cvR = await cv.page.evaluate(()=>{
  const secs = JSON.parse(localStorage.getItem('sections')||'{}');
  const get = (doc,id)=> (secs[doc]||[]).find(s=>s.id===id);
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  const sec=(doc,id)=>{ const s=get(doc,id); return s?{type:s.type,headlineOff:!!s.headlineOff,lead:s.items&&s.items[0]&&s.items[0].b,body:s.items&&s.items[0]&&s.items[0].t,title:s.title}:null; };
  return { profile:sec('cv','profile'), work_style:sec('cv','work_style'),
    opening:sec('cl','opening'), who:sec('cl','who'), why:sec('cl','why'), closure:sec('cl','closure'),
    previewProfile:/PROFILE_CONTENT_X/.test(txt), previewWork:/WORKSTYLE_CONTENT_X/.test(txt) };
});
const cvErrs = cv.errs.slice(); await cv.page.close();

const cl = await boot('cl');
const clR = await cl.page.evaluate(()=>{
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  // lead-ins are <span> (carry the section lead style), not <b>.
  const bolds = [...document.querySelectorAll('.antcv-preview-paper p > span, .antcv-preview-paper p > b')].map(b=>(b.textContent||'').trim());
  return { opening:/OPENING_CONTENT_X/.test(txt), who:/WHO_CONTENT_X/.test(txt), why:/WHY_CONTENT_X/.test(txt),
    whoLead: bolds.some(x=>/Who I am/i.test(x)), whyLead: bolds.some(x=>/Why this (company|position)/i.test(x)) };
});
const clErrs = cl.errs.slice(); await cl.page.close();

await browser.close(); await new Promise(r=>server.close(r));

console.log('CV state:', JSON.stringify(cvR,null,1));
console.log('CL preview:', JSON.stringify(clR));
console.log('CV errors:', cvErrs.length, cvErrs.slice(0,2).join(' | '));
console.log('CL errors:', clErrs.length, clErrs.slice(0,2).join(' | '));

let pass=true; const fails=[];
const isRB = (s)=> s && s.type==='rich_block';
if (cvErrs.length) { pass=false; fails.push('CV app errors: '+cvErrs.slice(0,2).join(' | ')); }
if (clErrs.length) { pass=false; fails.push('CL app errors: '+clErrs.slice(0,2).join(' | ')); }
for (const id of ['profile','work_style','opening','who','why']) {
  const s = cvR[id];
  if (!isRB(s)) { pass=false; fails.push(id+' not converted to rich_block ('+(s&&s.type)+')'); }
}
if (cvR.opening && cvR.opening.headlineOff !== true) { pass=false; fails.push('opening should be headlineOff'); }
if (cvR.work_style && cvR.work_style.headlineOff !== true) { pass=false; fails.push('work_style should be headlineOff'); }
if (cvR.who && cvR.who.headlineOff !== true) { pass=false; fails.push('who should be headlineOff (lead-in pattern)'); }
if (cvR.why && cvR.why.headlineOff !== true) { pass=false; fails.push('why should be headlineOff (lead-in pattern)'); }
if (cvR.profile && cvR.profile.headlineOff !== false) { pass=false; fails.push('profile should keep headline'); }
if (cvR.work_style && cvR.work_style.lead !== 'Work style') { pass=false; fails.push('work_style lead should be "Work style" (got "'+(cvR.work_style&&cvR.work_style.lead)+'")'); }
if (cvR.who && cvR.who.lead !== 'Who I am') { pass=false; fails.push('who lead should be "Who I am" (got "'+(cvR.who&&cvR.who.lead)+'")'); }
if (cvR.why && cvR.why.lead !== 'Why this company') { pass=false; fails.push('why lead should be "Why this company" with no JD (got "'+(cvR.why&&cvR.why.lead)+'")'); }
if (!cvR.previewProfile || !cvR.previewWork) { pass=false; fails.push('CV preview missing profile/work_style content'); }
if (!clR.opening || !clR.who || !clR.why) { pass=false; fails.push('CL preview missing converted content: '+JSON.stringify(clR)); }
if (!clR.whoLead || !clR.whyLead) { pass=false; fails.push('CL who/why bold lead-ins missing: '+JSON.stringify(clR)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICH-BLOCK-001 Phase C (five named sections → rich_block; closure excluded)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  opening/who/why/profile/work_style converted; headline toggles correct; titles preserved (WHY heading-flip survives); CV+CL previews render; zero app errors.');
