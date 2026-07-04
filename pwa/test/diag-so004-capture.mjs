/* DIAGNOSTIC — SO-004 CAPTURE (React prod #185 = "Maximum update depth exceeded")
 *
 * GOAL: reproduce the setState/render loop that the owner hits live on Android
 * Chrome when COMMITTING editor field edits (section panel / candidate header /
 * CL editors), and CAPTURE the exact runaway setter's caller stack so the
 * looping effect/handler can be mapped back to app.src.js and guarded.
 *
 * Two prior #185 loops are already fixed (salmon repaint ~16447 rAF+snapshot;
 * photo autosizer ~18922 dead-band). SO-004 is a THIRD instance on FIELD
 * COMMITS. Prior repros (diag-so004-185-repro / diag-react185-regulatory) NO-
 * REPRO because they never actually mounted the side-panel Te field editors.
 *
 * This probe:
 *   1. Boots owner-shaped, DESKTOP width (Ii true → real side panel).
 *   2. Instruments React.useState / React.useReducer BEFORE ReactDOM renders:
 *      every dispatch is wrapped to count calls per animation frame; when any
 *      single setter fires > THRESHOLD in one frame, it captures new Error().
 *      stack (the CALLER stack) once and prints it. Also a pageerror listener
 *      for /Maximum update depth|#185/.
 *   3. Opens the section-panel editor for each section type (co+ti('edit') via
 *      the row gray-area click, with a direct fallback), and HAMMERS commits:
 *      types into every Te textarea/input, blur+Enter, toggles rows, and cycles
 *      core_comp / outcomes item counts. Repeats for candidate header (name_
 *      block / spec_block) and the CL doc.
 *
 * Exit 1 = REPRODUCED (error captured OR runaway-setter threshold tripped),
 * with the stack printed. Exit 0 = NO-REPRO under this load.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

const mkSections = ()=>({cv:[
  {id:'name_block',title:'NAME',loc:'main',on:true,type:'name_block',content:'Anita Tester'},
  {id:'spec_block',title:'SPECIALISATION',loc:'main',on:true,type:'spec_block',content:'Optics — Change Governance'},
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'Profile text here. '.repeat(6)},
  {id:'outcomes',title:'SELECTED OUTCOMES',loc:'main',on:true,type:'bullets',items:[
    {b:'Cut',t:'cycle time 95%.'},{b:'Ran',t:'two re-certifications.'},{b:'Built',t:'the validation lab.'},
  ]},
  {id:'core_comp',title:'CORE COMPETENCIES',loc:'main',on:true,type:'table',rows:[
    ['Focus Area','Strategic Expertise'],['ChangeGov','Boards'],['Safety','ISO 26262'],['Delivery','On time'],
  ]},
  {id:'regulatory',title:'REGULATORY CONTEXT',loc:'sidebar',on:true,type:'labeled_list',items:[
    {group:'Systems'},{l:'ASPICE',v:'process'},{l:'ISO 26262',v:'safety'},
  ]},
],cl:[
  {id:'name_block',title:'NAME',loc:'main',on:true,type:'name_block',content:'Anita Tester'},
  {id:'spec_block',title:'APPLICATION',loc:'main',on:true,type:'spec_block',content:'NPD Project Manager - Kvadrat'},
  {id:'who',title:'WHO I AM',loc:'main',on:true,type:'text',content:'Who text here. '.repeat(6)},
  {id:'why',title:'WHY THIS ROLE',loc:'main',on:true,type:'text',content:'Why text here. '.repeat(6)},
]});

// Instrument installed BEFORE React loads. Wraps useState/useReducer dispatch
// to count per-frame invocations and capture the caller stack on runaway.
function instrument(THRESHOLD){
  window.__SO004 = { tripped:null, stacks:[], maxPerFrame:0, totalDispatch:0, wrapCount:0 };
  const S = window.__SO004;
  let frameId = 0;
  // reset counters each animation frame
  // Counter keyed on the ORIGINAL dispatch identity (React returns the same
  // dispatch fn across renders for a given state slot), so a re-render loop that
  // keeps calling the SAME setter accumulates in one frame. Also cache the
  // wrapper per original dispatch so identity is stable across renders.
  const counters = new Map(); // origDispatch -> count (reset each frame)
  const wrapCache = new WeakMap(); // origDispatch -> wrapped
  function tick(){ counters.clear(); frameId++; requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  function wrapDispatch(orig, label){
    if(typeof orig !== 'function') return orig;
    const cached = wrapCache.get(orig);
    if(cached) return cached;
    S.wrapCount++;
    const wrapped = function(){
      S.totalDispatch++;
      const c = (counters.get(orig)||0) + 1;
      counters.set(orig, c);
      if(c > S.maxPerFrame) S.maxPerFrame = c;
      if(c > THRESHOLD && !S.tripped){
        S.tripped = { label, count:c, frame:frameId };
        try { S.tripped.stack = new Error('SO004-runaway-setter').stack; } catch(_){}
        try { S.stacks.push(new Error().stack); } catch(_){}
      }
      return orig.apply(this, arguments);
    };
    wrapCache.set(orig, wrapped);
    return wrapped;
  }
  // React UMD prod builds an EMPTY React object, assigns it to window.React,
  // THEN populates React.useState / React.useReducer. So we cannot wrap at the
  // moment of window.React assignment (the hooks don't exist yet). Instead we
  // define ACCESSOR traps for useState/useReducer ON the React object: whatever
  // real function React later assigns is stored, and every READ returns a
  // wrapper. app.js reads React.useState at module-eval time (aliases it into a
  // local), so the alias becomes our wrapper — capturing every dispatch.
  function installHookTrap(R, name, label){
    let real = R[name];
    let wrappedHook = null;
    function makeWrappedHook(fn){
      const wh = function(){
        const r = fn.apply(this, arguments);
        try {
          if(Array.isArray(r) && typeof r[1]==='function') return [r[0], wrapDispatch(r[1], label)];
        } catch(_){}
        return r;
      };
      return wh;
    }
    if(typeof real === 'function') wrappedHook = makeWrappedHook(real);
    try {
      Object.defineProperty(R, name, {
        configurable: true,
        enumerable: true,
        get(){ return wrappedHook || real; },
        set(v){ real = v; wrappedHook = (typeof v==='function') ? makeWrappedHook(v) : null; },
      });
    } catch(_){}
  }
  function patchObj(R){
    if(!R || R.__so004Patched) return false;
    installHookTrap(R, 'useState', 'useState');
    installHookTrap(R, 'useReducer', 'useReducer');
    R.__so004Patched = true;
    window.__SO004_PATCHED = true;
    return true;
  }
  if(window.React){ patchObj(window.React); }
  else {
    let _R;
    try {
      Object.defineProperty(window, 'React', {
        configurable: true,
        get(){ return _R; },
        set(v){ _R = v; try { patchObj(v); } catch(_){} },
      });
    } catch(_){
      const iv = setInterval(()=>{ if(window.React && patchObj(window.React)) clearInterval(iv); }, 1);
      setTimeout(()=>clearInterval(iv), 8000);
    }
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1500, height:1100 } });

// Block only real backend calls; let unpkg (React) AND relay-config.json through.
// Aborting relay-config.json trips window.ANTCV_RELAY_CONFIG_ERROR → the app
// renders the "temporarily unavailable" gate and never mounts the editor.
await page.route('**/*', route=>{
  const u = route.request().url();
  if(/relay-config\.json/i.test(u)) return route.continue();
  if(/unpkg\.com|cdnjs|jsdelivr/i.test(u)) return route.continue();
  if(/\.workers\.dev|\/api\/(prefs|sync|jd|llm|analysis|apply|generate-pdf|generate-docx|sign)/i.test(u)) return route.abort();
  return route.continue();
});
page.on('dialog', d=>d.dismiss().catch(()=>{}));

const errs = [];
page.on('pageerror', e=>{ const m=String(e&&e.message||e); errs.push(m); });
page.on('console', m=>{ const t=m.text(); if(/error #185|Maximum update depth/i.test(t)) errs.push('console: '+t.slice(0,240)); });

const sections = mkSections();

async function seedAndBoot(doc){
  await page.addInitScript(({secs,doc,THRESHOLD,instr})=>{
    // re-run instrument on every navigation (addInitScript persists, but we set fresh state)
    try { (new Function('THRESHOLD', instr))(THRESHOLD); } catch(_){}
    localStorage.setItem('antcv:auth:token','t');
    localStorage.setItem('antcv:auth:email','d@e.com');
    localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));
    localStorage.setItem('doc',JSON.stringify(doc));
    localStorage.setItem('sections',JSON.stringify(secs));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita Tester',email:'a@t.dk'}));
    localStorage.setItem('meta',JSON.stringify({role:'NPD Project Manager',company:'Kvadrat',subtitle:''}));
    // Configure a relay URL + api key so the "temporarily unavailable" config
    // gate (app.src.js ~29573: (!re||!re.trim()) && (!d||ANTCV_RELAY_CONFIG_ERROR))
    // does NOT fire and the editor mounts.
    window.ANTCV_RELAY_URL = 'http://127.0.0.1:0/relay-stub';
    try {
      const pj = JSON.parse(localStorage.getItem('antcv:prefs')||'{}');
      pj.apiKey = 'sk-diag-stub'; pj.provider = 'anthropic';
      localStorage.setItem('antcv:prefs', JSON.stringify(pj));
    } catch(_){}
  },{secs:sections,doc,THRESHOLD:50,instr:'('+instrument.toString()+')(THRESHOLD)'});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
}

// open the editor for a given section id and hammer its fields
async function hammerSection(label){
  return await page.evaluate(async ({label})=>{
    const out = { label, opened:false, editTab:false, fields:0, edits:0, note:'' };
    const sleep = ms=>new Promise(r=>setTimeout(r,ms));
    // ensure the Sections tab is active first
    const sectBtn = [...document.querySelectorAll('button')].find(b=>/☰\s*Sections/.test(b.textContent||''));
    if(sectBtn) sectBtn.click();
    await sleep(500);
    // find the row for this label
    const row = [...document.querySelectorAll('[data-section-row-index]')].find(r=>new RegExp(label,'i').test(r.textContent||''));
    if(!row){ out.note='row-not-found'; return out; }
    // click the row GRAY AREA (avoid buttons/title): click the row element itself
    // at a point that is not a button/input/title. Dispatch a real click on the row.
    const guard = 'button,input,textarea,select,[contenteditable="true"]';
    // pick a child div that is NOT inside a button/input/title
    let target = row;
    const kids = [...row.querySelectorAll('div')].filter(d=>!d.closest(guard) && !d.isContentEditable);
    if(kids.length) target = kids[kids.length-1];
    target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    await sleep(700);
    // detect edit tab: the panel now shows the Te editor (Back button). Cover BOTH
    // the desktop side panel AND the mobile bottom panel (owner is on Android).
    const panelSel = '.antcv-editor-side-panel, .antcv-mobile-bottom-panel, [data-antcv-app-panel]';
    const backBtn = [...document.querySelectorAll(panelSel+' button')].find(b=>/←\s*Back/.test(b.textContent||''));
    out.editTab = !!backBtn;
    out.opened = true;
    if(!out.editTab){
      // fallback: row onClick may have hit a guarded child. Try clicking the row directly.
      row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      await sleep(700);
      const b2 = [...document.querySelectorAll(panelSel+' button')].find(b=>/←\s*Back/.test(b.textContent||''));
      out.editTab = !!b2;
    }
    // gather Te fields inside the panel (desktop side panel or mobile bottom panel)
    const panel = document.querySelector('.antcv-editor-side-panel')
      || document.querySelector('[data-antcv-app-panel="desktop-side-panel"]')
      || document.querySelector('.antcv-mobile-bottom-panel')
      || document.querySelector('[data-antcv-app-panel="mobile-bottom-panel"]');
    let fields = panel ? [...panel.querySelectorAll('textarea, input[type="text"], input:not([type])')] : [];
    fields = fields.filter(f=>f.offsetParent);
    out.fields = fields.length;
    if(!fields.length){ out.note = out.editTab ? 'edit-tab-no-fields' : 'no-edit-tab'; }
    // native setter helper
    const setVal=(el,v)=>{
      const proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const d = Object.getOwnPropertyDescriptor(proto,'value');
      d.set.call(el, v);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    };
    // HAMMER: rapid sequential commits across every field
    for(const f of fields.slice(0,10)){
      f.focus();
      for(let i=0;i<30;i++){ setVal(f, (f.value||'x')+'!'); }
      f.dispatchEvent(new Event('change',{bubbles:true}));
      f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      f.blur(); f.dispatchEvent(new Event('blur',{bubbles:true}));
      out.edits++;
      await sleep(30);
      if(window.__SO004 && window.__SO004.tripped){ out.note='TRIPPED-during-field'; break; }
    }
    // cycle add/remove item buttons (outcomes/table) which change item counts
    const addBtns = panel ? [...panel.querySelectorAll('button')].filter(b=>/\+|add|row|item/i.test(b.textContent||'')) : [];
    for(const b of addBtns.slice(0,4)){
      for(let i=0;i<6;i++){ try{ b.click(); }catch(_){} }
      await sleep(40);
      if(window.__SO004 && window.__SO004.tripped){ out.note='TRIPPED-during-additem'; break; }
    }
    return out;
  }, {label});
}

async function toggleRowsBurst(){
  return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    // toggle on/off buttons (green ●) across rows rapidly
    const rows=[...document.querySelectorAll('[data-section-row-index]')];
    let toggled=0;
    for(const row of rows){
      const btns=[...row.querySelectorAll('button')];
      const toggle=btns[btns.length-1];
      if(toggle){ for(let i=0;i<4;i++){ toggle.click(); } toggled++; await sleep(30); }
      if(window.__SO004 && window.__SO004.tripped) break;
    }
    return { toggled };
  });
}

// PREVIEW-REFLOW hammer: the page-break overlay component Oe (app.src.js ~10704)
// runs a dep-less useEffect that measures .antcv-preview-paper scrollHeight and
// setStates it UNCONDITIONALLY (no dead-band). If content height oscillates
// around the 1123px page boundary, that effect can loop (#185). Drive it by
// editing preview-inline text to push total height back and forth across the
// boundary, and by resizing the paper content live.
async function previewReflowHammer(){
  return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const out={ mode:'preview-reflow', editableFound:0, cycles:0, note:'' };
    // switch to preview tab
    const prevBtn=[...document.querySelectorAll('button')].find(b=>/👁\s*Preview/.test(b.textContent||''));
    if(prevBtn) prevBtn.click();
    await sleep(600);
    const paper=document.querySelector('.antcv-preview-paper,[data-antcv-preview-paper]');
    out.paperPresent=!!paper;
    // inline-editable spans in the preview
    let spans=[...document.querySelectorAll('.antcv-preview-paper [data-antcv-editable-text],.antcv-preview-paper [contenteditable="true"]')];
    spans=spans.filter(s=>s.offsetParent);
    out.editableFound=spans.length;
    // grow a text span with lots of content, then shrink, repeatedly, to cross
    // the 1123px page boundary and force the Oe measure->setState to re-fire.
    const target=spans.find(s=>/[A-Za-z]/.test(s.textContent||''))||spans[0];
    const grow='word '.repeat(120);
    for(let c=0;c<14;c++){
      try{
        if(target){
          target.focus();
          target.textContent=(c%2===0)?(target.textContent+grow):(target.textContent.replace(grow,''));
          target.dispatchEvent(new Event('input',{bubbles:true}));
          target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
          target.blur(); target.dispatchEvent(new Event('blur',{bubbles:true}));
        }
        // also nudge paper min-height so scrollHeight lands right on 1123 ± ε
        if(paper){ paper.style.minHeight=(1120+(c%3))+'px'; }
      }catch(_){}
      out.cycles++;
      await sleep(60);
      if(window.__SO004 && window.__SO004.tripped){ out.note='TRIPPED'; break; }
    }
    if(paper) paper.style.minHeight='';
    return out;
  });
}

// Force many app re-renders (Oe re-runs its dep-less effect each render) by
// rapidly toggling zoom / preview, and check whether Oe's setter accumulates.
async function rerenderStormHammer(){
  return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const btns=[...document.querySelectorAll('button')];
    const zoomIn=btns.find(b=>b.textContent.trim()==='+');
    const zoomOut=btns.find(b=>b.textContent.trim()==='−');
    let n=0;
    for(let i=0;i<20;i++){
      try{ (i%2?zoomOut:zoomIn)?.click(); }catch(_){}
      n++;
      await sleep(30);
      if(window.__SO004 && window.__SO004.tripped) break;
    }
    return { zoomToggles:n };
  });
}

async function snapshotState(){
  return await page.evaluate(()=>({
    patched: !!window.__SO004_PATCHED,
    tripped: window.__SO004 ? window.__SO004.tripped : null,
    maxPerFrame: window.__SO004 ? window.__SO004.maxPerFrame : 0,
    totalDispatch: window.__SO004 ? window.__SO004.totalDispatch : -1,
    wrapCount: window.__SO004 ? window.__SO004.wrapCount : -1,
    useStateIsWrapped: !!(window.React && window.React.__so004Patched),
    stacks: window.__SO004 ? window.__SO004.stacks.slice(0,3) : [],
    rootEmpty: !!document.querySelector('#root') && document.getElementById('root').children.length===0,
  }));
}

const results = [];

// ── CV doc ─────────────────────────────────────────────────────────
await seedAndBoot('cv');
{
  // Boot sanity: the "temporarily unavailable" config gate would produce a false
  // NO-REPRO (editor never mounts). Open the Sections tab first, then confirm the
  // section rows rendered. Fail loudly if the editor did not mount.
  const booted = await page.evaluate(async ()=>{
    const sectBtn = [...document.querySelectorAll('button')].find(b=>/☰\s*Sections/.test(b.textContent||''));
    if(sectBtn) sectBtn.click();
    await new Promise(r=>setTimeout(r,500));
    return {
      rows: [...document.querySelectorAll('[data-section-row-index]')].length,
      gate: /temporarily unavailable/i.test(document.body.innerText||''),
    };
  });
  if(booted.gate || booted.rows===0){
    console.log('BOOT WARNING — editor not mounted (gate:'+booted.gate+', rows:'+booted.rows+'). Results below may be a false NO-REPRO.');
  }
  results.push({ doc:'cv', patched: (await page.evaluate(()=>!!window.__SO004_PATCHED)), rows: booted.rows });
}
for(const label of ['CORE COMPETENCIES','SELECTED OUTCOMES','PROFILE','REGULATORY','SPECIAL','NAME']){
  const r = await hammerSection(label);
  results.push(r);
  const s = await snapshotState();
  if(s.tripped || errs.length){ break; }
}
await toggleRowsBurst();
// REAL keyboard typing into the opened desktop panel (faithful controlled-input
// reconciliation, unlike synthetic input events). Open CORE COMPETENCIES again
// and type via Playwright keyboard into each field, rapid-fire.
await hammerSection('CORE COMPETENCIES');
{
  const boxes = page.locator('.antcv-editor-side-panel textarea, .antcv-editor-side-panel input[type="text"]');
  const n = Math.min(await boxes.count(), 6);
  let typed = 0;
  for(let i=0;i<n;i++){
    try{
      await boxes.nth(i).click({timeout:1500});
      for(let k=0;k<20;k++){ await page.keyboard.type('x'); }
      await page.keyboard.press('Enter');
      await boxes.nth(i).blur().catch(()=>{});
      typed++;
    }catch(_){}
    const s = await snapshotState(); if(s.tripped || errs.length) break;
  }
  results.push({ phase:'real-keyboard-cv', typedFields: typed });
}
results.push(Object.assign({phase:'preview-reflow-cv'}, await previewReflowHammer()));
results.push(Object.assign({phase:'rerender-storm-cv'}, await rerenderStormHammer()));
let stateCV = await snapshotState();

// ── CL doc (only if not yet tripped) ───────────────────────────────
let stateCL = null;
if(!stateCV.tripped && !errs.length){
  await seedAndBoot('cl');
  for(const label of ['WHO','WHY','APPLICATION','NAME']){
    const r = await hammerSection(label);
    results.push(Object.assign({doc:'cl'}, r));
    const s = await snapshotState();
    if(s.tripped || errs.length) break;
  }
  await toggleRowsBurst();
  results.push(Object.assign({phase:'preview-reflow-cl'}, await previewReflowHammer()));
  stateCL = await snapshotState();
}

// ── MOBILE viewport (owner hits SO-004 on Android Chrome; Ii=false path) ──
let stateMobile = null;
if(!stateCV.tripped && !(stateCL&&stateCL.tripped) && !errs.length){
  await page.setViewportSize({ width:390, height:844 });
  await seedAndBoot('cv');
  // mobile: open bottom panel editors + hammer, then preview reflow
  for(const label of ['CORE COMPETENCIES','SELECTED OUTCOMES']){
    const r = await hammerSection(label);
    results.push(Object.assign({vp:'mobile'}, r));
    const s = await snapshotState();
    if(s.tripped || errs.length) break;
  }
  results.push(Object.assign({phase:'preview-reflow-mobile'}, await previewReflowHammer()));
  stateMobile = await snapshotState();
}

await page.waitForTimeout(1500);
const finalState = await snapshotState();

console.log('=== SO-004 CAPTURE RESULTS ===');
console.log('sections opened / fields found:');
for(const r of results) console.log('  ', JSON.stringify(r));
console.log('maxPerFrame (any single setter, highest observed):', finalState.maxPerFrame);
console.log('totalDispatch (all wrapped setter calls):', finalState.totalDispatch, '| wrapCount (setters wrapped):', finalState.wrapCount, '| React.__so004Patched:', finalState.useStateIsWrapped);
console.log('patched dispatcher:', finalState.patched);
console.log('rootEmpty (blue screen):', finalState.rootEmpty);
console.log('pageerrors:', errs.length);
for(const e of errs.slice(0,6)) console.log('  ERR:', e.slice(0,300));
const tripped = finalState.tripped || (stateMobile&&stateMobile.tripped) || (stateCL && stateCL.tripped) || stateCV.tripped;
if(tripped){
  console.log('--- RUNAWAY SETTER TRIPPED ---');
  console.log('label:', tripped.label, 'count-in-frame:', tripped.count);
  console.log('CALLER STACK:\n'+(tripped.stack||'(none)'));
}
if(finalState.stacks && finalState.stacks.length){
  console.log('--- extra stacks ---');
  finalState.stacks.forEach((s,i)=>console.log(`[stack ${i}]\n`+String(s).slice(0,1200)));
}

await browser.close(); server.close();
const repro = errs.some(e=>/185|Maximum update depth/i.test(e)) || !!tripped || finalState.rootEmpty;
console.log(repro ? 'SO-004 REPRODUCED' : 'SO-004 NO-REPRO under panel-field-commit hammering');
process.exit(repro ? 1 : 0);
