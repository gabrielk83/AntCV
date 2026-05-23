/* ──────────────────────────────────────────────────────────────────────
 * Drop-in replacement for `case "text_bullets":` in the Te section
 * editor (the section that renders HOW I WOULD CONTRIBUTE).
 *
 * Replaces the current Intro / Bullets / Closing renderer with a
 * three-part editor where every part has Page + CJLR + Enrich +
 * Compress, the bullets section is one input row per bullet with X
 * remove and a "+ Bullet" button at the end, exactly matching the
 * wireframe.
 *
 * In-scope identifiers used (already defined higher up in Te):
 *   e   = section object               (props.s)
 *   d   = setter, d({...}) merges into the section
 *   Fe  = CJLR alignment component     (Center/Justify/Left/Right)
 *   r   = onEnrichRole callback        (props.onEnrichRole)
 *   a   = enrichingRoleId state        (props.enrichingRoleId)
 *   n   = onCompressRole callback      (props.onCompressRole)
 *   o   = compressingRoleId state      (props.compressingRoleId)
 *   s   = accent colour (teal #01B7BB)
 *   m   = shared cyan button style (declared near top of Te)
 *
 * State shape additions:
 *   e.partAlign   — { [partId]: "left"|"center"|"justify"|"right" }
 *                   New optional field on the section. Per-paragraph
 *                   alignment for intro / each bullet / closing.
 *   e.page        — already exists on every section; cycled by the
 *                   Page button (1-4, cascade not applied here since
 *                   it's a single section, not a roles list).
 *
 * Part identifiers passed to enrich/compress:
 *   "intro"
 *   "bullet:0", "bullet:1", ...
 *   "closing"
 *
 * Parent-side dependency (verify before deploy):
 *   The parent wraps roleId in {sectionId:Fi.id, roleId:e} and
 *   dispatches to il / ll. For full functionality, il / ll must
 *   recognise these new identifiers when sectionId === "contribute"
 *   and dispatch the appropriate LLM call against the corresponding
 *   text. If they currently only handle the legacy textarea blob,
 *   they'll need a small switch on roleId. The UI buttons will still
 *   render and be clickable without that wiring — they just won't
 *   produce LLM-enriched/compressed output until il/ll is taught.
 * ────────────────────────────────────────────────────────────────────── */

case "text_bullets": {
  // ── Normalise state ─────────────────────────────────────────────
  const _items = Array.isArray(e.items)
    ? e.items.map(it =>
        typeof it === "string"
          ? it
          : (it && (it.content || it.t)) || ""
      )
    : [];
  const _closing = e.closing || "";
  const _intro = e.intro || "";
  const _partAlign = e.partAlign || {};
  const _page = parseInt(e.page || 1, 10);

  // ── Setters ─────────────────────────────────────────────────────
  const _setIntro = (v) => d({ intro: v });
  const _setItems = (arr) => d({ items: arr });
  const _setClosing = (v) => d({ closing: v });
  const _setAlign = (partId, v) =>
    d({ partAlign: { ..._partAlign, [partId]: v } });
  const _cyclePage = () =>
    d({ page: _page >= 4 ? 1 : _page + 1 });
  const _resetPage = () => d({ page: 1 });

  // ── Styles (kept local; mirror the bring-rows toolbar) ──────────
  const _inputStyle = {
    flex: 1,
    fontSize: 12,
    padding: 5,
    border: "1px solid #ddd",
    borderRadius: 4,
    fontFamily: "Georgia,serif",
    boxSizing: "border-box",
    minWidth: 0,
  };
  const _partRow = {
    display: "flex",
    gap: 4,
    alignItems: "center",
  };
  const _partBlock = { marginBottom: 10 };
  const _labelStyle = {
    fontSize: 11,
    color: "#777",
    marginBottom: 3,
  };
  const _toolWrap = {
    display: "flex",
    gap: 3,
    alignItems: "center",
    flexShrink: 0,
  };
  const _pageBtnStyle = {
    fontSize: 10,
    padding: "3px 6px",
    borderRadius: 3,
    border: "1px solid " + (_page > 1 ? "#d97706" : "#999"),
    background: _page > 1 ? "#fef3c7" : "none",
    color: _page > 1 ? "#92400e" : "#444",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
    flexShrink: 0,
  };
  const _llmBtnStyle = (col, busy, otherBusy) => ({
    fontSize: 9,
    padding: "2px 5px",
    borderRadius: 3,
    border: "1px solid " + (busy ? "#ccc" : col),
    background: "none",
    color: busy ? "#ccc" : col,
    cursor: busy || otherBusy ? "wait" : "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });
  const _xBtnStyle = {
    fontSize: 10,
    background: "none",
    border: "1px solid #e55",
    color: "#e55",
    borderRadius: 3,
    cursor: "pointer",
    padding: "1px 4px",
    flexShrink: 0,
  };

  // ── Toolbar factory ─────────────────────────────────────────────
  const _toolbar = (partId, removable, onRemove) => {
    const enriching = !!r && a === partId;
    const compressing = !!n && o === partId;
    return React.createElement(
      "div",
      { style: _toolWrap },
      // Page
      React.createElement(
        "button",
        {
          onClick: _cyclePage,
          onContextMenu: (ev) => {
            ev.preventDefault();
            _resetPage();
          },
          title:
            "Page " +
            _page +
            ". Tap to cycle 1→2→3→4→1. Right-click / long-press to reset to page 1.",
          style: _pageBtnStyle,
        },
        String(_page)
      ),
      // CJLR
      React.createElement(Fe, {
        value: _partAlign[partId] || "left",
        onChange: (v) => _setAlign(partId, v),
        title: "CJLR for " + partId,
        size: 24,
      }),
      // Enrich
      r &&
        React.createElement(
          "button",
          {
            onClick: () => r(partId),
            disabled: enriching || compressing,
            title:
              "Enrich — make this part more specific and senior-toned",
            style: _llmBtnStyle("#10b981", enriching, compressing),
          },
          enriching ? "⏳" : "✨"
        ),
      // Compress
      n &&
        React.createElement(
          "button",
          {
            onClick: () => n(partId),
            disabled: compressing || enriching,
            title: "Compress — tighten phrasing of this part",
            style: _llmBtnStyle("#7c3aed", compressing, enriching),
          },
          compressing ? "⏳" : "⇥"
        ),
      // X remove (bullets only)
      removable &&
        React.createElement(
          "button",
          {
            onClick: onRemove,
            title: "Remove this bullet",
            style: _xBtnStyle,
          },
          "✕"
        )
    );
  };

  return React.createElement(
    React.Fragment,
    null,

    // ── Intro line ──────────────────────────────────────────────
    React.createElement(
      "div",
      { style: _partBlock },
      React.createElement("div", { style: _labelStyle }, "Intro line"),
      React.createElement(
        "div",
        { style: _partRow },
        React.createElement("input", {
          value: _intro,
          onChange: (ev) => _setIntro(ev.target.value),
          placeholder:
            "[Intro — one sentence framing what you would focus on]",
          style: _inputStyle,
        }),
        _toolbar("intro", false, null)
      )
    ),

    // ── Bullets (one per row) ───────────────────────────────────
    React.createElement(
      "div",
      { style: _partBlock },
      React.createElement(
        "div",
        { style: _labelStyle },
        "Bullets (one per line)"
      ),
      _items.map((bullet, idx) =>
        React.createElement(
          "div",
          { key: idx, style: { ..._partRow, marginBottom: 4 } },
          React.createElement("input", {
            value: bullet,
            onChange: (ev) => {
              const next = _items.slice();
              next[idx] = ev.target.value;
              _setItems(next);
            },
            placeholder: "Bullet text",
            style: _inputStyle,
          }),
          _toolbar("bullet:" + idx, true, () => {
            _setItems(_items.filter((_, i) => i !== idx));
          })
        )
      ),
      React.createElement(
        "button",
        {
          onClick: () => _setItems([..._items, ""]),
          style: {
            fontSize: 11,
            background: "none",
            border: "1px solid " + s,
            color: s,
            borderRadius: 4,
            padding: "3px 8px",
            cursor: "pointer",
            marginTop: 4,
          },
        },
        "+ Bullet"
      )
    ),

    // ── Closing line ────────────────────────────────────────────
    React.createElement(
      "div",
      { style: _partBlock },
      React.createElement(
        "div",
        { style: _labelStyle },
        "Closing line — appears AFTER bullets as a separate paragraph"
      ),
      React.createElement(
        "div",
        { style: _partRow },
        React.createElement("input", {
          value: _closing,
          onChange: (ev) => _setClosing(ev.target.value),
          placeholder:
            "Closing — A sentence framing the benefit of these qualifications",
          style: _inputStyle,
        }),
        _toolbar("closing", false, null)
      )
    )
  );
}
