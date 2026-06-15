/* DIAGNOSTIC — COPENHAGEN-BLUE-BRIGHTER-001 preview (owner 2026-06-15).
 * Renders the Copenhagen-Modern CV preview PAST the sign-in gate with NO style
 * override, and asserts the candidate band + table header are the brighter blue
 * #33446F = rgb(51,68,111), while the main-column section heading stays the dark
 * navy #283556 = rgb(40,53,86) (parity guard — headings must NOT brighten).
 * Run from pwa/:  node test/diag-copenhagen-blue-preview.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = { cv: [
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'Product and change-governance leader, 15+ years across regulated markets.' },
  { id:'competencies', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[['Focus Area','Strategic Expertise'],['Change governance','Change Control Board ownership.'],['Supplier coordination','RFQ/RFI evaluation and scoring.']] },
  { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', items:['Led RFQ and RFI evaluation programmes.'] },
  { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'text_bullets', items:['Jira, Confluence','Power BI, SQL'] },
], cl: [] };
const PINFO = { name:'Gabriel Alexander Karp-Gershon', title:'Processes • Products • People', email:'g@example.com', phone:'+45 31 71 00 72', location:'2300, København S', photo:'' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1400,height:1700} });
await page.addInitScript(({sections,pinfo})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@example.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@example.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify(pinfo));
  localStorage.setItem('language',JSON.stringify('en'));
  localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
},{sections:SECTIONS,pinfo:PINFO});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3500);

const probe = await page.evaluate(()=>{
  const cs=getComputedStyle(document.body); const g=n=>cs.getPropertyValue(n).trim();
  const band=document.querySelector('[data-antcv-candidate-band]');
  // the name span is the innermost band descendant whose OWN text is the name
  const nameEl=band?[...band.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&/Karp-Gershon/.test(n.textContent))).pop():null;
  // table header cell (Focus Area)
  const th=[...document.querySelectorAll('th,td,div,span')].find(t=>/^Focus Area$/.test((t.textContent||'').trim())&&t.getBoundingClientRect().height>0);
  return {
    headerBgVar: g('--header-bg'), mainHeadVar: g('--main-head-color'),
    bandComputed: band?getComputedStyle(band).backgroundColor:null,
    bandText: nameEl?getComputedStyle(nameEl).color:null,
    thBg: th?getComputedStyle(th).backgroundColor:null,
    thColor: th?getComputedStyle(th).color:null,
  };
});
await browser.close();
await new Promise(r=>server.close(r));

const RGB_BRIGHT='rgb(51, 68, 111)';   // #33446F
const WHITE='rgb(255, 255, 255)';
console.log('--header-bg var :', probe.headerBgVar, '| band computed:', probe.bandComputed, '| band text:', probe.bandText);
console.log('table header    :', probe.thBg, '| text:', probe.thColor, '(must MATCH band)');
console.log('--main-head-color (parity, must stay navy):', probe.mainHeadVar);
if(errs.length) console.log('pageerrors:', errs.slice(0,3).join(' | '));

const A = probe.headerBgVar.toUpperCase()==='#33446F';
const B = probe.bandComputed===RGB_BRIGHT;     // the visible band actually paints the brighter blue
const C = probe.bandText===WHITE;
const D = probe.mainHeadVar.toUpperCase()==='#283556';   // headings stay navy
const E = errs.length===0;
const F = probe.thBg===probe.bandComputed && probe.thBg===RGB_BRIGHT;   // table header BG matches band
const G = probe.thColor===WHITE;                                        // table header text white like band
console.log(`CHECK A (--header-bg = #33446F): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (candidate band paints rgb(51,68,111)): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (band text stays white): ${C?'PASS':'FAIL'}`);
console.log(`CHECK D (main heading var stays navy #283556): ${D?'PASS':'FAIL'}`);
console.log(`CHECK E (no page errors — editor rendered clean): ${E?'PASS':'FAIL'}`);
console.log(`CHECK F (table header BG matches candidate band): ${F?'PASS':'FAIL'}`);
console.log(`CHECK G (table header text white like band): ${G?'PASS':'FAIL'}`);
const ok=A&&B&&C&&D&&E&&F&&G;
console.log(ok?'COPENHAGEN-BLUE-PREVIEW OK (7/7)':'COPENHAGEN-BLUE-PREVIEW FAIL');
process.exitCode = ok?0:1;
