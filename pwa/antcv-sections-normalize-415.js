/* AntCV sections normalizer (restore-proof).
 * ============================================================
 * Two stored-section rules kept failing because the kernel cloud-restore
 * ([KERNEL-CLOUD-PERSIST] reapplies a stale slot AFTER the React
 * normalization effects run, so the order/title reverts:
 *   - RECOMMENDATIONS must sit after the LAST of experience / PROFESSIONAL
 *     EXPERTISE (owner 2026-06-13).
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
  var VERSION = '1.50.708-role-canon';
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

  // VOLUNTEER-GROUP-001 (owner 2026-06-19): "Students Council Representative is also
  // (foreningsarbejde), so maybe place [it] after Pan/Team Operations". Group the two
  // volunteer (foreningsarbejde) roles together: move the Students Council role to sit
  // immediately AFTER the Team Operations / Pan Idræt role. Idempotent — returns null
  // once they are already adjacent in that order.
  function groupVolunteerRoles(cv) {
    var xi = cv.findIndex(function (s) { return s && s.type === 'experience' && Array.isArray(s.roles); });
    if (xi < 0) return null;
    var roles = cv[xi].roles;
    var teamIdx = roles.findIndex(function (r) { return r && (/pan idr/i.test(String(r.company || '')) || /team operations manager/i.test(String(r.title || ''))); });
    var scIdx = roles.findIndex(function (r) { return r && /students?\s+council/i.test(String(r.title || '')); });
    if (teamIdx < 0 || scIdx < 0) return null;
    if (scIdx === teamIdx + 1) return null; // already grouped
    var next = roles.slice();
    var sc = next.splice(scIdx, 1)[0];
    var insertAt = next.findIndex(function (r) { return r && (/pan idr/i.test(String(r.company || '')) || /team operations manager/i.test(String(r.title || ''))); }) + 1;
    next.splice(insertAt, 0, sc);
    var copy = cv.slice(); copy[xi] = Object.assign({}, copy[xi], { roles: next });
    return copy;
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
  function inlineifyLabeledText(arr) {
    if (!Array.isArray(arr)) return null;
    var changed = false;
    var out = arr.map(function (s) {
      if (!s || typeof s !== 'object' || s.type !== 'text') return s;
      if (INLINE_LABEL_SKIP[s.id]) return s;
      var t = String(s.title || '').toLowerCase().trim();
      if (INLINE_LABEL_SKIP[t]) return s;
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
      var gv = groupVolunteerRoles(cv); if (gv) { cv = gv; changed = true; }
      var f = stripFounder(cv); if (f) { cv = f; changed = true; }
      var p = placeRecs(cv); if (p) { cv = p; changed = true; }
      var dl = defaultLoc(cv); if (dl) { cv = dl; changed = true; }
      var wi = inlineifyLabeledText(cv); if (wi) { cv = wi; changed = true; }
      var no = neutralizeUnsolicitedOpener(cv); if (no) { cv = no; changed = true; }
      var ex = explodeAdditionalToSections(cv); if (ex) { cv = ex; changed = true; }
      var pa = partitionAdditional(cv); if (pa) { cv = pa; changed = true; }
      // SECTION-PREVIEW-LOC-001 / TYPE-NORMALIZE: also normalise the CL sections'
      // loc + work_style type so imported CL sections render in the preview.
      var cl = Array.isArray(b.cl) ? b.cl : null;
      var clChanged = false;
      if (cl) { var dlc = defaultLoc(cl); if (dlc) { cl = dlc; clChanged = true; } }
      if (cl) { var wic = inlineifyLabeledText(cl); if (wic) { cl = wic; clChanged = true; } }
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
