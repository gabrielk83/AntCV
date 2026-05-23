/* AntCV preview toolbar stabilizer (v1.40.319)
 * Keeps JD Analysis, Fuse CV/CL, and Privacy status beside PDF/DOCX without
 * reparenting originals. The old v318 moved the real buttons into a preview
 * toolbar that can unmount when returning to setup, so the buttons disappeared.
 * v319 creates stable proxy buttons and forwards clicks to the live originals.
 */
(function(){
  'use strict';
  if (window.__antcvPreviewToolbarStabilizer === '1.40.319') return;
  window.__antcvPreviewToolbarStabilizer = '1.40.319';
  var ORDER=['jd','fuse','privacy'];
  var ICON={jd:'🎯',fuse:'🔀',privacy:'🛡'};
  var TITLE={jd:'JD analysis',fuse:'Fuse CV/CL',privacy:'Privacy status'};
  function txt(el){ return String((el && (el.getAttribute('aria-label') || el.title || el.textContent)) || '').replace(/\s+/g,' ').trim(); }
  function kindOf(el){
    var s=txt(el).toLowerCase(), cls=String(el.className||'').toLowerCase(), id=String(el.id||'').toLowerCase(), all=s+' '+cls+' '+id;
    if (/privacy|shield|data\s*status|led/.test(all) || /🛡|🛡️/.test(el.textContent||'')) return 'privacy';
    if (/jd\s*analysis|job\s*description\s*analysis|analyse\s*jd|analy[sz]e\s*jd|target|bullseye/.test(all) || /🎯/.test(el.textContent||'')) return 'jd';
    if (/fuse|fusion|merge\s*(cv|cover)|cv\s*[\/+&]\s*cl|cl\s*[\/+&]\s*cv/.test(all) || /🔀|🔁|🧩/.test(el.textContent||'')) return 'fuse';
    return null;
  }
  function shown(el){
    if(!el||el.nodeType!==1) return false;
    try{var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return false; var r=el.getBoundingClientRect(); return r.width>4&&r.height>4;}catch(_){return true;}
  }
  function isSmallActionButton(el){
    if(!el||el.nodeType!==1||!/^BUTTON$/i.test(el.tagName)) return false;
    var k=kindOf(el); if(!k) return false;
    if(el.closest && el.closest('.antcv-preview-action-strip')) return false;
    if(el.closest && el.closest('.antcv-export-buttons')) return false;
    try{var r=el.getBoundingClientRect(); if(/fuse/i.test(txt(el))&&(r.width>130||r.height>90)) return false; return r.width<=90&&r.height<=90 || /antcv.*(fab|overlay|privacy|fusion|jd)/i.test(String(el.className||''));}catch(_){return true;}
  }
  function previewToolbar(){ return document.querySelector('.antcv-preview-actions'); }
  function exportButtons(){ return document.querySelector('.antcv-preview-actions .antcv-export-buttons'); }
  function ensureStrip(){
    var bar=previewToolbar(), exp=exportButtons(); if(!bar||!exp) return null;
    var strip=bar.querySelector('.antcv-preview-action-strip');
    if(!strip){strip=document.createElement('div'); strip.className='antcv-preview-action-strip no-print'; strip.setAttribute('data-antcv-preview-action-strip','true'); exp.parentNode.insertBefore(strip, exp);}
    return strip;
  }
  function originals(kind){ return Array.from(document.querySelectorAll('button')).filter(function(b){ return isSmallActionButton(b)&&kindOf(b)===kind; }); }
  function proxy(kind){
    var strip=ensureStrip(); if(!strip) return null;
    var btn=strip.querySelector('[data-antcv-preview-action-kind="'+kind+'"]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button'; btn.className='antcv-preview-mini-action'; btn.dataset.antcvPreviewActionKind=kind; btn.textContent=ICON[kind]; btn.title=TITLE[kind]; btn.setAttribute('aria-label',TITLE[kind]);
      btn.addEventListener('click',function(ev){
        ev.preventDefault(); ev.stopPropagation();
        var list=originals(kind).filter(function(b){return b!==btn;});
        var target=list.find(shown)||list[0];
        if(target){ try{target.click();}catch(_){target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));} }
      });
      strip.appendChild(btn);
    }
    return btn;
  }
  function stabilize(){
    var strip=ensureStrip(); if(!strip) return;
    ORDER.forEach(function(k){ var p=proxy(k); if(p) strip.appendChild(p); });
    ORDER.forEach(function(k){ originals(k).forEach(function(b){ b.style.setProperty('position','absolute','important'); b.style.setProperty('left','-9999px','important'); b.style.setProperty('top','-9999px','important'); b.style.setProperty('opacity','0','important'); b.style.setProperty('pointer-events','none','important'); }); });
  }
  function injectStyle(){
    if(document.getElementById('antcv-preview-toolbar-stabilizer-style')) return;
    var st=document.createElement('style'); st.id='antcv-preview-toolbar-stabilizer-style';
    st.textContent='.antcv-preview-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:nowrap!important;overflow:visible!important;min-height:66px!important}' +
      '.antcv-preview-action-strip{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;margin-left:0!important;margin-right:6px!important}' +
      '.antcv-preview-actions>.antcv-export-buttons{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;margin-left:0!important}' +
      '.antcv-preview-mini-action{width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;max-width:54px!important;max-height:54px!important;border-radius:999px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;box-shadow:0 3px 12px rgba(0,0,0,.16)!important;background:#eef4f7!important;border:1px solid rgba(40,53,86,.45)!important;font-size:22px!important;cursor:pointer!important}' +
      '.antcv-preview-mini-action[data-antcv-preview-action-kind="privacy"]{border-color:#01B7BB!important;color:#00746E!important}' +
      '@media(max-width:720px){.antcv-preview-action-strip{gap:6px!important;margin-right:4px!important}.antcv-preview-mini-action{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;max-width:46px!important;max-height:46px!important}.antcv-preview-actions{gap:6px!important;padding-left:8px!important;padding-right:8px!important}}';
    document.head.appendChild(st);
  }
  function run(){ injectStyle(); stabilize(); }
  try{new MutationObserver(function(){requestAnimationFrame(run);}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','title','aria-label']});}catch(_){ }
  window.addEventListener('resize',run,{passive:true});
  document.addEventListener('click',function(){setTimeout(run,0);setTimeout(run,80);setTimeout(run,250);setTimeout(run,700);},true);
  [0,50,150,350,800,1500,3000].forEach(function(t){setTimeout(run,t);});
  window.AntcvPreviewToolbarStabilizer={version:'1.40.319',run:run};
})();
