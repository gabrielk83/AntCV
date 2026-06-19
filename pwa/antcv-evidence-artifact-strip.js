/* antcv-evidence-artifact-strip.js — ANTI-FABRICATION-ARTIFACT-001 (owner 2026-06-19)
 * ============================================================================
 * Owner QA (CRITICAL): a generation wrote, on the Meprolight Team Leader role,
 * "Worked in product contexts represented by NYX-100 / NYX-200 and MOR PRO
 * evidence artifacts." NYX-100/NYX-200/MOR PRO are EVIDENCE ARTIFACTS in Gabriel's
 * data (proof references), NOT work he did — the generator must NEVER turn an
 * evidence-artifact reference into a "worked on X" claim. "evidence artifact(s)"
 * is the generator's fabrication tell: an internal kernel term that should never
 * appear in finished CV/CL prose.
 *
 * The prompt guard prevents NEW generations from doing it (regen-gated); this
 * restore-proof SIDECAR strips the fabrication from data ALREADY stored. It drops
 * any clause/sentence that mentions "evidence artifact(s)" from experience role
 * `results` + `bullets` and from SELECTED OUTCOMES items, never blanking a field
 * (if the only content is the fabrication, the field is left for the user to fix
 * rather than emptied), idempotent + loop-safe.
 *
 * Sidecar-only — no app.js change. Disable:
 *   localStorage['antcv:disable-evidence-artifact-strip'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvEvidenceArtifactStrip) return;
  window.__antcvEvidenceArtifactStrip = '1.50.698';

  var SRC = 'evidence-artifact-strip';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-evidence-artifact-strip'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  var ARTIFACT = /evidence artifacts?/i;

  // Drop any ';'-clause or sentence that mentions "evidence artifact(s)"; keep the
  // rest verbatim. Returns the cleaned string, or null if nothing changed / the
  // field would be blanked (never blank — leave it for the user).
  function stripArtifact(v) {
    if (typeof v !== 'string' || !v || !ARTIFACT.test(v)) return null;
    // sentence level FIRST (split on '. '); within a tainted sentence, drop only
    // the ';'-clause(s) carrying the tell so a clean clause in the same sentence
    // survives. Then drop any whole sentence still carrying the tell.
    var kept = v.split(/(?<=\.)\s+/).map(function (sent) {
      if (!ARTIFACT.test(sent)) return sent;
      return sent.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s && !ARTIFACT.test(s); }).join('; ');
    }).filter(function (s) { return s && s.trim() && !ARTIFACT.test(s); });
    var joined = kept.join(' ').replace(/\s{2,}/g, ' ').replace(/\s+([.;,])/g, '$1').replace(/[\s;,]+$/, '').trim();
    if (!joined) return null;            // never blank the field
    if (joined === String(v).trim()) return null;
    return joined;
  }

  // Apply to one experience section's roles (results + string bullets).
  function stripRoles(roles) {
    if (!Array.isArray(roles)) return false;
    var changed = false;
    roles.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (typeof r.results === 'string') { var nx = stripArtifact(r.results); if (nx != null) { r.results = nx; changed = true; } }
      if (Array.isArray(r.bullets)) {
        for (var i = r.bullets.length - 1; i >= 0; i--) {
          var b = r.bullets[i];
          if (typeof b === 'string') {
            var nb = stripArtifact(b);
            if (nb != null) { r.bullets[i] = nb; changed = true; }
            else if (b && ARTIFACT.test(b)) { r.bullets.splice(i, 1); changed = true; } // whole-bullet fabrication -> drop
          } else if (b && typeof b === 'object') {
            ['b', 't'].forEach(function (k) { if (typeof b[k] === 'string') { var nv = stripArtifact(b[k]); if (nv != null) { b[k] = nv; changed = true; } } });
          }
        }
      }
    });
    return changed;
  }

  // Apply to a SELECTED OUTCOMES section's items (strings or {b,t}/{title,result}).
  function stripOutcomes(items) {
    if (!Array.isArray(items)) return false;
    var changed = false;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (typeof it === 'string') {
        var ns = stripArtifact(it);
        if (ns != null) { items[i] = ns; changed = true; }
        else if (ARTIFACT.test(it)) { items.splice(i, 1); changed = true; }
      } else if (it && typeof it === 'object') {
        ['b', 't', 'title', 'result'].forEach(function (k) { if (typeof it[k] === 'string') { var nv = stripArtifact(it[k]); if (nv != null) { it[k] = nv; changed = true; } } });
      }
    }
    return changed;
  }

  function stripList(list) {
    if (!Array.isArray(list)) return false;
    var changed = false;
    list.forEach(function (sec) {
      if (!sec || typeof sec !== 'object') return;
      if (sec.type === 'experience') { if (stripRoles(sec.roles)) changed = true; }
      if (/^(outcomes|selected_outcomes)$/.test(String(sec.id || '')) || /SELECTED OUTCOMES/i.test(String(sec.title || ''))) {
        if (stripOutcomes(sec.items)) changed = true;
      }
    });
    return changed;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    if (!ARTIFACT.test(raw)) { lastRaw = raw; return; }   // fast bail — nothing to strip
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    if (stripList(b.cv)) changed = true;
    if (stripList(b.cl)) changed = true;
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[evidence-artifact-strip] removed evidence-artifact fabrication from results/bullets/outcomes'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2800].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvEvidenceArtifactStrip = { version: '1.50.698', _apply: apply, _strip: stripArtifact, _stripRoles: stripRoles };
})();
