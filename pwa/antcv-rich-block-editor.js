/* antcv-rich-block-editor.js — RICH-BLOCK-001 (rich composite section editor).
 *
 * The editor surface for the universal composite section `type:"rich_block"` (owner 2026-06-22):
 * an optional HEADLINE (view/hide) + optional horizontal RULE under it (view/hide) + a section-wide
 * CJLR, then N rows. Each row is { b, t, bOff, tOff }: a bold LEAD-IN word (e.g. "Hands-on" —
 * view/hide/edit) and a BODY textarea (view/hide), with per-row CJLR · Page · Enhance · Fit-it ·
 * Delete + a "+ Row" button. It is built to absorb Foundation (two rows), Opening, Who I Am,
 * Why This Company, CL Closure, and CV Profile / Work Style.
 *
 * Rendered from app.js via:  React.createElement(window.AntcvRichBlockEditor, {section, update, ...})
 * so the heavy editor lives here (readable, no minified-mirror risk); app.js carries only a
 * one-line delegation. Per-row alignment + page ride the SAME localStorage stores the foundation /
 * bullets editors use (antcvItemAlignment[sid]["items."+i] / .__group__ ; antcv:itemPages[sid][i])
 * so the preview + docx-worker honour them with zero extra plumbing.
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
    function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (_) {} }

    function RichBlockEditor(props) {
      var e = props.section || {};
      var d = props.update || function () {};
      var accent = props.accent || "#01B7BB";
      var onEnrich = props.onEnrich, onCompress = props.onCompress;
      var enrichingId = props.enrichingId, compressingId = props.compressingId;
      var st = R.useState(0); var bump = st[1];
      var sid = e.id;
      function rerender() { bump(function (x) { return x + 1; }); }

      function getPage(i) { try { var b = readJSON("antcv:itemPages")[sid] || {}; var n = Number(b[String(i)] || b["items." + i] || 1); return n >= 1 && n <= 4 ? (n | 0) : 1; } catch (_) { return 1; } }
      function setPage(i, n) { var m = readJSON("antcv:itemPages"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid][String(i)] = n; m[sid]["items." + i] = n; writeJSON("antcv:itemPages", m); emit("antcv:item-pages-changed", { sid: sid, index: i, page: n }); rerender(); }
      function getAlign(i) { try { var b = readJSON("antcvItemAlignment")[sid] || {}; var v = b["items." + i] || b[String(i)] || "justify"; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; } catch (_) { return "justify"; } }
      function setAlign(i, v) { var m = readJSON("antcvItemAlignment"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid]["items." + i] = v; m[sid][String(i)] = v; writeJSON("antcvItemAlignment", m); emit("antcv:item-align-changed", { sid: sid, index: i, alignment: v }); rerender(); }
      function getGroup() { try { var b = readJSON("antcvItemAlignment")[sid] || {}; var v = b.__group__; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; } catch (_) { return "justify"; } }
      function setGroup(v) { var m = readJSON("antcvItemAlignment"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid].__group__ = v; writeJSON("antcvItemAlignment", m); emit("antcv:item-align-changed", { sid: sid, index: -1, alignment: v }); rerender(); }

      var rows = (e.items && e.items.length ? e.items : [{ b: "", t: "" }]).map(function (x) {
        return x && typeof x === "object" ? x : { b: "", t: String(x || "") };
      });
      function updateRow(i, patch) { d({ items: rows.map(function (x, j) { return j === i ? Object.assign({}, x, patch) : x; }) }); }
      function moveRow(i, delta) { var o = rows.slice(); var r2 = i + delta; if (r2 < 0 || r2 >= o.length) return; var tmp = o[i]; o[i] = o[r2]; o[r2] = tmp; d({ items: o }); }
      function deleteRow(i) { d({ items: rows.filter(function (x, j) { return j !== i; }), hidden: (e.hidden || []).filter(function (x, j) { return j !== i; }) }); }
      function addRow() { d({ items: rows.concat([{ b: "", t: "" }]) }); }
      function toggleRowHidden(i) { var hd = (e.hidden || []).slice(); hd[i] = !hd[i]; d({ hidden: hd }); }

      var btn = function (extra) { return Object.assign({ fontSize: 10, padding: "2px 6px", borderRadius: 3, cursor: "pointer", background: "none", whiteSpace: "nowrap", flexShrink: 0 }, extra || {}); };

      // ---- whole-section bar: headline toggle · rule toggle · section CJLR ----
      var groupAlign = getGroup();
      var headOff = !!e.headlineOff, ruleOff = !!e.ruleOff;
      var bar = h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed #e3e3e3" } },
        h("button", { onClick: function () { d({ headlineOff: !headOff }); }, title: headOff ? "Headline hidden — show it" : "Headline shown — hide it", style: btn({ border: "1px solid " + (headOff ? "#999" : accent), color: headOff ? "#999" : accent }) }, (headOff ? "🙈" : "👁") + " Headline"),
        h("button", { onClick: function () { if (!headOff) d({ ruleOff: !ruleOff }); }, disabled: headOff, title: headOff ? "No rule without a headline" : (ruleOff ? "Rule hidden — show it" : "Rule shown — hide it"), style: btn({ border: "1px solid " + (headOff ? "#ddd" : ruleOff ? "#999" : accent), color: headOff ? "#ddd" : ruleOff ? "#999" : accent, cursor: headOff ? "not-allowed" : "pointer" }) }, (ruleOff ? "🚫" : "—") + " Rule"),
        h("button", { onClick: function () { setGroup(ALIGNS[(ALIGNS.indexOf(groupAlign) + 1) % ALIGNS.length] || "justify"); }, title: "Whole-section alignment: " + (ALABEL[groupAlign] || groupAlign) + ". Click to cycle.", style: btn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11 }) }, (AICON[groupAlign] || AICON.justify) + " Section")
      );

      // ---- rows ----
      var rowEls = rows.map(function (ev, i) {
        var hiddenRow = !!(e.hidden && e.hidden[i]);
        var bOff = !!ev.bOff, tOff = !!ev.tOff;
        var thisPage = getPage(i), thisAlign = getAlign(i);
        var mk = ev.mk, mkOn = !!mk, mkEmoji = typeof mk === "string" ? mk : "";
        var busyEnrich = enrichingId === "item:" + i, busyCompress = compressingId === "item:" + i;
        return h("div", { key: i, style: { border: "1px solid #eee", borderRadius: 4, padding: 5, marginBottom: 6, background: hiddenRow ? "#fafafa" : "#fff", opacity: hiddenRow ? 0.5 : 1 } },
          // line 1: move · hide-row · lead toggle · lead input · page · CJLR · enhance · fit · delete
          h("div", { style: { display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap" } },
            h("div", { style: { display: "grid", gap: 0, justifyItems: "center", width: 20, flexShrink: 0 } },
              h("button", { onClick: function () { moveRow(i, -1); }, disabled: i === 0, title: "Move up", style: { fontSize: 10, border: "none", background: "none", color: i === 0 ? "#ccc" : "#666", padding: 0, cursor: i === 0 ? "default" : "pointer" } }, "▲"),
              h("button", { onClick: function () { moveRow(i, 1); }, disabled: i === rows.length - 1, title: "Move down", style: { fontSize: 10, border: "none", background: "none", color: i === rows.length - 1 ? "#ccc" : "#666", padding: 0, cursor: i === rows.length - 1 ? "default" : "pointer" } }, "▼")
            ),
            h("button", { onClick: function () { toggleRowHidden(i); }, title: hiddenRow ? "Row hidden — show" : "Row shown — hide", style: btn({ border: "1px solid " + (hiddenRow ? "#999" : accent), color: hiddenRow ? "#999" : accent, fontSize: 11, minWidth: 22 }) }, hiddenRow ? "🙈" : "👁"),
            h("button", { onClick: function () { updateRow(i, { mk: mkOn ? false : true }); }, title: mkOn ? "Marker ON — click to remove" : "No marker — click to add a bullet marker (then type an emoji to customise)", style: btn({ border: "1px solid " + (mkOn ? "#0a8" : "#bbb"), color: mkOn ? "#0a8" : "#bbb", minWidth: 22 }) }, mkOn ? (mkEmoji || "•") : "◦"),
            mkOn ? h("input", { value: mkEmoji, onChange: function (x) { var v = x.target.value; updateRow(i, { mk: v ? v : true }); }, title: "Row marker — leave blank for a bullet, or type any emoji (e.g. 🚀, ✅, ▸)", placeholder: "•", maxLength: 4, style: { width: 26, textAlign: "center", fontSize: 13, padding: "2px 2px", border: "1px solid #0a8", borderRadius: 3, flexShrink: 0 } }) : null,
            h("button", { onClick: function () { updateRow(i, { bOff: !bOff }); }, title: bOff ? "Lead-in hidden — show it" : "Lead-in shown — hide it", style: btn({ border: "1px solid " + (bOff ? "#999" : "#0a8"), color: bOff ? "#999" : "#0a8", fontWeight: 700, minWidth: 24 }) }, bOff ? "a̶" : "Aa"),
            h("input", { value: ev.b || "", onChange: function (x) { updateRow(i, { b: x.target.value }); }, placeholder: "Lead-in (e.g. Hands-on)", style: { fontSize: 11, padding: 4, border: "1px solid #ddd", borderRadius: 3, minWidth: 60, flex: "0 1 150px", fontWeight: 700, fontFamily: "Georgia,serif", opacity: bOff ? 0.5 : 1 } }),
            h("button", { onClick: function () { setPage(i, thisPage >= 4 ? 1 : thisPage + 1); }, title: "Row page: " + thisPage + ". Click to cycle 1→2→3→4.", style: btn({ border: "1px solid #01B7BB", color: "#00746E", background: thisPage === 1 ? "rgba(1,183,187,.08)" : "rgba(255,255,255,.10)", fontSize: 9, minWidth: 28 }) }, "P" + thisPage),
            h("button", { onClick: function () { setAlign(i, ALIGNS[(ALIGNS.indexOf(thisAlign) + 1) % ALIGNS.length] || "justify"); }, title: "Alignment: " + (ALABEL[thisAlign] || thisAlign) + ". Click to cycle.", style: btn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11, minWidth: 22 }) }, AICON[thisAlign] || AICON.justify),
            onEnrich ? h("button", { onClick: function () { onEnrich("item:" + i); }, disabled: busyEnrich || busyCompress, title: "Enhance this row", style: btn({ border: "1px solid " + (busyEnrich ? "#ccc" : "#10b981"), color: busyEnrich ? "#ccc" : "#10b981", fontSize: 9, cursor: busyEnrich || busyCompress ? "wait" : "pointer" }) }, busyEnrich ? "⏳" : "✨") : null,
            onCompress ? h("button", { onClick: function () { onCompress("item:" + i); }, disabled: busyCompress || busyEnrich, title: "Fit this row — tighten to one line", style: btn({ border: "1px solid " + (busyCompress ? "#ccc" : "#7c3aed"), color: busyCompress ? "#ccc" : "#7c3aed", fontSize: 9, cursor: busyCompress || busyEnrich ? "wait" : "pointer" }) }, busyCompress ? "⏳" : "⇥") : null,
            h("button", { onClick: function () { deleteRow(i); }, title: "Delete row", style: btn({ border: "1px solid #e55", color: "#e55", fontSize: 10 }) }, "✕")
          ),
          // line 2: body toggle + body textarea
          h("div", { style: { display: "flex", gap: 4, alignItems: "flex-start", marginTop: 4 } },
            h("button", { onClick: function () { updateRow(i, { tOff: !tOff }); }, title: tOff ? "Body hidden — show it" : "Body shown — hide it", style: btn({ border: "1px solid " + (tOff ? "#999" : "#0a8"), color: tOff ? "#999" : "#0a8", minWidth: 24, marginTop: 2 }) }, tOff ? "¶̶" : "¶"),
            h("textarea", { value: ev.t || "", onChange: function (x) { updateRow(i, { t: x.target.value }); }, placeholder: "Body text", rows: 2, style: { flex: "1 1 auto", fontSize: 12, padding: 6, border: "1px solid #ddd", borderRadius: 4, resize: "vertical", fontFamily: "Georgia,serif", boxSizing: "border-box", textAlign: thisAlign === "justify" ? "left" : thisAlign, opacity: tOff ? 0.5 : 1 } })
          )
        );
      });

      var addBtn = h("button", { onClick: addRow, style: { fontSize: 11, background: "none", border: "1px solid " + accent, color: accent, borderRadius: 4, padding: "4px 10px", cursor: "pointer", marginTop: 2 } }, "+ Row");

      return h(R.Fragment, null, bar, rowEls, addBtn);
    }

    window.AntcvRichBlockEditor = RichBlockEditor;
    return true;
  }
  if (!define()) {
    var tries = 0;
    var t = setInterval(function () { if (define() || ++tries > 100) clearInterval(t); }, 150);
    window.addEventListener("DOMContentLoaded", define);
  }
})();
