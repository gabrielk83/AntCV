/* DIAGNOSTIC — SPELL-ANNOTATOR-001 (1.50.384). Drives the annotator against
 * a fixture dictionary (window.__antcvSpellDictBase → /test/fixtures):
 *   1. a misspelled word in a section-editor textarea gets a red-mark span
 *      in the ghost overlay; a correct word does not;
 *   2. clicking the mark opens the popover and the top suggestion fixes the
 *      field (native-setter replace, React-visible input event);
 *   3. "Add to my dictionary" stores the word (antcv:userDict:en) and the
 *      mark disappears on the next pass;
 *   4. the engine API works headlessly (AntcvSpell.check).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.aff':'text/plain','.dic':'text/plain' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const sections={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text with years experience.'},
],cl:[]};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1500,height:1000}});
await page.addInitScript((secs)=>{
  window.__antcvSpellDictBase='/test/fixtures/dict-{lang}/';
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(secs));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester'}));
  localStorage.setItem('language',JSON.stringify('en'));
},sections);
const errs=[];
page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForTimeout(6000);

const r=await page.evaluate(async ()=>{
  const out={};
  // 4 — engine API first (loads vendor + fixture dict)
  out.apiMarks=(await window.AntcvSpell.check('helo hardware wrld')).map(m=>m.word);
  // open the sections panel, expand the first section, find its textarea
  const open=Array.from(document.querySelectorAll('button')).find(b=>/☰\s*Sections/.test(b.textContent||''));
  if(open){ open.click(); await new Promise(r=>setTimeout(r,1100)); }
  let ta=document.querySelector('.antcv-editor-side-panel textarea');
  if(!ta){
    const row=document.querySelector('[data-section-row-index]');
    if(row){ row.click(); await new Promise(r=>setTimeout(r,1000)); }
    ta=document.querySelector('.antcv-editor-side-panel textarea');
  }
  out.taFound=!!ta;
  if(!ta) return out;
  // type a misspelled + a correct word
  const proto=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
  ta.focus();
  proto.set.call(ta,'helo hardware');
  ta.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,1600));
  const marks=Array.from(document.querySelectorAll('.antcv-spell-mark')).map(e=>e.getAttribute('data-antcv-spell-word'));
  out.marks=marks;
  // 2 — popover suggestion fixes the word
  const mark=document.querySelector('.antcv-spell-mark[data-antcv-spell-word="helo"]');
  if(mark){
    mark.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    await new Promise(r=>setTimeout(r,900));
    const pop=document.querySelector('.antcv-spell-popover');
    out.popButtons=pop?Array.from(pop.querySelectorAll('button')).map(b=>b.textContent):[];
    const sug=pop&&Array.from(pop.querySelectorAll('button')).find(b=>b.textContent==='hello');
    if(sug){ sug.click(); await new Promise(r=>setTimeout(r,1200)); }
    out.valueAfterFix=ta.value;
  }
  // 3 — add to dictionary
  proto.set.call(ta,'hello Kanzen');
  ta.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,1300));
  const mk2=document.querySelector('.antcv-spell-mark[data-antcv-spell-word="Kanzen"]');
  out.kanzenMarked=!!mk2;
  if(mk2){
    mk2.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    await new Promise(r=>setTimeout(r,800));
    const pop=document.querySelector('.antcv-spell-popover');
    const add=pop&&Array.from(pop.querySelectorAll('button')).find(b=>/Add .Kanzen./.test(b.textContent));
    if(add){ add.click(); await new Promise(r=>setTimeout(r,1300)); }
    out.userDict=localStorage.getItem('antcv:userDict:en');
    out.kanzenStillMarked=!!document.querySelector('.antcv-spell-mark[data-antcv-spell-word="Kanzen"]');
  }
  return out;
});
await browser.close();await new Promise(r2=>server.close(r2));

const checks=[
  ['engine API flags helo+wrld, not hardware', JSON.stringify(r.apiMarks)===JSON.stringify(['helo','wrld'])],
  ['editor textarea found', r.taFound===true],
  ['overlay marks helo only', JSON.stringify(r.marks)===JSON.stringify(['helo'])],
  ['suggestion fixes the field', r.valueAfterFix==='hello hardware'],
  ['unknown name marked then added to dict', r.kanzenMarked===true && (r.userDict||'').includes('Kanzen') && r.kanzenStillMarked===false],
];
for(const [n,ok] of checks)console.log(`${n}: ${ok?'OK':'FAIL'}`);
if(!checks.every(c=>c[1]))console.log('detail:',JSON.stringify(r));
console.log('app errors:',errs.length,errs.slice(0,2).join('|'));
const ok=checks.every(c=>c[1])&&errs.length===0;
console.log(ok?'SPELL-ANNOTATOR OK':'SPELL-ANNOTATOR FAILED');
process.exit(ok?0:1);
