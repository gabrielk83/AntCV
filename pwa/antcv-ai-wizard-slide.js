/* AntCV AI wizard slide (v1.40.229)
 * Replaces the legacy floating EU AI notice.
 * - Removes legacy AI notice modals/backdrops so they cannot become ghosts.
 * - Shows the AI notice as a wizard slide only when the provider-selection step is visible.
 * - Accept records the same consent keys the app already uses.
 * - Disagree signs out. Disagree & Delete user runs the full erase flow.
 */
(function () {
  'use strict';
  if (window.__antcvAiWizardSlideInstalled) return;
  window.__antcvAiWizardSlideInstalled = '1.40.229';

  var LS_KEY = 'aiDisclosureAccepted';
  var META_KEY = 'aiDisclosureAcceptedMeta';
  var SLIDE_CLASS = 'antcv-ai-wizard-slide';

  function nowIso(){ return new Date().toISOString(); }
  function txt(el, max){ var t = (el && el.textContent || '').trim(); return max ? t.slice(0, max) : t; }
  function acceptedValue(v){
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return !!s && !/^(false|0|null|undefined|no)$/.test(s);
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return acceptedValue(v.accepted);
      if ('value' in v) return acceptedValue(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }
  function localAccepted(){
    var keys = [
      LS_KEY,
      'antcv:aiDisclosureAccepted',
      'antcv:ai-disclosure-accepted',
      'euAiDisclosureAccepted',
      'antcv:euAiDisclosureAccepted',
      'ai_disclosure_accepted',
      'eu_ai_disclosure_consent',
      'aiDisclosureConsent'
    ];
    for (var i=0; i<keys.length; i++) {
      try { if (acceptedValue(localStorage.getItem(keys[i]))) return true; } catch(_) {}
    }
    try {
      var meta = JSON.parse(localStorage.getItem(META_KEY) || localStorage.getItem('antcv:ai-disclosure-accepted-meta') || 'null');
      if (acceptedValue(meta)) return true;
    } catch(_) {}
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      if (acceptedValue(pi.aiDisclosureAccepted) || acceptedValue(pi.euAiDisclosureAccepted) || acceptedValue(pi.aiDisclosure) || acceptedValue(pi.disclosureAccepted)) return true;
      if (acceptedValue(pi.aiDisclosureAcceptedMeta)) return true;
      if (pi.meta && (acceptedValue(pi.meta.aiDisclosureAccepted) || acceptedValue(pi.meta.euAiDisclosureAccepted) || acceptedValue(pi.meta.aiDisclosure))) return true;
    } catch(_) {}
    try {
      var prefs = JSON.parse(localStorage.getItem('antcv:prefs') || localStorage.getItem('prefs') || '{}') || {};
      if (acceptedValue(prefs.aiDisclosureAccepted) || acceptedValue(prefs.euAiDisclosureAccepted) || acceptedValue(prefs.aiDisclosureAcceptedMeta)) return true;
    } catch(_) {}
    return false;
  }
  function wizardCompleted(){
    try { if (acceptedValue(localStorage.getItem('wizardCompleted'))) return true; } catch(_) {}
    try { if (acceptedValue(localStorage.getItem('antcv:wizardCompleted'))) return true; } catch(_) {}
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      if (acceptedValue(pi.wizardCompleted) || acceptedValue(pi.onboardingCompleted)) return true;
      if (pi.meta && acceptedValue(pi.meta.wizardCompleted)) return true;
    } catch(_) {}
    return false;
  }
  function substantialRestoredProfile(){
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      var keys = Object.keys(pi || {}).filter(function(k){ return pi[k] !== undefined && pi[k] !== null && String(pi[k]).trim() !== ''; });
      if (keys.length >= 8 && (pi.name || pi.email || pi.workHistory || pi.education || pi.skills)) return true;
    } catch(_) {}
    return false;
  }
  function markAccepted(){
    var at = nowIso();
    try { localStorage.setItem(LS_KEY, at); } catch(_) {}
    try { localStorage.setItem('antcv:aiDisclosureAccepted', at); } catch(_) {}
    try { localStorage.setItem(META_KEY, JSON.stringify({ accepted:true, acceptedAt:at, source:'wizard-slide' })); } catch(_) {}
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      pi.aiDisclosureAccepted = at;
      pi.aiDisclosure = true;
      pi.disclosureAccepted = true;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch(_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-accepted', { detail:{ source:'wizard-slide', at:at } })); } catch(_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key:LS_KEY, newValue:at })); } catch(_) {}
  }

  function isVisible(el){
    if (!el || el.nodeType !== 1) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
      var r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    } catch(_) { return true; }
  }
  function isWizardLike(el){
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (el.getAttribute('data-antcv-modal') === 'wizard' || el.getAttribute('data-antcv-wizard') !== null)) return true;
    var s = txt(el, 2200);
    return /(wizard|setup|getting\s+started|welcome|tell\s+antcv|worker|cloud|provider|openai|anthropic|mistral|google|gemini|api\s*key)/i.test(s) && /(next|back|skip|continue|provider|worker|cloud|setup)/i.test(s);
  }
  function isProviderStep(el){
    if (!el || el.nodeType !== 1) return false;
    var s = txt(el, 3200);
    // Do not show on import/status/section-format screens. Those screens can
    // mention cloud/worker/provider in helper text before the relay is ready.
    if (/Section\s+formats\s*[—-]|Found\s+\d+\s+work\s+entries|work\s+history|education|certifications|publications/i.test(s)) return false;
    // The notice belongs immediately before the provider picker, not after signup.
    // Require actual provider-choice UI text, not merely a cloud/relay hint.
    var hasProviderName = /(Anthropic|OpenAI|Mistral|Google|Gemini|Claude|GPT)/.test(s);
    var hasChoiceWords = /(select|choose|pick|provider|model|LLM|large\s+language\s+model)/i.test(s);
    var hasProviderControl = false;
    try {
      var controls = Array.from(el.querySelectorAll('button,[role="button"],select,option,label,input'));
      hasProviderControl = controls.some(function(c){ return /(Anthropic|OpenAI|Mistral|Google|Gemini|Claude|GPT)/i.test(txt(c, 180) + ' ' + String(c.value || '')); });
    } catch(_) {}
    return hasProviderName && hasChoiceWords && hasProviderControl;
  }
  function visibleWizardProviderStep(){
    var nodes = [];
    try { nodes = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-antcv-wizard], [data-antcv-modal], [class*="modal" i], [class*="wizard" i], [class*="setup" i]')); } catch(_) {}
    var best = null;
    for (var i=0; i<nodes.length; i++) {
      var n = nodes[i];
      if (!isVisible(n)) continue;
      if (n.classList && n.classList.contains(SLIDE_CLASS)) continue;
      if (n.querySelector && n.querySelector('.' + SLIDE_CLASS)) continue;
      if (isWizardLike(n) && isProviderStep(n)) {
        if (!best || txt(n, 2600).length < txt(best, 2600).length) best = n;
      }
    }
    return best;
  }

  function legacyAiNotice(el){
    if (!el || el.nodeType !== 1) return false;
    if (el.classList && el.classList.contains(SLIDE_CLASS)) return false;
    if (el.closest && el.closest('.' + SLIDE_CLASS)) return false;
    if (el.querySelector && el.querySelector('.' + SLIDE_CLASS)) return false;
    if (el.getAttribute && (el.getAttribute('data-antcv-modal') === 'ai-disclosure' || el.getAttribute('data-antcv-ai-disclosure') !== null || el.getAttribute('data-antcv-ai-cloud-hidden') === '1')) return true;
    var s = txt(el, 1600);
    return /AntCV\s+uses\s+generative\s+AI|AI-generated\s+output|EU\s+AI\s+Act\s+Article\s+50/i.test(s) && /I\s+understand|accept\s+these\s+terms|Continue|disclosure/i.test(s);
  }
  function removeLegacyNotices(){
    var nodes = [];
    try { nodes = Array.from(document.querySelectorAll('[data-antcv-modal="ai-disclosure"], [data-antcv-ai-disclosure], [data-antcv-ai-cloud-hidden="1"], [role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i], [class*="backdrop" i], [class*="scrim" i]')); } catch(_) {}
    nodes.forEach(function(n){
      if (!legacyAiNotice(n)) return;
      try { n.remove(); return; } catch(_) {}
      try { n.style.setProperty('display', 'none', 'important'); n.style.setProperty('pointer-events', 'none', 'important'); n.setAttribute('aria-hidden', 'true'); } catch(_) {}
    });
  }

  async function signOutOnly(){
    try { sessionStorage.setItem('antcv:ai-disclosure-declined', String(Date.now())); } catch(_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        await window.AntcvAuth.signOut();
        return;
      }
    } catch(_) {}
    try { localStorage.removeItem(LS_KEY); localStorage.removeItem('antcv:aiDisclosureAccepted'); localStorage.removeItem(META_KEY); } catch(_) {}
    try { location.reload(); } catch(_) {}
  }
  async function deleteUser(){
    try { sessionStorage.setItem('antcv:ai-disclosure-declined-delete', String(Date.now())); } catch(_) {}
    try {
      if (typeof window.AntcvFullErase === 'function') {
        await window.AntcvFullErase();
        return;
      }
    } catch(_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        await window.AntcvAuth.signOut();
        return;
      }
    } catch(_) {}
    try { localStorage.clear(); sessionStorage.clear(); location.reload(); } catch(_) {}
  }

  function injectStyles(){
    if (document.getElementById('antcv-ai-wizard-slide-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-ai-wizard-slide-style';
    st.textContent = '\n.' + SLIDE_CLASS + '{position:absolute;inset:0;z-index:2147483000;box-sizing:border-box;padding:28px;background:#263758;color:#f4f7ff;border-radius:14px;overflow:auto;pointer-events:auto;touch-action:auto;font-family:inherit;}\n' +
      '.' + SLIDE_CLASS + ' *{box-sizing:border-box;pointer-events:auto;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#03d7e8;font-weight:700;margin-bottom:14px;}\n' +
      '.' + SLIDE_CLASS + ' h2{margin:0 0 18px 0;font-size:24px;line-height:1.2;color:#fff;}\n' +
      '.' + SLIDE_CLASS + ' p{margin:0 0 14px 0;line-height:1.55;font-size:14px;color:#eef3ff;}\n' +
      '.' + SLIDE_CLASS + ' label{display:flex;gap:12px;align-items:center;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);border-radius:10px;padding:14px 16px;margin:20px 0 16px 0;font-weight:700;color:#fff;}\n' +
      '.' + SLIDE_CLASS + ' input[type="checkbox"]{width:18px;height:18px;flex:0 0 auto;accent-color:#04c8d8;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:8px;}\n' +
      '.' + SLIDE_CLASS + ' button{min-height:46px;border-radius:10px;border:1px solid rgba(255,255,255,.22);padding:10px 14px;font-weight:700;cursor:pointer;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-continue{background:#0b7d88;color:#fff;border-color:#0b7d88;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-continue:disabled{opacity:.45;cursor:not-allowed;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-disagree{background:transparent;color:#fff;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-delete{background:transparent;color:#fff;border-color:#ff6b78;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-foot{margin-top:18px;text-align:center;font-size:12px;color:rgba(255,255,255,.55);}\n' +
      '.antcv-ai-fixed-host{position:fixed;inset:0;z-index:2147482999;background:rgba(3,10,24,.72);padding:16px;display:flex;align-items:center;justify-content:center;pointer-events:auto;}\n' +
      '.antcv-ai-fixed-host .' + SLIDE_CLASS + '{position:relative;inset:auto;width:min(680px,100%);max-height:min(760px,92vh);box-shadow:0 18px 60px rgba(0,0,0,.35);}\n' +
      '@media (min-width:640px){.' + SLIDE_CLASS + ' .antcv-ai-actions{grid-template-columns:1fr auto auto;align-items:center}.' + SLIDE_CLASS + ' .antcv-ai-continue{min-width:180px}}\n';
    document.head.appendChild(st);
  }

  function showSlide(host){
    if (!host || localAccepted()) return;
    if (host.querySelector && host.querySelector('.' + SLIDE_CLASS)) return;
    injectStyles();
    try {
      var cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
    } catch(_) {}

    var slide = document.createElement('section');
    slide.className = SLIDE_CLASS;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-label', 'AntCV generative AI notice');
    slide.innerHTML =
      '<div class="antcv-ai-kicker">Before provider selection</div>' +
      '<h2>AntCV uses generative AI</h2>' +
      '<p>AntCV calls third-party large language models (Anthropic, OpenAI, Mistral, Google) to draft and adapt your CV and cover letter content. The text you submit is sent to the provider you select.</p>' +
      '<p>AI-generated output can be wrong or biased. You remain the author of every document AntCV produces. Review everything before sending it to an employer.</p>' +
      '<p>AntCV is intended for individual job seekers drafting their own application materials. It is not a recruitment, screening, or candidate-evaluation tool.</p>' +
      '<label><input type="checkbox" class="antcv-ai-check"> <span>I understand and accept these terms.</span></label>' +
      '<div class="antcv-ai-actions">' +
        '<button type="button" class="antcv-ai-continue" disabled>Continue</button>' +
        '<button type="button" class="antcv-ai-disagree">Disagree</button>' +
        '<button type="button" class="antcv-ai-delete">Disagree &amp; Delete user</button>' +
      '</div>' +
      '<div class="antcv-ai-foot">EU AI Act Article 50(1) disclosure. Acknowledgement recorded locally with a timestamp.</div>';

    var check = slide.querySelector('.antcv-ai-check');
    var cont = slide.querySelector('.antcv-ai-continue');
    check.addEventListener('change', function(){ cont.disabled = !check.checked; }, true);
    cont.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopPropagation();
      if (!check.checked) return;
      markAccepted();
      try { var fixed = slide.closest('.antcv-ai-fixed-host'); if (fixed) fixed.remove(); else slide.remove(); } catch(_) { slide.style.display = 'none'; }
    }, true);
    slide.querySelector('.antcv-ai-disagree').addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); signOutOnly(); }, true);
    slide.querySelector('.antcv-ai-delete').addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); deleteUser(); }, true);
    try { host.insertBefore(slide, host.firstChild); } catch(_) { host.appendChild(slide); }
    try { check.focus({ preventScroll:true }); } catch(_) {}
  }


  function hideCompletedWizardIfNeeded(){
    if (!localAccepted() || !(wizardCompleted() || substantialRestoredProfile())) return false;
    var nodes = [];
    try { nodes = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-antcv-wizard], [data-antcv-modal="wizard"], [class*="wizard" i], [class*="setup" i]')); } catch(_) {}
    markWizardCompletedLocal();
    nodes.forEach(function(n){
      if (!isVisible(n) || !isWizardLike(n)) return;
      var s = txt(n, 2200);
      // Keep non-wizard app panels safe. Only suppress onboarding/setup surfaces.
      if (!/(welcome|setup|getting\s+started|tell\s+antcv|provider|worker|cloud|skip|continue|next|back)/i.test(s)) return;
      try { n.remove(); return; } catch(_) {}
      try { n.style.setProperty('display','none','important'); n.style.setProperty('pointer-events','none','important'); n.setAttribute('aria-hidden','true'); } catch(_) {}
    });
    return true;
  }
  function visibleAnyWizard(){
    var nodes = [];
    try { nodes = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-antcv-wizard], [data-antcv-modal="wizard"], [class*="wizard" i], [class*="setup" i]')); } catch(_) {}
    for (var i=0; i<nodes.length; i++) {
      if (isVisible(nodes[i]) && isWizardLike(nodes[i])) return nodes[i];
    }
    return null;
  }
  function wizardWasExplicitlySkipped(){
    var keys = ['wizardSkipped','antcv:wizardSkipped','antcv:onboarding:skipped','antcv:wizard:skipped'];
    for (var i=0;i<keys.length;i++) { try { if (acceptedValue(localStorage.getItem(keys[i])) || acceptedValue(sessionStorage.getItem(keys[i]))) return true; } catch(_) {} }
    return false;
  }
  function showFallbackOverlay(){
    if (localAccepted()) return;
    if (document.querySelector('.antcv-ai-fixed-host')) return;
    // Never show the consent as a floating notice during active onboarding steps.
    // It must appear only as the inline slide immediately before provider selection.
    if (visibleAnyWizard()) return;
    // Fallback is only for the explicit “skip wizard” case where no wizard UI remains.
    if (!wizardWasExplicitlySkipped()) return;
    injectStyles();
    var host = document.createElement('div');
    host.className = 'antcv-ai-fixed-host';
    host.setAttribute('data-antcv-ai-consent-fallback','1');
    document.body.appendChild(host);
    showSlide(host);
  }

  function patchWizardSkipButtons(){
    try {
      Array.from(document.querySelectorAll('button,[role="button"],a')).forEach(function(b){
        if (b.__antcvAiSkipPatched) return;
        var t = txt(b, 80);
        if (!/^\s*skip\s*$/i.test(t) && !/skip\s+(setup|wizard|onboarding)/i.test(t)) return;
        b.__antcvAiSkipPatched = true;
        b.addEventListener('click', function(){ try { localStorage.setItem('antcv:wizardSkipped', String(Date.now())); } catch(_) {} }, true);
      });
    } catch(_) {}
  }

  function scan(){
    patchWizardSkipButtons();
    removeLegacyNotices();
    hideCompletedWizardIfNeeded();
    if (localAccepted()) {
      try { document.querySelectorAll('.' + SLIDE_CLASS).forEach(function(s){ s.remove(); }); } catch(_) {}
      return;
    }
    var host = visibleWizardProviderStep();
    if (host) { showSlide(host); return; }
    // If the wizard was explicitly skipped before consent, show a clean fixed consent step.
    setTimeout(function(){
      if (!localAccepted() && !visibleWizardProviderStep()) showFallbackOverlay();
    }, 50);
  }

  try {
    var mo = new MutationObserver(function(){ setTimeout(scan, 0); });
    mo.observe(document.documentElement || document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','role','data-antcv-modal','data-antcv-wizard','data-antcv-ai-disclosure'] });
  } catch(_) {}
  [0,100,250,500,1000,1500,2500,4000,7000,12000,20000].forEach(function(t){ setTimeout(scan, t); });
  window.addEventListener('storage', scan);
  window.addEventListener('focus', function(){ setTimeout(scan, 0); });
  window.AntcvAiWizardSlide = { version:'1.40.229', scan:scan, markAccepted:markAccepted, signOutOnly:signOutOnly, deleteUser:deleteUser };
  try { console.debug('[ai-wizard-slide] installed v1.40.229'); } catch(_) {}
})();
