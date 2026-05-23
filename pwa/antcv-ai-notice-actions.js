/* AntCV AI notice actions + clickability fix (v1.40.220)
 * Keeps the visible AI disclosure interactive after onboarding and adds:
 *   - Disagree: sign out / leave without accepting
 *   - Disagree & Delete user: run the destructive user erase flow
 */
(function () {
  'use strict';
  if (window.__antcvAiNoticeActionsInstalled) return;
  window.__antcvAiNoticeActionsInstalled = '1.40.220';

  const STYLE_ID = 'antcv-ai-notice-actions-style';

  function textOf(el, max) {
    const t = (el && el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
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

  function looksLikeAiNotice(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (el.getAttribute('data-antcv-modal') === 'ai-disclosure' || el.getAttribute('data-antcv-ai-disclosure'))) return true;
    const t = textOf(el, 2000);
    return /AntCV\s+uses\s+generative\s+AI|AI-generated\s+output|large\s+language\s+models|EU\s+AI\s+Act/i.test(t) &&
           /understand|accept|continue|disclosure|acknowledge/i.test(t);
  }

  function findNotice() {
    let best = null;
    try {
      const nodes = document.querySelectorAll('[data-antcv-modal="ai-disclosure"], [data-antcv-ai-disclosure], [role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i]');
      for (const n of nodes) {
        if (!isVisible(n) || !looksLikeAiNotice(n)) continue;
        if (!best) best = n;
        const r = n.getBoundingClientRect();
        const br = best.getBoundingClientRect();
        // Prefer the visible card over a full-screen wrapper.
        if ((r.width * r.height) < (br.width * br.height)) best = n;
      }
    } catch (_) {}
    return best;
  }

  function overlayRoot(modal) {
    let root = modal;
    let p = modal && modal.parentElement;
    for (let i = 0; p && p !== document.documentElement && i < 8; i += 1, p = p.parentElement) {
      try {
        const cs = getComputedStyle(p);
        const r = p.getBoundingClientRect();
        const full = r.width >= window.innerWidth * 0.6 && r.height >= window.innerHeight * 0.6;
        const name = ((p.className || '') + ' ' + (p.id || '') + ' ' + (p.getAttribute('role') || '')).toLowerCase();
        if (full || /modal|dialog|overlay|backdrop|scrim|portal|sheet/.test(name) || cs.position === 'fixed') root = p;
      } catch (_) {}
    }
    return root || modal;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      [data-antcv-ai-actions-root="1"],
      [data-antcv-ai-actions-root="1"] * {
        pointer-events: auto !important;
      }
      .antcv-ai-notice-action-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .antcv-ai-notice-action-row button {
        border: 1px solid rgba(255,255,255,.35);
        border-radius: 8px;
        padding: 10px 12px;
        background: rgba(255,255,255,.08);
        color: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .antcv-ai-notice-action-row .antcv-ai-disagree-delete {
        border-color: #ff6b6b;
        color: #ffd7d7;
      }
    `;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function findCheckbox(modal) {
    try { return modal.querySelector('input[type="checkbox"]'); } catch (_) { return null; }
  }

  function findContinue(modal) {
    try {
      const ctrls = modal.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"]');
      for (const c of ctrls) {
        const t = (textOf(c, 80) || String(c.value || '')).trim();
        if (/^(continue|accept|agree|i\s+understand|i\s+agree|ok|got\s+it|confirm|fortsæt|fortsaet|accepter|jeg\s+accepterer)$/i.test(t)) return c;
      }
    } catch (_) {}
    return null;
  }

  function setAcceptedLocal(source) {
    const at = new Date().toISOString();
    try { localStorage.setItem('aiDisclosureAccepted', at); } catch (_) {}
    try { localStorage.setItem('aiDisclosureAcceptedMeta', JSON.stringify({ accepted: true, acceptedAt: at, source: source || 'notice-actions' })); } catch (_) {}
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      pi.aiDisclosureAccepted = at;
      pi.aiDisclosure = true;
      pi.disclosureAccepted = true;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-accepted', { detail: { source: source || 'notice-actions', at } })); } catch (_) {}
  }

  async function signOutOnly() {
    try { sessionStorage.setItem('antcv:ai-disclosure-declined', String(Date.now())); } catch (_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        await window.AntcvAuth.signOut();
        return;
      }
    } catch (_) {}
    try { localStorage.removeItem('aiDisclosureAccepted'); } catch (_) {}
    try { location.reload(); } catch (_) {}
  }

  async function deleteUser() {
    try { sessionStorage.setItem('antcv:ai-disclosure-declined-delete', String(Date.now())); } catch (_) {}
    try {
      if (typeof window.AntcvFullErase === 'function') {
        await window.AntcvFullErase();
        return;
      }
    } catch (_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        await window.AntcvAuth.signOut();
        return;
      }
    } catch (_) {}
    try { localStorage.clear(); sessionStorage.clear(); location.reload(); } catch (_) {}
  }

  function ensureButtons(modal) {
    if (!modal || modal.querySelector('.antcv-ai-notice-action-row')) return;
    const continueBtn = findContinue(modal);
    const row = document.createElement('div');
    row.className = 'antcv-ai-notice-action-row';

    const disagree = document.createElement('button');
    disagree.type = 'button';
    disagree.className = 'antcv-ai-disagree';
    disagree.textContent = 'Disagree';
    disagree.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation(); signOutOnly();
    }, true);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'antcv-ai-disagree-delete';
    del.textContent = 'Disagree & Delete user';
    del.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation(); deleteUser();
    }, true);

    row.appendChild(disagree);
    row.appendChild(del);

    if (continueBtn && continueBtn.parentElement) {
      continueBtn.parentElement.insertAdjacentElement('afterend', row);
    } else {
      modal.appendChild(row);
    }
  }

  function repairClickability(modal) {
    if (!modal) return;
    ensureStyle();
    const root = overlayRoot(modal);
    try { root.setAttribute('data-antcv-ai-actions-root', '1'); } catch (_) {}
    try { modal.setAttribute('data-antcv-ai-actions-root', '1'); } catch (_) {}

    // Undo previous watchdog neutralisation when the notice is visible.
    let p = modal;
    for (let i = 0; p && i < 10; i += 1, p = p.parentElement) {
      try {
        p.style.setProperty('pointer-events', 'auto', 'important');
        p.removeAttribute('aria-hidden');
        if (p.getAttribute('data-antcv-disclosure-deferred') === '1') p.removeAttribute('data-antcv-disclosure-deferred');
        if (p.getAttribute('data-antcv-ai-cloud-hidden') === '1') p.removeAttribute('data-antcv-ai-cloud-hidden');
        if (p.getAttribute('data-antcv-ai-freeze-cleaned') === '1') p.removeAttribute('data-antcv-ai-freeze-cleaned');
      } catch (_) {}
    }

    const box = findCheckbox(modal);
    const btn = findContinue(modal);
    if (box) {
      try { box.disabled = false; box.style.setProperty('pointer-events', 'auto', 'important'); } catch (_) {}
    }
    if (btn) {
      try { btn.style.setProperty('pointer-events', 'auto', 'important'); } catch (_) {}
      if (box && box.checked) {
        try { btn.disabled = false; btn.removeAttribute('disabled'); btn.setAttribute('aria-disabled', 'false'); } catch (_) {}
      }
    }
    ensureButtons(modal);
  }

  function scan() {
    const modal = findNotice();
    if (!modal) return;
    repairClickability(modal);
  }

  document.addEventListener('change', function (ev) {
    const modal = findNotice();
    if (!modal || !ev.target || ev.target !== findCheckbox(modal)) return;
    const btn = findContinue(modal);
    if (ev.target.checked && btn) {
      try { btn.disabled = false; btn.removeAttribute('disabled'); btn.setAttribute('aria-disabled', 'false'); } catch (_) {}
    }
  }, true);

  document.addEventListener('click', function (ev) {
    const modal = findNotice();
    if (!modal) return;
    const btn = findContinue(modal);
    const box = findCheckbox(modal);
    if (btn && ev.target && (ev.target === btn || (ev.target.closest && ev.target.closest('button,[role="button"]') === btn))) {
      if (box && box.checked) setAcceptedLocal('continue-click');
    }
    setTimeout(scan, 0);
  }, true);

  try {
    const mo = new MutationObserver(function () { setTimeout(scan, 0); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'disabled', 'aria-disabled', 'data-antcv-ai-freeze-cleaned', 'data-antcv-disclosure-deferred', 'data-antcv-ai-cloud-hidden'] });
  } catch (_) {}

  [0, 50, 150, 300, 700, 1200, 2000, 3500, 6000, 10000, 15000].forEach(function (t) { setTimeout(scan, t); });
  ['focus', 'pageshow', 'antcv:sections-updated'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(scan, 0); }); });

  window.AntcvAiNoticeActions = { version: '1.40.220', scan, signOutOnly, deleteUser };
  try { console.debug('[ai-notice-actions] installed v1.40.220'); } catch (_) {}
})();
