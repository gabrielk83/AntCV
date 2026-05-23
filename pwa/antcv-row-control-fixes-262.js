/* AntCV row control fixes (v1.40.262)
 * Actual implementation for:
 * - What I Bring: body rows get Compress + Page; header row 0 keeps CJLR.
 * - Certifications: every row gets Page.
 * - Regulatory Context: every row gets Page + CJLR.
 *
 * DOM/function contract
 * ---------------------
 * Page controls write localStorage['antcv:itemPages'][sectionId][rowIndex].
 * CJLR controls write localStorage['antcvItemAlignment'][sectionId]['items.<rowIndex>'].
 * Compress controls mutate only the second/value field in the active row, then fire input/change.
 * All controls are marked with data-antcv-rowfix-* attributes and are scoped to their own panel.
 */
(function(){
  'use strict';
  const VERSION='1.40.262';
  if(window.__antcvRowControlFixes262===VERSION) return;
  window.__antcvRowControlFixes262=VERSION;

  const PAGES_KEY='antcv:itemPages';
  const ALIGN_KEY='antcvItemAlignment';
  const SECTIONS_KEY='sections';
  const ALIGN=['center','justify','left','right'];
  const ICON={left:'⇤',center:'↔',justify:'☰',right:'⇥'};
  const LABEL={left:'Left',center:'Center',justify:'Justify',right:'Right'};
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const low=s=>clean(s).toLowerCase();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  function readJson(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v||{}));}catch(_){}}
  function doc(){try{const d=localStorage.getItem('doc');return d==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function sections(){const all=readJson(SECTIONS_KEY,{});return Array.isArray(all[doc()])?all[doc()]:[];}
  function sectionBy(rx,loc){return sections().find(s=>s&&(!loc||s.loc===loc)&&rx.test(clean([s.title,s.name,s.type,s.id].join(' '))))||sections().find(s=>s&&rx.test(clean([s.title,s.name,s.type,s.id].join(' '))))||null;}
  function fire(source,detail){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:Object.assign({source,version:VERSION},detail||{})}));}catch(_){} try{window.dispatchEvent(new Event('input'));}catch(_){} }
  function fieldValue(f){return f?(f.value!==undefined?f.value:f.textContent||''):'';}
  function setFieldValue(f,v){if(!f)return;if(f.value!==undefined)f.value=v;else f.textContent=v;['input','change'].forEach(t=>{try{f.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});}
  function compressText(s){let t=clean(s); t=t.replace(/\b(responsible for|worked on|helped with|involved in|various|different|extensive|strong|solid)\b/gi,'').replace(/\s*,\s*/g,', ').replace(/\s+/g,' ').trim(); if(t.length>170){const parts=t.split(/(?<=[.!?])\s+/); if(parts[0]&&parts[0].length>35)t=parts[0]; else t=t.slice(0,167).replace(/\s+\S*$/,'')+'…';} return t;}
  function makeBtn(kind){const b=document.createElement('button'); b.type='button'; b.setAttribute('data-antcv-rowfix-control',kind); Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'24px',minWidth:'24px',height:'22px',minHeight:'22px',padding:'0',margin:'0 1px',border:'1px solid #01B7BB',borderRadius:'5px',background:'rgba(1,183,187,.08)',color:'#00746E',fontSize:'12px',fontWeight:'700',lineHeight:'1',cursor:'pointer',boxSizing:'border-box',flex:'0 0 auto',position:'static',float:'none'}); if(kind==='compress'){b.style.borderColor='#7b2ff2';b.style.color='#7b2ff2';b.style.background='rgba(123,47,242,.06)';b.textContent='⇥⇤';} if(kind==='page'){b.textContent='📄 1';} if(kind==='cjlr'){b.textContent='⇤';} return b;}
  function host(row,mark){let h=row.querySelector(':scope > [data-antcv-rowfix-host="'+mark+'"]')||row.querySelector('[data-antcv-rowfix-host="'+mark+'"]'); if(!h){h=document.createElement('span');h.setAttribute('data-antcv-rowfix-host',mark);Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'3px',whiteSpace:'nowrap',verticalAlign:'middle',flex:'0 0 auto',position:'static',float:'none'}); const buttons=Array.from(row.querySelectorAll(':scope button')); const del=buttons.find(b=>/^(×|x)$/i.test(clean(b.textContent))||/delete|remove/i.test(b.title||b.getAttribute('aria-label')||'')); if(del&&del.parentElement) del.parentElement.insertBefore(h,del); else row.appendChild(h);} return h;}
  function getPage(sid,i){const all=readJson(PAGES_KEY,{});const b=all[sid]||{};const n=Number(b[String(i)]||b[i]||1);return Number.isFinite(n)&&n>0?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(sid,i,n){const all=readJson(PAGES_KEY,{});if(!all[sid]||typeof all[sid]!=='object')all[sid]={};const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1))); if(nn<=1)delete all[sid][String(i)]; else all[sid][String(i)]=nn; writeJson(PAGES_KEY,all); fire('row-page-change',{sid,index:i,page:nn});}
  function paintPage(b,sid,i,label){const p=getPage(sid,i); b.textContent='📄 '+p; b.title=(label||'Row')+' page: '+p+'. Click to cycle page 1-4.'; b.setAttribute('aria-label',b.title);}
  function getAlign(sid,i){const m=readJson(ALIGN_KEY,{});const b=m[sid]||{};const v=b['items.'+i]||b[String(i)]||'left';return ALIGN.includes(v)?v:'left';}
  function setAlign(sid,i,v){const m=readJson(ALIGN_KEY,{});if(!m[sid]||typeof m[sid]!=='object')m[sid]={};m[sid]['items.'+i]=v;m[sid][String(i)]=v;writeJson(ALIGN_KEY,m);fire('row-cjlr-change',{sid,index:i,alignment:v});}
  function paintCJLR(b,sid,i,label){const a=getAlign(sid,i); b.textContent=ICON[a]||ICON.left; b.title=(label||'Row')+' alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.'; b.setAttribute('aria-label',b.title);}
  function applyEditorAlign(row,a){row.querySelectorAll('input,textarea,[contenteditable="true"]').forEach(f=>{f.style.textAlign=a;});}
  function ensurePage(row,sid,i,mark,label){const h=host(row,mark); let b=h.querySelector(':scope [data-antcv-rowfix-control="page"]'); if(!b){b=makeBtn('page');h.appendChild(b);} paintPage(b,sid,i,label); b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();setPage(sid,i,getPage(sid,i)%4+1);paintPage(b,sid,i,label);}; return b;}
  function ensureCJLR(row,sid,i,mark,label){const h=host(row,mark); let b=h.querySelector(':scope [data-antcv-rowfix-control="cjlr"]'); if(!b){b=makeBtn('cjlr');h.appendChild(b);} paintCJLR(b,sid,i,label); applyEditorAlign(row,getAlign(sid,i)); b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();const cur=getAlign(sid,i);const next=ALIGN[(ALIGN.indexOf(cur)+1)%ALIGN.length]||'center';setAlign(sid,i,next);paintCJLR(b,sid,i,label);applyEditorAlign(row,next);}; return b;}
  function ensureCompress(row,mark,label){const h=host(row,mark); let b=h.querySelector(':scope [data-antcv-rowfix-control="compress"]'); if(!b){b=makeBtn('compress');h.appendChild(b);} b.title=(label||'Row')+' compress. Applies only to the descriptive/value field.'; b.setAttribute('aria-label',b.title); b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation(); const fields=Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible); const target=fields[1]||fields[0]; setFieldValue(target,compressText(fieldValue(target))); fire('row-compress',{section:mark});}; return b;}

  function activePanel(rx,addRx){const headers=Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span')).filter(visible); for(const h of headers){const t=clean(h.textContent); if(!rx.test(t)||t.length>120)continue; let p=h; for(let d=0;p&&p!==document.body&&d<8;d++,p=p.parentElement){const pt=low(p.textContent); if(pt.includes('cv preview'))continue; if(pt.includes('← back')&&(!addRx||addRx.test(pt)))return p;}} return null;}
  function rowsByFields(root,fieldRx){if(!root)return[];const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>fieldRx.test(fieldValue(f)||f.placeholder||f.textContent||''));const out=[]; seeds.forEach(f=>{let p=f.parentElement,best=null;for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){const fs=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible); if(fs.length>=1&&fs.length<=5)best=p; if(fs.length>=2){best=p;break;}} if(best&&visible(best)&&!out.includes(best))out.push(best);}); return out;}

  function wibRows(){const root=activePanel(/what\s+i\s+bring/i,/\+\s*row/); if(!root)return[]; return rowsByFields(root,/focus\s*area/i);}
  function runWib(){const sec=sectionBy(/what\s+i\s+bring|core\s+competenc/i,'main'); const sid=(sec&&sec.id)||'core_competencies'; const rows=wibRows(); rows.forEach((row,i)=>{row.setAttribute('data-antcv-rowfix-wib-row','1'); if(i===0){ensureCJLR(row,sid,0,'wib','What I Bring header'); return;} ensureCompress(row,'wib','What I Bring row '+i); ensurePage(row,sid,i,'wib','What I Bring row '+i);});}

  function certRows(){const root=activePanel(/certifications?/i,/\+\s*(item|entry)/); if(!root)return[]; const rows=rowsByFields(root,/item|certificate|certification/i); if(rows.length)return rows; return Array.from(root.querySelectorAll('[data-antcv-cert-row="1"]')).filter(visible);}
  function runCert(){const sec=sectionBy(/certifications?/i,'sidebar'); const sid=(sec&&sec.id)||'certifications'; certRows().forEach((row,i)=>{row.setAttribute('data-antcv-rowfix-cert-row','1'); ensurePage(row,sid,i,'cert','Certification row '+(i+1));});}

  function regulatoryRows(){const root=activePanel(/regulatory\s+context/i,/\+\s*(item|group)/); if(!root)return[]; const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>visible(f)); const out=[]; seeds.forEach(f=>{let p=f.parentElement,best=null;for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){const fs=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible); if(fs.length>=2&&fs.length<=5){best=p;break;} if(fs.length===1&&/group|label|standards|context|value/i.test(clean(p.textContent))){best=p;break;}} if(best&&visible(best)&&!out.includes(best))out.push(best);}); return out.filter(r=>!/\+\s*(item|group heading)/i.test(clean(r.textContent)));}
  function runReg(){const sec=sectionBy(/regulatory\s+context/i,'sidebar'); const sid=(sec&&sec.id)||'regulatory_context'; regulatoryRows().forEach((row,i)=>{row.setAttribute('data-antcv-rowfix-reg-row','1'); ensurePage(row,sid,i,'reg','Regulatory Context row '+(i+1)); ensureCJLR(row,sid,i,'reg','Regulatory Context row '+(i+1));});}

  function orderHosts(){document.querySelectorAll('[data-antcv-rowfix-host]').forEach(h=>{const order={compress:20,page:30,cjlr:40}; Array.from(h.querySelectorAll('[data-antcv-rowfix-control]')).forEach(b=>{b.style.order=String(order[b.getAttribute('data-antcv-rowfix-control')]||50);});});}
  function injectCss(){if(document.getElementById('antcv-row-control-fixes-262-css'))return;const s=document.createElement('style');s.id='antcv-row-control-fixes-262-css';s.textContent='[data-antcv-rowfix-host]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;position:static!important;float:none!important}[data-antcv-rowfix-host] button{position:static!important;float:none!important;flex:0 0 auto!important}[data-antcv-rowfix-wib-row],[data-antcv-rowfix-cert-row],[data-antcv-rowfix-reg-row]{overflow:visible!important;box-sizing:border-box!important}';(document.head||document.documentElement).appendChild(s);}
  function run(){try{injectCss();runWib();runCert();runReg();orderHosts();}catch(e){try{console.warn('[antcv-row-control-fixes-262]',e&&e.message);}catch(_){}}}
  let pending=false; function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,250,600,1200,2400].forEach(ms=>setTimeout(run,ms)); try{new MutationObserver(schedule).observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(_){} window.addEventListener('click',()=>setTimeout(run,0),true); window.addEventListener('input',()=>setTimeout(run,0),true); window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.AntcvRowControlFixes262={version:VERSION,run};
})();
