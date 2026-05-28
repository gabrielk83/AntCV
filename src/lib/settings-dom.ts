// Small helpers for finding the Settings modal root and detecting which
// subtab is visible. Mirrors the logic in pwa/antcv-stability-core-334.js
// (settingsRoot, tabState, isPersonal). React islands need the same
// detection so they only render when Settings → Personal is open.

function norm(v: unknown): string {
  return String(v ?? '').replace(/[ \t\n\r]+/g, ' ').trim();
}

function low(v: unknown): string {
  return norm(v).toLowerCase();
}

export function isElementVisible(el: Element | null | undefined): boolean {
  if (!el) return false;
  try {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 3 && r.height > 3;
  } catch {
    return true;
  }
}

function activeish(el: Element | null): boolean {
  if (!el) return false;
  try {
    if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true') return true;
    if (/active|selected|current/i.test(String(el.className || ''))) return true;
    const cs = getComputedStyle(el);
    const s = [cs.backgroundColor, cs.borderColor, cs.color, cs.boxShadow].join(' ');
    return /rgb\(0, ?183, ?187\)|rgb\(1, ?183, ?187\)|rgb\(11, ?180, ?190\)|#00b7bb|#01b7bb|#0bb4be/i.test(s);
  } catch {
    return false;
  }
}

function buttonsIn(root: Element | Document): Element[] {
  return Array.from(root.querySelectorAll('button,[role="button"],a'));
}

function activeButton(root: Element, re: RegExp): Element | null {
  const all = buttonsIn(root).filter((b) => re.test(norm(b.textContent)));
  return all.find(activeish) ?? null;
}

export function findSettingsRoot(): HTMLElement | null {
  let best: HTMLElement | null = null;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"],main,section,div'),
  );
  for (const el of candidates) {
    if (!isElementVisible(el)) continue;
    const t = norm(el.textContent).slice(0, 12000);
    if (t.indexOf('Settings') >= 0 && /STANDARD/i.test(t) && /ADVANCED/i.test(t)) {
      if (!best || norm(el.textContent).length < norm(best.textContent).length) {
        best = el;
      }
    }
  }
  return best;
}

export interface TabState {
  top: '' | 'standard' | 'advanced' | 'admin';
  sub:
    | ''
    | 'account'
    | 'personal'
    | 'layout'
    | 'application-history'
    | 'sync'
    | 'adv. styles'
    | 'routing'
    | 'api keys'
    | 'general'
    | 'demo'
    | 'users'
    | 'analytics';
}

export function getTabState(root: Element): TabState {
  const top = activeButton(root, /^(STANDARD|ADVANCED|ADMIN)$/i);
  const sub = activeButton(
    root,
    /^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i,
  );
  const t = top ? (low(top.textContent) as TabState['top']) : '';
  let s = (sub ? low(sub.textContent) : '') as TabState['sub'];
  if (s === ('user' as TabState['sub'])) s = 'personal';
  const body = norm(root.textContent).slice(0, 16000);
  if (t === 'standard' && (!s || s === 'account') && /ADVANCED TONE/i.test(body) && /BANNED WORDS/i.test(body)) {
    s = 'personal';
  }
  if (t === 'standard' && /SIGN IN/i.test(body) && /Sign in is required/i.test(body)) {
    s = s || 'account';
  }
  return { top: t, sub: s };
}

export function isPersonalSubtab(root: Element): boolean {
  const st = getTabState(root);
  return st.top === 'standard' && st.sub === 'personal';
}

export function findDoneButton(root: Element): Element | null {
  const done = buttonsIn(root).filter((b) => /^Done$/i.test(norm(b.textContent))).pop();
  return done ?? null;
}
