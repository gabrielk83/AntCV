# Session Log — 2026-07-22 (Ibsen header + per-element colour package)

Desktop session (Opus 4.8), owner live at the deployed build. From the Ibsen 1017
CV/CL reference: a multi-part header/colour overhaul + the contact-collapse bug.
Every item diagnosed → fixed → pushed → verified (live DOM measurement and/or a
render-verified DOCX diag). Bug tracker + FEATURES_REGISTRY (37) updated so nightly
does not re-pick.

## Shipped (PWA `1.51.2201` → `2981`, docx-worker deployed)
- **CL-NO-PHOTO-001** (`2201` preview sidecar + docx-worker) — no candidate headshot on the cover letter; signature kept. Verified: band photo `display:none` on CL, CV unaffected.
- **CL-SPEC-CENTER-001** (`2561`) — CL specialisation line was left-aligned; centred (CL-gated so a left CV spec list is unaffected). Verified computed `text-align:center`.
- **HEADER-ELEM-COLORS-001** (`2201`+) — engine: per-element brand colours (name white / spec accent / contact white / slogan sloganColor / application gray) from `antcv:headerElemColors` override, else brandV2 slots. Per-app, dormant when unbranded. Element selectors + brandV2 mapping in memory `header-elem-colors-system`.
- **HEADER-COLOR-CONTROLS-001** (`2781`→`2961`) — a colour swatch + ↺ reset in each candidate/slogan/application control. Plain solid swatch (shows the element's actual colour; no rainbow). The swatch IS the native `<input type=color>` (a hidden-input `.click()` was Chrome-blocked → the picker "did not open"). Verified: swatches inject, drive the band colour, React events intact.
- **BRAND-RESET-001** (`2821`) — ↺ reset beside the rich-block editor's lead text + underline colour pickers (`antcv-rich-block-editor.js`); clears `leadColor`/`leadUnderlineColor` → brand accent.
- **APPLINE-RULE-001** (`2861`) — rule under the V5 application line; `antcv-appline-rule.js` renders a border + a compact control (toggle · thickness 0.75/1.5/2.25pt · colour · reset); store `antcv:applineRule`.
- **EXPORT-HEADER-COLORS-001** (`2981`, client + docx-worker deploy) — DOCX 1:1 parity. Client fetch-guard patches the `/generate` payload with the engine's per-element colours + `app_line_color` + `app_line_rule`. Worker: the app-line takes its own colour (gray, not slogan) + renders the rule. **Render-verified 5/5** in the generated DOCX XML (`workers/docx-worker/test/diag-header-elem-colors-parity.mjs`): name FFFFFF, spec D97706, slogan 1F3A5F, application 595959, rule D97706 @ 1.5pt (sz 12).

## The hard one — QUICK-CONTACT-SCOPE-001 (`2701`)
"Pressing on the contact makes the entire candidate panel collapse." Two wrong
guesses first (`2501` same-loc-drop guard, `2621` no-move-expand) — both harmless
no-ops on the drag path, left in place. A live delegated logger proved the failing
click was a plain **231ms tap, drag never armed** — so NOT the pointer path. Real
cause: `antcv-quick-contact-collapse.js` (a Settings→Personal collapser with a
GLOBAL body observer) mis-matched the SECTION-EDITOR panel via `findColumn()` when
the Contact editor rendered contact inputs, and hid the whole Name/Spec/Contact list
(`display:none`; the hidden node carried the sidecar's own `data-antcv-quick-contact-row`).
Fix = scope guard: bail if the matched column has `[data-candidate-key]` or lives
inside the editor side/bottom panel. Verified live: click → rows stay + editor opens.

## Constraints observed
- Browser pane compositing was intermittent (no screenshots at times) → verified via
  DOM measurement + `AntcvHeaderColors.set` chains + the DOCX render diag.
- Owner ran the reproductions for the contact bug (the 231ms log cracked it).
- All app.js edits mirrored src↔minified; cache-bust quintets per version; shift
  lanes claimed/released each ship (heavy parallel-session version churn).

See ACTIVE_BUGS.md top entry, FEATURES_REGISTRY (37), plan
`docs/plan/IBSEN_HEADER_BRAND_CONTROLS.md`, memory `header-elem-colors-system`.
