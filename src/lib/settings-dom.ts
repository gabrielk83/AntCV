// Small helpers for finding the Settings modal root and detecting which
// subtab is visible. Mirrors the logic in pwa/antcv-stability-core-334.js
// (settingsRoot, tabState, isPersonal). React islands need the same
// detection so they only render when the right Settings subtab is open.

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

// STICKY-LEAK-003 (owner 2026-06-26): the Personal fallback in getTabState keys on "ADVANCED TONE" +
// "BANNED WORDS" body text — but those strings are ALSO produced by the WritingStylePicker island
// itself (it renders "Advanced tone"; dedup leaves "Banned words" buttons). Once the island mounted on
// a genuine Personal visit, its OWN text kept isPersonalSubtab() true on Account/Layout too, so it
// never unmounted (the writing-style + job-search-targeting panels the owner saw stuck on other tabs —
// a self-perpetuating loop). Exclude every React-island / react-mount subtree from the fallback text so
// an island can't be the signal that keeps itself mounted. Native section headers (app.js renders
// ADVANCED TONE / BANNED WORDS on the real Personal panel) still drive the fallback correctly.
function bodyTextExcludingIslands(root: Element): string {
  try {
    const clone = root.cloneNode(true) as Element;
    clone
      .querySelectorAll('[data-antcv-react-island],[data-antcv-react-mount]')
      .forEach((n) => n.remove());
    return norm(clone.textContent).slice(0, 16000);
  } catch {
    return norm(root.textContent).slice(0, 16000);
  }
}

// STICKY-LEAK-004 (owner 2026-06-26): STICKY-LEAK-003 excluded island subtrees from the fallback text,
// which fixed most tabs — but the islands STILL stuck on Application History, because the NATIVE
// "ADVANCED TONE" / "BANNED WORDS" headers linger in the Personal flex-column (hidden, display:none)
// that persists across subtabs, so a plain text test still matched. Require a VISIBLE native marker:
// on a non-Personal subtab the Personal column is hidden, so its markers aren't visible and the
// fallback no longer mis-fires. Excludes island subtrees and matches an element's OWN text only.
function hasVisibleNativeMarker(root: Element, re: RegExp): boolean {
  const nodes = Array.from(
    root.querySelectorAll('div,span,button,h1,h2,h3,h4,label,p,strong,b,summary'),
  );
  for (const el of nodes) {
    if ((el as HTMLElement).closest('[data-antcv-react-island],[data-antcv-react-mount]')) continue;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => (n as Text).textContent)
      .join(' ');
    if (!re.test(norm(own))) continue;
    if (isElementVisible(el)) return true;
  }
  return false;
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
  if (t === 'standard') {
    if (
      (!s || s === 'account') &&
      hasVisibleNativeMarker(root, /ADVANCED TONE/i) &&
      hasVisibleNativeMarker(root, /BANNED WORDS/i)
    ) {
      s = 'personal';
    }
    const body = bodyTextExcludingIslands(root);
    if (/SIGN IN/i.test(body) && /Sign in is required/i.test(body)) {
      s = s || 'account';
    }
  }
  return { top: t, sub: s };
}

export function isPersonalSubtab(root: Element): boolean {
  const st = getTabState(root);
  return st.top === 'standard' && st.sub === 'personal';
}

// Locate the "Open Advanced -> Style ..." hand-off button shown in the Layout
// subtab. Matches on a stable visible-text fragment (case-insensitive),
// tolerant of the arrow glyphs and the exact wording tail.
function isVisibleEl(el: Element): boolean {
  try { return (el as HTMLElement).getClientRects().length > 0; } catch { return true; }
}
export function findAdvancedStyleButton(root: Element): Element | null {
  // v1.50.552 — must be VISIBLE. app.js leaves this hand-off button in the DOM
  // (hidden) on other subtabs; matching it there made isLayoutSubtab's fallback
  // fire → ExportOptions + PackagePicker went sticky on non-Layout subtabs.
  const re = /open advanced.*style|advanced.*style for/i;
  const hit = buttonsIn(root).filter((b) => re.test(norm(b.textContent)) && isVisibleEl(b));
  return hit[0] ?? null;
}

// True when the Layout subtab is the active view. That subtab carries the
// "Open Advanced -> Style ..." button as its hand-off control, so we accept
// either the active-subtab detection OR the presence of that button as a
// body-text fallback (the active-chip heuristic can miss when the subtab chip
// is styled unusually).
export function isLayoutSubtab(root: Element): boolean {
  const st = getTabState(root);
  if (st.sub === 'layout') return true;
  // v1.50.544/559 — the button-presence fallback used to make ExportOptions +
  // PackagePicker ("Within-package style") STICKY on other subtabs, because the
  // hand-off button lingers in the DOM. Tightened: any OTHER recognized subtab
  // is definitively NOT Layout; and the (visible-button) fallback only applies
  // when the subtab is genuinely ambiguous AND we are under the Standard top tab
  // (never Advanced/Admin, where the layout button can also linger).
  if (st.sub) return false;
  if (st.top && st.top !== 'standard') return false;
  return findAdvancedStyleButton(root) != null;
}

export function findDoneButton(root: Element): Element | null {
  const done = buttonsIn(root).filter((b) => /^Done$/i.test(norm(b.textContent))).pop();
  return done ?? null;
}

// ─── native-section anchoring ─────────────────────────────────────────────
//
// The STANDARD Settings subtabs render their sections inside a
// `display:flex; flex-direction:column` container that arranges children by
// CSS `order` (e.g. in Personal: WRITING STYLE=25, ADVANCED TONE=30, BANNED
// WORDS=40). DOM insertion order therefore does NOT control visual position —
// an injected island lands wherever its `order` puts it (default 0 → up among
// the identity fields). React islands that want to read as native sections
// must (a) mount INTO this flex column and (b) set an explicit `order`.
//
// Sampled native section-header register, matched by the helpers below so the
// injected cards read as siblings of the real sections, not bolted-on widgets.
export const NATIVE_SECTION_HEADER_STYLE: Readonly<Record<string, string | number>> = {
  fontFamily: 'Georgia, serif',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.55)',
};

function ownText(el: Element): string {
  let s = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) s += n.textContent ?? '';
  }
  return norm(s);
}

// Find the flex-column section container in `root` that holds the most section
// headers matching any of `labels`. Robust against duplicate headers rendered
// by an empty/inert island elsewhere in the modal — we pick the column with
// the densest cluster of real native headers.
export function findSettingsFlexColumn(root: Element, labels: RegExp[]): HTMLElement | null {
  const hits: Element[] = [];
  for (const el of Array.from(root.querySelectorAll('div,span,label,h3,h4'))) {
    const t = ownText(el);
    if (t && labels.some((re) => re.test(t))) hits.push(el);
  }
  const tally = new Map<HTMLElement, number>();
  for (const h of hits) {
    let n: HTMLElement | null = h.parentElement;
    for (let i = 0; i < 6 && n; i++) {
      let cs: CSSStyleDeclaration | null = null;
      try { cs = getComputedStyle(n); } catch { /* */ }
      if (cs && cs.display === 'flex' && cs.flexDirection === 'column' && n.childElementCount >= 4) {
        tally.set(n, (tally.get(n) ?? 0) + 1);
        break;
      }
      n = n.parentElement;
    }
  }
  let best: HTMLElement | null = null;
  let bestN = 0;
  tally.forEach((v, k) => { if (v > bestN) { bestN = v; best = k; } });
  return best;
}

// Locate the top-level section block for `headerRe` in a BLOCK-FLOW subtab
// (e.g. Layout, which lays sections out in normal document order rather than
// the order-based flex column Personal uses). Climb from the header element
// until the candidate has a LATER sibling that contains `nextHeaderRe` (the
// following native section) — that proves the candidate is itself a top-level
// section block sitting beside its neighbours, so inserting immediately after
// it lands an island between the two sections. Returns null if the structure
// doesn't match (caller should fall back to a coarser anchor).
export function findSectionBlockBeforeNext(
  root: Element,
  headerRe: RegExp,
  nextHeaderRe: RegExp,
): HTMLElement | null {
  let hdr: Element | null = null;
  for (const el of Array.from(root.querySelectorAll('div,span,label,h3,h4'))) {
    if (headerRe.test(ownText(el))) { hdr = el; break; }
  }
  if (!hdr) return null;
  let node: Element = hdr;
  for (let i = 0; i < 8 && node.parentElement && node.parentElement !== root; i++) {
    const parent = node.parentElement;
    const sibs = Array.from(parent.children);
    const idx = sibs.indexOf(node);
    const followedByNext = sibs
      .slice(idx + 1)
      .some((s) => nextHeaderRe.test(norm(s.textContent)));
    if (followedByNext) return node as HTMLElement;
    node = parent;
  }
  return null;
}
