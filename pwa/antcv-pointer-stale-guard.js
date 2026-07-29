// antcv-pointer-stale-guard.js — PTR-STALE-GUARD-001 (register row 39a residual)
// =====================================================================
// JD-SCOPE-ISOLATION-001 Stage 2 (__foreignDevice) only protects against a
// DIFFERENT device's active_application pointer being adopted on cold-restore.
// It explicitly treats a SAME-device pointer as always trustworthy — but the
// pointer is a single shared "which application is active" row per account,
// and a race (fast row-switch, a lagging PUT, a second tab on the same
// device) can leave it pointing at an OLDER application than the one the
// user is actually looking at right now. The existing content-based drift
// guards (META-DRIFT-GUARD-001/002) only catch the specific case of a real
// company being overwritten by an EMPTY/UNSOLICITED row — a stale pointer
// that points at a DIFFERENT REAL company sails straight through.
//
// This module adds a narrow, backward-safe timestamp check reusing the same
// pattern as 277-SEQUENCE-GUARD-001 (antcv-generate-cloud-sync-277.js): the
// local `antcv:metaStamp` key records {key:'Company|Role', ts} — when the
// local meta identity was last observed to change. The relay's
// active_application pointer carries `_pointer_updated_at` (when the pointer
// itself was last set) and `_pointer_device_id`. When both timestamps are
// present, the pointer identifies a DIFFERENT application than the local
// one, the pointer's device is ours (or unknown), and the pointer is older
// than the local identity change (clock-skew margin), the incoming row is a
// stale snapshot — the caller should keep the local draft instead of
// adopting it.
//
// Backward-safe by construction: if either timestamp is missing (older
// client, never-stamped session, first cold start), isStalePointer returns
// false — no behavior change from before this module existed. It only ever
// SKIPS an adoption; it never forces one.
//
// Kill switch: localStorage['antcv:disable-ptr-stale-guard']='1'.
(function () {
  if (typeof window === 'undefined') return;

  var META_STAMP_KEY = 'antcv:metaStamp';
  var SKEW_MS = 180000; // same 3-minute margin as 277-SEQUENCE-GUARD-001

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  // antcv:metaStamp keys are written by antcv-generate-cloud-sync-277.js's
  // metaKey() as TRIM-ONLY (no lowercasing) — match that exact format here
  // or a real stamp never matches and the guard silently stays inert.
  function trimOnly(s) { return String(s == null ? '' : s).trim(); }

  function readJson(k) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function parseTs(v) {
    if (v == null) return 0;
    var n = Number(v);
    if (isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n; // epoch seconds vs ms
    var d = Date.parse(String(v));
    return isFinite(d) ? d : 0;
  }

  function guardDisabled() {
    try { return localStorage.getItem('antcv:disable-ptr-stale-guard') === '1'; } catch (_) { return false; }
  }

  // localStampTs: the timestamp the local identity (localCompany|localRole)
  // was last observed to change, per antcv:metaStamp. Returns 0 if the
  // stamped identity no longer matches (stale/foreign stamp — no evidence).
  function localStampTs(localCompany, localRole) {
    var st = readJson(META_STAMP_KEY);
    if (!st || typeof st !== 'object') return 0;
    var key = trimOnly(localCompany) + '|' + trimOnly(localRole);
    if (String(st.key || '') !== key) return 0;
    var ts = Number(st.ts);
    return isFinite(ts) ? ts : 0;
  }

  // PURE decision: is `opts.pointerUpdatedAt` a stale SAME-device pointer
  // relative to the local (localCompany, localRole) identity?
  //   opts: { localCompany, localRole, rowCompany, rowRole,
  //           pointerDeviceId, pointerUpdatedAt, myDeviceId }
  // myDeviceId is optional — when omitted, window.AntcvJdScope.deviceId() is
  // used (production path); tests pass it explicitly for determinism.
  function isStalePointer(opts) {
    opts = opts || {};
    try {
      if (guardDisabled()) return false;
      var localCo = norm(opts.localCompany);
      if (!localCo || localCo === 'unsolicited' || !!(window.__antcvUnsol && window.__antcvUnsol(localCo))) return false; // nothing local to protect (UNSOL-PILLAR-LANG-001: any language variant)
      var rowCo = norm(opts.rowCompany);
      var localRole = norm(opts.localRole);
      var rowRole = norm(opts.rowRole);
      if (localCo === rowCo && localRole === rowRole) return false; // same identity — nothing to guard

      // Only guard SAME-device (or unknown-device) pointers. A foreign
      // device's pointer is a different, already-handled contamination
      // class (JD-SCOPE-ISOLATION-001 Stage 2 __foreignDevice).
      var mine = opts.myDeviceId;
      if (mine == null) {
        try { mine = window.AntcvJdScope && window.AntcvJdScope.deviceId && window.AntcvJdScope.deviceId(); } catch (_) { mine = null; }
      }
      var setter = opts.pointerDeviceId;
      if (setter && mine && String(setter) !== String(mine)) return false;

      var cloudTs = parseTs(opts.pointerUpdatedAt);
      var localTs = localStampTs(opts.localCompany, opts.localRole);
      if (!cloudTs || !localTs) return false; // no evidence either way — stay inert

      return cloudTs < localTs - SKEW_MS;
    } catch (_) {
      return false;
    }
  }

  window.AntcvPointerStaleGuard = {
    version: '1.51.135-ptr-stale-guard',
    isStalePointer: isStalePointer,
    _localStampTs: localStampTs,
    _parseTs: parseTs,
  };
})();
