/* antcv-publications-editor.js — PUBLICATIONS-MAIN-001 Phase 2 + 3 editor.
 * ============================================================================
 * The editor for the rich Publications & Patents section (list_italic + richPub). Phase 2: five
 * fields per row (Name · Authors · Journal/Publisher/Patent no. · Year/date · Pages) round-tripped
 * through a parallel section.pubFields[] array while items[] stays a composed citation STRING.
 * Phase 3: per-row CJLR · Page · Enhance · Fit + a whole-section bar (move main↔sidebar · CJLR-all ·
 * Hide/Show section). Rendered from app.js via React.createElement(window.AntcvPublicationsEditor,
 * {section, update, accent, onEnrich, onCompress, enrichingId, compressingId}) so the heavy editor
 * lives here (no minified-mirror surgery). Per-row align/page ride the SAME stores the rest of the
 * app uses (antcvItemAlignment[sid]["items."+i] / .__group__ ; antcv:itemPages[sid][i]).
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
    function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (_) { return {}; } }
    function writeJSON(k, m) { try { localStorage.setItem(k, JSON.stringify(m)); } catch (_) {} }
    function emit(n, d) { try { window.dispatchEvent(new CustomEvent(n, { detail: d })); } catch (_) {} }
    // Citation split/compose (mirrors the app's xe/Ee — em-dash separator, lossless round-trip).
    var SEP = [" — ", " – ", " - ", ": "];
    // Migrated citations carried HTML bold/italic tags + smart quotes around the title (<b>"Title"</b>) —
    // strip them so the Name field shows clean text, not "<b>"Integration…".
    function clean(v) {
      return String(v == null ? "" : v)
        .replace(/<\/?[a-z][^>]*>/gi, "")        // drop <b>, </b>, <i>, etc.
        .replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g, "")  // strip surrounding quotes/space
        .trim();
    }
    function splitCite(v) { v = clean(v); if (!v) return { title: "", details: "" }; for (var i = 0; i < SEP.length; i++) { var k = v.indexOf(SEP[i]); if (k > 0) return { title: clean(v.slice(0, k)), details: v.slice(k + SEP[i].length).trim() }; } return { title: v, details: "" }; }
    function joinCite(n, o) { n = clean(n); o = String(o || "").trim(); return n && o ? n + " — " + o : (n || o); }
    // Parse a legacy detail blob into authors / journal / year / pages (best-effort).
    function parseDetails(details) {
      details = String(details || "");
      var year = "", pages = "", authors = "", journal = "";
      var ym = details.match(/\b(?:19|20)\d\d\b/g); if (ym) year = ym[ym.length - 1];
      var pm = details.match(/pp?\.?\s*(\d+\s*[-–—]\s*\d+|\d+)\b/i); if (pm) pages = pm[1];
      var rest = details;
      if (pm) rest = rest.replace(pm[0], "");
      if (year) rest = rest.replace(year, "");
      rest = rest.replace(/\s*,\s*,\s*/g, ", ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
      var parts = rest.split(/\s*,\s*/).filter(Boolean);
      if (parts.length >= 2) { journal = parts[parts.length - 1]; authors = parts.slice(0, -1).join(", "); }
      else { journal = rest; }
      return { authors: authors, journal: journal, year: year, pages: pages };
    }

    function PublicationsEditor(props) {
      var e = props.section || {};
      var d = props.update || function () {};
      var accent = props.accent || "#01B7BB";
      var onEnrich = props.onEnrich, onCompress = props.onCompress;
      var enrichingId = props.enrichingId, compressingId = props.compressingId;
      var stt = R.useState(0); var bump = stt[1];
      var sid = e.id;
      function rerender() { bump(function (x) { return x + 1; }); }

      function getPage(i) { try { var b = readJSON("antcv:itemPages")[sid] || {}; var n = Number(b[String(i)] || b["items." + i] || 1); return n >= 1 && n <= 4 ? (n | 0) : 1; } catch (_) { return 1; } }
      function setPage(i, n) { var m = readJSON("antcv:itemPages"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid][String(i)] = n; m[sid]["items." + i] = n; writeJSON("antcv:itemPages", m); emit("antcv:item-pages-changed", { sid: sid, index: i, page: n }); rerender(); }
      function getAlign(i) { try { var b = readJSON("antcvItemAlignment")[sid] || {}; var v = b["items." + i] || b[String(i)] || "justify"; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; } catch (_) { return "justify"; } }
      function setAlign(i, v) { var m = readJSON("antcvItemAlignment"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid]["items." + i] = v; m[sid][String(i)] = v; writeJSON("antcvItemAlignment", m); emit("antcv:item-align-changed", { sid: sid, index: i, alignment: v }); rerender(); }
      function getGroup() { try { var b = readJSON("antcvItemAlignment")[sid] || {}; var v = b.__group__; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; } catch (_) { return "justify"; } }
      function setGroup(v) { var m = readJSON("antcvItemAlignment"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid].__group__ = v; writeJSON("antcvItemAlignment", m); emit("antcv:item-align-changed", { sid: sid, index: -1, alignment: v }); rerender(); }

      function seedPF(it) { var r = splitCite(it); return parseDetails(r.details || ""); }
      function getPF(n) { return e.pubFields && e.pubFields[n] ? e.pubFields[n] : seedPF((e.items || [])[n]); }
      function composeRow(nm, pf) { return joinCite(nm, [pf.authors, pf.journal, pf.year, pf.pages ? "pp. " + pf.pages : ""].filter(Boolean).join(", ")); }
      function writeRow(n, nm, pf) { var items = (e.items || []).slice(); items[n] = composeRow(nm, pf); var pubFields = (e.items || []).map(function (x, i) { return i === n ? pf : getPF(i); }); d({ items: items, pubFields: pubFields }); }
      function moveRow(n, delta) { var r2 = n + delta; var items = (e.items || []).slice(); if (r2 < 0 || r2 >= items.length) return; var hidden = (e.hidden || []).slice(); var pf = (e.items || []).map(function (x, i) { return getPF(i); }); var t1 = items[n]; items[n] = items[r2]; items[r2] = t1; var t2 = hidden[n]; hidden[n] = hidden[r2]; hidden[r2] = t2; var t3 = pf[n]; pf[n] = pf[r2]; pf[r2] = t3; d({ items: items, hidden: hidden, pubFields: pf }); }
      function deleteRow(n) { var items = (e.items || []).filter(function (x, i) { return i !== n; }); var hidden = (e.hidden || []).filter(function (x, i) { return i !== n; }); var pubFields = (e.items || []).map(function (x, i) { return getPF(i); }).filter(function (x, i) { return i !== n; }); d({ items: items, hidden: hidden, pubFields: pubFields }); }
      function addRow() { d({ items: (e.items || []).concat([""]), pubFields: (e.items || []).map(function (x, i) { return getPF(i); }).concat([seedPF("")]) }); }

      var fldStyle = { fontSize: 11, padding: 4, border: "1px solid #ddd", borderRadius: 3, minWidth: 0 };
      function fld(n, key, ph, nm, pf) { return h("input", { value: pf[key] || "", onChange: function (x) { writeRow(n, nm, Object.assign({}, pf, fromKey(key, x.target.value))); }, placeholder: ph, style: fldStyle }); }
      function fromKey(k, v) { var o = {}; o[k] = v; return o; }
      var cbtn = function (extra) { return Object.assign({ fontSize: 9, padding: "2px 5px", borderRadius: 3, cursor: "pointer", background: "none", whiteSpace: "nowrap", flexShrink: 0 }, extra || {}); };

      // ---- whole-section bar: move main<->sidebar · CJLR-all · hide/show section ----
      var groupAlign = getGroup();
      var bar = h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed #e3e3e3" } },
        h("button", { onClick: function () { d({ loc: e.loc === "sidebar" ? "main" : "sidebar" }); }, title: "Move the whole section " + (e.loc === "sidebar" ? "to the main column" : "to the sidebar"), style: cbtn({ border: "1px solid " + accent, color: accent, fontSize: 11 }) }, "◹ " + (e.loc === "sidebar" ? "To main" : "To sidebar")),
        h("button", { onClick: function () { setGroup(ALIGNS[(ALIGNS.indexOf(groupAlign) + 1) % ALIGNS.length] || "justify"); }, title: "Align the whole section: " + (ALABEL[groupAlign] || groupAlign) + ". Click to cycle.", style: cbtn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11 }) }, (AICON[groupAlign] || AICON.justify) + " All"),
        h("button", { onClick: function () { d({ on: e.on === false }); }, title: e.on === false ? "Section hidden — show" : "Section shown — hide", style: cbtn({ border: "1px solid " + (e.on === false ? "#999" : accent), color: e.on === false ? "#999" : accent, fontSize: 11 }) }, (e.on === false ? "🙈" : "👁") + " Section")
      );

      // ---- rows ----
      var items = e.items || [];
      var rowEls = items.map(function (t, n) {
        var hiddenRow = !(!e.hidden || !e.hidden[n]);
        var nm = splitCite(t || "").title;
        var pf = getPF(n);
        var thisPage = getPage(n), thisAlign = getAlign(n);
        var busyEnrich = enrichingId === "item:" + n, busyCompress = compressingId === "item:" + n;
        return h("div", { key: n, style: { marginBottom: 4, opacity: hiddenRow ? 0.45 : 1, border: "1px solid #eee", borderRadius: 4, padding: 3, background: hiddenRow ? "#fafafa" : "#fff" } },
          // name line: visibility · name · delete
          h("div", { style: { display: "grid", gridTemplateColumns: "30px 1fr 28px", gap: 4, alignItems: "center" } },
            h("button", { onClick: function () { var hd = (e.hidden || []).slice(); hd[n] = !hiddenRow; d({ hidden: hd }); }, title: hiddenRow ? "Hidden — tap to show" : "Visible — tap to hide", style: { fontSize: 13, background: "none", border: "1px solid " + (hiddenRow ? "#999" : accent), color: hiddenRow ? "#999" : accent, borderRadius: 3, cursor: "pointer", padding: "1px 5px", minWidth: 24 } }, hiddenRow ? "🙈" : "👁"),
            h("input", { value: nm, onChange: function (x) { writeRow(n, x.target.value, pf); }, placeholder: "Publication / patent name", style: { fontSize: 11, padding: 4, border: "1px solid #ddd", borderRadius: 3, minWidth: 0, fontStyle: "italic", fontWeight: 700 } }),
            h("button", { onClick: function () { deleteRow(n); }, title: "Delete item", style: { fontSize: 10, background: "none", border: "1px solid #e55", color: "#e55", borderRadius: 3, cursor: "pointer", padding: "1px 4px" } }, "✕")
          ),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 3 } }, fld(n, "authors", "Authors", nm, pf), fld(n, "journal", "Journal / Publisher / Patent no.", nm, pf)),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 3 } }, fld(n, "year", "Year / date", nm, pf), fld(n, "pages", "Pages", nm, pf)),
          // controls line: reorder · Page · CJLR · Enhance · Fit
          h("div", { style: { display: "flex", gap: 3, marginTop: 3, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" } },
            h("button", { onClick: function () { moveRow(n, -1); }, disabled: n === 0, title: "Move up", style: cbtn({ border: "1px solid " + (n === 0 ? "#ddd" : "#888"), color: n === 0 ? "#ddd" : "#888", fontSize: 10, cursor: n === 0 ? "not-allowed" : "pointer" }) }, "▲"),
            h("button", { onClick: function () { moveRow(n, 1); }, disabled: n === items.length - 1, title: "Move down", style: cbtn({ border: "1px solid " + (n === items.length - 1 ? "#ddd" : "#888"), color: n === items.length - 1 ? "#ddd" : "#888", fontSize: 10, cursor: n === items.length - 1 ? "not-allowed" : "pointer" }) }, "▼"),
            h("button", { onClick: function () { setPage(n, thisPage >= 4 ? 1 : thisPage + 1); }, title: "Row page: " + thisPage + ". Click to cycle 1→2→3→4.", style: cbtn({ border: "1px solid #01B7BB", color: "#00746E", background: thisPage === 1 ? "rgba(1,183,187,.08)" : "rgba(255,255,255,.10)", minWidth: 28 }) }, "P" + thisPage),
            h("button", { onClick: function () { setAlign(n, ALIGNS[(ALIGNS.indexOf(thisAlign) + 1) % ALIGNS.length] || "justify"); }, title: "Alignment: " + (ALABEL[thisAlign] || thisAlign) + ". Click to cycle.", style: cbtn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11, minWidth: 22 }) }, AICON[thisAlign] || AICON.justify),
            onEnrich ? h("button", { onClick: function () { onEnrich("item:" + n); }, disabled: busyEnrich || busyCompress, title: "Enhance this citation", style: cbtn({ border: "1px solid " + (busyEnrich ? "#ccc" : "#10b981"), color: busyEnrich ? "#ccc" : "#10b981", cursor: busyEnrich || busyCompress ? "wait" : "pointer" }) }, busyEnrich ? "⏳" : "✨") : null,
            onCompress ? h("button", { onClick: function () { onCompress("item:" + n); }, disabled: busyCompress || busyEnrich, title: "Fit this citation — tighten to one line", style: cbtn({ border: "1px solid " + (busyCompress ? "#ccc" : "#7c3aed"), color: busyCompress ? "#ccc" : "#7c3aed", cursor: busyCompress || busyEnrich ? "wait" : "pointer" }) }, busyCompress ? "⏳" : "⇥") : null
          )
        );
      });

      var addBtn = h("button", { onClick: addRow, style: { fontSize: 11, background: "none", border: "1px solid " + accent, color: accent, borderRadius: 4, padding: "3px 8px", cursor: "pointer", marginTop: 2 } }, "+ Publication");

      return h(R.Fragment, null, bar, rowEls, addBtn);
    }

    window.AntcvPublicationsEditor = PublicationsEditor;
    return true;
  }
  if (!define()) {
    var tries = 0;
    var t = setInterval(function () { if (define() || ++tries > 100) clearInterval(t); }, 150);
    window.addEventListener("DOMContentLoaded", define);
  }
})();
