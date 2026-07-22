/* AntCV sections normalizer (restore-proof).
 * ============================================================
 * Two stored-section rules kept failing because the kernel cloud-restore
 * ([KERNEL-CLOUD-PERSIST] reapplies a stale slot AFTER the React
 * normalization effects run, so the order/title reverts:
 *   - RECOMMENDATIONS must sit after the LAST of experience / PROFESSIONAL
 *     EXPERIENCE (owner 2026-06-13).
 *   - "Founder" must not appear in a role title (kept "Independent" for
 *     consultancy) (owner 2026-06-13).
 * This sidecar re-applies both on every antcv:sections-updated (the event
 * the restore itself fires) plus a short boot sweep, reading + writing
 * localStorage directly so React/restore ordering can't out-race it.
 * Loop-safe: writes only on a real change, tags its own event, and ignores
 * that tag.
 */
(function () {
  'use strict';
  var VERSION = '1.51.1644-compl-selflimit';
  if (window.__antcvSectionsNormalize === VERSION) return;
  window.__antcvSectionsNormalize = VERSION;

  var SRC = 'sections-normalize-415';

  function isRec(e) {
    return e && (e.id === 'recommendations' ||
      /RECOMMENDATIONS|REFERENCER|ANBEFALINGER|RECOMENDACIONES|推荐人/i.test(String(e.title || '')));
  }
  // B9 (owner 2026-06-14): RECOMMENDATIONS must sit after PROFESSIONAL
  // EXPERIENCE. The anchor matched type==='experience' OR an EXPERTISE title,
  // but an imported/parsed roles section can arrive mis-typed (not
  // type==='experience'), so it was not recognised and recs landed after the
  // competencies/EXPERTISE block instead of after the roles. Also match an
  // EXPERIENCE / ERFARING title so the roles section is always an anchor; recs
  // lands after the LAST anchor, which is the roles block in normal order.
  function isAnchor(e) {
    return e && !isRec(e) && (e.type === 'experience' ||
      (e.loc === 'main' && /PROFESSIONAL EXPER(TISE|IENCE)|\bEXPER(TISE|IENCE)\b|EKSPERTISE|ERFARING/i.test(String(e.title || ''))));
  }

  // OWNER-PRESENT-GATE-001 (owner 2026-06-22): after a DELETE, personalInfo is cleared but the
  // floor restores an empty me() skeleton — and the Gabriel-specific INJECTORS below (pinInterests'
  // CANON_INTERESTS, placeRecs' "Danish and international recommenders…") then re-plant his data into
  // the blank sections, so a deleted/fresh user sees his interests + recommendations instead of a
  // template (a contamination/privacy gap + it stops the wizard). Gate those injectors: only inject
  // when REAL owner data is present in personalInfo. (The role-correctors — canonKanzen etc. — are
  // already no-ops on a fresh skeleton since there are no matching roles to correct.)
  function ownerPresent() {
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      return !!(String(pi.name || '').trim() || String(pi.email || '').trim() ||
        (Array.isArray(pi.interests) && pi.interests.length) || (Array.isArray(pi.experience) && pi.experience.length));
    } catch (_) { return true; }   // on a genuine parse error, don't disrupt the owner
  }

  // INTERESTS-LEAK-SOURCE-001 (owner 2026-06-23: "a persona whose kernel lacks interests inherits
  // Gabriel's generated/default INTERESTS"). The two INTERESTS injectors below (pinInterests'
  // CANON_INTERESTS + scrubJuniorRugby's canonical rugby row) embed Gabriel's LITERAL hobbies
  // (cats, "literally a team player", tai-chi). ownerPresent() only proves SOMEONE is present, not
  // that it is Gabriel — so loading Anita/Devon (who have a name + experience) passed the gate and
  // their short/absent INTERESTS got force-filled with HIS canon. Name-guard those two injectors to
  // Gabriel specifically (same /\bgabriel\b/i pattern app.src.js uses for __ANTCV_GABRIEL_KERNEL).
  // His stale-flip protection is preserved; every other persona keeps its own interests untouched.
  function gabrielPresent() {
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      return /\bgabriel\b/i.test(String(pi.name || ''));
    } catch (_) { return false; }
  }

  function stripFounder(cv) {
    var touched = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var roles = s.roles.map(function (r) {
        if (!r || !r.title || !/\bfounder\b/i.test(String(r.title))) return r;
        var cleaned = String(r.title)
          .replace(/\bco[-\s]?founder\b/gi, '')
          .replace(/\bfounder\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[\s&,/|-]+|[\s&,/|-]+$/g, '')
          .replace(/\s+[&,/|]\s*$/g, '')
          .trim();
        if (cleaned && cleaned !== r.title) { touched = true; return Object.assign({}, r, { title: cleaned }); }
        return r;
      });
      return touched ? Object.assign({}, s, { roles: roles }) : s;
    });
    return touched ? out : null;
  }

  function placeRecs(cv) {
    var anchor = -1;
    cv.forEach(function (e, i) { if (isAnchor(e)) anchor = i; });
    if (anchor < 0) return null;
    var ri = cv.findIndex(isRec);
    // RECS-RESPECT-MANUAL-ORDER-001 (owner 2026-06-18: "I move PUBLICATIONS before
    // RECOMMENDATIONS, it holds 5s then flips back"). Only relocate RECOMMENDATIONS
    // when it is MISSING or sits BEFORE the experience anchor (the original bug).
    // If it is ALREADY after experience - even with another section (PUBLICATIONS &
    // PATENT, etc.) the user moved between them - respect that manual order and do
    // nothing. (Was: forced recs to anchor+1, which reverted any manual move.)
    if (ri > anchor) return null;
    // Don't CREATE Gabriel's recommendations for a fresh/deleted user — only relocate an existing one.
    if (ri < 0 && !ownerPresent()) return null;
    var copy = cv.slice();
    var rec;
    if (ri >= 0) rec = copy.splice(ri, 1)[0];
    else rec = { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'main', on: true, type: 'text', content: 'Danish and international recommenders on request.' };
    var a2 = -1;
    copy.forEach(function (e, i) { if (isAnchor(e)) a2 = i; });
    if (a2 < 0) return null;
    copy.splice(a2 + 1, 0, rec);
    return copy;
  }

  // COMPANY-VARIANT-KEY-001 (owner 2026-07-02, LIVE localStorage probe): the canon functions
  // (canonIDF, canonTAU, canonCopenhagenWolves) rewrite a VISIBLE role's company to a short/
  // canonical form, but dedupeRoles compared the RAW company and repairExperienceCompleteness
  // compared a raw title|company KEY against personalInfo (which still holds the long form). So a
  // canon-transformed role no longer matched its PI source and repairExperienceCompleteness
  // re-inserted the PI copy as a HIDDEN duplicate — the owner's "many positions doubled" (live: a
  // hidden "Israel Defense Forces, Communication Corps" beside the visible "IDF, Communication
  // Corps"; a hidden "Tel Aviv University - Electrical Engineering" beside "Tel Aviv University"; a
  // hidden "Copenhagen Wolves RFC - Pan Idræt" beside "Pan Idræt"). These helpers make company/
  // title/year comparison variant-tolerant so the same real-world position is recognised across a
  // canon rewrite.
  //   _companyKey  — lowercase, expand IDF<->Israel Defense Forces, strip a trailing "- Dept"/
  //                  ", Corps" qualifier + parentheticals, collapse to tokens.
  //   _titleCore   — lowercase, drop parentheticals + an "& Assistant Coach"/"and …" tail, tokens.
  //   _yrKey       — normalised "start-end" span (present/current -> 9999).
  //   _samePosition — SAME real position when year spans match AND title cores match/prefix (covers
  //                  IDF, the TAU dept-suffix, and the CW "& Assistant Coach" variants). Deliberately
  //                  NOT company-only (two distinct roles can share a company + years).
  function _companyKey(c) {
    var s = String(c == null ? '' : c).toLowerCase().replace(/\bidf\b/g, 'israel defense forces');
    s = s.split(/[-–—,]/)[0].replace(/\([^)]*\)/g, ' ');
    return s.replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // BABEL-DEDUP-SCRIPT-001 (owner 2026-07-11 "13 pages of CV"): the dedup was
  // TRANSLATION-BLIND. _titleCore stripped every non-[a-z0-9] char, so a zh/he/ar
  // title normalised to EMPTY and never matched anything — every canon backfill /
  // partial translate re-added roles as duplicates (en+zh trios, 52 roles, 13 pages).
  // Fixes: (1) Unicode-aware cores so same-script duplicates match textually;
  // (2) 至今/היום/עד היום/حتى الآن/إلى الآن/እስከ አሁን count as "present";
  // (3) cross-script pairs (one wide-script title, one Latin) fall back to
  // company+years identity — the babel-fish view: same position, two renderings.
  var _WIDE_RE = /[一-鿿㐀-䶿֐-׿؀-ۿሀ-፿]/;
  function _isWideTitle(t) { return _WIDE_RE.test(String(t == null ? '' : t)); }
  function _titleCore(t) {
    var s = String(t == null ? '' : t).toLowerCase().replace(/\([^)]*\)/g, ' ');
    s = s.split(/\s+[&/]\s+|\s+and\s+/)[0];
    try { return s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
    catch (_) { return s.replace(/[^a-z0-9]+/g, ' ').trim(); }
  }
  // MERGE-COMPONENT-SWALLOW-001 (owner 2026-07-18): the normalised COMPONENTS of an
  // explicit "X & Y" / "X / Y" / "X and Y" merged title. Splits on a SEPARATOR WITH
  // SURROUNDING SPACES only, so "R&D" (no spaces) stays intact while "… & Team Leader"
  // splits. Returns [] for a non-merged (single-part) title. Used to drop a bare
  // component role that a merged role already covers (never both merged + a component).
  function _mergedParts(t) {
    var s = String(t == null ? '' : t).replace(/\([^)]*\)/g, ' ');
    var parts = s.split(/\s+[&/]\s+|\s+and\s+/i);
    if (parts.length < 2) return [];
    var nm = function (x) {
      x = String(x || '').toLowerCase();
      try { return x.replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
      catch (_) { return x.replace(/[^a-z0-9]+/g, ' ').trim(); }
    };
    return parts.map(nm).filter(Boolean);
  }
  function _yrKey(y) {
    var n = (String(y == null ? '' : y).match(/\d{4}/g) || []).map(Number);
    var present = /present|current|nu(?:værende|tid)?|pågår|løbende|ongoing|至今|现在|היום|עד\s*היום|حتى\s*الآن|إلى\s*الآن|እስከ\s*አሁን/i.test(String(y || ''));
    var start = n.length ? Math.min.apply(null, n) : 0;
    var end = present ? 9999 : (n.length ? Math.max.apply(null, n) : start);
    return start + '-' + end;
  }
  // GEN-ID-CANON-MATCH-001 helper: same start year; ends equal, or one side is
  // open-ended (present/nu/至今 → 9999) while the other ends this year or last
  // ("2022 - 2026" vs "2022 - present" is the same tenure written two ways).
  function _yrLoose(ya, yb) {
    var ka = _yrKey(ya).split('-'), kb = _yrKey(yb).split('-');
    if (ka[0] !== kb[0] || ka[0] === '0') return false;
    var ea = +ka[1], eb = +kb[1];
    if (ea === eb) return true;
    var hi = Math.max(ea, eb), lo = Math.min(ea, eb);
    return hi === 9999 && lo >= (new Date().getFullYear() - 1);
  }
  function _samePosition(a, b) {
    if (!a || !b) return false;
    // SAME-ID-SAME-POSITION-001 (owner 2026-07-12 "you kept english and danish
    // versions at once"): roles carry stable canonical ids (kanzen, innoviz-ccr…)
    // from generation/import — the LANGUAGE-agnostic identity. A Danish-titled
    // gen role and its English PI source share the id; title/year text
    // comparison can never see that across Latin↔Latin languages.
    if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;
    // BASE-ID-SAME-POSITION-001 (owner 2026-07-12, 25 visible roles): the
    // completeness backfill re-adds a role under a SUFFIXED id (innoviz-ccr-2,
    // mepro-tl-3) when the stored title is in another LANGUAGE (its compare is
    // translation-blind). The id ROOT is the language-agnostic identity: same
    // root = the same position in two renderings.
    if (a.id != null && b.id != null) {
      var __ba = String(a.id).replace(/-\d+$/, ''), __bb = String(b.id).replace(/-\d+$/, '');
      if (__ba && __ba === __bb) return true;
    }
    // GEN-ID-CANON-MATCH-001: a generation emits schema ids (r1..r10) for the
    // same positions the canon knows by name (kanzen). Same company key (company
    // names are keep-verbatim invariants) + the same tenure (strict start, loose
    // open end) = the same position. Start-year strictness keeps the Innoviz
    // CCR/SA split (different starts, same company) apart.
    var __gA = /^r\d+$/.test(String(a.id || '')), __gB = /^r\d+$/.test(String(b.id || ''));
    if (__gA !== __gB) {
      var __cka = _companyKey(a.company), __ckb = _companyKey(b.company);
      if (__cka && __cka === __ckb && _yrLoose(a.years, b.years)) return true;
    }
    if (_yrKey(a.years) !== _yrKey(b.years)) return false;
    var ra = a.title || a.role, rb = b.title || b.role;
    var ta = _titleCore(ra), tb = _titleCore(rb);
    if (ta && tb && (ta === tb || ta.indexOf(tb + ' ') === 0 || tb.indexOf(ta + ' ') === 0)) return true;
    // BABEL-DEDUP-SCRIPT-001: cross-script pair (translated title vs canon) —
    // same company + same span = the SAME real position in two renderings.
    // BABEL-DEDUP-SCRIPT-002 (owner 2026-07-11 8-page PDF): a TRANSLATED company
    // (特拉维夫大学) strips to an EMPTY Latin key, so the canon twin never
    // matched and stayed/was un-hidden as an extra English role. Cross-script +
    // same span + an unparseable company key on either side counts as the same
    // position (the years gate at the top already matched).
    if (_isWideTitle(ra) !== _isWideTitle(rb)) {
      var ca = _companyKey(a.company), cb = _companyKey(b.company);
      if (ca === cb || !ca || !cb) return true;
    }
    return false;
  }

  // ROLE-CANON-LANG-001 (owner 2026-07-13 "make sure your work fits in the golden
  // gating matrix role control ... I want also danish spanish and chinese canon"):
  // canonical role titles per language live in gold-rules.json `roles.canon_titles`
  // (the ONE control site, GOLD-RULES-SITE-001); this embedded copy is the
  // fetch-failure fallback, mirror-drift-gated by
  // pwa/test/unit/gold-role-canon.test.mjs. The stable role id is the IDENTITY
  // (SAME-ID/BASE-ID/GEN-ID-SAME-POSITION); the title is a per-language
  // RENDERING — deterministic from this table, so LLM title drift
  // ("Videnskabelig assistent" vs "Forskningsassistent") can never fork the
  // same position across languages. Strict JSON between the markers.
  var ROLE_CANON_FALLBACK = /* GOLD-ROLES-MIRROR-BEGIN */ {
    "kanzen": { "en": "Product / Project Expert", "da": "Produkt- og projektekspert", "es": "Experto en Producto y Proyectos", "zh": "产品/项目专家" },
    "innoviz-ccr": { "en": "Change Request Lead", "da": "Ansvarlig for ændringsanmodninger", "es": "Líder de Solicitudes de Cambio", "zh": "变更请求负责人" },
    "innoviz-sa": { "en": "System Architect", "da": "Systemarkitekt", "es": "Arquitecto de Sistemas", "zh": "系统架构师" },
    "sirin": { "en": "Senior Optics & Electro-Optics Engineer", "da": "Senioringeniør i optik og elektrooptik", "es": "Ingeniero Sénior de Óptica y Electroóptica", "zh": "高级光学与电光工程师" },
    "mepro-tl": { "en": "Electro-Optics Team Leader", "da": "Teamleder for elektrooptik", "es": "Líder del Equipo de Electroóptica", "zh": "电光团队负责人" },
    "mepro-eng": { "en": "R&D Electro-Optics Engineer", "da": "Udviklingsingeniør i elektrooptik", "es": "Ingeniero de I+D en Electroóptica", "zh": "电光研发工程师" },
    "tau-security": { "en": "Security Guard, Student Dormitories", "da": "Vagt i studenterboliger", "es": "Guardia de Seguridad, Residencias Estudiantiles", "zh": "学生宿舍保安" },
    "tau-research": { "en": "Research Assistant", "da": "Videnskabelig assistent", "es": "Asistente de Investigación", "zh": "研究助理" },
    "tau-teaching": { "en": "Teaching Assistant", "da": "Undervisningsassistent", "es": "Asistente de Docencia", "zh": "助教" },
    "tau-council": { "en": "Students Council Representative", "da": "Studenterrepræsentant", "es": "Representante del Consejo Estudiantil", "zh": "学生会代表" },
    "idf": { "en": "Computer Systems Administrator", "da": "It-systemadministrator", "es": "Administrador de Sistemas Informáticos", "zh": "计算机系统管理员" },
    "volunteer-wolves": { "en": "Team Operations Manager (foreningsarbejde)", "da": "Team Operations Manager (foreningsarbejde)", "es": "Gerente de Operaciones del Equipo (voluntariado)", "zh": "球队运营经理（协会志愿工作）" },
    "earlier-career": { "en": "Earlier career", "da": "Tidligere karriere", "es": "Trayectoria inicial", "zh": "早期职业" }
  } /* GOLD-ROLES-MIRROR-END */;
  var __roleCanon = ROLE_CANON_FALLBACK;
  try {
    fetch('gold-rules.json?v=' + VERSION, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.roles && j.roles.canon_titles) __roleCanon = j.roles.canon_titles; })
      .catch(function () {});
  } catch (_) {}
  function __roleCanonTitle(id, L) {
    var e = __roleCanon[String(id == null ? '' : id).replace(/-\d+$/, '')];
    if (!e) return null;
    return e[L] || e.en || null;
  }
  function roleCanonTitles(cv) {
    var L = 'en';
    try { L = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); } catch (_) {}
    if (L !== 'en' && L !== 'da' && L !== 'es' && L !== 'zh') return null; // he/am/ar: keep the translate output
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    var changed = false;
    var roles = cv[xi].roles.map(function (r) {
      if (!r || r.id == null) return r;
      var e = __roleCanon[String(r.id).replace(/-\d+$/, '')];
      if (!e) return r;
      var want = e[L];
      if (!want || r.title === want) return r;
      // A merged title with MORE "&"-segments than the canon is a deliberate
      // merge-or-split structure (gen prompt rule) — never overwrite it.
      var segs = function (t) { return String(t == null ? '' : t).split(' & ').length; };
      if (segs(r.title) > segs(e.en)) return r;
      changed = true;
      return Object.assign({}, r, { title: want });
    });
    if (!changed) return null;
    var copy = cv.slice();
    copy[xi] = Object.assign({}, copy[xi], { roles: roles });
    return copy;
  }

  // MERGED-TITLE-ORDER-001 (owner, repeatedly: "Electro-Optics Team Leader &
  // R&D Electro-Optics Engineer" must read "Electro-Optics Engineer & Team
  // Leader"). The merge rule is CORE (IC) function FIRST, the management
  // descriptor second, with a repeated domain phrase collapsed. The gen prompt
  // says this but the LLM leaks the wrong order, and roleCanonTitles SKIPS
  // merged titles (more &-segments than the single canon), so nothing enforced
  // it. Deterministic reorder here — runs on every experience title.
  var _MGMT_RE = /\b(team\s+lead(?:er)?|lead(?:er)?|manager|head|chief|director|coordinator|supervisor)\b/i;
  var _IC_RE = /\b(engineer|architect|scientist|developer|specialist|analyst|designer|researcher|consultant|expert|administrator|assistant|representative|guard)\b/i;
  function _reorderTitle(t) {
    var s = String(t == null ? '' : t);
    if (s.indexOf(' & ') < 0) return t;
    var segs = s.split(' & ').map(function (x) { return x.trim(); }).filter(Boolean);
    if (segs.length < 2) return t;
    var firstIc = -1, firstMg = -1, i;
    for (i = 0; i < segs.length; i++) {
      if (firstIc < 0 && _IC_RE.test(segs[i])) firstIc = i;
      if (firstMg < 0 && _MGMT_RE.test(segs[i])) firstMg = i;
    }
    if (firstIc < 0 || firstMg < 0 || firstIc < firstMg) return t; // absent or already IC-first
    var ic = [], mg = [], other = [];
    segs.forEach(function (seg) {
      if (_IC_RE.test(seg)) ic.push(seg);
      else if (_MGMT_RE.test(seg)) mg.push(seg);
      else other.push(seg);
    });
    var ordered = ic.concat(other, mg);
    // word-level dedup: drop, from each following segment, words already in the
    // lead (the shared domain), but always keep the role-kind keyword.
    var inLead = {};
    ordered[0].toLowerCase().split(/\s+/).forEach(function (w) { inLead[w] = 1; });
    for (i = 1; i < ordered.length; i++) {
      var kept = ordered[i].split(/\s+/).filter(function (w) {
        return !inLead[w.toLowerCase()] || _MGMT_RE.test(w) || _IC_RE.test(w);
      });
      if (kept.length) ordered[i] = kept.join(' ');
    }
    return ordered.join(' & ');
  }
  function reorderMergedTitles(cv) {
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    var changed = false;
    var roles = cv[xi].roles.map(function (r) {
      if (!r || r.title == null) return r;
      var nt = _reorderTitle(r.title);
      if (nt !== r.title) { changed = true; return Object.assign({}, r, { title: nt }); }
      return r;
    });
    if (!changed) return null;
    var copy = cv.slice();
    copy[xi] = Object.assign({}, copy[xi], { roles: roles });
    return copy;
  }

  // BABEL-RICHBLOCK-RESIDUE-001: see the call site in the pipeline. Wide ribbon
  // only; drops pure-Latin lead-in rows (Foundation/Hands-on/Professionally)
  // from a rich_block that already carries a wide-script item.
  // BABEL-RICHBLOCK-RESIDUE-CONVERGE-001 (2026-07-21): the drop is RE-ENABLED. It was
  // disabled on 2026-07-11 because it entered a write war with legacy re-adders
  // (foundation-758 pre-345 caches, shape-guard eager writes, languageCache echoes) —
  // "preview jumpy / edit closes", one cycle every ~5s. Rather than complete the
  // re-adder inventory (open-ended, and a NEW re-adder would reopen it), the drop now
  // carries the same STICKY, remover-agnostic decision that converged the roles storm:
  // drop a given residue set ONCE per (document x ribbon language x the content that
  // SURVIVES the drop). If the identical residue is back while everything else is
  // byte-identical, a re-adder owns those rows — hold, log once, and let the wide-script
  // twin stand alongside it rather than flicker the editor. The write-side per-section
  // guard is the second net. A real edit / translate pass changes the surviving content
  // and re-arms the drop; a page reload re-arms it too.
  var __rbrDone = { key: '', sigs: {} };
  function dropRichBlockLatinResidue(list, docTag) {
    var wideRibbon = false;
    var L = 'en';
    try { L = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); wideRibbon = L === 'zh' || L === 'he' || L === 'am' || L === 'ar'; } catch (_) {}
    if (!wideRibbon) return null;
    var LEAD_RE = /^(foundation|hands-?on|professionally)\s*:?\s*$/i;
    var changed = false;
    var dropped = [];
    var out = list.map(function (s, si) {
      if (!s || s.type !== 'rich_block' || !Array.isArray(s.items) || s.items.length < 2) return s;
      var hasWide = s.items.some(function (it) { return it && _WIDE_RE.test(String(it.b || '') + String(it.t || '')); });
      if (!hasWide) return s;
      var kept = s.items.filter(function (it) {
        if (!it) return false;
        var b = String(it.b || ''), t = String(it.t || '');
        var latinOnly = !_WIDE_RE.test(b + t);
        if (latinOnly && LEAD_RE.test(b.trim())) {
          changed = true;
          dropped.push(__secKey(s, si) + '|' + b.trim().toLowerCase() + '|' + t.slice(0, 40));
          return false;
        }
        return true;
      });
      return kept.length !== s.items.length ? Object.assign({}, s, { items: kept }) : s;
    });
    if (!changed) return null;
    // STICKY decision — see the note above. The key is what SURVIVES (JSON.stringify(out)),
    // so the add/drop churn itself cannot move it, while any genuine content change does.
    var __doc = '';
    try { var __m = JSON.parse(localStorage.getItem('meta') || '{}') || {}; __doc = String(__m.company || '') + '|' + String(__m.role || ''); } catch (_) {}
    var __key = String(docTag || '') + '||' + __doc + '||' + L + '||' + JSON.stringify(out);
    var __sig = dropped.join('~');
    if (__rbrDone.key !== __key) __rbrDone = { key: __key, sigs: {} };   // real change -> re-arm
    if (__rbrDone.sigs[__sig]) {
      if (__rbrDone.sigs[__sig] === 1) {
        __rbrDone.sigs[__sig] = 2;         // log once, not once per cycle
        try { console.warn('[415] rich_block Latin-residue drop HELD (BABEL-RICHBLOCK-RESIDUE-CONVERGE-001) — the ' + dropped.length + ' row(s) it dropped were re-added while the rest of the block was unchanged, so a legacy re-adder owns them; leaving the residue in place rather than flickering the editor.'); } catch (_) {}
      }
      return null;
    }
    __rbrDone.sigs[__sig] = 1;
    try { console.log('[415] dropped ' + dropped.length + ' Latin lead-in residue row(s) from a wide-script rich_block'); } catch (_) {}
    return out;
  }

  // ROLE-DECOMP-001 (owner 2026-06-16): "decompose the merged roles ... merging is
  // later". The old ROLE-DUP-001 merged on title CONTAINMENT (folded "System
  // Architect" into "System Architect & Change Control Lead"). The owner now wants
  // DISTINCT functions kept as SEPARATE positions, so this merges ONLY when the two
  // titles are IDENTICAL after normalisation — i.e. a genuine append-duplicate
  // (e.g. the consensus re-appending the same Kanzen role), never two distinct
  // functions at the same company. Containment-but-not-equal is left UN-merged.
  // COMPANY-VARIANT-KEY-001: company match now uses _companyKey (variant-tolerant) so an
  // IDENTICAL-title role whose company is a canon rewrite (IDF vs Israel Defense Forces) collapses
  // when BOTH are visible; keep the RICHER bullet set as the survivor.
  function dedupeRoles(cv) {
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    // BABEL-DEDUP-SCRIPT-001: Unicode-aware like _titleCore — a zh/he/ar title used
    // to norm to EMPTY here, so same-script exact duplicates (产品 / 项目专家 ×3)
    // never collapsed.
    var norm = function (s) {
      s = String(s || '').toLowerCase();
      try { return s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
      catch (_) { return s.replace(/[^a-z0-9]+/g, ' ').trim(); }
    };
    var yearsOf = function (s) { return (String(s || '').match(/\d{4}/g) || []).map(Number); };
    var overlap = function (a, b) {
      var ya = yearsOf(a), yb = yearsOf(b);
      if (!ya.length || !yb.length) return true;
      return Math.min.apply(null, ya) <= Math.max.apply(null, yb) && Math.min.apply(null, yb) <= Math.max.apply(null, ya);
    };
    var nbul = function (r) { return Array.isArray(r && r.bullets) ? r.bullets.length : 0; };
    var roles = cv[xi].roles.slice();
    var drop = {};
    for (var i = 0; i < roles.length; i++) for (var j = 0; j < roles.length; j++) {
      if (i === j || drop[i] || drop[j]) continue;
      var a = roles[i], b = roles[j];
      if (!a || !b) continue;
      var ta = norm(a.title), tb = norm(b.title);
      var crossScript = _isWideTitle(a.title) !== _isWideTitle(b.title);
      if (crossScript) {
        // BABEL-DEDUP-SCRIPT-001: a translated title vs its canon (产品 / 项目专家 vs
        // Product / Project Expert) is the SAME position in two renderings — the
        // exact-title rule can never see it. Collapse via _samePosition (years +
        // company identity). Survivor = the RIBBON-language rendering: when the
        // ribbon is a wide-script language keep the wide-script title, else the
        // Latin one. (i is dropped below, so arrange a=dropped, b=survivor.)
        if (!_samePosition(a, b)) continue;
        var wantWide = (function () { try { var L = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); return L === 'zh' || L === 'he' || L === 'am' || L === 'ar'; } catch (_) { return false; } })();
        if (_isWideTitle(b.title) !== wantWide) continue; // only drop i when j is the wanted rendering
      } else {
        // BASE-ID-DEDUP-001 + GEN-ID-CANON-MATCH-001 (owner 2026-07-12, 25 VISIBLE
        // roles): same-Latin cross-LANGUAGE twins (da title vs en title) never hit
        // the exact-title rule. Same id root (innoviz-ccr vs innoviz-ccr-2), or a
        // gen schema id (r1) vs the canonical id at the same company/tenure, is
        // the same position. Survivor = richer bullets; tie → the canonical
        // (suffixless, non-schema) id. Bullets are NOT moved across (they may be
        // in another language; the id-resolved translate pass heals the survivor).
        var __idA = String(a.id == null ? '' : a.id), __idB = String(b.id == null ? '' : b.id);
        var __sameRoot = __idA && __idB && __idA !== __idB && __idA.replace(/-\d+$/, '') === __idB.replace(/-\d+$/, '');
        var __genPair = /^r\d+$/.test(__idA) !== /^r\d+$/.test(__idB) &&
          _companyKey(a.company) && _companyKey(a.company) === _companyKey(b.company) &&
          _yrLoose(a.years, b.years);
        if (__genPair) {
          // Survivor must be the CANONICAL id — the Results pin machinery keys
          // on it (id:kanzen). Adopt the gen twin's fresh title + bullets: they
          // are the tailored rendering; the identity (id, canonical years) stays.
          if (/^r\d+$/.test(__idB)) continue;
          if (nbul(a) > 0) { b.title = a.title || b.title; b.bullets = a.bullets; }
        } else if (__sameRoot) {
          var __synthA = /-\d+$/.test(__idA);
          var __synthB = /-\d+$/.test(__idB);
          if (nbul(b) < nbul(a)) continue;                       // survivor must not be poorer
          if (nbul(b) === nbul(a) && __synthB && !__synthA) continue; // tie: keep the suffixless id
        } else {
          if (!ta || !tb || ta !== tb) continue; // ROLE-DECOMP-001: exact-title dup only (was containment)
          if (_companyKey(a.company) !== _companyKey(b.company)) continue; // COMPANY-VARIANT-KEY-001
          if (!overlap(a.years, b.years)) continue;
        }
      }
      drop[i] = true;
      if (a.on !== false) b.on = true;
      // keep the richer content: if the dropped role carried MORE bullets, move them to the
      // survivor — but NEVER move cross-script bullets onto a ribbon-language survivor
      // (that would re-inject the other language's content).
      if (!crossScript && nbul(a) > nbul(b)) b.bullets = a.bullets;
    }
    var keys = Object.keys(drop);
    if (!keys.length) return null;
    var kept = roles.filter(function (_, i) { return !drop[i]; });
    var copy = cv.slice();
    copy[xi] = Object.assign({}, copy[xi], { roles: kept });
    return copy;
  }

  // MERGE-COMPONENT-SWALLOW-001 (owner 2026-07-18, "I see both 'System Architect &
  // Change Request Lead' and 'System Architect'"): the kernel stores ATOMIC roles and
  // MERGING is the app's job at generation; the rule is NEVER both a merged role AND
  // one of its atomic components (gabriel-cv-facts). dedupeRoles is exact-title-only
  // (ROLE-DECOMP-001 dropped containment because it over-merged), so it deliberately
  // will not collapse a merged "X & Y" against a bare "X" or "Y". This pass enforces
  // the rule PRECISELY: when a role's title is an explicit "X & Y" merge and ANOTHER
  // role's exact title equals X or Y (same company, overlapping years), the bare
  // COMPONENT is dropped and the merged role kept. It fires only on an explicit merge
  // (not generic containment), so "Product Manager" never swallows "Project Manager".
  // Covers the three the owner reported: "System Architect & Change Request Lead" ⊃
  // "System Architect"; "Research Assistant & Teaching Assistant" ⊃ "Teaching
  // Assistant" (2nd component — the reason _titleCore's first-part-only match missed
  // it); "R&D Electro-Optics Engineer & Team Leader" ⊃ "R&D Electro-Optics Engineer".
  function swallowMergedComponents(cv) {
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    var nm = function (s) {
      s = String(s || '').toLowerCase();
      try { return s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
      catch (_) { return s.replace(/[^a-z0-9]+/g, ' ').trim(); }
    };
    var yearsOf = function (s) { return (String(s || '').match(/\d{4}/g) || []).map(Number); };
    var overlap = function (a, b) {
      var ya = yearsOf(a), yb = yearsOf(b);
      if (!ya.length || !yb.length) return true;
      return Math.min.apply(null, ya) <= Math.max.apply(null, yb) && Math.min.apply(null, yb) <= Math.max.apply(null, ya);
    };
    var nbul = function (r) { return Array.isArray(r && r.bullets) ? r.bullets.length : 0; };
    var roles = cv[xi].roles.slice();
    var drop = {};
    for (var i = 0; i < roles.length; i++) {
      var m = roles[i]; if (!m || drop[i]) continue;
      var parts = _mergedParts(m.title || m.role); if (parts.length < 2) continue;
      for (var j = 0; j < roles.length; j++) {
        if (i === j || drop[j]) continue;
        // ROLES-STORM-CONVERGE-002 (owner 2026-07-22): NEVER drop an already-HIDDEN
        // component. The merge invariant is only "no merged role beside a VISIBLE
        // component" — a hidden (on:false) constituent already satisfies it. Dropping
        // hidden constituents was the sole perturbation that made repairExperienceCompleteness
        // see them as "missing" every pass and re-add them → the endless delete/restore storm.
        var c = roles[j]; if (!c || c.on === false) continue;
        if (_mergedParts(c.title || c.role).length >= 2) continue; // never swallow another merged role
        var ct = nm(c.title || c.role); if (!ct) continue;
        if (parts.indexOf(ct) < 0) continue;                       // exact component match only
        if (_companyKey(m.company) !== _companyKey(c.company)) continue;
        if (!overlap(m.years, c.years)) continue;
        drop[j] = true;
        if (c.on !== false) m.on = true;              // component was visible → keep the merged visible
        if (!nbul(m) && nbul(c)) m.bullets = c.bullets; // never lose content if the merged had none
      }
    }
    var keys = Object.keys(drop); if (!keys.length) return null;
    var kept = roles.filter(function (_, i) { return !drop[i]; });
    var copy = cv.slice();
    copy[xi] = Object.assign({}, copy[xi], { roles: kept });
    return copy;
  }

  // KANZEN-CANON-001 (owner 2026-06-15): the consensus/generation stage keeps
  // reintroducing "Kanzen konsulenter i nord ApS" / "...i nord" ending 2025.
  // Gabriel's canonical company is "Kanzen Konsulenter ApS" (NO "i nord") and it
  // runs to 2026. Normalising the company string ALSO lets dedupeRoles collapse
  // the duplicate Kanzen role the consensus appends (it only merges roles with
  // the SAME company). Scoped to Kanzen rows only.
  function canonKanzen(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var secChanged = false;
      var roles = s.roles.map(function (r) {
        if (!r || !/kanzen/i.test(String(r.company || ''))) return r;
        var company = 'Kanzen Konsulenter ApS';
        var years = typeof r.years === 'string'
          ? r.years.replace(/(\d{4})\s*[-–—]\s*2025\b/, '$1 - 2026')
          : r.years;
        if (company !== r.company || years !== r.years) {
          secChanged = true; changed = true;
          return Object.assign({}, r, { company: company, years: years });
        }
        return r;
      });
      return secChanged ? Object.assign({}, s, { roles: roles }) : s;
    });
    return changed ? out : null;
  }

  // CW-CANON-001 (owner 2026-06-16): the volunteer rugby role appears as duplicate
  // variants — "Team Operations Manager & Assistant Coach (foreningsarbejde)" and
  // "… (Volunteer)" — the SAME job. Merge to ONE, canonicalise the (compressed)
  // title + company "Pan Idræt", and keep "Copenhagen Wolves RFC" in the CONTENT
  // (a bullet), not the company line.
  // CW-CANON-002 (owner 2026-06-19): (a) company is "Pan Idræt", NOT "Pan Idræt
  // Rugby"; (b) the assistant-coach role does NOT belong in the role HEADLINE — drop
  // "& Assi. Coach" from the title (kept as the CW bullet's "assistant-coaching"),
  // so the title is just "Team Operations Manager (foreningsarbejde)".
  function canonCopenhagenWolves(cv) {
    var xi = cv.findIndex(function (s) { return s && s.type === 'experience' && Array.isArray(s.roles); });
    if (xi < 0) return null;
    var isCW = function (r) { var s = (((r && r.company) || '') + ' ' + ((r && r.title) || '')); return /copenhagen wolves|foreningsarbejde|pan idr|wolves rfc/i.test(s); };
    var roles = cv[xi].roles;
    var cwIdx = []; roles.forEach(function (r, i) { if (isCW(r)) cwIdx.push(i); });
    if (!cwIdx.length) return null;
    // CW-CANON-LANG-001 (owner 2026-07-11 "this should be translated fully"): the
    // canonical title was forced back to ENGLISH on every pass, reverting the
    // translated 球队运营经理（协会志愿工作）. On a zh ribbon the canon target IS the
    // zh form; other wide ribbons keep whatever the translate produced (no forcing).
    var __cwL = 'en';
    try { __cwL = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); } catch (_) {}
    // ROLE-CANON-LANG-001: the CW canonical title now comes from the gold-rules
    // roles.canon_titles table (en/da/es/zh; unknown Latin languages fall back
    // to the en canon, matching the old behavior); he/am/ar keep the translate
    // output (null = leave the rendered title alone).
    var TITLE = (__cwL === 'he' || __cwL === 'am' || __cwL === 'ar') ? null
      : (__roleCanonTitle('volunteer-wolves', __cwL) || 'Team Operations Manager (foreningsarbejde)');
    var COMPANY = 'Pan Idræt';
    var CW_BULLET = 'Operations and assistant-coaching for Copenhagen Wolves RFC, an inclusive amateur rugby club under Pan Idræt.';
    var keep = cwIdx[0];
    var base = Object.assign({}, roles[keep]);
    var bullets = Array.isArray(base.bullets) ? base.bullets.slice() : [];
    for (var k = 1; k < cwIdx.length; k++) { (Array.isArray(roles[cwIdx[k]].bullets) ? roles[cwIdx[k]].bullets : []).forEach(function (b) { if (bullets.indexOf(b) < 0) bullets.push(b); }); }
    if (!bullets.some(function (b) { return /copenhagen wolves rfc/i.test(String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '')); })) bullets.unshift(CW_BULLET);
    var changed = false;
    if (TITLE && base.title !== TITLE) { base.title = TITLE; changed = true; } // CW-CANON-LANG-001: null TITLE = leave the rendered title alone
    if (base.company !== COMPANY) { base.company = COMPANY; changed = true; }
    if (cwIdx.length > 1 || (Array.isArray(roles[keep].bullets) ? roles[keep].bullets.length : 0) !== bullets.length) { base.bullets = bullets; changed = true; }
    if (!changed) return null;
    var nextRoles = roles.map(function (r, i) { return i === keep ? base : r; });
    if (cwIdx.length > 1) { var drop = {}; for (var k2 = 1; k2 < cwIdx.length; k2++) drop[cwIdx[k2]] = true; nextRoles = nextRoles.filter(function (_, i) { return !drop[i]; }); }
    var copy = cv.slice(); copy[xi] = Object.assign({}, copy[xi], { roles: nextRoles });
    return copy;
  }

  // FINAL-ROLE-CONDENSE-FOLD-001 (1.50.924, owner 2026-06-26 live probe): folded in from the retired
  // antcv-final-role-condense.js, which STORMED against canonCopenhagenWolves above — the standalone
  // sidecar capped the volunteer role's bullets while canon re-added CW_BULLET, each dispatching
  // sections-updated and re-triggering the other (6 writes each / 5s, flipping the paginator). Running
  // the cap HERE, AFTER canon, inside 415's single idempotent pass kills the fight: canon merges +
  // ensures CW_BULLET, THEN the cap trims to <=3, and the result is a fixpoint (the guard then stays
  // silent). (1) volunteer/foreningsarbejde role <=3 bullets (4 if a merged title); (2) regulatory
  // heading "Environmental, Durability & Materials Compliance" -> "…& Compliance".
  var VOL_RE = /foreningsarbejde|pan\s*idr|copenhagen\s*wolves/i;
  var VOL_MERGED_RE = / & | and /i;
  function condenseVolunteerRoles(cv) {
    var changed = false;
    cv.forEach(function (sec) {
      if (!sec || !(sec.type === 'experience' || /experience/i.test(sec.title || '')) || !Array.isArray(sec.roles)) return;
      sec.roles.forEach(function (r) {
        if (!r || !Array.isArray(r.bullets)) return;
        if (!(VOL_RE.test(String(r.title || '')) || VOL_RE.test(String(r.company || '')))) return;
        var cap = VOL_MERGED_RE.test(String(r.title || '')) ? 4 : 3;
        if (r.bullets.length > cap) { r.bullets = r.bullets.slice(0, cap); changed = true; }
      });
    });
    return changed ? cv : null;
  }
  var REG_HEAD_RX = /Environmental,\s*Durability\s*&\s*Materials\s*Compliance/i;
  function shortenRegulatoryHeading(cv) {
    var changed = false;
    cv.forEach(function (sec) {
      if (!sec || !Array.isArray(sec.items)) return;
      sec.items.forEach(function (it) {
        if (!it || typeof it !== 'object') return;
        if (it.t != null && REG_HEAD_RX.test(String(it.t))) { it.t = String(it.t).replace(REG_HEAD_RX, 'Environmental, Durability & Compliance'); changed = true; }
        else if (it.group != null && REG_HEAD_RX.test(String(it.group))) { it.group = String(it.group).replace(REG_HEAD_RX, 'Environmental, Durability & Compliance'); changed = true; }
      });
    });
    return changed ? cv : null;
  }

  // IDF-ABBREV-001 (owner 2026-06-19): "in many cases show IDF instead of Israeli
  // defence force — less space". Replace the long form "Israel(i) Defen[sc]e
  // Force(s)" with "IDF" in role companies AND bullet text (e.g. the Computer
  // Systems Administrator company "Israel Defense Forces, Communication Corps" →
  // "IDF, Communication Corps"). Idempotent: "IDF" no longer matches the long-form
  // regex, so it never re-fires.
  var IDF_RX = /\bisraeli?\s+defen[sc]e\s+forces?\b/gi;
  function canonIDF(cv) {
    var changed = false;
    var fixStr = function (s) { var x = String(s == null ? '' : s); return IDF_RX.test(x) ? x.replace(IDF_RX, 'IDF') : x; };
    var fixBullet = function (b) {
      if (typeof b === 'string') { var n = fixStr(b); if (n !== b) { changed = true; return n; } return b; }
      if (b && typeof b === 'object') {
        var o = b, bb = b.b != null ? fixStr(b.b) : b.b, tt = b.t != null ? fixStr(b.t) : b.t;
        if (bb !== b.b || tt !== b.t) { changed = true; o = Object.assign({}, b); if (b.b != null) o.b = bb; if (b.t != null) o.t = tt; }
        return o;
      }
      return b;
    };
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var roles = s.roles.map(function (r) {
        if (!r) return r;
        var company = fixStr(r.company);
        var bullets = Array.isArray(r.bullets) ? r.bullets.map(fixBullet) : r.bullets;
        if (company !== r.company || bullets !== r.bullets) {
          var nr = Object.assign({}, r);
          if (company !== r.company) { nr.company = company; changed = true; }
          if (bullets !== r.bullets) nr.bullets = bullets;
          return nr;
        }
        return r;
      });
      return Object.assign({}, s, { roles: roles });
    });
    return changed ? out : null;
  }

  // TAU-UNIFY-001 (owner 2026-06-19): "8,7 … it is also Tel Aviv University –
  // Electrical Engineering, so you could just call all of those Tel Aviv
  // University". Collapse every Tel-Aviv-University company variant (with or without
  // a "– Electrical Engineering" / department suffix) to the single canonical
  // "Tel Aviv University". The TAU roles have distinct titles, so dedupeRoles
  // (exact-title-only) never merges them. Idempotent.
  var TAU_RX = /tel[\s-]?aviv\s+university/i;
  function canonTAU(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var roles = s.roles.map(function (r) {
        if (!r || !TAU_RX.test(String(r.company || ''))) return r;
        if (r.company === 'Tel Aviv University') return r;
        changed = true;
        return Object.assign({}, r, { company: 'Tel Aviv University' });
      });
      return changed ? Object.assign({}, s, { roles: roles }) : s;
    });
    return changed ? out : null;
  }

  // ROLE-ORDER-CANON-001 (owner 2026-06-19): "make canonical ordering of roles …
  // reverse chronological apart from foreningsarbejde that goes to the end (and has to
  // be reverse-chron between themselves)". So: sort all professional roles
  // reverse-chronologically (most-recent END year first; tie → later START first; tie
  // → original order), then append the foreningsarbejde (volunteer) roles, themselves
  // reverse-chron. The early-career-compression branch (drop foreningsarbejde + unhide
  // the ops-management interests line) belongs to the DEFERRED merge/page-budget work.
  // Idempotent: returns null when the roles are already in canonical order.
  function _roleYears(s) {
    var x = String(s == null ? '' : s).toLowerCase();
    var present = /present|current|nu(?:værende|tid)?|today|pågår|løbende|ongoing/.test(x);
    var nums = (x.match(/\d{4}/g) || []).map(Number);
    var start = nums.length ? nums[0] : 0;
    var end = present ? 9999 : (nums.length ? nums[nums.length - 1] : start);
    return { start: start, end: end };
  }
  function _isForeningsarbejde(r) {
    var s = (((r && r.title) || '') + ' ' + ((r && r.company) || ''));
    return /foreningsarbejde|pan idr|students?\s+council|volunteer|frivillig/i.test(s);
  }
  function canonicalRoleOrder(cv) {
    var xi = cv.findIndex(function (s) { return s && s.type === 'experience' && Array.isArray(s.roles); });
    if (xi < 0) return null;
    var roles = cv[xi].roles;
    if (roles.length < 2) return null;
    var idx = roles.map(function (_, i) { return i; });
    var cmp = function (a, b) {
      var ya = _roleYears(roles[a].years), yb = _roleYears(roles[b].years);
      if (yb.end !== ya.end) return yb.end - ya.end;     // most-recent end first
      if (yb.start !== ya.start) return yb.start - ya.start; // then later start first
      return a - b;                                       // stable
    };
    var prof = idx.filter(function (i) { return !_isForeningsarbejde(roles[i]); }).sort(cmp);
    var vol = idx.filter(function (i) { return _isForeningsarbejde(roles[i]); }).sort(cmp);
    var order = prof.concat(vol);
    if (order.every(function (v, k) { return v === k; })) return null; // already canonical
    var next = order.map(function (i) { return roles[i]; });
    var copy = cv.slice(); copy[xi] = Object.assign({}, copy[xi], { roles: next });
    return copy;
  }

  // BULLET-ORDER-CANON-001 (owner 2026-06-19): "make canonical ordering of … bullets …
  // you keep the numeric higher". Within each role, stable-sort bullets so the
  // quantified ones lead: a strong metric (range "X to Y" / "X→Y", "N×"/"N-fold",
  // a percent, or "M of N") scores highest, a bare number next, prose last; ties keep
  // their original relative order. A compliance/standard CODE (ISO 26262, ASPICE, …)
  // is NOT a metric, so it does not get promoted. Idempotent: returns null when each
  // role's bullets are already in canonical order.
  var _STD_CODE_RX = /\b(?:ISO|IEC|EN|DIN|MIL[-\s]?STD|STANAG|ASPICE|SAE)(?:\s*\/\s*(?:ISO|IEC|SAE|EN))*[\s\/-]*[A-Z]?\d[\d.\-:]*[A-Z]?\b/gi;
  function _bulletMetric(b) {
    var t = String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '').replace(_STD_CODE_RX, ' ');
    if (/\d[\d,.]*\s*(?:[a-z%]+\s+){0,2}(?:to|->|→|–|—)\s+(?:[a-z]+\s+){0,2}\d/i.test(t)) return 4; // range
    if (/\d[\d,.]*\s*(?:×|x\b|-fold|fold)/i.test(t)) return 4;                                       // multiplier
    if (/\d[\d.]*\s*%/.test(t)) return 3;                                                             // percent
    if (/\d[\d,.]*\s*(?:of|out of|\/)\s*\d/i.test(t)) return 3;                                       // M of N
    if (/\d/.test(t)) return 2;                                                                       // bare number
    return 0;
  }
  // CLUSTER-QUAL-001 (owner 2026-06-19): rank bullets by a BLENDED score, not numeric
  // alone — "numeric + skill-relevant = higher score". A line that is BOTH quantified
  // and hits a demanded skill ranks top; a strongly-demanded non-numeric line can
  // outrank a trivially-numeric one. numNorm = metric tier / 4 (range/×→1.0, %/MofN→
  // 0.75, bare number→0.5, prose→0); demNorm = scoreNorm from the 20-most-demanded
  // model (antcv-cluster-demand.js, already normalized ~[0,1] per active-cluster
  // count). score = numNorm + demNorm (0..2), ties keep original order. Read-only +
  // guarded: demNorm is 0 when the model is absent, so it degrades to pure numeric.
  function _demandNorm(b) {
    try {
      var d = window.AntcvClusterDemand;
      if (!d || typeof d.scoreNorm !== 'function') return 0;
      return d.scoreNorm(String(typeof b === 'string' ? b : (b && (b.b || b.t)) || ''));
    } catch (_) { return 0; }
  }
  function _bulletScore(b) {
    return (_bulletMetric(b) / 4) + _demandNorm(b);
  }
  function canonicalBulletOrder(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var roles = s.roles.map(function (r) {
        if (!r || !Array.isArray(r.bullets) || r.bullets.length < 2) return r;
        var dec = r.bullets.map(function (b, i) { return { b: b, i: i, s: _bulletScore(b) }; });
        var sorted = dec.slice().sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); });
        if (sorted.every(function (d, k) { return d.i === dec[k].i; })) return r; // already canonical
        changed = true;
        return Object.assign({}, r, { bullets: sorted.map(function (d) { return d.b; }) });
      });
      return changed ? Object.assign({}, s, { roles: roles }) : s;
    });
    return changed ? out : null;
  }

  // PATENT-IN-ROLE-001 (owner 2026-06-15): the patent number must live ONLY in
  // PUBLICATIONS & PATENT, never inside a role's bullets. The generator keeps
  // putting "Co-invented Patent No. 241997 …" in the Sirin role. Drop any role
  // bullet that carries a patent NUMBER (publications already keeps it).
  function stripPatentFromRoles(cv) {
    var rx = /\bpatent\s*(?:no\.?|nr\.?|number)?\s*[:#]?\s*\d/i;
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var secChanged = false;
      var roles = s.roles.map(function (r) {
        if (!r || !Array.isArray(r.bullets)) return r;
        var kept = r.bullets.filter(function (b) {
          var t = typeof b === 'string' ? b : (b && (b.t || b.b)) || '';
          return !rx.test(String(t));
        });
        if (kept.length !== r.bullets.length) { secChanged = true; changed = true; return Object.assign({}, r, { bullets: kept }); }
        return r;
      });
      return secChanged ? Object.assign({}, s, { roles: roles }) : s;
    });
    return changed ? out : null;
  }

  // FOUNDED-ESTABLISHED-001 (owner 2026-06-15): the owner prefers "Established"
  // over the Founder-family word "Founded" at the start of a role bullet (the
  // Kanzen consultancy bullet kept coming back as "Founded a consultancy …").
  function foundedToEstablished(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var roles = s.roles.map(function (r) {
        if (!r || !Array.isArray(r.bullets)) return r;
        var roleChanged = false;
        var bl = r.bullets.map(function (b) {
          if (typeof b === 'string' && /^\s*founded\b/i.test(b)) {
            roleChanged = true; changed = true;
            return b.replace(/^(\s*)founded\b/i, '$1Established');
          }
          return b;
        });
        return roleChanged ? Object.assign({}, r, { bullets: bl }) : r;
      });
      return changed && roles.some(function (r, i) { return r !== s.roles[i]; })
        ? Object.assign({}, s, { roles: roles }) : s;
    });
    return changed ? out : null;
  }

  // CUST-CHANGE-DUP-001 (owner 2026-06-15): the consensus appends a duplicate
  // "Customer Change Requests Specialist" role overlapping the merged
  // "… Change Control Lead" role at the same company. dedupeRoles can't catch it
  // (neither title contains the other). Drop the duplicate when a Change-Control
  // role exists — its content is already covered there.
  function dropCustomerChangeDup(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var hasChangeControl = s.roles.some(function (r) {
        return r && /change\s*control/i.test(String(r.title || ''));
      });
      if (!hasChangeControl) return s;
      var kept = s.roles.filter(function (r) {
        var t = String((r && r.title) || '');
        var isDup = /(customer\s*change|change\s*requests?)/i.test(t) && !/change\s*control/i.test(t);
        return !isDup;
      });
      if (kept.length !== s.roles.length) { changed = true; return Object.assign({}, s, { roles: kept }); }
      return s;
    });
    return changed ? out : null;
  }

  // ROLE-FOUNDER-001 band fix (owner 2026-06-14): the candidate band renders the
  // STORED meta.role / meta.subtitle ("Application: Founder & Product / Project
  // Expert - Unsolicited"), which the export strip never touches and the JSON
  // import never clears. Clean Founder/Co-Founder out of the stored meta here so
  // every render path (preview, HTML export, worker) shows the clean line. A
  // genuine independent-consultancy label is left intact.
  function cleanFounderStr(s) {
    var x = String(s || '');
    if (!/\bfounder\b/i.test(x)) return x;
    if (/\b(konsulent|consult|independent)\b/i.test(x)) return x;
    return x
      .replace(/\b(co[-\s]?)?founder\b\s*[&/,|]\s*/gi, '')
      .replace(/\s*[&/,|]\s*(co[-\s]?)?founder\b/gi, '')
      .replace(/\b(co[-\s]?)?founder\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/:\s*-\s*/, ': ')
      .trim();
  }
  function normalizeMeta() {
    try {
      var raw = localStorage.getItem('meta');
      if (!raw) return;
      var m = JSON.parse(raw);
      if (!m || typeof m !== 'object') return;
      var changed = false;
      ['role', 'subtitle', 'company'].forEach(function (k) {
        if (typeof m[k] === 'string' && /\bfounder\b/i.test(m[k])) {
          var c = cleanFounderStr(m[k]);
          if (c !== m[k]) { m[k] = c; changed = true; }
        }
      });
      if (!changed) return;
      localStorage.setItem('meta', JSON.stringify(m));
      try { window.dispatchEvent(new StorageEvent('storage', { key: 'meta', newValue: localStorage.getItem('meta') })); } catch (_) {}
      try { console.log('[sections-normalize-415] stripped Founder from stored meta'); } catch (_) {}
    } catch (_) {}
  }

  // SECTION-PREVIEW-LOC-001 (owner 2026-06-15: "the new sections are visible in
  // DOCX but NOT in preview"). Root cause: the PREVIEW renders main-column
  // sections via `"main" === e.loc` (app.src.js ~17231) and sidebar via
  // `"sidebar" === e.loc`, so a section whose `loc` is MISSING or invalid renders
  // in NEITHER preview column — yet the EXPORT (antcv-docx-client.js ~1304) has
  // NO loc filter and the worker defaults a non-"sidebar" section to the main
  // column, so it appears in the DOCX/PDF. Imported sections (the owner's
  // corrected JSON / the LLM parser omitting `loc`) hit this. Fix: stamp a valid
  // default `loc:'main'` on any section whose loc is not 'main'/'sidebar' — this
  // makes it visible in the preview's main column, matching where the export
  // already puts it. Restore-proof (runs in the same poll as the other
  // normalisers). Loop-safe: returns null when nothing needs changing.
  function defaultLoc(arr) {
    if (!Array.isArray(arr)) return null;
    var changed = false;
    var out = arr.map(function (s) {
      if (s && typeof s === 'object' && s.loc !== 'main' && s.loc !== 'sidebar') {
        changed = true;
        return Object.assign({}, s, { loc: 'main' });
      }
      return s;
    });
    return changed ? out : null;
  }

  // SECTION-TYPE-NORMALIZE-INLINE-001 (owner 2026-06-15: "new sections" inline
  // label). The inline-label sections — WORK STYLE, WHO I AM, WHY THIS COMPANY/
  // ROLE/POSITION — get a bold inline label ("Work style:", "Who I am:", "Why…:")
  // in the EXPORT even when stored as type 'text' (the worker renders text_inline,
  // and isWorkStyleSection forces it for work_style), but the PREVIEW only renders
  // the label for type 'text_inline' (app.src.js ~4744/4765). So an imported
  // section stored as 'text' shows the label in DOCX/PDF but NOT in the preview.
  // Generation emits 'text_inline' post-1.50.497; this covers the IMPORT path.
  // Fix: promote these sections' type 'text' → 'text_inline' (same `content`
  // shape, render-safe in both paths) to restore preview↔export parity. NEVER
  // promote the CL boilerplate (greeting/opening/closure) — both the worker and
  // the preview deliberately render those as plain text even when text_inline.
  var INLINE_LABEL_IDS = { work_style: 1, who_i_am: 1, why_company: 1, why_role: 1, why_position: 1 };
  var INLINE_LABEL_TITLE = /^\s*(work\s*style|who\s+i\s+am|why\s+(this\s+)?(company|role|position))\b/i;
  var INLINE_LABEL_SKIP = { greeting: 1, opening: 1, closure: 1, closing: 1 };
  // CL-INLINE-LABEL-SCOPE-001 (owner 2026-06-19): on the COVER LETTER the export
  // renders WHO I AM / WHY YOUR COMPANY as a heading-above-plain-body (NO inline
  // label) — only WORK STYLE is inline there. Promoting who_i_am/why_* to
  // text_inline on the CL therefore made the PREVIEW show a bold inline label
  // the EXPORTED PDF does not, breaking preview↔export parity. Pass
  // {workStyleOnly:true} for the CL so only work_style is inlineified; the CV
  // main column keeps the full set (its worker DOES inline who_i_am/why_*).
  function inlineifyLabeledText(arr, opts) {
    if (!Array.isArray(arr)) return null;
    var workStyleOnly = !!(opts && opts.workStyleOnly);
    var changed = false;
    var out = arr.map(function (s) {
      if (!s || typeof s !== 'object' || s.type !== 'text') return s;
      if (INLINE_LABEL_SKIP[s.id]) return s;
      var t = String(s.title || '').toLowerCase().trim();
      if (INLINE_LABEL_SKIP[t]) return s;
      if (workStyleOnly) {
        if (s.id === 'work_style' || /^\s*work\s*style\b/i.test(s.title || '')) {
          changed = true;
          return Object.assign({}, s, { type: 'text_inline' });
        }
        return s;
      }
      if (INLINE_LABEL_IDS[s.id] || INLINE_LABEL_TITLE.test(s.title || '')) {
        changed = true;
        return Object.assign({}, s, { type: 'text_inline' });
      }
      return s;
    });
    return changed ? out : null;
  }

  // PROFILE-UNSOLICITED-GENERIC-001 (owner — repeated): for an UNSOLICITED /
  // general CV (no JD), the PROFILE must NOT open by LEADING with a niche
  // deep-tech identity ("Electro-optics and …", LiDAR, automotive, nanotech,
  // deep-tech). The generation prompt forbids it but the model ignores it / the
  // uploaded-doc memory fusion reintroduces it, so enforce it DETERMINISTICALLY.
  // Rewrite ONLY the leading subject phrase (everything before "with N+ years")
  // to the broad product/project identity; the rest of the sentence (which may
  // carry a domain example) is preserved — the owner allows a domain as an
  // example LATER, never as the headline. Idempotent (the neutral subject has no
  // banned term → never re-fires). Gated: only when there's NO JD (a TARGETED
  // deep-tech application may legitimately lead with the niche).
  var BANNED_OPENER = /(electro[\s-]?optics|opto[\s-]?electronic|\blidar\b|nanotech|deep[\s-]?tech|\bautomotive\b)/i;
  function neutralizeUnsolicitedOpener(cv) {
    var hasJd = false;
    try { hasJd = String(localStorage.getItem('antcv:lastJdText') || '').trim().length > 0; } catch (_) {}
    if (hasJd) return null;
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.id !== 'profile' || typeof s.content !== 'string') return s;
      var c = s.content;
      var m = c.match(/^(\s*)([\s\S]*?)(\bwith\s+\d+\+?\s+years\b)/i);
      if (!m || !BANNED_OPENER.test(m[2])) return s;
      var rewritten = m[1] + 'Product and project professional ' + m[3] + c.slice(m[0].length);
      if (rewritten === c) return s;
      changed = true;
      return Object.assign({}, s, { content: rewritten });
    });
    return changed ? out : null;
  }

  // G-GROUPS-003 / ADDITIONAL-INFO-SPLIT-001 (owner 2026-06-18): split a FLAT
  // ADDITIONAL INFORMATION sidebar section into Languages / Accessibility /
  // Interests sub-subsections by inserting {group} marker rows. Both the preview
  // (labeled_list) and the worker export already render a {group} marker as a bold
  // subhead, so this is a content-only regroup (no fabrication). Idempotent: skips
  // once any {group} marker is present. Restore-proof via the 415 poll/listeners.
  // MISCLASSIFY-LANG-001 (owner 2026-06-28): the old test concatenated label+value
  // and checked Languages on the COMBINED string with a bare "language" alternation,
  // so an INTEREST like {l:"Cultural exchange", v:"Languages, food culture and board
  // games"} leaked into the LANGUAGES section (its value mentions "Languages"). Fix:
  // an item whose LABEL is plainly an interest wins FIRST; Languages then matches on
  // the LABEL (Languages/Sprog or a bare language NAME) or a language NAME/CEFR in the
  // VALUE — never on the bare word "language" appearing in an interest's value.
  function classifyAdditional(it) {
    var lab = String((it && it.l) || '');
    var val = String((it && it.v) || '');
    var s = lab + ' ' + val;
    var INTEREST_LABEL = /(interest|hobb|fritid|leisure|pastime|rugby|hiking|hike|tai.?chi|reading|sport|volunteer|frivillig|foreningsarbejde|coach|\bcat\b|feline|cultural exchange|board game|food culture)/i;
    var LANG_NAME = /(english|danish|spanish|hebrew|german|french|norwegian|swedish|finnish|arabic|mandarin|chinese|portuguese|italian|russian|dutch|japanese|korean|polish|turkish)/i;
    if (INTEREST_LABEL.test(lab)) return 'Interests';
    if (/(accessib|accommodat|hearing|deaf|hard of hearing|disab|sign language|assistive)/i.test(s)) return 'Accessibility';
    if (/(\blanguages?\b|\bsprog\b)/i.test(lab) || LANG_NAME.test(lab) ||
        LANG_NAME.test(val) || /(\b[ABC][12]\b|mother tongue|native speaker|bilingual)/i.test(val)) return 'Languages';
    if (INTEREST_LABEL.test(s)) return 'Interests';
    return 'Other';
  }
  // ADDITIONAL-EXPLODE-001 (owner 2026-06-18: "have these sidebar subsections in
  // commercial CV by default" — LANGUAGES / INTERESTS / ACCESSIBILITY shown as
  // SEPARATE sidebar sections, each with its own ON toggle, not bundled inside
  // ADDITIONAL INFORMATION). Splits the flat (or already-{group}-partitioned)
  // ADDITIONAL section into separate top-level sidebar sections, placed where
  // ADDITIONAL was (after REGULATORY CONTEXT). Idempotent + non-destructive:
  // - skips a bucket whose section (id languages/interests/accessibility) already
  //   exists, so the owner's current split is preserved and never duplicated;
  // - any unclassified "Other" items stay in a trimmed ADDITIONAL section.
  // Runs BEFORE partitionAdditional so the grouping step finds nothing to do.
  // LANGUAGES-REPAIR-001 (owner 2026-07 CV(5): the dedicated LANGUAGES section rendered a
  // broken "native / fluent" with NO language names, while personalInfo.languages held the
  // real set). When the dedicated section names no real language, REBUILD it from
  // personalInfo.languages ({lang, level}); the dedup (explodeAdditionalToSections) then
  // removes the duplicate Languages rows from ADDITIONAL because the dedicated home is now
  // good. Only fires when the section is broken (no language name) and a real source exists.
  function repairLanguagesFromPI(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'languages') { idx = i; break; } }
    if (idx < 0) return null;
    var sec = cv[idx];
    var NAME = /(english|danish|spanish|hebrew|german|french|norwegian|swedish|finnish|arabic|mandarin|chinese|portuguese|italian|russian|dutch|japanese|korean|polish|turkish)/i;
    var txt = '';
    if (Array.isArray(sec.items)) sec.items.forEach(function (it) { if (it) txt += ' ' + (it.l || it.b || '') + ' ' + (it.v || it.t || ''); });
    if (typeof sec.content === 'string') txt += ' ' + sec.content;
    if (NAME.test(txt)) return null;                 // already names a language -> good, leave it
    var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { return null; }
    var L = Array.isArray(pi.languages) ? pi.languages : null;
    if (!L || !L.length) return null;
    function level(v) {
      var s = String(v == null ? '' : v).trim();
      if (/native|mother ?tongue/i.test(s)) return 'native / fluent';
      if (/profes/i.test(s)) return 'professional';
      return s;
    }
    var items = L.map(function (x) {
      if (typeof x === 'string') return { l: x.trim(), v: '' };
      return { l: String(x.lang || x.name || x.language || x.l || '').trim(), v: level(x.level || x.proficiency || x.cefr || x.v) };
    }).filter(function (r) { return r.l && NAME.test(r.l); });
    if (!items.length) return null;
    var copy = cv.slice();
    var ns = Object.assign({}, sec, { type: 'labeled_list', items: items });
    delete ns.content;
    copy[idx] = ns;
    return copy;
  }

  // ACCESSIBILITY-REPAIR-001 (owner 2026-07: the dedicated ACCESSIBILITY section held the me()
  // placeholder while personalInfo.accessibility held the real line — and the placeholder made
  // the dedup remove the real copy from ADDITIONAL, so accessibility disappeared from the CV).
  // WORK-STYLE-REPAIR-001 (owner 2026-07-01: "work style blanked out in cv"). The work_style section
  // is a headlineOff rich_block whose body sometimes comes back EMPTY (items[0].t = "") after a stale
  // restore, even though personalInfo.work_style holds the real one-line style sentence
  // (work_style_line_en / notes). Fill the empty body from PI so the section stops rendering blank.
  function repairWorkStyleFromPI(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'work_style') { idx = i; break; } }
    if (idx < 0) return null;
    var sec = cv[idx];
    var ph = function (v) { var s = String(v == null ? '' : v).trim(); return !s || s.charAt(0) === '['; };
    var curBody = (Array.isArray(sec.items) && sec.items[0]) ? (sec.items[0].t || '') : (typeof sec.content === 'string' ? sec.content : '');
    if (!ph(curBody)) return null;                    // already has real content
    var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { return null; }
    var ws = pi.work_style || pi.workStyle || null;
    var line = '';
    if (ws && typeof ws === 'object') line = ws.work_style_line_en || ws.work_style_line || ws.notes || ws.summary || '';
    else if (typeof ws === 'string') line = ws;
    line = String(line || '').trim();
    if (!line || line.charAt(0) === '[') return null;
    // WORK-STYLE-ORPHAN-134 (owner 2026-07-01: "orphan cleaning should have cut it under 134 chars —
    // the 138-char version slid to a second line"). Cap the one-line style at <=133 chars: drop whole
    // trailing clauses (after ; or ,) until it fits, else trim at a word boundary; strip a dangling
    // connector/punctuation so it reads complete.
    if (line.length > 133) {
      // WORK-STYLE-SENTENCE-CUT-001 (owner 2026-07-03, Anita: "…tracking systems. Comfortable"
      // cut mid-sentence): when the source is MULTI-SENTENCE prose (persona notes), pack whole
      // sentences under the cap first; the clause/word trim below only handles a single
      // over-long sentence.
      var __sents = line.match(/[^.!?]+[.!?]+/g);
      if (__sents && __sents.length > 1) {
        var __acc = '';
        for (var __si = 0; __si < __sents.length; __si++) {
          var __nxt = (__acc + __sents[__si]).trim();
          if (__nxt.length <= 133) __acc = __nxt; else break;
        }
        if (__acc.length >= 30) line = __acc;
      }
    }
    if (line.length > 133) {
      var cut = line;
      while (cut.length > 133 && /[;,]/.test(cut)) { cut = cut.replace(/[;,]\s*[^;,]*$/, '').trim(); }
      if (cut.length > 133) cut = cut.slice(0, 133).replace(/\s+\S*$/, '').trim();
      cut = cut.replace(/[\s,;:.\-]+$/, '').trim();
      if (cut.length >= 30) line = cut;   // keep the trim only if it left a sensible line
    }
    var copy = cv.slice();
    if (Array.isArray(sec.items) && sec.items.length) {
      var items = sec.items.slice();
      items[0] = Object.assign({}, items[0], { t: line });
      copy[idx] = Object.assign({}, sec, { items: items });
    } else {
      copy[idx] = Object.assign({}, sec, { content: line });
    }
    try { console.log('[415] work_style body repaired from personalInfo'); } catch (_) {}
    return copy;
  }

  // When the dedicated section is a placeholder/empty and personalInfo has a real line, populate
  // it (text/content). The dedup then keeps it as the single home.
  function repairAccessibilityFromPI(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'accessibility') { idx = i; break; } }
    var sec = idx >= 0 ? cv[idx] : null;
    var ph = function (v) { var s = String(v == null ? '' : v).trim(); return !s || s.charAt(0) === '['; };
    if (sec) {
      var hasReal = (typeof sec.content === 'string' && !ph(sec.content)) ||
        (Array.isArray(sec.items) && sec.items.some(function (it) { return it && !ph(it.t || it.v || it.b); }));
      if (hasReal) return null;                       // existing section already good
    }
    var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { return null; }
    var av = typeof pi.accessibility === 'string' ? pi.accessibility.trim() : '';
    if (!av || av.charAt(0) === '[') return null;     // no real PI line -> nothing to do (never create an empty section)
    var copy = cv.slice();
    if (sec) {                                        // repair in place (existing behaviour)
      var ns = Object.assign({}, sec, { type: 'text', content: av });
      delete ns.items;
      copy[idx] = ns;
      return copy;
    }
    // CV-ACCESS-DROP-001 (owner 2026-07-01: "accessibility was seen in first generation,
    // dropped in second"). gen-2 routes accessibility into ADDITIONAL and ships no standalone
    // section, so the old `idx<0 return null` left nothing to repair and the section vanished.
    // CREATE it from PI at the canonical sidebar position (right after interests, else after
    // languages, else end). Runs BEFORE explodeAdditionalToSections, so explode then sees the
    // section exists + holds content and drops the duplicate ADDITIONAL row (no double-render).
    var newSec = { id: 'accessibility', title: 'ACCESSIBILITY', loc: 'sidebar', on: true, type: 'text', content: av };
    var anchor = -1;
    for (var j = 0; j < copy.length; j++) { if (copy[j] && (copy[j].id === 'interests' || copy[j].id === 'languages')) anchor = j; }
    if (anchor >= 0) copy.splice(anchor + 1, 0, newSec); else copy.push(newSec);
    return copy;
  }

  // EXPERIENCE-REPAIR-001 (owner 2026-07: "CV did not converge" — PROFESSIONAL EXPERIENCE
  // exported as the me() skeleton "[Role title] | [Company name]"). The kernel-recovery floor
  // restored the blank skeleton over a lost experience section, but the REAL roles survive in
  // personalInfo.experience. When the section has fewer than 2 real (non-placeholder) roles and
  // personalInfo holds real ones, rebuild the section's roles from personalInfo (the section role
  // shape is a subset of the personalInfo role shape — id/title/company/years/on/bullets/outcomes;
  // results are laminated downstream from outcomes). Only fires on a degraded section.
  function repairExperienceFromPI(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'experience') { idx = i; break; } }
    if (idx < 0) return null;
    var sec = cv[idx];
    var roles = Array.isArray(sec.roles) ? sec.roles : [];
    var ph = function (r) { return /^\s*\[/.test(String((r && (r.title || r.role)) || '')); };
    if (roles.filter(function (r) { return r && !ph(r); }).length >= 2) return null;   // section is fine
    var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { return null; }
    var src = Array.isArray(pi.experience) ? pi.experience : null;
    if (!src || !src.length) return null;
    var KEEP = ['id', 'title', 'company', 'location', 'years', 'isCurrent', 'on', 'bullets', 'outcomes'];
    var newRoles = src.filter(function (r) { return r && r.on !== false && !ph(r); }).map(function (r) {
      var o = {}; KEEP.forEach(function (k) { if (r[k] !== undefined) o[k] = r[k]; }); return o;
    });
    if (newRoles.length < 2) return null;
    var copy = cv.slice();
    copy[idx] = Object.assign({}, sec, { roles: newRoles });
    return copy;
  }

  // EXPERIENCE-COMPLETENESS-001 (owner 2026-07: "You lost 2 positions: Student representative,
  // Computer admin"). repairExperienceFromPI only fires on a FULLY degraded section (<2 real
  // roles); when the section is otherwise healthy but GENERATION dropped a couple of specific
  // roles (early-career / off-domain ones the LLM silently omitted), nothing restores them and
  // the position is gone. This merge restores completeness WITHOUT changing the visible CV: any
  // real personalInfo role whose title+company is NOT present in the section is re-inserted as
  // HIDDEN (on:false) — present and recoverable in one click, never lost. Owner rule (the gen
  // prompt's own words): a hidden role keeps its content; a DROPPED role forces a retype.
  // ROLES-STORM-CONVERGE-001 (owner 2026-07-21, live antcv.pages.dev 1.51.1792, Ibsen
  // Photonics app AT REST): `sections` written ~40x in 31s forever, the console looping
  // "restored 3 missing role(s) hidden" + "re-applied normalisers after restore". The
  // add-side __complRepeat counter below could not converge it: it is TIME-windowed
  // (3 hits / 6s) while the poll is 2.5s, so it suppressed at most one pass in three
  // and re-armed — and it RESET on any pass that found nothing missing, which a strict
  // add/remove alternation produces. Replaced by a STICKY decision:
  //
  //   restore a given missing-set ONCE per (document x VISIBLE experience substructure).
  //
  // If the same set is missing AGAIN while the visible CV is byte-identical, then
  // something removed what we just restored — restoring it a second time can only
  // sustain the storm. The restored roles are HIDDEN (a recover-in-one-click safety
  // net, never visible content), so holding costs the user nothing. Keying on the
  // VISIBLE substructure is what makes this remover-agnostic: the churn only toggles
  // the hidden roles, so the key is stable across the loop, while any genuine edit or
  // regeneration changes it and re-arms the restore. A page reload also re-arms it.
  var __complDone = { key: '', sigs: {} };
  var __complRepeat = null;   // STORM-OSCILLATION-GUARD-001 (add-side): { sig, first, n } churn tracker
  function repairExperienceCompleteness(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'experience') { idx = i; break; } }
    if (idx < 0) return null;
    var sec = cv[idx];
    var roles = Array.isArray(sec.roles) ? sec.roles : [];
    var ph = function (r) { return /^\s*\[/.test(String((r && (r.title || r.role)) || '')); };
    var real = roles.filter(function (r) { return r && !ph(r); });
    if (real.length < 2) return null;                 // fully degraded -> repairExperienceFromPI owns it
    var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { return null; }
    var src = Array.isArray(pi.experience) ? pi.experience : null;
    if (!src || !src.length) return null;
    var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    // COMPANY-VARIANT-KEY-001: a PI role is "present" when ANY existing section role is the SAME
    // real-world position (year span + title-core), so a canon-shortened company (IDF, the TAU
    // dept-suffix, the CW "& Assistant Coach" variant) is recognised and NOT re-added as a hidden
    // duplicate. The old exact title|company key missed these and doubled the role.
    var KEEP = ['id', 'title', 'company', 'location', 'years', 'isCurrent', 'bullets', 'outcomes'];
    var missing = src.filter(function (r) {
      if (!r || ph(r)) return false;
      var t = norm(r.title || r.role);
      if (!t) return false;                           // unnamed PI slot -> skip
      // ROLE-COVERS-001 (gen-runner merged / 'Earlier career' entries): such an
      // entry declares the source kernel-role ids it covers via __covers, so its
      // constituents are ALREADY represented and must NOT be re-added (the year
      // span differs from the merged entry, so _samePosition alone misses them —
      // the 6-role compaction was doubling back to 13 on open). Owner option (b).
      var rid = r.id != null ? String(r.id) : '';
      if (rid && roles.some(function (s) {
        return s && Array.isArray(s.__covers) && s.__covers.map(String).indexOf(rid) >= 0;
      })) return false;
      return !roles.some(function (s) { return s && _samePosition(s, r); });
    }).map(function (r) {
      var o = {}; KEEP.forEach(function (k) { if (r[k] !== undefined) o[k] = r[k]; });
      o.on = false;                                   // restore HIDDEN — does not change the visible CV
      return o;
    });
    // NOTE (ROLES-STORM-CONVERGE-001): do NOT clear __complDone here. "Nothing missing"
    // is the state right after our own restore lands; clearing on it is precisely how the
    // old counter re-armed itself every other pass and kept the storm alive.
    if (!missing.length) { __complRepeat = null; return null; }
    // STORM-OSCILLATION-GUARD-001 (add-side): this restore keeps finding the SAME roles
    // "missing" every pass because roleCanonTitles shortens a title so _samePosition no
    // longer matches its PI source, and dropCanonHiddenDups / a competing writer strips the
    // restored hidden copy right back out — an endless add<->drop churn that dispatches
    // antcv:sections-updated and re-renders the whole app (the freeze + downstream text-align
    // storm). The restored roles are HIDDEN (on:false) — a recover-in-one-click safety net,
    // NOT visible content — so it is safe to STOP re-adding them once we detect the churn.
    // Signature = the missing set's identity (id|title|company); if we produce the identical
    // set 3+ times within 6s, suppress the restore (return null) until the signature changes
    // or the window lapses. A genuine, new missing set (real edit/regen) resets the counter
    // and restores normally.
    var __sig = missing.map(function (r) { return String(r.id != null ? r.id : '') + '|' + norm(r.title || r.role) + '|' + norm(r.company); }).join('~');
    var __nowC = Date.now();
    if (__complRepeat && __complRepeat.sig === __sig && (__nowC - __complRepeat.first) < 6000) {
      __complRepeat.n++;
      if (__complRepeat.n >= 3) return null;   // churning — hold the add side so the storm can converge
    } else {
      __complRepeat = { sig: __sig, first: __nowC, n: 1 };
    }
    // ROLES-STORM-CONVERGE-001 (sticky, remover-agnostic — see the note on __complDone):
    // one restore per (document x visible experience substructure x missing set). The
    // second time the same set turns up missing under an unchanged visible CV, a
    // competing writer is stripping our restore; hold instead of feeding the loop.
    var __vis = roles.filter(function (r) { return r && r.on !== false; })
      .map(function (r) { return String(r.id != null ? r.id : '') + '|' + norm(r.title || r.role) + '|' + norm(r.company); }).join('~');
    var __doc = '';
    try { var __m = JSON.parse(localStorage.getItem('meta') || '{}') || {}; __doc = String(__m.company || '') + '|' + String(__m.role || ''); } catch (_) {}
    var __key = __doc + '||' + __vis;
    if (__complDone.key !== __key) __complDone = { key: __key, sigs: {} };   // real change -> re-arm
    if (__complDone.sigs[__sig]) {
      if (__complDone.sigs[__sig] === 1) {
        __complDone.sigs[__sig] = 2;          // log once, not once per cycle
        try { console.warn('[415] experience-completeness HELD (ROLES-STORM-CONVERGE-001) — the ' + missing.length + ' role(s) it restored were removed again while the visible CV was unchanged, so a competing writer owns them; not restoring a second time. Un-hide from Settings if you want them back.'); } catch (_) {}
      }
      return null;
    }
    __complDone.sigs[__sig] = 1;
    var copy = cv.slice();
    copy[idx] = Object.assign({}, sec, { roles: roles.concat(missing) });
    try { console.log('[415] experience-completeness restored ' + missing.length + ' missing role(s) hidden'); } catch (_) {}
    return copy;
  }

  // EXPERIENCE-EMPTY-SLOT-HIDE-001 (owner 2026-07-01: "four empty roles" — the CV export showed
  // four "[Role title], [Company] [Years]" rows with no bullets). The me() skeleton ships unused
  // experience slots (empty/placeholder title + company, no bullets) with on:true; the renderer
  // substitutes "[Role title]" placeholders, so they print as empty roles in preview + export. HIDE
  // (on:false) any role that is ENTIRELY empty — no real title AND no real company AND no real bullet
  // AND no real outcome/result. Never touches a role with ANY real content; reversible (on:false).
  function hideEmptyRoleSlots(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'experience') { idx = i; break; } }
    if (idx < 0) return null;
    var sec = cv[idx];
    var roles = Array.isArray(sec.roles) ? sec.roles : [];
    if (!roles.length) return null;
    var ph = function (v) { var s = String(v == null ? '' : v).trim(); return !s || s.charAt(0) === '['; };
    // STORM-EMPTY-SLOT-CONVERGE-001 (owner 2026-07-03, demo "jumping"/"bleeping"): the same
    // sparse-CV guard as antcv-empty-role-hide.js. In the WIZARD/TEMPLATE state every role is a
    // placeholder — hiding them all left the demo preview with no PROFESSIONAL EXPERIENCE block
    // and (before the completeness-side fix) fed an un-hide/re-hide sections-updated storm.
    // Real CVs (>= 2 roles with real title/company) still get their unused slots hidden.
    var withReal = roles.filter(function (r) { return r && (!ph(r.title || r.role) || !ph(r.company)); }).length;
    if (withReal < 2) return null;                     // template/wizard: leave placeholders visible
    var realBullet = function (r) {
      var bs = (r && r.bullets) || [];
      return Array.isArray(bs) && bs.some(function (b) { return !ph(b && typeof b === 'object' ? (b.t || b.text || '') : b); });
    };
    var realOutcome = function (r) {
      if (r && (r.result || r.results)) { var rr = r.result || r.results; if (!ph(rr && typeof rr === 'object' ? (rr.t || rr.result || '') : rr)) return true; }
      var os = (r && r.outcomes) || [];
      return Array.isArray(os) && os.some(function (o) { return o && !ph(o.result || o.title || o); });
    };
    var changed = false;
    var newRoles = roles.map(function (r) {
      if (!r || r.on === false) return r;
      if (ph(r.title || r.role) && ph(r.company) && !realBullet(r) && !realOutcome(r)) {
        changed = true;
        return Object.assign({}, r, { on: false });
      }
      return r;
    });
    if (!changed) return null;
    var copy = cv.slice();
    copy[idx] = Object.assign({}, sec, { roles: newRoles });
    try { console.log('[415] hid empty experience slot(s)'); } catch (_) {}
    return copy;
  }

  // DROP-CANON-HIDDEN-DUP-001 (owner 2026-07-02, LIVE probe): remove HIDDEN (on:false) roles that a
  // prior build re-added as company-variant duplicates of a VISIBLE role (before the canon-aware
  // completeness fix above). A hidden role is dropped only when an on:true role is the SAME
  // real-world position (_samePosition: year span + title core) — e.g. the hidden "Israel Defense
  // Forces, Communication Corps" beside the visible "IDF, Communication Corps". A genuinely-missing
  // role restored HIDDEN by repairExperienceCompleteness has NO visible counterpart, so it is kept.
  // Idempotent: returns null once no hidden role duplicates a visible one.
  // UNSOL-FULL-BREADTH-001 (owner 2026-07-11 "some roles are still hidden for
  // unsolicited — should not happen"): the owner rule is "Unsolicited keeps the
  // full breadth". On an unsolicited doc (pillar match): (a) DROP hidden merge
  // artifacts — 3+ "&"-joined title segments are targeted-mode merge products
  // (a legit dual title like "Team Operations Manager & Assistant Coach" has 2
  // segments and is kept); (b) UN-HIDE a hidden role that is NOT a duplicate of
  // a visible one (dropCanonHiddenDups owns the duplicate case).
  function unsolFullBreadth(cv) {
    var unsol = false;
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var co = String(m.company || '').trim();
      unsol = !!(co && window.__antcvUnsol && window.__antcvUnsol(co));
      if (!unsol && !co) {
        var ac = String(localStorage.getItem('antcv:activeAppCompany') || '').replace(/"/g, '').trim();
        unsol = !!(ac && window.__antcvUnsol && window.__antcvUnsol(ac));
      }
    } catch (_) {}
    if (!unsol) return null;
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    var roles = cv[xi].roles;
    var changed = false;
    var out = [];
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      if (!r) continue;
      if (r.on === false) {
        var t = String(r.title || '');
        if (t.split(/\s&\s/).length >= 3) { changed = true; continue; } // merge artifact — drop
        // UNSOL-FULL-BREADTH-002 (owner 2026-07-11 8-page PDF, pages 7-8 English):
        // never un-hide a LATIN-titled role onto a wide-script doc — it is the
        // English canon rendering of a role already visible in the ribbon
        // language (years-format drift hid it from _samePosition), not a missing
        // role. Un-hiding it appended English pages.
        var wideRibbonUFB = false;
        try { var LU = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); wideRibbonUFB = LU === 'zh' || LU === 'he' || LU === 'am' || LU === 'ar'; } catch (_) {}
        if (wideRibbonUFB && !_isWideTitle(r.title)) { out.push(r); continue; } // wrong-language rendering — stays hidden
        var dup = false;
        for (var j = 0; j < roles.length; j++) {
          var v = roles[j];
          if (v && v !== r && v.on !== false && _samePosition(r, v)) { dup = true; break; }
        }
        if (!dup) { r = Object.assign({}, r, { on: true }); changed = true; } // full breadth — un-hide
      } else {
        // UNSOL-FULL-BREADTH-002 reverse leg: a VISIBLE Latin-titled role on a
        // wide-script ribbon whose company/years match a visible wide-script
        // role is the English canon twin the earlier pass wrongly un-hid
        // (the 8-page PDF). Re-hide it.
        var wideR2 = false;
        try { var LU2 = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); wideR2 = LU2 === 'zh' || LU2 === 'he' || LU2 === 'am' || LU2 === 'ar'; } catch (_) {}
        if (wideR2 && !_isWideTitle(r.title)) {
          for (var j2 = 0; j2 < roles.length; j2++) {
            var v2 = roles[j2];
            if (!v2 || v2 === r || v2.on === false || !_isWideTitle(v2.title)) continue;
            var ck = _companyKey(r.company);
            if ((ck && ck === _companyKey(v2.company)) || _samePosition(r, v2)) {
              r = Object.assign({}, r, { on: false });
              changed = true;
              break;
            }
          }
        }
      }
      out.push(r);
    }
    if (!changed) return null;
    var copy = cv.slice();
    copy[xi] = Object.assign({}, copy[xi], { roles: out });
    return copy;
  }

  function dropCanonHiddenDups(cv) {
    var idx = -1;
    for (var i = 0; i < cv.length; i++) { if (cv[i] && cv[i].id === 'experience') { idx = i; break; } }
    if (idx < 0) return null;
    var sec = cv[idx];
    var roles = Array.isArray(sec.roles) ? sec.roles : [];
    if (roles.length < 2) return null;
    var visible = roles.filter(function (r) { return r && r.on !== false; });
    var drop = {};
    for (var j = 0; j < roles.length; j++) {
      var r = roles[j];
      if (!r || r.on !== false) continue;               // only consider hidden roles
      if (visible.some(function (v) { return v !== r && _samePosition(v, r); })) drop[j] = true;
    }
    if (!Object.keys(drop).length) return null;
    var kept = roles.filter(function (_, j) { return !drop[j]; });
    var copy = cv.slice();
    copy[idx] = Object.assign({}, sec, { roles: kept });
    try { console.log('[415] dropped ' + (roles.length - kept.length) + ' canon-variant hidden dup role(s)'); } catch (_) {}
    return copy;
  }

  // ACCESSIBILITY-PREVIEW-TYPE-001 (owner 2026-07-01: "accessibility not visible in preview"). The
  // preview sidebar renders labeled_list / rich_block / education, NOT type:"text" — and 763 MANAGES
  // accessibility as labeled_list — but the me() skeleton + repairAccessibilityFromPI produce
  // type:"text", so the dedicated ACCESSIBILITY section was invisible in the preview (it still
  // EXPORTED, because the worker renders type:"text"). Convert a REAL-content type:"text" accessibility
  // to a single labeled_list item ({l:"", v:content}); an empty label renders just the value in BOTH
  // the preview (`l && …`) and the worker (`l && v ? "l: v" : l || v`). A placeholder
  // ("[ACCESSIBILITY …]") is left for repairAccessibilityFromPI to fill first (this runs after it).
  function accessibilityToLabeledList(cv) {
    for (var i = 0; i < cv.length; i++) {
      var s = cv[i];
      if (!s || s.id !== 'accessibility' || s.type !== 'text') continue;
      var av = String(s.content == null ? '' : s.content).trim();
      if (!av || av.charAt(0) === '[') return null;   // placeholder/empty -> leave it for the repair
      var copy = cv.slice();
      var ns = Object.assign({}, s, { type: 'labeled_list', items: [{ l: '', v: av }] });
      delete ns.content;
      copy[i] = ns;
      try { console.log('[415] accessibility text -> labeled_list (preview parity)'); } catch (_) {}
      return copy;
    }
    return null;
  }

  // CV-CORECOMP-BLANK-001: a dedicated last-good snapshot/restore guard now lives in
  // pwa/antcv-corecomp-loss-guard.js (parallel to antcv-cl-prose-loss-guard-985.js), plus the root
  // apply-path fix in app.src.js (~line 25076: core_comp_rows now falls back to the section's own
  // existing real rows, matching the profile/work_style pattern). Not duplicated here.

  function explodeAdditionalToSections(cv) {
    var xi = -1;
    for (var i = 0; i < cv.length; i++) {
      var s = cv[i];
      if (s && s.id === 'additional' && s.type === 'labeled_list' && Array.isArray(s.items)) { xi = i; break; }
    }
    if (xi < 0) return null;
    var has = function (id) { return cv.some(function (s) { return s && s.id === id; }); };
    var hasLang = has('languages'), hasInt = has('interests'), hasAcc = has('accessibility');
    // HIDE-NOT-DELETE (owner 2026-06-18): preserve any CUSTOM {group} markers
    // (anything other than the three we promote to their own sections) so the
    // explode never silently deletes the owner's groups - they ride along in the
    // trimmed ADDITIONAL. The Languages/Interests/Accessibility markers become
    // section titles, so dropping just those is not data loss.
    var KNOWN_GROUP = /^\s*(languages?|interests?|accessibility)\s*$/i;
    var keptGroups = cv[xi].items.filter(function (it) { return it && it.group !== undefined && !KNOWN_GROUP.test(String(it.group)); });
    // bucket the real items
    var items = cv[xi].items.filter(function (it) { return it && it.group === undefined; });
    if (!items.length) return null;
    var buckets = { Languages: [], Interests: [], Accessibility: [], Other: [] };
    items.forEach(function (it) { if (it == null) return; buckets[classifyAdditional(it)].push(it); });
    var newSecs = [];
    function mk(id, title, bucket, exists) {
      if (!bucket.length || exists) return;
      newSecs.push({ id: id, title: title, loc: 'sidebar', on: true, type: 'labeled_list', items: bucket });
    }
    mk('languages', 'LANGUAGES', buckets.Languages, hasLang);
    mk('interests', 'INTERESTS', buckets.Interests, hasInt);
    mk('accessibility', 'ACCESSIBILITY', buckets.Accessibility, hasAcc);
    var copy = cv.slice();
    // keep any leftover Other items + preserved custom group markers (or the
    // buckets that already have their own section) in a trimmed ADDITIONAL; drop
    // ADDITIONAL only if there is genuinely nothing left.
    var leftover = keptGroups.concat(buckets.Other);
    // A dedicated section is a real "home" for a category only if it actually holds
    // GOOD data — otherwise dropping the ADDITIONAL rows would lose the only good copy.
    // ADDITIONAL-DEDUP-SAFE-001 (owner 2026-07 CV(4): the dedicated LANGUAGES section had
    // drifted to a broken "native / fluent" (languages-concise collapse) while ADDITIONAL
    // still held the full "English (native), Hebrew (native), Spanish (professional),
    // Danish (B1)". A bare presence check would drop the good additional copy and keep the
    // broken one. So: text/list presence counts as a home for INTERESTS/ACCESSIBILITY, but
    // LANGUAGES must NAME a real language (or carry a CEFR level) to count — a section that
    // only says "native / fluent" is not a valid home and ADDITIONAL keeps its rows.
    var langNameRe = /(english|danish|spanish|hebrew|german|french|norwegian|swedish|finnish|arabic|mandarin|chinese|portuguese|italian|russian|dutch|japanese|korean|polish|turkish|mother tongue|native speaker|\b[ABC][12]\b)/i;
    var secAllText = function (sec) {
      var t = '';
      if (sec) {
        if (Array.isArray(sec.items)) sec.items.forEach(function (it) { if (it && typeof it === 'object') t += ' ' + (it.l || it.b || '') + ' ' + (it.v || it.t || ''); else t += ' ' + (it == null ? '' : it); });
        if (typeof sec.content === 'string') t += ' ' + sec.content;
      }
      return t;
    };
    // A bracketed me() placeholder ("[ACCESSIBILITY - optional …]") is NOT real content —
    // ACCESSIBILITY-PLACEHOLDER-001 (owner 2026-07: the dedicated ACCESSIBILITY section held a
    // placeholder, so a bare presence check deduped the REAL accessibility out of ADDITIONAL and
    // it vanished from the CV). Reject a placeholder content / item.
    var _isPh = function (v) { var s = String(v == null ? '' : v).trim(); return !s || s.charAt(0) === '['; };
    var sectionHasContent = function (id) {
      var sec = cv.filter(function (s) { return s && s.id === id; })[0];
      if (!sec) return false;
      if (id === 'languages') return langNameRe.test(secAllText(sec));
      if (Array.isArray(sec.items) && sec.items.some(function (it) { return it && !_isPh(it.t || it.v || it.b); })) return true;
      if (typeof sec.content === 'string' && !_isPh(sec.content)) return true;
      return false;
    };
    // ADDITIONAL-DEDUP-001 (owner 2026-07: "if we have Languages, hide it FROM Additional;
    // if we have Interests, remove Interests from Additional"). ACCESSIBILITY-DUP-001
    // (owner 2026-06-18: "accessibility is generated twice"). Only KEEP a category's items
    // in ADDITIONAL when there is NO home for them: no dedicated section (mk() just made one,
    // which now owns them), or the dedicated section is genuinely empty. When the dedicated
    // section EXISTS and holds content, it is the single home — drop the rows from ADDITIONAL.
    // The previous build returned early when no NEW section was created, so this dedup never
    // ran and duplicate Languages/Interests/Accessibility rows stayed in ADDITIONAL.
    var pushBack = function (id, exists, bucket) {
      if (exists && !sectionHasContent(id)) bucket.forEach(function (it) { leftover.push(it); });
    };
    pushBack('languages', hasLang, buckets.Languages);
    pushBack('interests', hasInt, buckets.Interests);
    pushBack('accessibility', hasAcc, buckets.Accessibility);
    // Nothing to do only if we neither created a section nor removed any duplicate row.
    if (!newSecs.length && leftover.length === cv[xi].items.length) return null;
    var replacement = leftover.length
      ? newSecs.concat([Object.assign({}, cv[xi], { items: leftover })])
      : newSecs;   // ADDITIONAL fully emptied -> drop it
    copy.splice.apply(copy, [xi, 1].concat(replacement));
    return copy;
  }

  function partitionAdditional(cv) {
    var xi = -1;
    for (var i = 0; i < cv.length; i++) {
      var s = cv[i];
      if (s && s.id === 'additional' && s.type === 'labeled_list' && Array.isArray(s.items)) { xi = i; break; }
    }
    if (xi < 0) return null;
    var items = cv[xi].items;
    if (!items.length) return null;
    // GUARD 1: already partitioned (a {group} marker exists) — never re-fire.
    for (var j = 0; j < items.length; j++) { if (items[j] && items[j].group !== undefined) return null; }
    var buckets = { Languages: [], Accessibility: [], Interests: [], Other: [] };
    items.forEach(function (it) { if (it == null) return; buckets[classifyAdditional(it)].push(it); });
    // GUARD 2: only partition when >=2 named groups have content (else leave flat).
    var named = ['Languages', 'Accessibility', 'Interests'].filter(function (g) { return buckets[g].length; });
    if (named.length < 2) return null;
    var out = [];
    ['Languages', 'Accessibility', 'Interests'].forEach(function (g) {
      if (buckets[g].length) { out.push({ group: g }); buckets[g].forEach(function (it) { out.push(it); }); }
    });
    buckets.Other.forEach(function (it) { out.push(it); }); // ungrouped leftovers last
    var next = cv.slice(); next[xi] = Object.assign({}, cv[xi], { items: out });
    return next;
  }

  // INTERESTS-SHAPE-001 (owner 2026-06-19: "interests is unpopulated"). The INTERESTS
  // section is type 'labeled_list' (renders {l,v}: bold label + value, like LANGUAGES),
  // but its items are stored as {b,t} (bullet/text) — so the renderer finds no l/v and
  // shows the header with NOTHING under it, in BOTH preview and export. The data is
  // there ("Coaching junior rugby" / "Weekly sessions as assistant coach…"); only the
  // shape is wrong. Map {b,t} -> {l,v} so the labeled_list renders. Idempotent (skips
  // an item that already carries l/v); preserves on/bullets; scoped to the interests
  // section so it never touches a genuine {b,t} list elsewhere.
  function normalizeInterestsShape(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.id !== 'interests' || s.type === 'rich_block' || !Array.isArray(s.items)) return s;  // rich_block legitimately uses {b,t}
      var items = s.items.map(function (it) {
        if (!it || typeof it !== 'object') return it;
        if (it.l != null || it.v != null) return it;            // already labeled_list shape
        if (it.b == null && it.t == null) return it;            // nothing to map
        changed = true;
        var n = { l: String(it.b == null ? '' : it.b), v: String(it.t == null ? '' : it.t) };
        if (it.on !== undefined) n.on = it.on;
        if (it.bullets !== undefined) n.bullets = it.bullets;
        return n;
      });
      return Object.assign({}, s, { items: items });
    });
    return changed ? out : null;
  }

  // INTERESTS-BT-REMNANT-001 (owner 2026-06-19): after he rewrote an interest, item-0
  // carries BOTH the correct {l,v} ("Rugby & inclusive sport" / "Team operations, coach
  // assist…") AND the OLD fabricated {b,t} ("Coaching junior rugby" / "Weekly sessions
  // as assistant coach…"). The renderer reads l/v so the preview is right, but the dead
  // {b,t} fabrication lingers in the data. Strip b/t from any interests item that
  // already has l/v. (NO junior rugby — see [[gabriel-cv-facts]].)
  function stripInterestsBtRemnant(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.id !== 'interests' || s.type === 'rich_block' || !Array.isArray(s.items)) return s;  // rich_block legitimately uses {b,t}
      var items = s.items.map(function (it) {
        if (!it || typeof it !== 'object') return it;
        if ((it.l != null || it.v != null) && (it.b !== undefined || it.t !== undefined)) {
          changed = true;
          var clean = Object.assign({}, it); delete clean.b; delete clean.t; return clean;
        }
        return it;
      });
      return Object.assign({}, s, { items: items });
    });
    return changed ? out : null;
  }

  // INTERESTS-PIN-001 (owner 2026-06-19: "so your 6 interests hold rock-solid"). The
  // cloud-restore intermittently flips INTERESTS back to a stale 2-item version (the
  // 6-vs-stale flip). The dedupe/strip re-apply on every restore but cannot re-ADD the
  // missing items, so a short stale copy stays short. Pin the owner's canonical 6 (his
  // snapshot) the SAME way canonKanzen pins the Kanzen role: enforce them ONLY when the
  // section comes back SHORT (< 6 items, i.e. a stale flip) — so it can never drop below
  // his 6, while ≥ 6 is left untouched (he can edit values / add a 7th freely). NO junior
  // rugby. If the deeper cloud-persist fix lands later this becomes a no-op.
  var CANON_INTERESTS = [
    { l: 'Rugby & inclusive sport', v: 'Team operations, coach assist, literally a team player' },
    { l: 'Tai-chi', v: 'Stability and calm under pressure' },
    { l: 'Cultural exchange', v: 'Languages, food culture and board games' },
    { l: 'Hiking', v: 'Outdoor recovery and mental reset' },
    { l: 'Reading', v: 'Technology, society and systems thinking' },
    { l: 'Supervision', v: 'Handling three feline strategic napping experts (cats)' }
  ];
  // INTERESTS-FROM-PI-001 (owner 2026-07-03, Anita demo): the only interests injectors
  // were Gabriel-name-guarded (INTERESTS-LEAK-SOURCE-001), so every OTHER candidate kept
  // the template placeholder while their REAL interests sat in personalInfo.interests and
  // an ADDITIONAL 'Hobbies' row - the preview showed the placeholder, the export dropped
  // it (the owner's preview/PDF mismatch). GENERIC, persona-safe repair (reads only the
  // candidate's OWN pi): fill a placeholder-only INTERESTS from pi.interests in the
  // section's own shape, absorb ADDITIONAL Interests/Hobbies rows (dedup by label, drop
  // the emptied umbrella header), then drop leftover placeholder rows. A still-empty
  // interests hides via hideEmptyOptionalSections (extended). Idempotent.
  // WORKSTYLE-ADDITIONAL-DEDUP-001 (owner 2026-07-03, Anita demo): the persona/pi additional[]
  // carries a "Work style" row that duplicates the main Work Style section. Drop the additional
  // row once the MAIN section has real content (the single-home rule the other repairs follow).
  function dropAdditionalWorkStyleDup(cv) {
    var wi = cv.findIndex(function (s2) { return s2 && s2.id === 'work_style'; });
    if (wi < 0) return null;
    var ws = cv[wi];
    var ph2 = function (v) { var t = String(v == null ? '' : v).trim(); return !t || t.charAt(0) === '['; };
    var body = (Array.isArray(ws.items) && ws.items[0]) ? (ws.items[0].t || '') : (typeof ws.content === 'string' ? ws.content : '');
    if (ph2(body)) return null;                       // main not real yet — keep the additional copy
    var ai = cv.findIndex(function (s2) { return s2 && s2.id === 'additional' && Array.isArray(s2.items); });
    if (ai < 0) return null;
    var kept = cv[ai].items.filter(function (it) {
      var lead = String((it && (it.l != null ? it.l : it.b)) || '').trim();
      return !(it && !it.grp && !it.group && /^work[ -]?style$/i.test(lead));
    });
    if (kept.length === cv[ai].items.length) return null;
    var copy = cv.slice();
    copy[ai] = Object.assign({}, cv[ai], { items: kept });
    try { console.log('[415] dropped additional Work-style dup (single home = main section)'); } catch (_) {}
    return copy;
  }

  function repairInterestsFromPI(cv) {
    var xi = cv.findIndex(function (s) { return s && s.id === 'interests' && Array.isArray(s.items); });
    if (xi < 0) return null;
    var sec = cv[xi];
    var ph = function (v) { var s2 = String(v == null ? '' : v).trim(); return !s2 || s2.charAt(0) === '['; };
    var leadOf = function (it) { return it ? (it.l != null ? it.l : it.b) : ''; };
    var bodyOf = function (it) { return it ? (it.v != null ? it.v : it.t) : ''; };
    var isReal = function (it) { return it && (!ph(leadOf(it)) || !ph(bodyOf(it))); };
    var rowsReal = sec.items.filter(isReal);
    var pi = {};
    try { var rawPi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; pi = rawPi.personalInfo ? rawPi.personalInfo : rawPi; } catch (_) {}
    var piInts = Array.isArray(pi.interests) ? pi.interests.filter(function (it) { return it && (typeof it === 'string' ? it.trim() : (it.l || it.v)); }) : [];
    var asRich = sec.type === 'rich_block';
    var mk = function (l, v) { return asRich ? { b: String(l || ''), t: String(v || '') } : { l: String(l || ''), v: String(v || '') }; };
    var changed = false;
    var items = sec.items.slice();
    if (!rowsReal.length && piInts.length) {
      items = piInts.map(function (it) { return typeof it === 'string' ? mk('', it) : mk(it.l, it.v); });
      changed = true;
    }
    var ai = cv.findIndex(function (s2) { return s2 && s2.id === 'additional' && Array.isArray(s2.items); });
    var addlMoved = [], addlItems = null;
    if (ai >= 0) {
      addlItems = cv[ai].items.filter(function (it) {
        var lead = String(leadOf(it) || '').trim();
        var isHob = it && !it.grp && !it.group && /^(hobbies|interests?)$/i.test(lead);
        var grpLbl = it && (it.grp || it.group) ? String(it.grp === true ? (it.t || '') : (it.grp || it.group)).trim() : '';
        if (isHob) { addlMoved.push(it); return false; }
        if (grpLbl && /^(interests?|hobbies)$/i.test(grpLbl)) return false;
        return true;
      });
      if (addlItems.length === cv[ai].items.length) { addlItems = null; }
    }
    if (addlMoved.length) {
      var have = {};
      items.forEach(function (it) { if (isReal(it)) have[String(leadOf(it) || '').toLowerCase()] = 1; });
      addlMoved.forEach(function (it) {
        var l = String(leadOf(it) || ''), v = String(bodyOf(it) || '');
        if (ph(l) && ph(v)) return;
        if (l && have[l.toLowerCase()]) return;
        items.push(mk(l, v)); have[l.toLowerCase()] = 1;
      });
      changed = true;
    } else if (addlItems) {
      changed = true;   // only an emptied umbrella header was dropped
    }
    if (!changed) return null;
    var realNow = items.filter(isReal);
    if (realNow.length) items = realNow;
    var copy = cv.slice();
    copy[xi] = Object.assign({}, sec, { items: items });
    if (ai >= 0 && addlItems) copy[ai] = Object.assign({}, cv[ai], { items: addlItems });
    try { console.log('[415] interests repaired from PI (+' + addlMoved.length + ' moved from additional)'); } catch (_) {}
    return copy;
  }

  function pinInterests(cv) {
    if (!gabrielPresent()) return null;   // INTERESTS-LEAK-SOURCE-001: CANON_INTERESTS are Gabriel's; never inject for a non-Gabriel/fresh/deleted user
    var xi = cv.findIndex(function (s) { return s && s.id === 'interests' && Array.isArray(s.items); });
    if (xi < 0) return null;
    var items = cv[xi].items;
    // Only re-assert when the section has come back SHORT (a stale flip). At ≥ 6 the
    // owner's edits/additions hold — never fight them.
    if (items.length >= 6) return null;
    var copy = cv.slice();
    // pin in the section's OWN shape — rich_block uses {b,t}, labeled_list uses {l,v}.
    var asRich = cv[xi].type === 'rich_block';
    copy[xi] = Object.assign({}, cv[xi], { items: CANON_INTERESTS.map(function (c) { return asRich ? { b: c.l, t: c.v } : { l: c.l, v: c.v }; }) });
    return copy;
  }

  // INTERESTS-JUNIOR-RUGBY-SCRUB-001 (owner 2026-06-22: "how the fuck interest was leaking junior
  // rugby coach again??"). The fabrication "Coaching junior rugby / assistant coach" used to be killed
  // by stripInterestsBtRemnant, but that only handled a {b,t} REMNANT beside {l,v} and now SKIPS
  // rich_block (1.50.776) — so in a rich_block interests the fabricated row survives. This SHAPE-
  // AGNOSTIC scrub removes ANY interests row whose lead OR body matches the fabrication (NO junior
  // rugby — see [[gabriel-cv-facts]]): drop it when a canonical "Rugby & inclusive sport" row already
  // exists, else REPLACE it with the canonical rugby entry in the section's own shape. Idempotent.
  var JUNIOR_RUGBY = /junior rugby|coaching junior|assistant coach/i;
  function scrubJuniorRugby(cv) {
    if (!gabrielPresent()) return null;   // INTERESTS-LEAK-SOURCE-001: the canonical rugby row is Gabriel's; don't rewrite another persona's interests
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || s.id !== 'interests' || !Array.isArray(s.items)) return s;
      var rich = s.type === 'rich_block';
      var hasCanon = s.items.some(function (it) { return it && /rugby & inclusive sport/i.test(String((it.b || it.l || '') + ' ' + (it.t || it.v || ''))); });
      var canon = rich ? { b: 'Rugby & inclusive sport', t: 'Team operations, coach assist, literally a team player' }
        : { l: 'Rugby & inclusive sport', v: 'Team operations, coach assist, literally a team player' };
      var items = [];
      s.items.forEach(function (it) {
        var txt = String((it && (it.b || it.l) || '') + ' ' + (it && (it.t || it.v) || ''));
        if (it && !it.grp && JUNIOR_RUGBY.test(txt)) {
          changed = true;
          if (!hasCanon) { items.push(canon); hasCanon = true; }   // replace the first; drop further dups
          return;
        }
        items.push(it);
      });
      return changed ? Object.assign({}, s, { items: items }) : s;
    });
    return changed ? out : null;
  }

  // SIDEBAR-DEDUPE-001 (owner 2026-06-19, from his curated language/education snapshots):
  // the kernel keeps regenerating DUPLICATE sidebar entries that he hides by hand (a
  // verbose "Spanish - full professional, Uruguayan variant" beside the concise
  // "Spanish: professional"; GPA-split degrees beside the combined no-GPA one). He wants
  // these AUTO-deduped. Restore-proof + idempotent.
  // (a) labeled_list: drop a HIDDEN item whose label duplicates a VISIBLE item's label
  //     (case-insensitive). NEVER drops a uniquely-hidden item, so hide-over-delete still
  //     holds for genuine hides. Scoped to languages + tools (the dup-prone lists).
  var DEDUPE_BYNAME_IDS = { languages: 1, tools: 1 };
  function dedupeHiddenDupByName(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s || !DEDUPE_BYNAME_IDS[s.id] || !Array.isArray(s.items)) return s;
      var visible = {};
      s.items.forEach(function (it) {
        if (it && it.l != null && it.hidden !== true && it.on !== false) visible[String(it.l).toLowerCase().trim()] = 1;
      });
      var kept = s.items.filter(function (it) {
        if (it && it.hidden === true && it.l != null && visible[String(it.l).toLowerCase().trim()]) { changed = true; return false; }
        return true;
      });
      return kept.length !== s.items.length ? Object.assign({}, s, { items: kept }) : s;
    });
    return changed ? out : null;
  }

  // (b) education: drop a GPA-bearing degree when a no-GPA entry of the SAME base degree
  //     exists (owner shows GPA hidden), and drop a standalone B.Sc when the combined
  //     "B.Sc … & B.Sc …" entry covers it. Verified on his real 8-item set → the desired
  //     4 (MBA, M.Sc. Electrical, B.Sc. Physics & Electrical [combined], FVU Dansk).
  function dedupeEducation(cv) {
    var xi = cv.findIndex(function (s) { return s && s.id === 'education' && Array.isArray(s.items); });
    if (xi < 0) return null;
    var items = cv[xi].items;
    if (items.length < 2) return null;
    var norm = function (d) { return String(d == null ? '' : d).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); };
    var hasGpa = function (it) { return it && it.gpa != null && String(it.gpa).trim() !== ''; };
    var drop = {};
    var combIdx = -1;
    items.forEach(function (it, i) { if (it && /&/.test(String(it.deg || '')) && /b\.?sc/i.test(String(it.deg || ''))) combIdx = i; });
    if (combIdx >= 0) {
      var comb = norm(items[combIdx].deg);
      items.forEach(function (it, i) {
        if (i === combIdx || !it) return;
        var d = norm(it.deg);
        if (/^b ?sc\b/.test(d)) {
          var subj = (d.replace(/^b ?sc/, '').replace(/and electronic|engineering/g, '').trim().split(' ')[0]) || '';
          if (subj && comb.indexOf(subj) >= 0) drop[i] = 1;
        }
      });
    }
    var groups = {};
    items.forEach(function (it, i) {
      if (drop[i] || !it) return;
      var key = norm(it.deg).split(' ').slice(0, 2).join(' ');
      (groups[key] = groups[key] || []).push(i);
    });
    Object.keys(groups).forEach(function (k) {
      var idxs = groups[k];
      if (idxs.length < 2) return;
      var keepI = -1;
      for (var j = 0; j < idxs.length; j++) { if (!hasGpa(items[idxs[j]])) { keepI = idxs[j]; break; } }
      if (keepI < 0) keepI = idxs[0];
      idxs.forEach(function (i) { if (i !== keepI) drop[i] = 1; });
    });
    if (!Object.keys(drop).length) return null;
    var kept = items.filter(function (_, i) { return !drop[i]; });
    var copy = cv.slice(); copy[xi] = Object.assign({}, copy[xi], { items: kept });
    return copy;
  }

  // EMPTY-OPTIONAL-LEAK-001 (owner 2026-07-03, Anita demo): (a) an education item whose
  // deg AND sch are both blank/bracketed rendered a lone italic "[Degree]" row above the
  // real MBA; drop such items when the section has at least one REAL item (the wizard
  // template keeps its placeholders). (b) RECOMMENDATIONS / ACCESSIBILITY with NO real
  // content printed placeholder text on a real CV — hide (on:false, hide-over-delete)
  // when the CV has real experience content; the wizard/template state is untouched.
  function _phv(v) { var s = String(v == null ? '' : v).trim(); return !s || s.charAt(0) === '['; }
  function dropEmptyEducationItems(cv) {
    var xi = cv.findIndex(function (s) { return s && s.id === 'education' && Array.isArray(s.items); });
    if (xi < 0) return null;
    var items = cv[xi].items;
    var real = items.filter(function (it) { return it && (!_phv(it.deg) || !_phv(it.sch)); });
    if (!real.length || real.length === items.length) return null;   // sparse template OR nothing to drop
    var copy = cv.slice(); copy[xi] = Object.assign({}, copy[xi], { items: real });
    try { console.log('[415] dropped ' + (items.length - real.length) + ' empty education item(s)'); } catch (_) {}
    return copy;
  }
  function hideEmptyOptionalSections(cv) {
    var expReal = cv.some(function (s) {
      return s && s.type === 'experience' && Array.isArray(s.roles) &&
        s.roles.some(function (r) { return r && r.on !== false && (!_phv(r.title) || !_phv(r.company)); });
    });
    if (!expReal) return null;                          // wizard/template: leave placeholders visible
    var changed = false;
    var copy = cv.map(function (s) {
      if (!s || s.on === false) return s;
      if (!/^(recommendations|accessibility|interests)$/.test(String(s.id || ''))) return s;
      var hasReal = false;
      if (typeof s.content === 'string' && !_phv(s.content)) hasReal = true;
      [].concat(s.items || [], s.rows || []).forEach(function (it) {
        if (hasReal || it == null) return;
        if (typeof it === 'string') { if (!_phv(it)) hasReal = true; return; }
        if (Array.isArray(it)) { if (it.some(function (c) { return typeof c === 'string' && !_phv(c); })) hasReal = true; return; }
        ['l', 'v', 't', 'b', 'deg', 'sch', 'text', 'value'].forEach(function (k) { if (typeof it[k] === 'string' && !_phv(it[k])) hasReal = true; });
      });
      if (hasReal) return s;
      changed = true;
      return Object.assign({}, s, { on: false });
    });
    if (!changed) return null;
    try { console.log('[415] hid empty optional section(s) (recommendations/accessibility)'); } catch (_) {}
    return copy;
  }

  // SIRIN-TEAM-001 (owner 2026-06-19): the Sirin role is NOT a 'task force' - it is the
  // Sigma-Connectivity ODM engineering team (Sweden) that Gabriel DIRECTED for ~2 years.
  // Rename every 'task force' -> 'team' across the CV (role bullets, the selected
  // outcomes that laminate the Results line, anywhere). Deep, idempotent (returns null
  // once none remain). See [[gabriel-cv-facts]] SIRIN-SEMANTICS / SIRIN-TEAM.
  function renameTaskForce(cv) {
    var changed = false;
    function walk(o) {
      if (typeof o === 'string') { if (/tasks+force/i.test(o)) { changed = true; return o.replace(/tasks+force/gi, 'team'); } return o; }
      if (Array.isArray(o)) return o.map(walk);
      if (o && typeof o === 'object') { var n = {}; for (var k in o) n[k] = walk(o[k]); return n; }
      return o;
    }
    var out = walk(cv);
    return changed ? out : null;
  }

  // TOOLS-FABRICATION-001 (owner 2026-06-19: "you hallucinated Snowflake into my tools").
  // The JD-tailoring keeps injecting a JD-required tool the candidate does NOT have
  // (Nordea analytics -> Snowflake) into TOOLS & METHODS. Strip known-fabricated tools
  // from any tools comma-list. Gabriel does NOT use Snowflake. (Generalise via a kernel
  // allowlist later; the prompt TOOLS-NO-FABRICATION rule is the generation-side guard.)
  var FABRICATED_TOOLS = /snowflake|dbt/i;
  function stripFabricatedTools(cv) {
    var changed = false;
    var out = cv.map(function (s) {
      if (!s) return s;
      if (s.id === 'tools' && Array.isArray(s.items)) {
        var items = s.items.map(function (it) {
          if (!it || typeof it !== 'object' || typeof it.v !== 'string' || !FABRICATED_TOOLS.test(it.v)) return it;
          var v = it.v.split(/s*,s*/).filter(function (part) { return part && !FABRICATED_TOOLS.test(part); }).join(', ');
          if (v !== it.v) { changed = true; return Object.assign({}, it, { v: v }); }
          return it;
        });
        return Object.assign({}, s, { items: items });
      }
      if ((s.type === 'table' || Array.isArray(s.rows)) && Array.isArray(s.rows)) {
        var rows = s.rows.map(function (row) {
          if (!Array.isArray(row)) return row;
          return row.map(function (cell) {
            if (typeof cell !== 'string' || !FABRICATED_TOOLS.test(cell)) return cell;
            var cv2 = cell.split(/s*,s*/).filter(function (p) { return p && !FABRICATED_TOOLS.test(p); }).join(', ');
            if (cv2 !== cell) { changed = true; return cv2; }
            return cell;
          });
        });
        return Object.assign({}, s, { rows: rows });
      }
      return s;
    });
    return changed ? out : null;
  }

  // STORM-OSCILLATION-GUARD-001 (owner 2026-07-20, live-diagnosed): the normalize pipeline
  // can enter an A/B ping-pong with a COMPETING writer — roleCanonTitles shortens a role
  // title so _samePosition no longer matches its personalInfo source, repairExperienceCompleteness
  // re-adds that PI role HIDDEN, and dropCanonHiddenDups / another sidecar strips it again, so
  // every pass produces a genuinely-different `sections` (the "restored N missing role(s)" +
  // "re-applied normalisers after restore" logs looping endlessly). That write+dispatch storm
  // re-renders the whole app continuously — the measured freeze AND the downstream text-align
  // re-apply storm (certs/interests "jumpiness"). The per-pass `__after === __before` guard can't
  // catch it (each pass IS a real diff). Fix: refuse to WRITE a serialised result we already wrote
  // in the last few seconds — reproducing a recent state means another writer is reverting us, so
  // feeding it again only sustains the loop. A genuine, distinct normalisation (different content)
  // always writes. Time-bounded so a legitimate later re-visit of an old state is unaffected.
  var __recentWrites = [];   // [{ h: serialisedSections, t: ms }]
  var __OSC_WINDOW_MS = 4000;
  // ROLES-STORM-CONVERGE-001 (write-side): the whole-blob key above is defeated by a
  // PARALLEL writer. On the live Ibsen app a translation/babel pass rewrote unrelated
  // rows (the zh/English tools residue) on every cycle, so the serialised blob was never
  // byte-identical twice and this guard never matched — while the experience section
  // ping-ponged between exactly two shapes. Key a second guard on the EXPERIENCE
  // SUBSTRUCTURE alone: if we are about to re-produce an experience section we already
  // wrote seconds ago (i.e. it was reverted in between), keep the STORED one and let the
  // rest of the normalisation through. Unrelated work still lands; only the contested
  // substructure stops being re-fed.
  // Generalised over SECTIONS (not just experience): the same tug-of-war shape shows up
  // wherever a belt and a legacy re-adder disagree about one section — the rich_block
  // Latin-residue war (BABEL-RICHBLOCK-RESIDUE-001) is the second instance. One guard
  // covers both docs and every future belt.
  var __recentSecWrites = [];   // [{ k: 'cv:experience', h: serialised section, t: ms }]
  function __secKey(s, i) { return String((s && (s.id || s.type)) || ('#' + i)); }
  // Serialise each section by key. A DUPLICATED key is unusable (we could not tell the
  // two apart on the next pass), so it maps to null and is never held.
  function __secMap(list) {
    var m = {};
    (list || []).forEach(function (s, i) {
      var k = __secKey(s, i);
      m[k] = Object.prototype.hasOwnProperty.call(m, k) ? null : JSON.stringify(s);
    });
    return m;
  }

  function normalize() {
    // EDIT-GUARD-001 (owner 2026-06-19): defer all normalisation while the user is
    // actively editing — rewriting sections mid-edit re-renders the preview and
    // steals the caret ("the sidebar dances, editing stops"). The interval catches
    // up once focus leaves.
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ''))) return; } catch (_) {}
    try { normalizeMeta(); } catch (_) {}
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return;
      var b = JSON.parse(raw);
      if (!b || !Array.isArray(b.cv) || !b.cv.length) return;
      // STORM-IDEMPOTENT-001 (owner 2026-06-26, live probe): 415 listens to AND dispatches
      // antcv:sections-updated. Several normalisers below return a NEW-but-equal structure (a
      // reordered-to-the-same-order array), so `changed` went true on already-normalised data and 415
      // wrote + dispatched EVERY cycle — ping-ponging sections-updated with the other sidecars
      // thousands of times (the "re-applied normalisers after restore" storm that re-renders the whole
      // app and makes Settings/HWIC/WIB flicker). Snapshot the input now and, after normalising, ONLY
      // write + dispatch when the serialised result is ACTUALLY different. A true no-op stays silent.
      var __before = JSON.stringify(b);
      var cv = b.cv;
      var changed = false;
      var k = canonKanzen(cv); if (k) { cv = k; changed = true; }
      var cw = canonCopenhagenWolves(cv); if (cw) { cv = cw; changed = true; }
      var tf = renameTaskForce(cv); if (tf) { cv = tf; changed = true; }
      var sft = stripFabricatedTools(cv); if (sft) { cv = sft; changed = true; }
      var idf = canonIDF(cv); if (idf) { cv = idf; changed = true; }
      var tau = canonTAU(cv); if (tau) { cv = tau; changed = true; }
      // ROLE-DECOMP-001 (owner 2026-06-16): the "Customer Change Requests Specialist"
      // is a DISTINCT Innoviz position the owner wants kept (= "Change Request
      // Manager"), no longer folded into the Change-Control role. dropCustomerChangeDup
      // is retained for reference but NOT applied. Re-enable only if merging returns.
      // var cc = dropCustomerChangeDup(cv); if (cc) { cv = cc; changed = true; }
      var fe = foundedToEstablished(cv); if (fe) { cv = fe; changed = true; }
      var pt = stripPatentFromRoles(cv); if (pt) { cv = pt; changed = true; }
      var d = dedupeRoles(cv); if (d) { cv = d; changed = true; }
      // MERGE-COMPONENT-SWALLOW-001: after dedupe (exact-title twins gone), drop a bare
      // component role that an explicit merged "X & Y" title already covers — BEFORE
      // roleCanonTitles rewrites titles, so the component/part text still matches.
      var msc = swallowMergedComponents(cv); if (msc) { cv = msc; changed = true; }
      // ROLE-CANON-LANG-001: canonical per-language titles AFTER dedupe has
      // collapsed twins, so the survivor gets the ribbon-language canon title.
      var rct = roleCanonTitles(cv); if (rct) { cv = rct; changed = true; }
      // MERGED-TITLE-ORDER-001: core (IC) function FIRST in a merged title.
      var rmt = reorderMergedTitles(cv); if (rmt) { cv = rmt; changed = true; }
      var ro = canonicalRoleOrder(cv); if (ro) { cv = ro; changed = true; }
      var bo = canonicalBulletOrder(cv); if (bo) { cv = bo; changed = true; }
      var f = stripFounder(cv); if (f) { cv = f; changed = true; }
      var p = placeRecs(cv); if (p) { cv = p; changed = true; }
      var dl = defaultLoc(cv); if (dl) { cv = dl; changed = true; }
      var wi = inlineifyLabeledText(cv); if (wi) { cv = wi; changed = true; }
      var no = neutralizeUnsolicitedOpener(cv); if (no) { cv = no; changed = true; }
      var rws = repairWorkStyleFromPI(cv); if (rws) { cv = rws; changed = true; }
      var rl = repairLanguagesFromPI(cv); if (rl) { cv = rl; changed = true; }
      var ra = repairAccessibilityFromPI(cv); if (ra) { cv = ra; changed = true; }
      var al = accessibilityToLabeledList(cv); if (al) { cv = al; changed = true; }
      var re = repairExperienceFromPI(cv); if (re) { cv = re; changed = true; }
      var rec = repairExperienceCompleteness(cv); if (rec) { cv = rec; changed = true; }
      var hes = hideEmptyRoleSlots(cv); if (hes) { cv = hes; changed = true; }
      var dch = dropCanonHiddenDups(cv); if (dch) { cv = dch; changed = true; }
      var ufb = unsolFullBreadth(cv); if (ufb) { cv = ufb; changed = true; }
      var ex = explodeAdditionalToSections(cv); if (ex) { cv = ex; changed = true; }
      var pa = partitionAdditional(cv); if (pa) { cv = pa; changed = true; }
      var jr = scrubJuniorRugby(cv); if (jr) { cv = jr; changed = true; }
      var ish = normalizeInterestsShape(cv); if (ish) { cv = ish; changed = true; }
      var ibt = stripInterestsBtRemnant(cv); if (ibt) { cv = ibt; changed = true; }
      var wsd = dropAdditionalWorkStyleDup(cv); if (wsd) { cv = wsd; changed = true; }
      var rint = repairInterestsFromPI(cv); if (rint) { cv = rint; changed = true; }
      var pin = pinInterests(cv); if (pin) { cv = pin; changed = true; }
      var dhn = dedupeHiddenDupByName(cv); if (dhn) { cv = dhn; changed = true; }
      var dedu = dedupeEducation(cv); if (dedu) { cv = dedu; changed = true; }
      var dee = dropEmptyEducationItems(cv); if (dee) { cv = dee; changed = true; }
      var heo = hideEmptyOptionalSections(cv); if (heo) { cv = heo; changed = true; }
      // FINAL-ROLE-CONDENSE-FOLD-001: run the volunteer-bullet cap + regulatory-heading shorten LAST,
      // after canon/dedupe/order have settled, so nothing downstream re-adds the bullets it trims.
      var vcap = condenseVolunteerRoles(cv); if (vcap) { cv = vcap; changed = true; }
      var rhead = shortenRegulatoryHeading(cv); if (rhead) { cv = rhead; changed = true; }
      // SECTION-PREVIEW-LOC-001 / TYPE-NORMALIZE: also normalise the CL sections'
      // loc + work_style type so imported CL sections render in the preview.
      var cl = Array.isArray(b.cl) ? b.cl : null;
      var clChanged = false;
      if (cl) { var dlc = defaultLoc(cl); if (dlc) { cl = dlc; clChanged = true; } }
      if (cl) { var wic = inlineifyLabeledText(cl, { workStyleOnly: true }); if (wic) { cl = wic; clChanged = true; } }
      // BABEL-RICHBLOCK-RESIDUE-001 (owner 2026-07-11 screenshot: "Foundation: I
      // connect what I do best…" stayed English inside an otherwise-zh CL): a
      // rich_block accumulated a LATIN duplicate of a lead-in row next to its
      // ribbon-language twin (partial-pass damage). On a wide-script ribbon, drop
      // a pure-Latin item whose lead label is one of the known lead-ins
      // (Foundation / Hands-on / Professionally) when the same block already
      // carries at least one wide-script item — the residue class only, so a
      // legit English quote inside a zh item is never touched.
      // BABEL-RICHBLOCK-RESIDUE-CONVERGE-001 (2026-07-21): RE-ENABLED. It was disabled on
      // 2026-07-11 ("preview jumpy / edit closes") because it lost a write war to legacy
      // re-adders (foundation-758 pre-345 caches, shape-guard eager writes, languageCache
      // echoes) at ~one cycle / 5s. The re-adder inventory is still incomplete and a NEW
      // re-adder would reopen it either way, so the drop is now remover-agnostic instead:
      // a sticky one-shot decision (see dropRichBlockLatinResidue) plus the per-section
      // write guard below. Worst case it drops the residue once and then stands down —
      // never the endless cycle. Kill switch: antcv:disable-richblock-residue-drop.
      var __rbrOff = false;
      try { var __rv = localStorage.getItem('antcv:disable-richblock-residue-drop'); __rbrOff = (__rv === '1' || __rv === 'true'); } catch (_) {}
      if (!__rbrOff) {
        var rbr = dropRichBlockLatinResidue(cv, 'cv'); if (rbr) { cv = rbr; changed = true; }
        if (cl) { var rbc = dropRichBlockLatinResidue(cl, 'cl'); if (rbc) { cl = rbc; clChanged = true; } }
      }
      if (clChanged) changed = true;
      if (!changed) return;
      var next = Object.assign({}, b, { cv: cv });
      if (clChanged) next.cl = cl;
      // STORM-IDEMPOTENT-001: a normaliser flagged a change but the serialised result may be
      // identical to the input (reorder-to-same, no-op canon). Only persist + notify on a REAL diff,
      // else this fires the antcv:sections-updated storm that flickers the whole app.
      var __after = JSON.stringify(next);
      if (__after === __before) return;
      // ROLES-STORM-CONVERGE-001 (write-side, substructure-keyed): hold back any CONTESTED
      // section — one we already wrote within the window and that has since been reverted —
      // while still writing everything else this pass normalised. Applies per section, to
      // BOTH docs, so one belt losing a tug-of-war never blocks the other belts' work.
      var __nowE = Date.now();
      __recentSecWrites = __recentSecWrites.filter(function (e) { return __nowE - e.t < __OSC_WINDOW_MS; });
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(next[doc]) || !Array.isArray(b[doc])) return;
        var mBefore = __secMap(b[doc]), mAfter = __secMap(next[doc]);
        var held = null;
        var out = next[doc].map(function (s, i) {
          var k = __secKey(s, i);
          var h = mAfter[k];
          if (!k || h == null || mBefore[k] == null || h === mBefore[k]) return s;   // unchanged / ambiguous key
          if (!__recentSecWrites.some(function (e) { return e.k === doc + ':' + k && e.h === h; })) {
            __recentSecWrites.push({ k: doc + ':' + k, h: h, t: __nowE });
            return s;
          }
          held = (held || []).concat(k);
          try { return JSON.parse(mBefore[k]); } catch (_) { return s; }             // keep the STORED one
        });
        if (held) {
          next = Object.assign({}, next);
          next[doc] = out;
          try { console.warn('[sections-normalize-415] ' + doc + ' section oscillation held (ROLES-STORM-CONVERGE-001) — a competing writer keeps reverting ' + held.join(', ') + '; keeping the stored one and writing the rest'); } catch (_) {}
        }
      });
      __after = JSON.stringify(next);
      if (__after === __before) return;          // the contested sections were the only change
      // STORM-OSCILLATION-GUARD-001: if we already wrote this exact result within the window,
      // a competing writer is reverting it every cycle — writing again only sustains the
      // sections-updated storm (continuous re-render + text-align re-apply). Hold instead.
      var __nowW = Date.now();
      __recentWrites = __recentWrites.filter(function (e) { return __nowW - e.t < __OSC_WINDOW_MS; });
      if (__recentWrites.some(function (e) { return e.h === __after; })) {
        try { console.warn('[sections-normalize-415] oscillation held — a competing writer keeps reverting this normalisation; not re-dispatching to break the storm'); } catch (_) {}
        return;
      }
      __recentWrites.push({ h: __after, t: __nowW });
      localStorage.setItem('sections', __after);
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.log('[sections-normalize-415] re-applied normalisers (recs/founder/loc-default) after restore'); } catch (_) {}
    } catch (_) {}
  }

  var t = null;
  function schedule(ev) {
    if (ev && ev.detail && ev.detail.source === SRC) return; // ignore our own write
    clearTimeout(t); t = setTimeout(normalize, 120);
  }
  window.addEventListener('antcv:sections-updated', schedule);
  // also re-read on a cross-tab storage write of the sections key
  window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) schedule(); });
  // boot sweep: catch the restore that fires before listeners attach
  [400, 1200, 3000].forEach(function (ms) { setTimeout(normalize, ms); });
  // POST-GENERATION poll (owner 2026-06-15): a GENERATE / multi-LLM CONSENSUS
  // write lands long after the boot sweep and does not always dispatch
  // antcv:sections-updated, so the normalisers never re-ran on it (Founder,
  // i-nord, Kanzen-2025, duplicate role, patent-in-role all survived). Poll so
  // the restore-proof net always catches it. Loop-safe: normalize() reads +
  // writes ONLY on a real change and tags its own event.
  setInterval(normalize, 2500);

  window.AntcvSectionsNormalize = { version: VERSION, _normalize: normalize };
  try { console.debug('[sections-normalize-415] installed v' + VERSION); } catch (_) {}
})();
