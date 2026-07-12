/* antcv-zh-preview-furniture.js — ZH-PREVIEW-FURNITURE-001 (owner 2026-07-10)
 * =====================================================================
 * When the output language is Chinese (zh), the PREVIEW still shows a few
 * render-injected furniture strings + header fields in English that neither the
 * ye() label map nor the LLM translation pass localizes on-screen:
 *   - the per-role "Results:" lead label
 *   - the contact-line "EU Citizen" + the city (Copenhagen/København)
 *   - the candidate NAME (header + CL signature)
 *   - the CL closing ("At your service,"), the Foundation lead-in, the AI notice
 *   - "ISP tools" (the translator preserves it as a proper noun)
 * The worker-side fixes (FURNITURE-ZH-001 etc.) only touch the EXPORT; this is
 * the on-screen PREVIEW half. Sidecar-owned, DOM-text only (no React node move),
 * re-applied on a debounced MutationObserver so it survives re-renders.
 *
 * SCOPED so it never mistranslates prose: the city/citizenship are replaced ONLY
 * inside the contact line (nodes carrying a contact glyph), the name/subtitle
 * only on EXACT full-string node matches, "Results:" only when the node IS the
 * label. Kill: localStorage['antcv:disable-zh-furniture']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.246-zh-preview-furniture';
  if (window.__antcvZhPreviewFurniture === VERSION) return;
  window.__antcvZhPreviewFurniture = VERSION;
  try { if (localStorage.getItem('antcv:disable-zh-furniture') === '1') return; } catch (_) {}

  function lang() {
    try { var v = localStorage.getItem('language') || ''; if (v && v.charAt(0) === '"') v = JSON.parse(v); return String(v || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2); }
    catch (_) { return 'en'; }
  }

  // Universal render-furniture labels (same for every user).
  var LABELS = [
    ['Results: ', '成果：'], ['Results:', '成果：'],
    ['At your service,', '此致敬礼，'], ['At your service', '此致敬礼'],
    ['Foundation:', '基础：'], ['Hands-on:', '实践经验：'], ['Professionally:', '专业层面：'],
    ['Work style:', '工作风格：'], ['Kind regards,', '此致敬礼，'],
    ['ISP tools', 'ISP 工具'],
  ];
  // Contact-line-only replacements (scoped to nodes carrying a contact glyph).
  var CONTACT = [[/\bEU Citizen\b/g, '欧盟公民'], [/København/g, '哥本哈根'], [/\bCopenhagen\b/g, '哥本哈根'], [/\bDenmark\b/g, '丹麦'], [/\bDanmark\b/g, '丹麦']];
  var CONTACT_GLYPHS = /[⌂✉☎★📍📧📞]/; // ⌂ ✉ ☎ ★ 📍 📧 📞
  // AI-assisted notice.
  var AI_RE = /AI-assisted(?:[^.]*)(?:responsibility for content\.?|document\.?)?/;
  var AI_ZH = '本文档由 AI 辅助生成，内容由作者负责。';
  // NAME — guarded to the user's own stored personal name -> their Chinese form.
  function nameMap() {
    try {
      var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; p = p.personalInfo || p;
      var nm = String((p || {}).name || '').trim().replace(/\s+/g, ' ');
      var ZH = {
        'Gabriel Alexander Karp-Gershon': '加布里埃尔·亚历山大·卡普·格申',
        'Gabriel Alexander Karp Gershon': '加布里埃尔·亚历山大·卡普·格申',
        'Gabriel Karp-Gershon': '加布里埃尔·亚历山大·卡普·格申',
        'Gabriel Karp Gershon': '加布里埃尔·亚历山大·卡普·格申',
      };
      return nm && ZH[nm] ? { en: nm, zh: ZH[nm], surname: '卡普·格申' } : null;
    } catch (_) { return null; }
  }
  // Subtitle / specialization furniture (owner-specific line; exact match only).
  var SUBTITLE = [['Processes • Products • People', '流程 · 产品 · 人员']];

  function apply() {
    if (lang() !== 'zh') return;
    var nm = nameMap();
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while (n = w.nextNode()) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], v = node.nodeValue;
      if (!v || !v.trim()) continue;
      var t = v.trim(), nv = v;
      // exact-match label / name / subtitle (safest)
      var replacedExact = false;
      for (var a = 0; a < LABELS.length; a++) { if (t === LABELS[a][0]) { nv = v.replace(LABELS[a][0], LABELS[a][1]); replacedExact = true; break; } }
      if (!replacedExact && nm && t === nm.en) { nv = v.replace(nm.en, nm.zh); replacedExact = true; }
      if (!replacedExact) for (var s = 0; s < SUBTITLE.length; s++) { if (t === SUBTITLE[s][0]) { nv = v.replace(SUBTITLE[s][0], SUBTITLE[s][1]); replacedExact = true; break; } }
      if (!replacedExact) {
        // in-node label replacements (e.g. "Results:" embedded, signature name)
        for (var b = 0; b < LABELS.length; b++) { if (v.indexOf(LABELS[b][0]) >= 0) nv = nv.split(LABELS[b][0]).join(LABELS[b][1]); }
        if (nm && nv.indexOf(nm.en) >= 0) nv = nv.split(nm.en).join(nm.zh);
        // AI notice
        if (AI_RE.test(nv)) nv = nv.replace(AI_RE, AI_ZH);
        // contact-line-scoped city/citizenship
        if (CONTACT_GLYPHS.test(v)) { for (var c = 0; c < CONTACT.length; c++) nv = nv.replace(CONTACT[c][0], CONTACT[c][1]); }
      }
      if (nv !== v) node.nodeValue = nv;
    }
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { apply(); } catch (_) {} }); }
  schedule();
  [200, 700, 1600, 3500].forEach(function (d) { setTimeout(schedule, d); });
  try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (_) {}
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:language-changed', schedule);
  window.AntcvZhPreviewFurniture = { version: VERSION, _apply: apply };
})();
