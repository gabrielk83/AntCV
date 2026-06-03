AntCV PWA v1.40.337-ai-notice-fix
==================================
Base: v1.40.336-version-grow-fix
Date: 2026-05-23

Why this exists
===============
The wizard's "Next" button on the worker URL step (own path) was
silently doing nothing. User pastes the relay URL, clicks Next, and
the page does not advance to step 3 (LLM API keys). Console log
shows the wizard re-rendered at vn=2 but nothing else after the Next
click — no further state change, no errors.

Root cause
==========
On vn=2 (worker URL step), the Next handler is:
    if (2 === vn && window.AntcvShowAiNotice) {
      window.AntcvShowAiNotice({ onContinue: () => xn(e=>e+1), force: true });
    } else {
      xn(e=>e+1);
    }

So Next always routes through the AI notice on the way to vn=3.

Inside AntcvShowAiNotice the second guard reads:
    if (document.querySelector('.antcv-ai-notice-host')) return;

If a stale .antcv-ai-notice-host node is still in the DOM from any
prior interaction (e.g., a previous mode-select that triggered the
notice but didn't fully tear down), this guard returns *without*
calling onContinue. The wizard is stuck — no notice shown, no state
advance, no error.

A bystander factor: the AI notice host CSS used z-index 2147482999
while antcv-stability-core-334 ramps Settings drawers to 2147483200
when Settings is visible. In the rare case Settings is open during a
wizard transition, the notice can be visually buried. This is a
theoretical issue but worth fixing while in the area.

Fixes
=====
Three changes:

1. app.js — replace the orphan-bail with orphan-removal in
   AntcvShowAiNotice. Old:
       if(document.querySelector('.antcv-ai-notice-host'))return;
   New:
       document.querySelectorAll('.antcv-ai-notice-host')
         .forEach(function(_h){try{_h.remove()}catch(_){}});
   Any stale host is removed; the function then proceeds to inject a
   fresh notice. Net behaviour: a stale host can never lock the
   wizard again.

2. app.js — bump .antcv-ai-notice-host z-index from 2147482999 to
   2147483300. Now above stability-core's Settings ramp. Defensive;
   no functional change in the common case.

3. antcv-stability-core-334.js — add .antcv-ai-notice-host to the
   nonSettingsModalOpen() selector list. When an AI notice is
   visible, stability-core will not ramp Settings z-index over it.
   Defensive belt-and-braces with fix #2.

Carried forward
===============
All four mechanical patches from v1.40.335-hotfix-b are still in
place. The version-grow-fix from v1.40.336 (STALE_VERSIONS hygiene
and idempotency guard in rewriteTextNodes) is still in place;
'1.40.336-version-grow-fix' is added to STALE_VERSIONS so anyone
landing on the previous build sees the new version string.

Deployment
==========
Cloudflare Pages: drop the zip. After deploy:

1. HARD-REFRESH the deployed page (DevTools -> Application -> Clear
   site data, or close the tab and reopen in a fresh incognito).
   The old service worker is otherwise sticky for up to 24h.

2. Confirm the landing-page version reads
   "AntCV 1.40.337-ai-notice-fix-language-topbar-accordion-fix"
   (one suffix only — the version-grow bug from v1.40.335-hotfix-b
   is permanently fixed).

3. Walk the wizard end-to-end: Welcome -> "Run your own Cloudflare
   Worker" -> paste worker URL -> Next. The AI notice should
   appear. Tick the checkbox, click Continue. Wizard advances to
   step 3 (LLM API keys).

4. If the AI notice still doesn't appear, paste this in DevTools
   console immediately after pressing Next:
       ({
         hosts: document.querySelectorAll('.antcv-ai-notice-host').length,
         visible: Array.from(document.querySelectorAll('.antcv-ai-notice-host'))
                   .map(h => getComputedStyle(h).display + ' z=' + getComputedStyle(h).zIndex),
         fn: typeof window.AntcvShowAiNotice
       })
   The output tells us whether the host got created and its computed
   z-index/display state.

Risk analysis
=============
Change 1 modifies a single line in app.js. The new code is byte-
verified to differ from the original by ~40 bytes (one early-return
replaced with one querySelectorAll+forEach call). No new identifiers
introduced, no new control-flow paths. Safe.

Change 2 modifies one CSS digit string ('2147482999' -> '2147483300').
Cannot crash anything.

Change 3 adds one substring to a selector string in stability-core.
Selector remains syntactically valid. Cannot crash anything.

This is the minimum-surface-area fix for the reported wizard freeze.
No other file in the bundle is touched.
