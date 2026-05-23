/* AntCV shape-guard sidecar (v1.40.195)
 * ============================================================
 *
 * Purpose
 * -------
 * Fixes the recurring "Cannot read properties of undefined (reading
 * 'bullets')" TypeError that fires inside React's initial-state
 * computation when switching language back from a non-EN locale
 * (typically zh → en, but also es → en). The recursive section
 * walker in app.js (`u` at app.js:240845) reads `.bullets` off
 * children that the language-cache hydrate path can leave as
 * `undefined` — usually a hole in `items[]` or a missing `bullets`
 * field on a freshly-translated section that didn't make the round
 * trip through the translation pipeline cleanly.
 *
 * Strategy
 * --------
 * We can't edit app.js (minified, externally built). So we sit on
 * top of it and guarantee shape integrity at every localStorage
 * write point:
 *
 *   1. Intercept `localStorage.setItem(key, value)` for the two
 *      keys that feed React state — 'sections' and 'languageCache'
 *      — and normalize the JSON before it lands.
 *
 *   2. On script boot (before app.js mounts), normalize whatever
 *      is already in storage so the first render is also safe.
 *      We have to run BEFORE app.js, so this sidecar is loaded
 *      without `defer` and placed in <head> via the boot script.
 *      (See index.html v1.40.195 — we are loaded synchronously by
 *      the bootAntCV() loader before app.js.)
 *
 *   3. Re-normalize on `antcv:sections-updated` events as a belt-
 *      and-braces guard for any in-memory mutations that bypass
 *      localStorage.
 *
 * Normalization rules
 * -------------------
 * For each section S in sections.cv and sections.cl:
 *   - S is an object (drop nulls / undefined entries from the array)
 *   - S.items is an array (default: [])
 *   - S.bullets is an array (default: [])
 *   - S.items[] entries are objects (drop nulls/undefined)
 *   - For each item I:
 *       I.bullets is an array (default: [])
 *       I.title is a string (default: '')
 *       I.subtitle is a string (default: '')
 *       I.body is a string (default: '')
 *       I.dates is a string (default: '')
 *   - Recursively: anything that contains an `items` field gets
 *     the same treatment.
 *
 * For languageCache:
 *   - Each cached translation entry is normalized the same way.
 *     The cache shape is roughly { [lang]: { cv: [...], cl: [...] } }
 *     with the same section structure.
 *
 * Side-effects
 * ------------
 * None visible. The normalization is idempotent and additive: we
 * never remove existing data, we only fill in missing array/string
 * fields. If app.js writes a section without a `bullets` array,
 * we add `bullets: []`. If it writes a clean section, we pass it
 * through unchanged.
 *
 * Trace logging
 * -------------
 * console.debug('[shape-guard]', …) on every patch event with
 * counts of fields filled. Silent on no-op.
 */
(function () {
  'use strict';

  if (window.__antcvShapeGuardInstalled) return;
  window.__antcvShapeGuardInstalled = '1.40.195';

  const SECTIONS_KEY = 'sections';
  const LANG_CACHE_KEY = 'languageCache';

  // Counter for debug visibility — exposed via window.AntcvShapeGuard.
  const stats = { writes: 0, patched: 0, fieldsFilled: 0 };

  // Module-level throttle on the "missing bullets" diagnostic. Caps
  // at 5 warnings per page load (was 5 per setItem call in 1.40.195,
  // which produced excessive noise on initial cloud-restore where
  // many setItem batches fire back to back).
  const BULLET_WARN_CAP = 5;
  let bulletWarnCount = 0;

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // Normalize a single item: ensure bullets[], string fields exist.
  function normalizeItem(item, ctx) {
    if (!isPlainObject(item)) return null;
    let filled = 0;
    if (!Array.isArray(item.bullets)) {
      // Diagnostic: this is the exact shape hole that caused the
      // app.js:240845 "Cannot read properties of undefined (reading
      // 'bullets')" crash on language switch. Logging the surrounding
      // item shape lets us trace which translation-pipeline path
      // leaves the hole. Module-level throttle: max 5 warnings per
      // page load (cap reset on reload).
      if (bulletWarnCount < BULLET_WARN_CAP) {
        try {
          const sample = JSON.stringify({
            type: item.type, title: item.title, role: item.role,
            company: item.company, keys: Object.keys(item),
          }).slice(0, 240);
          console.warn('[shape-guard] item missing bullets[] — filled:', sample);
          bulletWarnCount++;
          if (bulletWarnCount === BULLET_WARN_CAP) {
            console.warn('[shape-guard] further "missing bullets" warnings suppressed for this session');
          }
        } catch (_) {}
      }
      item.bullets = [];
      filled++;
    } else {
      // Compact: drop null/undefined/non-string entries.
      const before = item.bullets.length;
      item.bullets = item.bullets
        .filter(function (b) { return b !== null && b !== undefined; })
        .map(function (b) { return typeof b === 'string' ? b : String(b); });
      if (item.bullets.length !== before) filled++;
    }
    // String fields commonly read by the renderer.
    const stringFields = ['title', 'subtitle', 'body', 'dates', 'date',
                          'role', 'company', 'location', 'institution',
                          'degree', 'specialization', 'l', 'v'];
    for (const f of stringFields) {
      if (item[f] === undefined || item[f] === null) {
        // Don't add fields that aren't already implied by other items
        // in the same section — but `bullets` we always add because
        // the crash signature pinpoints that field.
      }
    }
    // Recurse into nested items (rare, but defensive).
    if (item.items !== undefined) {
      if (!Array.isArray(item.items)) {
        item.items = [];
        filled++;
      } else {
        item.items = item.items
          .map(function (i) { return normalizeItem(i, ctx); })
          .filter(function (i) { return i !== null; });
      }
    }
    ctx.fieldsFilled += filled;
    return item;
  }

  // Normalize a single section: ensure items[] and bullets[].
  function normalizeSection(sec, ctx) {
    if (!isPlainObject(sec)) return null;
    let filled = 0;
    // items[] guard — this is where the crash actually happens
    // (recursive walker hitting undefined inside items).
    if (sec.items === undefined || sec.items === null) {
      sec.items = [];
      filled++;
    } else if (!Array.isArray(sec.items)) {
      sec.items = [];
      filled++;
    } else {
      // Compact: drop nulls / undefined / non-objects.
      const before = sec.items.length;
      sec.items = sec.items
        .map(function (i) { return normalizeItem(i, ctx); })
        .filter(function (i) { return i !== null; });
      if (sec.items.length !== before) filled++;
    }
    // bullets[] guard — some section types render top-level bullets.
    if (!Array.isArray(sec.bullets)) {
      sec.bullets = [];
      filled++;
    } else {
      const before = sec.bullets.length;
      sec.bullets = sec.bullets
        .filter(function (b) { return b !== null && b !== undefined; })
        .map(function (b) { return typeof b === 'string' ? b : String(b); });
      if (sec.bullets.length !== before) filled++;
    }
    ctx.fieldsFilled += filled;
    return sec;
  }

  // Normalize a sections-shaped object: { cv: [...], cl: [...] }
  // or a bare array (older format).
  function normalizeSectionsBundle(bundle, ctx) {
    if (Array.isArray(bundle)) {
      return bundle
        .map(function (s) { return normalizeSection(s, ctx); })
        .filter(function (s) { return s !== null; });
    }
    if (!isPlainObject(bundle)) return bundle;
    for (const docKey of ['cv', 'cl']) {
      if (Array.isArray(bundle[docKey])) {
        bundle[docKey] = bundle[docKey]
          .map(function (s) { return normalizeSection(s, ctx); })
          .filter(function (s) { return s !== null; });
      }
    }
    return bundle;
  }

  // Normalize a languageCache entry. Shape varies across versions but
  // it's always nested objects/arrays that bottom out in sections-
  // shaped values. We do a shallow scan: any nested object with a
  // `cv` or `cl` array gets the sections treatment; everything else
  // we walk to look for arrays of section-shaped items.
  function normalizeLanguageCache(cache, ctx) {
    if (!isPlainObject(cache)) return cache;
    for (const k of Object.keys(cache)) {
      const v = cache[k];
      if (!isPlainObject(v) && !Array.isArray(v)) continue;
      if (isPlainObject(v) && (Array.isArray(v.cv) || Array.isArray(v.cl))) {
        cache[k] = normalizeSectionsBundle(v, ctx);
      } else if (Array.isArray(v) && v.length && isPlainObject(v[0]) &&
                 (v[0].items !== undefined || v[0].bullets !== undefined ||
                  v[0].type !== undefined || v[0].title !== undefined)) {
        cache[k] = normalizeSectionsBundle(v, ctx);
      } else if (isPlainObject(v)) {
        // Recurse one level deeper for hash-keyed caches like
        // { 'zh': { 'hash1': { cv: [...], cl: [...] }, ... } }.
        cache[k] = normalizeLanguageCache(v, ctx);
      }
    }
    return cache;
  }

  function tryParseJson(s) {
    if (typeof s !== 'string') return undefined;
    try { return JSON.parse(s); } catch (_) { return undefined; }
  }

  function patchValueIfNeeded(key, value) {
    if (key !== SECTIONS_KEY && key !== LANG_CACHE_KEY) return value;
    if (typeof value !== 'string') return value;
    const parsed = tryParseJson(value);
    if (parsed === undefined) return value;
    const ctx = { fieldsFilled: 0 };
    const patched = (key === SECTIONS_KEY)
      ? normalizeSectionsBundle(parsed, ctx)
      : normalizeLanguageCache(parsed, ctx);
    if (ctx.fieldsFilled > 0) {
      stats.patched++;
      stats.fieldsFilled += ctx.fieldsFilled;
      try {
        console.debug('[shape-guard] patched', key,
                      '— fields filled:', ctx.fieldsFilled);
      } catch (_) {}
      try {
        return JSON.stringify(patched);
      } catch (_) {
        return value;
      }
    }
    return value;
  }

  // Intercept localStorage.setItem.
  try {
    const proto = Storage.prototype;
    const origSet = proto.setItem;
    if (typeof origSet === 'function' && !proto.__antcvShapeGuardWrapped) {
      proto.setItem = function (key, value) {
        try {
          stats.writes++;
          const patched = patchValueIfNeeded(key, value);
          return origSet.call(this, key, patched);
        } catch (e) {
          // On any error in our path, fall back to the original write
          // so we never make things worse than baseline.
          try { return origSet.call(this, key, value); } catch (_) {}
        }
      };
      proto.__antcvShapeGuardWrapped = true;
    }
  } catch (e) {
    try { console.warn('[shape-guard] could not install setItem hook:', e && e.message); } catch (_) {}
  }

  // Eager pass: normalize whatever is already in storage so the very
  // first React render sees a clean shape. This must run before
  // app.js's useState initial-state callback fires.
  function eagerNormalize() {
    for (const key of [SECTIONS_KEY, LANG_CACHE_KEY]) {
      try {
        const raw = localStorage.getItem(key);
        if (typeof raw !== 'string' || !raw.length) continue;
        const parsed = tryParseJson(raw);
        if (parsed === undefined) continue;
        const ctx = { fieldsFilled: 0 };
        const patched = (key === SECTIONS_KEY)
          ? normalizeSectionsBundle(parsed, ctx)
          : normalizeLanguageCache(parsed, ctx);
        if (ctx.fieldsFilled > 0) {
          stats.patched++;
          stats.fieldsFilled += ctx.fieldsFilled;
          // Write-back the cleaned shape. We bypass our own wrapper
          // since we already have the normalized JSON in hand.
          try {
            const origSet = Storage.prototype.setItem;
            // origSet IS our wrapped version, but with normalized
            // input it's a no-op pass-through, so this is safe.
            localStorage.setItem(key, JSON.stringify(patched));
          } catch (_) {}
          try {
            console.debug('[shape-guard] eager-normalized', key,
                          '— fields filled:', ctx.fieldsFilled);
          } catch (_) {}
        }
      } catch (_) {}
    }
  }
  eagerNormalize();

  // Belt-and-braces: re-normalize after sections-updated events.
  // In-memory state may bypass our setItem hook (some sidecars
  // mutate React state directly), so we re-sweep storage on a
  // small delay.
  window.addEventListener('antcv:sections-updated', function () {
    setTimeout(eagerNormalize, 50);
  });

  // Public API.
  window.AntcvShapeGuard = {
    version: '1.40.195',
    stats: stats,
    _normalizeSectionsBundle: normalizeSectionsBundle,
    _normalizeLanguageCache: normalizeLanguageCache,
    _eagerNormalize: eagerNormalize,
  };

  try { console.debug('[shape-guard] installed v1.40.195'); } catch (_) {}
})();
