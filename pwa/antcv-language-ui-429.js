/* AntCV language UI — consolidated sidecar (v1.50.429)
 * ============================================================================
 * SIDECAR-CONSOLIDATE G6 (2026-06-13): merges the language prefs/filter trio
 *   - antcv-lang-bar-filter.js      (v1.40.212) — hide unselected top-bar langs
 *   - antcv-language-prefs.js       (v1.50.110) — Settings → Personal panel + fonts
 *   - antcv-language-prefs-defaults.js (v1.40.339) — one-shot EN+DA seed/reset
 * into ONE file behind a SINGLE shared rAF scheduler + ONE MutationObserver
 * (was 2 observers + a 1200ms interval + two click/timeout fans).
 *
 * Each module's logic, idempotency guards, storage keys, dispatched events, and
 * debug API (AntcvLangBarFilter, AntcvLanguagePrefs, AntcvLanguagePrefsDefaults)
 * are preserved VERBATIM — only the per-module MutationObserver + boot wiring is
 * replaced by the shared scheduler. Module order inside the IIFE: Filter first
 * (defines AntcvLangBarFilter), then Prefs, then Defaults (which calls
 * AntcvLangBarFilter._applyAll). The owner-touched wizard-language-slide-339,
 * i18n, translation-patch, and language-ui-fixes-292 stay SEPARATE.
 *
 * Not merged: none of these wrap window.fetch (verified) — DOM/storage only.
 * The three old files remain on disk, unreferenced.
 */
(function () {
  'use strict';

  var SUITE_VERSION = '1.50.870';
  if (window.__antcvLanguageUI429 === SUITE_VERSION) return;
  window.__antcvLanguageUI429 = SUITE_VERSION;

  // Shared one-shot rAF scheduler — each module registers a tick fn; a single
  // MutationObserver (installed in boot) calls scheduleAll() on DOM churn.
  var ticks = [];
  var pending = false;
  function scheduleAll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      for (var i = 0; i < ticks.length; i++) {
        try { ticks[i](); } catch (_) {}
      }
    });
  }

  /* ========================================================================
   * MODULE — lang-bar-filter. Source: antcv-lang-bar-filter.js v1.40.212.
   * Hides top-bar language buttons not in the user's preference.
   * ===================================================================== */
  var Filter = (function () {
    if (window.__antcvLangBarFilterInstalled) return { boot: function () {}, tick: function () {} };
    window.__antcvLangBarFilterInstalled = '1.40.212';

    var STORAGE_KEY = 'antcv:visibleLanguages';

    var LABEL_TO_CODE = {
      'en': 'en', 'english': 'en',
      'da': 'da', 'dansk': 'da', 'danish': 'da',
      'zh': 'zh', 'zh-cn': 'zh', 'cn': 'zh',
      'chinese': 'zh', '中文': 'zh', '简体中文': 'zh', '中文（简体）': 'zh',
      'es': 'es', 'español': 'es', 'espanol': 'es', 'spanish': 'es',
      'fr': 'fr', 'français': 'fr', 'francais': 'fr', 'french': 'fr',
      'de': 'de', 'deutsch': 'de', 'german': 'de',
      'he': 'he', 'עב': 'he', 'עברית': 'he', 'hebrew': 'he', 'iw': 'he',
      'am': 'am', 'አማ': 'am', 'አማርኛ': 'am', 'amharic': 'am',
    };

    function labelToCode(text) {
      if (!text) return null;
      var t = String(text).trim().toLowerCase();
      if (LABEL_TO_CODE[t]) return LABEL_TO_CODE[t];
      if (/^[a-z]{2}$/.test(t)) return t;
      return null;
    }

    function readPreference() {
      // LANG-BAR-STALE-STYLEPREFS-001 (owner 2026-07-10): read the SYNCED
      // enabled-languages keys FIRST. prefs.enabledLanguages round-trips into
      // 'enabledLanguages' / 'antcv:enabledLanguages' (LANG-CLOUD-SYNC-001); the
      // older personalInfo.stylePrefs copy can be STALE (e.g. ['en','da'] after
      // zh was added) — reading it before the synced keys HID zh on every hard
      // refresh even though the cloud + the dropdown had zh.
      try {
        var SYNCED_KEYS = ['enabledLanguages', 'antcv:enabledLanguages'];
        for (var si = 0; si < SYNCED_KEYS.length; si++) {
          var sraw = localStorage.getItem(SYNCED_KEYS[si]);
          if (!sraw) continue;
          var sarr = JSON.parse(sraw);
          if (Array.isArray(sarr)) {
            var snorm = sarr.map(function (v) { return labelToCode(String(v)) || String(v).toLowerCase(); })
                            .filter(Boolean);
            if (snorm.length) return snorm;
          }
        }
      } catch (_) {}
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            var norm = arr.map(function (v) { return labelToCode(String(v)) || String(v).toLowerCase(); })
                            .filter(Boolean);
            if (norm.length) return norm;
          }
        }
      } catch (_) {}
      try {
        var rawPi = localStorage.getItem('personalInfo');
        if (rawPi) {
          var pi = JSON.parse(rawPi);
          var sp = pi && pi.stylePrefs;
          if (sp) {
            var candidates = [
              sp.visibleLanguages, sp.languageBar, sp.languages,
              sp.langBar, sp.shownLanguages,
            ];
            for (var i = 0; i < candidates.length; i++) {
              var c = candidates[i];
              if (Array.isArray(c) && c.length) {
                var norm2 = c.map(function (v) {
                  if (typeof v === 'string') return labelToCode(v) || v.toLowerCase();
                  if (v && typeof v === 'object' && v.code) return labelToCode(v.code) || String(v.code).toLowerCase();
                  return null;
                }).filter(Boolean);
                if (norm2.length) return norm2;
              }
            }
          }
        }
      } catch (_) {}
      return ['en', 'da'];
    }

    function findLanguageButtons() {
      var out = [];
      var buttons = document.querySelectorAll(
        'button, [role="button"], [data-antcv-lang]'
      );
      var byParent = new Map();
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var txt = (b.textContent || '').trim();
        if (!txt || txt.length > 12) continue;
        var code = labelToCode(txt);
        if (!code) continue;
        var parent = b.parentElement;
        if (!parent) continue;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push({ btn: b, code: code });
      }
      byParent.forEach(function (list) {
        if (list.length < 2 || list.length > 6) return;
        for (var j = 0; j < list.length; j++) out.push(list[j]);
      });
      return out;
    }

    function activeLangCode() {
      var v = '';
      try { v = String(localStorage.getItem('language') || '').toLowerCase(); } catch (_) {}
      if (!v) {
        try { v = String(localStorage.getItem('uiLang') || '').toLowerCase(); } catch (_) {}
      }
      if (!v) return 'en';
      if (v === 'zh-cn' || v === 'zh_cn' || v === 'cn') return 'zh';
      if (v.length >= 2) return v.substring(0, 2);
      return v;
    }

    function applyAll() {
      var wanted = readPreference();
      var entries = findLanguageButtons();
      if (!entries.length) return;
      var active = activeLangCode();

      var wantedSet = new Set((wanted || ['en', 'da']).map(function (c) { return c.toLowerCase(); }));

      if (wanted && wanted.length && !wantedSet.has(active)) {
        var next = wanted[0];
        try {
          localStorage.setItem('language', next);
          localStorage.setItem('uiLang', next);
          window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: next }));
          window.dispatchEvent(new CustomEvent('antcv:language-changed', { detail: { language: next } }));
        } catch (_) {}
      }

      var hidden = 0, shown = 0, changed = false;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var want = wantedSet.has(e.code);
        if (want) {
          if (e.btn.getAttribute('data-antcv-lang-hidden') === '1') {
            e.btn.removeAttribute('data-antcv-lang-hidden');
            try {
              e.btn.style.display = e.btn.__antcvOriginalDisplay || '';
              delete e.btn.__antcvOriginalDisplay;
            } catch (_) {}
            changed = true;
          }
          shown++;
        } else {
          if (e.btn.getAttribute('data-antcv-lang-hidden') !== '1') {
            e.btn.setAttribute('data-antcv-lang-hidden', '1');
            try {
              e.btn.__antcvOriginalDisplay = e.btn.style.display || '';
              e.btn.style.display = 'none';
            } catch (_) {}
            changed = true;
          }
          hidden++;
        }
      }
      if (changed) {
        try {
          console.debug('[lang-bar-filter] wanted=' + Array.from(wantedSet).join(',') +
            ' shown=' + shown + ' hidden=' + hidden);
        } catch (_) {}
      }
    }

    function boot() {
      window.addEventListener('storage', function (ev) {
        if (!ev) return;
        if (ev.key === STORAGE_KEY || ev.key === 'personalInfo' || ev.key === 'language') {
          scheduleAll();
        }
      });
      window.addEventListener('antcv:sections-updated', scheduleAll);
      [200, 600, 1500, 4000].forEach(function (d) { setTimeout(scheduleAll, d); });
      // Polling fallback for in-tab personalInfo edits.
      var lastPref = JSON.stringify(readPreference() || []);
      var lastActive = activeLangCode();
      setInterval(function () {
        var p = JSON.stringify(readPreference() || []);
        var a = activeLangCode();
        if (p !== lastPref || a !== lastActive) {
          lastPref = p;
          lastActive = a;
          scheduleAll();
        }
      }, 1200);
    }

    window.AntcvLangBarFilter = {
      version: '1.40.212',
      _readPreference: readPreference,
      _findLanguageButtons: findLanguageButtons,
      _activeLangCode: activeLangCode,
      _applyAll: applyAll,
      setPreference: function (arr) {
        try {
          if (!Array.isArray(arr)) throw new Error('expected array');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
          scheduleAll();
          return true;
        } catch (e) {
          try { console.warn('[lang-bar-filter] setPreference failed:', e && e.message); } catch (_) {}
          return false;
        }
      },
      clearPreference: function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        scheduleAll();
      },
    };

    try { console.debug('[lang-bar-filter] installed v1.40.212 (merged)'); } catch (_) {}
    return { boot: boot, tick: function () { try { applyAll(); } catch (_) {} } };
  })();

  /* ========================================================================
   * MODULE — language-prefs. Source: antcv-language-prefs.js v1.50.110.
   * The "LANGUAGES IN THE TOP BAR" panel in Settings → Personal + font
   * harmonizer. Preserved verbatim (dense one-liners kept as-is).
   * ===================================================================== */
  var Prefs = (function () {
    var VERSION = '1.50.110-font-harmonize';
    if (window.__antcvLanguagePrefsInstalled === VERSION) return { boot: function () {}, tick: function () {} };
    window.__antcvLanguagePrefsInstalled = VERSION;
    const OPTIONS=[
      {code:'en',label:'EN',name:'English'},
      {code:'da',label:'DA',name:'Dansk'},
      {code:'es',label:'ES',name:'Español'},
      {code:'zh',label:'中文',name:'中文'},
      {code:'he',label:'עב',name:'עברית'},
      {code:'am',label:'አማ',name:'አማርኛ'}
    ];
    const CODES=OPTIONS.map(o=>o.code), DEFAULT=['en','da'];
    function norm(x){return String(x||'').replace(/[ \t\r\n]+/g,' ').trim()}
    function shown(el){if(!el||el.nodeType!==1)return false;try{const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2}catch(_){return true}}
    function readJSON(k){try{const raw=localStorage.getItem(k);return raw?JSON.parse(raw):null}catch(_){return null}}
    function valid(a){a=(Array.isArray(a)?a:[]).map(v=>String(v||'').trim().toLowerCase()).filter(v=>CODES.includes(v));a=Array.from(new Set(a));return a.length?a:DEFAULT.slice()}
    function read(){return valid(readJSON('enabledLanguages')||readJSON('antcv:enabledLanguages')||((readJSON('antcv:prefs')||{}).enabledLanguages)||DEFAULT)}
    function write(a){const next=valid(a),raw=JSON.stringify(next);try{localStorage.setItem('enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:visibleLanguages',raw)}catch(_){}try{const prefs=readJSON('antcv:prefs')||{};prefs.enabledLanguages=next;localStorage.setItem('antcv:prefs',JSON.stringify(prefs))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:language-prefs-changed',{detail:{enabledLanguages:next,visibleLanguages:next,scope:'topbar-only'}}))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed',{detail:{enabledLanguages:next,scope:'topbar-only'}}))}catch(_){}return next}
    function activeish(b){try{if(b.getAttribute('aria-selected')==='true'||b.getAttribute('aria-pressed')==='true')return true;if(/active|selected|current/i.test(String(b.className||'')))return true;const cs=getComputedStyle(b);const s=[cs.backgroundColor,cs.borderColor,cs.color,cs.boxShadow].join(' ');return /rgb\(0, *183, *187\)|rgb\(1, *183, *187\)|rgb\(11, *180, *190\)|#00b7bb|#01b7bb|#0bb4be/i.test(s)}catch(_){return false}}
    function settingsRoot(){let best=null;Array.from(document.querySelectorAll('[role="dialog"],div')).forEach(el=>{if(!shown(el))return;const t=norm(el.textContent).slice(0,10000);if(/\bSettings\b/.test(t)&&/\bSTANDARD\b/i.test(t)&&/\bADVANCED\b/i.test(t)){if(!best||norm(el.textContent).length<norm(best.textContent).length)best=el}});return best}
    function activeButton(root,re){return Array.from(root.querySelectorAll('button,[role="button"],a')).filter(b=>re.test(norm(b.textContent))).find(activeish)||null}
    function isPersonal(root){const top=activeButton(root,/^(STANDARD|ADVANCED|ADMIN)$/i);const sub=activeButton(root,/^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i);const a=top?norm(top.textContent).toLowerCase():'';let b=sub?norm(sub.textContent).toLowerCase():'';if(b==='user')b='personal';return a==='standard'&&b==='personal'}
    function removeAllExcept(keep){Array.from(document.querySelectorAll('[data-antcv-language-prefs="1"]')).forEach(el=>{if(el!==keep)el.remove()});const root=settingsRoot();if(root){Array.from(root.querySelectorAll('details,section,article,fieldset,div')).forEach(el=>{if(el===keep||el.closest('[data-antcv-language-prefs="1"]'))return;const t=norm(el.textContent).slice(0,300);if(/^LANGUAGES IN THE TOP BAR\b/i.test(t))el.remove()})}}
    function contentHost(root){
      const anchors=Array.from(root.querySelectorAll('details,summary,div,section')).filter(el=>/^(ADVANCED TONE|BANNED WORDS)\b/i.test(norm(el.textContent).slice(0,120)));
      if(anchors.length){let a=anchors[anchors.length-1];let p=a.parentElement;for(let i=0;i<6&&p&&p!==root;i++,p=p.parentElement){if(p.children&&p.children.length>2)return p}return a.parentElement||root}
      const kids=Array.from(root.children).filter(shown);return kids.length?kids[kids.length-1]:root;
    }
    function build(){
      // PERSONAL-CARDS-VERTICAL-001 (owner 2026-06-13): full-width so the
      // "LANGUAGES IN THE TOP BAR" panel always takes its OWN row in the Personal
      // flex column and never sits horizontally beside the Done / personality
      // controls. Mirrors the personality-kernel + spell + tense cards.
      const wrap=document.createElement('details');wrap.dataset.antcvLanguagePrefs='1';wrap.setAttribute('data-antcv-language-prefs','1');wrap.open=false;wrap.style.cssText='margin:4px 0 12px 0;padding:0;border-radius:8px;width:100%;flex:0 0 100%;box-sizing:border-box;';
      const sum=document.createElement('summary');sum.textContent='LANGUAGES IN THE TOP BAR';sum.style.cssText='cursor:pointer;user-select:none;font-size:11px;font-weight:800;color:rgba(255,255,255,.72);padding:9px 12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.15);border-radius:8px;letter-spacing:.25px;list-style:none;text-transform:uppercase;';wrap.appendChild(sum);
      const body=document.createElement('div');body.style.cssText='padding:10px 12px 4px 12px;';const help=document.createElement('div');help.textContent='Choose which language buttons appear in the top bar. This does not translate or regenerate anything. At least one must stay enabled.';help.style.cssText='font-size:10px;color:rgba(255,255,255,.50);line-height:1.45;margin-bottom:10px;';body.appendChild(help);
      function repaint(){const on=new Set(read());body.querySelectorAll('input[data-code]').forEach(cb=>{cb.checked=on.has(cb.dataset.code)})}
      OPTIONS.forEach(o=>{const lab=document.createElement('label');lab.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 0 5px 0;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);cursor:pointer;';const cb=document.createElement('input');cb.type='checkbox';cb.dataset.code=o.code;cb.checked=read().includes(o.code);cb.style.cssText='accent-color:#01B7BB;';const span=document.createElement('span');span.textContent=o.label+' — '+o.name;span.style.cssText='font-size:11px;color:rgba(255,255,255,.88);font-weight:700;';lab.appendChild(cb);lab.appendChild(span);body.appendChild(lab);cb.addEventListener('click',ev=>ev.stopPropagation(),true);cb.addEventListener('change',ev=>{ev.stopPropagation();let next=Array.from(body.querySelectorAll('input[data-code]')).filter(x=>x.checked).map(x=>x.dataset.code);if(!next.length){cb.checked=true;next=[o.code]}write(next);repaint()})});wrap.appendChild(body);return wrap
    }
    function shortHeader(root,re){return Array.from(root.querySelectorAll('summary,button,div,span,h1,h2,h3,h4')).find(el=>shown(el)&&re.test(norm(el.textContent))&&norm(el.textContent).length<40)||null;}
    function harmonizeFonts(root){try{
      const adv=shortHeader(root,/^advanced tone\b/i);if(!adv)return;
      const cs=getComputedStyle(adv);
      const sig=[cs.fontSize,cs.fontWeight,cs.letterSpacing,cs.textTransform].join('|');
      const targets=[];
      const ws=Array.from(root.querySelectorAll('div,span,label,h1,h2,h3,h4')).find(el=>shown(el)&&/^writing style$/i.test(norm(el.textContent)));
      if(ws)targets.push(ws);
      const langSum=document.querySelector('[data-antcv-language-prefs="1"]>summary');
      if(langSum)targets.push(langSum);
      targets.forEach(el=>{
        if(el.getAttribute('data-antcv-font-harmonized-327')===sig)return;
        el.style.setProperty('font-size',cs.fontSize,'important');
        el.style.setProperty('font-weight',cs.fontWeight,'important');
        el.style.setProperty('font-family',cs.fontFamily,'important');
        el.style.setProperty('letter-spacing',cs.letterSpacing==='normal'?'normal':cs.letterSpacing,'important');
        el.style.setProperty('text-transform',cs.textTransform,'important');
        el.setAttribute('data-antcv-font-harmonized-327',sig);
      });
    }catch(_){}}
    // SETTINGS-PERSONAL-FREEZE-001 (owner 2026-07-03): this apply() used to run on
    // EVERY document mutation (shared observer) with an O(all divs × textContent)
    // settingsRoot scan, and re-derived contentHost each pass — when that heuristic
    // flapped (other sidecars mutating the column) the panel was RE-APPENDED,
    // creating the childList churn that woke every other sweep (part of the
    // settings-tab freeze/button-loop). Throttle to 400ms trailing and keep the
    // panel where it is while its current parent is still inside the root.
    let lastApply=0,applyT=null;
    let busy=false;function apply(){
      const nowT=Date.now();
      if(nowT-lastApply<400){if(!applyT){applyT=setTimeout(function(){applyT=null;apply();},400-(nowT-lastApply));}return;}
      lastApply=nowT;
      if(busy)return;busy=true;try{
      // BOOT-LANGUI-GATE-001 (1.50.870): skip the O(all-divs × getComputedStyle ×
      // getBoundingClientRect) settingsRoot() scan every mutation tick when settings
      // is clearly not open. Settings renders STANDARD/ADVANCED tab buttons; when
      // closed, they are absent from the DOM. If we already have an injected panel,
      // always check (it may need cleanup). Reduces boot sidecar-swarm CPU markedly.
      var _panelInDom=!!document.querySelector('[data-antcv-language-prefs="1"]');
      if(!_panelInDom){var _so=false,_btns=document.querySelectorAll('button');for(var _bi=0;_bi<_btns.length;_bi++){var _bu=(_btns[_bi].textContent||'').trim().toUpperCase();if(_bu==='STANDARD'||_bu==='ADVANCED'){_so=true;break;}}if(!_so){busy=false;return;}}
      const root=settingsRoot();if(!root){removeAllExcept(null);return}if(!isPersonal(root)){removeAllExcept(null);return}let panel=document.querySelector('[data-antcv-language-prefs="1"]');removeAllExcept(panel);if(!panel){panel=build()}
      // host stickiness: only re-place the panel when it is NOT already mounted
      // somewhere under the settings root (re-appending on every heuristic flap
      // was a mutation-storm source and made the card visibly jump).
      if(!(panel.parentElement&&root.contains(panel))){const host=contentHost(root);if(!host.contains(panel))host.appendChild(panel);}
      removeAllExcept(panel);harmonizeFonts(root)}catch(e){console.warn('[antcv-language-prefs] apply failed:',e&&e.message)}finally{busy=false}}
    window.AntcvLanguagePrefs={get:read,set:write,apply,VERSION};if(!readJSON('enabledLanguages'))write(DEFAULT);
    function boot(){
      document.addEventListener('click',()=>setTimeout(scheduleAll,0),true);
      [0,100,300,800,1600,3000].forEach(t=>setTimeout(apply,t));
    }
    return { boot: boot, tick: function () { try { apply(); } catch (_) {} } };
  })();

  /* ========================================================================
   * MODULE — language-prefs-defaults. Source: antcv-language-prefs-defaults.js
   * v1.40.339. Storage-only one-shot: seed EN+DA, or force-reset after delete.
   * Runs in boot AFTER Filter so window.AntcvLangBarFilter exists.
   * ===================================================================== */
  var Defaults = (function () {
    if (window.__antcvLanguagePrefsDefaults === '1.51.228-hardreset') return { boot: function () {} };
    window.__antcvLanguagePrefsDefaults = '1.51.228-hardreset';
    const DEFAULT_LANGS=['en','da'];
    function valid(arr){arr=(Array.isArray(arr)?arr:[]).map(x=>String(x||'').trim().toLowerCase()).filter(x=>['en','da','es','zh'].includes(x));arr=Array.from(new Set(arr));return arr.length?arr:DEFAULT_LANGS.slice()}
    function readStored(){try{const raw=localStorage.getItem('enabledLanguages')||localStorage.getItem('antcv:enabledLanguages')||localStorage.getItem('antcv:visibleLanguages');if(raw)return valid(JSON.parse(raw))}catch(_){}return null}
    function save(arr){const next=valid(arr),raw=JSON.stringify(next);try{localStorage.setItem('enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:visibleLanguages',raw)}catch(_){}try{const pi=JSON.parse(localStorage.getItem('personalInfo')||'{}')||{};pi.stylePrefs=pi.stylePrefs||{};pi.stylePrefs.visibleLanguages=next;pi.stylePrefs.languageBar=next;localStorage.setItem('personalInfo',JSON.stringify(pi))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:language-prefs-changed',{detail:{visibleLanguages:next,scope:'topbar-only'}}))}catch(_){}try{if(window.AntcvLangBarFilter&&window.AntcvLangBarFilter._applyAll)window.AntcvLangBarFilter._applyAll()}catch(_){}return next}
    function justDeletedRecent(){try{const ck=document.cookie||'';const m=ck.match(/(?:^|;\s*)antcv-just-deleted=([^;]+)/);if(!m)return false;const ts=parseInt(decodeURIComponent(m[1]),10);if(!ts)return false;return (Date.now()-ts)<24*60*60*1000}catch(_){return false}}
    // HARDRESET-LANG-RESTORE-001 (owner 2026-07-09): a language list the CLOUD
    // restore has written into personalInfo.stylePrefs.
    function readCloudLang(){try{const pi=JSON.parse(localStorage.getItem('personalInfo')||'{}')||{};const sp=pi.stylePrefs||{};const v=sp.visibleLanguages||sp.enabledLanguages||sp.languageBar;if(Array.isArray(v)&&v.length)return valid(v)}catch(_){}return null}
    window.AntcvLanguagePrefsDefaults={version:'1.51.228-hardreset',save,readStored,justDeletedRecent,readCloudLang};
    function boot(){
      // DELETE flow (antcv-just-deleted cookie): force a fresh EN+DA start.
      // Owner 2026-07-09: "if the user is deleted I want no restore."
      if(justDeletedRecent()){try{console.info('[language-prefs-defaults] antcv-just-deleted set; forcing EN+DA defaults')}catch(_){}save(DEFAULT_LANGS);return;}
      // Normal reload: local cache already holds the languages — leave it.
      if(readStored())return;
      // HARD RESET: local cache was cleared and the user's languages are arriving
      // from the CLOUD restore. Do NOT clobber with EN+DA — wait for the restored
      // list, and only fall back to defaults if none ever arrives (genuinely
      // anonymous / no cloud data). Owner: "languages are supposed to come from
      // the cloud as well as everything else."
      var applied=false;
      function tryApply(){if(applied)return true;var got=readStored()||readCloudLang();if(got){applied=true;save(got);return true}return false;}
      if(tryApply())return;
      var tries=0;
      var iv=setInterval(function(){tries++;if(tryApply()||tries>=24){clearInterval(iv);if(!applied)save(DEFAULT_LANGS);}},300);
      try{window.addEventListener('antcv:cloud-restored',tryApply);}catch(_){}
    }
    return { boot: boot };
  })();

  /* ========================================================================
   * Shared boot: register ticks, install the ONE MutationObserver (covers both
   * the settings-panel attribute churn AND the language-bar childList churn),
   * run each module's non-observer wiring + initial pass.
   * ===================================================================== */
  ticks.push(Filter.tick, Prefs.tick);

  function boot() {
    try { Filter.boot(); } catch (_) {}
    try { Prefs.boot(); } catch (_) {}
    try { Defaults.boot(); } catch (_) {}  // after Filter so AntcvLangBarFilter exists
    try {
      new MutationObserver(scheduleAll).observe(document.documentElement,
        { childList: true, subtree: true, attributes: true,
          attributeFilter: ['class', 'style', 'aria-selected', 'aria-pressed'] });
    } catch (_) {}
    scheduleAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try { console.debug('[language-ui-429] installed v' + SUITE_VERSION + ' (filter+prefs+defaults)'); } catch (_) {}
})();
