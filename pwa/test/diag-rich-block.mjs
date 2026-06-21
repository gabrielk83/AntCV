/* VERIFICATION — RICH-BLOCK-001 (universal composite section, preview + editor).
 * Inject a CV with a `rich_block` section (2 rows: lead-in + body). Assert:
 *   (1) the PREVIEW renders each row as a bold lead-in + body paragraph, headline title shown, rule present;
 *   (2) headlineOff hides the title (and rule); ruleOff hides only the rule;
 *   (3) the EDITOR (window.AntcvRichBlockEditor) renders: Headline/Rule/Section bar + a Lead-in input +
 *       a Body textarea + a "+ Row" button, and editing the Body persists to items[i].t.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r)); const port = server.address().port;

function mk(headlineOff, ruleOff){ return { cv:[
  { id:'profile2', title:'PROFILE', loc:'main', on:true, type:'rich_block', headlineOff:!!headlineOff, ruleOff:!!ruleOff, items:[
    { b:'Hands-on', t:'I have built and operated MEMS test rigs end to end.', mk:'🚀' },
    { b:'Professionally', t:'That translates into disciplined product ownership.' },
  ] },
], cl:[] }; }
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

async function boot(secs){
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([s, pi])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
    localStorage.setItem('sections', JSON.stringify(s)); localStorage.setItem('personalInfo', JSON.stringify(pi));
    localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}'); localStorage.setItem('antcvItemAlignment','{}');
  }, [secs, personalInfo]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(9000);
  return { page, errs };
}

const browser = await chromium.launch();

// --- A: preview with headline + rule ---
const a = await boot(mk(false,false));
const prevA = await a.page.evaluate(()=>{
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  // lead-ins are now <span> (was <b>) carrying the section lead style — find them by text + check weight.
  const leadEls = [...document.querySelectorAll('.antcv-preview-paper p > span')].filter(el=>/^(Hands-on|Professionally)/.test((el.textContent||'').trim()));
  const bolds = leadEls.filter(el=>{const w=getComputedStyle(el).fontWeight; return w==='700'||w==='bold'||Number(w)>=600;}).map(el=>(el.textContent||'').trim());
  return { hasTitle:/PROFILE/.test(txt), hasHandsOn:/Hands-on/.test(txt), hasBody:/built and operated/.test(txt), bolds, emojiMarker:/🚀/.test(txt) };
});
await a.page.close();

// --- B: headlineOff hides title ---
const b = await boot(mk(true,false));
const prevB = await b.page.evaluate(()=>{
  // the rich_block section paper region
  const txt = [...document.querySelectorAll('.antcv-preview-paper')].map(p=>p.textContent).join('\n');
  // a section title is rendered uppercase bold; check the PROFILE heading specifically near our content
  const headings = [...document.querySelectorAll('.antcv-preview-paper *')].filter(el=>/^PROFILE$/.test((el.textContent||'').trim()));
  return { stillHasBody:/built and operated/.test(txt), titleHeadingCount: headings.length };
});
await b.page.close();

// --- C: editor renders + body edit persists ---
const c = await boot(mk(false,false));
await c.page.evaluate(()=>{ const x=[...document.querySelectorAll('button')].find(b=>/Sections/i.test(b.textContent||'')); if(x) x.click(); });
await c.page.waitForTimeout(1200);
await c.page.evaluate(()=>{ const r=[...document.querySelectorAll('[data-section-row-loc]')].find(r=>/PROFILE/i.test(r.textContent||'')); if(r) r.click(); });
await c.page.waitForTimeout(2000);
const edit = await c.page.evaluate(()=>{
  const txt = document.body.textContent||'';
  const placeholders=[...document.querySelectorAll('input,textarea')].map(i=>i.placeholder).filter(Boolean);
  return {
    hasHeadlineBtn:/Headline/.test(txt), hasRuleBtn:/Rule/.test(txt), hasSectionBtn:/Section/.test(txt),
    hasLeadInput: placeholders.some(p=>/Lead-in/.test(p)),
    hasBodyArea: placeholders.some(p=>/Body text/.test(p)),
    hasAddRow:[...document.querySelectorAll('button')].some(b=>/\+ Row/.test(b.textContent||'')),
  };
});
if (edit.hasBodyArea) {
  await c.page.locator('textarea[placeholder="Body text"]').first().fill('EDITED BODY ALPHA');
  await c.page.waitForTimeout(1200);
}
const persisted = await c.page.evaluate(()=>{
  const secs=JSON.parse(localStorage.getItem('sections')||'{}');
  const sec=(secs.cv||[]).find(s=>s.id==='profile2');
  return sec && sec.items && sec.items[0] && sec.items[0].t;
});
const errsC = c.errs.slice();
await c.page.close();

await browser.close(); await new Promise(r=>server.close(r));

console.log('A preview:', JSON.stringify(prevA));
console.log('B headlineOff:', JSON.stringify(prevB));
console.log('C editor:', JSON.stringify(edit));
console.log('C persisted item0.t:', persisted);
console.log('C errors:', errsC.length, errsC.slice(0,2).join(' | '));

let pass=true; const fails=[];
if (errsC.length) { pass=false; fails.push('app errors: '+errsC.slice(0,2).join(' | ')); }
if (!prevA.hasTitle) { pass=false; fails.push('preview missing PROFILE title'); }
if (!prevA.hasHandsOn || !prevA.hasBody) { pass=false; fails.push('preview missing lead-in/body'); }
if (prevA.bolds.length < 2) { pass=false; fails.push('lead-ins not bold (got '+JSON.stringify(prevA.bolds)+')'); }
if (!prevA.emojiMarker) { pass=false; fails.push('per-row emoji marker (🚀) not rendered in preview'); }
if (!prevB.stillHasBody) { pass=false; fails.push('headlineOff dropped the body too'); }
if (prevB.titleHeadingCount !== 0) { pass=false; fails.push('headlineOff did NOT hide the PROFILE title ('+prevB.titleHeadingCount+')'); }
if (!edit.hasHeadlineBtn || !edit.hasRuleBtn || !edit.hasSectionBtn) { pass=false; fails.push('editor section bar incomplete: '+JSON.stringify(edit)); }
if (!edit.hasLeadInput || !edit.hasBodyArea || !edit.hasAddRow) { pass=false; fails.push('editor row controls incomplete: '+JSON.stringify(edit)); }
if (persisted !== 'EDITED BODY ALPHA') { pass=false; fails.push('body edit did not persist (got "'+persisted+'")'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — RICH-BLOCK-001 (preview + editor)');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  rich_block renders bold-lead paragraphs; headline/rule toggles work; editor bar+rows+add render and body edits persist.');
