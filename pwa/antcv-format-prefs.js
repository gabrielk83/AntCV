/* AntCV Format Options sidecar (v1.40.172)
 * ============================================================
 * Adds two control groups to the Layout tab in Settings:
 *
 *   1. PROFILE PHOTO SHAPE: circle / rounded / square
 *   2. SECTION FORMATS: per-section dropdown for the major
 *      sections (PROFILE, OUTCOMES, CORE COMPETENCIES,
 *      WORK STYLE, FOUNDATION, HOW I WOULD CONTRIBUTE,
 *      WHO I AM, WHAT I BRING, WHY THIS POSITION). Each
 *      section can be:
 *        - Paragraph
 *        - Bullets             (plain ▪ marker)
 *        - Emoji bullets       (per-item unicode emoji)
 *        - Hybrid 1            (intro line + plain bullets)
 *        - Hybrid 2            (intro line + emoji bullets)
 *        - Hybrid 3            (intro line + emoji bullets + closing line)
 *        - Two-column table    (only where applicable)
 *
 * Emoji handling
 * --------------
 * When an emoji format is selected, the section grows three new
 * fields that survive in localStorage.sections / cv_pwa_sections:
 *   - useEmojiBullets: true
 *   - bulletDefault:   '🎯'     (per-section default emoji)
 *   - emojis:          ['📊', '🏗️', ...]  (parallel to items[])
 * The renderer uses emojis[i] when present, falls back to
 * bulletDefault, and finally to DEFAULT_EMOJI[sectionId].
 * Item count and emoji-array length are kept in sync.
 *
 * Storage
 * -------
 *   localStorage.personalInfo.stylePrefs.photoShape
 *     'circle' | 'rounded' | 'square'      (default 'circle')
 *
 *   localStorage.personalInfo.stylePrefs.sectionFormats
 *     { [sectionId]: 'paragraph'|'bullets'|'emoji_bullets'
 *                   |'hybrid_1'|'hybrid_2'|'hybrid_3'|'table' }
 *     The legacy value 'hybrid' is treated as 'hybrid_1' on read.
 *
 * Conversion strategy
 * -------------------
 * When the user picks a new format for a section, the sidecar
 * rewrites that section's `type` and content shape directly in
 * localStorage.sections (and cv_pwa_sections), then dispatches
 * `antcv:sections-updated` so the React app re-reads and re-renders.
 * No LLM call is needed for the common transforms:
 *   - text_inline   <-> text_bullets (split / join on sentences)
 *   - bullets[{b,t}] -> text_inline / text_bullets (join b+t)
 *   - table          -> text_inline / text_bullets
 *                       (rows become "col1: col2" lines)
 * The reverse paths into `bullets[{b,t}]` (OUTCOMES) or into a
 * fresh `table` from prose are skipped in v1 because they need
 * the LLM to invent column boundaries. Sections already of those
 * types keep their option in the dropdown.
 */
(function () {
  'use strict';

  // ─── Storage helpers ─────────────────────────────────────────────
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        try { window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(value) })); } catch (_) {}
      } catch (e) { console.error('[format-prefs] set failed', key, e); }
    },
  };

  function readPrefs() {
    const pi = Store.get('personalInfo', {}) || {};
    const sp = pi.stylePrefs || {};
    return {
      photoShape: sp.photoShape || 'circle',
      photoContour: sp.photoContour || 'line',
      photoShadow: !!sp.photoShadow,
      sectionFormats: sp.sectionFormats || {},
    };
  }

  function writePhotoShape(shape) {
    const pi = Store.get('personalInfo', {}) || {};
    pi.stylePrefs = pi.stylePrefs || {};
    pi.stylePrefs.photoShape = shape;
    Store.set('personalInfo', pi);
    // Tell the React app to re-render the preview so the new shape shows.
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'format-prefs', kind: 'photoShape' } }));
    } catch (_) {}
  }

  function writePhotoContour(contour) {
    const pi = Store.get('personalInfo', {}) || {};
    pi.stylePrefs = pi.stylePrefs || {};
    pi.stylePrefs.photoContour = contour;
    Store.set('personalInfo', pi);
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'format-prefs', kind: 'photoContour' } })); } catch (_) {}
  }

  function writePhotoShadow(on) {
    const pi = Store.get('personalInfo', {}) || {};
    pi.stylePrefs = pi.stylePrefs || {};
    pi.stylePrefs.photoShadow = !!on;
    Store.set('personalInfo', pi);
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'format-prefs', kind: 'photoShadow' } })); } catch (_) {}
  }

  function writeSectionFormat(sectionId, format) {
    const pi = Store.get('personalInfo', {}) || {};
    pi.stylePrefs = pi.stylePrefs || {};
    pi.stylePrefs.sectionFormats = pi.stylePrefs.sectionFormats || {};
    pi.stylePrefs.sectionFormats[sectionId] = format;
    Store.set('personalInfo', pi);
  }

  // ─── Live section access (for emoji UI in v1.40.172) ─────────────
  function readSectionById(sectionId) {
    for (const key of ['sections', 'cv_pwa_sections']) {
      const cur = Store.get(key, null);
      if (!cur) continue;
      for (const doc of ['cv', 'cl']) {
        if (!Array.isArray(cur[doc])) continue;
        const found = cur[doc].find(s => s && s.id === sectionId);
        if (found) return found;
      }
    }
    return null;
  }

  function updateSectionById(sectionId, mutator) {
    let wrote = false;
    for (const key of ['sections', 'cv_pwa_sections']) {
      const cur = Store.get(key, null);
      if (!cur) continue;
      let changed = false;
      const next = Object.assign({}, cur);
      for (const doc of ['cv', 'cl']) {
        if (!Array.isArray(cur[doc])) continue;
        next[doc] = cur[doc].map(s => {
          if (!s || s.id !== sectionId) return s;
          const patched = mutator(s);
          if (patched !== s) changed = true;
          return patched;
        });
      }
      if (changed) {
        Store.set(key, next);
        wrote = true;
      }
    }
    if (wrote) {
      try {
        window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
          detail: { source: 'format-prefs-emoji', sectionId },
        }));
      } catch (_) {}
    }
    return wrote;
  }

  function setSectionDefaultEmoji(sectionId, emoji) {
    return updateSectionById(sectionId, function (section) {
      if (!section) return section;
      const patch = Object.assign({}, section, { bulletDefault: emoji });
      // Propagate to existing emoji slots that match the OLD default
      // or are empty. Manually-set emojis (anything else) are kept.
      if (Array.isArray(section.emojis)) {
        const old = section.bulletDefault;
        patch.emojis = section.emojis.map(function (e) {
          if (!e || (old && e === old)) return emoji;
          return e;
        });
      }
      return patch;
    });
  }

  function regenerateEmojisForSection(sectionId) {
    return updateSectionById(sectionId, function (section) {
      if (!section || !section.useEmojiBullets) return section;
      const items = section.items || [];
      // Pass empty prev so the keyword picker wins on every slot,
      // ignoring previous emojis even if user had set them.
      const newEmojis = populateEmojisForItems(section, items, []);
      return Object.assign({}, section, { emojis: newEmojis });
    });
  }

  // ─── Section content conversions ─────────────────────────────────
  // Conversions are deliberately conservative: when in doubt, preserve
  // the original text and let the renderer do its best. We never throw
  // away data — content always survives the round-trip.
  function splitSentences(text) {
    if (!text || typeof text !== 'string') return [];
    // Split on terminal punctuation followed by whitespace + uppercase
    // letter, OR on ' — ' / ' - ' separators. Keep sentence ends.
    const parts = text
      .split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/g)
      .map(s => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : (text.trim() ? [text.trim()] : []);
  }

  function flattenToParagraph(section) {
    if (!section) return '';
    switch (section.type) {
      case 'text':
      case 'text_inline':
        return String(section.content || '').trim();
      case 'text_bullets': {
        const intro = String(section.intro || '').trim();
        const items = (section.items || []).map(s => String(s || '').trim()).filter(Boolean);
        return [intro, items.join('. ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      }
      case 'bullets': {
        // {b, t} items
        const items = (section.items || []).map(it => {
          if (!it) return '';
          if (typeof it === 'string') return it;
          const b = String(it.b || '').trim();
          const t = String(it.t || '').trim();
          if (b && t) return `${b} ${t}`;
          return b || t;
        }).filter(Boolean);
        return items.join('. ');
      }
      case 'table': {
        if (!Array.isArray(section.rows)) return '';
        return section.rows
          .map(r => Array.isArray(r) ? r.filter(Boolean).join(': ') : '')
          .filter(Boolean)
          .join('. ');
      }
      default:
        return '';
    }
  }

  function flattenToBulletItems(section) {
    if (!section) return [];
    switch (section.type) {
      case 'text':
      case 'text_inline':
        return splitSentences(section.content || '');
      case 'text_bullets':
        return [
          ...(section.intro ? [String(section.intro).trim()] : []),
          ...(section.items || []).map(s => String(s || '').trim()).filter(Boolean),
        ];
      case 'bullets':
        return (section.items || []).map(it => {
          if (!it) return '';
          if (typeof it === 'string') return it;
          const b = String(it.b || '').trim();
          const t = String(it.t || '').trim();
          if (b && t) return `${b} — ${t}`;
          return b || t;
        }).filter(Boolean);
      case 'table':
        return Array.isArray(section.rows)
          ? section.rows.map(r => Array.isArray(r) ? r.filter(Boolean).join(': ') : '').filter(Boolean)
          : [];
      default:
        return [];
    }
  }

  // Build a parallel emoji array for an items[] of length n. Uses the
  // section's existing per-item emojis where they exist, falls back to
  // the section's default emoji, and finally to the section-id default.
  function buildEmojiArray(section, n) {
    const fallback = (section && section.bulletDefault) || defaultEmojiFor(section && section.id);
    const existing = Array.isArray(section && section.emojis) ? section.emojis : [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const cur = existing[i];
      out.push(typeof cur === 'string' && cur.trim() ? cur : fallback);
    }
    return out;
  }

  // Apply a format choice to one section in-place (returns a new section object).
  function applyFormatToSection(section, format) {
    if (!section || !format || format === 'default') return section;
    // Legacy alias: 'hybrid' has been split into hybrid_1/2/3. Treat the
    // bare value as hybrid_1 for backward compatibility with stored prefs.
    if (format === 'hybrid') format = 'hybrid_1';
    const id = section.id;

    if (format === 'paragraph') {
      const text = flattenToParagraph(section);
      return Object.assign({}, section, {
        type: 'text_inline',
        content: text,
        items: undefined, rows: undefined, intro: undefined, closing: undefined,
        useEmojiBullets: false,
      });
    }

    if (format === 'bullets') {
      // Plain bullet list, no intro, no emoji.
      if (section.type === 'bullets' && Array.isArray(section.items) && section.items.length && typeof section.items[0] === 'object') {
        // OUTCOMES-style {b, t} bullets — keep the structure, just clear the emoji flag.
        return Object.assign({}, section, { useEmojiBullets: false });
      }
      const items = flattenToBulletItems(section);
      return Object.assign({}, section, {
        type: 'text_bullets',
        intro: '', items, closing: undefined,
        content: undefined, rows: undefined,
        useEmojiBullets: false,
      });
    }

    if (format === 'emoji_bullets') {
      // Same as bullets but with the emoji-mark flag set and a default-emoji
      // array populated so something useful renders immediately.
      if (section.type === 'bullets' && Array.isArray(section.items) && section.items.length && typeof section.items[0] === 'object') {
        // OUTCOMES-style {b, t}: keep the structure but enable emoji prefixes.
        const emojis = populateEmojisForItems(section, section.items, section.emojis);
        return Object.assign({}, section, {
          useEmojiBullets: true,
          emojis,
          bulletDefault: section.bulletDefault || defaultEmojiFor(id),
        });
      }
      const items = flattenToBulletItems(section);
      const emojis = populateEmojisForItems(section, items, section.emojis);
      return Object.assign({}, section, {
        type: 'text_bullets',
        intro: '', items, closing: undefined,
        content: undefined, rows: undefined,
        useEmojiBullets: true,
        emojis,
        bulletDefault: section.bulletDefault || defaultEmojiFor(id),
      });
    }

    if (format === 'hybrid_1' || format === 'hybrid_2' || format === 'hybrid_3') {
      // intro + bullets (1 = plain, 2 = emoji, 3 = emoji + closing line)
      const all = flattenToBulletItems(section);
      const intro = all[0] || '';
      let items = all.slice(1);
      let closing;
      if (format === 'hybrid_3') {
        // Use the last item as the closing paragraph when there are
        // at least 3 sentences total (intro + ≥1 bullet + closing).
        // With only 2 sentences we'd otherwise be left with intro +
        // empty items[] + closing, which renders as an awkward
        // headline-then-coda shape. In that case, degrade gracefully
        // to hybrid_2 shape: intro + 1 emoji bullet, no closing.
        if (items.length >= 2) {
          closing = items[items.length - 1];
          items = items.slice(0, -1);
        } else {
          // 0 or 1 bullets left after pulling the intro — keep them as bullets,
          // preserve any explicit closing the section already had.
          closing = section.closing || '';
        }
      }
      const useEmoji = (format === 'hybrid_2' || format === 'hybrid_3');
      const patch = {
        type: 'text_bullets',
        intro, items,
        content: undefined, rows: undefined,
        useEmojiBullets: useEmoji,
      };
      if (closing !== undefined) patch.closing = closing;
      if (useEmoji) {
        patch.emojis = populateEmojisForItems(section, items, section.emojis);
        patch.bulletDefault = section.bulletDefault || defaultEmojiFor(id);
      }
      return Object.assign({}, section, patch);
    }

    if (format === 'table') {
      // Only sensible if the section already had a table shape. Otherwise leave it.
      if (section.type === 'table' && Array.isArray(section.rows)) return section;
      // Heuristic: convert paragraph "key: value. key: value" into rows.
      const para = flattenToParagraph(section);
      const rows = para
        .split(/[.;]\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const idx = s.indexOf(':');
          return idx > 0 ? [s.slice(0, idx).trim(), s.slice(idx + 1).trim()] : [s, ''];
        })
        .filter(r => r[0]);
      if (rows.length < 2) return section;  // Refuse to make a 0/1-row table.
      return Object.assign({}, section, { type: 'table', rows, content: undefined, items: undefined, intro: undefined, closing: undefined });
    }

    return section;
  }

  function applySectionFormat(sectionId, format) {
    let wrote = false;
    for (const key of ['sections', 'cv_pwa_sections']) {
      const cur = Store.get(key, null);
      if (!cur) continue;
      let changed = false;
      const next = Object.assign({}, cur);
      for (const doc of ['cv', 'cl']) {
        if (!Array.isArray(cur[doc])) continue;
        next[doc] = cur[doc].map(s => {
          if (!s || s.id !== sectionId) return s;
          const updated = applyFormatToSection(s, format);
          if (updated !== s) changed = true;
          return updated;
        });
      }
      if (changed) {
        Store.set(key, next);
        wrote = true;
      }
    }
    writeSectionFormat(sectionId, format);
    if (wrote) {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'format-prefs', kind: 'sectionFormat', sectionId, format },
      }));
    }
    return wrote;
  }

  // ─── Section catalog ─────────────────────────────────────────────
  // The sections the panel exposes. Each entry lists which formats are
  // selectable. We deliberately leave OUTCOMES and CORE COMPETENCIES
  // off the bullets/table flip switches that would lose structure;
  // they still appear with their current type as the default.
  const SECTION_CATALOG = [
    { id: 'profile',     label: 'Profile',                doc: 'cv', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
    { id: 'work_style',  label: 'Work Style',             doc: 'cv', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
    { id: 'core_comp',   label: 'Core Competencies',      doc: 'cv', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3', 'table'] },
    { id: 'outcomes',    label: 'Selected Outcomes',      doc: 'cv', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
    { id: 'foundation',  label: 'Foundation',             doc: 'cv', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
    { id: 'who',         label: 'Who I Am',               doc: 'cl', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
    { id: 'bring',       label: 'What I Bring',           doc: 'cl', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3', 'table'] },
    { id: 'why',         label: 'Why This Position',      doc: 'cl', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
    { id: 'contribute',  label: 'How I Would Contribute', doc: 'cl', allow: ['paragraph', 'bullets', 'emoji_bullets', 'hybrid_1', 'hybrid_2', 'hybrid_3'] },
  ];

  const FORMAT_LABELS = {
    paragraph:     'Paragraph',
    bullets:       'Bullets',
    emoji_bullets: 'Emoji bullets',
    hybrid_1:      'Hybrid 1 (intro + bullets)',
    hybrid_2:      'Hybrid 2 (intro + emoji bullets)',
    hybrid_3:      'Hybrid 3 (intro + emoji bullets + closing)',
    hybrid:        'Hybrid 1 (intro + bullets)',   // legacy alias kept for migration
    table:         'Two-column table',
    default:       'Default',
  };

  // Sensible default emoji per section id — picked once when the user
  // switches to an emoji format. The LLM Enrich pass can refine these
  // to fit the content of each individual line; user can override per item.
  const DEFAULT_EMOJI = {
    profile:    '👤',
    work_style: '🧭',
    core_comp:  '🎯',
    outcomes:   '📊',
    foundation: '🏗️',
    who:        '👤',
    bring:      '🎁',
    why:        '💡',
    contribute: '🚀',
    tools:      '🛠️',
    certs:      '📜',
    education:  '🎓',
    regulatory: '⚖️',
    additional: '✨',
    publications: '📚',
  };
  function defaultEmojiFor(id) {
    return DEFAULT_EMOJI[id] || '•';
  }

  // ─── Context-aware emoji picker ──────────────────────────────────
  // Given a bullet's text content, choose an emoji whose meaning
  // matches the action or domain. Falls back through (a) the
  // section's bulletDefault, (b) the section-id default, (c) '•'.
  //
  // The keyword list is ORDERED from most specific to most general
  // so 'safety audit' resolves to ⚖️ (compliance), not ✅ (quality).
  // Patterns match English and Danish so the picker still works on
  // translated content. Each pattern is case-insensitive.
  const EMOJI_KEYWORDS = [
    // Compliance, regulatory, safety standards
    [/\b(safety|compliance|regulator|audit|standard|iso|iec|fda|mdr|gdpr|sotif|sikkerhed|krav)\b/i, '⚖️'],
    // Risk / mitigation
    [/\b(risk|mitig|prevent|hazard|risiko|forebyg)\b/i, '🛡️'],
    // Reduce / cut / shorten / save
    [/\b(reduced|cut|decreased|shortened|trimmed|streamlin|less|fewer|reducerede|skar|forkortede|sparede)\b/i, '📉'],
    // Increase / scale / grow
    [/\b(increased|grew|raised|scaled|boosted|doubl|tripl|expanded|øgede|skalerede|udvidede)\b/i, '📈'],
    // Launch / ship / deploy
    [/\b(launched|shipped|released|deployed|delivered|rolled out|leverede|lancerede|udrullede)\b/i, '🚀'],
    // Build / develop / construct
    [/\b(built|developed|created|designed|crafted|construct|implementer|byggede|udviklede|skabte|implementerede)\b/i, '🏗️'],
    // Lead / supervise / manage people
    [/\b(led|managed|supervised|directed|coordinated|chaired|orchestrat|mentor|trained|ledte|styrede|koordinerede|ledede)\b/i, '👥'],
    // Measurement / testing / validation
    [/\b(measured|tested|validat|verified|qualif|character|benchmark|måling|testede|validerede|verificerede)\b/i, '🧪'],
    // Documentation / writing — placed before "systems" so "Wrote technical specs for the system" picks 📝, not 🏛️.
    [/\b(document|wrote|authored|specified|defined|drafted|dokument|skrev|forfattede)\b/i, '📝'],
    // Architect / system / infrastructure
    [/\b(architect|systems?|infrastructure|platform|framework|arkitekt|systemer)\b/i, '🏛️'],
    // Automation / scripting / tooling
    [/\b(automat|scripted|programmed|tooling|pipeline|ci\/cd|automatiserede|skriptede)\b/i, '⚙️'],
    // Optimize / improve / enhance
    [/\b(optimi[sz]ed|improved|enhanced|tuned|refined|optimerede|forbedrede)\b/i, '⚡'],
    // Optics / imaging / sensors
    [/\b(optic|optisk|laser|imaging|lidar|sensor|camera|kamera|wavelength|nm |photon)\b/i, '🔬'],
    // Software / code / API
    [/\b(python|matlab|labview|software|programm|api|sdk|library|kode|programmel)\b/i, '💻'],
    // Data / analytics / KPI
    [/\b(data|analyt|metric|report|dashboard|kpi|insight|analyse|rapport|nøgletal)\b/i, '📊'],
    // Security / encryption
    [/\b(security|encrypt|protect|secure|sikkerhed|kryptering|beskyttede)\b/i, '🔐'],
    // Collaboration / stakeholder / team
    [/\b(collabor|partner|stakeholder|team|cross[\s-]?function|samarbejde|interessent)\b/i, '🤝'],
    // Cost / budget / savings
    [/\b(cost|budget|saving|spend|invest|omkostning|budget|besparelse)\b/i, '💰'],
    // Customer / client
    [/\b(customer|client|user|end[\s-]?user|kunde|bruger)\b/i, '👤'],
    // Training / education / mentoring
    [/\b(training|workshop|onboard|mentor|coach|teach|kursus|undervis|onboarding)\b/i, '🎓'],
    // Research / investigation / analysis
    [/\b(research|investig|stud|analy[sz]|review|forskning|undersøg|analyserede)\b/i, '🔍'],
    // Strategy / roadmap / vision
    [/\b(strategy|roadmap|plan|vision|direction|strategi|køreplan)\b/i, '🗺️'],
    // Quality / bug / fix
    [/\b(quality|defect|bug|fix|issue|repair|kvalitet|fejl|rettede)\b/i, '✅'],
    // Change / transform / migration
    [/\b(change|transform|migrat|restructur|refactor|ændrede|transformerede|migrerede)\b/i, '🔄'],
  ];

  function emojiForBullet(text, fallback) {
    if (!text || typeof text !== 'string') return fallback || '•';
    const s = text.trim();
    if (!s) return fallback || '•';
    for (let i = 0; i < EMOJI_KEYWORDS.length; i++) {
      const pair = EMOJI_KEYWORDS[i];
      if (pair[0].test(s)) return pair[1];
    }
    return fallback || '•';
  }

  // Build a parallel emoji array for items. Each emoji is chosen by:
  //   1. existing emojis[i] if non-empty (preserves manual overrides)
  //   2. keyword match against the item's text content
  //   3. section.bulletDefault
  //   4. DEFAULT_EMOJI[section.id]
  //   5. '•'
  function populateEmojisForItems(section, items, prevEmojis) {
    const sectionFallback = (section && section.bulletDefault) || defaultEmojiFor(section && section.id);
    const prev = Array.isArray(prevEmojis) ? prevEmojis : (Array.isArray(section && section.emojis) ? section.emojis : []);
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const existing = prev[i];
      if (typeof existing === 'string' && existing.trim()) {
        out.push(existing);
        continue;
      }
      const item = items[i];
      let text = '';
      if (typeof item === 'string') text = item;
      else if (item && typeof item === 'object') {
        const b = String(item.b || '').trim();
        const t = String(item.t || '').trim();
        text = b && t ? (b + ' ' + t) : (b || t);
      }
      out.push(emojiForBullet(text, sectionFallback));
    }
    return out;
  }

  // ─── CSS ─────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .antcv-fp-block {
      /* v1.40.94: visually unified with LINE TARGETS and WORD TEMPLATES
         in the Advanced Styles tab. All three now share the same pattern:
         marginBottom + paddingBottom + bottom-only separator. No own
         bordered box, transparent background, no rounded corners. */
      margin-top: 0;
      margin-bottom: 14px;
      padding: 0 0 14px 0;
      background: transparent;
      border: 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      border-radius: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .antcv-fp-block h4 {
      margin: 0 0 4px 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.4px;
      color: rgba(255, 255, 255, 0.55);
    }
    .antcv-fp-desc {
      font-size: 11px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 10px;
    }
    .antcv-fp-row {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 0;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .antcv-fp-row:first-of-type { border-top: 0; }
    .antcv-fp-row .lbl {
      flex: 1;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.75);
    }
    .antcv-fp-row .doc-tag {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 3px;
      letter-spacing: 0.4px;
      font-weight: 700;
      margin-left: 4px;
      vertical-align: middle;
    }
    .antcv-fp-row .doc-tag.cv { background: rgba(0,116,110,0.35); color: #b8f0ec; }
    .antcv-fp-row .doc-tag.cl { background: rgba(80,120,180,0.35); color: #c0d4ff; }
    .antcv-fp-select {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 5px;
      color: #fff;
      font-size: 11px;
      padding: 4px 8px;
      font-family: inherit;
      cursor: pointer;
      min-width: 160px;
    }
    .antcv-fp-select:focus { outline: 1px solid rgba(1,183,187,0.6); }
    .antcv-fp-select option {
      background: #1f2a3d;
      color: #fff;
    }
    .antcv-fp-shape-row { display: flex; gap: 6px; margin-top: 4px; }
    .antcv-fp-shape-btn {
      flex: 1;
      padding: 6px 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 5px;
      color: rgba(255,255,255,0.65);
      font-size: 11px;
      cursor: pointer;
      font-family: inherit;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
    }
    .antcv-fp-shape-btn .sw {
      width: 22px; height: 22px;
      background: rgba(1,183,187,0.55);
      border: 1px solid rgba(1,183,187,0.85);
    }
    .antcv-fp-shape-btn[data-shape="circle"]  .sw { border-radius: 50%; }
    .antcv-fp-shape-btn[data-shape="rounded"] .sw { border-radius: 6px; }
    .antcv-fp-shape-btn[data-shape="square"]  .sw { border-radius: 0; }
    .antcv-fp-shape-btn.active {
      background: rgba(1,183,187,0.12);
      border-color: rgba(1,183,187,0.7);
      color: #fff;
    }
    .antcv-fp-note {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.35);
      margin-top: 8px;
      line-height: 1.5;
    }
    .antcv-fp-emoji-input {
      width: 36px;
      padding: 4px 2px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 5px;
      color: #fff;
      font-size: 14px;
      text-align: center;
      font-family: inherit;
      margin-left: 4px;
    }
    .antcv-fp-emoji-input:focus {
      outline: 1px solid rgba(1,183,187,0.6);
    }
    .antcv-fp-emoji-refresh {
      width: 26px;
      height: 26px;
      padding: 0;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 5px;
      color: rgba(255,255,255,0.7);
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      margin-left: 4px;
      line-height: 24px;
    }
    .antcv-fp-emoji-refresh:hover {
      background: rgba(1,183,187,0.15);
      color: #fff;
    }

    /* ─── v1.40.172: section-format explainer card ─────────────── */
    /* A collapsible primer that explains the seven section formats
       with small ghostly SVG illustrations. Sits above the dropdown
       list so users see it the first time they open the card. */
    .antcv-fp-explainer {
      margin: -4px 0 12px 0;
      padding: 0;
    }
    .antcv-fp-explainer summary {
      cursor: pointer;
      user-select: none;
      font-size: 11px;
      color: rgba(1,183,187,0.85);
      letter-spacing: 0.3px;
      padding: 6px 8px;
      border-radius: 4px;
      background: rgba(1,183,187,0.06);
      border: 1px dashed rgba(1,183,187,0.25);
      list-style: none;
    }
    .antcv-fp-explainer summary::before {
      content: "ℹ ";
      color: rgba(1,183,187,0.95);
      font-weight: 700;
    }
    .antcv-fp-explainer summary:hover {
      background: rgba(1,183,187,0.10);
    }
    .antcv-fp-explainer[open] summary {
      margin-bottom: 8px;
    }
    .antcv-fp-explainer-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 6px;
    }
    .antcv-fp-explainer-card {
      padding: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 5px;
    }
    .antcv-fp-explainer-card .title {
      font-size: 10.5px;
      font-weight: 700;
      color: rgba(255,255,255,0.85);
      margin: 0 0 2px 0;
      letter-spacing: 0.2px;
    }
    .antcv-fp-explainer-card .desc {
      font-size: 10px;
      color: rgba(255,255,255,0.55);
      line-height: 1.45;
      margin: 0 0 6px 0;
    }
    .antcv-fp-explainer-card svg {
      width: 100%;
      height: 52px;
      display: block;
    }
    /* The "ghostly" placeholder shapes inside each illustration. */
    .antcv-fp-ghost-line   { fill: rgba(255,255,255,0.25); }
    .antcv-fp-ghost-bullet { fill: rgba(255,255,255,0.55); }
    .antcv-fp-ghost-emoji  { font-size: 11px; opacity: 0.85; }
    .antcv-fp-ghost-rule   { stroke: rgba(1,183,187,0.55); stroke-width: 1; }
    .antcv-fp-ghost-cell   { fill: rgba(0,116,110,0.25); stroke: rgba(0,116,110,0.55); stroke-width: 0.6; }
    .antcv-fp-ghost-cellH  { fill: rgba(0,116,110,0.55); stroke: rgba(0,116,110,0.8); stroke-width: 0.6; }

    /* ─── v1.40.172 mobile audit fix ─────────────────────────────
       On phone-sized viewports the (label) + (select) + (emoji
       input) + (↻ refit) row gets cramped below ~380px. Stack it
       vertically so each control gets its own line and full tap
       target width. The select keeps min-width: 160px, which now
       expands to fill the row instead of fighting for horizontal
       space. */
    @media (max-width: 380px) {
      .antcv-fp-row {
        flex-wrap: wrap;
      }
      .antcv-fp-row .lbl {
        flex-basis: 100%;
        margin-bottom: 4px;
      }
      .antcv-fp-select {
        flex: 1 1 100%;
        min-width: 0;
      }
      .antcv-fp-emoji-input {
        flex: 0 0 44px;
      }
      .antcv-fp-emoji-refresh {
        flex: 0 0 30px;
      }
      .antcv-fp-explainer-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);

  // ─── UI build ────────────────────────────────────────────────────
  // Two independent blocks now:
  //   • buildShapeRow()    — just the shape buttons, appended inside the
  //                          existing PROFILE PHOTO section in the Layout tab
  //   • buildFormatsCard() — section-format dropdowns wrapped in <details>
  //                          (closed by default), appended into the
  //                          Advanced → Style tab
  function buildShapeRow() {
    const prefs = readPrefs();
    const wrap = document.createElement('div');
    wrap.dataset.antcvShapeRow = '1';
    wrap.style.marginTop = '8px';

    const lbl = document.createElement('div');
    lbl.style.cssText = 'color:rgba(255,255,255,0.45);font-size:10px;letterSpacing:0.4px;margin-bottom:4px;text-transform:uppercase';
    lbl.textContent = 'Shape';
    wrap.appendChild(lbl);

    const row = document.createElement('div');
    row.className = 'antcv-fp-shape-row';
    [['circle','Circle'], ['rounded','Rounded'], ['square','Square']].forEach(([val, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'antcv-fp-shape-btn' + (prefs.photoShape === val ? ' active' : '');
      b.dataset.shape = val;
      b.innerHTML = `<span class="sw"></span><span>${label}</span>`;
      b.addEventListener('click', () => {
        writePhotoShape(val);
        Array.from(row.querySelectorAll('.antcv-fp-shape-btn')).forEach(n => n.classList.toggle('active', n.dataset.shape === val));
      });
      row.appendChild(b);
    });
    wrap.appendChild(row);

    // Contour row — line vs soft edge (5pt)
    const contourLbl = document.createElement('div');
    contourLbl.style.cssText = 'color:rgba(255,255,255,0.45);font-size:10px;letterSpacing:0.4px;margin-top:10px;margin-bottom:4px;text-transform:uppercase';
    contourLbl.textContent = 'Contour';
    wrap.appendChild(contourLbl);
    const contourRow = document.createElement('div');
    contourRow.className = 'antcv-fp-shape-row';
    [['line', 'Line'], ['soft', 'Soft edge (5pt)']].forEach(([val, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'antcv-fp-shape-btn' + (prefs.photoContour === val ? ' active' : '');
      b.dataset.contour = val;
      b.textContent = label;
      b.addEventListener('click', () => {
        writePhotoContour(val);
        Array.from(contourRow.querySelectorAll('.antcv-fp-shape-btn')).forEach(n => n.classList.toggle('active', n.dataset.contour === val));
      });
      contourRow.appendChild(b);
    });
    wrap.appendChild(contourRow);

    // Shadow toggle
    const shadowLbl = document.createElement('div');
    shadowLbl.style.cssText = 'color:rgba(255,255,255,0.45);font-size:10px;letterSpacing:0.4px;margin-top:10px;margin-bottom:4px;text-transform:uppercase';
    shadowLbl.textContent = 'Shadow';
    wrap.appendChild(shadowLbl);
    const shadowRow = document.createElement('div');
    shadowRow.className = 'antcv-fp-shape-row';
    [[false, 'Off'], [true, 'On']].forEach(([val, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'antcv-fp-shape-btn' + (prefs.photoShadow === val ? ' active' : '');
      b.dataset.shadow = String(val);
      b.textContent = label;
      b.addEventListener('click', () => {
        writePhotoShadow(val);
        Array.from(shadowRow.querySelectorAll('.antcv-fp-shape-btn')).forEach(n => n.classList.toggle('active', n.dataset.shadow === String(val)));
      });
      shadowRow.appendChild(b);
    });
    wrap.appendChild(shadowRow);

    return wrap;
  }

  // ─── v1.40.172: Section-format explainer card ────────────────────
  // A collapsible primer that sits inside the SECTION FORMATS card
  // above the dropdown rows. Seven ghostly SVG illustrations show
  // what each format looks like on the page, so the user picking
  // from the dropdown has a visual reference. Closed by default so
  // it doesn't crowd power-users who already know the differences.
  function ghostSvg(innerSVG) {
    // viewBox 100x52 is the standard tile shape. Inner shapes use
    // class-based fills defined in the stylesheet for consistency.
    return '<svg viewBox="0 0 100 52" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + innerSVG + '</svg>';
  }

  // SVG building blocks — text lines drawn as rounded rects so the
  // illustration reads as "ghostly placeholder content".
  function lineRect(x, y, w, h) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (h || 2.4) + '" rx="1.2" class="antcv-fp-ghost-line"/>';
  }
  function bulletDot(x, y) {
    return '<rect x="' + x + '" y="' + y + '" width="2.4" height="2.4" rx="0.4" class="antcv-fp-ghost-bullet"/>';
  }
  function emojiAt(x, y, ch) {
    return '<text x="' + x + '" y="' + (y + 2.6) + '" class="antcv-fp-ghost-emoji" fill="rgba(255,255,255,0.9)">' + ch + '</text>';
  }
  function cell(x, y, w, h, isHeader) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" class="' + (isHeader ? 'antcv-fp-ghost-cellH' : 'antcv-fp-ghost-cell') + '"/>';
  }

  // The seven format illustrations. Each is a snippet of SVG inside
  // a 100x52 viewBox showing a stylised page with placeholder text.
  function svgParagraph() {
    return ghostSvg(
      lineRect(8, 10, 84, 2.6) +
      lineRect(8, 18, 84, 2.6) +
      lineRect(8, 26, 80, 2.6) +
      lineRect(8, 34, 74, 2.6) +
      lineRect(8, 42, 62, 2.6)
    );
  }
  function svgBullets() {
    return ghostSvg(
      bulletDot(8, 10) + lineRect(15, 11, 78, 2.4) +
      bulletDot(8, 18) + lineRect(15, 19, 74, 2.4) +
      bulletDot(8, 26) + lineRect(15, 27, 80, 2.4) +
      bulletDot(8, 34) + lineRect(15, 35, 68, 2.4) +
      bulletDot(8, 42) + lineRect(15, 43, 72, 2.4)
    );
  }
  function svgEmojiBullets() {
    return ghostSvg(
      emojiAt(7, 10, '📊') + lineRect(18, 11, 75, 2.4) +
      emojiAt(7, 18, '🚀') + lineRect(18, 19, 70, 2.4) +
      emojiAt(7, 26, '🏗️') + lineRect(18, 27, 77, 2.4) +
      emojiAt(7, 34, '👥') + lineRect(18, 35, 65, 2.4) +
      emojiAt(7, 42, '⚡') + lineRect(18, 43, 72, 2.4)
    );
  }
  function svgHybrid1() {
    // Intro line at top, then bullets.
    return ghostSvg(
      lineRect(8, 9, 84, 2.6) +
      lineRect(8, 14, 68, 2.6) +
      bulletDot(8, 24) + lineRect(15, 25, 76, 2.4) +
      bulletDot(8, 32) + lineRect(15, 33, 80, 2.4) +
      bulletDot(8, 40) + lineRect(15, 41, 68, 2.4)
    );
  }
  function svgHybrid2() {
    // Intro line, then emoji bullets.
    return ghostSvg(
      lineRect(8, 9, 84, 2.6) +
      lineRect(8, 14, 68, 2.6) +
      emojiAt(7, 23, '📊') + lineRect(18, 24, 72, 2.4) +
      emojiAt(7, 31, '🚀') + lineRect(18, 32, 76, 2.4) +
      emojiAt(7, 39, '👥') + lineRect(18, 40, 66, 2.4)
    );
  }
  function svgHybrid3() {
    // Intro, emoji bullets, closing line.
    return ghostSvg(
      lineRect(8, 7, 84, 2.4) +
      lineRect(8, 12, 64, 2.4) +
      emojiAt(7, 20, '📊') + lineRect(18, 21, 72, 2.2) +
      emojiAt(7, 27, '🚀') + lineRect(18, 28, 76, 2.2) +
      emojiAt(7, 34, '👥') + lineRect(18, 35, 66, 2.2) +
      lineRect(8, 42, 80, 2.4) +
      lineRect(8, 46, 60, 2.4)
    );
  }
  function svgTable() {
    // Two-column key/value grid with header row.
    const colW = 40, rowH = 7.5, x0 = 9, y0 = 9;
    let s = '';
    // header
    s += cell(x0,          y0, colW, rowH, true);
    s += cell(x0 + colW,   y0, colW, rowH, true);
    s += lineRect(x0 + 4, y0 + 2.6, colW - 10, 2.4);
    s += lineRect(x0 + colW + 4, y0 + 2.6, colW - 10, 2.4);
    // body rows
    for (let r = 1; r <= 3; r++) {
      const y = y0 + r * rowH;
      s += cell(x0,          y, colW, rowH, false);
      s += cell(x0 + colW,   y, colW, rowH, false);
      s += lineRect(x0 + 4, y + 2.6, colW - 14, 2.2);
      s += lineRect(x0 + colW + 4, y + 2.6, colW - 8, 2.2);
    }
    return ghostSvg(s);
  }

  const EXPLAINER_TILES = [
    { title: 'Paragraph',          desc: 'Pure prose. Best when the content reads naturally as a few sentences in a row.', svg: svgParagraph },
    { title: 'Bullets',            desc: 'Plain ▪ markers. Best for short, parallel items.', svg: svgBullets },
    { title: 'Emoji bullets',      desc: 'Each bullet gets an emoji picked to fit its content (📉 for "reduced", 🚀 for "launched"…).', svg: svgEmojiBullets },
    { title: 'Hybrid 1',           desc: 'Intro line, then plain bullets. Frames the bullets with one factual setup sentence.', svg: svgHybrid1 },
    { title: 'Hybrid 2',           desc: 'Intro line, then emoji bullets. Same shape as Hybrid 1 with content-fitted emojis.', svg: svgHybrid2 },
    { title: 'Hybrid 3',           desc: 'Intro + emoji bullets + closing line. Full narrative arc for cover-letter sections.', svg: svgHybrid3 },
    { title: 'Two-column table',   desc: 'Key/value pairs. Best for Core Competencies and What I Bring.', svg: svgTable },
  ];

  function buildExplainerCard() {
    // Pull from i18n if loaded, else use English literals. The
    // localisation audit (v1.40.172) added an EN+DA dictionary in
    // antcv-i18n.js; load order in index.html puts i18n before
    // format-prefs so t() is always available by the time this
    // builder runs, but the optional-chain is defensive.
    const t = (window.AntcvI18n && window.AntcvI18n.t) || function (k, fallback) { return fallback; };

    const det = document.createElement('details');
    det.className = 'antcv-fp-explainer';
    det.dataset.antcvFormatExplainer = '1';

    const sum = document.createElement('summary');
    sum.textContent = t('explainer.show', 'Show me what each format looks like');
    det.appendChild(sum);

    const grid = document.createElement('div');
    grid.className = 'antcv-fp-explainer-grid';

    // Map our hand-coded tiles to i18n keys. Order matches EXPLAINER_TILES.
    const TILE_I18N = [
      { titleKey: 'explainer.paragraph',     descKey: 'explainer.paragraph_desc' },
      { titleKey: 'explainer.bullets',       descKey: 'explainer.bullets_desc' },
      { titleKey: 'explainer.emoji_bullets', descKey: 'explainer.emoji_bullets_desc' },
      { titleKey: 'explainer.hybrid_1',      descKey: 'explainer.hybrid_1_desc' },
      { titleKey: 'explainer.hybrid_2',      descKey: 'explainer.hybrid_2_desc' },
      { titleKey: 'explainer.hybrid_3',      descKey: 'explainer.hybrid_3_desc' },
      { titleKey: 'explainer.table',         descKey: 'explainer.table_desc' },
    ];

    EXPLAINER_TILES.forEach(function (entry, i) {
      const keys = TILE_I18N[i] || {};
      const tile = document.createElement('div');
      tile.className = 'antcv-fp-explainer-card';

      const h = document.createElement('div');
      h.className = 'title';
      h.textContent = t(keys.titleKey, entry.title);
      tile.appendChild(h);

      const d = document.createElement('div');
      d.className = 'desc';
      d.textContent = t(keys.descKey, entry.desc);
      tile.appendChild(d);

      // SVG injection — safe here because the SVG markup is fully
      // controlled by this sidecar (no user input flows in).
      const svgWrap = document.createElement('div');
      svgWrap.innerHTML = entry.svg();
      tile.appendChild(svgWrap.firstChild);

      grid.appendChild(tile);
    });

    det.appendChild(grid);

    const tail = document.createElement('div');
    tail.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.45);margin-top:8px;line-height:1.5;';
    tail.textContent = t('explainer.tail',
      'Each section can be set independently — choose Paragraph for Profile, Emoji bullets for Selected Outcomes, Table for Core Competencies, and so on. Format choices are saved with your profile and applied immediately.');
    det.appendChild(tail);

    return det;
  }

  function buildFormatsCard() {
    const prefs = readPrefs();
    const card = document.createElement('details');
    card.className = 'antcv-fp-block';
    card.dataset.antcvFormatPrefs = '1';
    // closed by default — power-user control, not needed for most edits

    const summary = document.createElement('summary');
    summary.style.cssText = 'cursor:pointer;user-select:none;font-size:11px;font-weight:600;letter-spacing:0.4px;color:rgba(255,255,255,0.55);margin-bottom:6px';
    summary.textContent = 'SECTION FORMATS';
    card.appendChild(summary);

    const desc = document.createElement('div');
    desc.className = 'antcv-fp-desc';
    desc.textContent = 'Pick how each section is laid out: Paragraph for prose, Bullets for a list, Hybrid for a short intro line followed by bullets, Table for a two-column key/value grid. Changing a format converts the existing content right away — your text isn\u2019t lost.';
    card.appendChild(desc);

    card.appendChild(buildExplainerCard());

    SECTION_CATALOG.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'antcv-fp-row';

      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.innerHTML = `${entry.label} <span class="doc-tag ${entry.doc}">${entry.doc.toUpperCase()}</span>`;
      row.appendChild(lbl);

      const sel = document.createElement('select');
      sel.className = 'antcv-fp-select';
      const cur = prefs.sectionFormats[entry.id] || 'default';
      const optDefault = document.createElement('option');
      optDefault.value = 'default';
      optDefault.textContent = FORMAT_LABELS.default;
      sel.appendChild(optDefault);
      entry.allow.forEach(fmt => {
        const o = document.createElement('option');
        o.value = fmt;
        o.textContent = FORMAT_LABELS[fmt] || fmt;
        sel.appendChild(o);
      });
      sel.value = cur;
      row.appendChild(sel);

      // ─── v1.40.172: per-section emoji controls ───
      // Shown only when the section is in an emoji format. The input
      // is a single emoji that becomes the section's bulletDefault;
      // the ↻ button regenerates all bullet emojis using the content-
      // aware keyword picker (overwriting per-item slots).
      const liveSection = readSectionById(entry.id);
      const liveEmoji = !!(liveSection && liveSection.useEmojiBullets);
      const fmtEmoji = (cur === 'emoji_bullets' || cur === 'hybrid_2' || cur === 'hybrid_3');
      const showEmoji = liveEmoji || fmtEmoji;

      const emojiInput = document.createElement('input');
      emojiInput.type = 'text';
      emojiInput.className = 'antcv-fp-emoji-input';
      emojiInput.placeholder = (DEFAULT_EMOJI[entry.id] || '•');
      emojiInput.maxLength = 6;  // allow grapheme cluster with variation selector
      emojiInput.value = (liveSection && liveSection.bulletDefault) || '';
      emojiInput.title = 'Default emoji for this section. Used when a bullet has no per-item emoji.';
      emojiInput.style.display = showEmoji ? '' : 'none';
      emojiInput.addEventListener('change', () => {
        const v = emojiInput.value.trim();
        if (v) setSectionDefaultEmoji(entry.id, v);
      });
      row.appendChild(emojiInput);

      const refreshBtn = document.createElement('button');
      refreshBtn.type = 'button';
      refreshBtn.className = 'antcv-fp-emoji-refresh';
      refreshBtn.textContent = '↻';
      refreshBtn.title = 'Refit all bullet emojis to match each line\u2019s content';
      refreshBtn.style.display = showEmoji ? '' : 'none';
      refreshBtn.addEventListener('click', () => {
        regenerateEmojisForSection(entry.id);
        const flash = refreshBtn.textContent;
        refreshBtn.textContent = '✓';
        setTimeout(() => { refreshBtn.textContent = flash; }, 800);
      });
      row.appendChild(refreshBtn);

      sel.addEventListener('change', () => {
        const fmt = sel.value;
        const ok = applySectionFormat(entry.id, fmt);
        if (fmt !== 'default' && !ok) writeSectionFormat(entry.id, fmt);
        const isEmoji = fmt === 'emoji_bullets' || fmt === 'hybrid_2' || fmt === 'hybrid_3';
        emojiInput.style.display = isEmoji ? '' : 'none';
        refreshBtn.style.display = isEmoji ? '' : 'none';
        if (isEmoji) {
          const sec = readSectionById(entry.id);
          emojiInput.value = (sec && sec.bulletDefault) || '';
        }
      });

      card.appendChild(row);
    });

    const note = document.createElement('div');
    note.className = 'antcv-fp-note';
    note.textContent = 'Format choices are saved with your profile and applied immediately. Future Generate runs will respect these preferences.';
    card.appendChild(note);
    return card;
  }

  // ─── Targeted injection ──────────────────────────────────────────
  // For each block we walk to the smallest panel that actually
  // unmounts when the user leaves the relevant tab, so the blocks
  // don't persist across other Settings tabs.

  function findSectionByHeading(anchorRegex, maxWalkUp) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const t = (node.textContent || '').trim();
        return (t && anchorRegex.test(t)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const tNode = walker.nextNode();
    if (!tNode) return null;
    let n = tNode.parentElement;
    for (let i = 0; i < maxWalkUp && n && n.parentElement; i++) n = n.parentElement;
    return n;
  }

  function injectShape() {
    // Anchor on "PROFILE PHOTO" — unique to the Layout tab's photo section.
    // Walk up 1 level → the section wrapper div that holds heading + position
    // buttons + diameter slider. Appending here puts Shape inside the same
    // visual card as the rest of the photo controls.
    const section = findSectionByHeading(/^PROFILE PHOTO$/, 1);
    if (!section) return false;
    if (section.querySelector('[data-antcv-shape-row="1"]')) return true;
    Array.from(document.querySelectorAll('[data-antcv-shape-row="1"]')).forEach(n => {
      if (!n.isConnected || !section.contains(n)) n.remove();
    });
    section.appendChild(buildShapeRow());
    return true;
  }

  function injectFormats() {
    // Anchor on "LINE TARGETS" — unique to Advanced → Style. Walk up 1 level
    // to the LINE TARGETS section wrapper, then sideways to its parent (the
    // styles-tab outer div) and append. Result: Section Formats appears
    // BELOW Line Targets, INSIDE the styles tab — and unmounts when the
    // user leaves that tab.
    const lineTargetsSection = findSectionByHeading(/^LINE TARGETS$/, 1);
    if (!lineTargetsSection) return false;
    const stylesPanel = lineTargetsSection.parentElement;
    if (!stylesPanel) return false;
    if (stylesPanel.querySelector('[data-antcv-format-prefs="1"]')) return true;
    Array.from(document.querySelectorAll('[data-antcv-format-prefs="1"]')).forEach(n => {
      if (!n.isConnected || !stylesPanel.contains(n)) n.remove();
    });
    stylesPanel.appendChild(buildFormatsCard());
    return true;
  }

  function injectAll() {
    injectShape();
    injectFormats();
  }

  let mutObserver = null;
  function startObserver() {
    injectAll();
    if (mutObserver) return;
    mutObserver = new MutationObserver(() => {
      if (startObserver._pending) return;
      startObserver._pending = true;
      requestAnimationFrame(() => {
        startObserver._pending = false;
        injectAll();
      });
    });
    mutObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // ─── Public API ──────────────────────────────────────────────────
  window.AntcvFormatPrefs = {
    read:                    readPrefs,
    setShape:                writePhotoShape,
    setFormat:               applySectionFormat,
    defaultEmojiFor:         defaultEmojiFor,
    DEFAULT_EMOJI:           DEFAULT_EMOJI,
    FORMAT_LABELS:           FORMAT_LABELS,
    isEmojiFormat:           (fmt) => fmt === 'emoji_bullets' || fmt === 'hybrid_2' || fmt === 'hybrid_3',
    buildEmojiArray:         buildEmojiArray,         // legacy: position-only fill
    emojiForBullet:          emojiForBullet,          // content-aware picker
    populateEmojisForItems:  populateEmojisForItems,  // batch picker preserving manual overrides
    EMOJI_KEYWORDS:          EMOJI_KEYWORDS,
  };
})();
