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
      // ROWFIT-HOURGLASS-LATCH-001 (owner 2026-07-22): the App-level busy id (enrichingId/
      // compressingId) can be set-and-cleared inside the same render-storm churn before React
      // commits a ⏳ frame, so on a busy/oscillating page the hourglass never visibly appears.
      // Latch it LOCALLY the instant the row's button is clicked so the ⏳ always shows for at
      // least ~1.4s (extended by the real busy id if the op runs longer). Keyed "e:"/"c:" per row.
      var latchSt = R.useState({}); var latch = latchSt[0], setLatch = latchSt[1];
      function markBusy(key) {
        setLatch(function (m) { var n = Object.assign({}, m); n[key] = 1; return n; });
        setTimeout(function () { setLatch(function (m) { if (!m[key]) return m; var n = Object.assign({}, m); delete n[key]; return n; }); }, 1400);
      }
      var sid = e.id;
      // ROLES-AS-RICHBLOCK-001: when editing the adapted experience section, per-row
      // CJLR is keyed by the ROLES path (item._key = "roles.R.bullets.B") instead of
      // the ephemeral "items.i" — the docx-worker already reads paraAlignPath on that
      // key, so CJLR EXPORTS with no worker change. Hide is per-item (ev.hidden ->
      // roles bulletMeta / role.on) not the section.hidden array.
      var fromRoles = !!e.__fromRoles;
      function rerender() { bump(function (x) { return x + 1; }); }

      function getPage(i) { try { var b = readJSON("antcv:itemPages")[sid] || {}; var n = Number(b[String(i)] || b["items." + i] || 1); return n >= 1 && n <= 4 ? (n | 0) : 1; } catch (_) { return 1; } }
      function setPage(i, n) { var m = readJSON("antcv:itemPages"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid][String(i)] = n; m[sid]["items." + i] = n; writeJSON("antcv:itemPages", m); emit("antcv:item-pages-changed", { sid: sid, index: i, page: n }); rerender(); }
      function keyFor(i) { return (fromRoles && rows[i] && rows[i]._key) ? rows[i]._key : ("items." + i); }
      function getAlign(i) { try { var b = readJSON("antcvItemAlignment")[sid] || {}; var v = b[keyFor(i)] || b["items." + i] || b[String(i)] || "justify"; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; } catch (_) { return "justify"; } }
      function setAlign(i, v) { var m = readJSON("antcvItemAlignment"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid][keyFor(i)] = v; if (!fromRoles) { m[sid]["items." + i] = v; m[sid][String(i)] = v; } writeJSON("antcvItemAlignment", m); emit("antcv:item-align-changed", { sid: sid, index: i, alignment: v }); rerender(); }
      function getGroup() { try { var b = readJSON("antcvItemAlignment")[sid] || {}; var v = b.__group__; return ALIGNS.indexOf(v) >= 0 ? v : "justify"; } catch (_) { return "justify"; } }
      function setGroup(v) { var m = readJSON("antcvItemAlignment"); if (!m[sid] || typeof m[sid] !== "object") m[sid] = {}; m[sid].__group__ = v; writeJSON("antcvItemAlignment", m); emit("antcv:item-align-changed", { sid: sid, index: -1, alignment: v }); rerender(); }

      var rows = (e.items && e.items.length ? e.items : [{ b: "", t: "" }]).map(function (x) {
        return x && typeof x === "object" ? x : { b: "", t: String(x || "") };
      });
      function updateRow(i, patch) { d({ items: rows.map(function (x, j) { return j === i ? Object.assign({}, x, patch) : x; }) }); }
      function moveRow(i, delta) { var o = rows.slice(); var r2 = i + delta; if (r2 < 0 || r2 >= o.length) return; var tmp = o[i]; o[i] = o[r2]; o[r2] = tmp; d({ items: o }); }
      function deleteRow(i) { d({ items: rows.filter(function (x, j) { return j !== i; }), hidden: (e.hidden || []).filter(function (x, j) { return j !== i; }) }); }
      function addRow() { d({ items: rows.concat([{ b: "", t: "" }]) }); }
      function addGroup() { d({ items: rows.concat([{ grp: true, t: "" }]) }); }
      function toggleGrp(i) { var o = rows.map(function (x, j) { return j === i ? (x.grp ? { b: x.b || "", t: x.t || "" } : { grp: true, t: x.t || "", grpKeep: true }) : x; }); d({ items: o }); }
      function toggleRowHidden(i) { var hd = (e.hidden || []).slice(); hd[i] = !hd[i]; d({ hidden: hd }); }

      var btn = function (extra) { return Object.assign({ fontSize: 10, padding: "2px 6px", borderRadius: 3, cursor: "pointer", background: "none", whiteSpace: "nowrap", flexShrink: 0 }, extra || {}); };

      // ---- whole-section bar: headline toggle · rule toggle · section CJLR ----
      var groupAlign = getGroup();
      var headOff = !!e.headlineOff, ruleOff = !!e.ruleOff;
      // Whole-section lead-in ("Verb"/starter) style — bold / italic / colour / colon (NOT per row).
      var leadBold = e.leadBold !== false, leadItalic = !!e.leadItalic, leadColor = e.leadColor || accent, leadColon = !!e.leadColon;
      // LEAD-UNDERLINE-001 (owner 2026-07-16): whole-section lead-in underline + its colour.
      var leadUnderline = !!e.leadUnderline, leadUnderlineColor = e.leadUnderlineColor || leadColor;
      var bar = h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed #e3e3e3" } },
        h("button", { onClick: function () { d({ headlineOff: !headOff }); }, title: headOff ? "Headline hidden — show it" : "Headline shown — hide it", style: btn({ border: "1px solid " + (headOff ? "#999" : accent), color: headOff ? "#999" : accent }) }, (headOff ? "🙈" : "👁") + " Headline"),
        // RULE-INDEPENDENT-001 (owner 2026-07: "still not editable independently"). The rule
        // is now editable even when the headline TEXT is hidden: while headlineOff it toggles
        // a standalone `headlineRule` line (opt-in, default off); otherwise it toggles ruleOff.
        h("button", { onClick: function () { if (headOff) d({ headlineRule: !e.headlineRule }); else d({ ruleOff: !ruleOff }); }, title: headOff ? (e.headlineRule ? "Rule line shown — hide it" : "Show a rule line (headline text stays hidden)") : (ruleOff ? "Rule hidden — show it" : "Rule shown — hide it"), style: btn({ border: "1px solid " + (headOff ? (e.headlineRule ? accent : "#999") : ruleOff ? "#999" : accent), color: headOff ? (e.headlineRule ? accent : "#999") : ruleOff ? "#999" : accent, cursor: "pointer" }) }, ((headOff ? !e.headlineRule : ruleOff) ? "🚫" : "—") + " Rule"),
        // CL-HEADLINE-VRULE-001 (owner 2026-06-30): a vertical cue line for when the
        // headline TEXT is hidden — gives the section a visual marker. Enabled only
        // while the headline is off (that is when the cue is needed).
        h("button", { onClick: function () { if (headOff) d({ headlineVRule: !e.headlineVRule }); }, disabled: !headOff, title: headOff ? (e.headlineVRule ? "Vertical cue line shown — hide it" : "Show a vertical cue line marking this section while the headline is hidden") : "Hide the headline first to use the vertical cue", style: btn({ border: "1px solid " + (headOff ? (e.headlineVRule ? accent : "#999") : "#ddd"), color: headOff ? (e.headlineVRule ? accent : "#999") : "#ddd", cursor: headOff ? "pointer" : "not-allowed" }) }, (e.headlineVRule ? "│" : "┊") + " Cue"),
        h("button", { onClick: function () { setGroup(ALIGNS[(ALIGNS.indexOf(groupAlign) + 1) % ALIGNS.length] || "justify"); }, title: "GROUP HEADINGS alignment: " + (ALABEL[groupAlign] || groupAlign) + ". Aligns the group/role-line headings only (not the body rows — use the per-row control for those). Click to cycle.", style: btn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11 }) }, (AICON[groupAlign] || AICON.justify) + " Groups"),
        h("span", { style: { fontSize: 10, color: "#888", marginLeft: 4 } }, "Lead:"),
        h("button", { onClick: function () { d({ leadBold: !leadBold }); }, title: "Lead-in bold (whole section)", style: btn({ border: "1px solid " + (leadBold ? accent : "#bbb"), color: leadBold ? accent : "#bbb", fontWeight: 800, minWidth: 22 }) }, "B"),
        h("button", { onClick: function () { d({ leadItalic: !leadItalic }); }, title: "Lead-in italic (whole section)", style: btn({ border: "1px solid " + (leadItalic ? accent : "#bbb"), color: leadItalic ? accent : "#bbb", fontStyle: "italic", fontWeight: 700, minWidth: 22 }) }, "I"),
        h("input", { type: "color", value: leadColor, onChange: function (x) { d({ leadColor: x.target.value }); }, title: "Lead-in colour (whole section)", style: { width: 26, height: 22, padding: 0, border: "1px solid #ccc", borderRadius: 3, cursor: "pointer", flexShrink: 0 } }),
        h("button", { onClick: function () { d({ leadColon: !leadColon }); }, title: leadColon ? "Lead-in followed by a colon (Label: value) — click to remove" : "No colon after the lead-in — click to add (Label: value)", style: btn({ border: "1px solid " + (leadColon ? accent : "#bbb"), color: leadColon ? accent : "#bbb", fontWeight: 700, minWidth: 22 }) }, "L:"),
        h("button", { onClick: function () { d({ leadUnderline: !leadUnderline }); }, title: "Lead-in underline (whole section)", style: btn({ border: "1px solid " + (leadUnderline ? accent : "#bbb"), color: leadUnderline ? accent : "#bbb", textDecoration: "underline", fontWeight: 700, minWidth: 22 }) }, "U"),
        h("input", { type: "color", value: leadUnderlineColor, disabled: !leadUnderline, onChange: function (x) { d({ leadUnderline: true, leadUnderlineColor: x.target.value }); }, title: "Lead-in underline colour (whole section)", style: { width: 26, height: 22, padding: 0, border: "1px solid #ccc", borderRadius: 3, cursor: leadUnderline ? "pointer" : "not-allowed", opacity: leadUnderline ? 1 : 0.5, flexShrink: 0 } })
      );

      // ---- rows ----
      var rowEls = rows.map(function (ev, i) {
        var hiddenRow = fromRoles
          ? (ev.roleHead ? ev.on === false : !!ev.hidden)
          : !!(e.hidden && e.hidden[i]);
        // ROLES-AS-RICHBLOCK-001: a role-line group head (3 segments role/company/
        // years + horizontal-line toggle + per-segment colour). The adapter emits
        // these for professional experience; editing them flows back to roles[] via
        // the wrapped update (itemsToRoles reads seg[]/hr). reorder/delete reuse the
        // shared row ops so a role moves/deletes as one unit.
        if (ev.grp && ev.roleHead) {
          var seg = Array.isArray(ev.seg) ? ev.seg : [{}, {}, {}];
          var setSeg = function (idx, patch2) {
            var ns = [0, 1, 2].map(function (j) { return Object.assign({}, seg[j] || {}, j === idx ? patch2 : null); });
            updateRow(i, { seg: ns });
          };
          // Owner 2026-07-14: effective per-segment defaults — seg0 (role) BOLD,
          // seg1 (company) ITALIC, seg2 (years) NORMAL. The B/I toggles reflect the
          // effective state and write an explicit override (mirrors renderRoleHead).
          var effBold = function (idx, sg) { return sg.bold != null ? !!sg.bold : idx === 0; };
          var effItalic = function (idx, sg) { return sg.italic != null ? !!sg.italic : idx === 1; };
          var segInput = function (idx, ph, extra) {
            var sg = seg[idx] || {};
            var eb = effBold(idx, sg), ei = effItalic(idx, sg);
            return h("div", { style: { display: "flex", alignItems: "center", gap: 3, flex: extra && extra.flex || "1 1 auto", minWidth: 0 } },
              h("input", { value: sg.t || "", onChange: function (x) { setSeg(idx, { t: x.target.value }); }, placeholder: ph, style: Object.assign({ flex: "1 1 auto", fontSize: 11, padding: 4, border: "1px solid #cfe6e3", borderRadius: 3, minWidth: 0, fontWeight: idx === 0 ? 700 : 500, color: "#0a6b66" }, extra && extra.style || {}) }),
              h("input", { type: "color", value: sg.color || (idx === 0 ? "#00746E" : idx === 1 ? "#333333" : "#595959"), onChange: function (x) { setSeg(idx, { color: x.target.value }); }, title: ph + " colour", style: { width: 22, height: 20, padding: 0, border: "1px solid #ccc", borderRadius: 3, cursor: "pointer", flexShrink: 0 } }),
              h("button", { onClick: function () { setSeg(idx, { bold: !eb }); }, title: ph + " bold", style: btn({ border: "1px solid " + (eb ? accent : "#bbb"), color: eb ? accent : "#bbb", fontWeight: 800, minWidth: 20, padding: "2px 4px" }) }, "B"),
              h("button", { onClick: function () { setSeg(idx, { italic: !ei }); }, title: ph + " italic", style: btn({ border: "1px solid " + (ei ? accent : "#bbb"), color: ei ? accent : "#bbb", fontStyle: "italic", fontWeight: 700, minWidth: 20, padding: "2px 4px" }) }, "I")
            );
          };
          return h("div", { key: i, style: { border: "1px solid #cbe0dd", borderRadius: 4, padding: 5, marginBottom: 6, background: hiddenRow ? "#fafafa" : "#eaf6f5", opacity: hiddenRow ? 0.5 : 1, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" } },
            h("div", { style: { display: "grid", gap: 0, justifyItems: "center", width: 20, flexShrink: 0 } },
              h("button", { onClick: function () { moveRow(i, -1); }, disabled: i === 0, title: "Move role up", style: { fontSize: 10, border: "none", background: "none", color: i === 0 ? "#ccc" : "#666", padding: 0, cursor: i === 0 ? "default" : "pointer" } }, "▲"),
              h("button", { onClick: function () { moveRow(i, 1); }, disabled: i === rows.length - 1, title: "Move role down", style: { fontSize: 10, border: "none", background: "none", color: i === rows.length - 1 ? "#ccc" : "#666", padding: 0, cursor: i === rows.length - 1 ? "default" : "pointer" } }, "▼")
            ),
            h("button", { onClick: function () { updateRow(i, { on: ev.on === false ? true : false }); }, title: ev.on === false ? "Role hidden — click to show" : "Role shown — click to hide the whole role", style: btn({ border: "1px solid " + (ev.on === false ? "#999" : accent), color: ev.on === false ? "#999" : accent, fontSize: 11, minWidth: 22 }) }, ev.on === false ? "🙈" : "👁"),
            h("span", { style: { fontSize: 9, color: "#0a8", fontWeight: 700, flexShrink: 0, width: 26 } }, "ROLE"),
            segInput(0, "Role title", { flex: "2 1 160px" }),
            segInput(1, "Company", { flex: "1 1 110px" }),
            segInput(2, "Years", { flex: "0 1 90px" }),
            h("button", { onClick: function () { updateRow(i, { hr: ev.hr === false ? true : false }); }, title: ev.hr === false ? "Horizontal line OFF — click to show a line under the role" : "Horizontal line ON — click to hide", style: btn({ border: "1px solid " + (ev.hr === false ? "#bbb" : "#0a8"), color: ev.hr === false ? "#bbb" : "#0a8", fontWeight: 700, minWidth: 24 }) }, "—"),
            h("button", { onClick: function () { var end = i + 1; while (end < rows.length && !(rows[end] && rows[end].grp)) end++; d({ items: rows.filter(function (x, j) { return j < i || j >= end; }) }); }, title: "Delete this role (and its bullets below)", style: btn({ border: "1px solid #e55", color: "#e55", fontSize: 10 }) }, "✕")
          );
        }
        // group sub-heading row — a single heading input + reorder/un-group/delete.
        if (ev.grp) {
          return h("div", { key: i, style: { border: "1px solid #d8e8e6", borderRadius: 4, padding: 5, marginBottom: 6, background: hiddenRow ? "#fafafa" : "#f1faf9", opacity: hiddenRow ? 0.5 : 1, display: "flex", gap: 4, alignItems: "center" } },
            h("div", { style: { display: "grid", gap: 0, justifyItems: "center", width: 20, flexShrink: 0 } },
              h("button", { onClick: function () { moveRow(i, -1); }, disabled: i === 0, title: "Move up", style: { fontSize: 10, border: "none", background: "none", color: i === 0 ? "#ccc" : "#666", padding: 0, cursor: i === 0 ? "default" : "pointer" } }, "▲"),
              h("button", { onClick: function () { moveRow(i, 1); }, disabled: i === rows.length - 1, title: "Move down", style: { fontSize: 10, border: "none", background: "none", color: i === rows.length - 1 ? "#ccc" : "#666", padding: 0, cursor: i === rows.length - 1 ? "default" : "pointer" } }, "▼")
            ),
            h("span", { style: { fontSize: 10, color: "#0a8", fontWeight: 700, flexShrink: 0 } }, "▾ Group"),
            h("input", { value: ev.t || "", onChange: function (x) { updateRow(i, { t: x.target.value }); }, placeholder: "Sub-group heading (e.g. Engineering)", style: { flex: "1 1 auto", fontSize: 11, padding: 4, border: "1px solid #cfe6e3", borderRadius: 3, minWidth: 0, fontWeight: 700, color: "#0a8" } }),
            h("button", { onClick: function () { toggleGrp(i); }, title: "Convert to a normal row", style: btn({ border: "1px solid #888", color: "#888", minWidth: 22 }) }, "↩"),
            h("button", { onClick: function () { deleteRow(i); }, title: "Delete group", style: btn({ border: "1px solid #e55", color: "#e55", fontSize: 10 }) }, "✕")
          );
        }
        var bOff = !!ev.bOff, tOff = !!ev.tOff;
        var thisPage = getPage(i), thisAlign = getAlign(i);
        var mk = ev.mk, mkOn = !!mk, mkEmoji = typeof mk === "string" ? mk : "";
        var busyEnrich = enrichingId === "item:" + i || !!latch["e:item:" + i], busyCompress = compressingId === "item:" + i || !!latch["c:item:" + i];
        return h("div", { key: i, style: { border: "1px solid #eee", borderRadius: 4, padding: 5, marginBottom: 6, background: hiddenRow ? "#fafafa" : "#fff", opacity: hiddenRow ? 0.5 : 1 } },
          // line 1: move · hide-row · lead toggle · lead input · page · CJLR · enhance · fit · delete
          h("div", { style: { display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap" } },
            h("div", { style: { display: "grid", gap: 0, justifyItems: "center", width: 20, flexShrink: 0 } },
              h("button", { onClick: function () { moveRow(i, -1); }, disabled: i === 0, title: "Move up", style: { fontSize: 10, border: "none", background: "none", color: i === 0 ? "#ccc" : "#666", padding: 0, cursor: i === 0 ? "default" : "pointer" } }, "▲"),
              h("button", { onClick: function () { moveRow(i, 1); }, disabled: i === rows.length - 1, title: "Move down", style: { fontSize: 10, border: "none", background: "none", color: i === rows.length - 1 ? "#ccc" : "#666", padding: 0, cursor: i === rows.length - 1 ? "default" : "pointer" } }, "▼")
            ),
            h("button", { onClick: function () { fromRoles ? updateRow(i, { hidden: !ev.hidden }) : toggleRowHidden(i); }, title: hiddenRow ? "Row hidden — show" : "Row shown — hide", style: btn({ border: "1px solid " + (hiddenRow ? "#999" : accent), color: hiddenRow ? "#999" : accent, fontSize: 11, minWidth: 22 }) }, hiddenRow ? "🙈" : "👁"),
            h("button", { onClick: function () { updateRow(i, { mk: mkOn ? false : true }); }, title: mkOn ? "Marker ON — click to remove" : "No marker — click to add a bullet marker (then type an emoji to customise)", style: btn({ border: "1px solid " + (mkOn ? "#0a8" : "#bbb"), color: mkOn ? "#0a8" : "#bbb", minWidth: 22 }) }, mkOn ? (mkEmoji || "•") : "◦"),
            mkOn ? h("input", { value: mkEmoji, onChange: function (x) { var v = x.target.value; updateRow(i, { mk: v ? v : true }); }, title: "Row marker — leave blank for a bullet, or type any emoji (e.g. 🚀, ✅, ▸)", placeholder: "•", maxLength: 4, style: { width: 26, textAlign: "center", fontSize: 13, padding: "2px 2px", border: "1px solid #0a8", borderRadius: 3, flexShrink: 0 } }) : null,
            h("button", { onClick: function () { updateRow(i, { bOff: !bOff }); }, title: bOff ? "Lead-in hidden — show it" : "Lead-in shown — hide it", style: btn({ border: "1px solid " + (bOff ? "#999" : "#0a8"), color: bOff ? "#999" : "#0a8", fontWeight: 700, minWidth: 24 }) }, bOff ? "a̶" : "Aa"),
            h("input", { value: ev.b || "", onChange: function (x) { updateRow(i, { b: x.target.value }); }, placeholder: "Lead-in (e.g. Hands-on)", style: { fontSize: 11, padding: 4, border: "1px solid #ddd", borderRadius: 3, minWidth: 60, flex: "0 1 150px", fontWeight: 700, fontFamily: "Georgia,serif", opacity: bOff ? 0.5 : 1 } }),
            // LEAD-COLON-PERROW-001 (owner 2026-06-30): per-row ":" toggle. Default follows the
            // marker (non-marker -> colon, marker -> none); click to override / REMOVE it. Persists
            // via updateRow (d()) and exports (worker reads row.colon).
            (function () { var eff = (ev.colon != null) ? !!ev.colon : !mkOn; return h("button", { onClick: function () { updateRow(i, { colon: !eff }); }, title: eff ? "Colon after the lead-in (Label: …) — click to remove" : "No colon — click to add (Label: …)", style: btn({ border: "1px solid " + (eff ? accent : "#bbb"), color: eff ? accent : "#bbb", fontWeight: 700, minWidth: 22 }) }, ":"); })(),
            h("button", { onClick: function () { setPage(i, thisPage >= 4 ? 1 : thisPage + 1); }, title: "Row page: " + thisPage + ". Click to cycle 1→2→3→4.", style: btn({ border: "1px solid #01B7BB", color: "#00746E", background: thisPage === 1 ? "rgba(1,183,187,.08)" : "rgba(255,255,255,.10)", fontSize: 9, minWidth: 28 }) }, "P" + thisPage),
            h("button", { onClick: function () { setAlign(i, ALIGNS[(ALIGNS.indexOf(thisAlign) + 1) % ALIGNS.length] || "justify"); }, title: "Alignment: " + (ALABEL[thisAlign] || thisAlign) + ". Click to cycle.", style: btn({ border: "1px solid #7b2ff2", color: "#7b2ff2", background: "rgba(123,47,242,.06)", fontSize: 11, minWidth: 22 }) }, AICON[thisAlign] || AICON.justify),
            onEnrich ? h("button", { onClick: function () { markBusy("e:item:" + i); onEnrich("item:" + i); }, disabled: busyEnrich || busyCompress, title: "Enhance this row", style: btn({ border: "1px solid " + (busyEnrich ? "#ccc" : "#10b981"), color: busyEnrich ? "#ccc" : "#10b981", fontSize: 9, cursor: busyEnrich || busyCompress ? "wait" : "pointer" }) }, busyEnrich ? "⏳" : "✨") : null,
            onCompress ? h("button", { onClick: function () { markBusy("c:item:" + i); onCompress("item:" + i); }, disabled: busyCompress || busyEnrich, title: "Fit this row — tighten to one line", style: btn({ border: "1px solid " + (busyCompress ? "#ccc" : "#7c3aed"), color: busyCompress ? "#ccc" : "#7c3aed", fontSize: 9, cursor: busyCompress || busyEnrich ? "wait" : "pointer" }) }, busyCompress ? "⏳" : "⇥") : null,
            h("button", { onClick: function () { toggleGrp(i); }, title: "Make this a group sub-heading", style: btn({ border: "1px solid #888", color: "#888", minWidth: 22 }) }, "▾"),
            h("button", { onClick: function () { deleteRow(i); }, title: "Delete row", style: btn({ border: "1px solid #e55", color: "#e55", fontSize: 10 }) }, "✕")
          ),
          // line 2: body toggle + body textarea
          h("div", { style: { display: "flex", gap: 4, alignItems: "flex-start", marginTop: 4 } },
            h("button", { onClick: function () { updateRow(i, { tOff: !tOff }); }, title: tOff ? "Body hidden — show it" : "Body shown — hide it", style: btn({ border: "1px solid " + (tOff ? "#999" : "#0a8"), color: tOff ? "#999" : "#0a8", minWidth: 24, marginTop: 2 }) }, tOff ? "¶̶" : "¶"),
            h("textarea", { value: ev.t || "", onChange: function (x) { updateRow(i, { t: x.target.value }); }, placeholder: "Body text", rows: 2, style: { flex: "1 1 auto", fontSize: 12, padding: 6, border: "1px solid #ddd", borderRadius: 4, resize: "vertical", fontFamily: "Georgia,serif", boxSizing: "border-box", textAlign: thisAlign === "justify" ? "left" : thisAlign, opacity: tOff ? 0.5 : 1 } })
          )
        );
      });

      var addBtns = h("div", { style: { display: "flex", gap: 6, marginTop: 2 } },
        h("button", { onClick: addRow, style: { fontSize: 11, background: "none", border: "1px solid " + accent, color: accent, borderRadius: 4, padding: "4px 10px", cursor: "pointer" } }, "+ Row"),
        h("button", { onClick: addGroup, style: { fontSize: 11, background: "none", border: "1px solid #0a8", color: "#0a8", borderRadius: 4, padding: "4px 10px", cursor: "pointer" } }, "+ Group")
      );

      // SECTION-TITLE-IN-EDITOR-001 (owner 2026-07-05: "make the section title
      // editable inside the detailed editor"): a "Section heading" field at the top
      // of the editor. The section title is edited HERE now, so the panel-list title
      // is a plain click-to-open label (no inline edit stealing the open click).
      var titleField = h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 } },
        h("span", { style: { fontSize: 10, color: "#888", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.3 } }, "Section heading"),
        h("input", { value: e.title || "", onChange: function (x) { d({ title: x.target.value }); }, placeholder: "Section heading", style: { flex: "1 1 auto", minWidth: 0, fontSize: 12, fontWeight: 700, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4, fontFamily: "Georgia,serif" } })
      );
      return h(R.Fragment, null, titleField, bar, rowEls, addBtns);
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
