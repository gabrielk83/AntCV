/* VERIFICATION — LANGUAGES-CONCISE-001. The CV languages section's verbose proficiency values are
 * trimmed to their concise core: native stays native, "full professional, Uruguayan variant" →
 * professional, "B1, Prøve i dansk 2" → intermediate. Idempotent (already-concise = fixpoint). */
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
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'P' },
  { id:'languages', title:'LANGUAGES', loc:'sidebar', on:true, type:'labeled_list', items:[
    { l:'English', v:'native' },
    { l:'Hebrew', v:'native' },
    { l:'Spanish', v:'full professional, Uruguayan variant' },
    { l:'Danish', v:'B1, Prøve i dansk 2' },
    // simulate an already-over-cropped value whose CEFR must be RESTORED from personalInfo.additional
    { l:'German', v:'intermediate' },
  ] },
], cl:[] };
const personalInfo = { name:'Gabriel', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' },
  additional:[ { l:'German', v:'B2, Goethe-Zertifikat' } ] };

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
  const lang = (secs.cv||[]).find(s=>s.id==='languages')||{};
  const fn = window.AntcvLanguagesConcise && window.AntcvLanguagesConcise.concise;
  return { vals: (lang.items||[]).map(it=>({l:it.l, v:it.v})),
    // idempotency: re-applying concise to outputs must be a fixpoint
    fixpoint: fn ? (lang.items||[]).every(it=>fn(it.v)===it.v) : null };
});
await browser.close(); await new Promise(rr=>server.close(rr));

console.log('languages:', JSON.stringify(r.vals));
console.log('app errors:', errs.length, errs.slice(0,2).join(' | '));
const get = (l)=> (r.vals.find(x=>x.l===l)||{}).v;

let pass=true; const fails=[];
if (errs.length) { pass=false; fails.push('app errors: '+errs.slice(0,2).join(' | ')); }
// LANG-NATIVE-FLUENT-001 (owner 2026-06-23): native reads "native / fluent".
if (get('English') !== 'native / fluent') { pass=false; fails.push('English should read native / fluent, got '+get('English')); }
if (get('Hebrew') !== 'native / fluent') { pass=false; fails.push('Hebrew should read native / fluent, got '+get('Hebrew')); }
if (get('Spanish') !== 'professional') { pass=false; fails.push('Spanish should be professional, got '+get('Spanish')); }
if (get('Danish') !== 'intermediate (B1)') { pass=false; fails.push('Danish should keep B1 → "intermediate (B1)", got '+get('Danish')); }
if (get('German') !== 'intermediate (B2)') { pass=false; fails.push('German bare value should restore CEFR from source → "intermediate (B2)", got '+get('German')); }
if (r.fixpoint !== true) { pass=false; fails.push('concise() not idempotent on its own output'); }
console.log('\n'+(pass?'PASS':'FAIL')+' — LANGUAGES-CONCISE-001');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  English/Hebrew native; Spanish professional; Danish intermediate; idempotent; zero app errors.');
