# ACTIVE_BUGS.md — edit instruction set (2026-06-16 reconciliation)

`ACTIVE_BUGS.md` is ~302KB → **desktop git only** (over the ~50KB inline ceiling). This file is the
verbatim instruction set for that desktop session; line numbers are as of sha `3e457aa`. Apply in
order; each edit is anchored on an exact existing string so it survives small line drift.

Backing inspection: `docs/plan/NIGHT_RUN_2026-06-16.md` (5 cluster verdicts),
`docs/plan/NIGHTLY_RUN_SHEET_2026-06-16.md` (Lane 0 = active queue), `GEN_DISPOSITION_2026-06-16.md`,
`SETTINGS_VISUAL_PKG_SPEC_2026-06-16.md`, `AntCV_old_open_reconciled_2026-06-16.md`.

Goal: make the tracker reflect what's actually shipped/closed/relocated, so the buried OPEN lines
stop contradicting the "already shipped" block and the old-open cluster IDs carry correct status.

---

## 1. GEN cluster (already covered in GEN_DISPOSITION — restated here for one pass)

Anchor line 2765–2766:
```
- **GEN-001b** — [ ] (High, §14.2) Kernel generation leaves major CV sections empty/underfilled; add unsolicited fallback + warnings.
- **GEN-002b** — [ ] (High, §14.2) CL generation drops What I Bring table signals + Why This Position bullets.
```
- **GEN-002b** → DELETE this line; it is the SAME bug as CL-006. Fold its text into CL-006 (edit 3).
- **GEN-001b** → retag `[ ]` → `[RELOCATED → kernel-generation worker backlog]` and leave in place
  as a pointer (worker-prompt work, not a GEN ticket).
- Add, immediately above the first `GEN-001` gate line (search `**GEN-001**`): a one-line header
  `> GEN-001..011 are DoD parity GATES (Preview=DOCX=PDF, desktop=mobile) enforced per-fix — NOT`
  `> standalone tickets; do not count as open work.`

Buried stale-OPEN closures (the "already shipped" block at line 381 already lists these as shipped;
retag the buried lines to match):
- `HOWCONTRIBUTE-001` (buried `[OPEN]` ~line 2156) → `[FIXED 1.50.354 (bbf4d59)]`.
- `GEN-UNSOL-002` (buried `[OPEN]`/`[OPEN, needs live JD test]` ~lines 1825, 2149) →
  `[FIXED 1.50.358 (ea30b2f); follow-up GEN-UNSOL-003 @ 1.50.391]`.

## 2. Old-open cluster cross-reference block (NEW — append after the line-381 stale-shipped block)

Insert a new sub-block immediately AFTER the existing `**Still genuinely open (code):**` paragraph
(it ends the stale-shipped section ~line 392), titled exactly:

```
**Old-open reconciliation (2026-06-16) — cluster verdicts (see docs/plan/NIGHT_RUN_2026-06-16.md):**
- Watermark (WM-001/002/004/005 + AI-WATERMARK-EXPORT-LOCATION-001): SPEC COMPLETE, code pending —
  docs/qa/WM_AI_NOTICE_ANCHOR_SPEC_2026-06-16.md. WM-003 closed. One worker change (last-page VML).
- Settings/visual-package: VISUAL-PKG-002 + VISUAL-PKG-003 ALREADY SHIPPED in the islands bundle
  (decorateNativePackageButtons swatch+glyph; descriptor moot in context='layout'). PRIVACY-DEMO-001
  (1.50.356) + PRIVACY-SETTINGS-001 (1.50.81) closed. Safe subset = VISUAL-PKG-001 + MERGE-DUP-001/003,
  spec docs/qa/SETTINGS_VISUAL_PKG_SPEC_2026-06-16.md.
- Generation/content cluster DISSOLVES: 11 DoD gates + 2 shipped (above) + GEN-001b relocated +
  GEN-002b → CL-006.
- List-row controls (PP/SO/TB/move), Pagination remainder, Mobile, Candidate/application, CL
  body/overlay controls: OWNER-PRESENT, probe-first (live-rendered acceptance / high blast radius).
- Performance: PERF-003/004 shipped (1.50.359), RERENDER-STORM-001 + HIWC-RERENDER-LOOP-001 resolved;
  PERF-002/005 + PERF-001 owner-present.
- Dissolved/shipped: Photo (427), Preview-shell/nav-z (SETTINGS-NAV-Z @1.50.355), EXPORT-001 (worker
  1.14.66), IMPORT-COUNT-001 (1.50.143), WIZARD-002 (1.50.431), CL-HEADER-001 (p0d-fix7),
  APP-SENTENCE-STYLE-001 (verified 2026-06-11), DELETE-SAVE-001 (1.50.140), FEATURE-CONF-001 PARTIAL
  (confidence overlay @1.50.386).
```

## 3. CL-006 — absorb GEN-002b (anchor line 2723)

Replace:
```
- **CL-006** — [ ] Capture table data in CL generation.
```
with:
```
- **CL-006** — [ ] Capture table data in CL generation. The docx-worker already RENDERS WHAT I BRING;
  the gap is generate_cl (proxy) not EMITTING the table rows + WHY-THIS-POSITION bullets. Proxy
  prompt/schema change; mirror proxy→demo-proxy. ABSORBS GEN-002b. Gate: assert populated table
  rows in the generated CL payload (headless; no live render). [autonomous-viable]
```

## 4. CL-LAYOUT-002 — note the active CL-WIDTH-CAP-001 overlap (anchor line 2724)

Append to the CL-LAYOUT-002 line:
` — coordinate with the active CL-WIDTH-CAP-001 (item 25) + CL-PREVIEW-TABLE-WIDTH-001 (item 11);
worker width math + preview cap. [autonomous-viable: DOCX/PDF deterministic; owner PDF eyeball]`

## 5. VISUAL-PKG-001/002/003 status (anchor lines 2414–2416)

- 2414 `VISUAL-PKG-001`: append ` [autonomous-viable — but TWO-FILE: app.src.js relabel + widen the
  island STYLE_PACKAGE_RE same release, or the card orphans. Spec SETTINGS_VISUAL_PKG_SPEC_2026-06-16.md]`.
- 2415 `VISUAL-PKG-002`: prepend `[SHIPPED — islands decorateNativePackageButtons appends swatch
  strip + photo-shape glyph, observer-reapplied; owner live-verify then close] `.
- 2416 `VISUAL-PKG-003`: prepend `[SHIPPED/MOOT — descriptor renders only in unused context='personal'
  grid; deployed context='layout' buttons carry visual info inline; Custom note relocated onto the
  Custom button. Owner live-verify then close] `.
- `MERGE-DUP-001`: append ` [autonomous-viable — hide legacy <select> only (LanguageCard stray-hide
  pattern), KEEP the two legacy buttons, bridge to WritingStylePicker; probe the exact select node
  on live first]`. `MERGE-DUP-003`: append ` [autonomous-viable — tones→customs copy only, storage
  key unchanged]`. `MERGE-DUP-002`: append ` [owner-present — live dedup check]`.

## 6. Relay-pending — confirm tags are current (no change if already tagged)

Verify these three still read FIX SHIPPED + needs relay deploy/verify; the nightly run sheet Lane 2
will deploy + verify them:
- `KERNEL-CLOUD-PERSIST-001` (1.50.221), `APPHISTORY-SAME-LINE-001` (1.50.223),
  `KERNEL-STUCK-LAST-CMD-001` (1.50.220, retagged client-side React state — NOT relay-dependent).

## 7. CL-007 — investigate / cleanup (no detail line found in tracker)

`CL-007` appears in the reconciled cluster list but has NO definition line in ACTIVE_BUGS. Either it
is a stale alias (drop from the cluster tally) or its detail was lost. Action: confirm against
MASTER_BACKLOG; if no real content, mark `[STALE — no tracker detail; drop]`.

---

## What this set does NOT change
- No status flips for owner-verify/regen-gated items (the prompt-side CONTENT&EXPORT items, BAND-SEAM,
  SIDEBAR-OVERLAP, EXPORT-FALLBACK probe) — those stay OPEN until an owner regen/PDF/live check.
- No edits to the owner-ordered active queue priority (Content→Settings→Features stands).
- Net actionable-count change: Generation/content 15→0; Settings 12→3; old-open clusters annotated,
  not deleted. Update the tallies in `AntCV_old_open_reconciled_2026-06-16.md` to match.
