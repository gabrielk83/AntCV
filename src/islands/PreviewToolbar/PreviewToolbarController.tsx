import { useEffect } from 'react';

// Renders nothing visible. Owns the responsive show/hide of the preview's
// core-action bar and the FAB dedupe — the behaviour that lived in
// applyPreviewActions() in pwa/antcv-stability-core-334.js (lines 260-284).
//
// The actual toolbar buttons are rendered by pwa/app.js's existing React
// tree; we don't replace them. What this component does replace is the
// imperative MutationObserver-on-documentElement + setTimeout flood that
// kept reapplying the visibility rules.
//
// §7 Pass 1 step 2: "<PreviewToolbar /> mounted once. No post-render injection."
// In our case the canonical mount is a single React effect that owns the
// resize listener and one scoped MutationObserver on the preview pane.
//
// v1.50.56 fixes (mobile FAB cleanup):
//   1. BREAKPOINT 760 -> 900. Devices at 761-899px (e.g. the 840px test
//      device) were treated as desktop, so the mobile dedupe never ran and
//      the floating JD / Fusion / Privacy FABs stayed visible. 900 matches
//      antcv-mobile-controls.css and the app.js desktop-flag breakpoint.
//   2. The mobile FABs are NOT .antcv-fab — app.js renders them as plain
//      round <button title="JD Analysis" | "Fuse CV/CL" | "Privacy Status">.
//      isActionFab() now matches by title/aria-label/attributes too, and the
//      sweep query collects those plain FABs as well as .antcv-fab ones.
//      On mobile they are hidden (the in-bar actions replace them).

const BREAKPOINT = 900;

function label(el: Element): string {
  return [
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('title') ?? '',
    el.textContent ?? '',
  ].join(' ');
}

// Recognises the three redundant floating action buttons whether or not they
// carry the .antcv-fab class. The mobile build renders them as bare round
// buttons (title="JD Analysis" / "Fuse CV/CL" / "Privacy Status"); the
// desktop build uses button.antcv-fab with data-antcv-*-fab attributes.
function isActionFab(el: Element): boolean {
  if (el.tagName !== 'BUTTON') return false;
  // Guard FIRST: a privacy LED relocated into the top bar (topbar-tools-347
  // sets data-antcv-topbar-moved="1") must always stay visible in its new home.
  // This must run BEFORE the attribute matches below — otherwise the
  // data-antcv-privacy-led-fab branch short-circuits to true and the moved pill
  // gets hidden on mobile (the "privacy LED missing on mobile" bug: the mobile
  // branch of applyPreviewActions stamped it display:none/visibility:hidden).
  if (el.getAttribute('data-antcv-topbar-moved') === '1') return false;
  if (el.getAttribute('data-antcv-privacy-led-fab') === '1') return true;
  if (el.getAttribute('data-antcv-recheck-fab') === '1') return true;
  const txt = label(el);
  // Title/aria forms used by both desktop and the plain mobile FABs.
  if (/Analyze JD|JD analysis|Fuse CV\/CL|Fusion CL|Fuse|Privacy Status|Privacy/i.test(txt)) {
    return true;
  }
  return false;
}

function fabKey(el: Element): 'privacy' | 'fuse' | 'jd' {
  const txt = label(el);
  if (/privacy/i.test(txt)) return 'privacy';
  if (/fuse|fusion/i.test(txt)) return 'fuse';
  return 'jd';
}

// Collect candidate FABs: the classed .antcv-fab buttons (desktop) plus any
// plain buttons whose title/aria marks them as the JD / Fuse / Privacy FAB
// (mobile). De-duplicated into a single list.
function collectFabs(): HTMLElement[] {
  const out = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>('button.antcv-fab').forEach((b) => out.add(b));
  document
    .querySelectorAll<HTMLElement>(
      'button[title="JD Analysis"],button[title="Fuse CV/CL"],button[title="Privacy Status"],' +
        'button[aria-label="JD analysis"],button[aria-label="Privacy status"],' +
        'button[data-antcv-recheck-fab="1"],button[data-antcv-privacy-led-fab="1"]',
    )
    .forEach((b) => out.add(b));
  return Array.from(out);
}

function applyPreviewActions(): void {
  const mobile = window.matchMedia(`(max-width:${BREAKPOINT}px)`).matches;
  const core = document.querySelector<HTMLElement>('.antcv-preview-core-actions');
  if (core) {
    if (mobile) {
      core.style.setProperty('display', 'flex', 'important');
      core.style.removeProperty('visibility');
      core.style.removeProperty('pointer-events');
    } else {
      core.style.setProperty('display', 'none', 'important');
      core.style.setProperty('visibility', 'hidden', 'important');
      core.style.setProperty('pointer-events', 'none', 'important');
    }
  }
  const seen: Record<string, boolean> = {};
  collectFabs().forEach((b) => {
    if (!isActionFab(b)) return;
    const key = fabKey(b);
    const keep = !seen[key];
    seen[key] = true;
    if (mobile || !keep) {
      b.style.setProperty('display', 'none', 'important');
      b.style.setProperty('visibility', 'hidden', 'important');
      b.style.setProperty('pointer-events', 'none', 'important');
    } else {
      b.style.removeProperty('display');
      b.style.removeProperty('visibility');
      b.style.removeProperty('pointer-events');
      b.style.removeProperty('opacity');
    }
  });
}

export function PreviewToolbarController(): JSX.Element | null {
  useEffect(() => {
    applyPreviewActions();

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { applyPreviewActions(); } catch (e) {
          console.warn('[PreviewToolbar] applyPreviewActions failed', e);
        }
      });
    };

    window.addEventListener('resize', schedule, { passive: true });

    // Scoped MutationObserver — watches ONLY <body> for new FABs/preview
    // containers being added. Pass 1 exit criterion: no observer on
    // document.documentElement. Filtering attribute mutations down to a
    // small allow-list keeps the callback cheap.
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-hidden', 'title', 'data-antcv-topbar-moved'],
    });

    return () => {
      window.removeEventListener('resize', schedule);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
