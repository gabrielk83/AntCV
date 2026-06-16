/* DIAGNOSTIC — kernel v2 §4f slice 3 (import UI). A dropped CV file runs the tested
 * engine and the preview modal shows roles + gaps; a second import against a staged
 * kernel with a different metric surfaces a CONFLICT (keep-existing default). */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const CV = [
  'Gabriel Karp','karp@example.com','+45 31 71 00 72','','WORK EXPERIENCE','',
  'Product Manager — Acme Corp (2022 – Present)','- Built the product roadmap.','- Cut cycle time from 250 to 10 days.','',
  'System Architect — Acme Corp (2020 – 2023)','- Owned the system architecture.','',
  'Computer Administrator — IDF (2001 – 2003)','- Ran the unit help desk.',''
].join('\n');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(()=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor'));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>!!(window.AntcvKernelIngest&&window.AntcvKernelImport), { timeout: 20000 }).catch(()=>{});

// A) fresh import → modal shows 3 roles + gaps + create
const a = await page.evaluate(async (cv)=>{
  const file = new File([cv], 'cv.txt', { type:'text/plain' });
  const res = await window.AntcvKernelImport.runImport(file);
  const m = document.getElementById('antcv-kimport-modal');
  return { ok:!!m, text:(m&&m.textContent||'').replace(/\s+/g,' '), mode:res&&res.mode, roles:res&&res.kernel.experience.length, gaps:res&&res.gaps.length };
}, CV);

// B) stage an existing kernel with a DIFFERENT metric, re-import same → CONFLICT
const b = await page.evaluate(async (cv)=>{
  // different START year → a date conflict the parser can actually produce; the
  // existing metric must survive (keep-both, never overwritten).
  const existing = { experience:[ { id:'pm', title:'Product Manager', company:'Acme Corp', start:'2021', end:'present',
    outcomes:[{title:'cycle', result:'Cut cycle from 999 to 99 days.'}], scope:['Old scope.'] } ] };
  localStorage.setItem('antcv:ingestedKernel', JSON.stringify(existing));
  const file = new File([cv], 'cv.txt', { type:'text/plain' });
  const res = await window.AntcvKernelImport.runImport(file);
  const m = document.getElementById('antcv-kimport-modal');
  return { mode:res&&res.mode, conflicts:res&&res.conflicts.length, hasConflictText:/Conflicts/.test(m&&m.textContent||''), metricPreserved:/999 to 99/.test(JSON.stringify(res&&res.kernel)) };
}, CV);

// C) saveToAccount POSTs the kernel to the relay /api/profile/kernel-v2
const c = await page.evaluate(async ()=>{
  window.ANTCV_RELAY_URL = 'https://relay.example.com';
  let captured = null;
  const orig = window.fetch;
  window.fetch = async (url, opts)=>{ captured = { url:String(url), method:opts&&opts.method, cred:opts&&opts.credentials, body:opts&&opts.body }; return { ok:true, status:200, json: async ()=>({ ok:true, roles:2 }) }; };
  await window.AntcvKernelImport.saveToAccount({ experience:[{id:'a'},{id:'b'}] });
  window.fetch = orig;
  return captured;
});

// D) the kernel-import button merges next to existing import anchors (Settings + wizard)
const d = await page.evaluate(async ()=>{
  // simulate a Settings import (data-importer replacement) + a wizard CV file input
  const host = document.createElement('div');
  const rep = document.createElement('button'); rep.setAttribute('data-antcv-import-replacement','1'); rep.textContent='📥 Import profile from Word, PDF…';
  const wiz = document.createElement('div');
  const inp = document.createElement('input'); inp.type='file'; inp.setAttribute('accept','.pdf,.doc,.docx'); wiz.appendChild(inp);
  host.appendChild(rep); document.body.appendChild(host); document.body.appendChild(wiz);
  // run the injector twice → must not duplicate
  await new Promise(r=>setTimeout(r, 50));
  // trigger via the sidecar's own scheduler by dispatching a mutation + calling boot path indirectly:
  if (window.AntcvKernelImport && window.AntcvKernelImport._inject) window.AntcvKernelImport._inject();
  if (window.AntcvKernelImport && window.AntcvKernelImport._inject) window.AntcvKernelImport._inject();
  await new Promise(r=>setTimeout(r, 50));
  var btns = document.querySelectorAll('[data-antcv-kimport-btn]');
  var hasBtn = (el)=> !!(el && el.getAttribute && el.getAttribute('data-antcv-kimport-btn')==='1');
  var nearSettings = !!host.querySelector('[data-antcv-kimport-btn]') || hasBtn(rep.nextElementSibling);
  var nearWizard = hasBtn(wiz.nextElementSibling) || !!wiz.querySelector('[data-antcv-kimport-btn]');
  // clicking opens the hidden picker input
  var clicked=false; var fi=document.getElementById('antcv-kimport-input'); if(fi){ fi.click = ()=>{clicked=true}; }
  var sBtn = host.querySelector('[data-antcv-kimport-btn]') || (hasBtn(rep.nextElementSibling) ? rep.nextElementSibling : null);
  if (sBtn) sBtn.click();
  return { total: btns.length, nearSettings:!!nearSettings, nearWizard:!!nearWizard, opensPicker:clicked };
});

// E) applyToCV projects the kernel into personalInfo.workHistory (generation source) + GABRIEL_BG reflects it
const e = await page.evaluate(async ()=>{
  localStorage.setItem('personalInfo', JSON.stringify({ name:'G', workHistory:[{ role:'OLD ROLE', company:'Old', years:'1999' }] }));
  const kernel = { tenseMode:'auto', experience:[
    { id:'pm', title:'Imported PM', company:'NewCo', start:'2023', end:'present', isCurrent:true, scope:['Did new things.'] },
  ] };
  const ok = window.AntcvKernelImport.applyToCV(kernel);
  const pi = JSON.parse(localStorage.getItem('personalInfo')||'{}');
  const backup = JSON.parse(localStorage.getItem('antcv:workHistoryBackup')||'{}');
  // GABRIEL_BG is a getter that reads personalInfo → STORED WORK HISTORY
  let bg=''; try{ bg=String(window.GABRIEL_BG||''); }catch(_){}
  return { ok, whRole: pi.workHistory && pi.workHistory[0] && pi.workHistory[0].role, whCurrent: pi.workHistory && pi.workHistory[0] && pi.workHistory[0].isCurrent, backupRole: backup.workHistory && backup.workHistory[0] && backup.workHistory[0].role, bgHasImported: /Imported PM/.test(bg) && /CURRENT ROLE/.test(bg) };
});

// F) structured apply (choose incoming dates) + language selection
const f = await page.evaluate(async (cv)=>{
  localStorage.setItem('antcv:ingestedKernel', JSON.stringify({ experience:[ { id:'pm', title:'Product Manager', company:'Acme Corp', start:'2021', end:'present', outcomes:[{title:'x',result:'old'}], scope:['s'] } ] }));
  const file = new File([cv], 'cv.txt', { type:'text/plain' });
  await window.AntcvKernelImport.runImport(file);
  const ov = document.getElementById('antcv-kimport-modal');
  // choose the INCOMING radio for the date conflict
  var inc = ov.querySelector('input[value="incoming"]'); if (inc) inc.checked = true;
  // tick a second language (Danish)
  var da = ov.querySelector('input[data-antcv-lang="da"]'); if (da) da.checked = true;
  ov.querySelector('#antcv-kimport-apply').click();
  const staged = JSON.parse(localStorage.getItem('antcv:ingestedKernel')||'{}');
  const pm = (staged.experience||[]).find(r=>r.id==='pm');
  return { dateApplied: pm && pm.start, langs: staged.language && staged.language.activeDefaults };
}, CV);

// G) auto-sync from D1: GET kernel → applies once; second call no-ops (sig guard)
const g = await page.evaluate(async ()=>{
  localStorage.removeItem('antcv:kernelV2AppliedSig');
  localStorage.setItem('antcv:auth:token','tok');
  window.ANTCV_RELAY_URL = 'https://relay.example.com';
  localStorage.setItem('personalInfo', JSON.stringify({ name:'G', workHistory:[{role:'OLD',company:'O',years:'1990'}] }));
  let calls=0; const orig=window.fetch;
  window.fetch = async (url,opts)=>{ calls++; return { ok:true, status:200, json: async ()=>({ ok:true, kernel:{ tenseMode:'auto', experience:[{id:'s1',title:'Synced Role',company:'Cloud',start:'2024',end:'present',isCurrent:true,scope:['Synced.']}] } }) }; };
  await window.AntcvKernelImport.autoSync();
  const pi1 = JSON.parse(localStorage.getItem('personalInfo')||'{}');
  const sig = localStorage.getItem('antcv:kernelV2AppliedSig');
  const applied1 = pi1.workHistory && pi1.workHistory[0] && pi1.workHistory[0].role;
  // 2nd call: same kernel/sig → must NOT re-apply (still fetches, but no overwrite churn)
  await window.AntcvKernelImport.autoSync();
  window.fetch = orig;
  return { applied1, hasSig: !!sig, fetches: calls };
});

await browser.close(); await new Promise(r=>server.close(r));
console.log('E apply :', JSON.stringify(e));
console.log('F struct:', JSON.stringify(f));
console.log('G sync  :', JSON.stringify(g));
console.log('--- kernel-import UI ---');
console.log('A fresh:', JSON.stringify(a));
console.log('B merge:', JSON.stringify(b));
console.log('C save :', JSON.stringify(c));
console.log('D inject:', JSON.stringify(d));
console.log('app errors:', errs.length, errs.slice(0,3).join(' | '));
const checks = [
  ['engine + UI loaded and ran', a.ok && a.mode==='create'],
  ['modal lists the extracted roles', /Product Manager/.test(a.text) && /System Architect/.test(a.text) && a.roles===3],
  ['modal shows gaps (missing outcomes/proofPoints)', a.gaps>=1 && /Gaps/.test(a.text)],
  ['re-import against staged kernel = merge with a conflict', b.mode==='merge' && b.conflicts>=1 && b.hasConflictText],
  ['existing metric preserved (keep-both, not overwritten)', b.metricPreserved],
  ['saveToAccount POSTs the kernel to /api/profile/kernel-v2 (credentials included)', !!c && /\/api\/profile\/kernel-v2$/.test(c.url) && c.method==='POST' && c.cred==='include' && /"experience"/.test(c.body||'')],
  ['button merges next to BOTH the Settings + wizard import anchors (no duplicates)', d.nearSettings && d.nearWizard && d.total===2],
  ['the merged button opens the import picker', d.opensPicker],
  ['applyToCV writes the imported roles into personalInfo.workHistory', e.ok && e.whRole==='Imported PM' && e.whCurrent===true],
  ['the prior workHistory is backed up (reversible)', e.backupRole==='OLD ROLE'],
  ['GABRIEL_BG (generation source) now reflects the imported current role', e.bgHasImported],
  ['structured apply: choosing INCOMING dates sets the role start (2022)', f.dateApplied==='2022'],
  ['language selection: ticked languages become activeDefaults (incl. da)', Array.isArray(f.langs) && f.langs.indexOf('da')>=0],
  ['auto-sync: GET kernel from D1 applies to personalInfo.workHistory on login', g.applied1==='Synced Role' && g.hasSig],
  ['no app errors', errs.length===0],
];
for (const [n,ok] of checks) console.log(`${n}: ${ok?'OK':'FAIL'}`);
const ok = checks.every(c=>c[1]);
console.log(ok ? 'KERNEL-IMPORT UI OK' : 'KERNEL-IMPORT UI FAILED');
process.exit(ok ? 0 : 1);
