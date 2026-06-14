/* DIAGNOSTIC — ANALYSIS-SALARY-001 renderer.
 * Injects an analysis (localStorage 'rationale') with a salary_estimate, opens
 * the Analysis view, and verifies the Salary block renders with the value,
 * basis, and (for estimates) the "Market estimate" note.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png' };
const server = http.createServer(async (req,res)=>{
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port; const base = `http://127.0.0.1:${port}`;

const ANALYSIS = {
  company:{name:'Acme A/S',sector:'Tech',size_signal:'mid-size',location:'Copenhagen'},
  role:{title:'Senior Engineer',level:'senior',type:'permanent',keywords:['x']},
  recruiter:null, questions_in_jd:[], language:'en', red_flags:['Deadline imminent'],
  assumptions:[], recommendations:[], confidence_notes:[],
  salary_estimate:{ stated:false, stated_text:null, currency:'DKK', period:'year', low:600000, point:680000, high:760000, basis:'Estimated from senior engineer level in Copenhagen tech market', confidence:0.45 },
  summary:'A senior engineering role.'
};

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1280,height:1500}});
await page.addInitScript(({an})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'x'}],cl:[]}));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Gabriel'}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('rationale',JSON.stringify(an));
},{an:ANALYSIS});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(2500);
// open Analysis view
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/^\s*(📊\s*)?Analysis\s*$/.test((x.textContent||'').trim())); if(b)b.click(); });
await page.waitForTimeout(1500);

const res = await page.evaluate(()=>{
  const body=document.body.textContent||'';
  // find the Salary label block
  const lab=[...document.querySelectorAll('div')].find(d=>/^Salary( \(estimate\))?$/.test((d.textContent||'').trim()));
  let value=null, hasNote=false;
  if(lab){ const sib=lab.nextElementSibling; value=sib?(sib.textContent||'').trim():null; }
  hasNote = /Market estimate — not stated/.test(body);
  return { hasSalaryLabel: !!lab, labelText: lab?(lab.textContent||'').trim():null, value, hasNote, hasBasis:/Estimated from senior engineer/.test(body) };
});
console.log(JSON.stringify(res,null,1));
const checks=[];
const C=(n,ok)=>{checks.push(ok);console.log(`${ok?'PASS':'FAIL'} ${n}`)};
C('Salary (estimate) label renders', res.hasSalaryLabel && /estimate/.test(res.labelText||''));
C('formatted range value renders (DKK 600,000–760,000 / year)', /DKK 600,000.*760,000.*year/.test(res.value||''));
C('basis line renders', res.hasBasis);
C('market-estimate note renders', res.hasNote);
if(errs.length) console.log('pageerrors:',errs.slice(0,3).join(' | '));
await browser.close(); await new Promise(r=>server.close(r));
const ok=checks.every(Boolean); console.log('\n'+(ok?'ANALYSIS-SALARY OK':'ANALYSIS-SALARY FAIL'));
process.exit(ok?0:1);
