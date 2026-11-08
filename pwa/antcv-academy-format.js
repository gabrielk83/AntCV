/* antcv-academy-format.js — ACADEMY-FORMAT-001 (owner 2026-11-05)
 * ============================================================================
 * Owner: "make sure the application fully match academy format - for sidebars,
 * for profile bullets number etc...". The format of record is the house margin
 * package (housestyle_pdf_generator/course_cvs_2026-10-01/pkgs_1051.py EN,
 * pkgs_1050.py DA, gen_margin.py) and the rules in
 * docs/personas/gabriel/CONTENT_RULES_2026-09-27.md (REVIEW-VEO-001,
 * VALUE-FOR-ROLE-001, RUGBY-ROW-001, COMMS-LINE-002, 2-page budget).
 *
 * Audit of saved application #3491 (Kaleido, margin, da) against 1051: 9 roles
 * with 4+ bullets, bullets of 3-5 lines, English Results / labels / table header
 * in a Danish CV, 12 tools rows, 10 certificates, English-first languages,
 * 6 interest rows, publications + regulatory + outcomes blocks, 5 pages.
 *
 * This file is PURE (no storage, no DOM, no events): it never writes `sections`,
 * so it cannot start a belt storm (SECTIONS-STORM-OWNED-KEYS-001). Two entry points:
 *   audit(sections, opts) -> { ok, issues: [{ code, where, detail }] }
 *   apply(sections, opts) -> { sections, changes: [string] }   (new arrays; input untouched)
 * apply() is called by antcv-docx-client.js buildPayload for a CV in the margin
 * layout (the default), after sanitizeForExport, so the DOCX and the PDF both get
 * the academy shape. Index-keyed payload maps (row_pages, hidden maps, item pages)
 * stay valid: rows are HIDDEN (hidden:true / on:false), never spliced out, and the
 * Earlier career entry is appended after the last role.
 *
 * What apply() does (margin CV):
 *   experience  at most 6 detailed roles, newest first; university research /
 *               teaching roles (non-research JD) and the oldest roles beyond 6
 *               fold into ONE "Earlier career" entry (id earlier-career, the id
 *               gen-runner and the docx client already know). Stored facts stay as
 *               stored: no role is merged or retitled (STORED-FACTS-001).
 *               At most 3 bullets per role, the ones that fit two lines first
 *               (stored order kept); a Results line over two lines keeps its first
 *               complete clause.
 *   sidebar     proof points <= 5, tools <= 4 rows (no group header rows, <= 6 items
 *               per row, one row per group first, JD hits first), certificates <= 4
 *               (JD hits, recent courses, no language tests, rugby/coaching last
 *               unless a sports JD), languages Danish first (house LANGS_ROW),
 *               interests = the volunteer row + ONE strip, regulatory only the rows
 *               the JD names, a Patent row from the publications line.
 *   main        outcomes block, publications and the additional-info block are not
 *               in the house CV (research JDs keep publications + additional).
 *   language    fixed English labels in a da/es CV are translated (Work style lead,
 *               the core-competencies header pair, language names and levels).
 * audit() reports the same counts plus what apply() cannot fix by itself: a profile
 * that never names the company (stale or generic translation), text in the wrong
 * language (Results, proof points, tools rows), bullets over two lines.
 * Kill switch (export): localStorage antcv:disable-academy-format = '1'.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.6305-links';

  // Mirror of pwa/gold-rules.json academy_format (test: academy-format.test.mjs).
  var RULES = {
    max_roles: 6,
    role_bullets_max: 3,
    bullet_max_chars: 145,     // main column ~75 chars a line: one line <= 70, two full lines 125-145
    results_max_chars: 150,
    proof_points: 5,
    tools_rows: 4,
    tool_items_max: 6,
    certs_max: 4,
    interests_rows: 2,
    languages_first: ['danish', 'english', 'spanish', 'hebrew'],
  };

  // ── language detection ──────────────────────────────────────────────────────
  // Function words only (words both languages share — for, i, en, under, over — are
  // left out). A text needs two hits and a one-hit lead to get a verdict; short
  // captions ("10x", "simplifying reporting") return '' (unknown), never a guess.
  var STOP = {
    en: ['the', 'and', 'of', 'to', 'with', 'from', 'by', 'on', 'a', 'an', 'as', 'at', 'into', 'across', 'that', 'which', 'is', 'are', 'was', 'were', 'this', 'their', 'its', 'through', 'per', 'within', 'while', 'about', 'roughly', 'after', 'before', 'who', 'our', 'your', 'my'],
    da: ['og', 'af', 'til', 'med', 'på', 'er', 'et', 'det', 'der', 'som', 'fra', 'ved', 'om', 'efter', 'gennem', 'mellem', 'hos', 'samt', 'blev', 'har', 'var', 'sine', 'deres', 'ikke', 'ca', 'jeg', 'mit', 'min', 'mine', 'vores', 'jeres', 'hvor', 'når', 'også', 'eller', 'inden', 'uden', 'både'],
    es: ['y', 'de', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'un', 'una', 'del', 'al', 'que', 'se', 'su', 'sus', 'como', 'entre', 'sobre', 'desde', 'hasta', 'mi', 'mis', 'muy', 'más'],
  };
  var STOPSET = {};
  Object.keys(STOP).forEach(function (l) { STOPSET[l] = {}; STOP[l].forEach(function (w) { STOPSET[l][w] = 1; }); });
  function langOf(text) {
    var s = String(text == null ? '' : text).toLowerCase();
    var words = s.match(/[a-zà-ÿæøåñ]+/g) || [];
    var sc = { en: 0, da: 0, es: 0 };
    words.forEach(function (w) { for (var l in sc) if (STOPSET[l][w]) sc[l]++; });
    sc.da += Math.min(3, (s.match(/[æøå]/g) || []).length);
    sc.es += Math.min(3, (s.match(/[ñáíóú¿¡]/g) || []).length);
    var order = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; });
    var top = order[0];
    if (sc[top] < 2 || sc[top] - sc[order[1]] < 1) return '';
    return top;
  }
  // English CV verbs and words no Danish or Spanish sentence uses; they only count for the
  // one-sided test below ("Run hybrid delivery in Jira: stage gates for hardware, sprints for
  // software." has no function word from the list above, #3491 innoviz-ccr Results).
  var EN_MARK = /\b(?:in|run|ran|lead|led|built|build|cut|drove|drive|owned|own|managed|manage|delivered|deliver|designed|design|developed|develop|established|coordinated|directed|supported|defined|created|reduced|improved|launched|shipped|wrote|qualified|hired|chaired|set up|for the|of the)\b/gi;
  // true when the text is detectably in another language than `lang`. For a da/es CV a sentence of
  // five or more words with no trace of that language and an English marker is English too.
  function wrongLang(text, lang) {
    var l = langOf(text);
    if (l) return !!(lang && l !== lang);
    if (lang !== 'da' && lang !== 'es') return false;
    var s = String(text == null ? '' : text).toLowerCase();
    var words = s.match(/[a-zà-ÿæøåñ]+/g) || [];
    if (words.length < 5) return false;
    var own = 0;
    words.forEach(function (w) { if (STOPSET[lang][w]) own++; });
    own += lang === 'da' ? (s.match(/[æøå]/g) || []).length : (s.match(/[ñáíóú¿¡]/g) || []).length;
    if (own) return false;
    var en = (s.match(EN_MARK) || []).length;
    words.forEach(function (w) { if (STOPSET.en[w]) en++; });
    return en >= 1;
  }

  // ── fixed labels ────────────────────────────────────────────────────────────
  var L = {
    en: { work_style: 'Work style', earlier: 'Earlier career', patent: 'Patent', rugby: 'Foreningsarbejde', needs: ['The role needs', 'What I bring, with proof'] },
    da: { work_style: 'Arbejdsstil', earlier: 'Tidligere karriere', patent: 'Patent', rugby: 'Foreningsarbejde', needs: ['Rollen kræver', 'Det bringer jeg, med belæg'] },
    es: { work_style: 'Estilo de trabajo', earlier: 'Trayectoria inicial', patent: 'Patente', rugby: 'Foreningsarbejde', needs: ['Lo que exige el puesto', 'Lo que aporto, con pruebas'] },
  };
  function labels(lang) { return L[lang] || L.en; }
  var LANG_NAMES = {
    danish: { en: 'Danish', da: 'Dansk', es: 'Danés', match: /^(danish|dansk|danés|danes|דנית)\b/i },
    english: { en: 'English', da: 'Engelsk', es: 'Inglés', match: /^(english|engelsk|inglés|ingles|אנגלית)\b/i },
    spanish: { en: 'Spanish', da: 'Spansk', es: 'Español', match: /^(spanish|spansk|español|espanol|castellano|ספרדית)\b/i },
    hebrew: { en: 'Hebrew', da: 'Hebraisk', es: 'Hebreo', match: /^(hebrew|hebraisk|hebreo|עברית)\b/i },
  };
  var LEVELS = [
    [/\bupper[- ]intermediate\b/gi, { da: 'øvre mellemniveau', es: 'intermedio alto' }],
    [/\bnative\b/gi, { da: 'modersmål', es: 'nativo' }],
    [/\bmother tongue\b/gi, { da: 'modersmål', es: 'lengua materna' }],
    [/\bfluent\b/gi, { da: 'flydende', es: 'fluido' }],
    [/\bfull professional\b/gi, { da: 'professionelt', es: 'profesional' }],
    [/\bprofessional\b/gi, { da: 'professionelt', es: 'profesional' }],
    [/\bintermediate\b/gi, { da: 'mellemniveau', es: 'intermedio' }],
    [/\bconversational\b/gi, { da: 'samtaleniveau', es: 'conversacional' }],
    [/\bbasic\b/gi, { da: 'grundlæggende', es: 'básico' }],
    [/\bongoing\b/gi, { da: 'i gang', es: 'en curso' }],
  ];

  // ── persona wording (RUGBY-ROW-001 / interests strip, owner 2026-11-03) ─────
  // House text from gen_linear3.py RUGBY_ROW / INTERESTS_ROW (+ _DA). Name-guarded,
  // like the COMMS line in antcv-profile-access-scrub.js.
  var GABRIEL = {
    rugby: {
      en: 'Rugby team Operations Manager & Coaching Assistant, Copenhagen Wolves RFC (Pan Idræt): plays, runs team operations and assists the coaches; World Rugby Level 1 coaching course completed.',
      da: 'Rugby team Operations Manager & trænerassistent, Copenhagen Wolves RFC (Pan Idræt): spiller på holdet, står for holdets drift og assisterer trænerne ved træning; World Rugby Level 1-trænerkursus gennemført.',
    },
    strip: {
      en: 'Tai-chi (calm under pressure) · hiking (outdoor reset) · cultural exchange (languages, food, board games) · home supervision of three feline napping experts',
      da: 'Tai-chi (stabilitet og ro under pres) · vandreture (restitution i det fri) · kulturudveksling (sprog, mad, brætspil) · hjemmeopsyn med tre strategisk sovende katte',
    },
  };
  function isGabriel(name) { return /\bgabriel\b/i.test(String(name || '')) && /\bkarp\b/i.test(String(name || '')); }

  // ── helpers ─────────────────────────────────────────────────────────────────
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function txt(it) {
    if (typeof it === 'string') return it;
    if (!it || typeof it !== 'object') return '';
    return [it.b, it.t, it.l, it.v, it.deg, it.sch].filter(function (p) { return typeof p === 'string' && p.trim(); }).join(' ');
  }
  function bulletText(b) { return typeof b === 'string' ? b : [b && b.b, b && b.t].filter(Boolean).join(' '); }
  function yearsOf(y) { return (String(y || '').match(/\b(19|20)\d{2}\b/g) || []).map(Number); }
  function endYear(r, nowYear) {
    var y = String((r && r.years) || '');
    if (r && r.isCurrent || /present|nu\b|now|actual|今/i.test(y)) return nowYear || 9999;
    var ys = yearsOf(y);
    return ys.length ? ys[ys.length - 1] : 0;
  }
  function startYear(r) { var ys = yearsOf(r && r.years); return ys.length ? ys[0] : 0; }
  function sid(s) { return String((s && s.id) || '').toLowerCase(); }
  function isSec(s, re) { return !!s && (re.test(sid(s)) || re.test(String(s.title || '').toLowerCase())); }
  function visibleItems(s) {
    var out = [];
    (s.items || []).forEach(function (it, i) {
      if (!it || (s.hidden && s.hidden[i]) || (it && typeof it === 'object' && (it.hidden === true || it.on === false))) return;
      out.push(i);
    });
    return out;
  }
  function isGrp(it) { return !!(it && typeof it === 'object' && (it.grp || it.group !== undefined || it.subhead !== undefined)); }
  function jdWords(jd) {
    var set = {};
    (String(jd || '').toLowerCase().match(/[a-zà-ÿæøå0-9][a-zà-ÿæøå0-9+#./-]{2,}/g) || []).forEach(function (w) { set[w] = 1; if (w.length >= 5) set['~' + w.slice(0, 4)] = 1; });
    return set;
  }
  function jdScore(text, jw) {
    var n = 0, seen = {};
    (String(text || '').toLowerCase().match(/[a-zà-ÿæøå0-9][a-zà-ÿæøå0-9+#./-]{2,}/g) || []).forEach(function (w) {
      if (seen[w]) return; seen[w] = 1;
      if (jw[w]) n += 2; else if (w.length >= 5 && jw['~' + w.slice(0, 4)]) n += 1;
    });
    return n;
  }
  function balanceParens(t) {
    var s = String(t), o = (s.match(/\(/g) || []).length, c = (s.match(/\)/g) || []).length;
    while (c > o && /\)\s*$/.test(s)) { s = s.replace(/\)\s*$/, ''); c--; }
    if (o > c) s = s.replace(/\s*\(([^()]*)$/, function (m, inner) { return inner.trim() ? ' (' + inner.trim() + ')' : ''; });
    return s;
  }
  var ACADEMIC_TITLE = /research|teaching|r\s*&\s*d\s+assist|assistant|assistent|videnskabelig|forsknings|undervisning|ayudante|investigador|docente|postdoc|ph\.?\s?d|doktorand|助教|研究助理/i;
  var ACADEMIC_ORG = /universit|technion|institute of technology|college|\bTAU\b|\bDTU\b|\bKU\b|hogeschool|högskola|universidad|大学/i;
  function isAcademic(r) { return ACADEMIC_TITLE.test(String(r.title || '')) && ACADEMIC_ORG.test(String(r.company || '')); }
  // A research JOB, not a JD that names a degree ("MSc or PhD in optics", #3491 Kaleido): the target
  // title says research, or the ad carries two different research cues.
  var RESEARCH_CUE = /\b(research\w*|phd|ph\.d|postdoc\w*|scientist\w*|academ\w*|professor\w*|lecturer\w*|peer[- ]review\w*|publication\w*|forsker\w*|videnskab\w*|investigaci\w*)\b/gi;
  var RESEARCH_ROLE = /\b(?:research\w*|scientist|postdoc\w*|ph\.?d|professor|lecturer|forsker\w*|investigador\w*)\b/i;
  function isResearch(jd, role) {
    if (RESEARCH_ROLE.test(String(role || ''))) return true;
    var seen = {};
    (String(jd || '').match(RESEARCH_CUE) || []).forEach(function (w) { seen[w.toLowerCase().replace(/\W/g, '').slice(0, 7)] = 1; });
    return Object.keys(seen).length >= 2;
  }
  var SPORTS_JD = /\b(?:sport\w*|rugby|coach\w*|athlet\w*|club|klub|træner\w*|idræt\w*|football|golf)\b/i;

  // ── experience ──────────────────────────────────────────────────────────────
  // A bullet over two lines keeps its first complete sentence, else its first "; " clause, when
  // that part alone fits (cut, never extend: no new words). Otherwise it stays as it is (audited).
  function shorten(text, cap) {
    var s = String(text || '').trim();
    if (s.length <= cap) return s;
    var sent = s.split(/(?<=[.!?])\s+(?=[A-ZÆØÅÀ-Ý])/);
    if (sent.length > 1 && sent[0].length >= 50 && sent[0].length <= cap) return sent[0];
    var cl = s.split(/;\s+/);
    if (cl.length > 1 && cl[0].length >= 50 && cl[0].length < cap) return cl[0].replace(/[,:\s]+$/, '') + '.';
    return s;
  }
  function shortenBullet(b, cap) {
    if (typeof b === 'string') return shorten(b, cap);
    if (b && typeof b === 'object' && typeof b.t === 'string' && bulletText(b).length > cap) {
      var room = cap - String(b.b || '').length - 1;
      return room > 50 ? Object.assign({}, b, { t: shorten(b.t, room) }) : b;
    }
    return b;
  }
  // ROLE-BODY-NOTE-001 in a translated CV: the old English-only note left "Internship: " on a
  // Danish role (next to a bullet that already opened "Praktik:"). Localise it, or drop the
  // duplicate.
  var INTERN = { da: ['Praktik', ' (praktik)'], es: ['Prácticas', ' (prácticas)'] };
  function localiseIntern(bullets, lang) {
    var loc = INTERN[lang];
    if (!loc || !Array.isArray(bullets)) return bullets;
    var said = bullets.some(function (b) { return new RegExp('^\\s*' + loc[0] + '\\s*:', 'i').test(bulletText(b)); });
    return bullets.map(function (b) {
      if (typeof b !== 'string') return b;
      if (/^Internship:\s+/.test(b)) return said ? b.replace(/^Internship:\s+/, '').replace(/^./, function (c) { return c.toUpperCase(); }) : b.replace(/^Internship:\s+/, loc[0] + ': ');
      return b.replace(/^([^:.]{2,48}) \(internship\):/, '$1' + loc[1] + ':');
    });
  }
  function pickBullets(bullets, max, cap, prefer) {
    var src = Array.isArray(bullets) ? bullets : [];
    var arr = src.map(function (b) { return shortenBullet(b, cap); });
    var shortened = arr.filter(function (b, i) { return b !== src[i]; }).length;
    // up to `max` bullets that fit two lines; a longer one only fills a role up to TWO bullets
    // (1051 roles carry 1-3 bullets; three is the ceiling, not the target)
    var keep = {}, n = 0, floor = Math.min(2, max);
    // AI-REPO-LINK-001: on an AI-oriented job the bullet that names AntCV is kept first
    if (prefer) arr.forEach(function (b, i) { if (n < max && prefer.test(bulletText(b))) { keep[i] = 1; n++; } });
    arr.forEach(function (b, i) { if (n < max && !keep[i] && bulletText(b).trim() && bulletText(b).length <= cap) { keep[i] = 1; n++; } });
    arr.forEach(function (b, i) { if (n < floor && !keep[i] && bulletText(b).trim()) { keep[i] = 1; n++; } });
    var kept = arr.filter(function (_, i) { return keep[i]; });
    return { kept: kept, cut: arr.length - kept.length, shortened: shortened };
  }
  // A Results line over two lines keeps ONE of its sentences or "; " clauses: the first that carries
  // a number (the change metric, RESULTS gold rule), else the first. Cut only, never reworded.
  function trimResults(res, cap) {
    var s = String(res || '').trim();
    if (s.length <= cap) return s;
    var parts = s.split(/(?<=[.!?])\s+(?=[A-ZÆØÅÀ-Ý])|;\s+/).map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length >= 40 && p.length <= cap; });
    if (!parts.length) return s;
    var pick = parts.filter(function (p) { return /\d/.test(p); })[0] || parts[0];
    pick = pick.replace(/[,;:\s]+$/, '');
    return /[.!?]$/.test(pick) ? pick : pick + '.';
  }
  function earlierEntry(pool, lang, nowYear) {
    // one line per employer, newest first: "Title / Title, Company (start - end)"
    var groups = [], byCo = {};
    pool.slice().sort(function (a, b) { return endYear(b, nowYear) - endYear(a, nowYear); }).forEach(function (r) {
      var k = String(r.company || '').toLowerCase().replace(/[^a-z0-9æøå]+/g, ' ').trim() || ('#' + groups.length);
      if (!byCo[k]) { byCo[k] = { company: String(r.company || '').trim(), roles: [] }; groups.push(byCo[k]); }
      byCo[k].roles.push(r);
    });
    var starts = [], ends = [];
    var bullets = groups.map(function (g) {
      var titles = [];
      g.roles.forEach(function (r) { var t = String(r.title || '').trim(); if (t && titles.indexOf(t) < 0) titles.push(t); });
      var s = Math.min.apply(null, g.roles.map(startYear).filter(Boolean).concat([9999]));
      var e = Math.max.apply(null, g.roles.map(function (r) { return endYear(r, nowYear); }));
      if (s < 9999) starts.push(s); if (e) ends.push(e);
      var span = s < 9999 && e ? (s === e ? String(s) : s + ' - ' + e) : String((g.roles[0] && g.roles[0].years) || '');
      return titles.join(' / ') + (g.company ? ', ' + g.company : '') + (span ? ' (' + span + ')' : '');
    });
    var lo = starts.length ? Math.min.apply(null, starts) : 0, hi = ends.length ? Math.max.apply(null, ends) : 0;
    return {
      id: 'earlier-career', title: labels(lang).earlier, company: '', location: '',
      years: lo && hi ? (lo === hi ? String(lo) : lo + ' - ' + hi) : '',
      isCurrent: false, on: true, bullets: bullets,
      __covers: pool.map(function (r) { return r.id; }).filter(function (x) { return x != null; }),
    };
  }
  function applyExperience(s, o, changes) {
    if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
    var roles = s.roles.map(function (r) { return r && typeof r === 'object' ? Object.assign({}, r) : r; });
    var vis = [];
    roles.forEach(function (r, i) { if (r && r.on !== false && String(r.id || '') !== 'earlier-career') vis.push(i); });
    var hasEc = roles.some(function (r) { return r && r.on !== false && String(r.id || '') === 'earlier-career'; });
    var pool = [];
    var detailed = vis.slice();
    if (!o.research) {
      detailed = detailed.filter(function (i) {
        var r = roles[i];
        if (isAcademic(r) && !(r.isCurrent || endYear(r, o.nowYear) >= (o.nowYear || 9999))) { pool.push(i); return false; }
        return true;
      });
    }
    var cap = RULES.max_roles;
    if (detailed.length > cap) {
      // oldest first; for a research JD the university roles are the last to fold
      var keepFirst = function (i) { return o.research && isAcademic(roles[i]) ? 1 : 0; };
      var byAge = detailed.slice().sort(function (a, b) { return (keepFirst(a) - keepFirst(b)) || (endYear(roles[a], o.nowYear) - endYear(roles[b], o.nowYear)) || (b - a); });
      var drop = byAge.slice(0, detailed.length - cap);
      detailed = detailed.filter(function (i) { return drop.indexOf(i) < 0; });
      pool = pool.concat(drop);
    }
    if (pool.length) {
      var ec = earlierEntry(pool.map(function (i) { return roles[i]; }), o.lang, o.nowYear);
      pool.forEach(function (i) { roles[i] = Object.assign({}, roles[i], { on: false }); });
      if (hasEc) {
        // an Earlier career entry is already there (gen-runner): add the folded lines to it
        roles = roles.map(function (r) {
          if (!r || String(r.id || '') !== 'earlier-career' || r.on === false) return r;
          return Object.assign({}, r, { bullets: (r.bullets || []).concat(ec.bullets), __covers: (r.__covers || []).concat(ec.__covers) });
        });
      } else roles.push(ec);
      changes.push('experience: ' + pool.length + ' role(s) folded into ' + ec.title);
    }
    detailed.forEach(function (i) {
      var r = roles[i];
      var li = localiseIntern(r.bullets, o.lang);
      if (li !== r.bullets && JSON.stringify(li) !== JSON.stringify(r.bullets)) { r.bullets = li; changes.push('role ' + (r.id || i) + ': internship note localised'); }
      var pb = pickBullets(r.bullets, RULES.role_bullets_max, RULES.bullet_max_chars, o.ai ? ANTCV_WORD : null);
      if (pb.cut || pb.shortened) {
        r.bullets = pb.kept;
        changes.push('role ' + (r.id || i) + ': ' + (pb.cut ? pb.cut + ' bullet(s) cut' : '') + (pb.cut && pb.shortened ? ', ' : '') + (pb.shortened ? pb.shortened + ' shortened to a sentence or clause' : ''));
      }
      // a Results line derived from the noted first bullet keeps no internship label (the body says it)
      if (typeof r.results === 'string' && /^(?:Internship|Praktik|Prácticas):\s+/.test(r.results)) {
        r.results = r.results.replace(/^(?:Internship|Praktik|Prácticas):\s+/, '').replace(/^./, function (c) { return c.toUpperCase(); });
        changes.push('role ' + (r.id || i) + ': internship label off the Results line');
      }
      if (typeof r.results === 'string' && r.results.length > RULES.results_max_chars) {
        var t = trimResults(r.results, RULES.results_max_chars);
        if (t !== r.results) { r.results = t; changes.push('role ' + (r.id || i) + ': Results kept to its first clause'); }
      }
    });
    return Object.assign({}, s, { roles: roles });
  }

  // ── sidebar blocks ──────────────────────────────────────────────────────────
  // Rows leave through the section's own index map (s.hidden[i], the eye-toggle shape every
  // payload case forwards and the worker honours); normalizeSections drops per-item flags.
  function hideItems(s, keepIdx, why, changes) {
    var vis = visibleItems(s), n = 0;
    var hidden = Object.assign({}, (s.hidden && typeof s.hidden === 'object') ? s.hidden : {});
    vis.forEach(function (i) { if (keepIdx.indexOf(i) < 0) { hidden[i] = true; n++; } });
    if (!n) return s;
    changes.push(why + ': ' + n + ' row(s) hidden');
    return Object.assign({}, s, { hidden: hidden });
  }
  function capProof(s, changes) {
    var vis = visibleItems(s).filter(function (i) { return !isGrp(s.items[i]); });
    if (vis.length <= RULES.proof_points) return s;
    return hideItems(s, vis.slice(0, RULES.proof_points), 'proof points', changes);
  }
  function capTools(s, o, changes) {
    var vis = visibleItems(s);
    var grpOf = {}, g = -1, rows = [];
    vis.forEach(function (i) { var it = s.items[i]; if (isGrp(it)) { g = i; return; } grpOf[i] = g; rows.push(i); });
    var hasGrp = vis.some(function (i) { return isGrp(s.items[i]); });
    if (rows.length <= RULES.tools_rows && !hasGrp && rows.every(function (i) { return toolCount(s.items[i]) <= RULES.tool_items_max; })) return s;
    // rows in the CV language first: an English JD must not pull English rows into a Danish CV
    var rowScore = function (i) { return jdScore(txt(s.items[i]), o.jw) - (o.lang !== 'en' && wrongLang(txt(s.items[i]), o.lang) ? 1000 : 0); };
    var ranked = rows.slice().sort(function (a, b) { return (rowScore(b) - rowScore(a)) || (a - b); });
    var pick = [], seenG = {};
    ranked.forEach(function (i) { if (pick.length < RULES.tools_rows && !seenG[grpOf[i]]) { seenG[grpOf[i]] = 1; pick.push(i); } });
    ranked.forEach(function (i) { if (pick.length < RULES.tools_rows && pick.indexOf(i) < 0) pick.push(i); });
    var out = hideItems(s, pick, 'tools', changes);
    var cut = 0;
    var items = out.items.map(function (it, i) {
      if (pick.indexOf(i) < 0 || !it || typeof it !== 'object') return it;
      var key = typeof it.t === 'string' ? 't' : (typeof it.v === 'string' ? 'v' : null);
      if (!key) return it;
      var toks = it[key].split(/\s*,\s*/).filter(Boolean);
      if (toks.length <= RULES.tool_items_max) return it;
      var order = toks.map(function (t, k) { return [jdScore(t, o.jw), k]; }).sort(function (a, b) { return (b[0] - a[0]) || (a[1] - b[1]); }).slice(0, RULES.tool_items_max).map(function (p) { return p[1]; }).sort(function (a, b) { return a - b; });
      cut++;
      var v = {}; v[key] = balanceParens(order.map(function (k) { return toks[k]; }).join(', '));
      return Object.assign({}, it, v);
    });
    if (cut) changes.push('tools: ' + cut + ' row(s) shortened to ' + RULES.tool_items_max + ' items');
    return Object.assign({}, out, { items: items });
  }
  function toolCount(it) { var v = it && (typeof it.t === 'string' ? it.t : it.v); return String(v || '').split(/\s*,\s*/).filter(Boolean).length; }
  var LANG_TEST = /prøve i dansk|danskuddannelse|\bFVU\b|studieskolen|\bPD[23]\b|\bIELTS\b|\bTOEFL\b|\bDELE\b|language test|sprogprøve/i;
  var RUGBY_CERT = /rugby|coaching|concussion|hjernerystelse|træner|first aid|førstehjælp/i;
  function capCerts(s, o, changes) {
    var vis = visibleItems(s).filter(function (i) { return !isGrp(s.items[i]); });
    var items = s.items.slice(), stripped = 0;
    // CERTS strip_years (gold-rules certs): "(Improve Business Academy, 2026)" -> "(Improve Business Academy)"
    vis.forEach(function (i) {
      var it = items[i], key = it && typeof it === 'object' ? (typeof it.t === 'string' && it.t.trim() ? 't' : (typeof it.v === 'string' ? 'v' : null)) : null;
      var cur = key ? it[key] : (typeof it === 'string' ? it : null);
      if (cur == null) return;
      if (/babok/i.test(cur)) return;   // BA-EDU-001 keeps "University of Toronto, 2020"
      var nv = cur.replace(/,\s*(?:19|20)\d{2}\s*\)/g, ')').replace(/\s*\((?:19|20)\d{2}\)/g, '').replace(/\s+(?:19|20)\d{2}\s*$/, '');
      if (nv !== cur) { stripped++; if (key) { var p = {}; p[key] = nv; items[i] = Object.assign({}, it, p); } else items[i] = nv; }
    });
    var out = stripped ? Object.assign({}, s, { items: items }) : s;
    if (stripped) changes.push('certificates: years stripped from ' + stripped);
    if (vis.length <= RULES.certs_max) return out;
    var babokJd = /program|requirement|architect|business analy|krav|forretningsanaly/i.test(o.jd || '');
    var score = function (i) {
      var t = txt(out.items[i]);
      if (LANG_TEST.test(t)) return -100;
      var sc = jdScore(t, o.jw) * 10;
      if (RUGBY_CERT.test(t) && !o.sports) sc -= 50;
      var ys = yearsOf(txt(s.items[i]));
      if (ys.length && o.nowYear && ys[ys.length - 1] >= o.nowYear - 1) sc += 15;   // a current course (Improve Academy, 2026)
      if (/babok/i.test(t) && babokJd) sc += 15;
      return sc;
    };
    var pick = vis.slice().sort(function (a, b) { return (score(b) - score(a)) || (a - b); }).slice(0, RULES.certs_max);
    return hideItems(out, pick, 'certificates', changes);
  }
  function langKey(it) {
    var name = String((it && (it.l || it.label || it.b)) || (typeof it === 'string' ? it : '')).trim();
    for (var k in LANG_NAMES) if (LANG_NAMES[k].match.test(name)) return k;
    return '';
  }
  function fixLanguages(s, o, changes) {
    if (!Array.isArray(s.items) || s.items.some(isGrp)) return s;
    var order = RULES.languages_first;
    var idx = s.items.map(function (it, i) { var k = langKey(it), r = order.indexOf(k); return [r < 0 ? 99 : r, i, it]; });
    idx.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var moved = idx.some(function (e, i) { return e[1] !== i; });
    var items = idx.map(function (e) { return e[2]; });
    var renamed = 0;
    if (o.lang === 'da' || o.lang === 'es') {
      items = items.map(function (it) {
        if (!it || typeof it !== 'object') return it;
        var k = langKey(it), n = Object.assign({}, it), hit = false;
        var lk = typeof it.l === 'string' ? 'l' : (typeof it.b === 'string' ? 'b' : null);
        var vk = typeof it.v === 'string' ? 'v' : (typeof it.t === 'string' ? 't' : null);
        if (k && lk && it[lk] !== LANG_NAMES[k][o.lang] && /^[A-Za-z]+$/.test(String(it[lk]).trim()) && String(it[lk]).trim() === LANG_NAMES[k].en) { n[lk] = LANG_NAMES[k][o.lang]; hit = true; }
        if (vk) {
          var v = String(it[vk]);
          LEVELS.forEach(function (p) { v = v.replace(p[0], p[1][o.lang]); });
          if (v !== it[vk]) { n[vk] = v; hit = true; }
        }
        if (hit) renamed++;
        return hit ? n : it;
      });
    }
    if (!moved && !renamed) return s;
    if (moved) changes.push('languages: ' + LANG_NAMES[order[0]].en + ' first');
    if (renamed) changes.push('languages: ' + renamed + ' row(s) translated to ' + o.lang);
    return Object.assign({}, s, { items: items });
  }
  var VOLUNTEER = /forening|volunteer|frivillig|rugby|club|klub|coach|træner|scout|board member|bestyrelse/i;
  function fixInterests(s, o, changes) {
    var vis = visibleItems(s).filter(function (i) { return !isGrp(s.items[i]); });
    if (vis.length <= RULES.interests_rows) return s;
    var vol = vis.filter(function (i) { return VOLUNTEER.test(txt(s.items[i])); })[0];
    var rest = vis.filter(function (i) { return i !== vol; });
    var house = isGabriel(o.name) && GABRIEL.strip[o.lang];
    var strip = house ? GABRIEL.strip[o.lang] : rest.slice(0, 4).map(function (i) {
      var it = s.items[i], b = String((it && (it.b || it.l)) || '').trim(), t = String((it && (it.t || it.v)) || '').trim();
      if (!b) return t;
      return t && t.length <= 40 ? b + ' (' + t.charAt(0).toLowerCase() + t.slice(1).replace(/[.\s]+$/, '') + ')' : b;
    }).filter(Boolean).join(' · ');
    var items = s.items.slice();
    var slots = [];
    if (vol != null) {
      var rv = items[vol];
      var rugby = isGabriel(o.name) && GABRIEL.rugby[o.lang];
      items[vol] = rugby ? Object.assign({}, rv, { b: labels(o.lang).rugby, t: rugby }) : rv;
      slots.push(vol);
    }
    var at = rest[0];
    if (at != null) { items[at] = Object.assign({}, items[at], { b: '', t: strip }); slots.push(at); }
    var out = hideItems(Object.assign({}, s, { items: items }), slots, 'interests', changes);
    changes.push('interests: ' + (vol != null ? 'volunteer row + ' : '') + 'one strip');
    return out;
  }
  function fixRegulatory(s, o, changes) {
    var vis = visibleItems(s);
    var named = vis.filter(function (i) {
      var it = s.items[i];
      if (isGrp(it)) return false;
      var code = String((it && (it.b || it.l)) || '').trim();
      return code.length >= 3 && String(o.jd || '').toLowerCase().indexOf(code.toLowerCase()) >= 0;
    });
    if (!named.length) { changes.push('regulatory: not named by the JD, hidden'); return Object.assign({}, s, { on: false }); }
    return hideItems(s, named.slice(0, 4), 'regulatory', changes);
  }
  function patentSection(src, lang) {
    var pubs = (src || []).filter(function (s) { return isSec(s, /pub|patent/); });
    for (var a = 0; a < pubs.length; a++) {
      var items = pubs[a].items || [];
      for (var b = 0; b < items.length; b++) {
        var t = txt(items[b]);
        if (/patent/i.test(t)) return { id: 'patent', type: 'rich_block', loc: 'sidebar', on: true, title: labels(lang).patent, items: [{ b: '', t: t.trim(), bullets: [] }], bullets: [] };
      }
    }
    return null;
  }

  // ── real content only (ACADEMY-EMPTY-001, owner 2026-11-06) ─────────────────
  // Owner on a margin preview: "go to academy rule. notice that you lest sub headings empty on
  // application" - TOOLS & METHODS, CERTIFICATES and REGULATORY CONTEXT headings with no rows,
  // "[Language]: [level]" rows, the skeleton's ADDITIONAL INFORMATION instruction. The house CV has
  // no heading without real content and no template text, in the preview and the export.
  var MD_LINK = /\[[^\]\n]{1,200}\]\((?:https?:|mailto:)[^)\s]*\)/g;
  var BENIGN = /^\s*(verify|sic|x|\d{1,3}|…|\.\.\.)\s*$/i;
  var INSTRUCTION = /(NO-JD RULE|\bEVIDENCE:\s|ADAPT-WITH-THE-TEAM|ONLY when candidate-confirmed|Identity tied to the role|Write in the target language|Real proof points only|Never invent a number|Use Company Info|Employer priority \d|Focus area \d|Strategic expertise -|Add only items that support the JD|Drop if not needed|short label\b)/i;
  function isPlaceholder(text) {
    var t = String(text == null ? '' : text).replace(MD_LINK, ' ');
    var m, re = /\[([^\[\]]{1,600})\]/g;
    while ((m = re.exec(t))) { if (!BENIGN.test(m[1])) return true; }
    return INSTRUCTION.test(t);
  }
  function rowText(it) {
    if (typeof it === 'string') return it;
    if (!it || typeof it !== 'object') return '';
    return [it.bOff ? '' : it.b, it.tOff ? '' : it.t, it.l, it.v, it.value, it.deg, it.sch, it.text, it.citation]
      .filter(function (p) { return typeof p === 'string' && p.trim(); }).join(' ');
  }
  function rowReal(it) {
    if (isGrp(it)) return false;
    var t = rowText(it).trim();
    return !!t && !isPlaceholder(t);
  }
  function sectionReal(s) {
    if (!s || typeof s !== 'object' || s.on === false) return false;
    if (s.type === 'experience') return (s.roles || []).some(function (r) { return r && r.on !== false && (String(r.title || '').trim() || String(r.company || '').trim()) && !isPlaceholder(String(r.title || '') + ' ' + String(r.company || '')); });
    if (s.type === 'table') return (s.rows || []).slice(1).some(function (row) { return Array.isArray(row) && row.some(function (c) { return String(c || '').trim() && !isPlaceholder(c); }); });
    if (typeof s.content === 'string' && !Array.isArray(s.items)) return !!s.content.trim() && !isPlaceholder(s.content);
    if (Array.isArray(s.items)) return visibleItems(s).some(function (i) { return rowReal(s.items[i]); });
    return true;   // a type this file does not know: never hidden
  }
  // Owner facts that must never print under another person's name (persona-contamination family:
  // the owner's EDU-CANON-PIN rows and his Communication line showed in Anita Myre-Kornfeldt's CV,
  // 2026-11-06). Gabriel's own CV is never touched by this test.
  var OWNER_FACT = [
    /\bTechnion\b[\s\S]*\bTsinghua\b|\bTsinghua\b[\s\S]*\bTechnion\b/i,
    /^(?=[\s\S]*\bTel Aviv Univ)(?=[\s\S]*\b(?:VLSI|nanotechnolog\w*|Physics|EE|Electrical)\b)/i,
    /\bKVUC\b/,
    /\b(?:live captions|liveundertekster|subtítulos en directo|cochlear|hearing[- ]impaired|hørehæmmet)\b/i,
    /\bPatent (?:No\.|nr\.|n\.º)\s*241997\b|\b241997\b/i,
    /\b(?:Innoviz|Sirin Labs|Meprolight|Kanzen Konsulenter|Copenhagen Wolves)\b/i,
    /\bKarp\b/,
  ];
  function ownerFact(text) { var t = String(text || ''); return OWNER_FACT.some(function (re) { return re.test(t); }); }
  function hasComms(pi) {
    if (!pi || typeof pi !== 'object') return null;            // unknown: keep the row
    var a = pi.accessibility, c = pi.communication;
    if (typeof a === 'string' && a.trim()) return true;
    if (a && typeof a === 'object' && Object.keys(a).length) return true;
    if (c && typeof c === 'object' && Object.keys(c).filter(function (k) { return k.charAt(0) !== '_'; }).length) return true;
    if (typeof c === 'string' && c.trim()) return true;
    return false;
  }
  // COMMS-LINE-002 for the owner when a stale tab wrote the COMMS-LINE-001 sentence back.
  var COMMS_002 = { en: 'English and Danish at work; live captions and written follow-ups in meetings.', da: 'Engelsk og dansk i arbejdet; liveundertekster og skriftlig opfølgning i møder.' };
  var COMMS_001 = /follow meetings best with live captions|følger møder bedst med liveundertekster/i;
  // Rows to hide / sections to drop, by stored index. Shared by apply() (export) and plan()
  // (the margin preview, antcv-academy-preview.js).
  function contentPlan(sections, o) {
    var foreign = !!o.name && !isGabriel(o.name);
    var comms = hasComms(o.pi);
    var rows = {}, drop = {}, notes = [];
    (Array.isArray(sections) ? sections : []).forEach(function (s, si) {
      if (!s || typeof s !== 'object' || s.on === false) return;
      var id = sid(s) || ('#' + si);
      if (id === 'accessibility' && comms === false) { drop[si] = 1; notes.push('communication: ' + (foreign ? 'the person has no stored line (owner text hidden)' : 'no stored line, hidden')); return; }
      // roles are never hidden here (that would hide the CV); the audit names the fault
      if (s.type === 'experience' && foreign && (s.roles || []).some(function (r) { return r && r.on !== false && ownerFact(String(r.title || '') + ' ' + String(r.company || '')); })) {
        notes.push('experience: another person\'s roles (owner facts) in this CV, not hidden');
      }
      if (Array.isArray(s.items) && s.type !== 'experience') {
        var hide = [];
        visibleItems(s).forEach(function (i) {
          var it = s.items[i];
          if (isGrp(it)) return;
          var t = rowText(it);
          if (t.trim() && isPlaceholder(t)) { hide.push(i); notes.push(id + ': placeholder row hidden'); }
          else if (foreign && ownerFact(t)) { hide.push(i); notes.push(id + ': another person\'s row hidden (owner facts)'); }
        });
        // a group header with no real row under it goes too
        var vis = visibleItems(s), cur = null, curReal = false;
        vis.concat([-1]).forEach(function (i) {
          if (i < 0 || isGrp(s.items[i])) {
            if (cur != null && !curReal) hide.push(cur);
            cur = i < 0 ? null : i; curReal = false; return;
          }
          if (hide.indexOf(i) < 0 && rowReal(s.items[i])) curReal = true;
        });
        if (hide.length) rows[si] = hide;
      }
      var probe = rows[si] ? Object.assign({}, s, { hidden: Object.assign({}, s.hidden || {}, rows[si].reduce(function (m, i) { m[i] = true; return m; }, {})) }) : s;
      if (!sectionReal(probe)) { drop[si] = 1; notes.push(id + ': no real content, heading hidden'); }
    });
    return { rows: rows, drop: drop, notes: notes };
  }
  function applyContent(sections, o, changes) {
    var p = contentPlan(sections, o);
    var out = sections.map(function (s, si) {
      if (!s || typeof s !== 'object') return s;
      if (p.drop[si]) return Object.assign({}, s, { on: false });
      var r = s;
      if (p.rows[si]) {
        var h = Object.assign({}, s.hidden || {});
        p.rows[si].forEach(function (i) { h[i] = true; });
        r = Object.assign({}, s, { hidden: h });
      }
      if (sid(r) === 'accessibility' && isGabriel(o.name) && Array.isArray(r.items)) {
        var line = COMMS_002[o.lang] || COMMS_002.en;
        var items = r.items.map(function (it) {
          if (it && typeof it === 'object' && COMMS_001.test(String(it.v || it.t || ''))) return Object.assign({}, it, typeof it.v === 'string' ? { v: line } : { t: line });
          return it;
        });
        if (JSON.stringify(items) !== JSON.stringify(r.items)) { r = Object.assign({}, r, { items: items }); p.notes.push('communication: COMMS-LINE-002 wording'); }
      }
      return r;
    });
    p.notes.forEach(function (n) { changes.push(n); });
    return out;
  }

  // ── main-column labels ──────────────────────────────────────────────────────
  function fixWorkStyle(s, o, changes) {
    if (o.lang === 'en' || !Array.isArray(s.items)) return s;
    var want = labels(o.lang).work_style, n = 0;
    var items = s.items.map(function (it) {
      if (it && typeof it === 'object' && /^\s*work\s*style\s*:?\s*$/i.test(String(it.b || ''))) { n++; return Object.assign({}, it, { b: want }); }
      return it;
    });
    if (!n) return s;
    changes.push('work style: lead translated');
    return Object.assign({}, s, { items: items });
  }
  function fixNeedsHeader(s, o, changes) {
    if (o.lang === 'en' || !Array.isArray(s.rows) || !s.rows.length || !Array.isArray(s.rows[0]) || s.rows[0].length !== 2) return s;
    var h = s.rows[0], en = L.en.needs, want = labels(o.lang).needs;
    if (String(h[0]).trim() !== en[0] || String(h[1]).trim() !== en[1]) return s;
    changes.push('core competencies: header translated');
    return Object.assign({}, s, { rows: [want.slice()].concat(s.rows.slice(1)) });
  }

  // ── entry points ────────────────────────────────────────────────────────────
  function opts(o) {
    o = o || {};
    var lang = String(o.lang || 'en').toLowerCase().slice(0, 2);
    var jd = String(o.jdText || '');
    return {
      lang: L[lang] ? lang : (lang || 'en'), jd: jd, jw: jdWords(jd), company: String(o.company || ''),
      name: o.name || '', nowYear: o.nowYear || new Date().getFullYear(),
      research: o.research != null ? !!o.research : isResearch(jd, o.role),
      sports: SPORTS_JD.test(jd), source: o.source || null, checkResults: !!o.checkResults,
      pi: (o.personalInfo && (o.personalInfo.personalInfo || o.personalInfo)) || null,
      ai: aiOriented(jd, o.role),
    };
  }
  function apply(sections, o0) {
    var o = opts(o0), changes = [];
    if (!Array.isArray(sections)) return { sections: sections, changes: changes };
    var out = sections.map(function (s) {
      if (!s || typeof s !== 'object' || s.on === false) return s;
      if (s.type === 'experience') return applyExperience(s, o, changes);
      if (isSec(s, /^(outcomes|selected_outcomes)$/) || /selected outcomes|udvalgte resultater/i.test(String(s.title || ''))) {
        changes.push('outcomes block: hidden (Results lines carry it)'); return Object.assign({}, s, { on: false });
      }
      if (sid(s) === 'pubs' || /^publications?/i.test(sid(s))) {
        if (o.research) return s;
        changes.push('publications: hidden (non-research JD; patent kept in the sidebar)'); return Object.assign({}, s, { on: false });
      }
      if (sid(s) === 'additional') {
        if (o.research) return s;
        changes.push('additional info: hidden'); return Object.assign({}, s, { on: false });
      }
      if (sid(s) === 'work_style' || /work\s*style|arbejdsstil/i.test(String(s.title || ''))) s = fixWorkStyle(s, o, changes);
      if (s.type === 'table' && (sid(s) === 'core_comp' || sid(s) === 'bring')) return fixNeedsHeader(s, o, changes);
      if (s.loc !== 'sidebar') return s;
      if (sid(s) === 'proof_points') return capProof(s, changes);
      if (sid(s) === 'tools') return capTools(s, o, changes);
      if (sid(s) === 'certs') return capCerts(s, o, changes);
      if (sid(s) === 'languages') return fixLanguages(s, o, changes);
      if (sid(s) === 'interests') return fixInterests(s, o, changes);
      if (sid(s) === 'regulatory') return fixRegulatory(s, o, changes);
      return s;
    });
    // Patent row (house sidebar "Patent"), after education, when the CV shows none.
    if (!o.research && !out.some(function (s) { return s && s.on !== false && (sid(s) === 'patent' || (s.loc === 'sidebar' && /patent/i.test(String(s.title || '')))); })) {
      var p = patentSection(o.source || sections, o.lang);
      if (p && o.name && !isGabriel(o.name) && ownerFact(p.items[0].t)) p = null;   // never the owner's patent under another name
      if (p) {
        var at = -1;
        out.forEach(function (s, i) { if (s && s.on !== false && s.loc === 'sidebar' && sid(s) === 'education') at = i; });
        if (at < 0) out.forEach(function (s, i) { if (s && s.on !== false && s.loc === 'sidebar') at = i; });
        out.splice(at + 1, 0, p);
        changes.push('patent: sidebar row added');
      }
    }
    // ACADEMY-EMPTY-001: placeholder rows, another person's rows and headings without content go last
    out = applyContent(out, o, changes);
    if (o.ai) out = linkAntcv(out, changes);
    return { sections: out, changes: changes };
  }
  // AI-REPO-LINK-001 for every document the academy projection does not shape (the letter, the
  // band and linear CVs): link the first AntCV mention when the job is AI-oriented.
  function repoLink(sections, o0) {
    var o = opts(o0), changes = [];
    if (!o.ai) return { sections: sections, changes: changes };
    return { sections: linkAntcv(sections, changes), changes: changes };
  }

  // ── AntCV repository link on AI jobs (AI-REPO-LINK-001, owner 2026-11-08) ───
  // Owner: "make sure that if it is an AI-oriented position (like CIP) add a link to the antcv git".
  // AI-oriented = the target title names AI / ML / LLM / generative / agentic work, or the ad carries
  // three different AI terms at least five times (the stored category does not say it: Templafy's
  // "Product Manager (Agentic AI Applications)" is product_management). The first AntCV mention in a
  // bullet or text row becomes a Markdown link, which the worker renders as a real hyperlink in the
  // run's own colour. Never on other jobs. Results lines and titles are plain text in the worker, so
  // they are skipped.
  var ANTCV_URL = 'https://github.com/gabrielk83/AntCV';
  var ANTCV_WORD = /\bAntCV\b/;
  var AI_TITLE = /\b(?:AI|A\.I\.|ML|LLMs?|GenAI)\b|artificial intelligence|machine learning|generative|agentic|kunstig intelligens|inteligencia artificial/i;
  var AI_TERMS = /\b(?:AI|A\.I\.|ML|LLMs?|GenAI|NLP|RAG|artificial intelligence|machine learning|large language models?|generative|agentic|AI agents?|copilots?|prompt engineering|data science|neural networks?|kunstig intelligens|maskinlæring|inteligencia artificial)\b/gi;
  function aiOriented(jd, role) {
    if (AI_TITLE.test(String(role || ''))) return true;
    var seen = {}, total = 0;
    (String(jd || '').match(AI_TERMS) || []).forEach(function (w) { seen[w.toLowerCase().replace(/s$/, '')] = 1; total++; });
    return Object.keys(seen).length >= 3 && total >= 5;
  }
  function linkOnce(text) {
    var s = String(text);
    if (s.indexOf(ANTCV_URL) >= 0 || s.indexOf('github.com/gabrielk83/AntCV') >= 0) return null;   // already linked / spelled out
    var m = s.match(ANTCV_WORD);
    if (!m) return null;
    return s.slice(0, m.index) + '[AntCV](' + ANTCV_URL + ')' + s.slice(m.index + m[0].length);
  }
  function linkAntcv(sections, changes) {
    if (!Array.isArray(sections)) return sections;
    if (sections.some(function (s) { return s && s.on !== false && JSON.stringify(s).indexOf('github.com/gabrielk83/AntCV') >= 0; })) return sections;
    var done = false;
    var out = sections.map(function (s) {
      if (done || !s || typeof s !== 'object' || s.on === false) return s;
      if (s.type === 'experience' && Array.isArray(s.roles)) {
        var roles = s.roles.map(function (r) {
          if (done || !r || r.on === false || !Array.isArray(r.bullets)) return r;
          var bl = r.bullets.map(function (b) {
            if (done) return b;
            if (typeof b === 'string') { var t = linkOnce(b); if (t) { done = true; return t; } return b; }
            if (b && typeof b === 'object' && typeof b.t === 'string') { var u = linkOnce(b.t); if (u) { done = true; return Object.assign({}, b, { t: u }); } }
            return b;
          });
          return done ? Object.assign({}, r, { bullets: bl }) : r;
        });
        return done ? Object.assign({}, s, { roles: roles }) : s;
      }
      if (Array.isArray(s.items)) {
        var items = s.items.map(function (it, i) {
          if (done || (s.hidden && s.hidden[i])) return it;
          if (typeof it === 'string') { var t = linkOnce(it); if (t) { done = true; return t; } return it; }
          if (it && typeof it === 'object') {
            var k = typeof it.t === 'string' && ANTCV_WORD.test(it.t) ? 't' : (typeof it.v === 'string' && ANTCV_WORD.test(it.v) ? 'v' : null);
            if (k) { var v = linkOnce(it[k]); if (v) { done = true; var p = {}; p[k] = v; return Object.assign({}, it, p); } }
          }
          return it;
        });
        return done ? Object.assign({}, s, { items: items }) : s;
      }
      if (typeof s.content === 'string') { var c = linkOnce(s.content); if (c) { done = true; return Object.assign({}, s, { content: c }); } }
      return s;
    });
    if (changes) changes.push(done ? 'AntCV mention linked to the repository (AI-oriented job)' : 'AI-oriented job: no AntCV mention to link');
    return out;
  }

  // ── page-1 balance (ACADEMY-BALANCE-001, owner 2026-11-08) ──────────────────
  // Owner: "you can increas white spaces in the main bar to improve this - and this is a general
  // role - you do not want page 1 to be too coruded while page 2 is sparse". A role never splits, so
  // when the page-2 break sits before a role, page 1 ends with that role's height free (#3527: 70 pt
  // in LibreOffice, 91 pt in Word, page 2 245 pt free). balance() estimates the page-1 main column
  // in points and returns wider section / role gaps that use part of the free height; page 2 has
  // the room for the same gaps. Heights are LibreOffice-calibrated on #3527 (Word sets ~20 pt
  // tighter, so the estimate errs towards less space). measure(text, widthPx, fontPx) -> lines.
  // Geometry in points, fitted top-to-top on the LibreOffice render of #3527 (1.51.6145 export):
  // a 4-line profile + 2-line work style + 4-row table + 3 roles ended at 756.2 pt, which this model
  // reproduces from the true line counts.
  var BAL = {
    top: 15.1, bottom: 826,          // main text area on page 1 (worker margins 0, cell 12 pt)
    firstHead: 27.5,                 // first heading top -> its first content line top
    headBefore: 13.3, headBeforeTbl: 16.0, headToRole: 30.5, headToTbl: 34.4, headToText: 27.5,
    body: 14.7, bodyLine: 10.5, bodyGap: 10.2,
    bullet: 13.4, bulletLine: 10.5, bulletGap: 1.0,
    tblHeadRow: 29.7, cell: 12.2, cellLine: 10.0, rowPad: 15.7,
    roleHead: 16.3, roleWrap: 12.8, resultsGap: 9.9, roleGapAfter: 8.9,
    share: 0.6, maxGapPt: 10, minFreePt: 24,
    baseRoleGapPt: 6,                // worker default 120 DXA
  };
  // measure(text, widthPx, fontPx, spacingPt) -> line count; condense / width keys the export
  // preflight wrote (item_condense in tenths of a point per character, item_scale in %) are applied.
  function balance(payload, measure, met) {
    if (!payload || !Array.isArray(payload.sections) || typeof measure !== 'function' || !met) return null;
    var heads = 0, roles = 0, broke = false, bot = null, prev = null;
    var fit = function (s, path) {
      var c = s && s.item_condense && Number(s.item_condense[path]);
      var k = s && s.item_scale && Number(s.item_scale[path]);
      return { sp: isFinite(c) ? c / 10 : 0, k: isFinite(k) && k > 0 ? k / 100 : 1 };
    };
    var lines = function (t, w, px, s, path) {
      var f = fit(s, path);
      var n = measure(String(t || ''), w / f.k, px, f.sp / f.k);
      return n > 0 ? n : 1;
    };
    var main = payload.sections.filter(function (s) { return s && s.on !== false && s.loc !== 'sidebar'; });
    for (var i = 0; i < main.length && !broke; i++) {
      var s = main[i];
      if (s.row_pages && Object.keys(s.row_pages).length && s.type !== 'experience') return null;   // its own breaks: no estimate
      var headed = !!(s.title && !s.headlineOff);
      var top;                                   // top of this block's first content line
      if (headed) {
        var follow = s.type === 'experience' ? BAL.headToRole : s.type === 'table' ? BAL.headToTbl : BAL.headToText;
        if (bot == null) top = BAL.top + BAL.firstHead;
        else { top = bot + (prev === 'table' ? BAL.headBeforeTbl : BAL.headBefore) + follow; heads++; }
      } else {
        top = bot == null ? BAL.top : bot + BAL.bodyGap;
      }
      if (s.type === 'experience') {
        var rs = (s.roles || []).filter(function (r) { return r && r.on !== false; });
        var y = top;
        for (var j = 0; j < rs.length; j++) {
          var r = rs[j], RI = (s.roles || []).indexOf(r);
          if (Number(r.page) >= 2) { broke = true; break; }
          if (j > 0) y = bot + BAL.roleGapAfter;
          var lineText = [r.title, r.company].filter(Boolean).join(' | ') + '    ' + String(r.years || '');
          var by = y + BAL.roleHead + (lines(lineText, met.cellWpx, met.expSubPx, s, 'roles.' + RI + '.title') - 1) * BAL.roleWrap;
          var lastTop = null;
          (r.bullets || []).forEach(function (b, bi) {
            var n = lines(bulletText(b), met.bulletWpx, met.bulletPx, s, 'roles.' + RI + '.bullets.' + bi);
            bot = by + (n - 1) * BAL.bullet + BAL.bulletLine;
            lastTop = by + (n - 1) * BAL.bullet;
            by = by + n * BAL.bullet + BAL.bulletGap;
          });
          if (lastTop == null) bot = y + BAL.bulletLine;
          if (typeof r.results === 'string' && r.results.trim()) {
            var ry = bot + BAL.resultsGap;
            var nr = lines('Results: ' + r.results, met.cellWpx, met.bulletPx, s, 'roles.' + RI + '.results');
            bot = ry + (nr - 1) * BAL.bullet + BAL.bulletLine;
          }
          roles++;
        }
        prev = 'experience';
        continue;
      }
      if (s.type === 'table' && Array.isArray(s.rows)) {
        var cw = met.tableCols ? met.tableCols(s) : [met.cellWpx * 0.3, met.cellWpx * 0.7];
        var ty = top + BAL.tblHeadRow;
        s.rows.slice(1).forEach(function (row, ri) {
          var n = Math.max(lines(row[0], cw[0], met.tblCellPx, s, 'rows.' + (ri + 1) + '.0'), lines(row[1], cw[1], met.tblCellPx, s, 'rows.' + (ri + 1) + '.1'));
          bot = ty + (n - 1) * BAL.cell + BAL.cellLine;
          ty = ty + (n - 1) * BAL.cell + BAL.cellLine + BAL.rowPad;
        });
        if (s.rows.length < 2) bot = top + BAL.cellLine;
        prev = 'table';
        continue;
      }
      var py = top, any = false;
      var paras = Array.isArray(s.items)
        ? s.items.filter(function (it, k) { return !(s.hidden && s.hidden[k]) && rowText(it).trim(); }).map(function (it) { return { t: rowText(it), k: s.items.indexOf(it) }; })
        : (typeof s.content === 'string' && s.content.trim() ? [{ t: s.content, k: null }] : []);
      paras.forEach(function (p) {
        var n = lines(p.t, met.cellWpx, met.bodyPx, s, p.k == null ? 'content' : 'items.' + p.k);
        if (any) py = bot + BAL.bodyGap;
        bot = py + (n - 1) * BAL.body + BAL.bodyLine;
        any = true;
      });
      if (any) prev = 'text';
    }
    if (!broke || bot == null) return null;     // no forced page-2 break: page 1 is filled by the flow
    var free = BAL.bottom - bot;
    var gaps = heads + roles;
    if (free < BAL.minFreePt || !gaps) return { usedToPt: Math.round(bot * 10) / 10, freePt: Math.round(free), gapPt: 0 };
    var gapPt = Math.min(BAL.maxGapPt, BAL.share * free / gaps);
    return { usedToPt: Math.round(bot * 10) / 10, freePt: Math.round(free), gaps: gaps, gapPt: Math.round(gapPt * 10) / 10 };
  }

  // The same content rules for the PREVIEW (antcv-academy-preview.js hides DOM, never storage):
  // { sections: [id...] to hide, rows: { id: [row text...] } }.
  function plan(sections, o0) {
    var o = opts(o0), p = contentPlan(Array.isArray(sections) ? sections : [], o);
    var outS = [], outR = {};
    (Array.isArray(sections) ? sections : []).forEach(function (s, si) {
      if (!s || typeof s !== 'object') return;
      var id = String(s.id || '');
      if (!id) return;
      if (p.drop[si]) { outS.push(id); return; }
      if (p.rows[si]) outR[id] = p.rows[si].map(function (i) { return rowText(s.items[i]); }).filter(Boolean);
    });
    return { sections: outS, rows: outR, notes: p.notes };
  }

  function audit(sections, o0) {
    var o = opts(o0), issues = [];
    var add = function (code, where, detail) { issues.push({ code: code, where: where, detail: detail }); };
    var cp = contentPlan(Array.isArray(sections) ? sections : [], o);
    cp.notes.forEach(function (n) {
      var where = n.split(':')[0];
      add(/another person/.test(n) || /owner text/.test(n) ? 'LEAK' : (/placeholder/.test(n) ? 'PLACEHOLDER' : (/no real content/.test(n) ? 'EMPTY_SECTION' : 'COMMS')), where, n.slice(where.length + 2));
    });
    (Array.isArray(sections) ? sections : []).forEach(function (s) {
      if (!s || typeof s !== 'object' || s.on === false) return;
      var id = sid(s);
      if (s.type === 'experience' && Array.isArray(s.roles)) {
        var vis = s.roles.filter(function (r) { return r && r.on !== false && String(r.id || '') !== 'earlier-career'; });
        if (vis.length > RULES.max_roles) add('ROLES', 'experience', vis.length + ' detailed roles (max ' + RULES.max_roles + ')');
        vis.forEach(function (r) {
          var bl = Array.isArray(r.bullets) ? r.bullets : [];
          if (bl.length > RULES.role_bullets_max) add('BULLETS', r.id || r.title, bl.length + ' bullets (max ' + RULES.role_bullets_max + ' + Results)');
          bl.forEach(function (b, k) {
            var t = bulletText(b);
            if (t.length > RULES.bullet_max_chars) add('BULLET_LINES', (r.id || r.title) + '.' + k, t.length + ' chars (over two lines)');
            if (o.lang && wrongLang(t, o.lang)) add('LANG', (r.id || r.title) + '.' + k, langOf(t) + ' text in a ' + o.lang + ' CV');
            else if (o.lang !== 'en' && /^Internship:|\(internship\):/.test(t)) add('LANG', (r.id || r.title) + '.' + k, 'English internship note');
          });
          if (typeof r.results === 'string' && r.results.trim()) {
            if (r.results.length > RULES.results_max_chars) add('RESULTS_LINES', r.id || r.title, r.results.length + ' chars');
            if (wrongLang(r.results, o.lang)) add('LANG', (r.id || r.title) + '.results', (langOf(r.results) || 'en') + ' Results line in a ' + o.lang + ' CV');
          } else if (o.checkResults) add('RESULTS_MISSING', r.id || r.title, 'no Results line (ROLE-RESULTS-MANDATORY-001)');
          var all = bl.map(bulletText).join(' ') + ' ' + String(r.results || '');
          if (/\bMAFAT\b/.test(all)) add('BANNED', r.id || r.title, '"MAFAT" (owner 2026-11-03: Ministry of Defence / Forsvarsministeriet)');
        });
        return;
      }
      if (id === 'profile' && Array.isArray(s.items)) {
        var pt = s.items.map(txt).join(' ');
        if (o.company && pt.trim()) {
          var core = o.company.replace(/\b(a\/s|aps|as|ab|gmbh|ltd|inc|technology|technologies|group|denmark|danmark)\b\.?/gi, '').trim().split(/\s+/)[0] || o.company;
          if (core.length >= 3 && pt.toLowerCase().indexOf(core.toLowerCase()) < 0) add('PROFILE_GENERIC', 'profile', 'profile never names ' + o.company + ' (stale or generic text)');
        }
        if (wrongLang(pt, o.lang)) add('LANG', 'profile', langOf(pt) + ' profile in a ' + o.lang + ' CV');
      }
      if ((id === 'work_style') && Array.isArray(s.items) && o.lang !== 'en' && s.items.some(function (it) { return it && /^\s*work\s*style/i.test(String(it.b || '')); })) add('LANG', 'work_style', 'English "Work style" lead');
      if (s.type === 'table' && (id === 'core_comp' || id === 'bring') && o.lang !== 'en' && Array.isArray(s.rows) && s.rows[0] && String(s.rows[0][0]).trim() === L.en.needs[0]) add('LANG', id + '.header', 'English header pair');
      if (/^(outcomes|selected_outcomes)$/.test(id)) add('SECTION', id, 'outcomes block is not in the house CV');
      if (id === 'regulatory' && Array.isArray(s.items) && !visibleItems(s).some(function (i) {
        var code = String((s.items[i] && (s.items[i].b || s.items[i].l)) || '').trim();
        return !isGrp(s.items[i]) && code.length >= 3 && o.jd.toLowerCase().indexOf(code.toLowerCase()) >= 0;
      })) add('SECTION', id, 'regulatory block the JD does not ask for');
      if (s.loc !== 'sidebar' || !Array.isArray(s.items)) return;
      var rows = visibleItems(s).filter(function (i) { return !isGrp(s.items[i]); });
      var grps = visibleItems(s).filter(function (i) { return isGrp(s.items[i]); });
      if (id === 'proof_points') {
        if (rows.length !== RULES.proof_points) add('PROOF_POINTS', id, rows.length + ' proof points (house ' + RULES.proof_points + ')');
        rows.forEach(function (i) { if (wrongLang(txt(s.items[i]), o.lang)) add('LANG', id + '.' + i, 'proof point in ' + (langOf(txt(s.items[i])) || 'en')); });
      }
      if (id === 'tools') {
        if (rows.length > RULES.tools_rows || grps.length) add('TOOLS', id, rows.length + ' rows + ' + grps.length + ' group headers (house ' + RULES.tools_rows + ' grouped rows)');
        rows.forEach(function (i) { if (wrongLang(txt(s.items[i]), o.lang)) add('LANG', id + '.' + i, 'tools row in ' + (langOf(txt(s.items[i])) || 'en')); });
      }
      // certificates keep their official (often English) names; degrees are translated (1050 DA)
      if (id === 'education') rows.forEach(function (i) { if (wrongLang(txt(s.items[i]), o.lang)) add('LANG', id + '.' + i, (langOf(txt(s.items[i])) || 'en') + ' row in a ' + o.lang + ' CV'); });
      if (id === 'certs' && rows.length > RULES.certs_max) add('CERTS', id, rows.length + ' certificates (max ' + RULES.certs_max + ')');
      if (id === 'interests' && rows.length > RULES.interests_rows) add('INTERESTS', id, rows.length + ' rows (house: volunteer row + one strip)');
      if (id === 'languages') {
        var first = rows.length ? langKey(s.items[rows[0]]) : '';
        if (first && first !== RULES.languages_first[0]) add('LANG_ORDER', id, first + ' first (house: ' + RULES.languages_first[0] + ' first)');
        if (o.lang !== 'en') rows.forEach(function (i) { var it = s.items[i]; var k = langKey(it); if (k && String((it.l || it.b || '')).trim() === LANG_NAMES[k].en && LANG_NAMES[k][o.lang] !== LANG_NAMES[k].en) add('LANG', id + '.' + i, 'English language name "' + LANG_NAMES[k].en + '"'); });
      }
    });
    return { ok: !issues.length, issues: issues };
  }

  var api = { version: VERSION, RULES: RULES, langOf: langOf, wrongLang: wrongLang, audit: audit, apply: apply, plan: plan, balance: balance, BAL: BAL, repoLink: repoLink, aiOriented: aiOriented, ANTCV_URL: ANTCV_URL, labels: labels, isPlaceholder: isPlaceholder, ownerFact: ownerFact };
  root.AntcvAcademyFormat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
