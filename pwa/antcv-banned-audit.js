/* AntCV banned-word enforcement audit (v1.40.172)
 * ============================================================
 *
 * The LLM is told (in the system prompt) to avoid certain words and
 * phrases the user has banned. This sidecar verifies it actually
 * obeys. After every LLM-driven section update it scans the new
 * content for banned terms and surfaces hits in three ways:
 *
 *   1. console.warn with a flat list of (section, term, snippet)
 *      tuples.
 *   2. A `window.__antcvBannedHits` global keeping the last report
 *      for inspection.
 *   3. A custom event `antcv:banned-hits` on window, so a future UI
 *      layer can highlight offending text in the preview without
 *      touching this sidecar.
 *
 * The audit reads two stylePrefs strings (comma/newline-separated):
 *   personalInfo.stylePrefs.banned_words   — single-word terms
 *   personalInfo.stylePrefs.banned_phrases — multi-word phrases
 *
 * Match rules
 * -----------
 *   Words   : case-insensitive whole-word match (\b…\b) so
 *             "lead" doesn't false-match "leadership" but does
 *             match "Lead".
 *   Phrases : case-insensitive substring search. A phrase IS a
 *             multi-word string; partial-word matches inside
 *             longer words are accepted (matches the LLM prompt
 *             semantics).
 *
 * Scope
 * -----
 *   Audits these section shapes:
 *     - text / text_inline       : section.content
 *     - text_bullets             : intro + items[] + closing
 *     - bullets ({b,t})          : per-item b + t
 *     - table                    : rows flattened
 *     - foundation               : hands_on + professionally
 *     - experience               : each role's bullets[]
 *
 * It does NOT audit user-typed content unless the user explicitly
 * asks via the public API. The 'antcv:sections-updated' event's
 * `detail.source` is checked so that manual edits don't trigger
 * console noise — only LLM-driven updates do (source matches
 * /generate|enrich|translate|merge|kernel/i).
 *
 * Public API
 * ----------
 *   window.AntcvBannedAudit.audit(text)
 *     → { hits: [{term, type, index, snippet}], cleanText: text }
 *
 *   window.AntcvBannedAudit.auditSections(sections, opts?)
 *     → { hits: [{sectionId, doc, term, type, snippet}], scannedCount }
 *
 *   window.AntcvBannedAudit.lastReport
 *     Last full audit report.
 *
 *   window.AntcvBannedAudit.refresh()
 *     Force a full re-audit of current sections.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.993-banned-baseline';

  if (window.__antcvBannedAuditInstalled) return;
  window.__antcvBannedAuditInstalled = SCRIPT_VERSION;

  // ─── Storage helpers ─────────────────────────────────────────────
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (_) { return fallback; }
    },
  };

  // ─── Term parsing ────────────────────────────────────────────────
  // Split on commas and newlines, trim, drop empties + duplicates.
  function parseTerms(raw) {
    if (!raw || typeof raw !== 'string') return [];
    const seen = new Set();
    const out = [];
    raw.split(/[,\n]+/).forEach(function (t) {
      const v = String(t || '').trim().toLowerCase();
      if (!v || seen.has(v)) return;
      seen.add(v);
      out.push(v);
    });
    return out;
  }

  // System-level baseline banned words enforced regardless of user
  // prefs. Added for GEN-004 (UI/UX bugfix plan P0-A): "Compress" is
  // never the right wording — "Fit" is. The audit reports any
  // surviving user-facing use of "compress" so per-section migrations
  // in later phases can clear it from the UI.
  //
  // Add ONLY system-mandated terms here. User-facing customisation
  // belongs in personalInfo.stylePrefs.banned_words.
  // BANNED-BASELINE-TEMPLATE-001 (owner 2026-06-30): the generic CL template's banned
  // vocabulary, enforced as the GLOBAL floor (merged with the user's own banned_words) so the
  // audit flags them and enhance/fix-it honours them — matching the generation prompt rule.
  // Bare "deliver"/"drive" are NOT here (too broad — "delivery"/"driven" are fine); the vague
  // uses are caught as the phrase "drive change" + the generation prompt's "vague deliver" note.
  const BASELINE_WORDS = ['compress',
    'spearhead', 'ensure', 'foster', 'streamline', 'strengthen', 'empower',
    'leverage', 'enable', 'robust', 'comprehensive', 'cutting-edge',
    'state-of-the-art', 'world-class', 'leading', 'impactful', 'rooted',
    'grounded', 'committed', 'passionate', 'holistic', 'cross-functional',
    'collaborative', 'journey', 'dynamic', 'proactive', 'results-driven',
    'strategic', 'agile', 'discuss', 'moreover', 'therefore', 'furthermore'];
  const BASELINE_PHRASES = [
    'drive change', 'deliver value', 'key role', 'pivotal role',
    'proven track record', 'strong communicator', 'strategic mindset',
    'mission-driven', 'I am passionate about', 'responsible for', 'end-to-end',
    'I look forward to hearing from you', 'I thrive in', 'My expertise lies in'];

  function mergeUnique(a, b) {
    const seen = new Set();
    const out = [];
    function add(v) {
      const s = String(v || '').trim().toLowerCase();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    }
    (a || []).forEach(add);
    (b || []).forEach(add);
    return out;
  }

  function readPrefs() {
    const pi = Store.get('personalInfo', {}) || {};
    const sp = pi.stylePrefs || {};
    return {
      words:   mergeUnique(parseTerms(sp.banned_words),   BASELINE_WORDS),
      phrases: mergeUnique(parseTerms(sp.banned_phrases), BASELINE_PHRASES),
    };
  }

  // ─── Match engine ────────────────────────────────────────────────

  // Escape a string for safe insertion into a RegExp.
  function rxEscape(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Build the regex for one banned word. Use \b…\b so "lead" doesn't
  // match "leadership". Case-insensitive. Words containing hyphens or
  // apostrophes are still safe because \b honors them as boundaries.
  function buildWordRegex(word) {
    return new RegExp('\\b' + rxEscape(word) + '\\b', 'gi');
  }

  function snippetAround(text, idx, len) {
    const before = Math.max(0, idx - 30);
    const after = Math.min(text.length, idx + len + 30);
    let s = text.slice(before, after).replace(/\s+/g, ' ');
    if (before > 0) s = '…' + s;
    if (after < text.length) s = s + '…';
    return s;
  }

  // Scan a single text for banned terms. Returns an array of hits.
  function auditText(text, prefs) {
    if (!text || typeof text !== 'string') return { hits: [], cleanText: text || '' };
    const p = prefs || readPrefs();
    const hits = [];

    for (let i = 0; i < p.words.length; i++) {
      const word = p.words[i];
      const rx = buildWordRegex(word);
      let m;
      while ((m = rx.exec(text)) !== null) {
        hits.push({
          term: word,
          type: 'word',
          index: m.index,
          snippet: snippetAround(text, m.index, m[0].length),
        });
        // Bail out after the first match per word to avoid noise;
        // the user just needs to know the word slipped through, not
        // every occurrence.
        break;
      }
    }

    const lower = text.toLowerCase();
    for (let i = 0; i < p.phrases.length; i++) {
      const phrase = p.phrases[i];
      const idx = lower.indexOf(phrase);
      if (idx >= 0) {
        hits.push({
          term: phrase,
          type: 'phrase',
          index: idx,
          snippet: snippetAround(text, idx, phrase.length),
        });
      }
    }

    return { hits: hits, cleanText: text };
  }

  // ─── Section extraction ──────────────────────────────────────────
  // Walk a section and return a list of text-bearing slots. Each
  // slot is { path: 'content'|'intro'|'closing'|'items[0]'|…, text: '…' }.
  function slotsForSection(section) {
    if (!section) return [];
    const out = [];
    const t = section.type;
    if (t === 'text' || t === 'text_inline') {
      if (section.content) out.push({ path: 'content', text: String(section.content) });
    } else if (t === 'text_bullets') {
      if (section.intro)   out.push({ path: 'intro',   text: String(section.intro) });
      if (Array.isArray(section.items)) {
        section.items.forEach(function (it, i) {
          if (typeof it === 'string' && it) out.push({ path: 'items[' + i + ']', text: it });
          else if (it && typeof it === 'object' && (it.text || it.t || it.b)) {
            out.push({ path: 'items[' + i + ']', text: [it.b, it.t, it.text].filter(Boolean).join(' ') });
          }
        });
      }
      if (section.closing) out.push({ path: 'closing', text: String(section.closing) });
    } else if (t === 'bullets') {
      if (Array.isArray(section.items)) {
        section.items.forEach(function (it, i) {
          if (!it) return;
          if (typeof it === 'string') out.push({ path: 'items[' + i + ']', text: it });
          else {
            const b = it.b ? String(it.b) : '';
            const tt = it.t ? String(it.t) : '';
            if (b || tt) out.push({ path: 'items[' + i + ']', text: (b + ' ' + tt).trim() });
          }
        });
      }
    } else if (t === 'table') {
      if (Array.isArray(section.rows)) {
        section.rows.forEach(function (row, ri) {
          if (!Array.isArray(row)) return;
          row.forEach(function (cell, ci) {
            if (cell && typeof cell === 'string') {
              out.push({ path: 'rows[' + ri + '][' + ci + ']', text: cell });
            } else if (cell && typeof cell === 'object' && (cell.text || cell.strategicExpertise || cell.focusArea)) {
              const text = String(cell.text || cell.strategicExpertise || cell.focusArea || '');
              if (text) out.push({ path: 'rows[' + ri + '][' + ci + ']', text: text });
            }
          });
        });
      }
    }
    // Foundation-shape (hands_on / professionally) — id-based, not type-based
    if (section.id === 'foundation') {
      if (section.hands_on)       out.push({ path: 'hands_on',       text: String(section.hands_on) });
      if (section.professionally) out.push({ path: 'professionally', text: String(section.professionally) });
    }
    // Experience roles
    if (section.id === 'experience' && Array.isArray(section.roles)) {
      section.roles.forEach(function (role, ri) {
        if (!role || role.on === false) return;
        if (Array.isArray(role.bullets)) {
          role.bullets.forEach(function (bul, bi) {
            if (bul && typeof bul === 'string') {
              out.push({ path: 'roles[' + ri + '].bullets[' + bi + ']', text: bul });
            }
          });
        }
      });
    }
    return out;
  }

  function auditSections(sections, opts) {
    const prefs = (opts && opts.prefs) || readPrefs();
    const out = { hits: [], scannedCount: 0 };
    if (!sections || !prefs.words.length && !prefs.phrases.length) {
      // No banned terms configured — nothing to audit.
      return out;
    }
    ['cv', 'cl'].forEach(function (doc) {
      const arr = sections && sections[doc];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (section) {
        if (!section) return;
        const slots = slotsForSection(section);
        slots.forEach(function (slot) {
          out.scannedCount++;
          const r = auditText(slot.text, prefs);
          if (r.hits.length) {
            r.hits.forEach(function (h) {
              out.hits.push({
                doc: doc,
                sectionId: section.id,
                path: slot.path,
                term: h.term,
                type: h.type,
                snippet: h.snippet,
              });
            });
          }
        });
      });
    });
    return out;
  }

  // ─── Reporting ───────────────────────────────────────────────────

  let lastReport = null;
  let dedupeKey = '';

  function reportToConsole(report) {
    if (!report || !report.hits || !report.hits.length) return;
    try {
      console.groupCollapsed(
        '%c[antcv banned-audit] ' + report.hits.length + ' hit' + (report.hits.length === 1 ? '' : 's'),
        'color:#d97706;font-weight:600'
      );
      report.hits.forEach(function (h) {
        console.warn(
          '· ' + h.doc.toUpperCase() + ' ' + h.sectionId + '.' + h.path +
          '  [' + h.type + ' "' + h.term + '"]  ' + h.snippet
        );
      });
      console.groupEnd();
    } catch (_) {}
  }

  function dispatchEvent(report) {
    try {
      window.dispatchEvent(new CustomEvent('antcv:banned-hits', { detail: report }));
    } catch (_) {}
  }

  // ─── Hook into LLM-driven updates ────────────────────────────────

  const LLM_SOURCE_RX = /generate|enrich|translate|merge|kernel|showcase/i;

  function runAudit(source) {
    const sections = Store.get('sections', null) || Store.get('cv_pwa_sections', null);
    if (!sections) return null;
    const report = auditSections(sections);
    report.source = source || 'manual';
    report.at = Date.now();

    // Dedupe — don't spam the console when the same set of hits is
    // generated twice within a single update burst.
    const key = (source || '') + '|' + report.hits.map(function (h) {
      return h.doc + ':' + h.sectionId + ':' + h.path + ':' + h.term;
    }).join('|');
    if (key === dedupeKey) {
      lastReport = report;
      window.__antcvBannedHits = report;
      return report;
    }
    dedupeKey = key;

    lastReport = report;
    window.__antcvBannedHits = report;
    reportToConsole(report);
    dispatchEvent(report);
    return report;
  }

  function onSectionsUpdated(ev) {
    const detail = ev && ev.detail;
    const source = (detail && detail.source) || '';
    if (!LLM_SOURCE_RX.test(source)) return;
    // Wait a tick so the React state settles before re-reading localStorage.
    setTimeout(function () { runAudit(source); }, 80);
  }

  window.addEventListener('antcv:sections-updated', onSectionsUpdated);

  // ─── Public API ──────────────────────────────────────────────────

  window.AntcvBannedAudit = {
    version:        SCRIPT_VERSION,
    audit:          function (text) { return auditText(text); },
    auditSections:  function (sections, opts) { return auditSections(sections || Store.get('sections', null) || Store.get('cv_pwa_sections', null), opts); },
    refresh:        function () { dedupeKey = ''; return runAudit('manual'); },
    get lastReport() { return lastReport; },
    parseTerms:     parseTerms,
    slotsForSection: slotsForSection,
    baselineWords:   BASELINE_WORDS.slice(),
    baselinePhrases: BASELINE_PHRASES.slice(),
  };
})();
