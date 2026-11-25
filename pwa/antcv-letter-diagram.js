/* antcv-letter-diagram.js — LETTER-DIAGRAM-001 (owner 2026-11-25)
 * ============================================================================
 * Owner: "in all future cover letters ... always add some impressive workflow /
 * architecture idea related to something I will do for the company. embed it to the
 * default cover letters we generate also in AntCV and add in the control in preview a
 * diagram adder."
 *
 * DATA. One rich_block row of a cover-letter section IS the diagram, as plain text:
 *     b  "Workflow: <name>" | "Architecture: <name>" | "Loop: <name>"
 *        (da Arbejdsgang / Arkitektur / Kredsløb, es Flujo / Arquitectura / Ciclo,
 *         zh 工作流程 / 架构 / 循环)
 *     t  "Step (detail) → Step (detail) → Step (detail)"   3-5 steps, optional " | note"
 *     dg 'flow' | 'layers' | 'loop'   optional, set by the adder
 * Text only, so every sidecar, the cloud, a translation and an ATS read it; a reader that
 * does not know the rule shows the sentence. A row counts as a diagram when it carries dg,
 * or the lead above (in b, or opening t) AND at least two arrows. Prose with arrows
 * ("250 → 10 days") never counts.
 *
 * PARTS. (1) pure API parse / isDiagramRow / toText / findIn; (2) render(React, env, row, i)
 * for the app.js rich_block row hook, same tree as the panel's mini preview; (3) the adder:
 * a "＋ Diagram" control in the preview bar (cover letter only) and a button in the
 * COVER LETTER FORMAT panel. The docx-worker draws the same row as a native Word table
 * (renderLetterDiagram, its parser is a copy: pwa/test/unit/letter-diagram.test.mjs
 * holds the two to the same results).
 *
 * WRITES. Only on a user action (Insert / Update / Remove), one sections write and one
 * antcv:sections-updated each, and only when an owned field (b, t, dg) changes.
 * Kill switch: localStorage['antcv:disable-letter-diagram'] = '1' (rows print as text).
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.6705-letter-diagram';

  var LEADS = {
    flow: { en: 'Workflow', da: 'Arbejdsgang', es: 'Flujo', zh: '工作流程' },
    layers: { en: 'Architecture', da: 'Arkitektur', es: 'Arquitectura', zh: '架构' },
    loop: { en: 'Loop', da: 'Kredsløb', es: 'Ciclo', zh: '循环' }
  };
  // every accepted lead (lower case) -> kind
  var LEAD_KIND = {
    'workflow': 'flow', 'arbejdsgang': 'flow', 'flujo': 'flow', 'flujo de trabajo': 'flow', '工作流程': 'flow', '工作流': 'flow',
    'architecture': 'layers', 'arkitektur': 'layers', 'arquitectura': 'layers', '架构': 'layers',
    'loop': 'loop', 'feedback loop': 'loop', 'kredsløb': 'loop', 'ciclo': 'loop', '循环': 'loop'
  };
  var KINDS = ['flow', 'loop', 'layers'];
  var MIN = 3, MAX = 6, UI_MAX = 5;
  var ARROW = /\s*(?:→|➔|➜|⟶|⇒|(?:-{1,2}|=)(?:>|&gt;))\s*/;
  var ARROW_G = /(?:→|➔|➜|⟶|⇒|(?:-{1,2}|=)(?:>|&gt;))/g;
  var LEAD_RE = new RegExp('^\\s*(' + Object.keys(LEAD_KIND).sort(function (a, b) { return b.length - a.length; }).join('|') +
    ')\\s*(?:\\(([^)]{1,60})\\))?\\s*(?:[:：]\\s*([\\s\\S]*))?$', 'i');

  // nbsp / narrow nbsp -> space, non-breaking hyphen -> '-', **bold** stripped, runs of spaces joined
  function norm(s) {
    return String(s == null ? '' : s).replace(/[\u00a0\u202f\u2007]/g, ' ').replace(/\u2011/g, '-').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  }
  function arrows(s) { var m = norm(s).match(ARROW_G); return m ? m.length : 0; }

  function splitStep(raw) {
    var s = norm(raw).replace(/^[,;.\s]+|[;,.\s]+$/g, '');
    if (!s) return null;
    var m = /^([^()]{1,60}?)\s*\(([^()]*)\)\s*$/.exec(s);
    if (m) return { label: m[1].trim(), detail: m[2].trim() };
    var c = s.indexOf(': ');
    if (c > 1 && c <= 32) return { label: s.slice(0, c).trim(), detail: s.slice(c + 2).trim() };
    return { label: s, detail: '' };
  }

  // row -> { kind, name, steps:[{label, detail}], note } or null
  function parse(row) {
    try {
      if (!row || typeof row !== 'object' || row.grp) return null;
      var b = norm(row.b), t = norm(row.t);
      var kind = KINDS.indexOf(row.dg) >= 0 ? row.dg : null;
      var name = '', body = t;
      var lb = b ? LEAD_RE.exec(b) : null;
      if (lb) {
        kind = kind || LEAD_KIND[lb[1].toLowerCase()];
        name = norm(lb[3] || lb[2] || '');
      } else if (!b) {
        var lt = LEAD_RE.exec(t);
        if (lt && lt[3]) { kind = kind || LEAD_KIND[lt[1].toLowerCase()]; name = norm(lt[2] || ''); body = norm(lt[3]); }
      } else if (kind) {
        name = b.replace(/[:：]\s*$/, '');
      }
      if (!kind || arrows(body) < MIN - 1) return null;
      var note = '';
      var bar = /\s*(?:\||↺|⟲)\s*([^|↺⟲]*)$/.exec(body);
      if (bar && arrows(bar[1]) === 0) { note = norm(bar[1]); body = norm(body.slice(0, bar.index)); }
      var steps = body.split(ARROW).map(splitStep).filter(Boolean);
      if (steps.length < MIN || steps.length > MAX) return null;
      steps.forEach(function (s) { s.label = s.label.charAt(0).toUpperCase() + s.label.slice(1); });
      return { kind: kind, name: name.replace(/[:：.]\s*$/, ''), steps: steps, note: note.replace(/\.\s*$/, '') };
    } catch (_) { return null; }
  }

  function disabled() { try { return root.localStorage.getItem('antcv:disable-letter-diagram') === '1'; } catch (_) { return false; } }
  function isDiagramRow(row) { return !disabled() && !!parse(row); }

  function cleanField(s) {
    return norm(s).replace(ARROW_G, ',').replace(/[()|↺⟲]/g, ' ').replace(/\s*[–—]\s*/g, ', ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  }
  // model -> { b, t, dg } row fields (the only fields this file owns)
  function toText(model, lang) {
    var kind = KINDS.indexOf(model && model.kind) >= 0 ? model.kind : 'flow';
    var l = String(lang || 'en').toLowerCase().slice(0, 2);
    var lead = LEADS[kind][l] || LEADS[kind].en;
    var name = cleanField(model.name).replace(/[:.]\s*$/, '');
    var t = (model.steps || []).map(function (s) {
      var a = cleanField(s && s.label), d = cleanField(s && s.detail);
      return a ? a + (d ? ' (' + d + ')' : '') : '';
    }).filter(Boolean).join(' → ');
    var note = cleanField(model.note).replace(/\.\s*$/, '');
    return { b: name ? lead + ': ' + name : lead, t: t + (note ? ' | ' + note : ''), dg: kind };
  }
  // plain sentence for aria-label / alt text
  function toSentence(m) {
    if (!m) return '';
    return (LEADS[m.kind].en + (m.name ? ': ' + m.name : '') + '. ' +
      m.steps.map(function (s, i) { return (i + 1) + ' ' + s.label + (s.detail ? ', ' + s.detail : ''); }).join('; ') +
      (m.note ? '. ' + m.note : '')).trim();
  }
  // first diagram in a CL section list -> { si, ii, sec, row, model } or null
  function findIn(cl) {
    if (!Array.isArray(cl)) return null;
    for (var si = 0; si < cl.length; si++) {
      var s = cl[si];
      if (!s || s.on === false || s.type !== 'rich_block' || !Array.isArray(s.items)) continue;
      for (var ii = 0; ii < s.items.length; ii++) {
        if (s.hidden && s.hidden[ii]) continue;
        var m = parse(s.items[ii]);
        if (m) return { si: si, ii: ii, sec: s, row: s.items[ii], model: m };
      }
    }
    return null;
  }

  // ── one visual tree for the preview (React) and the panel's mini preview (DOM) ──────
  function hexOf(c) {
    var s = String(c || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return m[1];
    m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
    if (m) return m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
    if (m) return [m[1], m[2], m[3]].map(function (n) { return ('0' + Number(n).toString(16)).slice(-2); }).join('');
    return '00746E';
  }
  function tint(c, k) {
    var h = hexOf(c), o = '#';
    for (var i = 0; i < 6; i += 2) { var n = parseInt(h.slice(i, i + 2), 16); o += ('0' + Math.round(n * (1 - k) + 255 * k).toString(16)).slice(-2); }
    return o;
  }
  function tree(model, env) {
    env = env || {};
    var acc = '#' + hexOf(env.accent), size = Number(env.size) || 13, font = env.font || 'inherit';
    var ink = env.ink && !env.sidebar ? env.ink : '#333333';
    var bg = tint(acc, 0.90);
    var kids = [];
    var title = model.name ? model.name : '';
    if (title) kids.push({ k: 'title', style: { fontWeight: 700, color: acc, fontSize: size, margin: '0 0 3px', textAlign: 'left' }, text: title });
    var stacked = model.kind === 'layers' || env.sidebar;
    if (stacked) {
      kids.push({ k: 'bands', style: { display: 'flex', flexDirection: 'column', gap: 2 }, kids: model.steps.map(function (s, i) {
        return { k: 'band' + i, style: { display: 'flex', alignItems: 'baseline', gap: 8, background: bg, borderLeft: '3px solid ' + acc, padding: '3px 8px', breakInside: 'avoid' }, kids: [
          { k: 'l', style: { flex: '0 0 30%', fontWeight: 700, color: acc, fontSize: Math.round(size * 0.95 * 10) / 10 }, text: s.label },
          { k: 'd', style: { flex: '1 1 auto', color: ink, fontSize: Math.round(size * 0.88 * 10) / 10 }, text: s.detail }
        ] };
      }) });
    } else {
      var cells = [];
      model.steps.forEach(function (s, i) {
        if (i) cells.push({ k: 'a' + i, aria: true, style: { flex: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: acc, fontWeight: 700, fontSize: size }, text: '→' });
        cells.push({ k: 's' + i, style: { flex: '1 1 0', minWidth: 0, background: bg, borderTop: '2.5px solid ' + acc, padding: '4px 4px 5px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowWrap: 'anywhere' }, kids: [
          { k: 'l', style: { fontWeight: 700, color: acc, fontSize: Math.round(size * 0.92 * 10) / 10, lineHeight: 1.2 }, text: s.label }
        ].concat(s.detail ? [{ k: 'd', style: { color: ink, opacity: 0.82, fontSize: Math.round(size * 0.80 * 10) / 10, lineHeight: 1.2 }, text: s.detail }] : []) });
      });
      kids.push({ k: 'row', style: { display: 'flex', alignItems: 'stretch', width: '100%' }, kids: cells });
    }
    var note = model.note || '';
    if (note || model.kind === 'loop') kids.push({ k: 'note', style: { marginTop: 2, textAlign: 'center', fontStyle: 'italic', color: ink, opacity: 0.75, fontSize: Math.round(size * 0.84 * 10) / 10 }, text: (model.kind === 'loop' ? '↺ ' : '') + (note || '') });
    return { k: 'root', style: { fontFamily: font, margin: '5px 0 6px', breakInside: 'avoid', textIndent: 0 }, kids: kids };
  }
  function toReact(React, n, extra) {
    var props = { key: n.k, style: n.style };
    if (n.aria) props['aria-hidden'] = true;
    if (extra) for (var p in extra) props[p] = extra[p];
    return React.createElement.apply(React, ['div', props].concat(n.text != null ? [n.text] : (n.kids || []).map(function (c) { return toReact(React, c); })));
  }
  function toDom(doc, n) {
    var el = doc.createElement('div');
    for (var p in n.style) { var v = n.style[p]; el.style[p] = typeof v === 'number' && !/^(opacity|fontWeight|lineHeight|flex|order|zIndex)$/.test(p) ? v + 'px' : v; }
    if (n.aria) el.setAttribute('aria-hidden', 'true');
    if (n.text != null) el.textContent = n.text; else (n.kids || []).forEach(function (c) { el.appendChild(toDom(doc, c)); });
    return el;
  }
  // app.js rich_block row hook: a React node for a diagram row, or null (the row then prints as text)
  function render(React, env, row, i) {
    try {
      if (disabled()) return null;
      var m = parse(row);
      if (!m) return null;
      return toReact(React, tree(m, env), {
        key: i, role: 'img', 'aria-label': toSentence(m), title: 'Click to edit the diagram',
        'data-antcv-letter-diagram-row': m.kind,
        'data-antcv-row-path': 'items.' + i, 'data-antcv-rowalign': 'center', 'data-antcv-rowkey': (row && row._key) || ('items.' + i),
        onClick: function (e) { try { if (e && e.stopPropagation) e.stopPropagation(); open(); } catch (_) {} }
      });
    } catch (_) { return null; }
  }

  // ── stored letter: read, insert, update, remove (pure on a CL list, then one write) ──
  function realText(t) { var s = norm(t); return !!s && !/^\[[\s\S]*\]$/.test(s); }
  function canHost(s) { return !!(s && s.on !== false && s.type === 'rich_block' && Array.isArray(s.items) && s.id !== 'greeting' && s.id !== 'closure'); }
  function hosts(cl) {
    return (cl || []).filter(canHost).map(function (s) {
      var lead = s.items[0] && typeof s.items[0] === 'object' ? norm(s.items[0].b) : '';
      return { id: s.id, label: lead || norm(s.title) || s.id };
    });
  }
  function defaultHost(cl) {
    var ids = hosts(cl).map(function (h) { return h.id; });
    var order = ['bring', 'contribute', 'who', 'foundation', 'role_view', 'why', 'opening'];
    for (var i = 0; i < order.length; i++) if (ids.indexOf(order[i]) >= 0) return order[i];
    return ids[0] || null;
  }
  function shiftHidden(hidden, at, by) {
    if (!hidden || typeof hidden !== 'object' || Array.isArray(hidden)) return hidden;
    var out = {};
    Object.keys(hidden).forEach(function (k) {
      var n = parseInt(k, 10);
      if (!isFinite(n) || String(n) !== k) { out[k] = hidden[k]; return; }
      if (by < 0 && n === at) return;
      out[String(n >= at ? n + by : n)] = hidden[k];
    });
    return out;
  }
  function withItems(s, items, hidden) {
    var n = Object.assign({}, s, { items: items });
    if (s.hidden) n.hidden = hidden;
    return n;
  }
  function removeFrom(cl, loc) {
    var s = cl[loc.si], items = s.items.slice(); items.splice(loc.ii, 1);
    var out = cl.slice(); out[loc.si] = withItems(s, items, shiftHidden(s.hidden, loc.ii, -1));
    return out;
  }
  // position of a new row in a host: the end, but before the markerless closing row of
  // `contribute` (its Goal line) so the opening / bullets / closing shape stays
  function insertAt(s) {
    var n = s.items.length;
    if (s.id === 'contribute' && n >= 2) {
      var last = s.items[n - 1], prev = s.items[n - 2];
      if (last && typeof last === 'object' && !last.mk && prev && prev.mk) return n - 1;
    }
    return n;
  }
  // pure: CL list with the diagram stored in host `hostId`; same list when nothing owned changes
  function putDiagram(cl, model, hostId, lang) {
    var row = toText(model, lang), cur = findIn(cl);
    if (!parse(row)) return cl;
    var host = hostId || (cur && cur.sec.id) || defaultHost(cl);
    if (cur && cur.sec.id === host) {
      var old = cur.row;
      if (norm(old.b) === norm(row.b) && norm(old.t) === norm(row.t) && old.dg === row.dg) return cl;
      var items = cur.sec.items.slice(); items[cur.ii] = Object.assign({}, old, row);
      var same = cl.slice(); same[cur.si] = withItems(cur.sec, items, cur.sec.hidden);
      return same;
    }
    var list = cur ? removeFrom(cl, cur) : cl.slice();
    var si = -1;
    for (var i = 0; i < list.length; i++) if (canHost(list[i]) && list[i].id === host) { si = i; break; }
    if (si < 0) return cl;
    var s = list[si], at = insertAt(s), its = s.items.slice();
    its.splice(at, 0, row);
    list[si] = withItems(s, its, shiftHidden(s.hidden, at, 1));
    return list;
  }
  function dropDiagram(cl) { var cur = findIn(cl); return cur ? removeFrom(cl, cur) : cl; }
  // a letter with real text in three or more sections and no diagram row
  function missing(cl) {
    if (!Array.isArray(cl) || findIn(cl)) return false;
    var real = cl.filter(function (s) {
      if (!s || s.on === false) return false;
      if (Array.isArray(s.items)) return s.items.some(function (r) { return realText(r && typeof r === 'object' ? r.t : r); });
      return realText(s.content);
    }).length;
    return real >= 3 && hosts(cl).length > 0;
  }

  // ── adder ────────────────────────────────────────────────────────────────────────────
  function ls() { try { return root.localStorage; } catch (_) { return null; } }
  function readJSON(k) { try { return JSON.parse(ls().getItem(k) || 'null'); } catch (_) { return null; } }
  function raw(k) { try { return String(ls().getItem(k) || ''); } catch (_) { return ''; } }
  function activeDoc() { return raw('doc').replace(/"/g, '') || 'cv'; }
  function lang() { return (raw('language').replace(/["']/g, '') || 'en').toLowerCase().slice(0, 2); }
  function clList() { var s = readJSON('sections'); return s && Array.isArray(s.cl) ? s.cl : []; }
  function accent() {
    try {
      var el = root.document.querySelector('.antcv-preview-paper [data-antcv-section-headline], .antcv-preview-paper [data-antcv-row-path] > span:first-child');
      var c = el && root.getComputedStyle(el).color;
      if (c && !/rgba?\(\s*0[,\s]+0[,\s]+0/.test(c)) return c;
    } catch (_) {}
    return '#00746E';
  }
  function store(next, reason) {
    var secs = readJSON('sections');
    if (!secs || !Array.isArray(secs.cl)) return false;
    var cl = next(secs.cl);
    if (cl === secs.cl) return false;
    try { if (root.__antcvPushUndo) root.__antcvPushUndo('Letter diagram'); } catch (_) {}
    secs.cl = cl;
    try { ls().setItem('sections', JSON.stringify(secs)); } catch (_) { return false; }
    try { root.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'letter-diagram', source: 'letter-diagram', action: reason } })); } catch (_) {}
    return true;
  }

  var T = {
    en: { add: '＋ Diagram', edit: '✎ Diagram', title: 'Letter diagram', hint: 'This letter has no diagram yet: show one workflow or architecture idea for this job.', kind: 'Type', flow: 'Workflow', loop: 'Loop', layers: 'Architecture', name: 'Name', namePh: 'First 90 days', steps: 'Steps', label: 'Step', detail: 'Detail', addStep: '＋ Step', note: 'Note under the diagram', after: 'Place in', suggest: '✨ Suggest from the job ad', insert: 'Insert', update: 'Update', remove: 'Remove', close: 'Close', need: 'Give at least three steps a name.', working: 'Reading the job ad…', noLlm: 'No AI provider is connected: a starting template, edit each step for this job.', noJd: 'No job ad is stored for this application: a starting template, edit each step.', failed: 'The suggestion failed: a starting template, edit each step.', ready: 'Suggested from the job ad. Check every step before you insert it.', done: 'Diagram stored in the letter.', gone: 'Diagram removed.', noHost: 'No letter section can hold a diagram yet. Generate or fill the letter first.', fmt: 'Letter diagram' },
    da: { add: '＋ Diagram', edit: '✎ Diagram', title: 'Diagram i brevet', hint: 'Brevet har ikke noget diagram endnu: vis én arbejdsgang eller arkitektur til jobbet.', kind: 'Type', flow: 'Arbejdsgang', loop: 'Kredsløb', layers: 'Arkitektur', name: 'Navn', namePh: 'De første 90 dage', steps: 'Trin', label: 'Trin', detail: 'Detalje', addStep: '＋ Trin', note: 'Note under diagrammet', after: 'Placér i', suggest: '✨ Foreslå ud fra jobopslaget', insert: 'Indsæt', update: 'Opdatér', remove: 'Fjern', close: 'Luk', need: 'Giv mindst tre trin et navn.', working: 'Læser jobopslaget…', noLlm: 'Ingen AI-udbyder er forbundet: en skabelon, ret hvert trin til jobbet.', noJd: 'Der er ikke gemt et jobopslag: en skabelon, ret hvert trin.', failed: 'Forslaget mislykkedes: en skabelon, ret hvert trin.', ready: 'Foreslået ud fra jobopslaget. Tjek hvert trin, før du indsætter.', done: 'Diagrammet er gemt i brevet.', gone: 'Diagrammet er fjernet.', noHost: 'Ingen del af brevet kan rumme et diagram endnu. Udfyld brevet først.', fmt: 'Diagram i brevet' }
  };
  function tr(k) { var l = T[lang()] || T.en; return l[k] || T.en[k]; }
  var TEMPLATE = {
    en: { flow: ['First 90 days', [['Understand', 'users and data'], ['Prototype', 'one task'], ['Measure', 'before and after'], ['Scale', 'with the owners']]], loop: ['How I would improve it', [['Measure', 'one baseline'], ['Change', 'one thing'], ['Test', 'with the users'], ['Decide', 'keep or drop']], 'each round ends in a written decision'], layers: ['How the parts connect', [['People', 'who decides and who uses it'], ['Process', 'steps, gates and owners'], ['Data', 'what is measured and stored'], ['Tools', 'what runs it']]] },
    da: { flow: ['De første 90 dage', [['Forstå', 'brugere og data'], ['Prototype', 'én opgave'], ['Mål', 'før og efter'], ['Udbred', 'sammen med ejerne']]], loop: ['Sådan vil jeg forbedre', [['Mål', 'ét udgangspunkt'], ['Ændr', 'én ting'], ['Test', 'med brugerne'], ['Beslut', 'behold eller drop']], 'hver runde ender i en skriftlig beslutning'], layers: ['Sådan hænger delene sammen', [['Mennesker', 'hvem beslutter og bruger'], ['Proces', 'trin, gates og ejere'], ['Data', 'hvad der måles og gemmes'], ['Værktøjer', 'hvad der kører det']]] }
  };
  function template(kind) {
    var t = (TEMPLATE[lang()] || TEMPLATE.en)[kind] || TEMPLATE.en.flow;
    return { kind: kind, name: t[0], steps: t[1].map(function (s) { return { label: s[0], detail: s[1] }; }), note: t[2] || '' };
  }
  function letterText(cl) {
    return (cl || []).filter(function (s) { return s && s.on !== false; }).map(function (s) {
      if (Array.isArray(s.items)) return s.items.map(function (r) { return r && typeof r === 'object' ? norm((r.b || '') + ' ' + (r.t || '')) : norm(r); }).join(' ');
      return norm(s.content);
    }).filter(realText).join('\n').slice(0, 3500);
  }
  function suggestPrompt(kind) {
    var names = { en: 'English', da: 'Danish', es: 'Spanish', zh: 'Chinese' };
    return 'You design ONE small ' + (kind === 'layers' ? 'architecture (stacked layers)' : kind === 'loop' ? 'improvement loop' : 'workflow') + ' diagram for a cover letter: what the candidate would do for THIS employer in this job. ' +
      'Return JSON only: {"name": string, "steps": [{"label": string, "detail": string}], "note": string}. RULES: 3 to 5 steps in order; label 1-3 words (max 18 characters); detail 2-5 words (max 34 characters); name 2-5 words; note empty, or one short line about what each round returns. ' +
      'Concrete to the job ad and to methods that already stand in the letter; no invented numbers, tools, employers or results; no buzzwords; no dashes, arrows or parentheses inside the strings. Write in ' + (names[lang()] || 'English') + '.';
  }
  function askModel(kind, cl) {
    if (typeof root.__antcvLLM !== 'function') return Promise.resolve({ model: template(kind), msg: 'noLlm' });
    var jd = raw('antcv:lastJdText').slice(0, 6000);
    if (norm(jd).length < 120) return Promise.resolve({ model: template(kind), msg: 'noJd' });
    try { if (typeof root.__antcvOverCost === 'function' && root.__antcvOverCost()) return Promise.resolve({ model: template(kind), msg: 'failed' }); } catch (_) {}
    var meta = readJSON('meta') || {};
    var user = 'JOB (' + norm(meta.role) + ', ' + norm(meta.company) + '):\n' + jd + '\n\nTHE LETTER SO FAR:\n' + letterText(cl);
    function jparse(r) { try { return JSON.parse(r); } catch (_) { try { return typeof root.__antcvJsonRepair === 'function' ? root.__antcvJsonRepair(r) : null; } catch (_) { return null; } } }
    var init = Promise.resolve();
    try { if (typeof root.__antcvLLMInit === 'function') init = Promise.resolve(root.__antcvLLMInit()); } catch (_) {}
    return init.then(function () { return root.__antcvLLM([{ role: 'user', content: user }], suggestPrompt(kind), { task: 'enrich' }); }).then(function (r) {
      var o = jparse(r) || {};
      var steps = (Array.isArray(o.steps) ? o.steps : []).map(function (s) { return { label: cleanField(s && s.label).slice(0, 28), detail: cleanField(s && s.detail).slice(0, 60) }; }).filter(function (s) { return s.label; }).slice(0, UI_MAX);
      if (steps.length < MIN) return { model: template(kind), msg: 'failed' };
      return { model: { kind: kind, name: cleanField(o.name).slice(0, 60), steps: steps, note: cleanField(o.note).slice(0, 90) }, msg: 'ready' };
    }, function () { return { model: template(kind), msg: 'failed' }; });
  }

  var MARK = 'data-antcv-letter-diagram', CSS_ID = 'antcv-letter-diagram-css', PANEL_ID = 'antcv-letter-diagram-panel';
  var state = null, opener = null;

  function css() {
    var d = root.document;
    if (d.getElementById(CSS_ID)) return;
    var st = d.createElement('style'); st.id = CSS_ID;
    st.textContent =
      '[' + MARK + '="btn"]{display:inline-flex;align-items:center;gap:5px;min-height:26px;margin:-5px 0;padding:2px 12px;border-radius:999px;border:1px solid rgba(8,86,96,.35);background:#fff;color:#0b4f57;font:700 12px/1.2 Calibri,Arial,sans-serif;cursor:pointer;white-space:nowrap;}' +
      '[' + MARK + '="btn"][data-where="float"]{position:fixed;right:16px;bottom:198px;z-index:99980;margin:0;min-height:44px;box-shadow:0 6px 18px rgba(0,0,0,.25);}' +
      '[' + MARK + '="btn"]:focus-visible,#' + PANEL_ID + ' :focus-visible{outline:2px solid #01B7BB;outline-offset:2px;}' +
      '[' + MARK + '="btn"][data-missing="1"]::after{content:"";width:8px;height:8px;border-radius:50%;background:#e0892b;}' +
      '#' + PANEL_ID + '{--bg:#ffffff;--fg:#16302f;--mut:#55706f;--line:#c9dcdb;--acc:#01777b;--soft:#eef6f6;position:fixed;z-index:2147483646;right:12px;top:84px;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 110px);overflow:auto;box-sizing:border-box;padding:12px 14px 14px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--fg);font:13px/1.4 Calibri,Arial,sans-serif;box-shadow:0 14px 44px rgba(0,0,0,.28);}' +
      '@media (prefers-color-scheme: dark){#' + PANEL_ID + '{--bg:#12282b;--fg:#e8f4f3;--mut:#9fbdbb;--line:#2c5053;--acc:#4fd3d1;--soft:#1a373a;}}' +
      '#' + PANEL_ID + ' h2{margin:0;font:700 15px/1.2 Calibri,Arial,sans-serif;color:var(--fg);}' +
      '#' + PANEL_ID + ' label,#' + PANEL_ID + ' .lab{display:block;margin:9px 0 3px;font-weight:700;font-size:11.5px;color:var(--mut);}' +
      '#' + PANEL_ID + ' input,#' + PANEL_ID + ' select{width:100%;box-sizing:border-box;min-height:34px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--fg);font:13px Calibri,Arial,sans-serif;}' +
      '#' + PANEL_ID + ' button{min-height:34px;padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:var(--soft);color:var(--fg);font:700 12.5px Calibri,Arial,sans-serif;cursor:pointer;}' +
      '#' + PANEL_ID + ' button[data-main="1"]{background:var(--acc);border-color:var(--acc);color:#fff;}' +
      '@media (prefers-color-scheme: dark){#' + PANEL_ID + ' button[data-main="1"]{color:#06272a;}}' +
      '#' + PANEL_ID + ' button[aria-checked="true"]{background:var(--acc);border-color:var(--acc);color:#fff;}' +
      '#' + PANEL_ID + ' button:disabled{opacity:.55;cursor:default;}' +
      '#' + PANEL_ID + ' .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}' +
      '#' + PANEL_ID + ' .step{display:grid;grid-template-columns:22px minmax(0,2fr) minmax(0,3fr) 34px;gap:5px;align-items:center;margin-bottom:5px;}' +
      '#' + PANEL_ID + ' .step .n{font-weight:700;color:var(--acc);text-align:center;}' +
      '#' + PANEL_ID + ' .step button{padding:0;width:34px;}' +
      '#' + PANEL_ID + ' .mini{margin-top:10px;padding:8px 10px;border:1px dashed var(--line);border-radius:8px;background:#fff;}' +
      '#' + PANEL_ID + ' .msg{min-height:17px;margin-top:8px;font-size:12px;color:var(--mut);}' +
      '@media (max-width:640px){#' + PANEL_ID + '{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:80dvh;padding-bottom:76px;}#' + PANEL_ID + ' button,#' + PANEL_ID + ' input,#' + PANEL_ID + ' select,[' + MARK + '="btn"]{min-height:44px;}#' + PANEL_ID + ' .step{grid-template-columns:20px minmax(0,1fr) minmax(0,1.3fr) 44px;}#' + PANEL_ID + ' .step button{width:44px;}}';
    d.head.appendChild(st);
  }
  function h(tag, attrs, kids) {
    var el = root.document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'on') for (var ev in attrs.on) el.addEventListener(ev, attrs.on[ev]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function close() {
    var p = root.document.getElementById(PANEL_ID);
    if (p && p.parentNode) p.parentNode.removeChild(p);
    state = null;
    try { if (opener && opener.isConnected) opener.focus(); } catch (_) {}
    opener = null;
  }
  function model() { return { kind: state.kind, name: state.name, steps: state.steps.filter(function (s) { return norm(s.label); }), note: state.note }; }
  function msg(text) { var m = root.document.querySelector('#' + PANEL_ID + ' [role="status"]'); if (m && m.textContent !== text) m.textContent = text; }
  function mini() {
    var box = root.document.querySelector('#' + PANEL_ID + ' .mini');
    if (!box) return;
    box.textContent = '';
    var row = toText(model(), lang()), m = parse(row);
    if (m) box.appendChild(toDom(root.document, tree(m, { accent: accent(), size: 12, ink: '#333333', font: 'Calibri, Arial, sans-serif' })));
    else box.textContent = tr('need');
    var main = root.document.querySelector('#' + PANEL_ID + ' button[data-main="1"]');
    if (main) main.disabled = !m || !hosts(clList()).length;
  }
  function draw(focusSel) {
    var d = root.document, p = d.getElementById(PANEL_ID);
    if (!p || !state) return;
    p.textContent = '';
    var cl = clList(), cur = findIn(cl), hs = hosts(cl);
    function field(id, label, value, max, set, ph) {
      var i = h('input', { id: id, type: 'text', value: value, maxlength: String(max), placeholder: ph || '', autocomplete: 'off', on: { input: function (e) { set(e.target.value); mini(); } } });
      return [h('label', { 'for': id, text: label }), i];
    }
    p.appendChild(h('div', { 'class': 'row', style: 'justify-content:space-between' }, [
      h('h2', { id: PANEL_ID + '-h', text: tr('title') }),
      h('button', { type: 'button', 'aria-label': tr('close'), text: '✕', on: { click: close } })
    ]));
    if (!cur && missing(cl)) p.appendChild(h('div', { 'class': 'msg', style: 'margin-top:4px', text: tr('hint') }));
    p.appendChild(h('div', { 'class': 'lab', text: tr('kind') }));
    var group = h('div', { 'class': 'row', role: 'radiogroup', 'aria-label': tr('kind') });
    KINDS.forEach(function (k) {
      group.appendChild(h('button', { type: 'button', role: 'radio', 'data-kind': k, 'aria-checked': String(state.kind === k), tabindex: state.kind === k ? '0' : '-1', text: tr(k), on: {
        click: function () { state.kind = k; draw('[data-kind="' + k + '"]'); },
        keydown: function (e) {
          if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
          e.preventDefault();
          var n = KINDS[(KINDS.indexOf(state.kind) + (/Right|Down/.test(e.key) ? 1 : KINDS.length - 1)) % KINDS.length];
          state.kind = n; draw('[data-kind="' + n + '"]');
        } } }));
    });
    p.appendChild(group);
    field(PANEL_ID + '-name', tr('name'), state.name, 60, function (v) { state.name = v; }, tr('namePh')).forEach(function (x) { p.appendChild(x); });
    p.appendChild(h('div', { 'class': 'lab', text: tr('steps') }));
    state.steps.forEach(function (s, i) {
      p.appendChild(h('div', { 'class': 'step' }, [
        h('span', { 'class': 'n', 'aria-hidden': 'true', text: String(i + 1) }),
        h('input', { type: 'text', value: s.label, maxlength: '28', 'data-step': String(i), 'aria-label': tr('label') + ' ' + (i + 1), placeholder: tr('label'), on: { input: function (e) { s.label = e.target.value; mini(); } } }),
        h('input', { type: 'text', value: s.detail, maxlength: '60', 'aria-label': tr('detail') + ' ' + (i + 1), placeholder: tr('detail'), on: { input: function (e) { s.detail = e.target.value; mini(); } } }),
        h('button', { type: 'button', 'aria-label': tr('remove') + ' ' + (i + 1), text: '−', disabled: state.steps.length <= MIN ? 'disabled' : null, on: { click: function () { state.steps.splice(i, 1); draw(); } } })
      ]));
    });
    p.appendChild(h('button', { type: 'button', text: tr('addStep'), disabled: state.steps.length >= UI_MAX ? 'disabled' : null, on: { click: function () { state.steps.push({ label: '', detail: '' }); draw('[data-step="' + (state.steps.length - 1) + '"]'); } } }));
    field(PANEL_ID + '-note', tr('note'), state.note, 90, function (v) { state.note = v; }).forEach(function (x) { p.appendChild(x); });
    p.appendChild(h('label', { 'for': PANEL_ID + '-host', text: tr('after') }));
    var sel = h('select', { id: PANEL_ID + '-host', on: { change: function (e) { state.host = e.target.value; } } });
    hs.forEach(function (o) { var op = h('option', { value: o.id, text: o.label }); if (o.id === state.host) op.selected = true; sel.appendChild(op); });
    p.appendChild(sel);
    p.appendChild(h('div', { 'class': 'mini', 'aria-hidden': 'true' }));
    p.appendChild(h('div', { 'class': 'row', style: 'margin-top:10px' }, [
      h('button', { type: 'button', 'data-main': '1', text: cur ? tr('update') : tr('insert'), on: { click: function () { save(); } } }),
      h('button', { type: 'button', 'data-act': 'suggest', text: tr('suggest'), on: { click: function (e) { suggest(e.currentTarget); } } }),
      cur ? h('button', { type: 'button', 'data-act': 'remove', text: tr('remove'), on: { click: function () { if (store(dropDiagram, 'remove')) { close(); sync(); } } } }) : null
    ]));
    p.appendChild(h('div', { 'class': 'msg', role: 'status', 'aria-live': 'polite', text: hs.length ? '' : tr('noHost') }));
    mini();
    try { var f = p.querySelector(focusSel || '#' + PANEL_ID + '-name'); if (f) f.focus(); } catch (_) {}
  }
  function save() {
    if (!state) return;
    var m = model(), hst = state.host;
    if (!parse(toText(m, lang()))) { msg(tr('need')); return; }
    var changed = store(function (cl) { return putDiagram(cl, m, hst, lang()); }, 'put');
    if (changed) { draw('[data-main="1"]'); sync(); }
    msg(tr('done'));
  }
  function suggest(btn) {
    if (!state || state.busy) return;
    state.busy = true; btn.disabled = true; msg(tr('working'));
    var my = state;
    askModel(state.kind, clList()).then(function (r) {
      my.busy = false;
      if (state !== my) return;                 // closed meanwhile
      state.name = r.model.name; state.steps = r.model.steps; state.note = r.model.note || '';
      draw('[data-act="suggest"]'); msg(tr(r.msg));
    });
  }
  function open(from) {
    if (disabled() || !root.document) return;
    css();
    opener = from || root.document.activeElement;
    var old = root.document.getElementById(PANEL_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var cl = clList(), cur = findIn(cl);
    var base = cur ? cur.model : { kind: 'flow', name: '', steps: [{ label: '', detail: '' }, { label: '', detail: '' }, { label: '', detail: '' }], note: '' };
    state = { kind: base.kind, name: base.name, steps: base.steps.map(function (s) { return { label: s.label, detail: s.detail }; }), note: base.note, host: cur ? cur.sec.id : defaultHost(cl),
      pin: !!(from && from.getAttribute && from.getAttribute('data-where') === 'format') };
    var p = h('div', { id: PANEL_ID, role: 'dialog', 'aria-labelledby': PANEL_ID + '-h', 'class': 'no-print', on: { keydown: function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } } } });
    root.document.body.appendChild(p);
    draw();
  }

  // control in the preview bar (cover letter only) + a button in the COVER LETTER FORMAT panel
  function setAttr(el, k, v) { if (el.getAttribute(k) !== v) el.setAttribute(k, v); }
  function sync() {
    try {
      var d = root.document, off = disabled() || activeDoc() !== 'cl';
      var bar = d.querySelector('.antcv-preview-actions');
      // on a phone the preview bar sits under the app's top bar: the control floats above the bottom bar instead
      var r = bar ? bar.getBoundingClientRect() : null;
      var where = !bar || off ? '' : (r.top < 30 || r.width < 1 ? 'float' : 'bar');
      var host = where === 'float' ? d.body : bar;
      var btns = d.querySelectorAll('[' + MARK + '="btn"][data-where="bar"],[' + MARK + '="btn"][data-where="float"]');
      var keep = null;
      for (var j = 0; j < btns.length; j++) {
        if (where && !keep && btns[j].getAttribute('data-where') === where && btns[j].parentNode === host) keep = btns[j];
        else btns[j].parentNode.removeChild(btns[j]);
      }
      var cl = off ? [] : clList(), has = !off && !!findIn(cl), miss = !off && !has && missing(cl);
      if (where) {
        if (!keep) {
          css();
          keep = h('button', { type: 'button', 'data-where': where, 'aria-haspopup': 'dialog', on: { click: function (e) { e.preventDefault(); e.stopPropagation(); open(e.currentTarget); } } });
          keep.setAttribute(MARK, 'btn'); keep.className = 'no-print';
          host.appendChild(keep);
        }
        var label = has ? tr('edit') : tr('add');
        if (keep.textContent !== label) keep.textContent = label;
        setAttr(keep, 'data-missing', miss ? '1' : '0');
        setAttr(keep, 'title', miss ? tr('hint') : tr('title'));
      }
      var panel = d.querySelector('[data-antcv-cl-format-panel]');
      if (panel) {
        var f = panel.querySelector('[' + MARK + '="btn"][data-where="format"]');
        if (disabled()) { if (f) f.parentNode.removeChild(f); }
        else if (!f) {
          css();
          f = h('button', { type: 'button', 'data-where': 'format', 'aria-haspopup': 'dialog', style: 'margin-top:8px', text: tr('fmt'), on: { click: function (e) { e.preventDefault(); e.stopPropagation(); open(e.currentTarget); } } });
          f.setAttribute(MARK, 'btn');
          panel.appendChild(f);
        }
      }
      if (state && (disabled() || (off && !state.pin))) close();   // opened from the format panel: stays, whichever document shows
    } catch (_) { /* never break the preview */ }
  }

  var API = { version: VERSION, KINDS: KINDS, LEADS: LEADS, parse: parse, isDiagramRow: isDiagramRow, toText: toText, toSentence: toSentence, findIn: findIn,
    hosts: hosts, defaultHost: defaultHost, putDiagram: putDiagram, dropDiagram: dropDiagram, missing: missing, template: template,
    tree: tree, tint: tint, render: render, open: open, close: close, sync: sync };
  if (root) root.AntcvLetterDiagram = API;
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root || !root.document || root.__antcvLetterDiagram === VERSION) return;
  root.__antcvLetterDiagram = VERSION;

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; sync(); }, 250); }
  // own nodes are ignored, so the control cannot wake itself up
  function foreign(muts) {
    for (var i = 0; i < muts.length; i++) {
      var n = muts[i].target;
      if (n && n.closest && (n.closest('#' + PANEL_ID) || n.closest('[' + MARK + ']'))) continue;
      if (muts[i].addedNodes && muts[i].addedNodes.length) {
        for (var j = 0; j < muts[i].addedNodes.length; j++) {
          var a = muts[i].addedNodes[j];
          if (a.nodeType === 1 && (a.id === PANEL_ID || a.id === CSS_ID || (a.hasAttribute && a.hasAttribute(MARK)))) continue;
          return true;
        }
      }
    }
    return false;
  }
  function start() {
    try { new MutationObserver(function (m) { if (foreign(m)) schedule(); }).observe(root.document.body, { childList: true, subtree: true }); } catch (_) {}
    root.addEventListener('antcv:sections-updated', schedule);
    root.addEventListener('resize', schedule);
    [600, 2500].forEach(function (ms) { setTimeout(sync, ms); });
  }
  if (root.document.body) start(); else root.document.addEventListener('DOMContentLoaded', start);
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
