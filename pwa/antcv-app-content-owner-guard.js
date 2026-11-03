/* antcv-app-content-owner-guard.js — APP-CONTENT-OWNER-001 (owner 2026-11-01)
 * ============================================================================
 * THE BUG (D1 application 3524, Ambu): the user moved from the Terma application to
 * Ambu, meta switched to Ambu, generation never ran (no LLM calls), and the editor
 * kept the Terma CV and letter. Preview and export showed them as the Ambu
 * application. Nothing records which application the content was written for.
 *
 * THIS GUARD stamps the tailored sections with the application they were written
 * for and blocks preview + export when they belong to a different one:
 *   - signature = hash of each JD-tailored section (CV profile / core competencies,
 *     CL opening / why / role view / bring / contribute). Kernel-standard sections
 *     (work style, who, foundation, closure) are not signed: they are identical
 *     across applications.
 *   - stamped on generation complete (app.js dispatches antcv:generation-complete),
 *     once at first boot (adopt what is there), and when content arrives that no
 *     application owns yet (a cloud row load) after meta and content are stable.
 *   - stale = a signed section of the checked document is owned only by OTHER
 *     applications. Content that was regenerated for this application is owned by it.
 *   - stale -> the preview papers dim, a banner names both applications, and
 *     antcv-export-content-gate.js refuses the export. "Keep for <current>" re-stamps
 *     (for a corrected company name). Content is never deleted: switching back to
 *     the owning application clears the block.
 * Kill switch: localStorage['antcv:disable-content-owner-guard'] = '1'.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.5242';
  var STORE = 'antcv:contentOwner';
  var MAX_SIGS = 240;
  var SIGNED = {
    cv: ['profile', 'core_comp'],
    cl: ['opening', 'why', 'role_view', 'bring', 'contribute']
  };

  function CM() { return root && root.AntcvCompanyMatch; }
  function hash(s) {
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = ((h1 << 5) + h1) ^ c; h2 = ((h2 << 5) + h2) ^ c; }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + s.length.toString(16);
  }
  function textOf(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(textOf).join(' ');
    if (typeof v === 'object') {
      var out = [];
      ['content', 't', 'b', 'v', 'l', 'items', 'rows', 'bullets'].forEach(function (k) { if (v[k] != null) out.push(textOf(v[k])); });
      return out.join(' ');
    }
    return '';
  }
  function looksTemplate(s) {
    var t = String(s || '').replace(/\[[^\]\n]{1,200}\]\((?:https?:|mailto:)[^)\s]*\)/g, '');
    return /\[[^\]]{2,600}\]/.test(t);
  }
  function appKey(meta) {
    meta = meta || {};
    return String(meta.company || '').trim() + '|' + String(meta.role || '').trim();
  }
  function splitKey(k) { var i = String(k).indexOf('|'); return { company: i < 0 ? k : k.slice(0, i), role: i < 0 ? '' : k.slice(i + 1) }; }

  // Signatures of the tailored sections of one document (or both).
  function sigsOf(sections, doc) {
    var out = [];
    ['cv', 'cl'].forEach(function (d) {
      if (doc && doc !== 'both' && doc !== d) return;
      var list = (sections && Array.isArray(sections[d])) ? sections[d] : [];
      list.forEach(function (s) {
        if (!s || SIGNED[d].indexOf(s.id) < 0 || s.on === false) return;
        var t = textOf(s).replace(/\s+/g, ' ').trim();
        if (t.length < 40 || looksTemplate(t)) return;
        out.push({ doc: d, id: s.id, h: hash(d + ':' + s.id + ':' + t.toLowerCase()) });
      });
    });
    return out;
  }

  function sameApp(aKey, meta) {
    var a = splitKey(aKey), cm = CM();
    if (cm) return cm.sameApp(a, { company: meta.company || '', role: meta.role || '' });
    return aKey === appKey(meta);
  }

  // Pure verdict: null (fine) or { doc, owner:{company,role}, current, foreign:[ids] }.
  function verdict(sections, meta, store, doc) {
    meta = meta || {};
    if (!String(meta.company || '').trim() && !String(meta.role || '').trim()) return null;
    var sigs = (store && store.sigs) || {};
    var foreign = [], ownerKey = null;
    sigsOf(sections, doc).forEach(function (g) {
      var owners = sigs[g.h] && sigs[g.h].o;
      if (!owners || !owners.length) return;
      var mine = owners.some(function (k) { return sameApp(k, meta); });
      if (mine) return;
      foreign.push(g.doc + '.' + g.id);
      if (!ownerKey) ownerKey = owners[owners.length - 1];
    });
    if (!foreign.length) return null;
    return { doc: doc || 'both', owner: splitKey(ownerKey), current: { company: String(meta.company || ''), role: String(meta.role || '') }, foreign: foreign };
  }

  // Pure: which signatures are unknown to the store.
  function unknownSigs(sections, store) {
    var sigs = (store && store.sigs) || {};
    return sigsOf(sections, 'both').filter(function (g) { return !sigs[g.h]; });
  }

  // Pure: store with every signature of `sections` owned by meta's application.
  function stampInto(store, sections, meta, now) {
    var s = (store && typeof store === 'object') ? store : {};
    var sigs = (s.sigs && typeof s.sigs === 'object') ? s.sigs : {};
    var key = appKey(meta);
    if (key === '|') return { v: 1, sigs: sigs };
    sigsOf(sections, 'both').forEach(function (g) {
      var e = sigs[g.h] || { o: [] };
      e.o = (e.o || []).filter(function (k) { return k !== key; });
      e.o.push(key);
      if (e.o.length > 4) e.o = e.o.slice(-4);
      e.ts = now || Date.now();
      sigs[g.h] = e;
    });
    var ks = Object.keys(sigs);
    if (ks.length > MAX_SIGS) {
      ks.sort(function (a, b) { return (sigs[a].ts || 0) - (sigs[b].ts || 0); });
      ks.slice(0, ks.length - MAX_SIGS).forEach(function (k) { delete sigs[k]; });
    }
    return { v: 1, sigs: sigs };
  }

  // ── storage-backed side ──────────────────────────────────────────────────
  function ls() { try { return root.localStorage || null; } catch (_) { return null; } }
  function rd(k) { try { var s = ls(); return s ? JSON.parse(s.getItem(k) || 'null') : null; } catch (_) { return null; } }
  function wr(k, v) { try { var s = ls(); if (s) s.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function disabled() { try { var s = ls(); return !!s && s.getItem('antcv:disable-content-owner-guard') === '1'; } catch (_) { return false; } }
  function state() { return { sections: rd('sections') || {}, meta: rd('meta') || {}, store: rd(STORE) }; }

  // A letter that does not name a targeted company is not that application's letter:
  // automatic adoption (first boot, unowned content) never claims it, nor the CV beside it.
  function letterNamesCompany(sections, meta) {
    var cm = CM(), co = String((meta && meta.company) || '').trim();
    if (!cm || !cm.isTargeted(co)) return true;
    var cl = (sections && Array.isArray(sections.cl)) ? sections.cl : [];
    var t = cl.filter(function (s) { return s && s.on !== false; }).map(textOf).join(' ');
    if (!t.trim()) return true;   // no letter yet: nothing contradicts the CV
    return cm.names(t, co);
  }

  function stamp(src) {
    var st = state();
    var auto = src === 'first boot' || src === 'adopted unowned content';
    if (auto && st.store && !letterNamesCompany(st.sections, st.meta)) return;
    if (auto && !st.store && !letterNamesCompany(st.sections, st.meta)) { wr(STORE, { v: 1, sigs: {} }); return; }
    var next = stampInto(st.store, st.sections, st.meta);
    wr(STORE, next);
    try { console.log('[content-owner] APP-CONTENT-OWNER-001: stamped content for "' + appKey(st.meta) + '" (' + src + ')'); } catch (_) {}
    refresh();
  }
  function currentVerdict(doc) {
    if (disabled()) return null;
    var st = state();
    return verdict(st.sections, st.meta, st.store, doc || 'both');
  }

  // Adopt content no application owns yet (a cloud row load, another device) once
  // meta and content have been stable for STABLE_MS. Never adopts foreign content.
  var STABLE_MS = 4000;
  var lastSeen = { meta: '', sig: '', since: 0 };
  function maybeAdopt() {
    var st = state();
    if (!st.store) { stamp('first boot'); return; }
    var mk = appKey(st.meta);
    if (mk === '|') return;
    var unk = unknownSigs(st.sections, st.store);
    var all = sigsOf(st.sections, 'both');
    var sigKey = all.map(function (g) { return g.h; }).join(',');
    var now = Date.now();
    if (mk !== lastSeen.meta || sigKey !== lastSeen.sig) { lastSeen = { meta: mk, sig: sigKey, since: now }; return; }
    if (!unk.length || now - lastSeen.since < STABLE_MS) return;
    if (verdict(st.sections, st.meta, st.store, 'both')) return;   // some section is foreign: never adopt
    if (unk.length !== all.length) return;                          // half-known content: wait for a stamp
    stamp('adopted unowned content');
  }

  // ── preview block + banner ───────────────────────────────────────────────
  var STYLE_ID = 'antcv-content-owner-style', BANNER_ID = 'antcv-content-owner-banner';
  var staleSince = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function label(a) { return [a.company, a.role].filter(Boolean).join(' — ') || '(no application)'; }
  function ensureStyle() {
    if (!root.document || root.document.getElementById(STYLE_ID)) return;
    var st = root.document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      'body.antcv-content-stale .antcv-preview-paper{filter:grayscale(1);opacity:.32;pointer-events:none}' +
      '#' + BANNER_ID + '{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:min(640px,92vw);' +
      'background:#7a1d1d;color:#fff;font:13px/1.45 system-ui,sans-serif;padding:12px 14px;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.28);z-index:9000}' +
      '#' + BANNER_ID + ' b{font-weight:700}#' + BANNER_ID + ' button{margin:8px 8px 0 0;padding:5px 10px;border-radius:6px;' +
      'border:1px solid rgba(255,255,255,.6);background:transparent;color:#fff;cursor:pointer;font:inherit}';
    (root.document.head || root.document.documentElement).appendChild(st);
  }
  function render(v) {
    var d = root.document; if (!d || !d.body) return;
    var b = d.getElementById(BANNER_ID);
    if (!v) {
      d.body.classList.remove('antcv-content-stale');
      if (b) b.remove();
      return;
    }
    ensureStyle();
    d.body.classList.add('antcv-content-stale');
    if (!b) { b = d.createElement('div'); b.id = BANNER_ID; b.setAttribute('role', 'alert'); d.body.appendChild(b); }
    var docs = v.foreign.some(function (f) { return f.indexOf('cv.') === 0; }) && v.foreign.some(function (f) { return f.indexOf('cl.') === 0; })
      ? 'CV and cover letter were' : (v.foreign[0].indexOf('cv.') === 0 ? 'CV was' : 'cover letter was');
    var html = '<b>This ' + docs + ' written for ' + esc(label(v.owner)) + '.</b> The current application is ' +
      esc(label(v.current)) + '. Generate for this application before you preview or export.' +
      '<br><button type="button" data-act="keep">The content is for ' + esc(v.current.company || 'this application') + ' — keep it</button>';
    if (b.getAttribute('data-html') !== html) { b.innerHTML = html; b.setAttribute('data-html', html); }
    var keep = b.querySelector('[data-act="keep"]');
    if (keep && !keep.__antcvBound) {
      keep.__antcvBound = 1;
      keep.addEventListener('click', function () { staleSince = 0; stamp('kept by user'); });
    }
  }
  // Ride out the meta/sections switch transient: show the block only once the content has
  // been stale for SETTLE_MS (event-driven refreshes fire in bursts, so count time, not calls).
  var SETTLE_MS = 2500;
  function refresh() {
    if (disabled()) { render(null); return; }
    var v = currentVerdict('both');
    var now = Date.now();
    if (!v) { staleSince = 0; render(null); return; }
    if (!staleSince) staleSince = now;
    render(now - staleSince >= SETTLE_MS ? v : null);
    if (now - staleSince < SETTLE_MS) setTimeout(refresh, SETTLE_MS - (now - staleSince) + 50);
  }

  function boot() {
    if (!root.addEventListener) return;
    root.addEventListener('antcv:generation-complete', function () {
      // React persists meta + sections a tick after the event: stamp after they land.
      [1200, 4000].forEach(function (ms) { setTimeout(function () { if (!disabled()) stamp('generation complete'); }, ms); });
    });
    root.addEventListener('antcv:sections-updated', function () { setTimeout(refresh, 50); });
    root.addEventListener('storage', function (e) { if (!e || e.key === 'meta' || e.key === 'sections') setTimeout(refresh, 50); });
    setInterval(function () { if (!disabled()) { maybeAdopt(); refresh(); } }, 1500);
    setTimeout(function () { if (!disabled()) maybeAdopt(); }, 2500);
  }

  var API = {
    version: VERSION, verdict: verdict, sigsOf: sigsOf, stampInto: stampInto, unknownSigs: unknownSigs,
    currentVerdict: currentVerdict, stamp: stamp, refresh: refresh, STORE: STORE
  };
  if (root) root.AntcvAppContentOwner = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else if (root && root.document && root.__antcvContentOwnerGuard !== VERSION) { root.__antcvContentOwnerGuard = VERSION; boot(); }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
