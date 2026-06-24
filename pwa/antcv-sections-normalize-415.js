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
  var VERSION = '1.50.730-strip-snowflake';
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

  // ROLE-DECOMP-001 (owner 2026-06-16): "decompose the merged roles ... merging is
  // later". The old ROLE-DUP-001 merged on title CONTAINMENT (folded "System
  // Architect" into "System Architect & Change Control Lead"). The owner now wants
  // DISTINCT functions kept as SEPARATE positions, so this merges ONLY when the two
  // titles are IDENTICAL after normalisation — i.e. a genuine append-duplicate
  // (e.g. the consensus re-appending the same Kanzen role), never two distinct
  // functions at the same company. Containment-but-not-equal is left UN-merged.
  function dedupeRoles(cv) {
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    var yearsOf = function (s) { return (String(s || '').match(/\d{4}/g) || []).map(Number); };
    var overlap = function (a, b) {
      var ya = yearsOf(a), yb = yearsOf(b);
      if (!ya.length || !yb.length) return true;
      return Math.min.apply(null, ya) <= Math.max.apply(null, yb) && Math.min.apply(null, yb) <= Math.max.apply(null, ya);
    };
    var roles = cv[xi].roles.slice();
    var drop = {};
    for (var i = 0; i < roles.length; i++) for (var j = 0; j < roles.length; j++) {
      if (i === j || drop[i] || drop[j]) continue;
      var a = roles[i], b = roles[j];
      if (!a || !b) continue;
      var ta = norm(a.title), tb = norm(b.title);
      if (!ta || !tb || ta !== tb) continue; // ROLE-DECOMP-001: exact-title dup only (was containment)
      if (norm(a.company) !== norm(b.company)) continue;
      if (!overlap(a.years, b.years)) continue;
      drop[i] = true;
      if (a.on !== false) b.on = true;
      if ((!Array.isArray(b.bullets) || !b.bullets.length) && Array.isArray(a.bullets) && a.bullets.length) b.bullets = a.bullets;
    }
    var keys = Object.keys(drop);
    if (!keys.length) return null;
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
    var TITLE = 'Team Operations Manager (foreningsarbejde)';
    var COMPANY = 'Pan Idræt';
    var CW_BULLET = 'Operations and assistant-coaching for Copenhagen Wolves RFC, an inclusive amateur rugby club under Pan Idræt.';
    var keep = cwIdx[0];
    var base = Object.assign({}, roles[keep]);
    var bullets = Array.isArray(base.bullets) ? base.bullets.slice() : [];
    for (var k = 1; k < cwIdx.length; k++) { (Array.isArray(roles[cwIdx[k]].bullets) ? roles[cwIdx[k]].bullets : []).forEach(function (b) { if (bullets.indexOf(b) < 0) bullets.push(b); }); }
    if (!bullets.some(function (b) { return /copenhagen wolves rfc/i.test(String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '')); })) bullets.unshift(CW_BULLET);
    var changed = false;
    if (base.title !== TITLE) { base.title = TITLE; changed = true; }
    if (base.company !== COMPANY) { base.company = COMPANY; changed = true; }
    if (cwIdx.length > 1 || (Array.isArray(roles[keep].bullets) ? roles[keep].bullets.length : 0) !== bullets.length) { base.bullets = bullets; changed = true; }
    if (!changed) return null;
    var nextRoles = roles.map(function (r, i) { return i === keep ? base : r; });
    if (cwIdx.length > 1) { var drop = {}; for (var k2 = 1; k2 < cwIdx.length; k2++) drop[cwIdx[k2]] = true; nextRoles = nextRoles.filter(function (_, i) { return !drop[i]; }); }
    var copy = cv.slice(); copy[xi] = Object.assign({}, copy[xi], { roles: nextRoles });
    return copy;
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
  function classifyAdditional(it) {
    var s = String((it && it.l) || '') + ' ' + String((it && it.v) || '');
    if (/(accessib|accommodat|hearing|deaf|hard of hearing|disab|sign language|assistive)/i.test(s)) return 'Accessibility';
    if (/(language|languages|sprog|fluent|fluency|proficien|mother tongue|native speaker|bilingual|\b[ABC][12]\b|english|danish|spanish|hebrew|german|french|norwegian|swedish|finnish|arabic|mandarin|chinese|portuguese|italian|russian|dutch|japanese|korean|polish|turkish)/i.test(s)) return 'Languages';
    if (/(interest|hobb|fritid|leisure|pastime|rugby|hiking|hike|tai.?chi|reading|sport|volunteer|frivillig|foreningsarbejde|coach|\bcat\b|feline)/i.test(s)) return 'Interests';
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
    if (!newSecs.length) return null;   // nothing new to create -> leave as-is
    var copy = cv.slice();
    var replacement = newSecs;
    // keep any leftover Other items + preserved custom group markers (or the
    // buckets that already have their own section) in a trimmed ADDITIONAL; drop
    // ADDITIONAL only if there is genuinely nothing left.
    var leftover = keptGroups.concat(buckets.Other);
    // ACCESSIBILITY-DUP-001 (owner 2026-06-18: "accessibility is generated twice"):
    // only push a category's items back into ADDITIONAL when its dedicated section
    // does NOT already hold content. If the dedicated section exists AND is non-empty
    // it is the single home for that category — keeping the items in ADDITIONAL too
    // renders them twice. An empty/just-created dedicated section keeps the items so
    // nothing is lost.
    var pushBack = function (id, exists, bucket) {
      if (!exists) return;
      var sec = cv.filter(function (s) { return s && s.id === id; })[0];
      var nonEmpty = sec && Array.isArray(sec.items) && sec.items.length;
      if (!nonEmpty) bucket.forEach(function (it) { leftover.push(it); });
    };
    pushBack('languages', hasLang, buckets.Languages);
    pushBack('interests', hasInt, buckets.Interests);
    pushBack('accessibility', hasAcc, buckets.Accessibility);
    if (leftover.length) replacement = newSecs.concat([Object.assign({}, cv[xi], { items: leftover })]);
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
      var ro = canonicalRoleOrder(cv); if (ro) { cv = ro; changed = true; }
      var bo = canonicalBulletOrder(cv); if (bo) { cv = bo; changed = true; }
      var f = stripFounder(cv); if (f) { cv = f; changed = true; }
      var p = placeRecs(cv); if (p) { cv = p; changed = true; }
      var dl = defaultLoc(cv); if (dl) { cv = dl; changed = true; }
      var wi = inlineifyLabeledText(cv); if (wi) { cv = wi; changed = true; }
      var no = neutralizeUnsolicitedOpener(cv); if (no) { cv = no; changed = true; }
      var ex = explodeAdditionalToSections(cv); if (ex) { cv = ex; changed = true; }
      var pa = partitionAdditional(cv); if (pa) { cv = pa; changed = true; }
      var jr = scrubJuniorRugby(cv); if (jr) { cv = jr; changed = true; }
      var ish = normalizeInterestsShape(cv); if (ish) { cv = ish; changed = true; }
      var ibt = stripInterestsBtRemnant(cv); if (ibt) { cv = ibt; changed = true; }
      var pin = pinInterests(cv); if (pin) { cv = pin; changed = true; }
      var dhn = dedupeHiddenDupByName(cv); if (dhn) { cv = dhn; changed = true; }
      var dedu = dedupeEducation(cv); if (dedu) { cv = dedu; changed = true; }
      // SECTION-PREVIEW-LOC-001 / TYPE-NORMALIZE: also normalise the CL sections'
      // loc + work_style type so imported CL sections render in the preview.
      var cl = Array.isArray(b.cl) ? b.cl : null;
      var clChanged = false;
      if (cl) { var dlc = defaultLoc(cl); if (dlc) { cl = dlc; clChanged = true; } }
      if (cl) { var wic = inlineifyLabeledText(cl, { workStyleOnly: true }); if (wic) { cl = wic; clChanged = true; } }
      if (clChanged) changed = true;
      if (!changed) return;
      var next = Object.assign({}, b, { cv: cv });
      if (clChanged) next.cl = cl;
      localStorage.setItem('sections', JSON.stringify(next));
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
