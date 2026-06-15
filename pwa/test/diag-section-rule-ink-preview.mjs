/* DIAGNOSTIC — SECTION-RULE-INK-MATCH-001 (owner 2026-06-15): the per-ROLE
 * divider line under an experience role title must take the SAME colour as the
 * role TITLE text (mainSubHeadColor), not a fixed teal. Renders an experience
 * section with a distinctive mainSubHeadColor and asserts the role title text
 * colour === the role underline border colour. Run from pwa/. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const base = `http://127.0.0.1:${server.address().port}`;

const SUB='#C4622D';   // distinctive role-title colour = rgb(196, 98, 45)
const SECTIONS={cv:[
  {id:'experience',title:'PROFESSIONAL EXPERIENCE',loc:'main',on:true,type:'experience',roles:[
    {title:'Change Control Lead',company:'Kanzen Konsulenter ApS',years:'2024 — 2026',on:true,bullets:['Owned the change control board.']},
  ]},
],cl:[]};
const PINFO={name:'Gabriel Alexander Karp-Gershon',title:'P',email:'g@example.com',phone:'+45 31',location:'2300, København S',photo:''};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1700}});
await page.addInitScript(({sections,pinfo,sub})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@example.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@example.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify(pinfo));
  localStorage.setItem('language',JSON.stringify('en'));
  localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
  localStorage.setItem('styleConfig',JSON.stringify({mainSubHeadColor:sub}));
},{sections:SECTIONS,pinfo:PINFO,sub:SUB});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3500);

const probe = await page.evaluate(()=>{
  // role title span: the bold italic span whose own text is the role title
  const titleEl=[...document.querySelectorAll('span')].find(e=>[...e.childNodes].some(n=>n.nodeType===3&&/Change Control Lead/.test(n.textContent)));
  if(!titleEl) return {err:'no role title'};
  const titleColor=getComputedStyle(titleEl).color;
  // the underline div: nearest following sibling div with a bottom border, walking up to the role block
  let block=titleEl; for(let i=0;i<6&&block;i++){ if([...block.children].some(c=>c.tagName==='DIV'&&getComputedStyle(c).borderBottomWidth!=='0px')) break; block=block.parentElement; }
  const ruleDiv=block?[...block.querySelectorAll('div')].find(d=>{const cs=getComputedStyle(d); return cs.borderBottomWidth!=='0px' && d.getBoundingClientRect().height<6;}):null;
  return { titleColor, ruleColor: ruleDiv?getComputedStyle(ruleDiv).borderBottomColor:null };
});
await browser.close();
await new Promise(r=>server.close(r));

const WANT='rgb(196, 98, 45)';
console.log('role title colour:', probe.titleColor, '| role underline colour:', probe.ruleColor, probe.err?('ERR '+probe.err):'');
if(errs.length) console.log('pageerrors:', errs.slice(0,3).join(' | '));
const A = probe.titleColor===WANT;
const B = probe.ruleColor===WANT;
const C = probe.titleColor===probe.ruleColor;
const D = errs.length===0;
console.log(`CHECK A (role title takes mainSubHeadColor): ${A?'PASS':'FAIL'}`);
console.log(`CHECK B (role underline takes the same colour): ${B?'PASS':'FAIL'}`);
console.log(`CHECK C (title colour === underline colour): ${C?'PASS':'FAIL'}`);
console.log(`CHECK D (no page errors): ${D?'PASS':'FAIL'}`);
const ok=A&&B&&C&&D;
console.log(ok?'SECTION-RULE-INK-PREVIEW OK (4/4)':'SECTION-RULE-INK-PREVIEW FAIL');
process.exitCode=ok?0:1;
