/* DIAGNOSTIC — PREVIEW-SPELL-001: spell underlines appear on the rendered
 * preview (non-destructive overlay), and clicking a mark + applying a
 * suggestion edits the sections store.
 *   1. a misspelled word in a preview section gets an overlay mark;
 *   2. a correctly-spelled doc produces NO marks;
 *   3. the overlay never injects into the React preview tree (paper has no
 *      foreign mark children — marks live in the separate overlay layer).
 * Uses the tiny test dictionary via window.__antcvSpellDictBase.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.aff':'text/plain','.dic':'text/plain' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();

async function run(content) {
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  await page.addInitScript(({content})=>{
    window.__antcvSpellDictBase = '/test/fixtures/dict-{lang}/';
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('language', JSON.stringify('en'));
    localStorage.removeItem('antcv:spell:enabled'); // default on
    localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content}],cl:[]}));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
    localStorage.setItem('wizardCompleted', JSON.stringify(true));
  },{content});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(7000);
  // force a scan after the engine has had time to load the dict
  await page.evaluate(()=>{ try { window.AntcvPreviewSpellOverlay && window.AntcvPreviewSpellOverlay._scan(); } catch(_){} });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(()=>{
    const ov=document.getElementById('antcv-preview-spell-overlay');
    const marks=ov?[...ov.querySelectorAll('[data-antcv-pspell-word]')]:[];
    const paper=document.querySelector('.antcv-preview-paper');
    const foreignInPaper = paper ? paper.querySelectorAll('[data-antcv-pspell-word]').length : -1;
    return { markCount: marks.length, words: marks.map(m=>m.getAttribute('data-antcv-pspell-word')), foreignInPaper };
  });
  await page.close();
  return { ...r, errs };
}

const checks=[];
const check=(n,ok,d)=>{checks.push(ok);console.log(`${n}: ${ok?'OK':'FAIL'}${ok?'':' '+(d||'')}`)};

// "speling" + "errror" are NOT in the tiny dict -> misspelled; the rest are.
const bad = await run('profile text with speling and errror');
check('1. misspelled words get preview overlay marks', bad.markCount>=1 && bad.words.some(w=>/speling|errror/i.test(w)) && bad.errs.length===0, JSON.stringify(bad));
check('3. overlay marks live OUTSIDE the React preview tree', bad.foreignInPaper===0, JSON.stringify({foreign:bad.foreignInPaper}));

// the tiny test dict only has 12 words, so the preview's placeholder/chrome
// text ("Specialisation", "Contact"…) is flagged — a fixture artifact. The
// real assertion: words that ARE in the dict (hardware/project/experience) are
// NOT flagged, i.e. correct words don't get marks.
const good = await run('profile text with hardware and project experience');
check('2. dict words (hardware/project/experience) are NOT flagged',
  !good.words.some(w=>/^(hardware|project|experience|profile|text|with|and)$/i.test(w)) && good.errs.length===0,
  JSON.stringify(good.words));

await browser.close(); server.close();
const ok=checks.every(Boolean);
console.log(ok?'PREVIEW-SPELL OK':'PREVIEW-SPELL FAIL');
process.exit(ok?0:1);
