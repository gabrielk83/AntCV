/* AntCV table page-split renderer (v1.40.324)
 * Adds preview/print rendering for row page controls in table-style sections:
 * - CV Core Competencies
 * - CL What I Bring
 * - any preview section with a real table and antcv:itemPages data
 * It repeats the section heading as "(Cont.)" and repeats table headers.
 */
(function(){
  'use strict';
  const VERSION='1.40.341-p0b';
  if(window.__antcvTablePageSplits324===VERSION) return;
  window.__antcvTablePageSplits324=VERSION;
  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  const RX_TABLE=/\b(core\s+competencies|what\s+i\s+bring)\b/i;
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function read(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function doc(){try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function sectionBySid(sid){const all=read(SECTIONS_KEY,{});const list=all&&Array.isArray(all[doc()])?all[doc()]:[];return list.find(x=>x&&String(x.id||'')===String(sid))||null;}
  function titleOf(secEl,sid){const s=sectionBySid(sid);let t=clean((s&&(s.title||s.name))||'');if(!t){const h=secEl.querySelector('h1,h2,h3,h4,strong,b,[data-antcv-section-title]');t=clean(h&&h.textContent||'');}return (t||'SECTION').toUpperCase();}
  function pageMap(sid){const all=read(PAGE_KEY,{});const b=all&&all[sid];return b&&typeof b==='object'?b:{};}
  function num(v){const n=Number(v);return Number.isFinite(n)?Math.round(n):1;}
  function tableRows(table){if(!table)return {headers:[],body:[]};
    const headers=Array.from(table.querySelectorAll('thead tr')).filter(visible);
    let body=Array.from(table.querySelectorAll('tbody tr')).filter(visible);
    if(!body.length){const all=Array.from(table.querySelectorAll('tr')).filter(visible);if(headers.length){body=all.filter(r=>!headers.includes(r));}else{const first=all.find(r=>/focus\s*area|strategic\s*expertise/i.test(clean(r.textContent)));if(first){headers.push(first);body=all.filter(r=>r!==first);}else body=all;}}
    return {headers,body};
  }
  function clear(sec){sec.querySelectorAll('[data-antcv-table-page-split="1"]').forEach(n=>n.remove());}
  function marker(){const d=document.createElement('div');d.setAttribute('data-antcv-table-page-split','1');d.setAttribute('aria-hidden','true');Object.assign(d.style,{breakBefore:'page',pageBreakBefore:'always',height:'0',margin:'0',padding:'0',lineHeight:'0'});return d;}
  function contHeading(title, ref){const h=document.createElement('div');h.setAttribute('data-antcv-table-page-split','1');h.setAttribute('data-antcv-table-cont-heading','1');h.textContent=title+' (Cont.)';
    let color='#00746E', font='Trebuchet MS, Calibri, sans-serif';try{const cs=getComputedStyle(ref);color=cs.color||color;font=cs.fontFamily||font;}catch(_){}
    Object.assign(h.style,{color, fontFamily:font, fontWeight:'700', fontSize:'12pt', marginTop:'4pt', marginBottom:'6pt', borderBottom:'1pt solid '+color, paddingBottom:'2pt'});return h;}
  function cloneHeader(table){const src=table.querySelector('thead tr')||Array.from(table.querySelectorAll('tr')).find(r=>/focus\s*area|strategic\s*expertise/i.test(clean(r.textContent)))||null;const tr=document.createElement('tr');tr.setAttribute('data-antcv-table-page-split','1');tr.setAttribute('data-antcv-table-header-clone','1');
    if(src){tr.innerHTML=src.innerHTML;Array.from(tr.children).forEach(c=>{c.style.fontWeight='700';});}
    else{const th=document.createElement('th');th.colSpan=2;th.textContent='Continued';tr.appendChild(th);}return tr;}
  function apply(sec){
    const sid=sec.getAttribute('data-sid'); if(!sid)return;
    const map=pageMap(sid); if(!Object.keys(map).length)return;
    const table=sec.querySelector('table'); if(!table)return;
    const tx=clean(sec.textContent).slice(0,500);
    const s=sectionBySid(sid);
    if(!RX_TABLE.test(tx+' '+clean(s&&(s.title||s.name||s.id))))return;
    const {headers,body}=tableRows(table); if(!body.length)return;
    body.forEach((row,zero)=>{
      const editorIndex = headers.length ? zero+1 : zero;
      const p=num(map[String(editorIndex)]||map[String(zero)]||1);
      if(p<2)return;
      if(row.getAttribute('data-antcv-table-split-done')==='1')return;
      if (zero === 0) {
        // PB-004 case (a): page break on the first body row moves the
        // WHOLE table to the next page. The original thead naturally
        // sits at the top of the new page — no clone, no (Cont.)
        // heading needed. Marker is a 0-height div with
        // page-break-before:always inserted before the table.
        const beforeTable = table.parentNode;
        if (beforeTable) {
          beforeTable.insertBefore(marker(), table);
        }
      } else {
        // PB-004 case (b): split inside the table. Insert a cloned
        // header <tr> immediately before the split row, with
        // break-before:page so the page break lands AT the cloned
        // header. Rows before the split stay on the previous page;
        // the cloned header sits at the top of the new page,
        // followed by the split row and the remaining rows. No
        // row loss; no reorder.
        const cloned = cloneHeader(table);
        cloned.style.breakBefore = 'page';
        cloned.style.pageBreakBefore = 'always';
        const parent = row.parentNode;
        if (parent) parent.insertBefore(cloned, row);
      }
      row.setAttribute('data-antcv-table-split-done','1');
    });
  }
  function run(){try{document.querySelectorAll('[data-sid]').forEach(sec=>{if(!visible(sec))return;clear(sec);sec.querySelectorAll('[data-antcv-table-split-done]').forEach(r=>r.removeAttribute('data-antcv-table-split-done'));apply(sec);});}catch(e){try{console.warn('[table-page-splits-324]',e&&e.message);}catch(_){}}}
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(_){}window.addEventListener('storage',e=>{if(!e||e.key===PAGE_KEY)soon();});window.addEventListener('antcv:sections-updated',soon);window.addEventListener('beforeprint',run);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvTablePageSplits324={version:VERSION,run};
})();
