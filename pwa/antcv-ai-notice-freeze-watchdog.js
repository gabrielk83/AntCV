/* AntCV AI notice freeze watchdog (v1.40.220)
 * Fixes the post-startup freeze where the EU AI notice is hidden while
 * its backdrop/portal still catches all pointer events.
 */
(function () {
  'use strict';
  if (window.__antcvAiNoticeFreezeWatchdogInstalled) return;
  window.__antcvAiNoticeFreezeWatchdogInstalled = '1.40.220';

  const LS_KEY = 'aiDisclosureAccepted';
  const ROOT_ATTR = 'data-antcv-ai-freeze-cleaned';
  const HIDDEN_ATTRS = '[data-antcv-ai-cloud-hidden="1"], [data-antcv-disclosure-deferred="1"], [data-antcv-ai-disclosure="accepted"]';

  function acceptedValue(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return !!s && !/^(false|0|null|undefined|no)$/.test(s);
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return acceptedValue(v.accepted);
      if ('value' in v) return acceptedValue(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }

  function localAccepted() {
    try { if (acceptedValue(localStorage.getItem(LS_KEY))) return true; } catch (_) {}
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
      if (pi && (acceptedValue(pi.aiDisclosureAccepted) || acceptedValue(pi.aiDisclosure) || acceptedValue(pi.disclosureAccepted))) return true;
    } catch (_) {}
    return false;
  }

  function txt(el, max) {
    const t = (el && el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
  }

  function hasAiNoticeText(el) {
    return /AntCV\s+uses\s+generative\s+AI|EU\s+AI\s+Act|AI-generated\s+output|large\s+language\s+models|ai\s+disclosure/i.test(txt(el, 1600));
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    } catch (_) { return true; }
  }

  function hasVisibleAiNotice(el) {
    try {
      const nodes = el.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-antcv-modal="ai-disclosure"], [data-antcv-ai-disclosure]');
      for (const n of nodes) {
        if (n.matches && n.matches(HIDDEN_ATTRS)) continue;
        if (isVisible(n) && hasAiNoticeText(n)) return true;
      }
    } catch (_) {}
    return false;
  }

  function isFullScreenBlocker(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === 'none') return false;
      const r = el.getBoundingClientRect();
      const covers = r.width >= window.innerWidth * 0.65 && r.height >= window.innerHeight * 0.65 && r.left < window.innerWidth * 0.25 && r.top < window.innerHeight * 0.25;
      if (!covers) return false;
      const z = parseInt(cs.zIndex || '0', 10);
      const fixed = cs.position === 'fixed' || cs.position === 'sticky';
      const name = ((el.getAttribute('class') || '') + ' ' + (el.getAttribute('id') || '') + ' ' + (el.getAttribute('role') || '')).toLowerCase();
      return fixed || z >= 20 || /modal|dialog|overlay|backdrop|scrim|portal|sheet/.test(name);
    } catch (_) { return false; }
  }

  function hasHiddenAiNotice(el) {
    try {
      if (el.matches && el.matches(HIDDEN_ATTRS)) return true;
      if (el.querySelector && el.querySelector(HIDDEN_ATTRS)) return true;
    } catch (_) {}
    return false;
  }

  function rootFor(node) {
    let root = node;
    let p = node && node.parentElement;
    for (let i = 0; p && p !== document.body && i < 8; i += 1, p = p.parentElement) {
      if (isFullScreenBlocker(p) || /modal|dialog|overlay|backdrop|scrim|portal|sheet/i.test((p.className || '') + ' ' + (p.id || '') + ' ' + (p.getAttribute && p.getAttribute('role') || ''))) root = p;
    }
    return root;
  }

  function neutralize(el) {
    if (!el || el.nodeType !== 1) return;
    try {
      el.setAttribute(ROOT_ATTR, '1');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('touch-action', 'auto', 'important');
      el.setAttribute('aria-hidden', 'true');
    } catch (_) {}
  }

  function removeOrNeutralize(el) {
    if (!el || el.nodeType !== 1) return;
    if (localAccepted()) {
      try { el.remove(); return; } catch (_) {}
    }
    neutralize(el);
  }

  function scan() {
    let candidates = [];
    try {
      candidates = Array.from(document.querySelectorAll('[data-antcv-ai-cloud-hidden="1"], [data-antcv-disclosure-deferred="1"], [data-antcv-ai-disclosure], [data-antcv-modal="ai-disclosure"], [role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i], [class*="backdrop" i], [class*="scrim" i], [class*="portal" i]'));
    } catch (_) { candidates = []; }

    const roots = new Set();
    for (const c of candidates) {
      const related = hasHiddenAiNotice(c) || hasAiNoticeText(c) || (c.getAttribute && c.getAttribute('data-antcv-modal') === 'ai-disclosure');
      if (!related) continue;
      const r = rootFor(c);
      if (!r || !isFullScreenBlocker(r)) continue;
      // Do not disable a visible first-time notice. Only clean hidden/deferred
      // stacks or already accepted disclosure layers.
      if (!localAccepted() && !hasHiddenAiNotice(r) && hasVisibleAiNotice(r)) continue;
      roots.add(r);
    }

    roots.forEach(removeOrNeutralize);
    try {
      document.documentElement.style.removeProperty('pointer-events');
      document.body.style.removeProperty('pointer-events');
    } catch (_) {}
  }

  try {
    const mo = new MutationObserver(function () { setTimeout(scan, 0); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-antcv-ai-cloud-hidden', 'data-antcv-disclosure-deferred', 'data-antcv-ai-disclosure', 'aria-hidden'] });
  } catch (_) {}

  [0, 50, 150, 300, 700, 1200, 1800, 2500, 3500, 5000, 8000, 12000, 20000].forEach(function (t) { setTimeout(scan, t); });
  ['storage', 'antcv:ai-disclosure-accepted', 'focus', 'pageshow'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(scan, 0); }); });

  window.AntcvAiNoticeFreezeWatchdog = { version: '1.40.220', scan };
  try { console.debug('[ai-notice-freeze-watchdog] installed v1.40.220'); } catch (_) {}
})();
