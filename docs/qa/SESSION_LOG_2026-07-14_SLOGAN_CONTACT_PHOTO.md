# Session log — 2026-07-14 — slogan controls + inline edit + contact + photo

Long interactive session (owner live-driving in the in-app Browser pane), parallel to the
cloud's CJLR-alignment thread (`SESSION_LOG_2026-07-14_CJLR.md`). All PWA-only (auto-deploys
from `main`). Heavy origin churn from the parallel session — rebased forward repeatedly,
resolved minified-`app.js`/version-file conflicts by taking the higher version + folding the
previous TARGET into STALE.

## Shipped + live-verified

### Publications / patents inline edit — 1.51.944 (PUBS-RICH-INLINE-EDIT-001)
- The pubs `list_italic` render was plain (not click-to-edit); rev3 made it **always-on
  ref-managed contentEditable innerHTML** (kept bold/italic), onBlur direct-writes to
  `sections.cv/cl` + `personalInfo.publications` + dispatches sections-updated.

### Contact line — 1.51.822 / 1.51.1024 / 1.51.1044
- Drop the `•` separator when per-item emoji glyphs are present; envelope icon for email;
  em/en-space separators; edge padding tightened; font +0.5pt; **CV/CL parity** (same size).
- Worker CONTACT-CONVERGE-001 (docx-worker 1.51.1044): 2-nbsp separator so the DK contact
  line converges to one line in export.

### Inline-edit stability — 1.51.1064 (EDIT-COMMIT-LAG-001)
- Results/text edits no longer revert on blur: the ref-managed editables now skip the
  clobber when NOT focused + model unchanged + DOM diverged (that's the uncommitted edit).
- Specialisation line gained spellcheck (ref-managed contentEditable, onBlur writes
  `personalInfo.specialization` + subtitle).

### Spell overlay — 1.51.1104 / 1.51.1124 / 1.51.1164
- SPELL-BLIP-NUDGE-001: a net-zero 1px scroll nudge after a typing pause near a page fold
  stops the red-underline blip (reproduces the owner's "tap the roller" remedy).
- SPELL-APPLY-COMMIT-001: a native `insertReplacementText` correction commits immediately
  (blur→refocus) instead of only on manual blur.
- **SPELL-APPLY-STANDALONE-001 (1.51.1164):** the correction popover only edited the
  `sections` store, so it silently no-opped on the slogan / specialisation / application
  line (standalone stores). Added `applyStandaloneFix`: for a no-`data-sid` contentEditable
  it pokes the live text node then fires the element's own onBlur → persists to its own
  store. Section words still route through `applyFix`. **Owner-confirmed working.**

### Slogan controls — 1.51.1144 / 1.51.1164 / 1.51.1204
- **Enhance** (LLM rewrite, 4-8 words, undoable) + **Fit-it** (client word-cap). The app
  exposes its LLM primitives on `window` via a one-line `__antcvExposeSloganOps`; the logic
  lives in the isolated `antcv-cl-slogan-element.js` (keeps the hot app.js edit tiny).
  **Owner-confirmed: Enhance works.**
- **Fit-it double-cap fix (1.51.1164):** `sloganCurrentText()` was pre-capping, so Fit
  re-capped an already-capped string → no-op. Cap now lives only in `sloganFit`. **Confirmed.**
- **CJLR single cycler (1.51.1164):** merged the 4 Left/Center/Right/Justify buttons into
  one button that shows the current alignment and cycles L→C→R→J; both slogan renders accept
  `justify` now (were snapping back to center).
- **SLOGAN-CJLR-RERENDER-001 (1.51.1204) — the real "CJLR doesn't change in preview" fix.**
  The `antcv:sections-updated` handler (STORM-IDEMPOTENT-002) only pushes to React state when
  the `sections` JSON signature differs from the last applied — but an align change touches
  ONLY `localStorage['antcv:clSloganAlign']`, so the signature matched → early return → no
  re-render → new textAlign never showed. Fix: `__slogForce` = event reason matches
  `/slogan|standalone|signoff|signature/i` → bypass the sig-equality early-return → one
  `ao()` re-render re-reads the align key. **REUSABLE GOTCHA:** any control mutating only
  localStorage (not sections/meta) that relies on sections-updated to repaint is suppressed
  by this guard unless its event reason matches the force-regex.

### Header photo — 1.51.1244 (PHOTO-NUDGE-UP-001)
- Owner: "the figure dropped down a bit." The header-CJLR preview bridge (1.51.1184) wrapped
  the headline in a spacing DIV, growing the navy band; the seam-centred medallion rode down.
- Fix (band-overlap render), tuned live to **−99.5 / 30** on the reference app: marginTop
  pull-up +13.5px raises the medallion so its midline sits ~9px above the navy/sidebar seam;
  marginBottom ref −11px pulls the sidebar text up with it (equal-ish air, fewer runts jumping
  page 1↔2). marginBottom stays band-height-aware (`round(bandH − i/2) − 11`).
- **Verified live:** sidebar bg reaches every page bottom (`gapToPageBottom = 0` on all 3
  pages → NO white gap), pagination stable at 3 pages, no scattered splitters (salmon sane).

## Method note
Live tuning done in the in-app Browser pane via `javascript_tool` (ephemeral DOM writes,
non-persisted) — measured air-above/air-below, sidebar fill, and pagination for each
candidate before hardcoding. The flow coupling that matters: `marginTop` moves photo+text
together (changes air ABOVE only); `marginBottom` moves text only (changes air BELOW only).

## Open issues → see ACTIVE_BUGS.md (this entry) + memory `slogan-readiness-plan.md`.
Slogan: language gate (branded==non-branded parity), worker slogan colour (teal→brand, needs
docx-worker deploy — cloud owns worker lane), brand-decides-via-research, Anita demo. Header
seam line (#0b) still TODO. CJLR/Fit/apply owner-verifying live.
