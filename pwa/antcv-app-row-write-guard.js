/* antcv-app-row-write-guard.js — APP-ROW-WRITE-GUARD-001 (owner 2026-11-03, D1 3524)
 * ============================================================================
 * THE BUG: at 2026-11-01 16:55:11Z the ASSA ABLOY editor state (sections, meta,
 * subtitle) was written into application row 3524 — the Ambu row. That tab's device
 * pointer had been on 3525 since 15:47:17; the tab's own active-row id still said 3524.
 * The 3-second auto-sync only checks io.company against localStorage
 * 'antcv:activeAppCompany', a stamp that ~16 code paths set WITHOUT moving the active
 * row id, so the check passed and the write went to the wrong row. A later POST dedupe
 * for the Ambu JD put jd_company back to "Ambu" and COALESCE-kept the poisoned meta,
 * which is the shape D1 shows (jd_company Ambu, meta ASSA ABLOY).
 *
 * THIS GUARD checks the TARGET ROW itself. Per tab (in memory, like antcv-app-rev-guard:
 * a sibling tab never borrows it) it learns each row's employer + role from every relay
 * response app.js receives (list / get / create / update all carry the row), and
 * app.js's oo.update() asks it before every PUT:
 *   - a CONTENT write (cv_sections / cl_sections / meta) whose employer AND role both
 *     differ from the row's is refused (Error code 'company_mismatch'; every caller
 *     already catches and logs).
 *   - a write with sections but no identity of its own is judged by the editor's meta.
 *   - a rename (jd_company / jd_role only, the history-list inline edit) always passes,
 *     and so does a write where the employer OR the role still matches (a corrected
 *     company name keeps its role; a corrected role keeps its employer).
 *   - unknown row, unsolicited / empty identities: pass (fail open; the relay applies
 *     the same rule server-side, APP-ROW-WRITE-GUARD-001 in access-relay).
 * Kill switch: localStorage['antcv:disable-app-row-write-guard'] = '1'.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.5282';

  function CM() { return root && root.AntcvCompanyMatch; }
  var rows = Object.create(null);   // id -> { company, role }

  // Pure: the identities a PUT body claims, or [] for a non-content write.
  function identitiesOf(payload, editorMeta) {
    if (!payload || typeof payload !== 'object') return [];
    var content = payload.cv_sections !== undefined || payload.cl_sections !== undefined || payload.meta !== undefined;
    if (!content) return [];
    var out = [];
    var m = payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
    if (m && (m.company || m.role)) out.push({ company: String(m.company || ''), role: String(m.role || ''), src: 'meta' });
    if (typeof payload.jd_company === 'string' && payload.jd_company.trim()) {
      out.push({ company: payload.jd_company, role: String(payload.jd_role || (m && m.role) || ''), src: 'jd_company' });
    }
    if (!out.length && editorMeta && (editorMeta.company || editorMeta.role)) {
      out.push({ company: String(editorMeta.company || ''), role: String(editorMeta.role || ''), src: 'editor' });
    }
    return out;
  }

  // Pure: null when the write may proceed, else { row, claim } describing the mismatch.
  function verdict(row, claims) {
    var cm = CM();
    if (!cm || !row || !claims || !claims.length) return null;
    if (!cm.isTargeted(row.company)) return null;
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (!cm.isTargeted(c.company)) continue;
      if (cm.sameCompany(row.company, c.company) || cm.sameRole(row.role, c.role)) continue;
      return { row: row, claim: c };
    }
    return null;
  }

  function learn(a) {
    try {
      if (!a || typeof a !== 'object') return;
      var put = function (r) {
        if (r && r.id != null && (typeof r.jd_company === 'string' || typeof r.jd_role === 'string')) {
          rows[String(r.id)] = { company: String(r.jd_company || ''), role: String(r.jd_role || '') };
        }
      };
      if (a.application) put(a.application);
      if (Array.isArray(a.applications)) a.applications.forEach(put);
    } catch (_) {}
  }
  function disabled() { try { return root.localStorage.getItem('antcv:disable-app-row-write-guard') === '1'; } catch (_) { return false; } }
  function editorMeta() { try { return JSON.parse(root.localStorage.getItem('meta') || 'null'); } catch (_) { return null; } }

  // Called by app.js oo.update(id, body) before the PUT. Returns an Error to refuse.
  function guard(id, payload) {
    try {
      if (disabled()) return null;
      var row = rows[String(id)];
      var v = verdict(row, identitiesOf(payload, editorMeta()));
      if (!v) return null;
      var msg = 'APP-ROW-WRITE-GUARD-001: refused to write ' + (v.claim.company || '?') + ' — ' + (v.claim.role || '?') +
        ' content into application ' + id + ' (' + v.row.company + ' — ' + v.row.role + ')';
      try { console.warn('[apps] ' + msg); } catch (_) {}
      var e = new Error('company_mismatch');
      e.code = 'company_mismatch'; e.detail = msg;
      return e;
    } catch (_) { return null; }
  }

  var API = { version: VERSION, identitiesOf: identitiesOf, verdict: verdict, learn: learn, guard: guard, _rows: rows };
  if (root) {
    root.AntcvAppRowWriteGuard = API;
    root.__antcvLearnRows = learn;
    root.__antcvRowWriteGuard = guard;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
