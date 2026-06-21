/* VERIFICATION — rich_block + list_italic section-row controls. After conversion, a rich_block
 * section (and the richPub list_italic) must still expose the full section-row control set in the
 * editor list: move (loc) · reorder (▲▼) · Enrich · Fit · ON (visibility) · delete · CJLR.
 * Also confirms closure (kept as text) honours the same set. */
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
  { id:'pubs', title:'PUBLICATIONS & PATENTS', loc:'main', on:true, type:'list_italic', richPub:true, items:['A — x, 2009'] },
], cl:[
  { id:'greeting', title:'Greeting', loc:'main', on:true, type:'text', content:'Dear Team,' },
  { id:'why', title:'WHY THIS POSITION', loc:'main', on:true, type:'text', content:'Why text.' },
  { id:'closure', title:'Closure', loc:'main', on:true, type:'text', content:'I would welcome the chance to discuss how I can contribute to the team.' },
] };
const personalInfo = { name:'Anita', headline:'X', email:'a@e.com', phone:'+45', location:'CPH', stylePrefs:{ style:'nordic-minimal' } };

const browser = await chromium.launch();
async function rowsFor(doc){
  const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.addInitScript(([secs, pi, d])=>{
    localStorage.setItem('antcv:auth:token','d'); localStorage.setItem('antcv:auth:email','d@e.com'); localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session', JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify(d));
    localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  }, [sections, personalInfo, doc]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/Sections/i.test(b.textContent||'')); if(b) b.click(); });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(()=>{
    return [...document.querySelectorAll('[data-section-row-loc]')].map(row=>{
      const titles=[...row.querySelectorAll('button')].map(b=>(b.title||b.textContent||'').trim());
      const has=(re)=>titles.some(t=>re.test(t));
      const txt=(re)=>[...row.querySelectorAll('button')].some(b=>re.test(b.textContent||''));
      return { label:(row.textContent||'').replace(/\s+/g,' ').slice(0,24),
        move:has(/Move .* to the/i) || txt(/◀|▶/), reorder:txt(/▲|▼/),
        enrich:has(/Enrich this section/i), fit:has(/Fit this section/i), on:txt(/^(ON|OFF)$/),
        del:txt(/✕/), cjlr:has(/CJLR/i) };
    });
  });
  const e = errs.slice(); await page.close();
  return { info, errs:e };
}

const cl = await rowsFor('cl');
const cv = await rowsFor('cv');
await browser.close(); await new Promise(r=>server.close(r));

const why = cl.info.find(r=>/WHY/i.test(r.label));
const closure = cl.info.find(r=>/Closure/i.test(r.label));
const pubs = cv.info.find(r=>/PUBLICATIONS/i.test(r.label));
console.log('why (rich_block):', JSON.stringify(why));
console.log('closure (text):', JSON.stringify(closure));
console.log('pubs (list_italic):', JSON.stringify(pubs));
console.log('errors:', cl.errs.length + cv.errs.length);

// core controls every section must have (the conversion regression dropped enrich/fit on rich_block).
const core = (r)=> r && r.reorder && r.enrich && r.fit && r.on && r.del && r.cjlr;
let pass=true; const fails=[];
if (cl.errs.length || cv.errs.length) { pass=false; fails.push('app errors'); }
if (!core(why)) { pass=false; fails.push('WHY (rich_block) missing core section-row controls: '+JSON.stringify(why)); }
if (!core(closure)) { pass=false; fails.push('closure (text) missing core section-row controls: '+JSON.stringify(closure)); }
if (!core(pubs)) { pass=false; fails.push('pubs (list_italic) missing core section-row controls: '+JSON.stringify(pubs)); }
// CV sections must also expose the main<->sidebar move (◀/▶); CL is single-column so no sidebar move.
if (!pubs || !pubs.move) { pass=false; fails.push('pubs (CV) missing main↔sidebar move: '+JSON.stringify(pubs)); }
console.log('\n'+(pass?'PASS':'FAIL')+' — rich_block / list_italic / closure section-row controls');
if (!pass) { fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('  rich_block, list_italic (richPub) and closure all expose move/reorder/enrich/fit/on/delete/CJLR in the section list.');
