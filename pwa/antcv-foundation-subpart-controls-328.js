/* AntCV Foundation subpart controls (v1.40.328)
 * Adds Page, CJLR, Enhance and Compress controls for Foundation:
 * - Hands-on
 * - Professionally
 * Persists to localStorage for preview/DOCX/PDF handoff.
 */
(function(){
  'use strict';
  const VERSION='1.40.328';
  if(window.__antcvFoundationSubpartControls328===VERSION) return;
  window.__antcvFoundationSubpartControls328=VERSION;
  const STATE_KEY='antcv.foundationControls.v1';
  const ALIGN_KEY='antcvItemAlignment';
  const SECTIONS_KEY='sections';
  const COLORS=['#9aa0a6','#8A6BE8','#D98C00','#00746E','#B85E3B'];
  const ALIGN=['center','justify','left','right'];
  const ICON={center:'↔',justify:'☰',left:'⇤',right:'⇥'};
  function clean(s){return String(s||'').replace(/[\t\n\r ]+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function read(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function state(){const s=read(STATE_KEY,{});return {hands_on:Object.assign({page:1,align:'left'},s.hands_on||{}),professionally:Object.assign({page:1,align:'left'},s.professionally||{})};}
  function setPart(part,patch){const s=state();s[part]=Object.assign({},s[part]||{},patch||{});write(STATE_KEY,s);syncAlignToExport(s);pulse();return s[part];}
  function doc(){try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function foundationSection(){const b=read(SECTIONS_KEY,{});const a=b&&Array.isArray(b[doc()])?b[doc()]:[];return a.find(x=>x&&/foundation|fundation/i.test(clean([x.id,x.title,x.name,x.type].join(' '))))||null;}
  function sid(){const s=foundationSection();return s&&s.id?String(s.id):'foundation';}
  function syncAlignToExport(s){const all=read(ALIGN_KEY,{});const id=sid();if(!all[id]||typeof all[id]!=='object')all[id]={};['hands_on','professionally'].forEach(k=>{const a=s[k]&&s[k].align;if(ALIGN.includes(a))all[id][k]=a;});write(ALIGN_KEY,all);}
  function pulse(){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'foundation-subpart-controls-328'}}));}catch(_){} }
  function val(f){return f?(f.value!==undefined?f.value:f.textContent||''):'';}
  function setVal(f,v){if(!f)return;if(f.value!==undefined)f.value=v;else f.textContent=v;['input','change'].forEach(t=>{try{f.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});}
  function compressText(v){let t=clean(v);t=t.replace(/\b(responsible for|worked on|helped with|involved in|various|different|extensive|strong|solid)\b/gi,'').replace(/[,][\t\n\r ]*/g,', ').replace(/[\t\n\r ]+/g,' ').trim();if(t.length>180)t=t.slice(0,177).replace(/[\t\n\r ][^\t\n\r ]*$/,'')+'…';return t;}
  function enrichText(v){const t=clean(v);if(!t)return t;if(/[.;:]$/.test(t))return t;return t+'.';}
  function nextAlign(a){const i=ALIGN.indexOf(a);return ALIGN[(i<0?0:i+1)%ALIGN.length];}
  function root(){const heads=Array.from(document.querySelectorAll('h1,h2,h3,strong,b,div,span')).filter(visible);for(const h of heads){const t=clean(h.textContent);if(!/^foundation/i.test(t)||t.length>80)continue;let p=h;for(let d=0;p&&p!==document.body&&d<10;d++,p=p.parentElement){const text=clean(p.textContent).toLowerCase();const fs=Array.from(p.querySelectorAll('textarea,input[type="text"],[contenteditable="true"]')).filter(visible);if(fs.length>=2&&(text.indexOf('hands')>=0||text.indexOf('profession')>=0))return p;}}return null;}
  function labelledField(r,part){const fs=Array.from(r.querySelectorAll('textarea,input[type="text"],[contenteditable="true"]')).filter(visible);let hit=null;fs.forEach(f=>{if(hit)return;let p=f.parentElement;for(let d=0;p&&p!==r.parentElement&&d<5;d++,p=p.parentElement){const t=clean(p.textContent).toLowerCase();if(part==='hands_on'&&t.indexOf('hands')>=0)hit=f;if(part==='professionally'&&t.indexOf('profession')>=0)hit=f;if(hit)break;}});if(hit)return hit;return part==='hands_on'?fs[0]||null:fs[1]||null;}
  function btn(kind,text,title){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.setAttribute('data-antcv-foundation-'+kind,'1');Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'28px',minWidth:'28px',height:'24px',padding:'0',margin:'0 2px',borderRadius:'6px',border:'1px solid #01B7BB',background:'rgba(1,183,187,.08)',color:'#00746E',fontSize:'12px',fontWeight:'700',lineHeight:'1',cursor:'pointer',boxSizing:'border-box',verticalAlign:'middle'});if(kind==='enhance'){b.style.borderColor='#f0b429';b.style.color='#c77800';}if(kind==='compress'){b.style.borderColor='#7b2ff2';b.style.color='#7b2ff2';}return b;}
  function paintPage(b,part){const p=Math.min(4,Math.max(1,Number((state()[part]||{}).page)||1)),c=COLORS[p]||COLORS[0];b.textContent='📄 '+p;b.style.border='2px solid '+c;b.style.color=c;b.title=(part==='hands_on'?'Hands-on':'Professionally')+' page '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);}
  function paintAlign(b,part){const a=(state()[part]||{}).align||'left';b.textContent=ICON[a]||ICON.left;b.title=(part==='hands_on'?'Hands-on':'Professionally')+' alignment: '+a+'. Click to cycle Center, Justify, Left, Right.';b.setAttribute('aria-label',b.title);}
  function host(f,part){let h=f.parentElement&&f.parentElement.querySelector('[data-antcv-foundation-host="'+part+'"]');if(!h){h=document.createElement('span');h.setAttribute('data-antcv-foundation-host',part);Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap',verticalAlign:'middle'});if(f.nextSibling)f.parentNode.insertBefore(h,f.nextSibling);else f.parentNode.appendChild(h);}return h;}
  function controlsFor(f,part){if(!f)return;const st=state()[part];f.style.textAlign=st.align||'left';const h=host(f,part);let page=h.querySelector('[data-antcv-foundation-page]')||btn('page','📄 1','Page');let cjlr=h.querySelector('[data-antcv-foundation-cjlr]')||btn('cjlr','⇤','Alignment');let enh=h.querySelector('[data-antcv-foundation-enhance]')||btn('enhance','✨','Enhance');let comp=h.querySelector('[data-antcv-foundation-compress]')||btn('compress','↹','Compress');[page,cjlr,enh,comp].forEach(x=>{if(x.parentElement!==h)h.appendChild(x);});paintPage(page,part);paintAlign(cjlr,part);page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const p=(Number(state()[part].page)||1)%4+1;setPart(part,{page:p});paintPage(page,part);applyPreview();};cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const a=nextAlign(state()[part].align||'left');setPart(part,{align:a});paintAlign(cjlr,part);f.style.textAlign=a;applyPreview();};enh.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setVal(f,enrichText(val(f)));};comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setVal(f,compressText(val(f)));};f.addEventListener('input',()=>pulse(),{passive:true});}
  function previewRoot(){const sec=foundationSection();const id=sec&&sec.id;let el=id?document.querySelector('[data-sid="'+CSS.escape(id)+'"]'):null;if(el)return el;return Array.from(document.querySelectorAll('[data-sid],section,div')).find(x=>visible(x)&&/^foundation/i.test(clean((x.querySelector('h1,h2,h3,h4,strong,b')||x).textContent||'')))||null;}
  function partNodes(root){const out={hands_on:null,professionally:null};if(!root)return out;Array.from(root.querySelectorAll('p,li,div,span')).filter(visible).forEach(el=>{if(el.closest('button'))return;const t=clean(el.textContent).toLowerCase();if(!out.hands_on&&t.indexOf('hands-on')>=0)out.hands_on=el;if(!out.professionally&&t.indexOf('professionally')>=0)out.professionally=el;});return out;}
  function cont(){const h=document.createElement('div');h.setAttribute('data-antcv-foundation-page-break','1');h.textContent='FOUNDATION (Cont.)';Object.assign(h.style,{breakBefore:'page',pageBreakBefore:'always',color:'#00746E',fontWeight:'700',fontSize:'12pt',marginTop:'4pt',marginBottom:'8pt',borderBottom:'1pt solid #00746E',paddingBottom:'2pt'});return h;}
  function breakMark(){const d=document.createElement('div');d.setAttribute('data-antcv-foundation-page-break','1');Object.assign(d.style,{breakBefore:'page',pageBreakBefore:'always',height:'0',margin:'0',padding:'0',lineHeight:'0'});return d;}
  function applyPreview(){const r=previewRoot();if(!r)return;document.querySelectorAll('[data-antcv-foundation-page-break="1"]').forEach(n=>n.remove());const st=state();const n=partNodes(r);if(n.hands_on){n.hands_on.style.textAlign=st.hands_on.align||'left';if(Number(st.hands_on.page)>=2&&r.parentNode)r.parentNode.insertBefore(breakMark(),r);}if(n.professionally){n.professionally.style.textAlign=st.professionally.align||'left';if(Number(st.professionally.page)>=2&&n.professionally.parentNode){n.professionally.parentNode.insertBefore(cont(),n.professionally);}}}
  function run(){try{const r=root();if(r){controlsFor(labelledField(r,'hands_on'),'hands_on');controlsFor(labelledField(r,'professionally'),'professionally');}applyPreview();}catch(e){try{console.warn('[foundation-subpart-controls-328]',e&&e.message);}catch(_){}}}
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('input',soon,true);window.addEventListener('antcv:sections-updated',soon);setInterval(run,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvFoundationSubpartControls328={version:VERSION,run};
})();
