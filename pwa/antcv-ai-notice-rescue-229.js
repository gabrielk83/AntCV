/* AntCV AI notice rescue (v1.40.229)
 * Prevents the consent step from becoming a blank blue panel.
 */
(function(){
  'use strict';
  if (window.__antcvAiNoticeRescue229) return;
  window.__antcvAiNoticeRescue229 = true;
  function accepted(){
    try { return !!(localStorage.getItem('aiDisclosureAccepted') || localStorage.getItem('antcv:aiDisclosureAccepted')); } catch(_) { return false; }
  }
  function txt(el){ return (el && el.textContent || '').trim(); }
  function visible(el){
    try { var r=el.getBoundingClientRect(), cs=getComputedStyle(el); return r.width>2 && r.height>2 && cs.display!=='none' && cs.visibility!=='hidden'; } catch(_) { return false; }
  }
  function rescue(){
    if (accepted()) return;
    var s = document.querySelector('.antcv-ai-wizard-slide');
    if (!s) return;
    try {
      s.style.setProperty('display','block','important');
      s.style.setProperty('visibility','visible','important');
      s.style.setProperty('opacity','1','important');
      s.style.setProperty('pointer-events','auto','important');
      s.style.setProperty('position','relative','important');
      s.style.setProperty('inset','auto','important');
      s.style.setProperty('min-height','420px','important');
      var host = s.parentElement;
      if (host) {
        host.style.setProperty('overflow','auto','important');
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      }
      if (!/AntCV uses generative AI/.test(txt(s))) {
        s.innerHTML = '<div class="antcv-ai-kicker">Before provider selection</div><h2>AntCV uses generative AI</h2><p>AntCV calls third-party large language models (Anthropic, OpenAI, Mistral, Google) to draft and adapt your CV and cover letter content. The text you submit is sent to the provider you select.</p><p>AI-generated output can be wrong or biased. You remain the author of every document AntCV produces. Review everything before sending it to an employer.</p><p>AntCV is intended for individual job seekers drafting their own application materials. It is not a recruitment, screening, or candidate-evaluation tool.</p><label><input type="checkbox" class="antcv-ai-check"> <span>I understand and accept these terms.</span></label><div class="antcv-ai-actions"><button type="button" class="antcv-ai-continue" disabled>Continue</button><button type="button" class="antcv-ai-disagree">Disagree</button><button type="button" class="antcv-ai-delete">Disagree &amp; Delete user</button></div><div class="antcv-ai-foot">EU AI Act Article 50(1) disclosure. Acknowledgement recorded locally with a timestamp.</div>';
      }
      var check=s.querySelector('.antcv-ai-check'), cont=s.querySelector('.antcv-ai-continue');
      if (check && cont && !check.__antcvRescueBound) {
        check.__antcvRescueBound=true;
        check.addEventListener('change', function(){ cont.disabled=!check.checked; }, true);
        cont.addEventListener('click', function(ev){ if(!check.checked) return; ev.preventDefault(); ev.stopPropagation(); try { window.AntcvAiWizardSlide && window.AntcvAiWizardSlide.markAccepted && window.AntcvAiWizardSlide.markAccepted(); } catch(_) {} try { s.remove(); } catch(_) {} }, true);
      }
    } catch(_) {}
  }
  [250,600,1000,1600,2500,4000,7000].forEach(function(t){ setTimeout(rescue,t); });
  try { new MutationObserver(function(){ setTimeout(rescue,0); }).observe(document.documentElement,{childList:true,subtree:true,attributes:true}); } catch(_) {}
})();
