# AntCV session handoff — 2026-06-18 (PM, owner-directed)

Shipped `1.50.613 → 1.50.639` + access-relay deploys. All PWA changes are
sidecar / island / kernel-data, EXCEPT GPA-CHIP-001 which is a verified surgical
`app.js` minified mirror. One deployer at a time — a parallel session also
committed during the run.

---

## CLOSED (shipped + verified)

### Semantic constraints / data review
- **SEMANTIC-CONSTRAINTS-002** `[1.50.613]` — WritingStylePicker island reads/writes the kernel V2 shape `{trigger, avoid[], prefer[], reason, scope}`; canonical = `stylePrefs.semanticConstraintsV2`, flat-expanded `bannedContextual` feeds the prompt. Structured card editor. (Vite island, no app.js.)
- **REVIEW-DATA-001** `[1.50.618]` — "📋 Review my data" modal in `antcv-data-export-360.js` replaces plain download; single export = account-locked.
- **SIDEBAR-STRUCTURED-001 + headline variants** `[1.50.627]` — structured row editors (tools/education/certs/regulatory/additional, group-aware) + editable `headlines{}` in the modal.
- **WORK-HISTORY-EDIT-001** `[1.50.628]` — editable role cards (title/company/years/visibility/bullets/outcomes) in the modal; deep-clone preserves id/altTitles/mergeGroup/_visibilityNote.
- **REVIEW-MODAL-RESILIENT-001** `[1.50.639]` — modal appends EARLY + try/catch per build, removes stale modal, button alerts on throw (fix for "nothing happens").
- **ROBUST-ANCHOR-001** `[1.50.635]` — Review/Export buttons re-anchor 3 ways + danger-zone fallback so they never vanish from Account settings.

### Cloud / data integrity
- **SETTINGS-SYNC-EXTRA-001** `[1.50.629 + relay]` — photoPosition/photoSize/exportPwEnabled/enabledProviders/customTopbarPalette/topbarOrder now cloud-sync (relay allowlist + `antcv-settings-sync-extra.js` push/restore). Tests pass.
- **PHOTO-BINARY-NOT-IN-KERNEL-001** `[relay, deployed]` — enforces `store_binary_in_kernel:false`; a photo binary in personalInfo is routed to photo_b64, never the identity blob. Test 2/2.
- **V2-ANNEX-ROUNDTRIP + SETTINGS-SYNC tests** `[relay tests]` — full expanded kernel survives PUT→GET (30/30); 6 settings keys round-trip.

### Wizard / language
- **WIZARD-LANG-MATRIX-001 + WIZARD-SPELL-FOLLOW-SELECTED-001** `[1.50.631]` — wizard language slide: full 23-language catalogue, AVAILABLE alphabetical, scroll; spelling-variant rows follow SELECTED languages.

### Preview / sections / export
- **TOOLS-METHODS-LABELS-SHOW-001** `[1.50.633]` — tools/methods rows keep their bold "Label:" (reversed the 4-name trim).
- **PUB-CONTROL-DEDUP-001** `[1.50.634]` — one set of Publications row controls (native page/CJLR/enhance/compress glyphs hidden; pub273 host owns them).
- **EMDASH-HYPHEN-001** `[1.50.636]` — `antcv-emdash-to-hyphen.js` normalizes — / – → `-` in all CV/CL content (preview + export).
- **PAGE-BUTTON-AUTO-001** `[1.50.637]` — table row page buttons show the ACTUAL auto/salmon page (read autoPagesPreview/autoPages), not always 1.
- **GPA-CHIP-001 (preview half)** `[1.50.638 — app.src.js + app.js mirror]` — education GPA renders as its own editable bordered chip gated on `showGpa`. Backward-compatible.
- **SHOWCASE-BANNER-PERSIST-001** `[1.50.632]` — generation banner stays up until the editor DOM is quiet (2.5s) past result-commit.

### Kernel data (owner's Downloads — `gabriel-kernel-expanded-2026-06-18-v2.json`)
- 22 verb+position outcomes (numeric first); FVU = KVUC started 2025 ongoing; education GPA split + per-entry `showGpa`; Languages/Accessibility/Interests promoted top-level (`additional` emptied); all em dashes → hyphens; em dash added to `banned_words`.

### Documented (no code — owner-gated)
- **LOADING-LAMP-ICON-001** — lamp flashes over the ant in the last boot frame (SETTLE_BUFFER mask insufficient).
- **PREVIEW-STYLE-FIDELITY (G)** — figure position/shape on style switch (B+G selector half shipped 1.50.630; preview rounded-square/hexagon still open).
- **WIZARD-NO-SHOW-AFTER-DELETE-001 / SHOWCASE-BANNER-ENDS-EARLY-001** (latter shipped 632).

---

## OPEN (next session)

1. **VERIFY LIVE (owner):** Review-my-data modal opens now (639); tools labels (633); pub dedup (634); page buttons (637); em-dash (636); GPA chip after re-importing v2 kernel (638).
2. **#1 GPA editor remainder** — education EDITOR panel (`app.src.js` ~8578 + app.js mirror): a `gpa` input + an in-app `showGpa` toggle. Aliases for the education area: B→U, L(transform)→j, P→W, t→e, S→N, __sbInk→__sbI, p→u, C→L.
3. **#2 tools build-default** — owner chose "DEFAULT AT BUILD, user can override": when the CV is built/generated, default to the 3 most-JD-relevant items per group (up to 3 groups); a fully UNSOLICITED app shows ALL; manual show/hide wins afterward. Lives in the tools SEEDING (apply-to-profile / me()); needs default-vs-manual-hide tracking so a rebuild doesn't re-hide what the user manually showed.
4. **OUTCOMES show-all / no-caps for unsolicited** — `antcv-outcome-role-select.js` MIN_OUTCOMES=11 floor + MAX_PER_ROLE=2; preview clamp `Se(items,12)` (~22512/24990); export MAX=2/role (`antcv-docx-client.js` ~1754, already numeric-first). For unsolicited (no `antcv:lastJdText`): drop caps, show all; keep bullet→result de-dup. ALSO pre-fill the `[Verb]` input from the kernel `verb` field.
5. **#5-app em dash in OUTPUT** — the sidecar fixes section data; the generation PROMPT still has no dash rule (its examples use em dashes) and render separators (deg—sch ~6133, role title—company) are JSX literals the sidecar doesn't touch. Add a prompt rule + convert the render separators.
6. **ADDITIONAL EXPLOSION (app side)** — render Languages/Accessibility/Interests as TOP-LEVEL sidebar sections (Additional last), synced to the Sections panel + `me()` skeleton (the v2 kernel data is ready).
7. **WIZARD-NO-SHOW-AFTER-DELETE-001** — needs a live repro: after delete + re-login (no wizard), capture `prefs.wizardCompleted` from GET /api/prefs; then fix the delete/restore path (data-loss-sensitive).
8. **PREVIEW-STYLE-FIDELITY cluster** — A/C/D/F still documented-only; B preview rounded-square/hexagon reader still open.

---

## NEXT-SESSION PROMPT

> Continue the AntCV owner-directed batch. Read `docs/qa/SESSION_HANDOFF_2026-06-18-pm.md` and the memory `outcomes-verbs-and-unsolicited-spec` first. Tree should be clean and the parallel app.src.js session quiet — confirm before any app.src.js edit (one deployer at a time; surgical minified app.js edits mirrored to app.src.js, node --check both, parity grep). Owner re-imported `gabriel-kernel-expanded-2026-06-18-v2.json`.
>
> Do, in order: (1) Finish GPA chip — add a `gpa` input + `showGpa` toggle to the education EDITOR panel (app.src.js ~8578 + app.js mirror; aliases in the handoff). (2) Tools build-default — default the 3 most-JD-relevant items per group (≤3 groups) at build, ALL for unsolicited, manual show/hide wins after; in the tools seeding, tracking default-vs-manual hide. (3) Unsolicited = no outcome/bullet caps + pre-fill the `[Verb]` input from the kernel `verb`. (4) Generation OUTPUT em dash → hyphen (prompt rule + render separators). (5) Additional explosion app-side (top-level Languages/Accessibility/Interests sections).
>
> Each as a tight named bundle: bump `?v` + sw CACHE + version-override TARGET (+prev to STALE, never the current), verify, commit, push. Workers deploy via `gh workflow run deploy.yml`. Don't rush minified mirrors — they bluescreen; verify every one.
