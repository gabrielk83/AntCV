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

  function isOn() {
    try { return localStorage.getItem(FLAG) === '1'; } catch (_) { return false; }
  }

  // A role's own per-segment style, if the role carries one (roleLineStyle is the
  // NEW optional field the 3-segment editor writes; absent => section defaults).
  function segStyle(role, kind) {
    var st = role && role.roleLineStyle && typeof role.roleLineStyle === 'object'
      ? role.roleLineStyle[kind] : null;
    return st && typeof st === 'object' ? st : {};
  }

  // roles[] -> rich_block section (forward). Pure; does not mutate `sec`.
  function adapt(sec) {
    if (!sec || !Array.isArray(sec.roles)) return sec;
    var roles = sec.roles;
    var items = [];
    for (var r = 0; r < roles.length; r++) {
      var role = roles[r];
      if (!role || typeof role !== 'object') continue;
      // Preview parity: the chimera preview (Ce/6832) renders null for on:false
      // roles (the Ae editor panel owns visibility toggling), so skip them here.
      // _ri keeps the TRUE roles[] index, so writeback is unaffected by skipping.
      // TODO(render stage): also mirror the <unused slot> + fully-bracketed
      // placeholder drop (needs the __hasRealRole context from the section).
      if (role.on === false) continue;
      var on = true;
      var seg = [
        Object.assign({ t: role.title || '', kind: 'role' }, segStyle(role, 'role')),
        Object.assign({ t: role.company || '', kind: 'company' }, segStyle(role, 'company')),
        Object.assign({ t: role.years || '', kind: 'years' }, segStyle(role, 'years'))
      ];
      items.push({
        grp: true, roleHead: true, seg: seg,
        hr: role.roleLineHr !== false,       // horizontal line under role line (default on)
        _rid: role.id != null ? role.id : ('r' + r), _ri: r,
        page: role.page || 1, on: on
      });
      var bl = Array.isArray(role.bullets) ? role.bullets : [];
      for (var b = 0; b < bl.length; b++) {
        if (bl[b] == null) continue;
        items.push({ t: String(bl[b]), mk: true, _rid: role.id, _ri: r, _bi: b });
      }
      if (typeof role.results === 'string' && role.results.trim()) {
        items.push({ b: (sec._resultsLabel || 'Results:'), t: role.results.trim(),
          _rid: role.id, _ri: r, _results: true });
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
        fontSize: exp, fontStyle: roleSeg.italic === false ? 'normal' : 'italic',
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
        fontStyle: yearSeg.italic === false ? 'normal' : 'italic', fontFamily: T, whiteSpace: 'nowrap'
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

  window.AntcvRolesRichBlock = {
    version: VERSION, isOn: isOn, adapt: adapt, writeBack: writeBack,
    rolesPathFor: rolesPathFor, renderRoleHead: renderRoleHead, FLAG: FLAG
  };
})();
