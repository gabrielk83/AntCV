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

const BREAKPOINT = 760;

function label(el: Element): string {
  return [
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('title') ?? '',
    el.textContent ?? '',
  ].join(' ');
}

function isActionFab(el: Element): boolean {
  if (!el.matches?.('button.antcv-fab')) return false;
  const txt = label(el);
  if (/Analyze JD|JD analysis|Fusion CL|Fuse|Privacy/i.test(txt)) return true;
  if (el.getAttribute('data-antcv-privacy-led-fab') === '1') return true;
  if (el.getAttribute('data-antcv-recheck-fab') === '1') return true;
  return false;
}

function fabKey(el: Element): 'privacy' | 'fuse' | 'jd' {
  const txt = label(el);
  if (/privacy/i.test(txt)) return 'privacy';
  if (/fuse|fusion/i.test(txt)) return 'fuse';
  return 'jd';
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
  Array.from(document.querySelectorAll<HTMLElement>('button.antcv-fab')).forEach((b) => {
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
      attributeFilter: ['class', 'aria-hidden'],
    });

    return () => {
      window.removeEventListener('resize', schedule);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
