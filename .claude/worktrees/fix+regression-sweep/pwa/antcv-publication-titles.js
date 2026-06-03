/* AntCV publication titles preservation sidecar (v1.40.160)
 * ============================================================
 *
 * What this fixes
 * ---------------
 * The PWA's translation pipeline runs `sections.cv.publications.items`
 * through an LLM. The system prompt says "Keep ALL text inside straight
 * double quotes "..." and curly quotes "..." EXACTLY as written, in the
 * original source language" — using the user's actual paper title as the
 * example. In practice the model often ignores that rule and translates
 * the title text anyway. Gabriel reported English titles arriving in
 * Danish: e.g. the bold portion of his first paper rendering as
 * "Integration af suspenderede kulstof-nanorør i mikrofabrikerede enheder"
 * instead of staying as "Suspended Carbon Nanotube Integration in
 * Microfabricated Devices".
 *
 * The fix is cosmetic — we don't touch the React state or the translation
 * pipeline. We let the LLM produce whatever it wants, then patch the
 * rendered preview after the fact so the title portion shows in the
 * original source language. The descriptions, dates, and author lists
 * stay translated (as Gabriel wants).
 *
 * Source of truth
 * ---------------
 * `personalInfo.publications`            (array of HTML strings)
 * `personalInfo.publicationsStructured`  (array of {name, details, …})
 *
 * Both stay in the source language across translation — only
 * `sections.*` content is translated. We extract the title portion
 * from each entry in either source, cache the resulting list, and
 * patch matching elements in the rendered preview on each tick.
 *
 * Matching strategy
 * -----------------
 * The preview renders each publication item as text inside a span
 * with `data-edit-path="items.<i>"` inside a `[data-sid]` whose id
 * contains "publication". For each rendered item:
 *
 *   1. Find the bold node (`<b>` / `<strong>`) if it exists.
 *   2. If its text differs from the index-matched source title,
 *      restore the source title.
 *   3. If there's no bold node (LLM stripped tags), find the first
 *      curly-quoted substring and replace it with the cached title.
 *
 * Index matching matches the cached array against the rendered items
 * in order. We bail safely if counts don't match (e.g., the user added
 * a publication that's not in the cache yet).
 *
 * Escape hatch:
 *   localStorage.antcvDisablePubTitlePreserve = "1"
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.160';

  if (window.__antcvPubTitlesInstalled) return;
  window.__antcvPubTitlesInstalled = SCRIPT_VERSION;

  // ─── localStorage helpers ──────────────────────────────────

  function lsBool(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      let v = raw;
      try { v = JSON.parse(raw); } catch (_) {}
      return v === true || v === 'true' || v === '1' || v === 1;
    } catch (_) { return false; }
  }

  function lsObj(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p && typeof p === 'object') ? p : null;
    } catch (_) { return null; }
  }

  // ─── Source title extraction ───────────────────────────────

  // Pull the title portion out of one publications entry from
  // `personalInfo.publications` (HTML strings like
  // `<b>"Carbon Nanotube Integration Procedures into NEMS Devices"</b>
  // — Karp et al., Eurosensors Conference Proceedings, 2008`).
  //
  // Priority:
  //   1. content of the first <b>...</b> or <strong>...</strong>
  //   2. content of the first curly-quoted substring
  //   3. content of the first straight-quoted substring
  //   4. the substring up to the first em-dash, en-dash, or colon
  // The result is stripped of any outer curly/straight quotes so it
  // matches whatever shape the rendered HTML uses for the bold node's
  // text (which is just the title, no surrounding quotes).
  function extractTitleFromHtmlString(s) {
    if (typeof s !== 'string') return null;
    const trimmed = s.trim();
    if (!trimmed) return null;
    let title = null;
    const boldMatch = trimmed.match(/<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/i);
    if (boldMatch) {
      title = boldMatch[1];
    } else {
      const curlyMatch = trimmed.match(/[\u201C\u2018]([\s\S]+?)[\u201D\u2019]/);
      if (curlyMatch) {
        title = curlyMatch[1];
      } else {
        const straightMatch = trimmed.match(/"([\s\S]+?)"/);
        if (straightMatch) {
          title = straightMatch[1];
        } else {
          // Fall back to the prefix before the first em-dash, en-dash, or colon.
          const splitMatch = trimmed.match(/^([^\u2014\u2013:]+)/);
          title = splitMatch ? splitMatch[1] : trimmed;
        }
      }
    }
    if (title == null) return null;
    // Strip any surviving HTML tags
    title = title.replace(/<[^>]+>/g, '');
    // Strip outer curly/straight quotes if present
    title = title.replace(/^["\u201C\u2018]+/, '').replace(/["\u201D\u2019]+$/, '');
    title = title.trim();
    return title || null;
  }

  // Read the source titles list from personalInfo. Order matters
  // (we index-match against rendered items).
  function readSourceTitles() {
    const pi = lsObj('personalInfo');
    if (!pi) return [];
    const titles = [];
    if (Array.isArray(pi.publications)) {
      pi.publications.forEach(function (item) {
        const t = extractTitleFromHtmlString(item);
        if (t) titles.push(t);
      });
    }
    // If publicationsStructured exists and yields the same count or
    // more, prefer it — the `name` field is the canonical title and
    // doesn't risk markup mismatches.
    if (Array.isArray(pi.publicationsStructured)) {
      const structured = [];
      pi.publicationsStructured.forEach(function (it) {
        if (it && typeof it === 'object' && typeof it.name === 'string' && it.name.trim()) {
          // Strip outer quotes/colons from publicationsStructured.name
          // ("Patent No. 241997:" → keep colon since that's part of
          // the title in Gabriel's data, but strip surrounding quotes
          // if present).
          let n = it.name.trim();
          n = n.replace(/^["\u201C\u2018]+/, '').replace(/["\u201D\u2019]+$/, '');
          structured.push(n);
        }
      });
      if (structured.length >= titles.length) return structured;
    }
    return titles;
  }

  // ─── Preview detection & patching ──────────────────────────

  // Find the publications section in the rendered preview. We
  // prefer `[data-sid*="publication"]`. If that misses, we fall
  // back to a heading-text scan: any [data-sid] whose first 200
  // chars of textContent contain "PUBLICATION" / "PATENT" /
  // "PUBLIKATION" (Danish heading variant).
  function findPublicationsSections() {
    const out = [];
    const candidates = document.querySelectorAll('[data-antcv-preview-paper] [data-sid]');
    candidates.forEach(function (sec) {
      const sid = (sec.getAttribute('data-sid') || '').toLowerCase();
      if (sid && (sid.indexOf('publication') >= 0 || sid === 'pubs' || sid === 'pub')) {
        out.push(sec);
      }
    });
    if (out.length === 0) {
      candidates.forEach(function (sec) {
        const head = (sec.textContent || '').slice(0, 200).toUpperCase();
        if (/PUBLICATION|PATENT|PUBLIKATION/.test(head)) {
          out.push(sec);
        }
      });
    }
    return out;
  }

  // For each rendered publication item, restore the title portion
  // by index-matching against the cached source titles.
  function restoreTitlesInSection(section, sourceTitles) {
    if (!section || !Array.isArray(sourceTitles) || sourceTitles.length === 0) return 0;
    const items = section.querySelectorAll('[data-edit-path]');
    if (!items.length) return 0;
    let restored = 0;
    items.forEach(function (item, idx) {
      if (idx >= sourceTitles.length) return;
      const sourceTitle = sourceTitles[idx];
      if (!sourceTitle) return;

      // First-choice: a bold/italic node inside the item.
      const bold = item.querySelector('b, strong, i, em');
      if (bold) {
        const cur = (bold.textContent || '').trim();
        // Strip outer curly/straight quotes for the EQUALITY check —
        // the source title arrives without surrounding quotes (we
        // stripped them in extractTitleFromHtmlString) so comparing
        // `"Title"` against `Title` would always fire restore and
        // destructively drop the quotes. Normalise both sides.
        const stripOuterQuotes = function (str) {
          return str.replace(/^["\u201C\u2018]+/, '').replace(/["\u201D\u2019]+$/, '');
        };
        const norm = function (s) { return stripOuterQuotes(s).replace(/\s+/g, ' ').trim(); };
        const curStripped = stripOuterQuotes(cur);
        if (norm(curStripped).toLowerCase() === norm(sourceTitle).toLowerCase()) return;
        // Preserve outer quote wrapping when restoring so the styled
        // bold runs read identically — open and close quote glyphs
        // detected on the CURRENT text are re-applied to the source.
        const openMatch = cur.match(/^(["\u201C\u2018])/);
        const closeMatch = cur.match(/(["\u201D\u2019])$/);
        const openQuote = openMatch ? openMatch[1] : '';
        const closeQuote = closeMatch ? closeMatch[1] : '';
        bold.textContent = openQuote + sourceTitle + closeQuote;
        item.dataset.antcvPubTitleRestored = String(idx);
        restored++;
        return;
      }

      // Fallback: no bold node — replace the first curly- or
      // straight-quoted substring in the text.
      const text = item.textContent || '';
      const curlyMatch = text.match(/([\u201C\u2018])([\s\S]+?)([\u201D\u2019])/);
      const straightMatch = !curlyMatch ? text.match(/(")([\s\S]+?)(")/) : null;
      const m = curlyMatch || straightMatch;
      if (!m) return;
      const wholeMatch = m[0];
      const openQuote = m[1];
      const closeQuote = m[3];
      const newQuoted = openQuote + sourceTitle + closeQuote;
      if (wholeMatch === newQuoted) return;
      // Walk text nodes to do an exact-substring replace without
      // damaging surrounding HTML structure.
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const v = node.nodeValue || '';
        const i = v.indexOf(wholeMatch);
        if (i >= 0) {
          node.nodeValue = v.slice(0, i) + newQuoted + v.slice(i + wholeMatch.length);
          item.dataset.antcvPubTitleRestored = String(idx);
          restored++;
          break;
        }
      }
    });
    return restored;
  }

  // ─── Tick / observer ───────────────────────────────────────

  function tick() {
    try {
      if (lsBool('antcvDisablePubTitlePreserve')) return;
      const sourceTitles = readSourceTitles();
      if (sourceTitles.length === 0) return;
      const sections = findPublicationsSections();
      sections.forEach(function (sec) {
        restoreTitlesInSection(sec, sourceTitles);
      });
    } catch (_) {}
  }

  [0, 100, 400, 1000, 2500].forEach(function (d) {
    if (d === 0) tick();
    else setTimeout(tick, d);
  });

  try {
    const mo = new MutationObserver(function () { tick(); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}

  setInterval(tick, 2000);

  // ─── Test/debug API ────────────────────────────────────────

  window.AntcvPubTitles = {
    version: SCRIPT_VERSION,
    _extractTitleFromHtmlString: extractTitleFromHtmlString,
    _readSourceTitles: readSourceTitles,
    _findPublicationsSections: findPublicationsSections,
    _restoreTitlesInSection: restoreTitlesInSection,
    _tick: tick,
  };
})();
