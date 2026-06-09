/* AntCV FOUNDATION per-subsection controls (v1.50.327)
 * ============================================================
 * Owner 2026-06-09: "support manual page break, CJLR, enhance and fix it buttons
 * for both sections of foundations" (Hands-on + Professionally).
 *
 * FOUNDATION is one CL section with two sub-parts (hands_on, professionally).
 * This sidecar gives EACH sub-part the same per-part controls the HOW I WOULD
 * CONTRIBUTE rows have (antcv-how-contribute-controls-245): a manual page break,
 * a CJLR alignment cycle, a local Enhance (enrich), and a local Fix/Fit (compress).
 *
 * Storage (matches the worker + docx-client contract so the EXPORT honours it too):
 *   antcv.foundationControls.v1 = {
 *     hands_on:       { align: 'left'|'center'|'right'|'justify', page: N },
 *     professionally: { align,                                    page: N }
 *   }
 *   - worker renderFoundation reads s.foundation_controls.<part>.align / .page
 *     (docx-worker 1.14.x); docx-client forwards antcv.foundationControls.v1.
 * For the PREVIEW salmon we ALSO mirror the page break into antcv:itemPages
 * [foundation][partIndex] (hands_on=0, professionally=1), which is the key the
 * native preview paginator (__antcvBreaks) reads.
 *
 * Safety: isolated, additive, idempotent. Panel buttons attach next to each
 * sub-field; if the panel isn't open the finder is an inert no-op (no crash).
 * The CJLR/page state is re-applied to the preview on every sweep (React resets
 * inline styles on re-render — same approach as antcv-profile-workstyle-cjlr-238).
 */
(function () {
  'use strict';
  var VERSION = '1.50.327-foundation-controls';
  if (window.__antcvFoundationControls327 === VERSION) return;
  window.__antcvFoundationControls327 = VERSION;

  var CKEY = 'antcv.foundationControls.v1';
  var IP_KEY = 'antcv:itemPages';
  var SECTIONS_KEY = 'sections';
  var ALIGN = ['center', 'justify', 'left', 'right'];
  var ICON = { left: '⇤', center: '↔', justify: '☰', right: '⇥' };
  var TITLES = { left: 'Left', center: 'Centered', justify: 'Justified', right: 'Right' };
  // sub-parts in document order; idx = the __antcvBreaks item key in the preview.
  var PARTS = [
    { part: 'hands_on', idx: '0', rx: /hands[\s-]*on|praktisk/i },
    { part: 'professionally', idx: '1', rx: /profession|professionel/i },
  ];

  var clean = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  var visible = function (el) { return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length))); };
  var inPreview = function (el) { var p = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); return !!(p && el && p.contains(el)); };

  function readJSON(k, f) { try { var v = JSON.parse(localStorage.getItem(k) || ''); return (v && typeof v === 'object') ? v : f; } catch (_) { return f; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch (_) { return false; } }
  function readCtl() { var m = readJSON(CKEY, {}); if (!m.hands_on) m.hands_on = {}; if (!m.professionally) m.professionally = {}; return m; }
  function getAlign(part) { var v = (readCtl()[part] || {}).align; return ALIGN.indexOf(v) >= 0 ? v : 'justify'; }
  function getPage(part) { var n = Number((readCtl()[part] || {}).page); return (n >= 2 && n <= 4) ? (n | 0) : 1; }
  function nextAlign(v) { return ALIGN[(Math.max(0, ALIGN.indexOf(v)) + 1) % ALIGN.length]; }

  function setAlign(part, v) { var m = readCtl(); m[part].align = v; writeJSON(CKEY, m); }
  function setPage(part, idx, p) {
    var m = readCtl(); m[part].page = p; writeJSON(CKEY, m);
    // mirror into antcv:itemPages so the PREVIEW salmon (native __antcvBreaks) shows.
    var ip = readJSON(IP_KEY, {}); if (!ip.foundation || typeof ip.foundation !== 'object') ip.foundation = {};
    if (p >= 2) ip.foundation[idx] = p; else delete ip.foundation[idx];
    writeJSON(IP_KEY, ip);
  }
  // On load, reconcile CKEY.page -> itemPages so a stored page break self-heals
  // onto the preview without needing a click (owner "self heal").
  function reconcilePages() {
    var changed = false; var ip = readJSON(IP_KEY, {}); var f = (ip.foundation && typeof ip.foundation === 'object') ? ip.foundation : {};
    PARTS.forEach(function (P) {
      var p = getPage(P.part);
      if (p >= 2 && Number(f[P.idx]) !== p) { f[P.idx] = p; changed = true; }
      if (p < 2 && f[P.idx] != null) { delete f[P.idx]; changed = true; }
    });
    if (changed) { ip.foundation = f; writeJSON(IP_KEY, ip); try { window.dispatchEvent(new CustomEvent('antcv:item-pages-changed', { detail: { source: 'foundation-controls-327' } })); } catch (_) {} }
  }

  // local Enhance / Fix transforms — mirror antcv-how-contribute-controls-245
  // (lightweight, deterministic; NOT an LLM call). Enhance adds a scope/value
  // clause when the sentence lacks one; Fix trims filler + collapses whitespace.
  function enrichText(s) { var t = clean(s); if (!t) return t; if (/\b(because|so that|by|through|using|with|to)\b/i.test(t) || /\d/.test(t)) return t; return t.replace(/[.!?]?$/, '') + ' — with clearer scope and the value it creates.'; }
  function compressText(s) { var t = clean(s); if (!t) return t; return t.replace(/\b(really|very|quite|just|simply|basically|actually|in order to|a number of|the fact that)\b/gi, function (m) { return /in order to/i.test(m) ? 'to' : (/a number of/i.test(m) ? 'several' : (/the fact that/i.test(m) ? 'that' : '')); }).replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim(); }

  // ---- PREVIEW: apply CJLR alignment to the two foundation paragraphs ----
  function foundationPreviewParas() {
    var root = document.querySelector('.antcv-preview-paper [data-sid="foundation"], [data-antcv-preview-paper] [data-sid="foundation"], [data-sid="foundation"]');
    if (!root || !inPreview(root)) {
      // fall back: first [data-sid=foundation] inside any preview paper
      var all = Array.prototype.slice.call(document.querySelectorAll('[data-sid="foundation"]')).filter(inPreview);
      root = all[0] || null;
    }
    if (!root) return {};
    var ps = Array.prototype.slice.call(root.querySelectorAll('p')).filter(visible);
    var map = {};
    ps.forEach(function (p) {
      var txt = clean(p.textContent);
      PARTS.forEach(function (P) { if (!map[P.part] && P.rx.test(txt)) map[P.part] = p; });
    });
    return map;
  }
  function applyPreview() {
    var map = foundationPreviewParas();
    PARTS.forEach(function (P) {
      var p = map[P.part]; if (!p) return;
      var a = getAlign(P.part);
      if (p.style.textAlign !== a) p.style.textAlign = a;
      if (p.getAttribute('data-antcv-fnd-align') !== a) p.setAttribute('data-antcv-fnd-align', a);
    });
  }

  // ---- PANEL: find the two foundation sub-fields + attach a control row each ----
  function isFoundationField(field, partRx) {
    if (!field || inPreview(field)) return false;
    var p = field.parentElement;
    for (var d = 0; p && d < 4; d++, p = p.parentElement) {
      var t = clean(p.textContent);
      if (t && t.length < 80 && partRx.test(t)) return true;
    }
    return false;
  }
  function findFieldHost(field) {
    var p = field.parentElement, best = field.parentElement;
    for (var d = 0; p && d < 5; d++, p = p.parentElement) {
      var fields = Array.prototype.slice.call(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      if (fields.length === 1) { best = p; break; }
    }
    return best || field.parentElement;
  }
  function getVal(f) { return f ? (f.isContentEditable ? (f.textContent || '') : (f.value || '')) : ''; }
  function setVal(f, v) { if (!f) return; if (f.isContentEditable) f.textContent = v; else f.value = v; try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {} }
  function pulse() { ['antcv:sections-updated', 'antcv:item-pages-changed', 'antcv:item-align-changed'].forEach(function (e) { try { window.dispatchEvent(new CustomEvent(e, { detail: { source: 'foundation-controls-327' } })); } catch (_) {} }); }

  function styleBtn(b, bg, fg) {
    Object.assign(b.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '24px', minWidth: '24px', height: '24px', minHeight: '24px',
      padding: '0', margin: '0 2px', border: '1px solid ' + (bg || '#01B7BB'), borderRadius: '5px',
      background: 'rgba(1,183,187,0.08)', color: fg || '#00746E', fontWeight: '700', fontSize: '12px',
      lineHeight: '1', cursor: 'pointer', pointerEvents: 'auto', opacity: '1',
    });
  }
  function paintPage(btn, part) { var p = getPage(part); btn.textContent = '📄 ' + p; btn.title = (part === 'hands_on' ? 'Hands-on' : 'Professionally') + ' — manual page break (tap to cycle page 1 / 2). Page ≥ 2 moves this paragraph to a new page in the preview and the export.'; }
  function paintCjlr(btn, part) { var a = getAlign(part); btn.textContent = ICON[a] || ICON.justify; btn.title = (part === 'hands_on' ? 'Hands-on' : 'Professionally') + ' alignment: ' + (TITLES[a] || a) + '. Tap to cycle Center / Justify / Left / Right.'; }

  function ensureRow(field, P) {
    var host = findFieldHost(field);
    if (!host) return;
    if (host.querySelector('[data-antcv-fnd-row="' + P.part + '"]')) {
      // already present — just repaint state
      paintPage(host.querySelector('[data-antcv-fnd="page"][data-antcv-fnd-part="' + P.part + '"]'), P.part);
      paintCjlr(host.querySelector('[data-antcv-fnd="cjlr"][data-antcv-fnd-part="' + P.part + '"]'), P.part);
      return;
    }
    var bar = document.createElement('span');
    bar.setAttribute('data-antcv-fnd-row', P.part);
    Object.assign(bar.style, { display: 'inline-flex', alignItems: 'center', marginLeft: '4px', verticalAlign: 'middle' });
    var mk = function (kind, label) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('data-antcv-fnd', kind); b.setAttribute('data-antcv-fnd-part', P.part); return b; };

    var page = mk('page', '📄 1'); styleBtn(page); paintPage(page, P.part);
    page.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); var cur = getPage(P.part); setPage(P.part, P.idx, cur >= 2 ? 1 : 2); paintPage(page, P.part); applyPreview(); pulse(); }, true);

    var fit = mk('fit', '↹'); styleBtn(fit, '#01B7BB', '#00746E'); fit.title = 'Fix / Fit — tighten this paragraph (remove filler, collapse spacing).';
    fit.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); setVal(field, compressText(getVal(field))); applyPreview(); pulse(); }, true);

    var enr = mk('enrich', '✨'); styleBtn(enr, '#008b8b', '#006b6b'); enr.title = 'Enhance — sharpen this paragraph (add scope / value when missing).';
    enr.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); setVal(field, enrichText(getVal(field))); applyPreview(); pulse(); }, true);

    var cjlr = mk('cjlr', ICON.justify); styleBtn(cjlr); paintCjlr(cjlr, P.part);
    cjlr.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); setAlign(P.part, nextAlign(getAlign(P.part))); paintCjlr(cjlr, P.part); applyPreview(); pulse(); }, true);

    bar.appendChild(page); bar.appendChild(fit); bar.appendChild(enr); bar.appendChild(cjlr);
    // place the bar right after the field's label, else at the top of the host.
    var anchor = host.querySelector('label') || host.firstChild;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling); else host.appendChild(bar);
  }

  function attachPanel() {
    var fields = Array.prototype.slice.call(document.querySelectorAll('textarea,[contenteditable="true"],input'))
      .filter(function (f) { return visible(f) && !inPreview(f); });
    PARTS.forEach(function (P) {
      var field = fields.find(function (f) { return isFoundationField(f, P.rx); });
      if (field) ensureRow(field, P);
    });
  }

  var pending = false;
  function run() {
    if (pending) return; pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { reconcilePages(); attachPanel(); applyPreview(); }
      catch (e) { try { console.warn('[foundation-controls-327] failed:', e && e.message); } catch (_) {} }
    });
  }
  function start() {
    run(); [150, 400, 800, 1500, 2600, 4200].forEach(function (ms) { setTimeout(run, ms); });
    try { new MutationObserver(run).observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'value'] }); } catch (_) {}
    window.addEventListener('input', run, true);
    window.addEventListener('click', function () { setTimeout(run, 0); }, true);
    window.addEventListener('antcv:sections-updated', run);
    setInterval(run, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();

  window.AntcvFoundationControls327 = {
    version: VERSION, run: run,
    _getAlign: getAlign, _getPage: getPage, _setAlign: setAlign, _setPage: setPage,
    _enrich: enrichText, _compress: compressText, _applyPreview: applyPreview,
  };
  try { console.debug('[foundation-controls-327] installed ' + VERSION); } catch (_) {}
})();
