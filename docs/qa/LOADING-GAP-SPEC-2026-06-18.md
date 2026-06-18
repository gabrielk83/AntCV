# LOADING-GAP-001 — set-menu flashes, then the Loading cover returns (DOCUMENT — not fixed yet)

Owner 2026-06-18: "in the loading there is a second where the set menu pops and than
loading is back — if you can close this gap please do. **Document the bug — do not
resolve yet.**"

**Status: DIAGNOSIS ONLY. No code change.** Per the owner's instruction this is recorded
for a later, deliberate fix (it touches the boot cover timing, which is #185-/flash-sensitive
and has been re-tuned repeatedly — 1.50.165 → 1.50.603).

## Symptom

During login of a RETURNING user, the boot sequence visibly does:

```
[Loading… cover]  →  [set-menu / ACCOUNT MODE card visible ~1s]  →  [Loading… cover AGAIN]  →  [editor]
```

i.e. the opaque "Loading…" cover lifts **once too early**, the post-login set-menu (the
Account / ACCOUNT MODE card) shows for about a second, and then the cover (or a loading
state) reappears before the real editor settles. The expected behaviour is ONE continuous
cover from sign-in straight to the settled editor, with no set-menu flash in between.

## Where the cover lives

There is exactly ONE boot cover: `pwa/antcv-login-loading-gate.js` (loaded in
`pwa/index.html:41`, BEFORE app.js). There is **no** separate index.html cover element — the
sign-in screen and the set-menu are rendered by app.js itself. So the "gap" is NOT a
two-cover handoff seam; it is the single cover **lifting and the app.js post-login render
cascade still being mid-flight underneath it.**

## Why the cover lifts too early (candidate mechanism)

The lift condition is in `poll()` (`antcv-login-loading-gate.js:292`):

```js
if ((settled && elapsed >= MIN_MS && warmupDone && !modeCardVisible()) || elapsed >= MAX_MS)
```

- `editorReady()` (~287) goes true as soon as the editor DOM exists — but the editor DOM can
  be present BEHIND the set-menu during app.js's post-login navigation cascade
  (sign-in → SignLogin → set-menu/ACCOUNT-MODE resolve → preview). "Editor in the DOM" is not
  the same as "navigation has landed on the editor."
- `modeCardVisible()` (~125-140) is a **single-frame** text probe for the "ACCOUNT MODE"
  heading. During the cascade the card mounts → unmounts → (sometimes) re-mounts as the user
  mode resolves and the demo/paid state settles. There is a window where the card is momentarily
  ABSENT (between un-mount and the next render) — in that single frame `modeCardVisible()`
  returns false, all the other gates (`settled`, `elapsed >= MIN_MS`, `warmupDone`) are already
  satisfied, so the cover lifts. Then app.js's next render brings the set-menu / account card
  (or app.js's OWN loading spinner) back = "loading is back."
- Once `hideOverlay()` runs it sets `ticking = false` and `overlay = null` and removes the
  element (~219-230). This sidecar **cannot** re-show the cover afterwards, so the second
  "Loading" the owner sees is either (a) app.js's own post-login loading/sync state, or (b) the
  cover's 320ms fade-out tail overlapping the set-menu flash. Either way the root is the same:
  the lift fired during a transient `!modeCardVisible()` frame instead of on a STABLE
  "navigation settled on the editor" signal.

This is the same class of bug the existing comments already fight: the `!modeCardVisible()`
gate was ADDED (1.50.602/603, commit "login gate: hold cover until the ACCOUNT MODE card is
gone") precisely because the cover lifted over the set-menu — but a single-frame absence check
is not debounced, so a transient gap in the card's render still slips through.

## Fix direction (when greenlit — DO NOT code yet)

Replace the single-frame `!modeCardVisible()` gate with a **debounced "post-login navigation
settled" signal**, so the cover only lifts after the editor route is stably active:

1. **Debounce the card-gone check.** Require `!modeCardVisible()` to hold for K consecutive
   polls (e.g. 3 × 120ms ≈ 360ms) before it counts — so a one-frame un-mount/re-mount gap in
   the ACCOUNT MODE card does not trip the lift. Mirror the `SETTLE_BUFFER` pattern already
   used for `editorReady`.
2. **Gate on the real editor route, not just editor DOM.** Add a positive "preview is the
   active view" check (e.g. the live `.antcv-preview-paper` is visible AND the set-menu /
   account container is detached) instead of inferring it from the absence of one heading.
   Prefer reading an app.js post-login "ready" signal if one is exposed (grep app.src.js for
   the post-login navigation that lands on the editor — `qt("upload")` / the subscribe
   fresh-login branch) rather than DOM-probing.
3. **Keep the cover opaque across the WHOLE cascade.** The cover must not lift until BOTH
   (a) the editor is the active route and (b) the ACCOUNT MODE card has been gone for the
   debounce window. Until then, hold (bounded by `MAX_MS`, the existing hard backstop, so it
   can never get stuck).

### Risk / guardrails
- `MAX_MS` (the hard timeout) MUST remain as the unconditional backstop — the cover can never
  get permanently stuck if a signal never fires.
- Do NOT re-introduce the removed Settings warm-up (note at ~250-256: it raced app.js's
  post-login navigation and left the set-menu visible — the SAME failure family as this bug).
- The cover-timing constants (`MIN_MS=3200`, `SETTLE_BUFFER=500`, `MAX_MS`) have been tuned by
  the owner against real-device perception; treat changes as owner-gated and verify on a real
  login, not just headless boot-smoke (the cascade timing differs headless).

## Verification (for the eventual fix)
- Real returning-user login (owner-gated): the cover stays opaque continuously from sign-in to
  the settled editor; the set-menu / ACCOUNT MODE card is NEVER visible between the two.
- Confirm no regression to the "demo select stuck on loading" failure (the warm-up removal it
  caused) and no #185 / flash on first paint.
- Confirm the cover still lifts (MAX_MS backstop) if app.js never reaches the editor (e.g. a
  failed cloud sync) — it must not trap the user behind a permanent cover.
