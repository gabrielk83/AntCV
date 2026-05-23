/* AntCV AI notice stability sidecar (v1.40.220)
 * Fixes late EU AI notice modal states where the checkbox is visibly checked
 * but Continue stays disabled, blocking the app.
 */
(function () {
  'use strict';

  if (window.__antcvAiNoticeStabilityInstalled) return;
  window.__antcvAiNoticeStabilityInstalled = '1.40.220';

  const LS_KEY = 'aiDisclosureAccepted';
  const META_KEY = 'aiDisclosureAcceptedMeta';

  function nowIso() { return new Date().toISOString(); }

  function textOf(el, max) {
    const t = (el && el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
  }

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

  function markAccepted(source) {
    const at = nowIso();
    try { localStorage.setItem(LS_KEY, at); } catch (_) {}
    try { localStorage.setItem(META_KEY, JSON.stringify({ accepted: true, acceptedAt: at, source: source || 'notice-stability' })); } catch (_) {}
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      pi.aiDisclosureAccepted = at;
      pi.aiDisclosure = true;
      pi.disclosureAccepted = true;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY, newValue: at })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-accepted', { detail: { source: source || 'notice-stability', at } })); } catch (_) {}
    try {
      if (window.AntcvAiDisclosureCloud && typeof window.AntcvAiDisclosureCloud.writeCloudAccepted === 'function') {
        window.AntcvAiDisclosureCloud.writeCloudAccepted(source || 'notice-stability');
      }
    } catch (_) {}
  }

  function isDisclosureNode(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (el.getAttribute('data-antcv-modal') === 'ai-disclosure' || el.getAttribute('data-antcv-ai-disclosure'))) return true;
    const sample = textOf(el, 1000);
    return /\b(?:AntCV\s+uses\s+generative\s+AI|generative\s+AI|EU\s+AI|AI\s+Act|artificial\s+intelligence)\b/i.test(sample) &&
           /\b(?:understand|accept|agree|continue|notice|disclosure|acknowledgement)\b/i.test(sample);
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
      return el.offsetWidth > 0 || el.offsetHeight > 0;
    } catch (_) { return true; }
  }

  function disclosureNodes() {
    const out = [];
    try {
      const nodes = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i], [data-antcv-modal], [data-antcv-ai-disclosure]');
      for (const n of nodes) if (isVisible(n) && isDisclosureNode(n)) out.push(n);
    } catch (_) {}
    return out;
  }

  function findCheckbox(modal) {
    if (!modal) return null;
    const boxes = modal.querySelectorAll('input[type="checkbox"]');
    for (const b of boxes) return b;
    return null;
  }

  function findContinue(modal) {
    if (!modal) return null;
    const ctrls = modal.querySelectorAll('button,[role="button"],a,input[type="button"],input[type="submit"]');
    for (const c of ctrls) {
      const txt = (textOf(c, 80) || String(c.value || '')).trim();
      if (/^(continue|accept|agree|i\s+understand|i\s+agree|ok|got\s+it|confirm|fortsæt|fortsaet|accepter|jeg\s+accepterer)$/i.test(txt)) return c;
    }
    return null;
  }

  function dismiss(modal, source) {
    markAccepted(source);
    try { modal.setAttribute('data-antcv-ai-disclosure', 'accepted'); } catch (_) {}
    try { modal.remove(); return; } catch (_) {}
    try { modal.style.display = 'none'; } catch (_) {}
  }

  function repairModal(modal) {
    const box = findCheckbox(modal);
    const btn = findContinue(modal);

    if (localAccepted()) {
      if (btn && !btn.disabled) {
        try { btn.click(); return; } catch (_) {}
      }
      dismiss(modal, 'previously-accepted');
      return;
    }

    if (box && box.checked) {
      // React can occasionally render the visual checked state without
      // updating the CTA state. Re-fire events and remove disabled gates.
      try { box.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { box.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      if (btn) {
        try { btn.disabled = false; } catch (_) {}
        try { btn.removeAttribute('disabled'); } catch (_) {}
        try { btn.setAttribute('aria-disabled', 'false'); } catch (_) {}
        try { btn.style.pointerEvents = 'auto'; } catch (_) {}
      }
    }
  }

  function scan() { disclosureNodes().forEach(repairModal); }

  document.addEventListener('click', function (ev) {
    const target = ev.target && ev.target.closest ? ev.target.closest('button,[role="button"],a,input[type="button"],input[type="submit"]') : null;
    if (!target) return;
    const modal = target.closest('[role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i], [data-antcv-modal], [data-antcv-ai-disclosure]');
    if (!modal || !isDisclosureNode(modal)) return;
    if (target !== findContinue(modal)) return;
    const box = findCheckbox(modal);
    if (box && box.checked) {
      if (target.disabled || target.getAttribute('aria-disabled') === 'true') {
        ev.preventDefault();
        ev.stopPropagation();
        dismiss(modal, 'checked-disabled-continue');
      } else {
        markAccepted('continue-click');
      }
    }
  }, true);

  try {
    const mo = new MutationObserver(function () { scan(); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'checked', 'style', 'class'] });
  } catch (_) {}

  [0, 100, 300, 700, 1500, 3000, 6000, 12000].forEach(function (t) { setTimeout(scan, t); });
  window.addEventListener('storage', function (ev) { if (!ev || ev.key === LS_KEY) setTimeout(scan, 0); });
  window.addEventListener('antcv:ai-disclosure-accepted', function () { setTimeout(scan, 0); });

  window.AntcvAiNoticeStability = { version: '1.40.220', scan, markAccepted };
  try { console.debug('[ai-notice-stability] installed v1.40.220'); } catch (_) {}
})();

/* AntCV AI notice pointer-blocker cleanup (v1.40.218)
 * v1.40.220 could hide/dismiss the disclosure content while a transparent
 * backdrop/scrim stayed mounted, leaving the app unclickable. This removes
 * the whole disclosure stack when consent is already local, and disables
 * pointer capture while the cloud check temporarily hides the notice.
 */
(function () {
  'use strict';
  if (window.__antcvAiNoticeBlockerCleanupInstalled) return;
  window.__antcvAiNoticeBlockerCleanupInstalled = '1.40.218';

  const LS_KEY = 'aiDisclosureAccepted';

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

  function textOf(el, max) {
    const t = (el && el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
  }

  function looksLikeDisclosure(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (el.getAttribute('data-antcv-modal') === 'ai-disclosure' || el.getAttribute('data-antcv-ai-disclosure') || el.getAttribute('data-antcv-ai-cloud-hidden') === '1')) return true;
    const sample = textOf(el, 1200);
    return /AntCV\s+uses\s+generative\s+AI|EU\s+AI\s+Act|AI-generated\s+output|large\s+language\s+models/i.test(sample) &&
           /understand|accept|continue|acknowledge|disclosure/i.test(sample);
  }

  function isOverlayLike(el) {
    if (!el || el.nodeType !== 1) return false;
    const a = (el.getAttribute('class') || '') + ' ' + (el.getAttribute('id') || '') + ' ' + (el.getAttribute('role') || '');
    if (/modal|dialog|overlay|backdrop|scrim|portal|sheet|alertdialog/i.test(a)) return true;
    try {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const full = r.width >= window.innerWidth * 0.7 && r.height >= window.innerHeight * 0.7;
      const onTop = cs.position === 'fixed' || cs.position === 'sticky';
      const z = parseInt(cs.zIndex || '0', 10);
      return full && (onTop || z >= 20);
    } catch (_) { return false; }
  }

  function findDisclosureRoots() {
    const roots = new Set();
    let nodes = [];
    try {
      nodes = Array.from(document.querySelectorAll('[data-antcv-ai-cloud-hidden="1"], [data-antcv-ai-disclosure], [data-antcv-modal="ai-disclosure"], [role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i], [class*="backdrop" i], [class*="scrim" i]'));
    } catch (_) { nodes = []; }

    for (const n of nodes) {
      if (!looksLikeDisclosure(n)) continue;
      let root = n;
      let p = n.parentElement;
      for (let i = 0; p && p !== document.body && i < 5; i += 1, p = p.parentElement) {
        if (isOverlayLike(p)) root = p;
      }
      roots.add(root);
    }
    return Array.from(roots);
  }

  function unblockPointerOnly() {
    for (const n of findDisclosureRoots()) {
      try {
        n.setAttribute('data-antcv-ai-pointer-cleaned', '1');
        n.style.setProperty('pointer-events', 'none', 'important');
      } catch (_) {}
    }
  }

  function removeAcceptedBlockers() {
    if (!localAccepted()) {
      unblockPointerOnly();
      return;
    }
    for (const n of findDisclosureRoots()) {
      try { n.remove(); continue; } catch (_) {}
      try {
        n.style.setProperty('display', 'none', 'important');
        n.style.setProperty('pointer-events', 'none', 'important');
        n.setAttribute('aria-hidden', 'true');
      } catch (_) {}
    }
    try {
      document.documentElement.style.removeProperty('pointer-events');
      document.body.style.removeProperty('pointer-events');
      document.body.style.removeProperty('touch-action');
    } catch (_) {}
  }

  function scan() { removeAcceptedBlockers(); }

  try {
    const mo = new MutationObserver(function () { setTimeout(scan, 0); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-antcv-ai-cloud-hidden', 'data-antcv-ai-disclosure'] });
  } catch (_) {}

  [0, 50, 150, 300, 700, 1200, 2000, 3500, 6000, 10000, 15000, 25000].forEach(function (t) { setTimeout(scan, t); });
  window.addEventListener('storage', function (ev) { if (!ev || ev.key === LS_KEY) setTimeout(scan, 0); });
  window.addEventListener('antcv:ai-disclosure-accepted', function () { setTimeout(scan, 0); });
  window.AntcvAiNoticeBlockerCleanup = { version: '1.40.218', scan };
  try { console.debug('[ai-notice-blocker-cleanup] installed v1.40.218'); } catch (_) {}
})();
