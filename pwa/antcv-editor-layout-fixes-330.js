/* AntCV editor layout fixes (v1.40.330)
 * - Restores HOW I WOULD CONTRIBUTE to row-based intro / bullet / closing controls.
 * - Moves Foundation Professionally controls after the Professionally field.
 * - Normalises page buttons for WHAT I BRING and CORE COMPETENCIES table rows.
 */
(function(){
  'use strict';
  const VERSION='1.40.330';
  if(window.__antcvEditorLayoutFixes330===VERSION) return;
  window.__antcvEditorLayoutFixes330=VERSION;

  const PAGE_KEY='antcv:itemPages';
  const ALIGN_KEY='antcv.hiwc.alignment.v1';
  const PAGE_COLORS=['#9aa0a6','#8A6BE8','#D98C00','#00746E','#B85E3B'];
  const ALIGN=['center','justify','left','right'];
  const ICON={center:'↔',justify:'☰',left:'⇤',right:'⇥'};
  const clean=s=>String(s||'').replace(/[\t\n\r ]+/g,' ').trim();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  function read(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function fire(el){['input','change'].forEach(t=>{try{el&&el.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});}
  function pulse(source){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source,version:VERSION}}));}catch(_){} try{window.dispatchEvent(new CustomEvent('antcv:item-pages-changed',{detail:{source,version:VERSION}}));}catch(_){} }

  function getBucket(sid){const all=read(PAGE_KEY,{}); if(!all[sid]||typeof all[sid]!=='object')all[sid]={}; return {all,b:all[sid]};}
  function getPage(sid,key){const {b}=getBucket(sid);const n=Number(b[String(key)]||1);return Number.isFinite(n)?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(sid,key,n){const x=getBucket(sid);const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1)));if(nn<=1)delete x.b[String(key)];else x.b[String(key)]=nn;write(PAGE_KEY,x.all);pulse('page-button');return nn;}
  function getAlign(k){const m=read(ALIGN_KEY,{});return ALIGN.includes(m[k])?m[k]:'left';}
  function setAlign(k,v){const m=read(ALIGN_KEY,{});m[k]=v;write(ALIGN_KEY,m);pulse('alignment');}
  function nextAlign(v){const i=ALIGN.indexOf(v);return ALIGN[(i<0?0:i+1)%ALIGN.length];}

  function pageStyle(btn,p){const c=PAGE_COLORS[p]||PAGE_COLORS[0];btn.textContent='📄 '+p;Object.assign(btn.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'28px',minWidth:'28px',height:'24px',minHeight:'24px',padding:'0 4px',margin:'0 2px',borderRadius:'6px',border:'2px solid '+c,background:p>1?'rgba(255,255,255,.95)':'rgba(255,255,255,.75)',color:c,fontSize:'11px',fontWeight:'700',lineHeight:'1',cursor:'pointer',boxSizing:'border-box',verticalAlign:'middle'});}
  function toolBtn(kind,text,title){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.setAttribute('data-antcv330-tool',kind);Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'26px',minWidth:'26px',height:'24px',minHeight:'24px',padding:'0',margin:'0 2px',borderRadius:'6px',border:'1px solid #01B7BB',background:'rgba(1,183,187,.08)',color:'#00746E',fontSize:'12px',fontWeight:'700',lineHeight:'1',cursor:'pointer',boxSizing:'border-box'});if(kind==='enhance'){b.style.borderColor='#f0b429';b.style.color='#c77800';}if(kind==='compress'){b.style.borderColor='#7b2ff2';b.style.color='#7b2ff2';}if(kind==='remove'){b.style.borderColor='#ff5c5c';b.style.color='#e52b2b';b.style.background='transparent';}return b;}
  function compressText(v){let t=clean(v);t=t.replace(/\b(responsible for|worked on|helped with|involved in|various|different|extensive|strong|solid)\b/gi,'').replace(/[,][\t\n\r ]*/g,', ').replace(/[\t\n\r ]+/g,' ').trim();if(t.length>180)t=t.slice(0,177).replace(/[\t\n\r ][^\t\n\r ]*$/,'')+'…';return t;}
  function enrichText(v){const t=clean(v);if(!t)return t;if(/[.;:]$/.test(t))return t;return t+'.';}

  function findHIWCRoot(){
    const fields=Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
    const seed=fields.find(f=>/Intro\s*[—-]|one sentence framing/i.test(String(f.value||f.placeholder||f.textContent||'')));
    if(!seed)return null;let p=seed.parentElement,best=null;
    for(let d=0;p&&p!==document.body&&d<12;d++,p=p.parentElement){const t=clean(p.textContent);if(/HOW I WOULD CONTRIBUTE/i.test(t)||(/Intro line/i.test(t)&&/Closing line/i.test(t)&&/Bullets/i.test(t)))best=p;}
    return best;
  }
  function fieldsIn(r){return Array.from((r||document).querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function val(f){return f?(f.value!==undefined?f.value:f.textContent||''):'';}
  function setVal(f,v){if(!f)return;if(f.value!==undefined)f.value=v;else f.textContent=v;fire(f);}
  function findIntro(r){return fieldsIn(r).find(f=>/Intro\s*[—-]|one sentence framing/i.test(String(f.value||f.placeholder||f.textContent||'')))||fieldsIn(r)[0]||null;}
  function findClosing(r){const fs=fieldsIn(r);return fs.find(f=>/Closing\s*[—-]|one sentence summar/i.test(String(f.value||f.placeholder||f.textContent||'')))||fs[fs.length-1]||null;}
  function findBullets(r){const intro=findIntro(r),closing=findClosing(r);return fieldsIn(r).find(f=>f.tagName==='TEXTAREA'&&f!==intro&&f!==closing)||null;}
  function lineHost(f){let p=f&&f.parentElement,best=f&&f.parentElement;for(let d=0;p&&d<4;d++,p=p.parentElement){const fs=fieldsIn(p);if(fs.length===1){best=p;break;}}return best||f.parentElement;}
  function hiwcToolbar(part, field, removable, onRemove){
    const wrap=document.createElement('span');wrap.setAttribute('data-antcv330-hiwc-toolbar',part);Object.assign(wrap.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap',flex:'0 0 auto'});
    const page=document.createElement('button');page.type='button';page.setAttribute('data-antcv330-page','1');pageStyle(page,getPage('how_i_would_contribute',part));page.onclick=e=>{e.preventDefault();e.stopPropagation();pageStyle(page,setPage('how_i_would_contribute',part,getPage('how_i_would_contribute',part)%4+1));};
    const cj=toolBtn('cjlr',ICON[getAlign(part)]||'⇤','CJLR alignment');cj.onclick=e=>{e.preventDefault();e.stopPropagation();const n=nextAlign(getAlign(part));setAlign(part,n);cj.textContent=ICON[n]||'⇤';if(field)field.style.textAlign=n;};
    const enh=toolBtn('enhance','✨','Enhance');enh.onclick=e=>{e.preventDefault();e.stopPropagation();setVal(field,enrichText(val(field)));};
    const comp=toolBtn('compress','↹','Compress');comp.onclick=e=>{e.preventDefault();e.stopPropagation();setVal(field,compressText(val(field)));};
    wrap.append(page,cj,enh,comp);
    if(removable){const x=toolBtn('remove','×','Remove');x.onclick=e=>{e.preventDefault();e.stopPropagation();onRemove&&onRemove();};wrap.appendChild(x);}
    return wrap;
  }
  function syncBulletSource(ta,box){const vals=Array.from(box.querySelectorAll('[data-antcv330-hiwc-bullet-text]')).map(i=>clean(i.value)).filter(Boolean);ta.value=vals.join('\n');fire(ta);}
  function addBulletRow(box,ta,text){
    const idx=box.querySelectorAll('[data-antcv330-hiwc-bullet-row]').length;
    const row=document.createElement('div');row.setAttribute('data-antcv330-hiwc-bullet-row','1');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'3px',margin:'3px 0',width:'100%'});
    const mark=document.createElement('input');mark.value='•';mark.title='Bullet or emoji marker';Object.assign(mark.style,{width:'28px',minWidth:'28px',height:'24px',boxSizing:'border-box',textAlign:'center'});
    const inp=document.createElement('input');inp.type='text';inp.value=text||'';inp.placeholder='Bullet text';inp.setAttribute('data-antcv330-hiwc-bullet-text','1');Object.assign(inp.style,{flex:'1 1 auto',minWidth:'0',height:'24px',boxSizing:'border-box'});inp.style.textAlign=getAlign('bullet_'+idx);inp.oninput=()=>syncBulletSource(ta,box);
    row.append(mark,inp,hiwcToolbar('bullet_'+idx,inp,true,()=>{row.remove();syncBulletSource(ta,box);}));
    box.insertBefore(row,box.querySelector('[data-antcv330-hiwc-add]'));
  }
  function fixHIWC(){
    const r=findHIWCRoot();if(!r)return;
    // Remove old duplicate control groups below the bullet textarea.
    Array.from(r.querySelectorAll('[data-antcv-hiwc-bullet-list],[data-antcv330-hiwc-bullet-list]')).forEach(n=>n.remove());
    const intro=findIntro(r), closing=findClosing(r), bullets=findBullets(r);
    [ ['intro',intro], ['closing',closing] ].forEach(([part,f])=>{if(!f)return;f.style.textAlign=getAlign(part);const h=lineHost(f);if(!h)return;Array.from(h.querySelectorAll('[data-antcv-hiwc-controls],[data-antcv330-hiwc-toolbar]')).forEach(n=>n.remove());h.style.display='flex';h.style.alignItems='center';h.style.gap='4px';h.appendChild(hiwcToolbar(part,f,false));});
    if(!bullets)return;bullets.setAttribute('data-antcv-hiwc-bullets-bound','1');bullets.style.display='none';
    const box=document.createElement('div');box.setAttribute('data-antcv330-hiwc-bullet-list','1');Object.assign(box.style,{display:'flex',flexDirection:'column',gap:'2px',margin:'4px 0',width:'100%'});
    const add=document.createElement('button');add.type='button';add.textContent='+ Bullet';add.setAttribute('data-antcv330-hiwc-add','1');Object.assign(add.style,{alignSelf:'flex-start',border:'1px solid #008b8b',background:'white',color:'#006b6b',borderRadius:'4px',padding:'2px 8px',cursor:'pointer'});add.onclick=e=>{e.preventDefault();e.stopPropagation();addBulletRow(box,bullets,'');};
    box.appendChild(add);bullets.parentNode&&bullets.parentNode.insertBefore(box,bullets.nextSibling);
    const vals=String(bullets.value||'').split(/[\n]+/).map(x=>x.replace(/^[\t ]*[•\-*][\t ]*/,'').trim()).filter(Boolean);(vals.length?vals:['']).forEach(v=>addBulletRow(box,bullets,v));
  }

  function fixFoundation(){
    const roots=Array.from(document.querySelectorAll('div,section')).filter(el=>visible(el)&&/^FOUNDATION/i.test(clean(el.textContent).slice(0,80))||(/Hands-on/i.test(clean(el.textContent))&&/Professionally/i.test(clean(el.textContent))));
    const r=roots[0]; if(!r)return;
    const fs=Array.from(r.querySelectorAll('textarea,input[type="text"],[contenteditable="true"]')).filter(visible); if(fs.length<2)return;
    const hHost=r.querySelector('[data-antcv-foundation-host="hands_on"]');const pHost=r.querySelector('[data-antcv-foundation-host="professionally"]');
    if(hHost&&hHost.parentNode!==fs[0].parentNode){fs[0].parentNode.insertBefore(hHost,fs[0].nextSibling);} else if(hHost&&hHost.previousSibling!==fs[0]){fs[0].parentNode.insertBefore(hHost,fs[0].nextSibling);}
    if(pHost&&pHost.parentNode!==fs[1].parentNode){fs[1].parentNode.insertBefore(pHost,fs[1].nextSibling);} else if(pHost&&pHost.previousSibling!==fs[1]){fs[1].parentNode.insertBefore(pHost,fs[1].nextSibling);}
  }

  function panelTitle(rootRx){return Array.from(document.querySelectorAll('h1,h2,h3,strong,b,div,span')).find(h=>visible(h)&&rootRx.test(clean(h.textContent))&&clean(h.textContent).length<90);}
  function tableRowsFor(rx){const h=panelTitle(rx);if(!h)return[];let p=h;for(let d=0;p&&p!==document.body&&d<10;d++,p=p.parentElement){const rows=Array.from(p.querySelectorAll('div,tr')).filter(row=>visible(row)&&Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible).length>=2);if(rows.length>=2)return rows;}return[];}
  function ensureTablePageButtons(rx,sid){
    const rows=tableRowsFor(rx);rows.forEach((row,i)=>{if(i===0)return;let host=row.querySelector('[data-antcv330-table-page-host]');if(!host){host=document.createElement('span');host.setAttribute('data-antcv330-table-page-host','1');Object.assign(host.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap'});const firstButton=Array.from(row.querySelectorAll('button')).find(visible);if(firstButton&&firstButton.parentNode)firstButton.parentNode.insertBefore(host,firstButton);else row.appendChild(host);}let b=host.querySelector('[data-antcv330-table-page]');if(!b){b=document.createElement('button');b.type='button';b.setAttribute('data-antcv330-table-page','1');host.appendChild(b);}pageStyle(b,getPage(sid,i));b.title='Start row '+i+' on page '+getPage(sid,i);b.onclick=e=>{e.preventDefault();e.stopPropagation();pageStyle(b,setPage(sid,i,getPage(sid,i)%4+1));};});
  }
  function run(){try{fixHIWC();fixFoundation();ensureTablePageButtons(/WHAT\s+I\s+BRING/i,'bring');ensureTablePageButtons(/CORE\s+COMPETENC/i,'core_competencies');}catch(e){try{console.warn('[editor-layout-fixes-330]',e&&e.message);}catch(_){}}}
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,700,1500,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('input',soon,true);window.addEventListener('antcv:sections-updated',soon);setInterval(run,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvEditorLayoutFixes330={version:VERSION,run};
})();
