/* AntCV roles <-> rich_block adapter (ROLES-AS-RICHBLOCK-001)
 *
 * Owner 2026-07-14: "the roles were supposed to build as rich_block ... the only
 * difference is that rich_block has groups and the roles have a role line ... if
 * groups were split to 3 (role/company/years) each with individual colour, font
 * size and Bold/Italic control and a horizontal line, it was possible to handle
 * it in a similar way."
 *
 * OPTION 1 (adapt-in-place): the stored shape stays `section.roles[]` (history,
 * restore, kernel, gen, export all keep reading it). This adapter presents that
 * shape to the rich_block RENDER + EDITOR as a normal rich_block whose group
 * headings are 3-segment role lines, and maps edits back to roles[]. So roles
 * inherit the rich_block machinery (per-group CJLR, orphan/justify handling, the
 * rich_block editor) with no data migration.
 *
 * A role-group HEADING item carries:
 *   { grp:true, roleHead:true, seg:[seg0,seg1,seg2], hr:<bool>, _rid, page, on }
 * where each seg = { t:<text>, kind:'role'|'company'|'years',
 *                    color, size, bold, italic }  (style optional; render falls
 *                    back to the section defaults when a field is absent).
 * A bullet item:  { t:<bullet>, mk:true, _rid, _bi }
 * A results tail: { b:'Results:', t:<results>, _rid, _results:true }
 *
 * The `_rid/_bi/_results/roleHead` breadcrumbs let the WRITEBACK map a rich_block
 * edit-path (items.<i>.t etc.) back to the exact roles[] field, so editing the
 * rich_block view mutates roles[] (never the synthetic items[]).
 */
(function () {
  'use strict';
  var VERSION = '1.51.x-roles-richblock-adapter';
  var FLAG = 'antcv:roles-richblock';

  // ROLES-AS-RICHBLOCK CUTOVER step 1 (owner 2026-07-14, "move to E"): the flag now
  // DEFAULTS ON — experience renders through the rich_block adapter for everyone
  // unless a device explicitly opted out (antcv:roles-richblock === '0'). Verified
  // live: render (12 role heads + bullets), CJLR (per-row/group/section), editor,
  // per-seg bold all correct; EXPORT is unaffected (the worker reads the unchanged
  // roles[] shape). Reversible per-device via setting the flag to '0'. The chimera
  // stays as the flag-off fallback until it is deleted in cutover step 2.
  function isOn() {
    try { return localStorage.getItem(FLAG) !== '0'; } catch (_) { return true; }
  }

  // A role's own per-segment style, if the role carries one (roleLineStyle is the
  // NEW optional field the 3-segment editor writes; absent => section defaults).
  function segStyle(role, kind) {
    var st = role && role.roleLineStyle && typeof role.roleLineStyle === 'object'
      ? role.roleLineStyle[kind] : null;
    return st && typeof st === 'object' ? st : {};
  }

  // Chimera drop-rule helpers (app.src.js:6850) — mirror them so flag-on preview
  // parity holds: a fully-bracketed "[Role title]" placeholder, an empty string,
  // or the literal "<unused slot>" marker all count as "blank".
  function isBlank(x) {
    var t = String(x == null ? '' : x).trim();
    return !t || /^\[[^\]]*\]$/.test(t) || t.toLowerCase() === '<unused slot>';
  }
  function isPlaceholderRole(role) {
    var bl = Array.isArray(role.bullets) ? role.bullets : [];
    return isBlank(role.title) && isBlank(role.company) && (!bl.length || bl.every(isBlank));
  }
  function isUnusedSlot(role) {
    var bl = Array.isArray(role.bullets) ? role.bullets : [];
    return bl.length > 0 && bl.every(function (b) { return String(b == null ? '' : b).trim().toLowerCase() === '<unused slot>'; });
  }

  // roles[] -> rich_block section (forward). Pure; does not mutate `sec`.
  // opts.forEditor: include ALL roles (no drop) + stamp on-state, so the EDITOR
  // reconstructs the full roles[] with zero data loss. Default (preview) drops
  // hidden/placeholder roles for Ce parity.
  function adapt(sec, opts) {
    if (!sec || !Array.isArray(sec.roles)) return sec;
    var forEditor = !!(opts && opts.forEditor);
    var roles = sec.roles;
    // hasRealRole gates the placeholder drop so a FRESH me() skeleton (all roles
    // bracketed) keeps its roles visible/editable (matches CV-GHOST-...-002).
    var hasRealRole = roles.some(function (r) { return r && typeof r === 'object' && !isPlaceholderRole(r); });
    var items = [];
    for (var r = 0; r < roles.length; r++) {
      var role = roles[r];
      if (!role || typeof role !== 'object') continue;
      // Preview parity: the chimera preview (Ce/6832) renders null for on:false,
      // <unused slot>, hasRealRole+placeholder, and export-hidden (targeted app)
      // roles. _ri keeps the TRUE roles[] index, so writeback survives skips.
      // The EDITOR (forEditor) shows ALL roles so itemsToRoles rebuilds the full
      // list with no data loss.
      if (!forEditor) {
        if (role.on === false) continue;
        if (isUnusedSlot(role)) continue;
        if (hasRealRole && isPlaceholderRole(role)) continue;
        try { if (typeof window !== 'undefined' && window.AntcvExportHiddenRole && window.AntcvExportHiddenRole(role)) continue; } catch (_) {}
      }
      var on = role.on !== false;
      var seg = [
        Object.assign({ t: role.title || '', kind: 'role' }, segStyle(role, 'role')),
        Object.assign({ t: role.company || '', kind: 'company' }, segStyle(role, 'company')),
        Object.assign({ t: role.years || '', kind: 'years' }, segStyle(role, 'years'))
      ];
      items.push({
        grp: true, roleHead: true, seg: seg,
        hr: role.roleLineHr !== false,       // horizontal line under role line (default on)
        _rid: role.id != null ? role.id : ('r' + r), _ri: r,
        _key: 'roles.' + r,                  // stable roles-path key for CJLR (worker honours it)
        page: role.page || 1, on: on
      });
      var bl = Array.isArray(role.bullets) ? role.bullets : [];
      var meta = Array.isArray(role.bulletMeta) ? role.bulletMeta : [];
      for (var b = 0; b < bl.length; b++) {
        if (bl[b] == null) continue;
        var bhidden = !!(meta[b] && meta[b].hidden);
        if (!forEditor && bhidden) continue;   // preview drops hidden bullets (parity)
        items.push({ t: String(bl[b]), mk: true, _rid: role.id, _ri: r, _bi: b,
          _key: 'roles.' + r + '.bullets.' + b, hidden: bhidden });
      }
      if (typeof role.results === 'string' && role.results.trim()) {
        items.push({ b: (sec._resultsLabel || 'Results:'), t: role.results.trim(),
          _rid: role.id, _ri: r, _results: true, _key: 'roles.' + r + '.results' });
      }
    }
    // Preserve the section identity/props; only swap the shape the renderer reads.
    var out = {};
    for (var k in sec) if (Object.prototype.hasOwnProperty.call(sec, k)) out[k] = sec[k];
    out.type = 'rich_block';
    out.items = items;
    out.__fromRoles = true;   // marker: editor writeback routes back to roles[]
    out.roles = sec.roles;    // keep the source visible for writeback
    return out;
  }

  // Reverse adapter: rich_block items[] -> roles[]. Used by the EDITOR wiring so
  // RichBlockEditor's structural ops (add/delete/reorder row, add group, edit)
  // rebuild roles[] with NO data loss. Walks items: each roleHead/grp starts a
  // new role (reusing the orig role's non-role-line fields via _rid so pins,
  // outcomes, proofPointIds etc. survive); following body rows are that role's
  // bullets; a Results row sets role.results. Pure.
  function itemsToRoles(items, origRoles) {
    items = Array.isArray(items) ? items : [];
    origRoles = Array.isArray(origRoles) ? origRoles : [];
    var byId = {};
    for (var q = 0; q < origRoles.length; q++) {
      var or = origRoles[q];
      if (or && or.id != null) byId[or.id] = or;
    }
    var out = [];
    var cur = null;
    // Fields the role LINE / bullets own here — everything else on the orig role
    // is carried through untouched.
    var OWNED = { title: 1, company: 1, years: 1, bullets: 1, bulletMeta: 1, results: 1, roleLineStyle: 1, roleLineHr: 1, page: 1, on: 1 };
    function startRole(it) {
      var base = (it && it._rid != null && byId[it._rid]) ? byId[it._rid] : null;
      var role = {};
      if (base) for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k) && !OWNED[k]) role[k] = base[k];
      var seg = Array.isArray(it.seg) ? it.seg : null;
      if (seg) {
        role.title = (seg[0] && seg[0].t) || '';
        role.company = (seg[1] && seg[1].t) || '';
        role.years = (seg[2] && seg[2].t) || '';
        var style = {};
        ['role', 'company', 'years'].forEach(function (kind, idx) {
          var sg = seg[idx] || {}, st = {};
          if (sg.color != null) st.color = sg.color;
          if (sg.bold != null) st.bold = sg.bold;
          if (sg.italic != null) st.italic = sg.italic;
          if (Object.keys(st).length) style[kind] = st;
        });
        if (Object.keys(style).length) role.roleLineStyle = style;
      } else {
        // plain group row (e.g. "+ Group" added a role with just a heading)
        role.title = (it && it.t) || '';
        role.company = '';
        role.years = '';
      }
      if (it && it.hr === false) role.roleLineHr = false;
      if (it && it.page) role.page = it.page;
      role.on = !(it && it.on === false);
      role.id = (base && base.id != null) ? base.id
        : (it && it._rid != null) ? it._rid
        : ('r' + out.length + '_' + String(role.title || '').replace(/\s+/g, '').slice(0, 6));
      role.bullets = [];
      return role;
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== 'object') continue;
      if (it.roleHead || it.grp) { cur = startRole(it); out.push(cur); continue; }
      if (!cur) { cur = startRole({ seg: [] }); out.push(cur); }   // orphan-body safety
      if (it._results || (typeof it.b === 'string' && /^results?:/i.test(it.b.trim()))) {
        cur.results = it.t != null ? it.t : '';
        continue;
      }
      cur.bullets.push(it.t != null ? it.t : (it.b || ''));
      if (it.hidden) { if (!cur.bulletMeta) cur.bulletMeta = []; cur.bulletMeta[cur.bullets.length - 1] = { hidden: true }; }
    }
    return out;
  }

  // Map a rich_block edit-path ["items", i, field] on an adapted section back to
  // the roles[] mutation. Returns { roles:<new roles[]> } to feed onChange, or
  // null if the path is not writable (e.g. a synthetic label). Pure.
  function writeBack(sec, itemIndex, field, value) {
    if (!sec || !sec.__fromRoles || !Array.isArray(sec.items) || !Array.isArray(sec.roles)) return null;
    var it = sec.items[itemIndex];
    if (!it) return null;
    var ri = it._ri;
    if (ri == null || ri < 0 || ri >= sec.roles.length) return null;
    var roles = sec.roles.slice();
    var role = Object.assign({}, roles[ri]);
    if (it.roleHead) {
      // Heading edit: field is the segment kind (role/company/years) OR a style.
      if (field === 'role') role.title = value;
      else if (field === 'company') role.company = value;
      else if (field === 'years') role.years = value;
      else return null;
    } else if (it._results) {
      role.results = value;
    } else if (it._bi != null) {
      var bl = Array.isArray(role.bullets) ? role.bullets.slice() : [];
      bl[it._bi] = value;
      role.bullets = bl;
    } else {
      return null;
    }
    roles[ri] = role;
    return { roles: roles };
  }

  // Translate a rich_block edit-path ["items", i, field] on an adapted section
  // to the roles[] leaf-path the app's inline editor `p` already understands
  // (the chimera uses ["roles", ri, "title"] etc.). Returns the roles path array
  // or null. This is what makes the adapted rich_block view edit back into
  // roles[] through the UNCHANGED onEdit handler — no writeBack array rebuild.
  function rolesPathFor(sec, itemIndex, field) {
    if (!sec || !sec.__fromRoles || !Array.isArray(sec.items)) return null;
    var it = sec.items[itemIndex];
    if (!it) return null;
    var ri = it._ri;
    if (ri == null) return null;
    if (it.roleHead) {
      if (field === 'role') return ['roles', ri, 'title'];
      if (field === 'company') return ['roles', ri, 'company'];
      if (field === 'years') return ['roles', ri, 'years'];
      return null;
    }
    if (it._results) return ['roles', ri, 'results'];
    if (it._bi != null) return ['roles', ri, 'bullets', it._bi];
    return null;
  }

  // Render the 3-segment role line (role · company · years) + optional hr,
  // matching the current chimera by default (owner "match current chimera"):
  //   seg role    = bold + italic, mainSubHeadColor
  //   seg company = normal weight + italic, mainCompanyColor
  //   seg years   = italic, mainYearColor, right-aligned
  //   hr          = 1px mainSubHeadColor under the role line
  // Per-segment {color,bold,italic} overrides win when present (stage-2 editor).
  // Kept in the sidecar so app.js only calls it (minimal minified-mirror surface).
  // ctx = { B, P, T, k, s, exp, C }. React passed explicitly.
  function renderRoleHead(React, ctx, row, i) {
    var h = React.createElement;
    var B = ctx.B, T = ctx.T, k = ctx.k || {}, s = ctx.s, exp = ctx.exp;
    var segs = Array.isArray(row.seg) ? row.seg : [];
    var roleSeg = segs[0] || {}, compSeg = segs[1] || {}, yearSeg = segs[2] || {};
    var subColor = k.mainSubHeadColor || s;
    var left = h('span', {
      style: {
        // Owner 2026-07-14: role line = seg0 BOLD (not italic), seg1 italic, seg2 normal.
        fontSize: exp, fontStyle: roleSeg.italic ? 'italic' : 'normal',
        color: roleSeg.color || subColor, fontWeight: roleSeg.bold === false ? 400 : 700, fontFamily: T
      }
    },
      h(B, { path: ['items', i, 'role'], value: roleSeg.t || '', placeholder: '[Role title]' }),
      compSeg.t ? ', ' : '',
      h('span', {
        style: {
          fontWeight: compSeg.bold ? 700 : 400,
          color: compSeg.color || (k.mainCompanyColor || '#333333'),
          fontStyle: compSeg.italic === false ? 'normal' : 'italic'
        }
      }, h(B, { path: ['items', i, 'company'], value: compSeg.t || '', placeholder: '[Company]' }))
    );
    var right = h('span', {
      style: {
        fontSize: exp, color: yearSeg.color || (k.mainYearColor || '#595959'),
        fontStyle: yearSeg.italic ? 'italic' : 'normal', fontFamily: T, whiteSpace: 'nowrap'
      }
    }, h(B, { path: ['items', i, 'years'], value: yearSeg.t || '', placeholder: '[Years]' }));
    return h('div', {
      'data-antcv-row-path': 'items.' + i, 'data-antcv-role-head': '1',
      style: { marginTop: 0 === i ? 0 : 6, marginBottom: 2 }
    },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 4, alignItems: 'baseline' } }, left, right),
      row.hr !== false ? h('div', { style: { borderBottom: '1px solid ' + subColor, margin: '2px 0 2px' } }) : null
    );
  }

  // GENERAL rich_block group heading (Increment A): a group item may carry up to
  // 3 STYLED segments (row.seg = [{t,color,size,bold,italic,sep}]) + an under-group
  // rule (row.hr). Each segment's text is EDITABLE inline via the `B` inline editor
  // at path ["items", i, "seg", n, "t"] — the app's generic deep-path setter
  // commits it to section state, so the edit persists on blur / panel switch and
  // reverts ONLY on undo (owner acceptance criteria 1-2). Layout mirrors the worker
  // renderRichBlock Increment A exactly: inline segments in ONE block honouring the
  // group align (textAlign) — no per-segment padding/border that could reflow while
  // marking (criterion 3). The justify space-between (role-line) + RTL variants land
  // in Increment B (both preview + worker together, to keep parity). ctx = { B, T,
  // k, exp, s, C, align }.
  function renderGroupHead(React, ctx, row, i) {
    var h = React.createElement;
    var B = ctx.B, T = ctx.T, exp = ctx.exp, C = ctx.C;
    var segs = Array.isArray(row.seg) ? row.seg : [];
    // textAlign accepts left|center|right|justify directly — same value the worker
    // paragraph alignment uses, so preview == export.
    var align = ['left', 'center', 'right', 'justify'].indexOf(ctx.align) >= 0 ? ctx.align : 'center';
    var nodes = [];
    for (var n = 0; n < segs.length; n++) {
      var sg = segs[n] || {};
      nodes.push(h('span', {
        key: n,
        style: {
          fontFamily: T,
          fontSize: sg.size ? (sg.size + 'pt') : exp,
          color: sg.color || C,
          fontWeight: sg.bold === false ? 400 : 700,
          fontStyle: sg.italic ? 'italic' : 'normal'
        }
      }, sg.sep || '', h(B, {
        path: ['items', i, 'seg', n, 't'], value: sg.t || '',
        placeholder: '[part ' + (n + 1) + ']'
      })));
    }
    var hrNode = row.hr ? h('div', { style: { borderBottom: '1px solid ' + C, margin: '2px 0 2px' } }) : null;
    // Increment B — JUSTIFY = role-line layout: first n-1 segments grouped left,
    // last segment right, space-between. Mirrors the chimera role line; the RTL
    // inversion (he/ar) comes free from the document `dir`, exactly as the chimera
    // relies on (no explicit direction here). L/C/R keep all segments inline.
    if (align === 'justify' && nodes.length >= 2) {
      return h('div', {
        'data-antcv-row-path': 'items.' + i, 'data-antcv-group-head': '1', 'data-antcv-rowalign': align, 'data-antcv-rowkey': row._key || ('items.' + i),
        style: { marginTop: 0 === i ? 0 : 6, marginBottom: 2, letterSpacing: 0.3 }
      },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 4, alignItems: 'baseline' } },
          h('span', { style: { overflowWrap: 'break-word', wordBreak: 'break-word' } }, nodes.slice(0, -1)),
          h('span', { style: { whiteSpace: 'nowrap' } }, nodes[nodes.length - 1])),
        hrNode);
    }
    return h('div', {
      'data-antcv-row-path': 'items.' + i, 'data-antcv-group-head': '1',
      style: {
        marginTop: 0 === i ? 0 : 6, marginBottom: 2,
        textAlign: align, fontWeight: 700, letterSpacing: 0.3,
        overflowWrap: 'break-word', wordBreak: 'break-word'
      }
    }, nodes, hrNode);
  }

  window.AntcvRolesRichBlock = {
    version: VERSION, isOn: isOn, adapt: adapt, writeBack: writeBack,
    itemsToRoles: itemsToRoles, rolesPathFor: rolesPathFor,
    renderRoleHead: renderRoleHead, renderGroupHead: renderGroupHead, FLAG: FLAG
  };
})();
