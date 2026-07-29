# Nightly Band F — live-browser verification (deployed PWA)

Added 2026-07-10 after a working proof-of-concept on production 1.51.261. This band drives the
**live deployed app** (`https://antcv.pages.dev`) in a real browser so the owner-verify items that
were permanently blocked as "needs a live browser" get an actual verified/failed result each run.
It complements — does not replace — the headless suite (`node scripts/run-tests.mjs pwa`) and
boot-smoke.

## Surface + operational rules (learned the hard way — obey these)

- Use the **in-app Browser pane** (`mcp__Claude_Browser__*`). Claude-in-Chrome froze in a prior run.
- **Do NOT rely on screenshots** — they time out. Drive via `read_page` (accessibility tree),
  `javascript_tool` (evaluate in page), `read_console_messages`, `read_network_requests`.
- **NEVER navigate with `?hardReset=1`** — it wipes local state.
- Confirm the running build before testing: `window.ANTCV_VERSION`, and fetch the loaded
  `app.js?v=...` in-page and grep for the markers of whatever you're verifying (proves the deploy
  carries the code, independent of git).
- Memory: `live-verify-browser-pane`.

## Auth (the blocker — solved WITHOUT a password)

Claude cannot enter passwords or complete Google OAuth (hard rule), and cannot read the email inbox
for a login code. So do NOT attempt the login UI in an unattended run. Instead:

1. **Preferred — self-renewing nightly token.** Commit `f0422ad` shipped a self-renewing CLI/nightly
   token (`~/.antcv/token`). Inject it into the Browser pane's `localStorage`/cookie to bootstrap an
   authenticated session with no email code and no password. (Wire-up TODO: confirm the relay's
   token→browser-session bootstrap.)
2. **Fallback — capture-once, reuse.** Owner logs in once by hand in the Browser pane; capture the
   resulting session token from `localStorage`, persist it, re-inject on later runs.
3. **No-auth path.** Many UI/behavioral checks run in the app's local/demo fall-through state with no
   login at all (the modal check below did). Use this whenever the test doesn't need the cloud account.

Cloud-account tests (saved-apps, cross-device, kernel sync) require path 1 or 2; pure UI/behavioral
tests use path 3.

## Verification checklist (per run)

1. **Deploy integrity** — `window.ANTCV_VERSION` == expected; in-page `fetch` of the live `app.js`
   contains the code markers for the fixes that shipped since the last run. (Catches a stale-SW /
   cache-bust regression masking a real deploy.)
2. **Language-switch modal (no ghost-flash)** — arm a `#antcv-choice3` MutationObserver into a window
   global; open Output language → pick a language; assert the modal OPENs and does NOT CLOSE within
   ~300ms (it must wait for a real click); click "Translate now"; assert `localStorage.language`
   changed and the modal dismissed. (Regression guard for LANG-MODAL-GHOST-TAP-001 / MOB-006.)
3. **Settings-panel stability** — open ⚙; over ~8s assert no mutation storm / 0 page errors (the
   live analogue of `diag-personal-panel-probe`).
4. **Translation coverage (walker)** — with a generated CV loaded, switch to zh; assert a `rich_block`
   section (HOW I WOULD CONTRIBUTE) and a role's `成果:` line render in the target language, and the
   header name localizes (柯葛顺·加百列·亚历山大). Needs a gen (3-6 min) — budget it, run it less often
   than 1-3.
5. **Export sanity** — trigger an export; watch the docx-worker `/generate` network call succeed
   (`read_network_requests`), status 200, non-trivial body.

Report per item with console/network evidence (not screenshots). A failing item becomes a register row.

## Where it slots in the nightly

Runs after the headless suite + standing sweeps (Band E), as a new **Band F**. Deploy-integrity +
modal + settings (items 1-3) are cheap and run every night; translation + export (items 4-5) are
gen-gated and run when a relevant change shipped or on a cadence. It directly unblocks the standing
owner-verify list (language switch, settings, MOB-006/008, export eyeballing).

## Proof-of-concept result (2026-07-10, production 1.51.261-byok-brave)

- Deploy integrity: PASS — live `app.js` carried `modalArm`/`richBlock`/`results` markers.
- Modal: PASS — probe recorded OPEN@65207ms, CLOSE@94613ms (stayed open ~29s until the real click);
  `language → "da"` on confirm; no auto-write on open.
