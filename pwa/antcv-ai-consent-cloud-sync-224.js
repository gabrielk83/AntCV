/* AntCV AI consent cloud sync + delete scrub (v1.40.228)
 * -------------------------------------------------------
 * - Consent can be accepted locally before the relay/token exists.
 * - As soon as relay + token become available, mirror the local consent to cloud.
 * - If a user deletes itself, remove every local copy of the AI-notice agreement.
 */
(function(){
  'use strict';
  if (window.__antcvAiConsentCloudSync224) return;
  window.__antcvAiConsentCloudSync224 = true;

  var VERSION = '1.40.228';
  var TOKEN_KEY = 'antcv:auth:token';
  var EMAIL_KEY = 'antcv:auth:email';
  var SYNCED_KEY = 'antcv:ai-disclosure-cloud:synced-at';
  var LAST_TRY_KEY = 'antcv:ai-disclosure-cloud:last-try';
  var DELETE_MARKERS = ['antcv:ai-disclosure-declined-delete','antcv:user-delete-requested','antcv:delete-user-requested'];
  var CONSENT_KEYS = [
    'aiDisclosureAccepted',
    'aiDisclosureAcceptedMeta',
    'euAiDisclosureAccepted',
    'ai_disclosure_accepted',
    'aiDisclosureConsent',
    'eu_ai_disclosure_consent',
    'antcv:aiDisclosureAccepted',
    'antcv:aiDisclosureAcceptedMeta',
    'antcv:euAiDisclosureAccepted',
    'antcv:ai-disclosure-accepted',
    'antcv:ai-disclosure-accepted-meta',
    'antcv:ai-disclosure-cloud:synced-at',
    'antcv:ai-disclosure-cloud:last-try',
    'antcv:ai-disclosure-cloud:last-fetch'
  ];

  function nowIso(){ return new Date().toISOString(); }
  function readRaw(k){ try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }
  function writeRaw(k,v){ try { localStorage.setItem(k, v); } catch(_) {} }
  function removeRaw(k){ try { localStorage.removeItem(k); } catch(_) {} }
  function readUrlKey(k){
    var v = readRaw(k);
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch(_) {}
    return String(v || '').trim().replace(/\/+$/, '');
  }
  function relay(){
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
    return v;
  }
  function token(){ return readRaw(TOKEN_KEY); }
  function email(){ return readRaw(EMAIL_KEY); }
  function truthy(v){
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return !!s && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined' && s !== 'no';
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return truthy(v.accepted);
      if ('value' in v) return truthy(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }
  function localConsentMeta(){
    var at = '';
    var accepted = false;
    var meta = null;
    var raw = readRaw('aiDisclosureAccepted');
    if (truthy(raw)) { accepted = true; at = raw; }
    try {
      meta = JSON.parse(readRaw('aiDisclosureAcceptedMeta') || 'null');
      if (truthy(meta)) { accepted = true; at = meta.acceptedAt || meta.at || meta.timestamp || at; }
    } catch(_) {}
    try {
      var pi = JSON.parse(readRaw('personalInfo') || '{}') || {};
      if (truthy(pi.aiDisclosureAccepted) || truthy(pi.aiDisclosure) || truthy(pi.disclosureAccepted)) {
        accepted = true;
        at = pi.aiDisclosureAccepted || pi.aiDisclosureAcceptedAt || pi.disclosureAcceptedAt || at;
      }
    } catch(_) {}
    if (!accepted) return null;
    if (!at || typeof at !== 'string' || at.length < 8) at = nowIso();
    return { accepted:true, acceptedAt:at, source:(meta && meta.source) || 'local-backfill', email:email() || (meta && meta.email) || '' };
  }
  function markLocalConsent(at, source){
    at = at || nowIso();
    writeRaw('aiDisclosureAccepted', at);
    writeRaw('aiDisclosureAcceptedMeta', JSON.stringify({ accepted:true, acceptedAt:at, source:source || 'local', email:email() || '' }));
    try {
      var pi = JSON.parse(readRaw('personalInfo') || '{}') || {};
      pi.aiDisclosureAccepted = at;
      pi.aiDisclosure = true;
      pi.disclosureAccepted = true;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch(_) {}
  }
  function prefsPayload(meta){
    var at = meta.acceptedAt || nowIso();
    return {
      aiDisclosureAccepted: at,
      euAiDisclosureAccepted: at,
      aiDisclosureAcceptedMeta: { accepted:true, acceptedAt:at, source:meta.source || 'local-backfill', email:meta.email || email() || '' },
      personalInfo: { aiDisclosureAccepted:at, aiDisclosure:true, disclosureAccepted:true }
    };
  }
  function activeWizard(){
    try {
      var nodes = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-antcv-wizard], [data-antcv-modal="wizard"], [class*="wizard" i], [class*="setup" i]'));
      return nodes.some(function(n){ var cs=getComputedStyle(n), r=n.getBoundingClientRect(), t=(n.textContent||''); return cs.display!=='none' && cs.visibility!=='hidden' && r.width>2 && r.height>2 && /(wizard|setup|worker|provider|cloud|continue|next|skip)/i.test(t); });
    } catch(_) { return false; }
  }
  var inFlight = false;
  // KV-QUOTA-001 (owner console 2026-06-12): when the relay's KV daily write
  // quota is exhausted, every PUT 500s — and this sidecar retried every ~60s
  // forever, spamming the console AND burning more quota attempts. After 3
  // consecutive failures, back off ~10 minutes (the throttle key is pushed
  // into the future); any success resets the streak.
  var failStreak = 0;
  async function syncConsent(reason){
    if (inFlight) return false;
    var meta = localConsentMeta();
    var base = relay();
    var tok = token();
    if (activeWizard() && reason !== 'accepted-event' && reason !== 'forced') return false;
    if (!meta || !base || !tok) return false;
    // Do not spam a relay returning 500. Retry on login/focus and at most every 8 s.
    var last = Number(readRaw(LAST_TRY_KEY) || 0);
    if (last && Date.now() - last < 60000 && reason !== 'forced') return false;
    inFlight = true;
    writeRaw(LAST_TRY_KEY, String(Date.now()));
    try {
      markLocalConsent(meta.acceptedAt, meta.source || reason || 'local-backfill');
      var res = await fetch(base + '/api/prefs', {
        method:'PUT', credentials:'include',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json', 'Authorization':'Bearer ' + tok },
        body: JSON.stringify(prefsPayload(meta))
      });
      if (res && res.ok) {
        failStreak = 0;
        writeRaw(SYNCED_KEY, nowIso());
        try { window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-cloud-synced', { detail:{ version:VERSION, reason:reason || 'sync' } })); } catch(_) {}
        return true;
      }
      failStreak += 1;
      if (failStreak === 1 || failStreak === 3) {
        try { console.debug('[ai-consent-sync] cloud write failed', res && res.status, failStreak >= 3 ? '(backing off ~10 min)' : ''); } catch(_) {}
      }
      if (failStreak >= 3) writeRaw(LAST_TRY_KEY, String(Date.now() + 9 * 60000));
      return false;
    } catch(e) {
      try { console.debug('[ai-consent-sync] cloud write error', e && e.message); } catch(_) {}
      return false;
    } finally { inFlight = false; }
  }
  function scrubConsentLocal(){
    CONSENT_KEYS.forEach(removeRaw);
    try {
      var pi = JSON.parse(readRaw('personalInfo') || '{}') || {};
      ['aiDisclosureAccepted','aiDisclosureAcceptedAt','aiDisclosure','disclosureAccepted','disclosureAcceptedAt','euAiDisclosureAccepted','aiDisclosureAcceptedMeta'].forEach(function(k){ try { delete pi[k]; } catch(_) {} });
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch(_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-local-scrubbed', { detail:{ version:VERSION } })); } catch(_) {}
  }
  function watchDeleteMarkers(){
    for (var i=0;i<DELETE_MARKERS.length;i++) {
      try { if (sessionStorage.getItem(DELETE_MARKERS[i]) || localStorage.getItem(DELETE_MARKERS[i])) { scrubConsentLocal(); return true; } } catch(_) {}
    }
    return false;
  }
  function patchDeleteUser(){
    ['AntcvAiWizardSlide','AntcvAiNoticeActions'].forEach(function(name){
      var api = window[name];
      if (!api || api.__consentScrubPatched || typeof api.deleteUser !== 'function') return;
      var orig = api.deleteUser;
      api.deleteUser = function(){ scrubConsentLocal(); return orig.apply(this, arguments); };
      api.__consentScrubPatched = true;
    });
  }
  function scheduleSync(reason){ setTimeout(function(){ syncConsent(reason); }, 0); setTimeout(function(){ syncConsent(reason); }, 1200); }
  function init(){
    patchDeleteUser();
    if (watchDeleteMarkers()) return;
    scheduleSync('boot');
    window.addEventListener('antcv:ai-disclosure-accepted', function(){ scheduleSync('accepted-event'); });
    window.addEventListener('antcv:auth-changed', function(){ scheduleSync('auth-changed'); });
    window.addEventListener('storage', function(ev){
      if (!ev || ['proxyUrl','relayUrl',TOKEN_KEY,EMAIL_KEY,'aiDisclosureAccepted','aiDisclosureAcceptedMeta','personalInfo'].indexOf(ev.key) >= 0) scheduleSync('storage-' + (ev && ev.key || 'unknown'));
      if (ev && DELETE_MARKERS.indexOf(ev.key) >= 0) scrubConsentLocal();
    });
    ['focus','pageshow','visibilitychange'].forEach(function(ev){ window.addEventListener(ev, function(){ scheduleSync(ev); patchDeleteUser(); watchDeleteMarkers(); }); });
    var lastRelay = relay(), lastToken = token(), n = 0;
    setInterval(function(){
      n += 1;
      patchDeleteUser();
      if (watchDeleteMarkers()) return;
      var r = relay(), t = token();
      if ((r && r !== lastRelay) || (t && t !== lastToken) || (n % 8 === 0 && localConsentMeta() && r && t && !readRaw(SYNCED_KEY))) {
        lastRelay = r; lastToken = t; syncConsent('poll');
      }
    }, 1500);
  }
  window.AntcvAiConsentCloudSync = { version:VERSION, syncConsent:syncConsent, scrubConsentLocal:scrubConsentLocal, localConsentMeta:localConsentMeta };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
  try { console.debug('[ai-consent-sync] installed ' + VERSION); } catch(_) {}
})();
