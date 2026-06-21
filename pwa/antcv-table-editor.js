/* antcv-table-editor.js — TABLE-TYPE-001 (universal table section editor).
 *
 * The editor surface for `type:"table"` sections (CORE COMPETENCIES, WHAT I BRING, and any
 * 2-column table), redesigned to the owner's 2026-06-22 spec the same way `rich_block` unified
 * the text sections (see antcv-rich-block-editor.js). app.js carries only a one-line delegation:
 *   React.createElement(window.AntcvTableEditor, {section, update, accent, onEnrich, onCompress, ...})
 * so the heavy editor lives here (readable, no minified-mirror risk).
 *
 * Reuses the section fields the preview + docx-worker ALREADY honour:
 *   e.rows (rows[0] = header) · e.hidden[] (per-row) · e.rowAlign[] (per body-row CJLR) ·
 *   e.headerAlign (header-row CJLR — fixes the "header has no CJLR + alignment drifts" report) ·
 *   e.pageBreakRows[] (row 1 moves the whole table; rows 2+ split mid-table).
 * Persists the redesign's new fields on the section (preview/export wiring tracked separately,
 * the same staged way rich_block deferred generation-native emission):
 *   e.headingOff · e.ruleOff · e.headerBold (default true) · e.headerItalic · e.spaceAfter.
 * Column ratio rides the standalone cvTableRatio / clTableRatio keys (see memory
 * sidecar-prefs-clobber-hazard) and nudges a re-render via antcv:sections-updated.
 */
(function () {
  "use strict";
  function define() {
    var R = window.React;
    if (!R || !R.createElement || !R.useState) return false;
    var h = R.createElement;
    var ALIGNS = ["center", "justify", "left", "right"];
    var AICON = { center: "↔", justify: "☰", left: "⇤", right: "⇥" };
    var ALABEL = { center: "Center", justify: "Justify", left: "Left", right: "Right" };

    function activeDoc() {
      try { var d = JSON.parse(localStorage.getItem("doc") || '""'); return String(typeof d === "string" ? d : "cv").toLowerCase() === "cl" ? "cl" : "cv"; }
      catch (_) { return "cv"; }
    }
    function ratioKey() { return activeDoc() === "cl" ? "clTableRatio" : "cvTableRatio"; }
    function readNum(k, dflt) { try { var v = JSON.parse(localStorage.getItem(k)); return typeof v === "number" && isFinite(v) ? v : dflt; } catch (_) { return dflt; } }
    function writeNum(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
    function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {} }

    function TableEditor(props) {
      var e = props.section || {};
      var d = props.update || function () {};
      var accent = props.accent || "#01B7BB";
      var onEnrich = props.onEnrich, onCompress = props.onCompress;
      var enrichingId = props.enrichingId, compressingId = props.compressingId;
      var st = R.useState(0); var bump = st[1];
      function rerender() { bump(function (x) { return x + 1; }); }

      var rows = Array.isArray(e.rows) && e.rows.length ? e.rows : [["Focus Area", "Strategic Expertise"], ["", ""]];
      var nCols = Math.max(2, (rows[0] && rows[0].length) || 2);

      function setRows(next) { d({ rows: next }); }
      function setCell(r, c, val) { setRows(rows.map(function (row, ri) { return ri === r ? row.map(function (cell, ci) { return ci === c ? val : cell; }) : row; })); }
      function addRow() {
        var blank = []; for (var c = 0; c < nCols; c++) blank.push("");
        setRows(rows.concat([blank]));
      }
      function deleteRow(i) {
        if (i === 0) return; // never delete the header
        setRows(rows.filter(function (_x, j) { return j !== i; }));
        var patch = { rows: rows.filter(function (_x, j) { return j !== i; }) };
        ["hidden", "rowAlign", "pageBreakRows"].forEach(function (k) {
          if (Array.isArray(e[k])) patch[k] = e[k].filter(function (_x, j) { return j !== i; });
        });
        d(patch);
      }
      function moveRow(i, delta) {
        var j = i + delta;
        if (i <= 0 || j <= 0 || j >= rows.length) return; // header stays at 0
        function swap(arr) { if (!Array.isArray(arr)) return arr; var o = arr.slice(); var t = o[i]; o[i] = o[j]; o[j] = t; return o; }
        var patch = { rows: swap(rows) };
        ["hidden", "rowAlign", "pageBreakRows"].forEach(function (k) { if (Array.isArray(e[k])) patch[k] = swap(e[k]); });
        d(patch);
      }
      function toggleHidden(i) { var hd = (e.hidden || []).slice(); hd[i] = !hd[i]; d({ hidden: hd }); }
      function rowAlign(i) { var v = (e.rowAlign || [])[i]; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; }
      function cycleRowAlign(i) { var o = (e.rowAlign || []).slice(); o[i] = ALIGNS[(ALIGNS.indexOf(rowAlign(i)) + 1) % ALIGNS.length]; d({ rowAlign: o }); }
      function headerAlign() { return ALIGNS.indexOf(e.headerAlign) >= 0 ? e.headerAlign : "center"; }
      function cycleHeaderAlign() { d({ headerAlign: ALIGNS[(ALIGNS.indexOf(headerAlign()) + 1) % ALIGNS.length] }); }
      function pageOf(i) { return !!(e.pageBreakRows && e.pageBreakRows[i]); }
      function togglePage(i) { var o = (e.pageBreakRows || []).slice(); o[i] = !o[i]; d({ pageBreakRows: o }); }
      // whole-table CJLR = set every BODY row to one alignment
      function setAllBodyAlign(v) { var o = (e.rowAlign || []).slice(); for (var i = 1; i < rows.length; i++) o[i] = v; d({ rowAlign: o }); }

      var btn = function (extra) { return Object.assign({ fontSize: 10, padding: "2px 6px", borderRadius: 3, cursor: "pointer", background: "none", whiteSpace: "nowrap", flexShrink: 0 }, extra || {}); };

      var headOff = !!e.headingOff, ruleOff = !!e.ruleOff;
      var hBold = e.headerBold !== false, hItalic = !!e.headerItalic;
      var ratio = readNum(ratioKey(), 0.25);
      var busyTableE = enrichingId === "section", busyTableC = compressingId === "section";

      // ── whole-table bar ──────────────────────────────────────────────────
      var bar = h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed #e3e3e3" } },
        h("button", { onClick: function () { d({ headingOff: !headOff }); }, title: headOff ? "Heading hidden — show it" : "Heading shown — hide it", style: btn({ border: "1px solid " + (headOff ? "#999" : accent), color: headOff ? "#999" : accent }) }, (headOff ? "🙈" : "👁") + " Heading"),
        h("button", { onClick: function () { if (!headOff) d({ ruleOff: !ruleOff }); }, disabled: headOff, title: headOff ? "No rule without a heading" : (ruleOff ? "Rule hidden — show it" : "Rule shown — hide it"), style: btn({ border: "1px solid " + (headOff ? "#ddd" : ruleOff ? "#999" : accent), color: headOff ? "#ddd" : ruleOff ? "#999" : accent }) }, (ruleOff ? "🚫" : "—") + " Rule"),
        h("button", { onClick: cycleHeaderAlign, title: "Header-row alignment: " + (ALABEL[headerAlign()]) + ". Click to cycle.", style: btn({ border: "1px solid #2563eb", color: "#2563eb", background: "rgba(37,99,235,.06)", fontSize: 11 }) }, (AICON[headerAlign()]) + " Header"),
        h("button", { onClick: function () { d({ headerBold: !hBold }); }, title: "Header bold", style: btn({ border: "1px solid " + (hBold ? accent : "#bbb"), color: hBold ? accent : "#bbb", fontWeight: 800, minWidth: 22 }) }, "B"),
        h("button", { onClick: function () { d({ headerItalic: !hItalic }); }, title: "Header italic", style: btn({ border: "1px solid " + (hItalic ? accent : "#bbb"), color: hItalic ? accent : "#bbb", fontStyle: "italic", fontWeight: 700, minWidth: 22 }) }, "I"),
        h("button", { onClick: function () { setAllBodyAlign(ALIGNS[(ALIGNS.indexOf(rowAlign(1)) + 1) % ALIGNS.length] || "justify"); }, title: "Whole-table body alignment — set every row at once.", style: btn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11 }) }, (AICON[rowAlign(1)] || AICON.justify) + " Table"),
        onEnrich ? h("button", { onClick: function () { onEnrich("section"); }, disabled: busyTableE || busyTableC, title: "Enhance the whole table", style: btn({ border: "1px solid " + (busyTableE ? "#ccc" : "#10b981"), color: busyTableE ? "#ccc" : "#10b981" }) }, busyTableE ? "⏳" : "✨") : null,
        onCompress ? h("button", { onClick: function () { onCompress("section"); }, disabled: busyTableC || busyTableE, title: "Fit the whole table — tighten cells", style: btn({ border: "1px solid " + (busyTableC ? "#ccc" : "#7c3aed"), color: busyTableC ? "#ccc" : "#7c3aed" }) }, busyTableC ? "⏳" : "⇥") : null
      );

      // ── column-ratio + space-after row ───────────────────────────────────
      var ratioRow = h("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 8, fontSize: 10, color: "#666", flexWrap: "wrap" } },
        h("span", null, "Col 1 width"),
        h("input", { type: "range", min: 10, max: 60, step: 1, value: Math.round(ratio * 100), onChange: function (x) { var v = Math.max(0.1, Math.min(0.6, (parseInt(x.target.value, 10) || 25) / 100)); writeNum(ratioKey(), v); emit("antcv:sections-updated", { reason: "table-ratio" }); rerender(); }, style: { flex: "0 1 160px" } }),
        h("span", { style: { width: 34 } }, Math.round(ratio * 100) + "%"),
        h("span", { style: { marginLeft: 8 } }, "Space after"),
        h("input", { type: "number", min: 0, max: 60, step: 2, value: typeof e.spaceAfter === "number" ? e.spaceAfter : 0, onChange: function (x) { d({ spaceAfter: Math.max(0, Math.min(60, parseInt(x.target.value, 10) || 0)) }); }, style: { width: 52, fontSize: 11, padding: 2, border: "1px solid #ddd", borderRadius: 3 } }),
        h("span", null, "px")
      );

      // ── rows ─────────────────────────────────────────────────────────────
      var rowEls = rows.map(function (row, i) {
        var isHeader = i === 0;
        var hiddenRow = !!(e.hidden && e.hidden[i]);
        var al = isHeader ? headerAlign() : rowAlign(i);
        var busyE = enrichingId === "row:" + i, busyC = compressingId === "row:" + i;
        var cells = [];
        for (var c = 0; c < nCols; c++) {
          (function (c) {
            cells.push(h("textarea", {
              key: "c" + c, value: row[c] != null ? row[c] : "", rows: 1,
              onChange: function (x) { setCell(i, c, x.target.value); },
              placeholder: isHeader ? (c === 0 ? "Focus Area" : "Strategic Expertise") : (c === 0 ? "Focus area" : "Expertise"),
              style: { flex: c === 0 ? "0 1 " + Math.round(ratio * 100) + "%" : "1 1 auto", fontSize: isHeader ? 11 : 12, fontWeight: isHeader && hBold ? 700 : 400, fontStyle: isHeader && hItalic ? "italic" : "normal", padding: 5, border: "1px solid #ddd", borderRadius: 3, minWidth: 0, resize: "vertical", boxSizing: "border-box", textAlign: al === "justify" ? "left" : al, opacity: hiddenRow ? 0.5 : 1 }
            }));
          })(c);
        }
        var controls = h("div", { style: { display: "flex", gap: 3, alignItems: "center", flexShrink: 0 } },
          h("div", { style: { display: "grid", justifyItems: "center", width: 18, flexShrink: 0 } },
            h("button", { onClick: function () { moveRow(i, -1); }, disabled: i <= 1, title: "Move up", style: { fontSize: 9, border: "none", background: "none", color: i <= 1 ? "#ccc" : "#666", padding: 0, cursor: i <= 1 ? "default" : "pointer" } }, "▲"),
            h("button", { onClick: function () { moveRow(i, 1); }, disabled: isHeader || i === rows.length - 1, title: "Move down", style: { fontSize: 9, border: "none", background: "none", color: isHeader || i === rows.length - 1 ? "#ccc" : "#666", padding: 0, cursor: isHeader || i === rows.length - 1 ? "default" : "pointer" } }, "▼")
          ),
          isHeader ? h("span", { style: { width: 22, flexShrink: 0 } }) : h("button", { onClick: function () { toggleHidden(i); }, title: hiddenRow ? "Hidden — show" : "Visible — hide", style: btn({ border: "1px solid " + (hiddenRow ? "#999" : accent), color: hiddenRow ? "#999" : accent, fontSize: 11, minWidth: 22 }) }, hiddenRow ? "🙈" : "👁"),
          h("button", { onClick: function () { isHeader ? cycleHeaderAlign() : cycleRowAlign(i); }, title: "Alignment: " + (ALABEL[al]) + ". Click to cycle.", style: btn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11, minWidth: 22 }) }, AICON[al] || AICON.justify),
          h("button", { onClick: function () { togglePage(i); }, title: i === 0 ? "Move the WHOLE table to the next page" : (pageOf(i) ? "Page break before this row — remove" : "Start this row on the next page"), style: btn({ border: "1px solid " + (pageOf(i) ? "#00746E" : "#cbd5e1"), color: pageOf(i) ? "#00746E" : "#94a3b8", background: pageOf(i) ? "rgba(1,183,187,.10)" : "none", minWidth: 22 }) }, pageOf(i) ? "↧✓" : "↧"),
          onEnrich ? h("button", { onClick: function () { onEnrich("row:" + i); }, disabled: busyE || busyC, title: "Enhance this row", style: btn({ border: "1px solid " + (busyE ? "#ccc" : "#10b981"), color: busyE ? "#ccc" : "#10b981", fontSize: 9, cursor: busyE || busyC ? "wait" : "pointer" }) }, busyE ? "⏳" : "✨") : null,
          onCompress ? h("button", { onClick: function () { onCompress("row:" + i); }, disabled: busyC || busyE, title: "Fit this row — tighten to one line", style: btn({ border: "1px solid " + (busyC ? "#ccc" : "#7c3aed"), color: busyC ? "#ccc" : "#7c3aed", fontSize: 9, cursor: busyC || busyE ? "wait" : "pointer" }) }, busyC ? "⏳" : "⇥") : null,
          isHeader ? h("span", { style: { width: 22, flexShrink: 0 } }) : h("button", { onClick: function () { deleteRow(i); }, title: "Delete row", style: btn({ border: "1px solid #e55", color: "#e55", fontSize: 10 }) }, "✕")
        );
        return h("div", { key: i, style: { border: "1px solid " + (isHeader ? "#cbd5e1" : "#eee"), borderRadius: 4, padding: 5, marginBottom: 5, background: isHeader ? "#f8fafc" : (hiddenRow ? "#fafafa" : "#fff"), display: "flex", gap: 5, alignItems: "flex-start" } },
          h("span", { style: { fontSize: 9, color: "#bbb", width: 30, flexShrink: 0, marginTop: 4 } }, isHeader ? "hdr" : i),
          h("div", { style: { flex: "1 1 auto", display: "flex", gap: 4, minWidth: 0 } }, cells),
          controls
        );
      });

      var addBtn = h("div", { style: { display: "flex", gap: 6, marginTop: 2 } },
        h("button", { onClick: addRow, style: { fontSize: 11, background: "none", border: "1px solid " + accent, color: accent, borderRadius: 4, padding: "4px 12px", cursor: "pointer" } }, "+ Add row")
      );

      return h(R.Fragment, null, bar, ratioRow, rowEls, addBtn);
    }

    window.AntcvTableEditor = TableEditor;
    return true;
  }
  if (!define()) {
    var tries = 0;
    var t = setInterval(function () { if (define() || ++tries > 100) clearInterval(t); }, 150);
    window.addEventListener("DOMContentLoaded", define);
  }
})();
