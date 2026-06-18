## OPEN — owner batch 2026-06-18 (PM, after 1.50.642) — full detail in `docs/qa/OWNER-BATCH-2026-06-18-PM2.md`

High-level-generation + structure bugs the owner reported after the 640-642 run.
Next-session prompt + per-item fix direction live in that doc. Summary:

- **TOOLS-METHODS-FIXIT-LOOP-001** `[OPEN — VERIFIED root cause]` — Fix-It/compress on the Tools & Methods grouped `labeled_list` spins endlessly and mangles content. `Pe()` references an undefined `items` instead of the local `n` at app.src.js **9850-9858** (labeled_list_item) and **9863-9868** (education_item), so the compress result is a no-op → the orphan-retry pass loops. Whole-section handler (9902-9910) is correct. Surgical fix mapped.
- **PUBLICATIONS-DUP-001** `[OPEN — owner's "core problem"]` — duplicate publication/patent rows. Sidecars dedup only CONTROLS, not DATA; the stored↔generated merge `l()` (~23758) keys on `trim().toLowerCase()` only, so a `<b>`-wrapped patent vs a plain copy (or whitespace drift) both survive. Fix = strip HTML + collapse whitespace in the dedup key for both sides.
- **WHO-I-AM-LABEL-DUP-001** `[OPEN]` — WHO I AM / WHY YOUR COMPANY render the label as the heading AND repeat it as a `LABEL:` prefix inside the paragraph. Keep one headline; strip the inline label (prompt rule + defensive render strip; NOT for `text_inline` working-style).
- **PHOTO-SHAPE-SQUARE-001** `[OPEN]` — a square upload renders as a circle; preview default radius `"50%"` (app.src.js ~41016) crops corners. The "square" selection (`stylePrefs.photoShape`, ~12849) isn't persisting/applying in preview. Related to PREVIEW-STYLE-FIDELITY (A)/(B).
- **SPEC-LINE-GONE-001** `[OPEN — regression to investigate]` — the unsolicited specialization line ("Processes • Products • People") is missing. NOT touched by 640-642 (subtitle path untouched). Likely empty stored `personalInfo.specialization` or empty generated `meta.subtitle`; pin the standing line + confirm render gate.
- **PROFILE-REWRITE-001** `[OPEN — owner-provided text, regen-gated]` — replace the canonical unsolicited PROFILE (app.src.js ~2783) with the owner's ChatGPT-refined text (in the batch doc).
- **TABLES-SAME-FOCUS-001** `[OPEN — prompt]` — CORE COMPETENCIES and WHAT I BRING must have DISJOINT Focus Area columns; add a no-overlap rule.
- **EMDASH render-separator half** `[OPEN — mapped]` — writer↔reader separator pairs (see `emdash-hyphen-three-layers` memory). Prompt (642) + content-sidecar (636) halves shipped.

### Shipped this run (1.50.640 → 642)
- **SELECT-DARK-DROPDOWN-001** `[640]` — `color-scheme:light` on form controls; native `<select>` dropdown no longer a black box on Windows dark mode.
- **GPA-EDITOR-001** `[641]` — education editor GPA input + 👁/🙈 `showGpa` toggle (completes the GPA-CHIP preview half from 638).
- **DASH-HYPHEN-001 (prompt half)** `[642]` — global PUNCTUATION-DASHES rule so the model emits only `-`, never `—`/`–`.

---

## CLOSED — 2026-06-18 session (autonomous nightly + owner-directed batches; 1.50.605 → 1.50.619 + docx-worker 1.14.77 + access-relay auth-26)

Authoritative current backlog is `docs/qa/NIGHTLY_HANDOFF_2026-06-18.md` (full detail per batch). Summary below. **OPEN ITEMS carried out of this session are listed at the very bottom of this CLOSED block.**

### Closed 1.50.610 → 1.50.619 + workers (owner-directed batches 2 & 3)

- **PREVIEW-RESULTS-EDITABLE-REFRESH-001** `[CLOSED 1.50.610]` — a 4th v2-shape reader, the preview override sidecar `antcv-results-laminate-510.js` (`lamFor`), derived Results from the bullet for v2 roles and overwrote React's correct value. Now reads `o.result` + flat `proofPoints`. Preview matches export.
- **CLOUD-LOAD-ITEMS-001 (deeper)** `[CLOSED 1.50.611]` — importer `DEDUP_KEYS` now UNIONS `semanticConstraintsV2` + `stylePrefs.bannedContextual` (were REPLACED → a small import shrank a large set → synced shrunk to cloud). Residual: KV-429 silent-local (needs live check).
- **SIDEBAR-BREATHING-001** `[CLOSED 1.50.612]` — idempotent equalize guard in `antcv-sidebar-fill-equalize-227.js` breaks the measure→write→ResizeObserver→scroll→re-render→equalize loop. Verified 0 style writes across 12 scrolls.
- **SUBTAB-ORDER** `[CLOSED 1.50.613]` — Settings STANDARD: Personal before Account.
- **PUB-CHAIN-001** `[EXPORT docx-worker 1.14.77 + PREVIEW 1.50.613]` — non-academic CV shows publication title+year only (drop journal/publisher chain); academic keeps full citation. Export (renderSimpleList) + preview (list_italic) gated on `writing_style !== research-formal`. Owner PDF/regen verify owed.
- **WATERMARK-SIDE-001** `[docx-worker 1.14.77 — owner PDF verify owed]` — AI notice picks the column whose LAST page has fewer paragraphs (lighter side) from the worker's own pagination, not the stale preview hint.
- **G-GROUPS-003** `[CLOSED 1.50.614]` — `antcv-sections-normalize-415.js` partitions a flat ADDITIONAL INFORMATION into Languages/Accessibility/Interests `{group}` blocks (idempotent, restore-proof). Verified flat→3 subheads.
- **PERSONAL-TAB-JANK-001 (PARTIAL)** `[1.50.615]` — neutralized the tense sidecar's 120-3000ms setTimeout flood. **OPEN remainder below.**
- **PRIVACY-TABLE** `[CLOSED 1.50.616]` — cover-letter Cloud ✘→✓; added "Writing style, banned words & semantic constraints" ✓/✓ row.
- **VERSION-OVERRIDE-CACHE-001** `[CLOSED 1.50.617]` — `antcv-version-override.js?v=` was FROZEN at 1.50.41 since v1.40.339 → the version LABEL stuck (HAR proved app.js was already 616). Bumped + the cache-bust routine is now a QUARTET (bump the version-label file's `?v=` every release).
- **ERROR-PERSIST-001** `[CLOSED 1.50.618]` — `antcv-diag-probes-370.js` persists captured errors to `localStorage` ring `antcv:errorLog` (survives the reset's console clear); `window.AntcvErrorLog()` to table.
- **#D PER-STYLE UNSOLICITED KERNELS** `[Phase A access-relay auth-26 DEPLOYED + Phase B 1.50.619]` — per-writing-style kernel slots (Substrate B): `/api/kernel-showcase?style=<slug>` → `kernel_showcase_styled` table; app save/restore stamp the active `stylePrefs.style`. **Styles no longer overwrite each other.** Phase C OPEN below.

### Resolved/clarified (no code or already-shipped)

- **#1 sign-in "stuck Loading" / sticky ACCOUNT MODE** `[RESOLVED — stale label, not a hang]` — HAR showed app.js@616 + `/config` 200; the frozen version-override label made it look stale. Fixed by VERSION-OVERRIDE-CACHE-001.
- **HARD-REFRESH "doesn't reset"** `[RESOLVED via 1.50.617]` — same root cause (unchanged `?v=` survived the browser HTTP cache).

### Closed 1.50.626 (owner-directed, tail of session)

- **TENSE-POPIN-002** `[CLOSED 1.50.626]` — owner: "the experience tense is loading before the languages and it just pops in and out during the personal tab opening — and it is anyway supposed to be under the languages menu — keep it hidden until languages is open and expanded." The LanguageCard island ALREADY hosts the EXPERIENCE TENSE control inside its expand/collapse (renders only when Languages is expanded). The standalone sidecar's 2800ms grace FALLBACK (1.50.615) still built a standalone card before the island mounted, which the island then removed = the pop-in/out. Fix: `antcv-tense-control-422.js` now NEVER builds the standalone card when the islands bundle script is present (grace timer is a no-op) — defers entirely to the island, so tense only shows under the expanded Languages menu.

### DOCUMENTED — design-only, owner said "do not code yet"

- **PREVIEW-STYLE-FIDELITY cluster** (owner 2026-06-18, post-reset batch) — `docs/qa/PREVIEW-STYLE-FIDELITY-2026-06-18.md` (NEW). Six items, A–D likely share one root (`body[data-package]` / `stylePrefs.*` not reaching the preview render after reset/switch): **(A)** square/rounded/soft-edge/shadow photo buttons don't apply in preview (pentagon works — it's a direct-DOM clip sidecar; the others depend on the React render re-reading localStorage, likely clobbered or not re-rendered); **(B)** per-package figure shape not wired into preview (Pampas should force rounded-square — `PKG_SHAPE` is export-only; preview `__photoFrame` has no package fallback, and rounded-square/hexagon aren't handled); **(C)** candidate band + table heads stuck navy for ALL styles (`body[data-package]` stuck on copenhagen-modern → `var(--header-bg)` never switches; regression exposed by PALETTE-RESET-BAND-001 Option C removing the only re-colourer — do NOT revert Option C, fix the data-package staleness); **(D)** Nordic Frost pale sidebar washes out pale sidebar headlines (verify rendered sidebar bg vs va `sidebarBg #1A3A4F`); **(E)** reset doesn't resolve the settings-photo issue (confirms A–C survive reset; the 1.50.625 dead-band fixed only the #185 crash); **(F)** Personality-kernel "Retake the quiz" card pops in then disappears — SAME mechanism as TENSE-POPIN-002 (`antcv-personality-quiz-439.js` `injectCard` appends a standalone card to the Personal column that the LanguageCard remount drops) — owner wants it relocated INSIDE the Advanced Tones collapsible (stability + relocation).
- **SALMON-NPAGE-001** (addendum 2026-06-18) — `docs/qa/SALMON-NPAGE-SPEC-2026-06-18.md` now records that the EXPORT-PREVIEW pager (`antcv-pdf-preview-gate.js` `countPages` + `renderPager`, the owner's `aria-label='Scroll to page N'` chips) is a THIRD passive reader of `.antcv-page-row` count — fed for free by the measurer fix, but must be covered by the page-count test (assert chip count + title == worker numPages).
- **LOADING-GAP-001** — `docs/qa/LOADING-GAP-SPEC-2026-06-18.md` (NEW). The boot "Loading…" cover lifts one beat too early during the app.js post-login render cascade: a single-frame `!modeCardVisible()` gap (ACCOUNT MODE card mid un-/re-mount) trips the lift, so the set-menu flashes then loading returns. Fix direction = debounce the card-gone check + gate on a stable "editor route active" signal (NOT coded — owner-gated, cover timing is #185/flash-sensitive).

- **LOADING-LAMP-ICON-001** (owner 2026-06-18) — during the LAST part of the boot "Loading…" cover, a small **lamp icon flashes on top of the ant icon** (the 76px `icons/icon-192.png`, `antcv-login-loading-gate.js:168`). Almost certainly the same artifact the existing `SETTLE_BUFFER` (`antcv-login-loading-gate.js:234`, 500ms — its comment literally says "the brief post-appear flash ('lamp for a microsecond') is masked") was added to hide, but the buffer isn't fully covering it. Candidate sources to check at the cover→editor handoff: the pre-login app.js loading screen (src ~3320) compositing its own icon over this cover's ant for a frame, or a second glyph/badge drawn over `icon-192`. Symptom only; root cause not yet pinned. **Document-only per owner** (cover timing is #185/flash-sensitive — same caution as LOADING-GAP-001).

### OPEN — carried out of the 2026-06-18 session (for the next run)

1. **#D Phase C** (NOT done) — auto-load the current style's kernel on writing-style switch (choice c) + an App-History selector (list / load-to-preview / copy-to-CHOSEN-style / delete). New stateful panel in app.src.js + app.js mirror + reuse the Switch load path (~37334). Architecture mapped (handoff). **Held back deliberately — large app.js UI, not for the tail of a long session.**
2. **PERSONAL-TAB-JANK-001 (remainder)** — the "large blue region → WRITING STYLE fills" cascade is the WritingStylePicker island's empty 220px placeholder + native→island swap + unmount-on-leave/re-createRoot-on-entry. Needs an islands rebuild (real skeleton + keep-Personal-mounted). Diagnosed.
3. **QUICK-ALTS SELECTOR PLACEMENT (#1b)** — owner: the quick-alts selector "not in the right place with its text" in Layout. Today the Layout card renders only `LayoutNotes` text (the native package cards own quick-alts). Awaiting owner confirm: add interactive alt1/alt2 buttons to that card, or leave as notes.
4. **SETTINGS-SCROLL-RESET trigger** — owner reports an auto-reset during settings scrolldown; now instrumented (`antcv:errorLog`) — needs the owner to run `window.AntcvErrorLog()` after it fires to pin the trigger.
5. **Owner verifies owed:** WATERMARK-SIDE (real PDF), PUB-CHAIN (regen + PDF), CLOUD-LOAD cross-device (does the full constraint set now round-trip?), KV-429 silent-local check.
6. **Pre-existing from earlier handoff (not addressed this session):** SALMON-3PAGE-001, CL-WIB-002 (worker parity), RESULTS-NUMERIC-001/RESULTS-ORPHAN-001/LAM-RESULTS prompt half (regen-gated), PUB-CHAIN academic-detection edge, SIDEBAR-NARROW-FIGURE-OVERLAP-001.
7. **PROCESS:** a PARALLEL session committed during this run (`SEMANTIC-CONSTRAINTS-002` + `REVIEW-DATA-001`, both colliding on version numbers). Keep ONE session/deployer at a time.
8. **WIZARD-NO-SHOW-AFTER-DELETE-001** (owner 2026-06-18, DOCUMENTED — needs a live repro before coding) — "I deleted a user, then entered again — I have no welcome wizard." The wizard is gated on `u.get("wizardCompleted") || u.get("wizardSkipped")` (`app.src.js` ~14861). Delete does `AntcvFullErase` + `localStorage.clear()` (~28035) + `DELETE /api/prefs` (relay full-wipes D1, where `kernel.preferences.wizardCompleted` lives), so after a clean delete local + cloud should BOTH be wizard-flag-free → wizard shows. The cloud-restore on re-login RE-SETS it: `"boolean"==typeof o.wizardCompleted && o.wizardCompleted && !local && (u.set("wizardCompleted",!0), yn(!1))` (~14504-14507, closes the wizard). **Root-cause hypothesis:** the cloud `wizardCompleted` SURVIVES the delete (DELETE didn't fully clear it, or it was re-saved to cloud during the delete→re-login window before the wizard could open), so the restore suppresses the wizard. `antcv-cloud-restore-filter-298.js` strips wizard flags ONLY on its post-delete branch — if a same-email re-login isn't detected as post-delete, the stale cloud flag rides back. Same family as the account-isolation/wizard-reopen work; **owner-gated — needs a live repro** (check the GET `/api/prefs` `prefs.wizardCompleted` right after a delete + re-login) before touching the delete/restore path (cloud-data-loss risk).
9. **SHOWCASE-BANNER-ENDS-EARLY-001** `[SHIPPED 1.50.632 — owner chose "until editor finishes rendering"]` — fixed by the NEW sidecar `antcv-showcase-banner-persist.js`: it mirrors the native banner and, when app.src.js removes it at result-commit, continues an identical clone until the editor's DOM is quiet for 2.5s (or a 60s cap), keeping the `antcv-banner-active` 52px offset. No app.src.js/app.js surgery. Original diagnosis: — owner: "for the entire time a kernel is in generation keep the purple/black status on, even after moving to the editor; right now it ends while there's still lots of activity on the editor." The `antcv-showcase-progress-banner` shows iff `Pl` = `kernelShowcaseInProgress` (`app.src.js` ~27575-27606, `useEffect [Pl]`). It is cleared the moment the showcase RESULT COMMITS — `io.company === "Unsolicited"` lands → `u.set("kernelShowcaseInProgress",!1)`, `Bl(!1)` (~15259-15282). The "lots of activity" AFTER that is the post-result EDITOR work (lamination / pagination / fit / render), which is NOT tracked by `kernelShowcaseInProgress`. **Fix direction (needs owner intent):** either (a) keep the banner up until the editor SETTLES (tie `Pl` to a broader "generating/settling" signal — there's already a `$t("generating")` status at ~22576 the banner could OR-in), or (b) keep it until a definite post-render idle. Define the exact end-point first; it touches the generation/showcase lifecycle (app.src.js + app.js mirror), so confirm before coding.

---

## CLOSED — nightly 2026-06-18 (autonomous run; 1.50.605 → 1.50.608)

Authoritative current backlog is `docs/qa/NIGHTLY_HANDOFF_2026-06-18.md`. This run:

- **LAM-RESULTS-001** `[EXPORT + OUTCOMES-PANEL CLOSED 1.50.605]` — v2 kernel role shape
  (outcomes `{title,result}`, flat `proofPoints[]`) wasn't read by the lamination
  (`antcv-docx-client.js applyOutcomesMode`), the preview fallback (`__lamOfL`), or the
  seeder (`antcv-outcome-role-select.js`) → wrong-role outcomes. All three now read v2.
  DOCX/PDF verified. **Open follow-up:** preview Results `contentEditable` span doesn't
  refresh after the (correct) computed value changes — `PREVIEW-RESULTS-EDITABLE-REFRESH-001`.
- **COPENHAGEN-OVERLAY-001** `[CLOSED 1.50.606]` (owner 2026-06-18) — native package picker
  now dispatches `antcv:package-changed` so `body[data-package]` follows the pick instead of
  defaulting to copenhagen-modern (band/sidebar were stuck Copenhagen over other styles).
- **CLOUD-LOAD-ITEMS-001** `[SAVE-SIDE CLOSED 1.50.607 — owner cross-device verify owed]`
  (owner 2026-06-18) — `writeWritingPrefs` + the data-importer now cloud-sync (were local-only).
  Worker round-trip was already lossless. If the lost field was typed in the semantic-rules
  editor (already synced), the residual cause is a KV-429 local-only write or import-side
  REPLACE — pending owner confirmation of the entry path.
- **ROLE-DECOMP-001** `[CORRECTED 1.50.608]` (owner clarified 2026-06-18) — SEPARATE is the
  DEFAULT (decompose); merge is a CONSIDERED, JD-driven conclusion reached FROM the separate
  roles, never an auto space-saver. Prompt had drifted to "most positions should merge" — fixed
  + test updated. Suite 312/312. Regen-gated for output.
- **REG-DEDUP-001** `[CLOSED 1.50.609]` (owner 2026-06-18) — `antcv-data-importer.js`
  `DEDUP_KEYS` now keys regulatory/tools/additional on the normalized CODE/group (not
  code+description), so a re-upload dedupes ASPICE×2 / ISO 26262×2 / MIL-STD-810G×3 to one
  each and strips stale hidden flags (grouped items default visible). Drives `mergePath` via
  `window.AntCVImporter`; `diag-reg-dedup.mjs` green. Residual: divergent-label group headers
  aren't auto-fused (clear+reupload). **Also resolves G-GROUPS-001/002** (ingestion, not render).
- **G-GROUPS-001/002** `[RESOLVED VIA REG-DEDUP-001 / 1.50.609 — re-upload]` — grouped items
  hidden + flat duplicates was an ingestion append-merge + stale-hidden problem, fixed at the
  source. A render-side dedup was rejected (would empty the section — see handoff).
- **EXPORT-PREVIEW-SHRINK-001** `[was already SHIPPED 1.50.604 — width-only fit]`.

---

## OPEN ISSUES — owner review 2026-06-15 (PRIORITISED BACKLOG for the next session)

Owner-set ordering (2026-06-15, revised): **work CONTENT & EXPORT issues first, then SETTINGS MODIFICATION, then NEW FEATURES.** Within each bucket the items are roughly priority-ordered. Each item has the verified root cause + fix location. Discipline: edit `pwa/app.src.js` → mirror minified `pwa/app.js` (names DIFFER — anchor on string literals, copy minified blocks verbatim; see [[minified-mirror-shadow-hazard]]); verify PAST the sign-in gate headlessly (boot-smoke is NOT enough); a fix counts only if it holds in Preview + DOCX/PDF, desktop + mobile; cache-bust trio; push to `main` only; worker = manual deploy (one deployer at a time).

### QUEUED FOR NIGHTLY — owner 2026-06-17

- **SPELL-FI-VOIKKO-001** `[QUEUED — nightly]` — add real Finnish spell-check via **Voikko** (Giellatekno/Voikko; Finnish is agglutinative so Hunspell can't do it, and there is no `dictionary-fi` on jsDelivr — confirmed 404). Ship a WASM build of libvoikko (or a Voikko-backed service endpoint) and wire it into `pwa/antcv-spell-annotator-384.js` as a per-language engine alternative to nspell for `fi`. UNTIL then: Finnish is selectable (generation + the AI context proofread work) and the Languages → Spelling row shows a **"Voikko soon"** badge (shipped 1.50.573; `SPELL_UI.fi.soon='Voikko'` in `src/islands/LanguageCard/LanguageCard.tsx`). On completion, drop the `soon` flag and set `fi` to a real dict/engine path. Investigate: libvoikko-wasm size/perf, IndexedDB caching like the Hunspell dicts, and whether a worker endpoint is cleaner than client WASM.

### A0-NIGHTLY. SHIPPED + NEW — nightly session 2026-06-15 (late: colour, lamination, JD-cloud, prompt)

**SHIPPED / CLOSED this session** (PWA auto-deploys on push; worker = manual deploy, done):

- **MAIN-HEADINGS-GREEN-001** `[SHIPPED 1.50.496 + docx-worker 1.14.72 — owner CONFIRMED "the colour issue is resolved"]` — main-column CV H1/H2 + CL body headings, horizontal rules, ROLE NAME, RESULTS + WORK STYLE inline labels, main bullets, and the profile-photo contour → greenish teal `#00746E`; candidate band + table header keep `#33446F`; role COMPANY (`#333333`) + YEAR (`#595959`) stay neutral; sidebar unchanged; Copenhagen-modern + scandinavian/default base only. Edited all 5 palette copies (app.src.js `va` + base, app.js mirror, worker palette.js + index.js bundle, packages/registry.json `head` token; CSS vars doc-only). `mainHeadColor = p.head || p.base`. See [[palette-token-copies]].
- **RESULTS-LAMINATION-002 → -003** `[SHIPPED 1.50.495 → 1.50.498]` — -002 (1.50.495) REMOVED derive-from-bullets after owner saw "the result is just a copy of the first role content bullet"; -003 (1.50.498) RESTORES derive as a RARE last resort (after tiers 1-4) that HIDES the source bullet (export drops it from `role.bullets`; preview sidecar hides the matching `[data-edit-path]`). PROVEN against the owner's real `AntCV_sections_corrected_..._outcome_edits.json`: every active role fills from tiers 1-4 (mostly `proofPointIds`), so derive never fires for his data. Supersedes RESULTS-LAMINATION-001 (now fully shipped, preview + export).
- **JD-CLOUD-VISIBILITY-001** `[SHIPPED 1.50.498]` — the JD mirror `antcv:lastJdText` (powers JD-aware per-role outcome visibility) is now cloud-aware: both cloud-restore paths mirror the restored `jd_text`, so JD-gated outcomes show cross-machine WITHOUT a regen. Unsolicited/general/manual rows clear it.
- **CV-CRITICAL-FIELDS-001 + SIRIN-SEMANTICS-001 + GEN-PROFILE-001-ENFORCE** `[SHIPPED 1.50.497 — NEEDS OWNER REGEN TO VERIFY]` — prompt hardening in `app.src.js` (+ app.js mirror): (a) a CV-side critical-field retry gate (empty `profile_content`/`work_style_content` → retry) to fix PROFILE / "Work style:" coming back empty; (b) Sirin = "supervised/directed a 7-person task force, NOT led/managed"; (c) unsolicited profile opening with electro-optics/optics/LiDAR is retried (open with "IT professional"). Output verification requires an owner regen (can't be checked headlessly).
- **TABLE-HEADER-MATCH-BAND-001** `[SHIPPED 1.50.486 earlier 2026-06-15]` — preview table header matches the candidate band.

**NEW OPEN BUGS — owner 2026-06-15 (late session; documented, NOT yet fixed):**

- **PDF-ASK-WHERE-TO-SAVE-001** — with the preview modal's "Ask where to save" checkbox TICKED (`<label id="antcv-pdf-preview-modal-savewhere">`, `antcv-pdf-preview-gate.js`), pressing a PDF download button does NOT prompt for a folder; only the DOCX path asks (once, on first use). Likely cause: the DOCX download uses the File System Access API (`showSaveFilePicker`) while the PDF path uses an anchor-download / print that ignores the checkbox. Fix: route the PDF save through `showSaveFilePicker` too when the checkbox is set (and persist the choice the same way DOCX does).
- **INTERESTS-CONTENT-001** — INTERESTS must be a LIST (type with topic + description, one row each) containing exactly: (1) Rugby — operations manager and assistant coach at Copenhagen Wolves RFC; (2) Hiking; (3) Tai-chi; (4) Reading; (5) Supervision of three feline napping experts. Source: owner's stored hobbies / `interests_items`. Tie to ADDITIONAL-INFO-SPLIT-001 (item 8).
- **ADDITIONAL-INFO-HIDE-WHEN-INTERESTS-001** — ADDITIONAL INFORMATION should be HIDDEN by default whenever INTERESTS is displayed (avoid duplicate hobbies). Pairs with ADDITIONAL-INFO-SPLIT-001 (item 8) + INTERESTS-CONTENT-001.
- **RESULTS-DOCX-MISSING-001** `[CLOSED — worker half NOT A BUG; verified nightly 2026-06-17]` — the worker render branch is UNCONDITIONAL per role: `renderExperience` emits a Results paragraph for every role whose `role.results` is a non-empty string (`workers/docx-worker/src/index.js` ~26336, inside the `roles.forEach`); no role-index/page gate. `test/diag-role-results-export.mjs` 5/5 (label present once, bold+italic, ordered after r0 bullet / before r1). The "not all positions" symptom is purely DATA-SIDE (a role arriving with empty `role.results` from the lamination/tightening pipeline) → tracked by RESULTS-TIGHTENING-STRIP-001 / RESULTS-LAMINATION distribution, regen-gated + owner-data-dependent. No worker change actionable.
- **RESULTS-PDF-INK-BLACK-001** `[CLOSED — ALREADY SHIPPED docx-worker 1.14.73 (commit f3050ae); verified nightly 2026-06-17]` — the per-role "Results: " label run already uses `style.mainHeadColor` (teal `#00746E`) at `workers/docx-worker/src/index.js` ~26348; the outcome text after the label is `style.mainTextColor` (neutral body ink) by design — matches MAIN-HEADINGS-GREEN-001. Not black. Backlog entry was stale.
- **AI-WATERMARK-EXPORT-LOCATION-001** `[SHIPPED docx-worker 1.14.75 (commit 1c3cc31); owner PDF eyeball owed]` — the AI notice is now a SENTINEL-anchored bottom-corner VML text frame placed at the END of the last page's content (`buildAiDisclosureHangingTextbox` + `postProcessDocx` swap), removing the flowed mid-page notice that disagreed with the preview. `test/diag-ai-notice-anchor.mjs` 13 checks. RESIDUAL: owner verify DOCX→PDF survivability through CloudConvert on CV 1/2/3-page + CL.
- **SECTION-TYPE-NORMALIZE-INLINE-001** `[SHIPPED 1.50.522 (commit 07e7310); verified]` — `inlineifyLabeledText` in `antcv-sections-normalize-415.js` promotes `work_style`/`who_i_am`/`why_company`/`why_role`/`why_position` (by id or title) from type `text` → `text_inline` on import so the bold inline label renders in the PREVIEW (export already did). Skips CL boilerplate. `diag-sections-normalize.mjs` asserts work_style + who_i_am become text_inline, greeting stays text.

### A0. RESOLVED / NEW — owner live session 2026-06-15 (admin PDF gate + generation findings)

- **RESULTS-LAMINATION-001** `[EXPORT half SHIPPED 1.50.491; preview render = next increment]` — owner: "role→result distribution is NOT random — every role should have a specific result laminated to it." Contract = the master profile (`AntCV_master_profile_gabriel`): each experience role carries `proofPointIds` linking it to its OWN proof points (+ `proofPointsByRole`/`proofPointsByPosition` id→text), and the worker already renders `role.results`. Fix (EXPORT, `antcv-docx-client.js applyOutcomesMode`): each role's Results line now comes from its OWN lamination — explicit `role.results` wins verbatim, else resolve `role.proofPointIds` against `personalInfo.proofPointsByRole` (top 2, capped). The heuristic SELECTED-OUTCOMES token-spread runs ONLY for roles with NEITHER (so spill no longer starves the tail). Verified `pwa/test/unit/results-lamination.test.mjs` 6/6 + suite 290/290; existing applyOutcomesMode parity still green. DEPENDS ON: import preserving `personalInfo.proofPointsByRole` (else use explicit `role.results`). NEXT: mirror into the PREVIEW experience render (`app.src.js`/`app.js`, ~5559) so preview matches export; confirm proofPointsByRole survives JSON import.

- **LLM-FALLBACK-MODEL-404-001 / FALLBACK-MODEL-001** `[SHIPPED — demo-proxy + proxy deployed 2026-06-15]` — owner live probe showed a forced gemini `consensus_poll` hard-failing: `[callLLM] task=consensus_poll provider=gemini failed (404): anthropic returned 404, model: gemini-2.5-flash`. Root cause in BOTH proxies' `handleWithProviderFallback` (`workers/*/src/index.js`): when the requested provider returns a 5xx / throws, it swaps `x-provider` to the next provider but kept the SAME `body.model` — so anthropic/openai/mistral (which have NO default model; only gemini defaults) receive the previous provider's model id and 404. A 404 (<500) returns immediately → a recoverable primary-provider 5xx becomes a hard failure (and degraded generations / placeholder leaks downstream). Fix: on fallback attempts (i>0) to a DIFFERENT provider, rewrite `body.model` to `PROVIDER_MODELS[provider][0]` (drop stale content-length + x-gemini-model). PRIMARY attempt (i===0) byte-for-byte unchanged → normal generations unaffected; blast radius is the already-broken fallback only. node --check + dry-run build clean; both workers deployed. Owner live-verify: regen → no `returned 404` fallback line.

- **EXPORT-FALLBACK-ON-FIRST-001** `[FIXED 1.50.487 — owner verify]` — ROOT CAUSE (live console probe + owner): the owner is the deployment ADMIN on the shared demo deployment (`B.demo_mode=true`). `__antcvUseServerPdf()` (`app.src.js` ~1362) granted server PDF only to non-demo deployments / demo-active users / own-CloudConvert-key users — NO admin bypass. So the admin (BYOK + own LLM key + no CC key) always fell to the client-print fallback (`kl()`→`buildHTMLDoc`). That is why ALL the owner's PDF exports bypassed the worker, and why every worker-side fix (brighter band, table-header=band, 0.14" margins, table dims) never reached the PDFs, and the fresh PDF still showed the band/table-header mismatch. The "demo badge flashes then disappears" = demo-treatment suppression resolving for the admin AFTER auth — but the PDF gate lacked that same exemption. FIX: `__antcvUseServerPdf()` now also returns true when `B.is_admin`. **Owner: hard-refresh, export a PDF, confirm the console shows `[pdf] server export ok` (not `server export failed, falling back to client print`).** Once confirmed, BAND-HEADER-BG-SEAM-001 + CL-TABLE-DIMS-FALLBACK-001 + the table-header/margins/band items should ALL be resolved on the PDF, because the PDF now renders via the worker.
- **CORE-COMP-RETRY-HANG-001** `[SHIPPED 1.50.489]` — the unsolicited subtitle ("(Processes • Products • People)") reverts to the template placeholder `[Specialisation — 1–3 focus areas, separated by •]` and the status tracker stalls for MINUTES before recovering. Console root cause: `antcv-kernel-completeness-290.js` throws `PartialResponse` to force a full provider RETRY whenever `cv_overrides.core_comp_rows` has `<4` data rows; the LLM returned 3, so it burned all 4 generate attempts (`[v23] Generate attempt 1/4 failed … KERNEL_INCOMPLETE: core_comp_rows (3 data rows, need >=4)`), each a full round-trip = the multi-minute hang + placeholder flash. Fix options: lower the floor to ≥3, OR cap the retry to 1 for a 1-row shortfall and pad the 4th row from the kernel, OR don't gate the WHOLE generation on a single short table. Sidecar (`antcv-kernel-completeness-290.js`, no app.js mirror). Verify headless.
- **RESULTS-TIGHTENING-STRIP-001** `[NEW — owner 2026-06-15]` — owner: "the last process (Tightening the length) removes the results from all roles apart from the first role"; the last two roles (R&D/Teaching Assistant, Computer Administrator) export with NO results, and Security Guard is missing entirely. The "🔎 Tightening to length targets…" pass (`app.src.js` ~24844-24918) builds its LLM payload from BULLETS ONLY (no `results`) and writes back `{...e, bullets: t.bullets||e.bullets}` (spreads `...e`, so it should PRESERVE `results`). So tightening isn't obviously deleting results — the loss is likely in the outcomes DISTRIBUTION timing/keying relative to tightening, OR the page="continuation" roles (index > 2) losing their per-role results. Needs a live before/after probe of role.results around the tightening pass + a regen. Also: the missing Security Guard role is a separate role-drop (dedupe/floor). Investigate together with the OUTCOMES-RESULTS coverage items (9, item 9 RESULTS-METRIC-SHARPNESS).

### A. CONTENT & EXPORT (do first)

1. **EXPORT-FALLBACK-ON-FIRST-001** (owner 2026-06-15) — after a HARD RESET, the FIRST "Export to PDF" opens the INLINE FALLBACK export (not the worker), and it shows the ANALYSIS PDF instead of the cover letter; a page refresh fixes it. **VERIFIED MECHANICS (2026-06-15 session):** the "⬇ PDF" handler (`app.src.js` ~46290) calls `window.exportPdfViaWorker` (server PDF, POST `/generate-pdf`); on ANY throw it `console.warn`s "[pdf] server export failed, falling back to client print" and calls `kl()` (~46330). `kl` → `Na()` = `buildHTMLDoc` (~25119), a from-scratch MSO-HTML builder that prints via `document.title` swap + window.print. So the "fallback" is `buildHTMLDoc`. Fix needs a LIVE console probe of WHY the first `exportPdfViaWorker` throws after reset (worker URL not yet on `window.ANTCV_DOCX_WORKER`? relay token unseeded? cold-start timeout?). Do NOT speculatively edit the export/fetch chain (protocol). A safe interim: retry the server PDF once before falling back, and on fallback surface a one-line notice so the user knows it degraded.

2. **CL-TABLE-DIMS-FALLBACK-001** (owner 2026-06-15, "CL export still does not consider changes to table dimensions") — **NOT a dims-forwarding bug.** Verified end-to-end this session: the column-ratio drag persists to `clTableRatio` via React `ia` (`app.src.js` ~16358) AND the fast-drag sidecar; the table-edge width drag persists to `personalInfo.stylePrefs.tableWidthPct['bring']` via `antcv-section-align.js`; `buildPayload`/`normalizeSections` (`antcv-docx-client.js` ~1361-1386, `_isClTable = s.id==='bring'`) forwards both `tableWidth` (DXA from the % map) + `tableRatio` (clTableRatio) for BOTH `exportDocxViaWorker` AND `exportPdfViaWorker`; the deployed docx-worker 1.14.67 (`renderCompetencyTable` ~26089-26104) honors `s.tableWidth`/`s.tableRatio` for the `isCl` branch. `readTableWidthPctMap` reads the exact key section-align writes. The bring section is `type:'table'`, `id:'bring'` (~3197). table-dims-forward.test 6/6 + worker XML check pass. **Root cause: the symptom is EXPORT-FALLBACK-ON-FIRST-001** — when the server PDF call fails and degrades to `kl`→`buildHTMLDoc`, that client HTML builder does NOT read `clTableRatio`/`tableWidthPct`, so the fallback PDF shows DEFAULT dims. Two real fixes (either resolves it): (1) stop the spurious first-export fallback (item 1 — needs the live probe), or (2) teach `buildHTMLDoc` (`Na`, ~25119) to read `clTableRatio` + `stylePrefs.tableWidthPct['bring']` for the WHAT-I-BRING table so the fallback respects them too (rendering-only change inside `Na`, NOT the fetch chain — surgical: find the bring/competency `<table>` build inside the `b` section-renderer and apply col widths from the ratio + an overall width % from the pct map). **UPDATE (nightly 2026-06-15): the diagnosis was PARTLY WRONG — `buildHTMLDoc`'s `case "table"` (~25236) ALREADY reads the column RATIO: `s = Math.round(r * (y?Qr:Xr))` where `Qr`=`clTableRatio`, `Xr`=`cvTableRatio` (`y`=CL). So the fallback already honours the column split. The ONLY residual gap is the OVERALL WIDTH: `r = y?385:346` (pt) is fixed and ignores `tableWidthPct[id]`. The fix is just `r *= (pct/100)` (pct from `personalInfo.stylePrefs.tableWidthPct[e.id]`, default 100 = unchanged; the 385pt default corresponds to the worker's 100%=9602 DXA base). NOT done this session: `Na` is an internal HTML-string builder not exposed on `window`, so a width change can't be verified by rendering the real component headlessly — it needs a real fallback PDF (trigger the server-export failure). Low value (fallback-only, ratio already works); do it WITH an owner PDF check, not blind.**

3. **COPENHAGEN-BLUE-BRIGHTER-001** `[SHIPPED 1.50.484 + docx-worker 1.14.68]` (owner 2026-06-15) — Copenhagen Modern's candidate band / header is too dark a navy (`#283556`); move it to a slightly brighter blue **`#33446F`** in the CV AND cover-letter candidate sections AND the table header. Apply in BOTH preview and export and keep them at parity. Sites: preview palette `packages/registry.json` `copenhagen-modern.base` (line 10) + `alt2.head` (line 20); export palette `workers/docx-worker/src/palette.js` (line 25 `base: '283556'`) AND the inlined copy in `workers/docx-worker/src/index.js` (bundle has no build step — [[docx-worker-bundle-no-build]]). The table-header fill keys off the head/base token, so it follows automatically — verify it does. **DO NOT change `UNIVERSAL_DARK_INK = '283556'` (`palette.js` ~85)** — that's the dark BODY/label ink, not the band. After the change, re-verify the band's WHITE candidate text + table-header WHITE text still have adequate contrast on `#33446F` (it's lighter, so check `readableInk`). Preview (registry) + worker → manual deploy + headless/PDF verify.

4. **SECTION-RULE-INK-MATCH-001** `[SHIPPED 1.50.485 — PWA-only]` (owner 2026-06-15; clarified the target is the per-ROLE divider) — in the BODY / main column, the horizontal rule under a section heading should take the SAME colour as the heading TEXT it sits under (e.g. teal `#00746E` under a teal heading), not a fixed navy. Today the underline colour is decoupled from the heading-text colour. Sites: preview live render of the main-section heading + its underline (the section-heading component in `app.src.js`) AND the print/`buildHTMLDoc` `h`/`f` helpers (`app.src.js` ~25135-25139 — `f(e,...)` already takes a colour arg `e`; make the caller pass the heading-text colour, not the band colour); export = the worker's main-section heading + rule (`workers/docx-worker/src/index.js`, section-heading renderer). Keep sidebar behaviour as-is; this is MAIN-column only.

5. **CL-CONTACT-ONELINE-001** `[SHIPPED docx-worker 1.14.68 + preview parity 1.50.484]` (owner 2026-06-15, with screenshot) — the cover-letter candidate contact line (address • EU Citizen • email • phone • linkedin) wraps to two rows because the separators are too wide. Tighten the inter-item spacing so it stays ONE line. Export site: `workers/docx-worker/src/index.js` ~25201 `const sep = bridge ? " • " : "   •   "` — the non-bridge sep has 3 spaces each side; reduce to ~1 space each side (and/or shrink the contact font / letter-spacing) so the row fits. Mirror the same tightening in the PREVIEW contact-line render (app.src.js) so they match. Keep the text itself tight; do not drop any contact item.

6. **CL-EXPORT-EDGE-MARGINS-001** `[SHIPPED docx-worker 1.14.69]` (owner 2026-06-15; chose 0.07"→0.14") — the exported cover letter needs MORE breathing room from the page edges — about **1.5–2× the current edge margin** — while keeping the text tight within each line (more outer margin, same line tightness). Primary site: the worker's CL (linear) page margins (`workers/docx-worker/src/index.js` — section `page.margin` for the CL/linear layout; default is 1 inch / 1440 twips → target ~2160–2880 twips L/R, tune T/B similarly). Verify the WHAT-I-BRING table still fits the narrower content width (its width is a % of the body — may need a small ratio/width re-check). Export-only is acceptable, but mirror the visual in the preview page padding if cheap. Worker → manual deploy + PDF verify desktop + mobile.

7. **PREVIEW-EXPORT-PAGEBREAK-PARITY-001** (j). In the PDF, page 2 starts with a role that the PREVIEW kept on page 1 — the measurer (autoPages) and the Word/LibreOffice export paginate differently. This also shifts which roles land on page 2 (interacts with results placement). Fix: align the preview per-role page estimate with the export's actual break (the two-map pagination — see [[pagination-two-map-and-worker-test]]); likely the measurer over/under-estimates a role's height vs the worker's role spacing (1.14.64 tightened role bullets to line 252).

8. **ADDITIONAL-INFO-SPLIT-001** (g). Generator merges Languages into ADDITIONAL INFORMATION; owner wants separate LANGUAGES + INTERESTS sidebar subsubsections. Root: me() skeleton (`pwa/app.src.js` ~3149-3167) has ONE merged `additional` (labeled_list) section; a separate `interests` section exists only in a template scaffold (~36420); the prompt already emits `interests_items` (~22885) but no skeleton section receives it. Fix (pick one): (A) split me() into `languages` + `interests` sidebar sections (schema change + migration), or (B) a restore-proof splitter in `antcv-sections-normalize-415.js` that extracts the Languages item + hobbies out of ADDITIONAL INFORMATION into their own sidebar sections (loop-safe, fits the existing pattern). Direct JSON import already has them separate (owner's corrected JSON).

9. **RESULTS-METRIC-SHARPNESS-001** — outcomes still echo bullets / miss the real metrics (250→10 days, 30% revenue, 5 domains, 10× price). The consensus reinforce degrades them; 1.50.478 hardened the prompt, 1.50.483 raised the clamp to 12 — RE-GENERATE to judge. If still flat, the surgical lever: stop `consensus_reinforce` (app.src.js ~24741) rewriting any outcome that already contains a metric.

10. **HIWC-ORPHAN-TIGHTEN-001** — HOW I WOULD CONTRIBUTE bullets ~3-5 chars tighter (e.g. "Map the current change and validation flow…cycle time." orphans). Prompt-side.

11. **CL-PREVIEW-TABLE-WIDTH-001** — widen the CL WHAT-I-BRING *preview* table (wrapStyle ~72%, app.src.js ~5075) to match the export (worker 0.8); the 1.14.67 ratio→0.25 helped the column split, not the absolute width. (Coordinate with CL-EXPORT-EDGE-MARGINS-001 — the new export margins change the body width the 0.8 is a fraction of.)

12. **EXP-TENSE-NOT-APPLYING-001** (owner 2026-06-15) — the Experience-Tense control is set to "Present" (aria-pressed) but role content + Results render PAST. Two parts: (a) the control the owner sees (`data-antcv-exp-tense`) is the Adv-Styles one (`app.src.js` ~13119); the Personal copy (`antcv-tense-control-422.js`, `data-antcv-tense`) anchors on the LanguageCard island `#antcv-react-personal-languages` which isn't mounting (item LANGUAGES-CARD-PERSONAL-001) — fixing that restores the Personal control. (b) tense is GENERATION-time only (writes `styleConfig.expTense`, read by the prompt `__tenseRule` ~22743) — it does NOT re-tense existing content; the owner must RE-GENERATE. 1.50.482 extended `__tenseRule` to also force the SELECTED OUTCOMES leading verbs — verify on a fresh generation. Still missing: the legacy ChatGPT-draft path (~22771) has no `__tenseRule`; and a live re-tense of EXISTING content would need a normaliser/rewrite pass.

13. **DOC-SUPERVISION-001** (owner: "supervisor is not controlling the documents very well") — a quality-control/orchestration pass that ENFORCES the rules end-to-end (results on every role, no Founder/i-nord, metrics present, no patent-in-role) before the doc is shown. The normaliser poll (1.50.476/479) is the restore-proof half; the owner wants a stronger "supervisor".

### A2. CONTENT & EXPORT — owner SECOND review 2026-06-15 (real fresh exports + screenshots)

22. **PROFILE-END-COMMUNICATION-001** `[SHIPPED 1.50.509 — prompt; owner verify on regen]` (owner 2026-06-15) — every CV PROFILE must END with a sentence about the people-person approach / communication skills (the "technical expert WITH human-reading" close). The prompt's 3-part PROFILE structure (`app.src.js` ~2768-2772) already names SPECIAL CAPABILITIES (people-reading) as part 3, but the real export does NOT reliably end on it (it ends on "Solo-developed a GenAI product…" then a separate "Work style:" line). Fix: harden the prompt so the LAST sentence of `profile_content` is the people/communication capability (and/or enforce render order). Banned-word render constraints (no raw "people's person"/"team player"/"empathy") still apply — behaviour over adjectives. Verify on a FRESH generation. Prompt-side.

23. **PROFILE-UNSOLICITED-GENERIC-001** (owner 2026-06-15) — the UNSOLICITED CV PROFILE (no specific job/company) must avoid over-specific headline terms. The real export opens "Electro-optics and systems engineer with 15+ years in automotive LiDAR, defence optics, and nanotechnology" — EXACTLY what the prompt (~2769) ALREADY forbids, so the rule is being VIOLATED (the model ignores it, or the consensus/reinforce stage or the memory-profile fusion ~22228 from uploaded electro-optics-heavy docs reintroduces the niche opener). Owner: prefer "IT expert / IT professional" framing; BAN as the OPENER: "Electro-optics and systems engineer", "electro-optics specialist in system architecture", "deep-tech", "automotive"; a specific domain may appear LATER as ONE example, never the headline; be careful applying these in non-deep-tech roles. Fix: harden the unsolicited-register rule AND find which stage emits the violating opener (regenerate to repro; check the memory-profile fusion override + consensus reinforce). Prompt-side.

24. **BAND-HEADER-BG-SEAM-001** (owner 2026-06-15) — a visible difference between the candidate band bg and the (table) header bg is seen in ALL 4 configs (CV/CL × Preview/PDF). NOTE: `TABLE-HEADER-MATCH-BAND-001` (1.50.486, preview) + `COPENHAGEN-BLUE-BRIGHTER-001` (worker 1.14.68, export) were JUST shipped to make the table header equal the band — these owner exports likely PRE-DATE those. Action: regenerate FRESH CV + CL and re-check. If a seam persists, pixel-sample the candidate band vs the table header (and any band sub-region) to identify the two differing tokens and unify them. Both bands are built from MULTIPLE shaded cells — confirm every band cell + the table header resolve to the SAME `#33446F` in preview CSS vars (`--header-bg`) AND worker shading (`style.headerBg`/`style.tableHeaderBg` = `band`).

25. **CL-WIDTH-CAP-001** (owner 2026-06-15, with image) — the CL body/table width does NOT open to the full available page width; clearly unused horizontal space on the right. The WHAT-I-BRING table (and/or the CL content column) caps below the usable body width. With `CL-EXPORT-EDGE-MARGINS` now 0.14" L/R the body is wide; the CL table default is `(PAGE_W-400)*0.8` (worker) and the preview `wrapStyle` is `width:"72%", maxWidth:540` (`app.src.js` ~5078). Owner wants it to use more width. Fix: raise the CL table width fraction AND drop/raise the preview `72%`/`maxWidth:540` cap so it fills the wider body; coordinate preview (~72%→~0.85-0.9, remove the 540px cap) with export (worker 0.8→higher); confirm the width-drag max also reaches the wider bound. (Supersedes/extends `CL-PREVIEW-TABLE-WIDTH-001`.)

26. **SIDEBAR-NARROW-FIGURE-OVERLAP-001** (owner 2026-06-16) — when the sidebar column becomes NARROW, the candidate-band text and the horizontal rule under it progress INTO the photo/figure, and the MAIN-section content does too. The fix must keep these elements positioned RELATIVE TO the figure's bounds — text/rules must STOP at (or be pushed aside by) the figure, not run under/over it. Also applies to OTHER photo placements: e.g. **sidebar-middle**, where the sidebar's own body text must be pushed aside (reflow/inset) around the figure rather than overlapping it. Covers BOTH the candidate-band overlap (band text + rule vs the medallion) and the in-column text-wrap-around-figure case. Scope: preview render (the band/header + sidebar/main columns in `app.src.js` / preview CSS) AND export parity (worker photo float + cell text wrap). Tie-in: [[photo-bridge-nonfloat]] (in-cell float-wrap is the open half — text renders but does not wrap around the in-column float) and the band-overlap medallion straddle (worker 1.14.71). Owner check is visual (real PDF + narrow-sidebar preview). NOT YET STARTED.

27. **ROLE-DECOMP-001** `[SHIPPED 1.50.508 — prompt + sidecar; regen + data needed]` (owner 2026-06-16) — "decompose the merged roles ... merging is later". The generator + runtime normalizer used to MERGE same-company overlapping roles into one (Innoviz collapsed to a single position). Now INVERTED: the prompt rule (`app.src.js`/`app.js` STORED WORK HISTORY → `ROLE DECOMPOSITION (ROLE-DECOMP-001)`) keeps each stored role separate AND splits combined-function titles (`X & Y`, `X and Y`); `antcv-sections-normalize-415.js` `dedupeRoles` now merges EXACT-title dups only (was containment) and `dropCustomerChangeDup` is no longer applied (Customer Change Requests Specialist kept as a distinct position). Verified headless (diag-role-decomp) + 297/297. **TWO RESIDUAL DEPENDENCIES (owner action):** (a) the un-merge only takes effect on a fresh GENERATION — owner must REGENERATE; the exact Innoviz position count depends on his D1 kernel (it currently holds 3 overlapping Innoviz entries), curate via the 👁 hide control or refine the kernel. (b) **DATA GAP — two roles absent from the D1 kernel** (`user_kernel`/kernel_snapshot_2026-06-16.md), so generation can't emit them until they are in the kernel/master profile: (i) **Copenhagen Wolves operations-manager** (foreningsarbejde) — CONTENT IS KNOWN (owner-provided, in the gabriel-cv-facts memory: Team Operations Manager, Copenhagen Wolves RFC / Pan Idræt, 2023–present; operations/logistics, player-coach-association link, LGBTQ+ inclusivity, democratic club processes); just needs inserting into his kernel/master profile. (ii) **Tel-Aviv security guard** (3rd Tel-Aviv position, the "dorm guard") — CONTENT UNKNOWN; owner must supply years + 2-3 bullets (do NOT fabricate). Meprolight (`Electro-Optics Engineer & Team Leader`) + Tel-Aviv (`R&D and Teaching Assistant`) split via the title-combine rule on regen.

### B. SETTINGS MODIFICATION

14. **LANGUAGES-CARD-PERSONAL-001 — regression.** In Settings → STANDARD → Personal, the Languages card fell to the BOTTOM (under "Done") and its spelling + tense controls disappeared. Owner wants it back in place, labelled "Languages" (covers spelling + tenses too), with those controls restored.
   - Root: `src/islands/LanguageCard/mount.tsx` (~43-74) anchors via `findSettingsFlexColumn` (`src/lib/settings-dom.ts` ~167-189, PERSONAL_LABELS ~24); the Personal subtab (`pwa/app.src.js` `yl` fn ~21217-22180) has NO flex-column wrapper, so the find fails and the card falls to the "before Done" fallback. The Experience-Tense control (~13119-13208) is NOT rendered inside `yl` (orphaned). Spelling = `antcv-spell-annotator-384.js`.
   - Fix: wrap the Personal sections in a `display:flex;flex-direction:column` container so the island anchors (order 20), and render the Experience-Tense (+ spelling) control inside `yl` at order 22. Per `settings-subtab-placement` memory. (Unblocks the Personal half of EXP-TENSE-NOT-APPLYING-001.)

15. **SETTINGS-SCROLL-RESET-001.** Scrolling down in the Settings modal jumps/hard-resets to the top. Root: a React re-render in the settings panel resets the scroll container's scrollTop. Fix: find the settings-modal scroll container, preserve scrollTop across re-renders (or eliminate the re-render that resets it; check the islands MutationObserver remounts and the `settingsTab`/`settingsSubTab` state churn).
   - **CORRECTED DIAGNOSIS (nightly 2026-06-17, DO NOT repeat the dead end):** the subtab-button `onClick` scroll-reset walk (`app.src.js` ~30902 `st(e.k)` then climb to the first `overflowY:auto` ancestor → `scrollTop=0`; minified `app.js` `onClick:t=>{vt(e.k);...` count 1) is a **RED HERRING**. Headless ancestor probe past the sign-in gate: the active subtab button's parent chain is `[overflowY:auto wrapper (NOT the panel)] → [main panel min(90vh,760px) overflowY:auto] → …`. The walk zeroes the SHORT intermediate wrapper (no vertical overflow → no visible effect) and `break`s BEFORE reaching the main panel the user scrolls. So guarding that onClick to "only reset on a real subtab change" is a **no-op** and must NOT be shipped as a fix (it was implemented, verified inert, and reverted this run).
   - The REAL cause is a panel `scrollTop` clamp on a re-render (cause b — island unmount/remount shrinking `scrollHeight`, or the `antcv-settings-front-327.js` position/z-index churn). **NOT reproducible headlessly with synthetic data:** with Personal/Layout mounted, the panel `scrollTop` held steady (300/259) for 4s under pure sidecar churn — no reset. Repro likely needs the owner's REAL data (taller content, more islands, real remount timing) or a real browser. **Owner-gated / needs a live repro** before any panel-side scroll-preserve fix (which touches the broad-observer island herd — blue-screen/loop risk per [[minified-mirror-shadow-hazard]]).

16. **DISCLOSURE-TRIANGLE-CONSISTENCY-001.** Add the ▸/▾ left disclosure triangle (shipped for ADVANCED VISUAL STYLES in 1.50.480) to the OTHER collapsibles in Advanced (the `<details>` SPACING & INDENTS group, WORD TEMPLATES, SECTION FORMATS/LAYOUT, etc.) for consistent affordance.

### C. NEW FEATURES (last)

17. **SECTION-LAYOUT-GRAPHIC-001.** The Section Layout control (LayoutPicker island, `src/islands/LayoutPicker/SectionFormatPicker.tsx` ~52-202) renders only a dropdown + slider + reset — NO "how each looks" visual (paragraph/bullets/table/hybrid thumbnails), and no explanation that SELECTED OUTCOMES can render as "selected bullets" vs "distributed results". `SECTION_FORMAT_OPTIONS` (`src/lib/writing-prefs.ts` ~395) has no 'results' option; the outcomes mode is set GLOBALLY (`__antcvOutcomesMode` `pwa/app.src.js` ~252, surfaced in the Layout card ~35160), not per-section here. Fix: add a small format-shape preview per row (PackagePicker's ShapePreview is a reference), a 'results' outcomes option for the outcomes row, and an explainer card. Island edit → `npm run build` (reproducible).

18. **OUTCOMES-FORMAT-RESULTS-OPTION-001** — add "Results" as a selectable Selected-Outcomes format (overlaps #17: wire the format-select 'Results' → outcomesMode).

19. **CL-FORMAT-CONTROL-001** — a cover-letter format control (academic + commercial).

20. **SUBSECTION-RENAME-REORDER-001** — rename + reorder subsubsections, controlled by writing style.

21. **EXPORT-PREVIEW-ZOOM-001** (owner 2026-06-15) — the export-preview modal should ZOOM OUT more so the full A4 page fits in view (it currently shows the page too large / cropped). Tune the iframe fit-to-width (`antcv-pdf-preview-gate.js` `--antcv-fit` ~597) to fit the whole page height, not just width.

---

## SESSION REGISTRY — 2026-06-16 (owner-interactive, day-long) — 1.50.506 → 1.50.521 + access-relay + docx-worker 1.14.74

Status snapshot for the nightly run. PWA auto-deploys on push; access-relay + docx-worker manually deployed (green). Suite **308/308**, boot-smoke clean throughout, every item below verified headlessly before ship.

**KERNEL V2 — COMPLETE (the owner's `antcv-code-session-brief.md`).** Plan + full status: `docs/plan/KERNEL-V2-AND-INGESTION.md`.
- **Task 1a** — owner's `gabriel-kernel-v2.json` (12 roles) staged in D1 `user_kernel.kernel_v2` (new non-destructive column; wrangler write, length-verified). Re-uploaded 1.50.521.
- **§2 TENSE-RENDER-001** (1.50.515) — AUTO tense reads the per-role `isCurrent` FLAG (STORED WORK HISTORY tags `| CURRENT ROLE`), NEVER parses dates. D1 bridge sets `tenseMode`+`isCurrent` on the runtime kernel.
- **§3 LANG-CROSS-001** (1.50.516) — `__langRule` in the generation prompt: translate prose in-target, keep invariant classes (company/patent/metrics/tools/standards/pub-titles) verbatim, DA keeps idiomatic English titles.
- **§4 ingestion** (1.50.517 → 521 + access-relay) — `antcv-kernel-ingest.js` engine (extract→structural-infer→gap→merge, no fabrication, node-tested) + file→text (docx/pdf/txt/json) + `antcv-kernel-import.js` preview modal (roles/conflicts/gaps, keep-both-and-flag, metrics never overwritten) + **D1 persist** `POST/GET /api/profile/kernel-v2` + **merged entry button** (Settings + wizard import controls) + **reader bridge** `projectV2ToWorkHistory` → `personalInfo.workHistory` (import feeds GENERATION) + **auto-sync on login** (signature-guarded) + **structured date/metric apply** + **language-selection step**. Upload-test fixtures: `pwa/test/fixtures/kernel-v2/{gabriel,anita,devon}-kernel-v2.json` (`gen_test_kernels.mjs`).

**OWNER-DATA RECONCILIATION (D1 `user_kernel`).** 11→ reverse-chron roles: ADDED Security Guard (Tel Aviv) + Copenhagen Wolves (`foreningsarbejde`, `Pan Idræt Rugby`, RFC in content); SPLIT Meprolight → Team Leader + R&D Engineer (Raw CV); CORRECTED Kanzen (`Product / Project Expert — Kanzen Konsulenter ApS — 2022-2026`) + IDF (`Computer Systems Administrator — Israel Defense Forces`); reverse-chron sort, volunteer pinned last; tools group names; isCurrent = kanzen+wolves. See [[gabriel-cv-facts]].

**FEATURES / CONTENT shipped:** OUTCOME-ROLE-SELECT-001 (per-row position dropdown + ≥11 seeded outcomes, 1.50.506) → seed-union/gap-fill + dedup-hide bullet-derived-only + quality-toggle (507/508); ROLE-DECOMP-001 (un-merge in prompt+415; merge-order core-first; 508/510); CW-CANON-001 (merge the two Copenhagen Wolves variants, 415); PROFILE-END-COMMUNICATION-001 (509) + UNSOLICITED PROFILE text (514); GROUP-NAME-VISIBILITY-001 (1.50.512 + worker 1.14.74 — labeled_list `labelHidden`: single-group/tools-methods name-hide, preview + export, manual re-show); EXP-ORDER-ON-ADD-001 (new role auto reverse-chron, volunteer last, respects manual reorder, 513); SIDEBAR-NARROW-FIGURE-OVERLAP-001 logged (item 26, NOT STARTED). IDF-before-Kanzen DROPPED (owner: one-off).

---

## SESSION REGISTRY — 2026-06-15 (nightly autonomous, parallelised) — 1.50.486

- `TABLE-HEADER-MATCH-BAND-001` `[SHIPPED 1.50.486 — PWA-only]` — owner reply 2026-06-15: "match table header text and BG to candidate section text and header in both preview and export." The EXPORT already matched after COPENHAGEN-BLUE (worker `tableHeaderBg = band`, `tableHeaderText = readableInk(band)` = white = the candidate band). The PREVIEW did NOT: the two `<th>` cells (`app.src.js` ~5094/5115) read `k.tableHeaderBg`, but the resolved `k` style falls back to the pale `c` default (`#DDE6F2` + dark ink), so the preview table header was pale while the band was blue. Fix: drive both `<th>` from the band's own source — `background: "var(--header-bg)"`, `color: "var(--header-name-color, #fff)"` — so the table header BG+text equal the candidate band in every package (the band uses the same CSS var). Minified `app.js` mirrored (the inlined `readableInk` IIFE on `_.tableHeaderBg` replaced, 2 cells, count-guarded). Verified `diag-copenhagen-blue-preview` 7/7 (table header rgb(51,68,111) + white === band) and `diag-copenhagen-blue-cl` still 4/4 (export band+table = 33446F). No worker change.

## SESSION REGISTRY — 2026-06-15 (nightly autonomous, parallelised) — 1.50.485 + docx-worker 1.14.69

- `CL-EXPORT-EDGE-MARGINS-001` `[SHIPPED docx-worker 1.14.69]` — owner reply 2026-06-15: "0.07"→0.14" is a meaningful change." (The backlog's "current = 1 inch" assumption was wrong — actual `CL_SIDE_MARGIN` was 100 DXA / 0.07".) Doubled `CL_SIDE_MARGIN` 100→200 (0.14") in `buildLinearDocument`; the full-bleed header band follows via `-CL_SIDE_MARGIN`; the three `PAGE_W-200` body-width literals (signature right-tab 24912, CL table column width 25781, WHAT-I-BRING `defaultClW` 26092) → `PAGE_W-400` so the table still fits the narrower body. Verified `diag-cl-margins` 4/4: pgMar L/R=200 top=0, band `-200` indent (still full-bleed), WHAT-I-BRING tblW 9205 ≤ body 11506. CV two-column path untouched.
- `SECTION-RULE-INK-MATCH-001` `[SHIPPED 1.50.485 — PWA-only]` — owner reply 2026-06-15: "just a check that role text and its underline match." Diagnosis had inverted the premise (the SECTION-heading underline already matches `mainHeadColor` in all paths); the genuinely-decoupled rule is the per-ROLE divider. Fix: preview role rule `${s}`→`${k.mainSubHeadColor||s}` (app.src.js ~5454); buildHTMLDoc print role rule `f(t.mainLineColor,1,2)`→`f(t.mainSubHeadColor,1,2)` (~25306). Minified app.js mirrored with count guards (`${h}`→`${_.mainSubHeadColor||h}`; `m(t.mainLineColor,1,2)`→`m(t.mainSubHeadColor,1,2)`). Foundation + summary rules left on `mainLineColor` (owner asked for ROLES only). The worker export `renderExperience` has NO per-role underline rule, so this is preview + client-print only (no worker change). Verified `diag-section-rule-ink-preview` 4/4 (role title rgb(196,98,45) === role underline border).

## SESSION REGISTRY — 2026-06-15 (nightly autonomous, parallelised) — 1.50.484 + docx-worker 1.14.68

- `COPENHAGEN-BLUE-BRIGHTER-001` `[SHIPPED 1.50.484 + docx-worker 1.14.68]` — Copenhagen candidate band + table header navy `#283556` → brighter blue `#33446F`, CV + CL, preview + export at parity. Export: new per-package `band` token (`getPackageStyle` `headerBg`/`tableHeaderBg`/header text = `p.band||p.base`, in `src/palette.js` + the deployed `src/index.js` bundle); `readableInk(#33446F)` → white (9.56:1), band/table text stays white. Preview band: `--header-bg` CSS var in `antcv-packages-registry.css` `#283556`→`#33446F` (the real on-screen lever — the `va` `headerBg`/`tableHeaderBg` literals in app.src.js/app.js were mirrored to match but are not the active render source for the band). NOT touched: `UNIVERSAL_DARK_INK`, `DEFAULTS.navy`, `--main-head-color` (main-column section headings stay navy — parity, as the owner asked: only band + table header brighten). Verified: `diag-copenhagen-blue-cl` 4/4 (band+table fill 33446F, no 283556 fill, headings navy, white text), `diag-bundle-palette-sync` 5/5, `palette.test` 11/11, `diag-copenhagen-blue-preview` 5/5 (band paints rgb(51,68,111), `--main-head-color` stays navy, clean render), full suite 284/284. NOTE: the PREVIEW competency-table header renders pale `#DDE6F2` via a separate render path (not `#283556`), so the owner's "table header" request applies to the EXPORT (now 33446F + white text) — the pale preview table header is a pre-existing preview/export mismatch, left for a separate item.
- `CL-CONTACT-ONELINE-001` `[SHIPPED docx-worker 1.14.68 + preview parity 1.50.484]` — candidate contact-line separator `"   •   "` (3 spaces) → `" • "` (1 space) in `buildHeaderCell` so the address•EU-citizen•email•phone•linkedin row stays one line in the export; all items retained. Preview parity edit in app.src.js/app.js (HTML collapses the extra spaces, so the wrap was export-only). Verified in `diag-copenhagen-blue-cl` (contact row one line, single-space sep, 4 items present).

## SESSION REGISTRY — 2026-06-15 (owner: 11-role clamp + CL-dims diagnosis + parallel nightly) — 1.50.481 → 1.50.483

- `OUTCOMES-CLAMP-11ROLES-001` `[SHIPPED 1.50.483]` — owner: "my CV decomposes to ~11 roles (system architect, change-control lead, CRM/sys-admin split, research/teaching assistant, electro-optics engineer, team lead, security guard, frivilligt arbejde) — clamp should be larger." Raised the SELECTED OUTCOMES outcome clamp **7→12** at all 4 `Se()`/`rt()` sites (preview build + the two `outcomes_items` paths), mirrored source+minified with count guards. Updated the generation prompt cap rule "5 to 7 BULLETS / 7 maximum / 5–7 elements / best 5–7" → "5 to 12 … one outcome per active role, never collapse two roles into one outcome." So the pool can carry one quantified Result for every active role on a deep CV (coverage-first distribution then spreads them, 1-2/role). node --check both + 284/284 + parity grep. Cache-bust trio.
- `CL-TABLE-DIMS-FALLBACK-001` `[DIAGNOSED — see OPEN ISSUES]` — owner "CL export still ignores table dimensions." Traced the full chain (drag→store→buildPayload→deployed worker 1.14.67) and proved it CORRECT for both DOCX + server-PDF. The symptom is the export silently degrading to the client print fallback (`kl`→`buildHTMLDoc`), which is EXPORT-FALLBACK-ON-FIRST-001; the fallback builder ignores `clTableRatio`/`tableWidthPct`. NOT a dims-forwarding defect — no speculative export-chain patch shipped (protocol). Two real fixes recorded in OPEN ISSUES.
- `BACKLOG-REORDER-001 + 4 NEW ITEMS` `[REGISTERED — owner 2026-06-15]` — reorganised the OPEN ISSUES block into the owner's revised order: **CONTENT & EXPORT → SETTINGS MODIFICATION → NEW FEATURES**. Registered four new owner items with verified fix locations: `COPENHAGEN-BLUE-BRIGHTER-001` (candidate band/header + table header `#283556`→`#33446F`, CV+CL, preview registry + worker palette, NOT the dark ink), `SECTION-RULE-INK-MATCH-001` (main-column heading underline colour = heading text colour, e.g. teal), `CL-CONTACT-ONELINE-001` (tighten CL contact-line separators — worker sep `index.js` ~25201 `"   •   "`→`" • "` + preview parity), `CL-EXPORT-EDGE-MARGINS-001` (CL page edge margins ~1.5–2× in the export, keep lines tight). No code shipped this turn — queued for the parallelised automated session.

---

## SESSION REGISTRY — 2026-06-15 (owner real-export feedback) — 1.50.476 → 1.50.480

- `RECS-ORDER-MULTIPAGE-001` `[SHIPPED 1.50.476]` — the 1.50.473 recs-order fix stranded RECOMMENDATIONS at the foot of page 1 between the page-1 roles and the page-2 "(CONT.)". Now floors each after-experience section to the highest experience-role page → renders after the continuation on the last page. Verified headless (2-page experience: recs below the PAGE-2 marker + last page-2 role).
- `KANZEN-CANON-001 / PATENT-IN-ROLE-001 / sidecar-poll` `[SHIPPED 1.50.476]` — the multi-LLM CONSENSUS stage reintroduced role regressions the boot-sweep normaliser missed (it finished before generation). antcv-sections-normalize-415.js now: canonicalises Kanzen company ("Kanzen Konsulenter ApS", no "i nord") + end year 2026 (which lets dedupeRoles drop the duplicate Kanzen row); strips patent-NUMBER bullets out of roles; AND POLLS (setInterval 2500) + listens to `storage` so it re-runs on the post-generation write. Verified headless end-to-end on the exact bad role list (Founder gone, no i-nord, single Kanzen→2026, patent removed, System Architect merged).
- `PALETTE-PARITY-EXPORT-PREVIEW-001` `[SHIPPED 1.50.477]` — the export-preview modal renders in an iframe that copied the package CSS but not the `data-package` body attribute, so `body[data-package]{--sidebar-bg}` never matched and the sidebar fell back to navy (DARK). Now carries data-package(+dark-mode) onto the iframe body. Verified headless: iframe --sidebar-bg = #DCE5EA (pale), not navy.
- `OUTCOMES-METRIC-PROMPT-001` `[SHIPPED 1.50.478 — owner verify on regen]` — the consensus `reinforce` step degraded SELECTED OUTCOMES into bullet-restatements. Hardened the reinforce + main generation prompts: outcomes are QUANTIFIED PROOF POINTS (must carry a number/%/count/timeframe/scale, never restate a bullet; if a signal adds no metric, keep the original). Added a rule: patents go ONLY in PUBLICATIONS & PATENT, never role bullets. Prompt-only (LLM behaviour) — node --check + 284/284 + boot-smoke; output quality owner-verified.
- `FOUNDED-ESTABLISHED-001 / CUST-CHANGE-DUP-001` `[SHIPPED 1.50.479]` — normaliser: a role bullet "Founded …" → "Established …"; drop the duplicate "Customer Change Requests Specialist" role when a "Change Control" role exists at the same company (dedupeRoles couldn't catch it). Verified headless.
- `TABLE-RATIO-PARITY-001` `[SHIPPED docx-worker 1.14.67]` — the competency / What-I-Bring table Focus-Area ratio default was 0.30 in the worker but 0.25 in the live preview, so the export's first column was wider and the Expertise cells wrapped. Worker → 0.25 (forwarded s.tableRatio still wins). diag-cv-table-width CHECK E updated 7/7.
- `OUTCOMES-RESULTS-PAGE2-001` `[SHIPPED 1.50.480]` (owner CRITICAL) — Results were missing from page-2 roles: CAP=2 let a page-1 role hold two outcomes while the spill only redistributed overflow. CAP 2→1 (preview + export) → outcomes spread to the emptiest roles, covering page-2 roles, each ~one line. Verified headless: 5 outcomes / 5 roles (2 page-2) → every role incl. Meprolight + IDF carries its matched result.
- `ADV-VISUAL-DISCLOSURE-001` `[SHIPPED 1.50.480]` — "ADVANCED STYLES" → "ADVANCED VISUAL STYLES" with a clear left ▸/▾ disclosure triangle; removed the confusing right "u/v". Verified headless.
- `OUTCOMES-RESULTS-COVERAGE-001` `[SHIPPED 1.50.481]` (owner "1-2 per role, last 2 roles still empty") — coverage-first distribution (retention 1 → pass 0 covers every empty role → pass 1 gives strong roles a 2nd; 1-2 per role, every role first) + outcome cap 5→7 (4 Se(…,5) clamps + the generation prompt asks for one quantified outcome per major role). Verified headless: 7 outcomes / 7 roles (3 page-2) → all 7 carry their matched result.
- `EXP-TENSE-OUTCOMES-001` `[SHIPPED 1.50.482 — owner verify on regen]` — the FORCED PRESENT/PAST tense rule now also forces the SELECTED OUTCOMES leading verbs, so the per-role Results follow the chosen tense (was bullets-only → Results stayed past). Prompt-only. See EXP-TENSE-NOT-APPLYING-001 in OPEN ISSUES for the control-location half (tied to item b).

---

## SESSION REGISTRY — 2026-06-14/15 — 1.50.468 → 1.50.475 + docx-worker 1.14.64 → 1.14.66

Owner-driven batch + a nightly autonomous job set up. Every fix verified by a headless render
PAST the sign-in gate (not boot-smoke) or a unit/worker diag before deploy; pushed to `main` only
(mirror branches retired). The minified-mirror-shadow-hazard bit twice and was caught both times
(see that memory — de-min names ≠ minified names; anchor on string literals, copy blocks verbatim).

**Fixed + shipped this session:**
- `LAYOUT-BATCH-1..5` `[SHIPPED 1.50.469 + worker 1.14.64]` — CL signature + AI-assisted on ONE line; sidebar sections keep-together (cantSplit) so a short block moves whole to the next page; experience bullets tighter line (252); WHY-YOUR-COMPANY heading for unsolicited; HIWC intro orphan trim.
- `CL-PROMPT-WHO-WHY-001` `[SHIPPED 1.50.470]` — WHO I AM end-on-a-full-line orphan guard; WHY content must not narrow to "the work I do best: electro-optics" (frame the breadth).
- `ADV-SPACING-PANEL-001 / BULLETGAP-001` `[SHIPPED 1.50.471 + worker 1.14.65]` — collapsible "SPACING & INDENTS" group (area-labelled) + new bullet marker-to-text gap, wired preview + worker.
- `ADV-STYLES-MERGE-001` (backlog item 14) `[SHIPPED 1.50.472]` — Line Targets + Section Formats merged into Section Layout; the two standalones removed; LayoutPicker re-anchored on a thin `data-antcv-format-prefs` div, no island rebuild.
- `RECS-ORDER-PREVIEW-001` (backlog item 8) `[SHIPPED 1.50.473]` — RECOMMENDATIONS rendered before PROFESSIONAL EXPERIENCE in the preview (state + export were correct). The main column composed [all non-exp sections]→[experience]; now splits oMain by document position relative to the experience anchor (before/after) in both layout branches. Verified headless.
- `OUTCOMES-RESULTS-ORIGROLES-001 / BESTMATCH-001` (CV results) `[SHIPPED 1.50.474]` — same outcome on multiple roles (linear preview rendered per-role with roles:[t], no __antcvOrigRoles → each role distributed over itself) + wrong role (first-token-match). Forward the full role list; assign by MOST shared tokens (best-match). Preview + export. Verified headless: each outcome on its correct role, no cross-role dup.
- `PHOTO-BRIDGE-EXPORT-001` (backlog item 4) `[SHIPPED docx-worker 1.14.66 — owner PDF verify owed]` — the band-overlap "Sidebar bridge" medallion exported flat at sidebar-top: layoutInCell defaults TRUE in the docx lib, clamping the float inside the sidebar cell so its negative lift couldn't rise into the band. Fixed: layoutInCell:false + PAGE-relative horizontal (sidebar-column centre). diag-photo-bridge-export extended (layoutInCell="0" + PAGE-relative H) + 69/69 worker tests. Vertical seam alignment needs an owner PDF check to fine-tune.
- `WIB-TABLE-DIMS-001` (backlog item 5) `[SHIPPED 1.50.475]` — the CL WHAT I BRING table (and CV Core Competencies) exported at the worker's default width/split, ignoring the dimensions dragged in the preview. `buildPayload`/`normalizeSections` now forwards per-section `tableWidth` (from stylePrefs.tableWidthPct[id], non-default only) + `tableRatio` (clTableRatio/cvTableRatio). The worker already reads s.tableWidth/s.tableRatio. Verified END-TO-END: new table-dims-forward.test.mjs 6/6 (client forwards) + a worker-XML check (forwarded 7202/0.4 → gridCols 2881+4321=7202). PWA-only, no worker redeploy.
- `NIGHTLY-001` `[SET UP]` — persistent scheduled task `antcv-nightly` (~02:46 local daily) runs the backlog autonomously with the full ship discipline + verify-before-ship safety valves. First run pauses on tool approvals → owner should "Run now" once to pre-approve.
- `PDF-LAYOUT-001` `[INVESTIGATED — no concrete repro, NOT shipped]` — "stray SELECTED OUTCOMES heading on PDF p2". The section-wrapper merge that repeats a tblHeader is already guarded by the separator paragraph (PB-WORKER-CONT-HEADER-001) and SELECTED OUTCOMES is too short to span; could not reproduce in the worker XML. Left open rather than ship a speculative pagination change (needs an owner PDF that exhibits it). PDF-LAYOUT-002 + CONTACT-LINE-DENMARK-001 + banded-rows confirmed ALREADY SHIPPED (1.14.54 / 1.50.456 / 1.14.63).

---

## SESSION REGISTRY — 2026-06-14 (continued) — 1.50.446 → 1.50.455

Desktop session. Copenhagen palette + export + outcomes + crash-recovery work. Every fix
verified by a headless render or unit test before deploy; pushed to main + the two mirror
branches each ship. Tests live under `pwa/test/` and `workers/proxy/test/`.

**Fixed + shipped:**
- `PALETTE-REGION-TOKENS-001` `[SHIPPED 1.50.446]` — fixed the INVERTED Copenhagen preview (candidate band was pale, sidebar dark). Band/strips → `var(--header-bg)` (dark per package), sidebar → `var(--sidebar-bg)` (pale); the 329 sidecar no longer hard-codes navy. diag-copenhagen-palette.
- `OUTCOMES-RESULTS (preview)` `[SHIPPED 1.50.447]` — dedup vs the role's own bullets, cap 2/role, spill into the emptiest roles first (first role no longer starved), 180-char budget, only the "Results:" label bold, patent filtered. diag-outcomes-results 6/6.
- `PERSONAL-CARDS-VERTICAL-001` `[SHIPPED 1.50.448]` — "Languages in the top bar" panel full-width (no horizontal stacking beside Done).
- `SIDEBAR-INK-MATCHES-PAINT-001` `[SHIPPED 1.50.449]` — sidebar body text keyed on the resolved `--sidebar-bg` → dark/readable on the pale ground (was white-on-pale).
- `ANALYSIS-SALARY-001` `[SHIPPED 1.50.450 + proxy/demo-proxy deploy]` — JD analysis returns a `salary_estimate` (stated parse OR an honest market estimate); Analysis panel renders it. jd-analysis-salary 18/18, diag-analysis-salary 4/4.
- `TABLE-HEADER-INK-001` `[SHIPPED 1.50.451; HOTFIX 1.50.452]` — Core Competencies header text was navy-on-navy invisible → `readableInk(tableHeaderBg)`. 451's minified mirror called a shadowed `f` and CRASHED the editor on table render; 452 inlined the luminance check. (See the minified-mirror-shadow-hazard lesson.)
- `OUTCOMES-RESULTS-EXPORT-PARITY-001` `[SHIPPED 1.50.451]` — the EXPORT `applyOutcomesMode` (docx-client) brought to parity with the preview (dedup/cap/spill/budget). applyOutcomesMode.test 6/6.
- `EXPORT-PALETTE-PARITY-001` `[SHIPPED 1.50.453]` — export `buildStyle` resolves panel backgrounds from the `--sidebar-bg`/`--header-bg` tokens → exported sidebar PALE + candidate band navy with WHITE text (was dark sidebar + invisible candidate text). buildStyle-palette test.
- `OUTCOMES-RESULTS-EDIT-001` `[SHIPPED 1.50.454]` — the per-role Results line is now an editable `contentEditable` span; edits persist per role to `antcv:resultsOverride` and are preferred on render.
- `SIDEBAR-LABEL-PDF-WHITE-001` `[FIXED 1.50.455]` — the bold sidebar field LABELS rendered white on the pale sidebar in the PDF (`sidebarLabelColor` defaulted white in the worker). `buildStyle` now sets `sidebarLabelColor` to the dark readable ink. buildStyle-palette 6/6. **Re-verify in a real PDF export, desktop + mobile.**

- `OUTCOMES-MODE-PARITY-001` `[FIXED 1.50.459 — needs real-export verify]` — owner 2026-06-14
  ("still exporting selected outcomes instead of results"): the EXPORT `applyOutcomesMode`
  defaulted to `'section'` when no `outcomesMode` was stored, but the PREVIEW
  (`__antcvOutcomesMode`, app.src.js ~252) defaults Copenhagen Modern (incl. the empty/
  'scandinavian' aliases) to `'results'`. So on Copenhagen with no explicit setting the preview
  hid SELECTED OUTCOMES (per-role Results) while the export still emitted the OUTCOMES block.
  The export now mirrors the preview default exactly (reads `stylePackage`; copenhagen → results,
  else section; an explicit `outcomesMode` still wins). `outcomes-mode-forward.test.mjs` updated
  4/4 (copenhagen default → results; non-copenhagen → section; explicit modes unchanged).
- `PLACEHOLDER-EXPORT-GUARD-001` `[FIXED 1.50.458 — needs real-export verify]` — owner 2026-06-14:
  an unsolicited CL exported with the literal skeleton placeholder "[WHY THIS POSITION — 1-2
  sentences …]" because the generation left `why_content` empty and the bracket placeholder
  leaked into the finished document. `normalizeSections` (export `buildPayload`) now treats a value
  that is ENTIRELY one bracketed `[…]` placeholder as empty (text content, text_bullets
  intro/items/closing, foundation hands_on/professionally) and DROPS a text section that is empty
  after stripping — so neither the bracket text nor an orphan heading exports. Inline brackets in
  real prose ("[change control board]") are untouched. `placeholder-export-guard.test.mjs` 4/4.
  Covers the worker DOCX + /generate-pdf paths (the owner's exports go through the worker — banded
  rows proved it). NOTE: still shown (greyed) in the live editor by design; only suppressed on
  export. **B7 follow-up:** the header-center code is present on ALL export paths (worker DOCX +
  HTML print both emit center) and the preview sidecar skip shipped 1.50.457 — owner's left headers
  are most likely a stale cache; hard-refresh to confirm.
- `TABLE-HEADER-CENTER-001` `[RE-FIXED 1.50.460 — real root cause]` — owner re-confirmed 2026-06-14
  "headers still LEFT in preview, centered in export". The 1.50.457 section-align skip was the WRONG
  lever. The REAL preview aligner is `antcv-core-competencies-row-controls-234.js`: `applyPreview()`
  forces `getAlign(row)` onto every `th/span` in the header row each sweep, and `getAlign` defaulted
  ALL rows (incl. row 0, the header) to `'left'`. Fix: `getAlign(0)` now defaults to `'center'`
  (body rows stay left; an explicit CJLR choice still wins). Export was already center on every path
  (worker DOCX `<w:jc center>` + HTML `text-align:center` — both verified), which is why they
  diverged. `table-header-center.test.mjs` extended 3/3. NOTE: the header CJLR being unable to
  RE-position (B8) is a separate enhancement — row 0's own controls are intentionally stripped and
  the app's section-level CJLR doesn't drive this sidecar's row-0 map yet.
- (superseded) `TABLE-HEADER-CENTER-001` `[1.50.457 section-align skip — wrong lever, kept harmless]` — B7: table headers
  rendered LEFT instead of centered. The React `<th>` is `textAlign:center`, but the section-align
  sidecar's reapply pass forced EVERY editable target to the section alignment (default `'left'`),
  overriding the header center each MutationObserver pass. `applyAlignmentToSection` now SKIPS
  `<th>`-contained editables — the header keeps its center and is owned by its own per-header
  control; body cells/text still follow the section cycler. Export already centers
  (worker `s.headerAlign || "center"`; client never sends a header override). PWA-only, sidecar
  edit (no app.js mirror). `table-header-center.test.mjs` 2/2 + boot-smoke. No jsdom harness in the
  repo, so the rendered result wants the owner's eye.
- `TABLE-BANDED-ROWS-001` `[FIXED docx-worker 1.14.63 — DEPLOYED; needs real-PDF verify]` — A3:
  the exported table zebra was "missing the banded-row colours seen in preview". The worker
  banded the WRONG rows (odd data rows) with a near-invisible `FAFAFA`, while the React preview
  (`app.src.js` ~5149) bands EVEN data rows with a visible pale teal `#eaf7f7`. Worker
  `makeDataRow` now matches: even data rows → `EAF7F7`, odd → none. Covers CV competencies + CL
  What-I-Bring (shared `renderCompetencyTable`). `test/diag-banded-rows.mjs` (4 band fills, 0
  FAFAFA) + cv-table-width regression green. Re-verify in a real PDF.
- `EXPORT-PALETTE-FALLBACK-001` `[FIXED docx-worker 1.14.62 — DEPLOYED; needs real-PDF verify]` —
  the DEPLOYED worker bundle (`src/index.js`) inlines a COPY of `src/palette.js`, and that copy
  had drifted to the pre-fix Copenhagen palette: `getPackageStyle` returned `sidebarBg: base`
  with white sidebar text/labels and no `tableHeaderText`. The source `palette.js` was already
  corrected (1.50.438/SANDBOX-B) but the bundle was never resynced, so whenever an export payload
  omitted an override token the candidate / sidebar text rendered WHITE-on-pale (invisible) — the
  fallback half of the A2 PDF-text bug. FIX: synced the bundle's inlined palette to `palette.js`
  (copenhagen `ground: C9D6EC`; added `readableInk` + `UNIVERSAL_DARK_INK`; `getPackageStyle` now
  derives `ground`, uses `readableInk(ground)` for sidebar text+labels, keeps the candidate band +
  table header on dark `base` with luminance-picked ink, adds `tableHeaderText`). New
  `test/diag-bundle-palette-sync.mjs` 5/5 locks bundle≡source; palette drift 11/11 +
  diag-twocol-ownerlike still render-green. Client payload overrides (453/455) still win when
  present. **Deploy docx-worker + re-verify in a real DOCX/PDF.**

**ACTIVE_BUGS recovery:** this file's historical body + the 2026-06-14 bug-intake block were restored from the desktop handoff's authoritative copy (verified superset of the local day-2 content; the prior remote clobber to `PLACEHOLDER` is moot — this is the full tracker).

**Still OPEN — full prioritized list in the `antcv-open-backlog` memory:** `CONTACT-LINE-DENMARK-001` (contact must read "2300, København S", no country); PDF re-verify (candidate white text, banded rows, photo-bridge); What-I-Bring exports stale dimensions; CL text edge margins (match CV main inset); table headers center by default + movable CJLR buttons; Recommendations renders before Professional Experience in PREVIEW; HIWC word/char count off by 1–2; watermark → lower part of the lighter final column; the CV-data merge + generation-prompt hardening; Settings-UI cluster; `GRAMMAR-MARKER-SCROLL-LAG-001`; `DOC-WIDE-CHATBOT-001` (mobile); `TASK-CUSTOM-LLM-OVERHAUL-001`; `PDF-LAYOUT-001/002`.

---

## SESSION REGISTRY — 2026-06-14 — bug intake (owner-reported)

### SIDEBAR-LABEL-PDF-WHITE-001 — sidebar field labels render white in exported PDF
- **Status:** [ ] OPEN (High) — reported by owner, screenshot attached (mobile PDF viewer, page 1).
- **Symptom:** In the exported PDF, the bold sidebar field labels ("Project Workflow:", "Reporting & Data:", "Architecture:", "Methods:", "Domain:", "Engineering:" under TOOLS & METHODS, and the equivalent labels in every other sidebar section) render in WHITE on the light-grey sidebar background, making them effectively invisible. Only the value text after each label is dark/legible.
- **Expected:** Sidebar non-heading label text must be DARK (legible on the light sidebar). Per CV design spec, sidebar BODY content sits on the light-grey sidebar fill — labels included — and must use a dark colour, not white. White is reserved for content on the navy band (#283556); it must not leak onto the light sidebar in the PDF path.
- **Scope:** PDF export only (per report). Must re-verify against Preview and DOCX — labels must be dark in all three, desktop + mobile. Affects ALL sidebar sections, not just TOOLS & METHODS.
- **Likely cause:** PDF render path inherits a white label colour (probably the navy-band/header label rule) instead of the sidebar-body dark colour; or label spans lack an explicit dark colour and fall through to a white default in the PDF stylesheet/worker.
- **Fix direction:** force sidebar label spans to the dark sidebar-body colour in the PDF export stylesheet; confirm the rule is scoped to the light sidebar and does not regress labels that legitimately sit on the navy band. Then verify Preview + DOCX + PDF parity (QA core rule).

### CONTACT-LINE-DENMARK-001 — contact line shows "Denmark", spec requires district-only
- **Status:** [x] FIXED 1.50.456 — export path now mirrors the preview's Danish local-form.
  ROOT CAUSE: the preview (`app.src.js` `pe`/`__localForm`) normalised the contact location to
  "2300, København S" but the EXPORT path (`antcv-docx-client.js buildPayload`) sent
  `personalInfo.location` RAW to the worker, so the DOCX/PDF rendered the stored
  "2300 København S, Denmark" verbatim. FIX: added a `localForm()` helper to the export payload
  builder (strips denmark/danmark, København-izes, and — new — inserts the comma when a postcode
  is already present: "2300 København S" → "2300, København S"); the same comma-insertion branch
  was added to the preview `__localForm` (app.src.js + minified app.js mirror) so a stored
  postcode form also normalises in Preview. Verified `pwa/test/unit/contact-line-denmark.test.mjs`
  8/8 (raw, da spelling, bare city/country, non-default district keeps district + gains comma,
  non-CPH untouched, no country-word leak, src↔minified parity) + boot-smoke. **Re-verify in a
  real DOCX + PDF export, desktop + mobile** (worker renders the field as-is; no worker change).
- **(orig) Status:** [ ] OPEN (Low) — reported by owner, same screenshot (header contact line).
- **Symptom:** The header contact line reads "2300 København S, Denmark".
- **Expected:** Per owner spec the location token must read "2300, København S" — postcode + comma + district, no country. Never "Copenhagen, Denmark" and not "København S, Denmark".
- **Scope:** Header contact line. Verify Preview + DOCX + PDF parity, desktop + mobile. Check whether the literal string is stored in personalInfo/contact data (data fix) or assembled at render with a hardcoded ", Denmark" suffix (template fix). If the EU-Citizen / @-handle tokens are assembled in the same string builder, fix there so all CV/CL surfaces match.
- **Do not bundle** with SIDEBAR-LABEL-PDF-WHITE-001; separate cause, separate verify.

# AntCV — Active Bug Tracker

## SESSION REGISTRY — 2026-06-13 (continued, day 2) — 1.50.418 → 1.50.439

Body restored from blob `b7930cf` (the last known-good full version) and this
block prepended with the day-2 work — per the owner's "restore + merge". The full
historical body (2026-06-03 → 1.50.417) follows below unchanged.

**Fixed + shipped:**
- `SIDECAR-CONSOLIDATE G2/G5/G10/G6` `[SHIPPED 1.50.418/419/428/429]` — section-panel (206/207/208→211), mobile-ui (4→1), photo trio (position+pentagon+bridge→one), language prefs/filter trio merged behind ONE shared rAF scheduler + ONE MutationObserver each. 13 files → 4.
- `PERSONAL-ORDER-002` + `TENSE-STICKY-FIX-001` `[SHIPPED 1.50.427]` — Personal subtab order set to the owner figure (Background→CV Sidebar→Languages→Tense→Advanced Tone→Banned Words); the EXPERIENCE TENSE control removes itself off-Personal (no longer sticky).
- `AUTO-PAGEBREAK-BLOCK-001` (b) `[SHIPPED 1.50.430]` — photo medallion now carries onto page 2+ in the slim repeat-header strip; (a) eff page-labels + (c) export reconcile verified already in place.
- `WIZARD-002` `[CLOSED 1.50.431]` — settings hand-off ("WHERE TO CUSTOMISE NEXT") on the final wizard slide. `WIZARD-LANG-SELECTOR-001` re-confirmed already shipped 1.50.412 (two-table reorderable selector); stale registry lines corrected.
- `PREVIEW-CHATBOT-001` re-confirmed already shipped 1.50.412 (stale "not started" corrected); `CHATBOT-DEMO-PROXY-001` `[FIXED 1.50.437]` — the chatbot now falls back to the access relay so DEMO users can use it.
- `CLOUD-RESTORE-MERGE-LEAK-001` `[FIXED 1.50.432]` — the Gabriel/Anita specialization leak: `signOut()` already clears localStorage, so the bleed was cloud-restore's field-by-field `fillMissing`. Restore now REPLACES `personalInfo` wholesale when the cloud copy is substantive (sparse cloud still falls back to fill). diag-cloud-restore-no-merge 3/3.
- `JD-URLFETCH-GARBLED-MSG-001` `[FIXED 1.50.433]` — a URL JD fetch (jobs.nvidia.com) wrongly showed the PDF "garbled font encoding / open the PDF" remediation. URL fetches now get URL-aware guidance (JS-rendered page → paste into Additional Signals or save/print the page to a PDF). (Worker-side actual fetch of JS-rendered pages tracked separately.)
- `LANG-UK-US-DICT-001` `[CLOSED 1.50.434]` — SPELLING relocated out of Account into a collapsible `<details>` under the Languages card (Settings → Personal); English defaults to **UK (en-GB)**, **US (en-US)** added via a UK/US selector; dictionaries follow the document language. diag-spell-relocate-variant 5/5.
- `SPELL-ZH-CONTEXT-001` `[SHIPPED 1.50.435]` — Chinese **symbol-in-sentence fit**: Hunspell can't segment Chinese, so zh uses an AI proofreader for 错别字 (wrong/context-unfitting characters) → underlines + click-to-correct, editor + preview, zh-only, cached. diag-spell-zh-context 4/4.
- `PW-CJLR-PHOTO-LEAK-001` + `LAYOUT-DEAD-COUNT-001` `[FIXED 1.50.436]` — the redundant blinking button between SHADOW Off/On (the profile-workstyle CJLR cycler matched the "PROFILE PHOTO" card and the photo-bridge sidecar stripped it back); and the dead "N on" EXPORT OPTIONS count chip removed (React island rebuilt).
- `COPENHAGEN-PALE-001` (SANDBOX item B) `[SHIPPED 1.50.438 + docx-worker deploy]` — Copenhagen Modern sidebar/band/table headers go pale (#DDE6F2) with dark ink. `readableInk()` luminance-aware ink in preview + export + worker; the worker palette gains a `ground` field so the pale panel is decoupled from `base` (which still drives main-column headings). Palette test 11/11. Owner visual verify owed (DOCX/PDF, both layouts).
- `PERSONALITY-KERNEL-QUIZ-001` `[SHIPPED 1.50.439]` — an 8-question deterministic quiz builds `personalInfo.personality` (six trait clusters with generic behaviour-evidence + an assembled work-style line + render constraints) and shows the user a written response. Settings → Personal "PERSONALITY KERNEL" card + a wizard-slide button. The kernel itself (GABRIEL_BG injection) already shipped 1.50.403. diag-personality-quiz 4/4.
- Docs: `docs/marketing/PROBLEM_STATEMENTS.md` (Terence design-thinking framing — general + per-persona + v~300 issues), `docs/personas/devon/` (software career-changer persona), Gabriel kernel de-leak (specialization → "Process · Products · People"; AntCV under the Kanzen experience entry; no Anita-domain bleed).
- Sandbox handoff (`SANDBOX_STUCK_CHANGES_2026-06-13`): **Item A** (build:app terser, not esbuild) and **Item C** (experience-tense AUTO per-role logic) verified ALREADY done; `pwa/mcp-probe.html` verified ALREADY removed (only index.html ships).

**Still OPEN (carried to next session):**
- `GRAMMAR-MARKER-SCROLL-LAG-001` `[OPEN][mobile]` — the grammar/spell underline markers lag or misalign against the text while scrolling on mobile (overlay re-sync on scroll/touch-move).
- `DOC-WIDE-CHATBOT-001` `[OPEN]` — an always-visible "Ask AI" launcher + a document-wide chat with cross-section apply (also the reliable mobile entry, since the per-element pill needs a text selection that collides with the browser's long-press). Next build.
- `TASK-CUSTOM-LLM-OVERHAUL-001` `[OPEN]` — key-only add, relay persist of `antcv:customLlms`, per-task model mapping, and wizard/proxy management. `LLM-ONBOARD-001/002` (1.50.412/414) built the core: model discovery (`{base}/models`) + auto-audit-on-save + dispatch of approved custom LLMs.

---

## SESSION REGISTRY — 2026-06-13 (overnight + day) — 1.50.405 → 1.50.417

Bugs + features handled this session, by ID (owner request: "any bugs or
features in this session, put with id in relevant registar").

**Fixed + shipped:**
- `GEN-MODELROLE-001 v1.1` `[FIXED 1.50.413]` — P0: writer-head reorder sent anthropic a foreign model id → parse_jd 404; backed out of raw-passthrough (role routing kept on the model-aware cascades). Workers deployed.
- `RELOAD-ATTRIBUTION-001` `[SHIPPED 1.50.413]` — wrap location.reload to name the caller on the next reset.
- `RELOAD-SPURIOUS-GUARD-001` `[SHIPPED 1.50.413]` — login-clean-reload only on real signed-out→in transition.
- `ROLE-FOUNDER-001` `[FIXED 1.50.414, consolidated 1.50.417]` — strip "Founder" from role titles (keep "Independent"/consultancy).
- `ROLE-DUP-001` `[FIXED 1.50.411, strengthened 1.50.414, consolidated 1.50.417]` — same-job/different-title merge.
- `LLM-ONBOARD-002` `[SHIPPED 1.50.414]` — custom-LLM Discover models ({base}/models) + auto-audit on Save.
- `OPTIONAL-ORDER-001` `[FIXED 1.50.415]` — Background (work history) leads the Optional-details block; patent/publications follow.
- `NORDIC-ONELINE-001` (tightened) + `STYLE-LINE-FIT-001` `[FIXED 1.50.415]` — nordic caps 95/55→88/48; proportionate LINE FIT on tight styles. Workers deployed.
- `SECTIONS-NORMALIZE-415` / `SECTIONS-CONSOLIDATE-001` `[SHIPPED 1.50.415/417]` — restore-proof recs-placement + founder + role-dedupe; three React effects consolidated into one sidecar (app.js −3 KB).
- `WIZARD-LOGIN-FLASH-001` `[FIXED 1.50.416]` — open-wizard gate honors auth token / existing data (no login flash).
- `OUTCOMES-QUANT-001` `[FIXED 1.50.416]` — SELECTED OUTCOMES = most quantified; a patent number is never an outcomes bullet.
- `ENHANCE-185-CAPTURE-001` `[SHIPPED 1.50.413]` — #185 live-capture trap (no synthetic repro).
- `PACKAGE-PALETTE-MIX-001` `[RE-VERIFIED FIXED]` — closed by APPJS-ID-SCHEME-UNIFY (1.50.387); owner repro green (diag-palette-orphan).
- `SALMON-PARALLEL-COLUMNS-001` `[RE-VERIFIED FIXED]` — export already fixed (client 1.50.295 + worker 1.14.39–41); 3 diags green.
- `SPEC-SEPARATOR-001` / `SPEC-SCOPE-001` `[FIXED 1.50.410/411]` — "Processes • Products • People" bullets; Gabriel-unsolicited-only scope.
- `PHOTO-GAP-EQUAL-001` `[FIXED 1.50.411 + docx 1.14.61]` — photo↔tools gap = photo↔top gap.
- `SECURITY-DEPS-001` / `SECURITY-WEEKLY-001` `[SHIPPED 2026-06-13]` — 0 production vulns; dev-only esbuild/vite advisories accepted+documented; weekly audit (scripts/security-audit.mjs + .github/workflows/security-audit.yml) + admin-escalation policy (docs/security/SECURITY_UPDATE_POLICY.md).

**Features shipped:**
- `PREVIEW-CHATBOT-001 stage 2` `[SHIPPED 1.50.412]` — rule-citation chips, multi-turn refinement, section-aware budgets.
- `PROCESSING-QUEUE-INDICATOR-001` `[SHIPPED 1.50.412]` — pink processing / yellow queued per-subsection badges.
- `WIZARD-LANG-SELECTOR-001` `[SHIPPED 1.50.412]` — two-table available/selected language picker; first = ★ default.
- `LLM-lab proxy relay` `[SHIPPED 1.50.412]` — CORS-blocked endpoints audit via the cv-proxy battery.

**Still OPEN (carried to next session):**
- `PDF-EXPORT-AUDIT-001` `[OPEN][HIGH]` — sections missing incl CL in exported PDF; spacing preview≠export; AI watermark on the side. Needs a worker export-vs-preview audit.
- `EXPORT-PRINT-DIALOG-001` `[OPEN]` — Export PDF opens print setup instead of direct download; CV shows analysis; needs refresh.
- `JD-FETCH-HOST-001` `[OPEN]` — jobs.nvidia.com grabbed wrong job + garbled text (non-Workday host).
- `KERNEL-HOBBIES-SPLIT-001` `[OPEN]` — hobbies not split into interests.
- `ANALYSIS-SALARY-001` `[OPEN]` — salary estimate (range + point); recruiter questions as CL answers.
- `SETTINGS-REORG-001` `[OPEN]` — spelling block collapse + move to Personal; topbar-language card Account→Personal; tense selector hidden.
- `CUSTOM-LLM-OVERHAUL-001` `[PARTIAL]` — done: discover + auto-audit. Remaining: relay/cloud persist; wizard selector (before CloudConvert key); proxy/demo-proxy add/remove; task-fit mapping.
- `WIZARD-ABOUTME-CONFLICT-001` `[OPEN]` — append-confirm when new about-me text contradicts stored data.
- `RELOAD-LOOP-001` `[INSTRUMENTED]` — subtab/topbar reset; attribution wrapper armed, awaiting next `[reload-who]` verdict.

---

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

A companion **feature registry** (open vs shipped features) lives at
`docs/FEATURES_REGISTRY.md`.

---

## RECONCILED 2026-06-12 (PM) — build:app fix + stale-tag sweep

Code change this pass + a status sweep of buried `[OPEN]` tags that later commits
resolved without re-tagging the old line. Where this block disagrees with an older
buried tag, this block wins.

**Code shipped (verified, no app.js change):**
- **BUILD-APP-BROKEN-001 / APPJS-REBUILD-001 → FIXED.** `package.json` `build:app`
  repointed from esbuild `--minify` (unsafe — prepends `"use strict"`, blue-screens the
  sloppy-mode bundle) to `npx --yes terser pwa/app.src.js -c -m -o pwa/app.js`. Identity
  round-trip gate PASSED: `npm run build:app` on the unedited source reproduces the
  committed `pwa/app.js` **byte-for-byte** (871,787 B, `cmp` clean), `node --check` OK,
  starts `(()=>{`, 0 `"use strict"`. `app.src.js` has no drift from `app.js`. `glDemo` is
  already `window.glDemo` (explicit). Source edits can now use the standard rebuild.

**Confirmed already-done (doc tag was stale / triage misread):**
- **DOCX-EXPORT-CORS-CPU-001** — client side is done (1.50.244/248): `describeNetworkFailure`
  readable message + `/health` warm-up + single retry + 413 special-case, surfaced via
  `alert(e.message)` on all four export paths. Correctly `[MITIGATED]` below; only the
  Workers-Unbound infra decision is residual (owner's).
- **AUTO-PAGEBREAK-CV-MIDGROUP-001** — the "measure against PDF-equivalent heights" fix
  landed as the **dual-map measurer** (e50973f / 1.50.350): preview map and export map each
  use their own A4 line. Owner export-verify owed (see updated entry below).

**Stale `OPEN` tags — ALREADY SHIPPED (don't chase the buried old lines):**
- SETTINGS-NAV-Z-001 / SETTINGS-SUBTAB-001 / APP-HISTORY-001 → **1.50.355** (`5cc08f5`)
- PRIVACY-DEMO-001 → **1.50.356** (`073de89`) · HOWCONTRIBUTE-001 → **1.50.354** (`bbf4d59`)
- GEN-UNSOL-002 → **1.50.358** (`ea30b2f`) (+ GEN-UNSOL-003 @ 1.50.391)
- PERF-003 / PERF-004 → **1.50.359** (`300cadc`) (PERF-002/005 deferred)
- PB-WORKER-SIDEBAR-FILL-001 → **1.50.320** (per-page; recent strata already corrects it)

**Still genuinely open (code):** PB-PREVIEW-GROUPNAME-EDIT-001
(inline preview group-name edit doesn't persist), LOGIN-GATE-001 (boot-order; largely shipped
via login-gate 302/303 + clean-reload 347 + the loading-gate loader — owner live-boot verify
the residual; app-shell path, diagnostic-first, do NOT blind-edit). Open features:
WIZARD-LANG-SELECTOR-001 (two-table upgrade), PROCESSING-QUEUE-INDICATOR-001.
*(2026-06-12 same-day correction: PB-WORKER-SIDEBAR-CONT-001 / PB-WORKER-SIDEBAR-PAGINATION-001
were re-verified FIXED this session — diag-sidebar-cont-e2e + diag-sidebar-export-page +
diag-twocol-ownerlike all green; see their updated entries below.)*

---

## AUTONOMOUS RIDE 2026-06-11 (PM) — photo-position exports + export-preview print + share target

Shipped 1.50.372→375 + docx-worker 1.14.53. Full narrative in
`docs/plan/NIGHT_RUN_2026-06-10.md` rounds 4–7.

- **EXPORT-PHOTO-POS-CLAMP-001** `[FIXED 1.50.373 — headless-verified]` — the REAL root
  cause of "bridge not in PDF/DOCX": `antcv-docx-client.js readPhotoPosition`'s VALID set
  lagged the app's picker. `band-overlap` was missing, so the client clamped every bridge
  export to `sidebar-top` BEFORE the payload left the browser (live-worker probes bypassed
  the client, which is why the worker always looked correct). `none` (the picker's Hidden
  value) was missing too, so a HIDDEN photo still exported. VALID is now a picker superset;
  `none`→`hidden`; photoSizePx forwards for every visible position. Locked by
  `pwa/test/unit/photo-position-forward.test.mjs` (imports the real module).
- **PHOTO-POSITIONS-EXPORT-001** `[SHIPPED worker 1.14.53 — needs owner Word/PDF look]` —
  export halves for the 1.50.371 picker positions: main top L/R switch from the photo-row
  table to a FLOATING wrapSquare image (text reclaims full width below — the preview
  crescent); main bottom L/R inline after sections; bridge-middle/bottom floating medallion
  page-anchored on the vertical seam (centre / 24px above bottom), wrap both sides.
  `workers/docx-worker/test/diag-photo-positions-export.mjs` (9/9). Deployed + live-probed.
- **EXPORT-PAGE2-001** `[FIXED 1.50.374]` — see the updated entry in the QA backlog section.
- **SHARE-TARGET-JD-URL-001** `[SHIPPED 1.50.375 — owner device verify owed]` — manifest
  share_target + `antcv-share-target-jd-375.js`; see FEATURES_REGISTRY (CLOSED).
- **PDF-BLANK-PAGE-001** `[FIXED docx-worker 1.14.54 — live-verified]` (owner 2026-06-11
  evening: "in the pdf there also is a blank page in middle" + lost REGULATORY CONTEXT
  heading/group label; = PDF-LAYOUT-002 in the QA index). The per-page body-row minimums
  filled each sheet EXACTLY (header budget + 13860 = 16838; PAGE_H−200). Word tolerated
  that; LibreOffice (/generate-pdf) renders the candidate band + row a sliver taller, so
  EVERY stretched row overflowed its sheet — the row split, its empty tail rendered as a
  blank page after each content page, and on page 1 the split swallowed the last sidebar
  lines. Reproduced live (2-page CV → 5 PDF pages, 2/4 blank); fixed with real slack
  (PAGE1_BODY_MIN 13260, CONT_BODY_MIN PAGE_H−600); re-probed live → 3 content pages, no
  blanks, heading + group label intact on page 1. Navy bar now stops ~0.5–1cm above the
  page edge — the cost of never overflowing LO. The owner's other observation (Customer
  Change role + ASPICE jumping a page earlier in the PDF than the preview) is the export
  break-map budget being more conservative than the preview's — EXP-PREVIEW-GAP-001
  territory, addressed upstream in e50973f the same day; re-export on a fresh tab to pick
  both halves up.

## INCIDENT 2026-06-10 (NIGHT) — production down: 7-byte app.js stub

- **PROD-STUB-001** `[RESOLVED — bbde379]` — a concurrent session's commit 7e8c584
  (EXP-HIDDEN-ROLES-001) committed pwa/app.js AND pwa/app.src.js as **7-byte stubs**
  (a redaction artifact from that environment's git filter), pushed to main, and it
  auto-deployed → live antcv.pages.dev/app.js served 7 bytes → **blank/broken PWA for all
  users (~1h)**. Detected via `git cat-file -s` (7 bytes) + live curl (7 bytes). RESTORED:
  committed the real 852KB bundle + real 1.98MB app.src.js from the last good commit 3268202
  on top of 7e8c584 (fast-forward, no force) → bbde379; PWA redeployed; live app.js back to
  852,577 bytes (verified). EXP-HIDDEN-ROLES-001's real source was never in git (stubbed),
  so it must be re-applied by its author. PREVENTION: see the guardrails in
  `docs/plan/NIGHT_RUN_2026-06-10.md` §1 — never commit app.js < 800KB / app.src.js < 1.9MB;
  always curl the live bundle size after a PWA deploy.


## OWNER REPORT 2026-06-10 (LATE) — CV sidebar preview↔PDF geometry

- **PREVIEW-PDF-SIDEBAR-GEOM-001** `[FIXED docx-worker 1.14.46 + 1.50.353 — needs owner visual]` —
  owner (CONFIRMED the section is the CV, not the CL) reports three sidebar preview↔PDF
  mismatches: (1) bullets extend past the other rows' text and the bullet→text gap is too
  wide; preview vs PDF pull the bullet in two different directions; (2) the gap between a
  sidebar heading and its underline rule is much larger in the PDF than the preview; (3) a
  publications line ("…Microengineering, 2009") wraps/splits in the PDF but not the preview
  → the sidebar text column is narrower in the export. FIXED (2) + (3) on the worker:
  sidebar cell L/R margins 144→120 DXA (= the preview's 8px, widening the export text column
  ~3px/side so lines that fit in the preview fit in the PDF); sidebar heading tightened
  (spacing before 80→40, after 40→30; bottom-border text gap space 4→2 pt) — main headings
  unchanged. (1) BULLETS — owner confirmed 2026-06-10: marker at the row's LEFT EDGE +
  tight (~half) gap, matched preview/PDF. FIXED (1.50.353 + worker 1.14.46): preview bullet
  sites now `paddingLeft:bulletIndent; textIndent:-bulletIndent` (first line at 0 → marker
  at the column edge; text + wrapped lines hang at bulletIndent), default bulletIndent
  24→14; BM marker margin 4→2 + dropped trailing space. Worker numbering antcv-bullet +
  antcv-sb-bullet → `left:210, hanging:210` (left===hanging → marker at the cell edge, text
  hangs ~14px), was main 360/200 + sidebar 280/160. Preview and export now share the
  marker-at-edge + ~14px hang. Verified: twocol-ownerlike + cl-list-cont + cv-table +
  palette 11/11 all still pass. Pixel-exact match needs the owner's visual loop (can't
  render the PDF headlessly).

## OWNER REPORT 2026-06-10 (EVE) — preview↔PDF (Cont.) gap

- **PB-WORKER-CL-LIST-CONT-001** `[FIXED docx-worker 1.14.44 — needs owner visual]` — owner:
  preview splits REGULATORY CONTEXT with "(Cont.)" but the exported PDF shows plain
  "REGULATORY CONTEXT", not moved to page 2. INVESTIGATION: the CV (two-column) chain is
  verified CORRECT end-to-end — the REAL measurer writes the export map
  `antcv:autoPages={regctx:{N:2}}`, the docx-client forwards `items[N]._page=2`
  (`pwa/test/diag-sidebar-cont-e2e.mjs`), and the worker splits the sidebar list with
  "REGULATORY CONTEXT (CONT.)" on a 2nd page-table (`diag-twocol-ownerlike.mjs`). The GAP:
  the worker's labeled_list / list / education (Cont.) split was gated to the CV SIDEBAR
  only (`isSidebar`); a list in the LINEAR COVER LETTER that the preview splits stayed
  un-split on export (no "(Cont.)", not moved). FIX (1.14.44): fire the split for the
  sidebar OR the linear CL (`isSidebar || ctx.doc==='cl'`). The linear path honours
  `pbBreakPara` as a real Word page break, so the segment chunking + "(Cont.)" heading now
  work there too. Safe superset — only engages when an item carries `_page>=2` (measurer-set);
  CV main-column lists are excluded. Verified: `workers/docx-worker/test/diag-cl-list-cont.mjs`
  4/4 (Cont. heading + real pageBreakBefore + no content loss); CV regressions
  (twocol-ownerlike, cv-table-width, palette 11/11) still pass.
  IF the owner's section is the CV sidebar (not the CL): the chain is already correct in
  code — re-export on a hard-refreshed app AFTER the preview shows the split, and confirm
  the docx-worker version stamped in the file is >= 1.14.40 (when the sidebar split landed).

## OWNER REPORT 2026-06-10 (PM) — analysis print completeness + Nordic style

- **ANALYSIS-PRINT-COMPLETE-001** `[FIXED 1.50.351 — verified headless]` — owner: now that
  the Analysis panel is unified, make sure ALL its sections are included when printing. The
  report builder (`antcv-analysis-report-pdf-360.js` `reportHtml`) rendered Overall fit,
  Strengths, Gaps, Recommendations, Assumptions, Confidence, Recruiter, Red flags, Questions
  — but the model also held **Tailoring decisions** (`tailoring_decisions`) and
  **Cover-letter strategy** (`cover_letter_strategy`) which were NEVER rendered. Added both
  sections (string-or-array tolerant `richBlock`) + EN/DA labels. Verified
  `pwa/test/diag-analysis-print-complete.mjs` 11/11 (every panel section appears in the
  exported report HTML). Sidecar-only (no app.js rebuild).
- **NORDIC-STYLE-GUIDANCE** `[memory saved + ENGINE WIRED, workers]` — owner supplied
  detailed DA cover-letter / CV / unsolicited / call-the-employer guidance; saved to
  assistant memory (nordic-cover-letter-style, nordic-cv-style, nordic-unsolicited-application,
  analysis-questions-to-employer). WIRED into the writing engine (proxy + demo-proxy,
  mirrored): (1) `writing-style-engine.js` — `nordic-minimal` carries a `guidance` block
  (CL = forward-looking statement of intent, not a CV recap; motivation in the employer's
  words; concrete tasks + how/methods/effect; personal qualities; value-to-employer; 1 page.
  CV = 5–7 line elevator pitch + bullet competencies + reverse-chron with results) and
  `cold-outreach` (alias `unsolicited`) carries the uopfordret dialogue-opener block. The
  guidance is emitted in `buildStyleSystemPreamble` ("Style guidance (MUST follow):") and is
  already injected into the LLM system prompt (Anthropic/OpenAI/Mistral/Gemini shapes) by
  both proxies' index.js. (2) `jd-analysis.js` — recommendations now also append 3–4
  JD-grounded "Call the employer and ask: …" items (the 4 standard Nordic call questions,
  adapted, no yes/no), which surface in the Analysis panel AND the exported report via the
  existing recommendations rendering (no PWA change). Verified: proxy writing-style tests
  35/35 (incl. new nordic + cold-outreach guidance + no-guidance cases); full proxy suite
  45/45; both proxies node-check OK. NOTE: nordic+unsolicited COMBO (nordic style used for
  an unsolicited app) still maps to the nordic CL guidance; the dedicated unsolicited
  framing lives on `cold-outreach` — pass an unsolicited flag later if both should compose.

## OWNER REPORT 2026-06-10 (PM) — kernel drops from history

- **KERNEL-HISTORY-KEEP-001** `[FIXED 1.50.349 + relay — needs owner check]` — owner: the
  unsolicited (kernel) showcase drops out of the application history once ~3 applications
  exist; it should ALWAYS be kept unless the user renews it. TWO drop points, both fixed:
  (1) CLIENT — the topbar history dropdown rendered only `Dl.slice(0,5)` (newest 5), so
  the kernel fell off once enough tailored apps accumulated. Now the unsolicited/kernel row
  (jd_company empty or "Unsolicited") is PINNED first, then up to 5 company-named apps.
  (2) SERVER — the application sweep kept the newest 5 by updated_at and could evict the
  kernel; now it caps only company-named apps to newest 5 and NEVER deletes the unsolicited
  row (excluded from both the count and the delete). Renewing the kernel UPSERTs the same
  row in place (same jd_hash), so "renew" still works. Verified: pwa unit test
  `kernel-history-keep.test.mjs` 5/5 (pinned first, kept at 3 apps, empty-company = kernel,
  no-kernel = newest 5, no duplication); the sweep SQL validated read-only against live D1
  (returns nothing wrongly deletable). app.src.js + terser rebuild (identity-clean) + relay.
- **ADV-INDENT-CONTROLS-001** `[PREVIEW LIVE 1.50.350 — export-parity pending]` — owner: add
  Advanced-settings controls to (a) increase the main content indent from the edge and
  (b) set the bullet-list / emoji-list indent. SHIPPED preview-side: an INDENTS group in the
  Advanced styles panel with two range sliders (Indent from edge 4–40px; Bullet / emoji list
  indent 10–60px), stored on the styleConfig (`mainEdgeIndent` 10, `bulletIndent` 24) so they
  persist/sync/reset with the style. The 5 preview bullet sites + `.antcv-document-main`
  padding read them; defaults reproduce the built-in look (no change unless a slider moves).
  Verified `pwa/test/unit/indent-controls.test.mjs` 4/4 + boot-smoke + salmon. FULL detail +
  the export-parity follow-up in FEATURES_REGISTRY (docx-worker still fixed; moving a slider
  changes preview only until the worker honours the tokens).

## OWNER REPORT 2026-06-10 (PM) — preview↔PDF geometry (page slide)

- **PREVIEW-PDF-GEOMETRY-001** `[FIXED docx-worker 1.14.43 — needs owner visual]` — owner:
  a slight CV line/spacing mismatch causes a page slide on page 1; suspected the
  core-competency-table-to-cell-edge distance and bullet-to-border distance differ between
  preview and PDF. MEASURED: the CV PREVIEW renders the competency table FULL main-column
  width, left-aligned and flush with the body text (app.src.js table case: CV
  wrapStyle = {marginTop:8}, no width cap). The WORKER rendered it `mainW-640` CENTERED —
  ~23px narrower and inset ~21px from the cell edge (vs the preview's ~10px). A narrower
  table wraps more → runs taller → shifts the page-1 break away from what the preview
  measurer computed (the measurer measures the PREVIEW geometry) → the page slide. FIX
  (docx-worker 1.14.43): CV competency table → `mainW-288` (full content width = cell
  width minus the two 144-DXA margins), LEFT-aligned; flush with the body text like the
  preview. CL keeps its intentional 0.8-width centered look. The page measurer (preview)
  and the export now share the same table width, so heights converge. Verified:
  `workers/docx-worker/test/diag-cv-table-width.mjs` 4/4 (CV left + full width 7689 DXA,
  CL centered + inset) + twocol-ownerlike + palette 11/11 still pass.
  BULLET HANG (owner follow-up 2026-06-10, FIXED 1.50.348): the owner asked to make the
  HTML preview bullets hang like Word. All 5 preview bullet render sites (text_bullets ×2 +
  its closing-clause continuation, the bullets/labeled list, and experience role bullets)
  changed from `paddingLeft:10` to a hanging indent `paddingLeft:24; textIndent:-14` — the
  marker first-line outdents to ~20px abs (matching Word's marker) and the body +
  continuation lines hang at ~34px abs (matching Word's ~33.6px text indent). Now the
  preview wraps like the export, which ALSO tightens preview↔PDF height convergence (the
  measurer measures the preview). terser rebuild identity-clean (head `(()=>{`, 0
  use-strict, node-check + boot-smoke OK); salmon full-app diag still PASS. Needs the
  owner's visual pass on a CV with a competency table + multi-line bullets.

## OWNER REPORT 2026-06-10 (AM) — CL preview watermark

- **CL-PREVIEW-WATERMARK-001** `[FIXED 1.50.343 — structural; needs owner visual]` — owner
  2026-06-10: the DEMO watermark shows on CV preview, CV export, and CL export, but is
  MISSING on the CL preview (badges fine). CAUSE: the CV preview renders app.js's own
  `__antcvDemoActive()` diagonal watermark inside each `antcv-page-row` (app.src.js ~38874),
  but the CL preview is a separate continuous-flow branch (`data-antcv-cl-flow`, ~39231)
  with NO in-app watermark — it relied solely on the `antcv-demo-watermark.js` sidecar
  `::after`, which (per the headless probe) does not reliably tag the CL paper. FIX: render
  the watermark in the CL flow's OWN React path, gated on the SAME `__antcvDemoActive()`
  signal as CV — an absolute, tiled (full-flow-height), pointer-events:none, aria-hidden
  DEMO overlay; the flow div is now `position:relative` to anchor it. Same render path as
  everything else = no sidecar timing dependency. app.src.js edit + terser rebuild
  (+469 bytes = the new element; head `(()=>{`, 0 use-strict, node-check + boot-smoke OK).
  Verified: `pwa/test/diag-cl-preview-watermark.mjs` (CL flow renders + is position:relative
  — the anchor); CL salmon regressions (double-salmon, one-pass) still PASS (the overlay is
  absolute/pointer-events:none, so the measurer is unaffected). The watermark itself is
  demo-gated (needs live `/config` demo state), so its visual presence needs the owner's
  eye on a demo CL preview.

## OWNER REPORT 2026-06-09 (EVE) — demo Generate 401s + LinkedIn "…see more"

- **DEMO-RELAY-IDENTITY-001** `[FIXED — relay; verified headless; needs worker deploy]` —
  demo user pressed Generate and ALL providers failed 401 `demo_requires_sign_in`, then
  the demo badge vanished; a retry tried only claude (router demotion after the auth
  failures). ROOT CAUSE: the relay (auth-25) routes demo-pinned users' LLM calls to
  `UPSTREAM_DEMO` (antcv-demo-proxy), but `rawForward` strips the `Authorization` header
  (a cv-proxy-era rule) and injects NO identity — so the demo proxy's demo-enforcement
  preflight saw an anonymous request and refused. The user's sign-in was VALID — the
  relay itself verified the JWT one line earlier. FIX (relay `rawForward`): on
  demo-mode forwards, re-verify the session JWT and inject
  `Cf-Access-Authenticated-User-Email` (the demo proxy's first identity source) +
  restore the Bearer; caller-supplied Cf-Access-* headers are now stripped on ALL
  forwards (anti-spoof). Verified: `workers/access-relay/test/diag-demo-relay-identity.mjs`
  5/5 (demo forward carries verified email + Bearer; paid forward still strips both;
  live demo-enforcement preflight accepts the forwarded request). Badge + provider
  demotion self-heal once calls succeed.
  FOLLOW-UP → **DEMO-RELAY-IDENTITY-002** `[FIXED — relay+demo-proxy; verified headless;
  armed via RELAY_FORWARD_SECRET]` — (security, pre-existing) the demo proxy trusted
  `Cf-Access-Authenticated-User-Email` from ANY direct caller — it is not behind CF
  Access, so a direct request to antcv-demo-proxy.workers.dev with a forged header
  bypassed sign-in and burned demo budget. FIX (shared-secret header): the relay sends
  `X-AntCV-Relay-Auth: <RELAY_FORWARD_SECRET>` on demo-mode forwards (after JWT
  verification; caller-supplied values stripped on all forwards); the demo proxy's
  `identityFromRequest` only trusts Cf-Access-* headers when that header matches
  (constant-time compare). With the secret UNSET the legacy trust applies, so the code
  deploys safely before arming; once armed on BOTH workers, forged direct requests get
  401 demo_requires_sign_in. The HS256 Bearer path (JWT_SECRET) is independent and
  unaffected. The paid proxy (cv-proxy) is untouched — it sits behind CF Access.
  Verified: `workers/demo-proxy/test/diag-relay-auth-gate.mjs` 5/5 (forged direct 401,
  wrong secret 401, relay-forwarded 200, Bearer 200, unarmed legacy 200) +
  `workers/access-relay/test/diag-demo-relay-identity.mjs` extended to 7/7 (demo
  forward carries the secret, caller guess replaced; paid forward carries none).
- **LINKEDIN-JD-SLUG-MORE-001** `[FIXED — proxy+demo-proxy; verified headless; needs worker deploy]` —
  URL-fetched LinkedIn JDs often came back with the description clamped behind
  "…see more" (and company info collapsed). CAUSE: the guest-API rewrite only matched
  NUMERIC paths `/jobs/view/4414211731`; the slug form the LinkedIn app's share sheet
  produces (`/jobs/view/senior-engineer-at-acme-4414211731`) missed the rewrite,
  fetched the consent-walled SPA page, and extraction returned the CSS-clamped text.
  FIX (fetch-jd-url.js, both proxies): take the LAST ≥5-digit run in the /jobs/view/
  path segment → guest jobPosting endpoint (full description, no clamp); also strip
  stray "Show more"/"Show less"/"…see more" button-label lines from extracted text
  (whole lines only — JD sentences containing the words are untouched). Verified:
  `workers/demo-proxy/test/diag-linkedin-jd.mjs` 5/5 incl. live guest-endpoint probe.
  Note: lnkd.in short links still skip the rewrite (resolve only after redirect) —
  acceptable; the consent-strip path still applies.

---

## OWNER REPORT 2026-06-09 (PM) — six issues

- **SALMON-CHURN-DISAPPEAR-001** `[FIXED 1.50.337]` — salmon splitters DISAPPEARED from
  both CV and CL. The salmon LOGIC is intact (all measurer diags pass), so this was a
  live-state issue: the 1.50.326 "quicker salmon" cadence speed-up (poll 1200ms + 120ms
  schedule + dense boot delays) raised measurer frequency enough that, under heavy editing
  + the other sidecars' churn, the **8-writes/4s circuit breaker tripped and froze the
  measurer before the breaks were written** → salmon gone (and it fed the #185 churn).
  Reverted the cadence to the calm/stable values (poll 3000, schedule 250, boot
  400/900/1800/3500); the 1.50.324 one-pass fix still makes the salmon appear in a single
  compute, so it stays responsive without the churn. Verified: salmon diags + boot pass.
- **REACT-185-EDIT-REGULATORY-001** `[NOT REPRODUCED on 1.50.341 — needs owner stack]` —
  React #185 ("Maximum update depth exceeded" — a setState that loops a render) crashed the
  app while the owner edited a REGULATORY section (debug log 18:08, many `button(submit)`
  taps) on the LIVE `app.js?v=1.50.334` (the OTHER session's build). Built a full-app stress
  repro `pwa/test/diag-react185-regulatory.mjs`: mounts the editor with a REGULATORY
  EXPERIENCE section + grouped regulatory sidebar, opens the section, then hammers 25 rapid
  field edits across 21 live inputs (input+Enter+change+blur) and 72 button clicks. On the
  current rebuilt `app.js` (1.50.341, from the committed source) this produces ZERO #185 /
  zero update-depth / zero DOM-mutation errors. Two things changed vs the crash build: main
  now carries the 1.50.341 rebuild (supersedes 1.50.334), and 1.50.337 reverted the measurer
  cadence speed-up that was a churn contributor. CANNOT pin the exact setState-in-render
  source without the debug-log stack (it maps to 1.50.334 line/col). QUESTION FOR OWNER:
  does #185 still reproduce after the 1.50.341 deploy? If yes, share the console stack
  (`Minified React error #185 … app.js?v=…:LINE:COL`) so it can be mapped to app.src.js.
- **DOCX-SIDEBAR-GREEN-001** `[FIXED 1.50.341 + docx-worker 1.14.42 — needs owner visual]`
  — owner confirmed 2026-06-10: navy fill stops mid-page; recolor Copenhagen Modern only.
  TWO root causes found. (1) COLORS: the PWA's Copenhagen Modern style map (app.src.js
  default `c` + `va.scandinavian`) set `mainHeadColor`/`mainLineColor`/`mainSubHeadColor`/
  `tableHeaderBg` to the dark green `#00746E`, and the export payload passes these tokens
  to the docx-worker where `mergeStyle` lets them OVERRIDE the worker palette (whose own
  copenhagen base is already navy). All four → `#283556`; `mainBulletColor` keeps the
  green accent; sidebar inner colors (bright teal #01B7BB on navy) untouched. The
  stylePackage drift-rederive effect propagates the change into persisted styleConfigs
  automatically (it keys on mainHeadColor). app.src.js edit + terser rebuild (identity:
  delta 0 bytes — same-length hex swaps; 8 tokens flipped 21→13 green / 21→29 navy; head
  `(()=>{`, 0 use-strict, node-check + boot-smoke OK). (2) FILL (also closes
  **PB-WORKER-SIDEBAR-FILL-001**): cell shading only reaches as far as row content, so
  short pages left the navy bar hanging mid-page. docx-worker 1.14.42: every two-column
  body row gets an `atLeast` height — page 1 = 13860 DXA (the measurer's USABLE_PDF
  924px budget; the header band owns the remaining ~2978), pages 2+ = PAGE_H−200 — so the
  sidebar cell stretches to the page bottom and can never overflow into a cascade split.
  Verified: diag-twocol-ownerlike.mjs extended (atLeast rows present, 13860 + 16638) +
  palette tests 11/11. OWNER CONFIRMED 2026-06-10: navy fill now reaches the bottom on
  every page incl. page 1 ("fills fully now") — fill closed. (Color recolor still wants a
  final visual nod, but the fill half is owner-confirmed.)
- **DEMO-FETCHJD-WORKERURL-001** `[FIXED 1.50.338 — verified headless]` — demo Fetch-JD
  errored "Configure Worker URL in Settings → API Keys first." The home Fetch-JD handler
  `Wn` (app.src.js) read `proxyUrl` directly with NO relay fallback; demo users have no
  proxyUrl. FIX: when `proxyUrl` is empty, fall back to `window.ANTCV_RELAY_URL` (set from
  relay-config.json → forwards `/api/fetch-jd-url` to the demo-proxy), with the same
  http→https + trailing-slash normalisation — matching Generate / Analyse-JD / recheck-fit.
  Robust even if the `371` proxyUrl seed hasn't run. app.src.js edit + terser rebuild
  (identity-clean: head `(()=>{`, 0 "use strict", +135 chars, node-check OK). Verified:
  5 unit tests (`pwa/test/unit/demo-fetchjd-relay.test.mjs`) — proxyUrl wins when set,
  relay used when proxyUrl empty, error path preserved when both empty, http→https; the
  fallback string is present in the rebuilt app.js; boot-smoke clean. (Live confirmation in
  demo still depends on the access-relay routing `/api/fetch-jd-url` to the demo-proxy.)
- **REGULAR-MODE-STALE-SETUP-001** `[FIXED 1.50.340 — verified headless]` — in regular
  (BYOK) mode the "⚠ Setup needed" warning + "🟡 Use demo" coin only cleared after a
  manual refresh; the DEMO preview watermark did the same. CAUSE: both chips are
  app.js-rendered gates (`M()` / `__antcvHasOwnKey()`) evaluated AT RENDER TIME; keys
  arriving after mount (cloud restore on sign-in, pasted in Settings) trigger no
  re-render — and same-tab localStorage writes fire NO 'storage' event. The watermark
  sidecar additionally memoised its demo decision FOREVER (`demoPromise`) and never
  removed the overlay. FIX (sidecars only, app.js untouched): new
  `antcv-setup-chips-live-372.js` (via the 357-loader) polls key-presence (1.5s) +
  storage/focus and live-hides/restores the two chips by exact leaf text, with a
  MutationObserver re-applying after React re-renders; `antcv-demo-watermark.js`
  1.50.340 keys its memo on key-presence, re-resolves on flip, and now REMOVES the
  overlay when demo is off. Verified: `pwa/test/diag-setup-chips-live.mjs` 4/4
  (boot-visible, same-tab key hides both + watermark, removal restores, re-render
  re-hidden).
- **ANALYSE-JD-BUTTON-POS-001** `[FIXED 1.50.339 — verified headless]` — owner confirmed
  2026-06-10: "same row, side by side". The 360 EXPORT & DETAIL row now holds BOTH
  buttons (`.arx-analyse` + `.arx-dl` in an `.arx-btns` flex group); the Analyse button
  delegates its click to the real run button inside the 356 JD block (run logic stays in
  one place) and mirrors its busy state. 356 hides its in-block copy while the row button
  exists (restores itself if 360 is absent) and pins the order JD-inputs → action row.
  Verified: `pwa/test/diag-analyse-jd-row.mjs` 4/4 (side-by-side, in-block hidden,
  delegation works, JD block above) + panel-order diag still 4/4.

## ANALYSIS PANEL 2026-06-09

- **ANALYSIS-PANEL-ORDER-001** `[FIXED 1.50.336 — verified headless]` — owner 2026-06-09:
  Assumptions + Recommendations were buried at the BOTTOM of the panel (inside the
  EXPORT & DETAIL block, `antcv-analysis-report-pdf-360`). Owner wants them in the UPPER
  part — **just below Overall Fit** — and **Confidence Review above the Download (and
  Upload-JD) buttons**. FIX (360, sidecar-only): split the panel block — a TOP block
  (`#antcv-analysis-report-top`, Assumptions + Recommendations) is inserted right after
  the app.js "Overall Fit" section, and the BOTTOM block (`#antcv-analysis-report`) now
  renders Confidence Review FIRST, then the EXPORT & DETAIL row (heading + Download). Both
  re-position via the existing `ensureBlock` re-render loop (MutationObserver + events).
  Verified `pwa/test/diag-analysis-panel-order.mjs` (synthetic panel): A+R land just below
  Overall Fit, Confidence sits above Download, A+R removed from the bottom block, overall
  order Overall Fit → A+R → … → Confidence/Download; 0 errors. NOTE: the Upload-JD / JD
  input is rendered by a SEPARATE sidecar (`antcv-analysis-panel-jd-block-356`) at the top
  of the panel; if the owner also wants that block moved below Confidence, it's a 356
  follow-up (not done here). Owner to visually confirm placement.

- **ANALYSIS-PANEL-MISSING-FIT-001** `[FIXED 1.50.335 — verified headless]` — owner 2026-06-09
  (screenshot): the in-app **📊 Application Analysis** panel shows only the JD input,
  **EXPORT & DETAIL**, **ASSUMPTIONS**, and **CONFIDENCE REVIEW**. The core of the
  analysis — **OVERALL FIT, STRONGEST FIT POINTS, GAPS / HONEST ASSESSMENT,
  RECOMMENDATIONS** — is MISSING from the panel but renders fully in the **export
  preview** (the branded Analysis report PDF). So the user can't see the actual fit
  assessment in-app, only after export.
  **ROOT CAUSE (traced):** app.js renders Overall Fit / Strongest Fit Points / Gaps /
  tailoring / CL-strategy in the panel from `yo` (the persisted `rationale` object) —
  see `pwa/app.src.js` ~42508 ("📊 Application Analysis") → ~42565 "Overall Fit"
  (`yo.fit_summary`), ~42614 "Strongest Fit Points" (`yo.top_fit_points`), gaps below.
  When the user clicks **Analyse JD**, `antcv-analysis-merge-344.js` fetches
  `/api/jd-analysis` and merges the result into `rationale` — but it copies ONLY
  `recruiter / red_flags / questions_in_jd / assumptions / recommendations /
  confidence_notes` (lines 175-183). It does **NOT** copy `fit_summary`,
  `top_fit_points`, `gaps`, `tailoring_decisions`, or `cover_letter_strategy` from the
  response. So when `rationale` doesn't already carry those (Analyse-JD run without a
  prior full generation, or after a rationale reset / a showcase/kernel state), the
  panel's Overall-Fit/Strongest-Fit/Gaps blocks render empty — while the **export
  report** (`antcv-analysis-report-pdf-360.js`) renders the FULL fresh jd-analysis
  response, so it shows everything. (The panel's EXPORT&DETAIL/ASSUMPTIONS/CONFIDENCE
  blocks show because 344 *does* copy assumptions/confidence_notes.)
  **FIX (small, ready):** in `antcv-analysis-merge-344.js`'s merge, also copy the fit
  fields when present — `if (a.fit_summary !== undefined) merged.fit_summary =
  a.fit_summary;` and likewise for `top_fit_points`, `gaps`, `tailoring_decisions`,
  `cover_letter_strategy` — so the panel and the export read the same complete analysis.
  Verify: run Analyse JD on a fresh/unsolicited state → the panel shows Overall Fit +
  Strongest Fit Points + Gaps + Recommendations (matching the export). **NOTE:** must
  preserve any fit fields already in `rationale` (only overwrite when the response
  actually provides them — guard with `!== undefined`, same as the existing copies).
  **SHIPPED 1.50.335:** `antcv-analysis-merge-344.js` now also copies `fit_summary`,
  `top_fit_points`, `gaps`, `tailoring_decisions`, `cover_letter_strategy` (guarded by
  `!== undefined`). Verified `pwa/test/diag-analysis-panel-fit.mjs`: `runMerge()` with a
  stubbed `/api/jd-analysis` lands all five fit fields in `rationale` (so the panel renders
  Overall Fit / Strongest Fit Points / Gaps / Recommendations), with assumptions +
  confidence_notes still carried (no regression); 0 console errors.

## EXPORT REVIEW 2026-06-09 — owner re-export feedback (1.50.321 / worker 1.14.41)

Owner rendered the 1.50.321 CV (PDF + DOCX) + CL DOCX. **CV page-split is improved**
(the salmon-push fix landed). Four remaining points, with **evidence-based root-cause
analysis from inspecting the attached DOCX + the deployed worker (1.14.41-sidebar-ratio)**.

**Shared root cause for #1–#3 (CV export) — RESOLVED by 1.50.320, verified end-to-end
2026-06-09.** The attached CV DOCX was **one outer two-column table with ~14 nested
section-wrapper tables, only 1 `pageBreakBefore`** — i.e. the per-page two-column model
(`buildTwoColumnDocument`, 1.14.39) computed `numPages = 1` and emitted a SINGLE
two-column table, which Word natural-flowed across 3 pages. `numPages` exceeds 1 only
when `__antcvPB` markers reach the worker (forwarded role.page / row_pages / sidebar
item `_page`). **Why this CV had none:** its SIDEBAR (REGULATORY CONTEXT) overflowed in
its FIRST group, which hit the salmon-push bug — `snapToGroup` returned 0, so the
measurer wrote NO `autoPages[regctx]` break at all. With the sidebar map empty, the
client's `pageFor()` (which HAS forwarded sidebar auto-breaks since 1.50.313) had nothing
to stamp → no `_page` → no `__antcvPB` → natural-flow fallback. **1.50.320 fixed the
measurer** to write the break even when the first group overflows, which closes the whole
chain. VERIFIED end-to-end this session (no PDF renderer needed — structural):
- `pwa/test/diag-sidebar-export-page.mjs` — the client forwards the sidebar `labeled_list`
  break as `item._page=2`, COORDINATED with `experience role.page=2`.
- `workers/docx-worker/test/diag-twocol-ownerlike.mjs` — owner-shaped payload → the worker
  emits **2 top-level page tables** (per-page engaged), the `labeled_list` splits with a
  "REGULATORY CONTEXT (Cont.)" heading, **navy sidebar shading on every page**, the **AI
  disclosure appears once on the LAST page** in the `ai_wm_side` column, zero content
  loss/dup.
**OWNER ACTION: re-export the CV on ≥1.50.320** (the bad export was pre-1.50.320). The
three symptoms below should be resolved; confirm on the rendered PDF/DOCX. Per-symptom
status with the per-page model engaged:

- **AI-NOTICE-WRONG-SIDE-001** `[FIXED via per-page 1.50.320 + dynamic re-position 1.50.328]`
  — **1.50.328 (owner 2026-06-09 "move the AI notice when section length changes"):** the
  preview anchor (`antcv-watermark-page-anchor-341`) computed the right corner but only
  re-ran on sections-updated / item-pages-changed / resize — so when a section grew/shrank
  (re-pagination) the notice went stale on the old column. Added `antcv:auto-pages-changed`
  (the re-pagination signal), `antcv:item-align-changed`, `input`, and a 1.5s poll, so the
  notice re-measures the last page and MOVES to whichever column now ends higher; the
  recomputed `ai_wm_side` is re-stashed for the export. Verified
  `pwa/test/diag-wm-move-on-length.mjs` (notice on the emptier column; after the column
  heights swap + an auto-pages-changed pulse it MOVES to the other column; boot clean).
  — owner: "AI notice is on the text heavy side." CONFIRMED in `buildTwoColumnDocument` (index.js:24477,24519): `wmInSidebar
  = ctx.aiWmSide ? ctx.aiWmSide === sidebarSide : false`; when `ai_wm_side` is ABSENT it
  defaults to `false` → the disclosure is pushed onto `mainChildren` (the dense column).
  Two contributing causes: (a) with `numPages=1` the notice lands at the bottom of the
  single main cell on the last page = the text-heavy side; (b) `ai_wm_side` is computed
  by `antcv-watermark-page-anchor-341` from the PREVIEW's last page, but the export's
  last page ≠ the preview's last page (different page count — see #3), so even a
  forwarded side can be for the wrong page. Real fix is coupled to engaging the per-page
  model (below) so the last page's empty column is known to the worker. NOTE: the worker
  honours a forwarded `ai_wm_side` correctly — the gap is that it's absent/stale.
- **PB-WORKER-SIDEBAR-FILL-001** `[FIXED via per-page 1.50.320 — owner re-export to confirm]`
  — owner: "first page sidebar color does not reach end of page." With `numPages=1` the navy sidebar is
  ONE table cell whose row Word splits across pages; the cell shading only fills to the
  row's content height on page 1, not the page bottom. The per-page model (one table per
  page, sidebar cell navy on every page) is exactly what closes this — but it only
  engages when `numPages>1`.
- **PREVIEW-PDF-PARITY (length)** `[LARGELY FIXED via per-page 1.50.320 — minor residual]`
  — owner: "the 2nd page slid a bit to the 3rd page … still a minor difference in length."
  With per-page engaged the export now honours the SAME coordinated breaks as the preview
  (page boundary = table boundary), so the gross length mismatch is gone. Residual: the
  break POSITIONS are still measured in preview px (≈ the Word line via WORD_INFLATE), so a
  borderline page can land one unit off — bounded by the per-page model (never a
  mid-content cut). Further parity tuning (WORD_INFLATE, the `Vi` estimator geometry) is
  tracked under PREVIEW-PDF-PARITY-001 and needs a rendered-PDF visual loop.

**The unifying fix is LIVE (1.50.320), not deferred.** Engaging the per-page two-column
model required only that the measurer WRITE the sidebar break (1.50.320) — the client
forwarding (`pageFor` → `item._page`, 1.50.313) and the worker per-page renderer (1.14.39)
were already in place. The 1.50.215 scramble was a property of the OLD single-table model,
which the per-page model replaces (page boundary = table boundary → columns can't desync;
verified no header-isolation / mid-role-cut / dup in `diag-twocol-ownerlike.mjs`). So the
whole cluster closes on an owner re-export at ≥1.50.320; no risky new forwarding was
needed. (1.50.325 only corrected the now-stale "stood down" comment in the docx-client to
document this.)

- **CL-NO-SALMON-001** `[RESOLVED — owner confirms salmon now appears (slowly)]` — owner
  2026-06-09: "salmon appeared in CL eventually." The salmon DOES render; it was the
  owner's live-state lag (the measurer is sticky + one-break-per-compute, gated by a
  fingerprint + 1.5s cooldown, so a multi-page CL paginates over several slow cycles).
  **CL-SALMON-SLOW-001** `[FIXED 1.50.324 — verified headless]`: paginating a 3-4 page CL
  took several seconds because the CL pass wrote only ONE break per compute and leaned on
  incidental re-triggers (a content-height change re-tripping the source fingerprint) to
  paginate the rest. FIX: break EVERY spanning section in one pass — matching the CV
  passes above, which already loop all sections (so this removes a CL-only inconsistency,
  not a safety mechanism; the source-fingerprint gate + 1.5s cooldown + 8-writes/4s
  circuit breaker still guard against churn, and this is now ONE write-cycle not N).
  Verified `pwa/test/diag-cl-onepass.mjs`: two spanning sections both break in a single
  settle with correct cumulative pages (2 and 3), the page-2-internal section between
  them is skipped; no regression across the CL/sidebar measurer tests + boot-smoke.
- **CL-DOUBLE-SALMON-001** `[FIXED 1.50.323 — verified headless]` — owner 2026-06-09: the
  CL salmon "appeared twice for the same page" — two "▼ PAGE 2 ▼" bars (before HOW I
  WOULD CONTRIBUTE (Cont.) and before FOUNDATION). ROOT CAUSE in the measurer's CL pass
  (`antcv-auto-pagebreak-block-001.js`): the gate `bottom - clTop <= clLimit ? skip` only
  compared against the PAGE-1 line, so ANY section living entirely on page 2 (whose bottom
  is naturally > clLimit) was flagged as overflowing and given its own **hard-coded** page-2
  break across successive cycles → multiple "PAGE 2" salmons. FIX: only break a section
  that actually SPANS a page boundary (`floor(top/clLimit) !== floor(bottom/clLimit)`), and
  label the salmon with the REAL cumulative page (`floor(top/clLimit)+2`, capped at 4) — the
  crossing item / table row / whole-section all use it. So a page-2-internal section draws
  NO salmon, and a section that genuinely crosses into page 3 reads "▼ PAGE 3 ▼". Verified
  `pwa/test/diag-cl-double-salmon.mjs` (pre-seed contribute broken: foundation on page 2 is
  NOT broken; tail spanning into page 3 is labeled 3 in both maps) + no regression in
  `diag-cl-salmon` / `diag-cl-midlist-measurer` / sidebar tests + boot-smoke 0 errors.

- **CL-GHOST-COMPANY-001 (ghost-hunt hardening)** `[FIXED 1.50.330 — verified headless]` —
  owner 2026-06-09: "make sure the fetch still passes ghost hunt and prevents
  hallucinations — otherwise we'll see Terma again." The 1.50.329 empty-field retry pushes
  the LLM to fill WHO/WHY/bullets, which could surface a hallucinated company. Audited the
  existing ghost hunt and found a real HOLE: the force-Unsolicited + body-scrub branch
  only fired on `__explicitShowcase || (!__jdNamedCompany && io.company==='Unsolicited')`
  — so when the LLM hallucinated a company with NO JD present, `__jdNamedCompany` went true,
  the branch was SKIPPED, and the ghost was KEPT in meta AND the unscrubbed body. FIX:
  (1) the branch now also fires for EVERY no-JD generation (`__noJD`), since with no JD any
  meta.company is a hallucination → always force Unsolicited + scrub; (2) the scrub now
  NEUTRALISES the ghost in place (→ "your organisation" / "your organisation's") instead of
  deleting whole sentences and leaving the literal "[Company]" placeholder; (3) the scrub
  now also covers `contribute_intro` + `contribute_closing` — where the original
  "help **Terma** build…" ghost actually lived and was being missed. The 1.50.329 neutral
  fallbacks are company-free, so the combined chain (prompt forbids naming a company →
  scrub neutralises any slip → neutral fallback if a field ends empty) is ghost-free and
  placeholder-free. Verified: 6 new unit tests (`test/unit/cl-ghost-hunt.test.mjs`, 54/54
  pass) — no-JD+hallucinated-company forces Unsolicited, the contribute_closing ghost and
  its possessive are neutralised, multi-word names handled, tailored path unaffected;
  rebuild identity-clean (head `(()=>{`, 0 "use strict", +182 chars), boot-smoke 0 errors.
- **CL-EMPTY-BODY-FIELDS-001** `[FIXED 1.50.329 — verified headless]` — owner 2026-06-09:
  an exported unsolicited CL showed the TEMPLATE placeholders for WHO I AM ("[WHO I AM —
  …]") and WHY THIS POSITION, and NO bullets under HOW I WOULD CONTRIBUTE (intro + closing
  present, items empty). The neutrality fix held (no company named). ROOT CAUSE (two):
  (a) the post-processor fallback chain was `a(F.who_content) || a(e.content) || neutral`,
  but `e.content` is the me() placeholder and `a()` returns it verbatim (truthy), so the
  PLACEHOLDER leaked instead of the neutral fallback (same for WHY); (b) the partial-
  response gate accepted `n ≥ 3 of 5` critical fields — foundation×2 + closure alone make
  3, so an empty who+why+bullets response was ACCEPTED, and `contribute_items` wasn't
  checked at all. FIX (app.src.js, terser rebuild): `__clReal()` treats a bracketed
  placeholder as empty so who/why fall through to the neutral fallback; `__neutralContrib
  Items` guarantees 3 HOW-I-WOULD-CONTRIBUTE bullets even in a no-JD/non-showcase run; the
  gate now counts `contribute_items` (6th field) and requires `≥4 of 6` so an empty-body
  draft is RETRIED for real content; and the no-JD prompt clause now explicitly tells the
  LLM to fully write who/why/bullets. Verified: 5 new unit tests
  (`test/unit/cl-empty-body-fallback.test.mjs`, 48/48 pass) — placeholder rejected →
  neutral, real content kept, the owner's exact failing response (n=3) now retries; rebuild
  identity-clean (head `(()=>{`, 0 "use strict", +910 chars), boot-smoke 0 errors.

## EXPORT REVIEW 2026-06-08 (PM-2) — owner re-export feedback

Iterating on real CV/CL exports (owner rendering .docx + PDF). Shipped + open:

### Fixed this round
- **PB-WORKER-SIDEBAR-RATIO-001 follow-up** `[FIXED 1.50.321 — verified headless]` — the
  worker (1.14.41) already derives the two-column split from `payload.sidebar_ratio`
  (clamped [0.2,0.55], default 0.33), but the docx-client never forwarded it, so a
  user-ADJUSTED splitter still exported at the 0.33 default. The client now reads
  `cvSidebarRatio` (localStorage, preview default 0.33) and forwards it as
  `sidebar_ratio`, clamped to the worker's band; an UNSET ratio is omitted so both
  sides keep the 0.33 default in step. PWA-only (no worker deploy). Verified
  `pwa/test/diag-sidebar-ratio-forward.mjs`: adjusted 0.42 forwarded; 0.62 clamped to
  0.55; unset omits the field. Boot-smoke 0 errors; export-autobreak regression OK.
- **PB-WORKER-CONT-DOUBLE-001** `[FIXED docx-worker 1.14.33 — owner check]` — page-2
  main showed TWO headings: the section-wrapper `tableHeader` repeat
  ("PROFESSIONAL EXPERIENCE", bare) AND the role.page "(Cont.)" heading. Suppressed
  the tblHeader repeat for `type==="experience"` (it owns its "(Cont.)" via the
  role.page path); all other sections keep the repeat.
- **PREVIEW-CONT-HEADING-LEGACY-001** `[FIXED 1.50.299]` — preview continuation
  heading was a hardcoded legacy "EXPERIENCE (CONT.)"; now uses the experience
  section's real title → "PROFESSIONAL EXPERIENCE (CONT.)" (matches the export).
- **CL-PAGINATE-001** `[FIXED docx-worker 1.14.32 — owner check]` — CL flows to 2+
  pages (was clipping to 1).
- **WORD_INFLATE line-drift** `[1.50.298 — owner tuning]` — CV 2nd-page content now
  propagates correctly; factor 1.11 tunable.

### OPEN — owner re-export feedback
- **PB-PREVIEW-SIDEBAR-SALMON-PUSH-001** `[FIXED 1.50.320 — verified headless]` — in the
  CV PAGE-BOX preview the long SIDEBAR (REGULATORY CONTEXT) did NOT break at the salmon
  line — its content **pushed the salmon DOWN** instead of flowing THROUGH it (owner
  2026-06-08: "make sure the sidebar text is going through the salmon and not pushing
  the salmon"). **ROOT CAUSE (narrower than the original hypothesis):** the measurer DOES
  run its sidebar pass for the preview base (`compute(USABLE, PREVIEW_KEY)`) and DOES
  write `antcv:autoPagesPreview[sid]` when the overflow falls in a LATER group — the read
  path (`__antcvEffBucket`→`__antcvAutoPB`→flatMap `o`, app.src.js ~38547) then splits
  correctly (confirmed: a synthetic sidebar with deep overflow group-snaps fine). The
  failing case is when the sidebar's **FIRST group alone overflows the A4 line**: the
  first overflow item snaps back to group-start `0` (`snapToGroup` has no earlier
  boundary to fall to), so `br < 1` and the section pass wrote **NO break at all** (the
  `if (br >= 1)` guard) in EITHER map. The whole sidebar then rendered in one page-box
  (the sidebar column has only `minHeight`, no cap — app.src.js ~38808) and pushed the
  salmon far below A4. **FIX (sidecar-only, no app.js rebuild):** in
  `antcv-auto-pagebreak-block-001.js compute()`, when the group snap yields `br < 1`,
  fall back to the RAW overflow item (`br = idx`) so the sidebar breaks AT the A4 line
  and flows through the salmon — a single group taller than a page cannot be kept whole
  anywhere, so a mid-group cut at the line is correct. Verified headlessly:
  `pwa/test/diag-sidebar-fullapp.mjs` (huge first group → was one 1712px box with no
  break, now two 1123px boxes, `autoPagesPreview={regctx:{15:2}}`) +
  `diag-sidebar-salmon-push.mjs` (later-group overflow still group-snaps) + boot-smoke 0
  errors + 38/38 unit tests. Related: [[PB-WORKER-TWOCOL-PAGED-001]], 1.50.316/318.
- **PB-WORKER-TWOCOL-PAGED-001** `[VERIFYING docx-worker 1.14.39 — owner export]` —
  **per-page two-column tables for Word** (owner spec 2026-06-08, supersedes
  PB-WORKER-SIDEBAR-CONT-001 + PB-WORKER-SIDEBAR-PAGINATION-001 + PB-WORKER-SIDEBAR-FILL-001;
  this is the deferred PB-007 two-column pagination). SHIPPED 1.14.39: `pbBreakPara()`
  tags every break paragraph (`__antcvPB`); renderSection now splits experience (by
  role.page) + tables (by row_pages) + sidebar lists (by item._page) into TOP-LEVEL
  segments; `buildTwoColumnDocument` splits each column on the markers and emits one
  `[SIDEBAR_W, MAIN_W]` table per page (header band on page 1 only, sidebar navy on
  every page). Structure-verified headlessly via `test/diag-twocol-paged.mjs` (drives
  the live index.js handler, unzips document.xml): coordinated 2-page CV → exactly 2
  top-level tables + 1 body-level break + cascade + zero content loss/dup; no-break CV
  → 1 table; CL linear unaffected. AWAITING owner Word export confirm. Original spec
  below: Today `buildTwoColumnDocument` ([index.js:24449](../../workers/docx-worker/src/index.js)) builds
  ONE table: row0 = header (colSpan 2), row1 = [sidebarCell(ALL sidebar), mainCell(ALL
  main)]. When it overflows, Word splits that single tall row badly (the owner: "in
  word the break is not rendered properly"). **Owner's prescribed fix:** generate a
  SEPARATE table per page, each with the SAME sidebar+main column widths
  (`[SIDEBAR_W, MAIN_W]`); page 1 keeps the header band; each page N>1 is a fresh
  table preceded by a page break, holding the sidebar content from its "(Cont.)"
  point to the end in the sidebar cell and the main content from its "(Cont.)" point
  to the end in the main cell. **Plan:** (1) add `renderColumnPaged(secs, ctx,
  isSidebar)` → `{1:[els],2:[els],…}` bucketing each column's rendered content by
  page: walk sections, increment `curPage` at every break point (section
  `pageBreakBefore`, item `_page≥2`, role `page≥2`, table `row_pages`, text_bullets
  `bullet_N`), assign all content to `curPage` until the next break (NO inline
  pageBreakBefore — the table boundary IS the break); continuation segments still get
  their "TITLE (Cont.)" heading. (2) Rewrite `buildTwoColumnDocument` to compute
  `sidebarByPage` + `mainByPage`, take `maxPage`, and emit one `Table` per page —
  page 1 with the header row, pages >1 with a leading `pageBreakBefore` paragraph and
  only the body row `[sidebarCell_pN, mainCell_pN]` (same `colWidths`, sidebar keeps
  its navy `shading` so the bar fills every page — also closes
  PB-WORKER-SIDEBAR-FILL-001). (3) Header repeat on page 2+ is GATED OFF by default
  (see PAGEBREAK-STYLE-OPTIONS-001). **Risk/verification:** sweeping rewrite of the CV
  builder; the live `index.js` bundle exports only the fetch handler (needs CF env),
  so set up a node harness that POSTs to the handler with a stub env, unzip the
  resulting `word/document.xml`, and assert: N tables = N pages, one page break
  between each, header present once, and zero content loss/dup vs the section input.
  Hold until that harness is green before deploy. NOTE: the **preview** already
  paginates into page-boxes natively; this is the EXPORT (Word) half only.
- **PB-WORKER-SIDEBAR-CONT-001** `[FIXED — verified headless 2026-06-12]` — a SIDEBAR
  section (REGULATORY CONTEXT) continuing onto page 2 got the bare title repeat, NOT
  "(Cont.)". Closed by the per-page two-column rework (worker ≥1.14.39/40): the
  docx-client forwards the measurer's EXPORT break map (`antcv:autoPages`) as
  `item._page` on sidebar list items, the worker splits the column into top-level
  page segments and emits "TITLE (CONT.)" headings (double-"(CONT.)" dedup in
  1.14.40; localized suffix in 1.14.58). Verified: `pwa/test/diag-sidebar-cont-e2e.mjs`
  (REAL measurer → client `_page` forwarding) + `workers/docx-worker/test/diag-twocol-ownerlike.mjs`
  (worker (Cont.) segments) — both green 2026-06-12.
- **PB-WORKER-SIDEBAR-PAGINATION-001** `[FIXED — same mechanism as SIDEBAR-CONT-001]`
  — sidebar Word pagination "still problematic… was better before." The sidebar no
  longer relies on Word natural flow: forwarded `item._page` breaks cut the column
  cleanly at the measurer's line (no mid-item chop), coordinated with the main
  column's role/table breaks (`pwa/test/diag-sidebar-export-page.mjs` green
  2026-06-12: sidebar `_page` + experience `role.page` land on the same page).
- **PREVIEW-SUBTITLE-RACE-001** `[FIXED — antcv-subtitle-sequence-368.js, verified headless]`
  — entering the preview for an Unsolicited application showed the TEMPLATE
  specialisation placeholder ("[Specialisation — 1-3 focus areas…]") until the user
  switched applications and back. The subtitle/`io` meta wasn't populated on the first
  preview render (the late `[Read from Cloud]` row carried the real subtitle, but the
  header had already painted). FIX (shipped by a concurrent session,
  `antcv-subtitle-sequence-368.js`, wired at index.html:586): on boot + every
  edit→preview transition it resolves the subtitle in priority order (live meta → active
  application row [local cache, else relay GET] → kernel-showcase meta [local, else
  relay]), commits the first non-placeholder value into `meta.subtitle`, and nudges the
  editor — so the first paint is correct and the local value is captured for next time.
  Only ever writes `meta.subtitle`; one-shot relay GETs, fully guarded. CONFIRMED wired +
  working headlessly (`pwa/test/diag-subtitle-sequence.mjs`): with a placeholder
  `meta.subtitle` + a local app-cache row carrying the real subtitle, the sidecar
  installs, detects the placeholder, and commits the real value on boot (0 errors).
- **CL-PDF-PRINT-PATH-001** `[RESOLVED — stale; verified 2026-06-09]` — re-audited: the
  PDF export button calls `window.exportPdfViaWorker({ doc: Lt, … })` for BOTH CV and CL,
  and `exportPdfViaWorker` builds the payload via `buildPayload` (which sets
  `layout: 'linear'` for CL) and POSTs to `/generate-pdf` (CloudConvert). So the CL PDF
  ALREADY uses the worker CloudConvert path with a proper `CoverLetter_<name>_…` filename
  (`buildFilename`); `window.print` (`kl()`) is only the fallback when no server PDF is
  available (no CloudConvert key / worker down). The owner's recent CL PDFs were
  worker-rendered (CloudConvert-quality layout + correct filename), confirming this. The
  entry predates the CV/CL unification of the PDF path. **Both halves verified headless
  (2026-06-09):** the print HTML builder emits `<title>Cover Letter — <name></title>` and
  `kl()` rewrites it to the download name. `pwa/test/diag-cl-print-filename.mjs` forces the
  print fallback for a CL and confirms the print iframe's `<title>` =
  `CoverLetter_<name>_<role>_<company>` (drives the Save-as-PDF filename) — no generic
  "AntCV" name. So even the fallback names the file correctly; the worker path is primary.
- **LINKEDIN-JD-FETCH (demo-proxy)** `[VERIFIED 2026-06-09]` — owner: "check that demo-proxy
  can fetch LinkedIn JD." The concurrent session's L1/L2/L3 (`workers/demo-proxy/src/fetch-jd-url.js`)
  is sound: L2 `rewriteJobUrl` turns a `/jobs/view/{id}` or `?currentJobId={id}` URL into the
  public guest endpoint `linkedin.com/jobs-guest/jobs/api/jobPosting/{id}` (no consent wall),
  the fetch sends a desktop-Chrome UA, and L1/L3 extract the JD + strip consent/footer noise.
  Verified `workers/demo-proxy/test/diag-linkedin-jd.mjs`: driving `handleFetchJdUrl` with a
  LinkedIn `/jobs/view/…` URL + a mocked guest fragment → rewrite fires, JD body extracted,
  cookie/consent noise stripped; plus a LIVE probe that hit the real guest endpoint (HTTP 200,
  HTML JD fragment) — so the path works end-to-end. (Code is the concurrent session's; needs a
  demo-proxy deploy to be live in production.)
- **EXPORT-PREVIEW-FEATURES-001** `[3 of 4 SHIPPED — (d) remains][enhancement]` — owner
  requests for the export-preview UI: (a) JD-analysis as a 3rd quick-export button —
  SHIPPED 1.50.377 (renders only when a report exists, delegates to the 360 exporter
  hook); (b) choose download directory — SHIPPED 1.50.380 ("Ask where to save" toggle
  in the modal, Chromium File System Access save picker in the docx-client, cancel
  aborts cleanly, fallback to the classic download); (c) page selector — SHIPPED
  1.50.374 (numbered chips scroll the iframe to each page-row); (d) modern-ATS vs
  legacy-ATS compare preview — STILL OPEN (needs a design: the legacy tier is an
  export-palette flag, not preview-renderable without a re-render pass).
- **CL-GHOST-COMPANY-001** `[FIXED (generation) 1.50.322 — regenerate to clear stale content]`
  — an UNSOLICITED cover letter (no JD) referenced a specific company ("…help **Terma**
  build…" in HOW I WOULD CONTRIBUTE, "Terma's focus…" in WHY THIS POSITION; owner
  re-confirmed 2026-06-09). **ROOT CAUSE found in the generation prompt** (`app.src.js`
  ~21229): the prompt UNCONDITIONALLY instructs the LLM to write company-specific
  closings — `contribute_closing`: "My aim would be to help **[Company Name]** build…"
  and `closure_content`: "support **[exact company name from JD]**…" — with NO
  unsolicited branch. With no JD the LLM fills that slot from prior context / background
  (a real company → "Terma"). The showcase neutral-override (the `p`-gated CL rewrite at
  ~22157, which DOES produce company-neutral text) was bypassed for this run. Compounding
  vector: the prompt also injected "PRIOR RUN CONTEXT (carry these JD-specific signals
  forward…)" from `yo.supporting_context`, so a previous tailored (Terma) run's context
  leaked into the open application. **FIX (1.50.322, app.src.js — terser rebuild, identity
  gate passed):** when there is no JD (`c` empty ⇒ `__noJD`), (a) prepend a hard
  company-neutrality clause to the generation prompt ("OPEN / UNSOLICITED APPLICATION — NO
  TARGET COMPANY … Do NOT name ANY specific company ANYWHERE … 'your organisation' …
  meta.company MUST be empty"), consistent with the existing "extract company ONLY from
  the JD" rule; and (b) do NOT carry `yo.supporting_context` forward (`!__noJD` gate).
  Verified: 5 new unit tests (`test/unit/unsolicited-company-neutral.test.mjs`, 43/43
  pass), the neutrality string is present in the rebuilt `app.js`, boot-smoke 0 errors,
  identity round-trip gate passed (terser rebuild of unedited source boots clean).
  **NOTE — applies to FUTURE generations:** an already-contaminated unsolicited draft
  still holds the old "Terma" text until the owner **regenerates** the unsolicited
  showcase (Settings → "Regenerate showcase", or Generate without a JD). The fix prevents
  re-contamination. Residual (not addressed): a deterministic render-time scrub of
  existing stale content + hardening why the `p` showcase-override was bypassed — left as
  follow-ups since both need the owner's live state / are higher-risk.
- **AUTH-STATE-MISMATCH-001** `[SOFTENED 1.50.312]` — the Google OAuth redirect
  occasionally returns with the CSRF state missing/mismatched (sessionStorage lost
  between redirect-out and return). Still aborts safely (never signs in on an
  unverified token); message changed from the alarming "possible CSRF" to a gentle
  "Sign-in didn't complete — tap Sign in again." Root cause (sessionStorage loss)
  not yet pinned — needs a repro.

---

## SESSION 2026-06-08 — kernel recovery, LLM cost-quality router, salmon, wizard language

Production reached **PWA 1.50.292**; docx-worker + proxy redeployed. All items
pushed to `main` + `claude/antcv-roadmap-bugs-L9Sqa` +
`plan/2026-06-06-analysis-followups` (kept identical).

### Fixed / shipped this session

- **KERNEL-SHOWCASE-EMPTY-SLOT-001** `[FIXED 1.50.274]` — `/api/kernel-showcase`
  slot held empty `{cv:[],cl:[]}` + real meta → restore produced a headline-only
  husk and a re-save loop kept it empty. Guard `__antcvHasRealSections` on all
  write/restore sites; corrupted slot ignored → regenerate (self-heal).
- **KERNEL-CORE-EMPTY-001 / CORE-PROTECT-001** `[FIXED 1.50.275]` — empty arrays
  are truthy so a husk left the editor BLANK instead of falling back to `me()`;
  fixed both loaders. Cut on a CORE section now HIDES it (on:false) not deletes
  (hide-over-delete).
- **KERNEL-REGEN-DEADLOCK-001** `[FIXED 1.50.277/278]` — Cs() refused to
  regenerate while the generated-flag was set though content was gone. Guard now
  blocks only on REAL (template-aware) content / meta.company / in-flight /
  pending cloud restore; + a MINIMUM-SECTIONS floor restores the me() skeleton
  if sections ever go fully empty.
- **KERNEL-EXPERIENCE-EMPTY-001** `[FIXED 1.50.280/282/283]` — experience/bring/
  contribute blank. (a) showcase read `ie().roles` & mapped `e.title` but the
  kernel stores `workHistory` with field `role` — fixed + build experience
  deterministically from workHistory; (b) GABRIEL_BG never injected the work
  history into the prompt — now it does; (c) bring mirrors generated CORE
  COMPETENCIES; (d) hardened the showcase flag `p`.
- **LLM-CREDIT-400-MISCLASS-001** `[FIXED 1.50.285/288 + proxy]` — Anthropic
  returns "credit balance too low" as a **400** → was bad_input (no alert/
  fallthrough). PWA surfaces upstream_error + classifies credit as **billing**
  (banner + demote + fallthrough); proxy 400 hint detects it.
- **LLM-MAXTOKENS-TRUNCATION-001** `[FIXED 1.50.289 + proxy]` — fallbacks
  hardcoded `max_tokens:2500` (Claude 32768) → truncated the big CV JSON. D1
  `llm_calls` proved it (Mistral completion = exactly 2500; Gemini ~92). Raised
  fallbacks to 8192 + proxy gemini default 8192.
- **LLM-SILENT-INADEQUATE-001** `[FIXED 1.50.290]` — dispatcher accepted any
  non-null string as success. Added OUTPUT-ADEQUACY GATE (parse_jd/generate_cv):
  reject <800 chars or unbalanced braces → fall through.
- **LLM-COST-QUALITY-ROUTER-001** `[FIXED 1.50.291]` — (#4) gemini→gemini-2.5-pro
  for big tasks only; (#5) quality-aware routing: per (task→provider) demotion
  memory (10-min TTL) sends a provider that returned inadequate/bad_input output
  to the BACK of the order for that task.
- **SALMON-MOBILE-001** `[FIXED 1.50.286]` — measurer read post-transform rects;
  on mobile (scale<1) overflow never tripped. Now divides the limit by column
  scale.
- **SALMON-EXPORT-EXPERIENCE-001** `[FIXED docx-worker, deployed]` —
  renderExperience ignored role.page; now inserts pageBreakBefore (+"(Cont.)")
  at each monotonic role-page increase.
- **SALMON-#185-LOOP-GUARD** `[FIXED 1.50.287]` — measurer 1.5s post-write
  cooldown so it never re-measures its own pagination (breaks #185 oscillation).
- **SALMON-CV-DUPLICATE-001** `[FIXED 1.50.273→reverted 275→re-fixed 292]` — CV
  showed TWO salmon bars + TWO (CONT.). Keep the page-box separator + editable
  cyan cont; `__antcvSalmon` red bar + teal #00746E cont re-gated to CL-only.
- **PB-WORKER-CONT-HEADER-001** `[FIXED docx-worker 1.14.30, deployed — owner export check]` —
  exported page-2 main column showed a stray "CORE COMPETENCIES" heading above
  the EXPERIENCE continuation (previously "SELECTED OUTCOMES"). Root cause: Word
  MERGES contiguous same-grid section-wrapper tables (heading-repeat wrapper,
  1.14.22) and repeats the FIRST table's tblHeader. Fix: a near-zero-height
  separator paragraph after each section wrapper table keeps them distinct, so
  each section's own heading repeats. Owner re-export to confirm.
- **WIZARD-LANG-SELECTOR-001** `[PARTIAL 1.50.284]` — wizard language step was
  blank (React island never rendered). Replaced with a self-contained DOM picker
  (selectable table, ★ DEFAULT on first, ↑/↓ reorder, persists ordered list).
  Single tick+reorder table, not the spec's two side-by-side tables — revisit if
  owner wants the two-table UX.

### OPEN — queued for autonomous session

- **SALMON-CV-MAINROLE-BREAK-001** `[FIXED 1.50.293][HIGH][preview — verified headless]` —
  ROOT CAUSE: the measurer finds experience roles via `[data-antcv-role-index]`,
  but that attribute existed ONLY on the page-2+ explicit per-role render path
  (app.src.js ~38510). On PAGE 1 the experience section renders monolithically
  through `Ce` (the `experience` case), which emitted NO `data-antcv-role-index`,
  so the measurer could never see a role break point on the first page → it never
  wrote `autoPages[experience][n]`, so the main column never broke while the
  sidebar did (which keys off `data-antcv-row-path`, present on page 1). FIX
  (additive): `Ce`'s experience case now emits `data-antcv-role-index` on every
  role wrapper, resolved to the FULL-list index (autoPages keys come from
  `findIndex` over the unfiltered `e.roles` in the `d` page computation) via a new
  `__antcvOrigRoles` prop forwarded from the page-0 render. The render `d`/`g`
  path already consumed `__antcvAutoPB`, so once the break is written the role
  cascades to page 2. VERIFIED in headless Chromium (pwa/test/diag-mainrole-break.mjs):
  overflowing CV → 2 page-boxes, page-1 roles tagged, `autoPages` =
  `{additional:{4:2}, experience:{2:2}}` — sidebar + main break to page 2 IN
  PARALLEL. Boot-smoke clean, 38/38 unit tests pass.
- **SALMON-PARALLEL-COLUMNS-001** `[FIXED — preview 1.50.293; export client 1.50.295 + worker 1.14.39–41; re-verified 2026-06-13 (diag-sidebar-cont-e2e, diag-sidebar-export-page, diag-twocol-paged all green)][preview+export]` —
  PREVIEW side resolved by the same fix as MAINROLE-BREAK-001. With page-1 role
  detection restored, the measurer writes the sidebar break AND the main break at
  the SAME page boundary (both measured against the same USABLE A4 limit from the
  same column top), so the columns paginate in step. The CV main TABLE row-split
  was ALREADY wired (oMain table-row flatMap, app.src.js ~38082, reads
  `__antcvEffBucket`); verified clean in headless (pwa/test/diag-table-split.mjs):
  a 30-row CORE COMPETENCIES table that overflows splits at row 26 → page 2 with
  30/30 rows rendered, NO duplication, NO loss, header repeated on the
  continuation table. The in-place split in `Ce` stays disabled (correct — the
  page-box oMain split owns cross-page movement). **EXPORT closed by the
  per-page two-column rework** — see SALMON-AUTO-EXPORT-001 below (now lifted)
  and the updated export-scope entry:
- **SALMON-PARALLEL-COLUMNS-001 (export scope)** `[FIXED — client 1.50.295+ effective-bucket forwarding + worker ≥1.14.39–41 per-page tables; verified headless 2026-06-12]` — the auto salmon
  must paginate the SIDEBAR and the MAIN column **in parallel / coordinated**:
  when content crosses the A4 line, the sidebar break and the main break happen
  together at the SAME page boundary, and any block that SLIDES to the next page
  must be **CUT from the source page** — never left behind (stranded) and never
  shown on both pages (duplicated). Owner 2026-06-08 (AntCVqq.pdf): "auto salmon
  in sidebar and in main need to work in parallel — e.g. generate new table in
  new page and cut the old items that are sliding." Symptom seen: the CORE
  COMPETENCIES table's rows desync / the moved rows are not cleanly cut when the
  table reflows to the continuation page. **Resolution:** the worker now emits
  ONE two-column table PER PAGE (1.14.39; `splitChildrenByPage` cuts both
  columns on `__antcvPB` markers), so a break in one column can no longer
  desync the other — the columns share the page boundary by construction.
  Tables split by `row_pages` with the header repeated (1.14.38), experience
  by `role.page` (1.14.39), sidebar lists by `item._page` (double-"(CONT.)"
  dedup 1.14.40); column widths from forwarded `sidebar_ratio` (1.14.41).
  Verified: `pwa/test/diag-sidebar-cont-e2e.mjs` + `pwa/test/diag-sidebar-export-page.mjs`
  (coordinated sidebar `_page` + main `role.page`) + `workers/docx-worker/test/diag-twocol-paged.mjs`
  / `diag-twocol-ownerlike.mjs` (N tables = N pages, clean cut, no dup/loss) —
  all green 2026-06-12. Residual pixel-level preview↔export geometry drift is
  tracked separately (PREVIEW-PDF-PARITY-001). Original scope retained:
  (a) CV main NON-experience
  sections — esp. the CORE COMPETENCIES / "What I bring" TABLES — must split by
  ROW with the moved rows removed from the page-1 table and re-emitted in a
  page-2 continuation table (header repeated), never duplicated/lost; (b) the
  sidebar split (already working) and the main split must use a COORDINATED page
  boundary so columns stay in step; (c) experience roles (see MAINROLE-BREAK
  above). Note app.src.js ~4337 explicitly disables in-place CORE COMPETENCIES
  table split today ("Real cross-page movement for CORE COMPETENCIES needs the
  main-column page-box pagination") — that is exactly the gap. Relates to the
  oMain table-row flatMap split (~37741) + the measurer's `firstOverflowRow`.
  Must hold in BOTH preview and export (PDF + DOCX).
- **SALMON-AUTO-EXPORT-001** `[FIXED — stand-down lifted; sidebar auto-break forwards since the per-page two-column rework; verified headless 2026-06-12]` —
  **DONE (client-only, no worker deploy):** the docx-export client
  (`antcv-docx-client.js`) now forwards the EFFECTIVE bucket (manual ∪ auto) for
  the two WHOLE-UNIT, MAIN-column paths that already render identically for manual
  breaks and therefore cannot scramble: (a) EXPERIENCE — each role carries the
  effective `page` = max(manual role.page, auto `autoPages[sid][origRoleIdx]`) with
  a monotonic cascade; the worker (1.50.286) inserts pageBreakBefore + "(Cont.)"
  at each role-page increase. (b) TABLES — `row_pages` = manual itemPages ∪ auto
  autoPages per table; the worker (renderCompetencyTable) splits by row at each
  increase, repeating the header. Both produced by the SAME docx-worker from the
  same payload, so the PDF inherits them. Verified the PAYLOAD in headless
  Chromium (pwa/test/diag-export-autobreak.mjs): with auto breaks
  `{experience:{2:2}, core:{26:2}}`, the POSTed /generate payload carries
  experience role pages `[1,1,2,2]` (cascade) and `core.row_pages={26:2}`.
  **STAND-DOWN LIFTED:** the blocker — "the worker lays both columns as ONE Word
  table row, so a break in only one column desyncs them" — was removed by the
  per-page two-column rework (worker ≥1.14.39: one table per page, both columns
  cut on the same `__antcvPB` boundary). The client now forwards the EXPORT
  break map (`antcv:autoPages`, measured against the Word-equivalent
  USABLE_PDF line — the preview/export two-map decouple) for sidebar list
  items too (`item._page` via pageFor), not just experience/table units.
  Verified `pwa/test/diag-sidebar-cont-e2e.mjs` (real measurer → forwarded
  `_page`) + `pwa/test/diag-sidebar-export-page.mjs` (sidebar + main
  coordinated). Pixel-level geometry drift stays under
  PREVIEW-PDF-PARITY-001. History below retained:
  - only MANUAL breaks (itemPages / role.page) export; the AUTO breaks the measurer creates
  (`antcv:autoPages`) are NOT forwarded to the docx-worker, so the exported
  document does NOT match the preview's salmon. **Applies to BOTH the DOCX and
  the PDF** (owner 2026-06-08: "auto-break export needed also in docx") — both
  are produced by the docx-worker from the same payload, so the auto breaks must
  reach the worker and be rendered as Word page breaks (which the PDF inherits).
  History: auto-break forwarding was stood down in docx-client 1.50.215 because
  raw `autoPages` forwarding scrambled the 2-column layout (isolated candidate
  header → 3 pages, mid-role cut, wrong continuation header). **Fix direction:**
  forward the EFFECTIVE bucket (manual ∪ auto) to the worker AND have the worker
  do group/role-aware 2-column pagination (insert pageBreakBefore at the snapped
  boundary, never mid-group/mid-role), reusing the now-fixed section-table
  separator (1.14.30) and the role.page break path. Verify in BOTH a downloaded
  .docx (Word/Google Docs) and the PDF. Subsumes PB-AUTO-OVERFLOW-001.
- **LLM-QUALITY-PERSIST-001** `[FIXED 1.50.294][enhancement — verified headless]` —
  the per-(task→provider) demotion memory (`__antcvTaskDemote`) is now SEEDED at
  session start from the server-side D1 rolling-window health via the existing
  relay endpoint `GET /api/llm-health?window=60` (no worker change needed — that
  endpoint's own docstring says "the autorotate logic can also call it to
  deprioritise degraded providers"). Rows with status `degraded`/`down` (or
  `health_score < 0.60`) seed `__antcvDemoteProvider(task, provider, 30min)`, so a
  provider consistently bad for a task starts the session already pushed to the
  BACK of the order for that task (the dispatcher already calls
  `__antcvReorderByQuality` at app.src.js ~1497). Strictly OFF the hot path: one
  short-timeout GET fired ~2.5s after load, plus a fire-and-forget fallback on the
  first dispatch (single request per session via the `__antcvQualitySeeded`
  guard); offline / no-relay / 401 / abort is a silent no-op that never blocks or
  delays an LLM call. `__antcvDemoteProvider` now takes an optional TTL and never
  SHORTENS an existing demotion (max of expiries) so a transient 10-min session
  failure can't clobber the 30-min seed. Only `degraded`/`down` are seeded —
  `warning` (0.60–0.85) is left alone (too soft to reorder on). VERIFIED in
  headless Chromium (pwa/test/diag-llm-health-seed.mjs): startup hits
  `/api/llm-health?window=60` on the relay base, 0 errors. Boot-smoke clean.
- **ENHANCE-#185-RESIDUAL-001** `[OPEN / needs repro — synthetic attempt NO-REPRO 2026-06-12]`
  Repro attempt (`pwa/test/diag-so004-185-repro.mjs`): preview inline-edit bursts
  across 8 spans × 3 rounds + section-row interactions produced NO #185, no
  "Maximum update depth", no blue screen — the 1.50.287 loop-guard held. Caveat:
  the editor side-panel FIELD hammering half could not be exercised headlessly
  (panel textareas not reachable via row-click in this harness), so the
  editor-commit path the owner hit is only partially covered. If it recurs after
  a hard refresh, capture the `#antcv-debug` log. Original report: owner hit React #185 on
  "Enhance core competencies" (cached 1.50.285). 1.50.287 loop-guard may fix it;
  if it recurs after hard-refresh capture `#antcv-debug` log (no speculative
  render patch).

### Autonomous session 2026-06-08 (PM) — shipped summary

Worked the prioritized list under full autonomy. Production moved
**1.50.292 → 1.50.295** (PWA auto-deploys on push to main; all three branches —
main, claude/antcv-roadmap-bugs-L9Sqa, plan/2026-06-06-analysis-followups — kept
identical). NO worker deploy was needed this session (the export change is
client-only; the workers already had the consuming code).

**Shipped + verified (headless Chromium + 38/38 unit tests + boot-smoke each):**
- **1.50.293 — SALMON-CV-MAINROLE-BREAK-001** `[FIXED]` and **SALMON-PARALLEL-COLUMNS-001**
  `[FIXED preview]`. Root cause: page-1 experience roles lacked
  `data-antcv-role-index`, so the measurer never detected a main-column break on
  the first page → sidebar broke alone, main overflowed the salmon. One additive
  attribute (resolved to the full-list role index) restored detection. Verified:
  overflowing CV → 2 page-boxes, `autoPages={additional:{4:2},experience:{2:2}}`
  (columns break in parallel); a 30-row table splits at row 26 with 30/30 rows, no
  dup/loss.
- **1.50.294 — LLM-QUALITY-PERSIST-001** `[FIXED]`. Cross-session provider
  demotion seeded from D1 via the existing relay `/api/llm-health` endpoint, off
  the hot path. Verified the startup GET fires.
- **1.50.295 — SALMON-AUTO-EXPORT-001** `[PARTIAL — owner export check]`.
  Client now forwards effective experience `role.page` (cascade) + table
  `row_pages` to the worker (whole-unit main-column paths that can't scramble).
  Verified the /generate payload carries `[1,1,2,2]` role pages + `row_pages={26:2}`.

**Could not complete (need rendered-output verification I can't see, or owner input):**
- **SALMON-AUTO-EXPORT-001 (sidebar half)** — sidebar item auto-break export left
  stood down. It desyncs the worker's single-row 2-column table and its break
  POSITION depends on PREVIEW-PDF-PARITY-001 (preview px ≠ Word geometry). Needs
  the parity fix + coordinated 2-column worker pagination + an owner visual check.
- **PREVIEW-PDF-PARITY-001 / AUTO-PAGEBREAK-CV-MIDGROUP-001** — concrete next step
  is to re-point the `Vi` estimator (app.src.js, currently width 590/11pt) to the
  real PDF column geometry (worker MAIN_W − margins, 10.5pt), but verifying it
  requires comparing preview vs rendered-PDF line breaks (visual). Left for owner.
- **PB-WORKER-CONT-HEADER-001 (item 5, "SELECTED OUTCOMES" wrong cont. heading)** —
  confirmed by reading the worker that the 1.14.30 section-table separator is
  UNIVERSAL (`renderSection` appends it to every section wrapper, not just CORE
  COMPETENCIES), so this pre-1.14.30 table-merge symptom should already be
  resolved by the deployed worker. Owner to confirm with a fresh export. (Possible
  follow-up to watch during that check: the experience wrapper's `tblHeader`
  ["PROFESSIONAL EXPERIENCE"] repeating on page 2 alongside renderExperience's own
  "(Cont.)" heading — a potential double-heading, not verifiable without the render.)
- **PB-WORKER-SIDEBAR-FILL-001 (item 6)** — navy sidebar not filling to the page
  bottom on a continuation page. The full-height-cell technique is known, but a
  blind worker change risks clipping content / forcing extra pages; needs visual
  verification. Not shipped.

New reusable test assets added under `pwa/test/`: `boot-smoke.mjs` (the
blue-screen guard — serve pwa/, assert 0 console errors + `typeof glDemo`),
`diag-mainrole-break.mjs`, `diag-table-split.mjs`, `diag-llm-health-seed.mjs`,
`diag-export-autobreak.mjs` (standalone Playwright diagnostics; not part of the
`node --test` unit suite).

---

## OPEN — 2026-06-07 (page-break arc + kernel / application-history)

### Preview ↔ PDF parity (analysed 2026-06-07)
- **PREVIEW-PDF-PARITY-001** `[PARTIAL][HIGH][export+preview]` — The CL preview
  shows ONE page (no salmon) but the exported PDF overflows, orphaning the
  signature name + AI watermark onto a near-empty extra page. Root causes,
  from a line-by-line PDF-vs-preview comparison of the Unsolicited Open
  Application CL (2026-06-07):
  1. **Vertical mismatch.** DOCX inter-paragraph spacing (`before:240`=12pt on
     section/signature bodies, `before:360`=18pt on the watermark) is far
     larger than the preview's (~3–4px ≈ 2–3pt margins). Accumulated over
     ~10 blocks the PDF is ~120px (~0.85in) TALLER than the preview — enough
     to tip the closing block over the page-1 boundary while the preview
     fits. **Fixed (increment 1, docx-worker 1.14.28 / app 1.50.269):**
     watermark `before` 360→120 (linear only), signature `before` 240→150,
     `keepNext`+`keepLines` on the closing block so it moves as a unit and
     can't orphan a single line. Reconciles THIS one-page letter.
  2. **Horizontal mismatch.** Same font/size (Carlito 10.5pt) but the PDF
     text column is slightly WIDER than the preview's → PDF fits ~1 more word
     per line. Examples: WHO-I-AM L2 PDF "…technical problem" vs preview
     "…technical"; WHY L1 PDF "…scope aligns" vs preview "…scope"; HWIC intro
     PDF "…I would focus" vs preview "…I would". So on-screen line breaks are
     NOT the real ones. **Increment 2 — CLOSED BY CONSTRUCTION (2026-06-12,
     R36 spacing parity):** with the spacing-slider forwarding (edge, seam,
     sidebar pad) both sides now derive every horizontal dimension from the
     SAME ratio × page width − px-equal margins. Numeric audit at the comfort
     defaults: CV main text width preview 794×0.67 − (14+6) − 14 = 498.0px vs
     worker (7977 − 510 DXA)/15 = 497.8px; CL linear 780 vs 780.4px; sidebar
     240 vs 239.9px. The residual line-break drift is FONT SHAPING (browser
     vs LibreOffice glyph metrics), irreducible without embedding identical
     metrics — sub-word-level, no longer a column-width class mismatch.
     Owner visual confirm on the next export closes the whole entry.
  3. **Estimator targets a third geometry.** `[FIXED 1.50.296 — owner visual check]`
     The line/tightening counter `Vi(text, 590, 11, …)` (`app.src.js`) used width
     590px / 11px — matched neither the preview nor the PDF. Now re-pointed to the
     REAL docx-worker PDF text geometry, derived from the worker's FIXED DXA
     constants (px = DXA/15 at 96dpi): CV two-column main = MAIN_W(7270) − 288
     (L/R cell margins) = 6982 DXA = **466px**; CL full-width linear = PAGE_W(11906)
     − 200 = 11706 DXA = **780px**; sidebar = SIDEBAR_W(4636) − 288 = 4348 DXA =
     **290px**. Font is now **14px = 10.5pt** main (×96/72), 13px = 10pt sidebar.
     Both the `Gi` candidate finder (7 main-prose calls, now doc-aware width) and
     the second loc-aware tightening pass were updated; the sidebar branch of the
     second pass went from a wildly-wrong 590px to the real 290px. So fit-it /
     enhance / tighten now optimise against the actual exported artifact (owner:
     "tightening rules must follow the real PDF, not the theoretical"). Tracks the
     DEFAULT 10.5pt/10pt font sizes (the old code was likewise a constant). VERIFIED
     mechanically (no `590,11` left, geometry present in the minified build,
     boot-smoke clean, 38/38 unit tests). **OWNER VISUAL CHECK:** confirm that
     after fit/enhance/tighten a main-column line that was overflowing in the PDF
     now fits — I cannot compare rendered-PDF line breaks.
- **AUTO-PAGEBREAK-CV-MIDGROUP-001** `[LIKELY ADDRESSED by dual-map measurer e50973f/1.50.350 — owner export-verify]` —
  the architectural fix this item called for ("the measurer must compute against
  PDF-equivalent heights") landed as the **dual-map** measurer: `antcv-auto-pagebreak-
  block-001.js` now keeps a PREVIEW map and an EXPORT map, and each measures against ITS
  OWN A4 line — export at `USABLE_PDF` (~949px), preview at `USABLE` (~1053px) — instead
  of one shared geometry (EXP-PREVIEW-GAP-001 `e50973f`, supersedes EXP-PREVIEW-CROWD-001;
  experience roles are atomic so the first crossing role moves whole). This is exactly the
  per-geometry height model the old "increment 2" note asked for, applied at the role/box
  level. **Owner export-verify owed** to confirm group/sidebar cuts also land clean in the
  PDF; if a mid-group cut still appears, it's a residual of the worker spacing model, not
  the measurer. *(original conclusion retained below)*
  CONCLUSION
  the owner asked for (2026-06-07): the CV mid-group cut is the SAME root
  cause as PREVIEW-PDF-PARITY-001. `antcv-auto-pagebreak-block-001.js`
  (1.50.268) measures overflow against the **preview** DOM heights and snaps
  the autoPages break to a group boundary — but because the **PDF** has the
  larger `before:240` spacing, the PDF's group positions sit lower than the
  preview's, so the break the measurer chose (correct for the preview) lands
  MID-GROUP in the PDF. **Fix (increment 2):** the measurer must compute
  against PDF-equivalent heights (apply the docx spacing model when summing
  item heights), OR increment 1's spacing reconciliation must extend to the
  per-section bodies so preview height ≈ PDF height everywhere. Until then,
  expect occasional CV group/role splits that look right in the preview but
  cut mid-group in the PDF.

### Export
- **DOCX-EXPORT-CORS-CPU-001** `[MITIGATED 1.50.244/248 — residual infra decision is the owner's]` — DOCX export failed with
  *"Access to fetch at 'https://docx-worker.../generate' from origin
  'https://antcv.pages.dev' has been blocked by CORS policy: No
  'Access-Control-Allow-Origin' header is present"* on a tailored Kvadrat
  generation (CL+CV, consensus poll active). **Diagnosis (read-only probe of
  the live worker):** the worker itself is healthy — OPTIONS preflight,
  POST 422 on bad payload, and a minimal /generate call ALL return proper
  CORS headers (`Access-Control-Allow-Origin: https://antcv.pages.dev`).
  /health reports `1.14.27-header-thin-2pt-name-pad`. The error must therefore
  be one of: (a) Cloudflare Workers **CPU limit exceeded** mid-request (the
  worker is killed, Cloudflare serves its own error page WITHOUT CORS), (b)
  payload > 4 MB (returns 413 *with* CORS — wouldn't produce this error), or
  (c) intermittent edge timeout. (a) fits best for a tailored CV+CL with
  consensus poll: docx-js packing is CPU-intensive and the worker isn't on
  Workers Unbound. **Mitigations to consider (none deployed yet):**
  - Move the worker to **Workers Unbound** (`[placement] mode = "smart"` +
    paid Unbound subscription) so CPU caps go from ~50 ms → 30 s.
  - Stream docx generation in chunks where possible.
  - Smaller payload defaults (drop the photo to a much-smaller thumb
    pre-export, skip optional sections by default).
  Client-side todo **DONE (1.50.244 / 1.50.248, antcv-docx-client.js)**:
  the /generate fetch is wrapped — a network-level failure (CORS-blocked
  CPU kill, edge timeout) auto-retries once after 1.5 s, the worker is
  warmed via a /health GET before the real POST, and a remaining failure
  throws a user-readable message with the payload/photo size and concrete
  next steps instead of the raw `TypeError: Failed to fetch`. Residual
  (owner decision, not code): if it keeps failing on normal-sized CVs,
  move the worker to a longer CPU budget (Workers paid tier /
  `[limits] cpu_ms` in wrangler.toml).

### Wizard / languages
- **WIZARD-LANG-SELECTOR-001** `[OPEN][feature]` — **Wizard language step + two-table language
  selector** (owner spec 2026-06-07; also in `docs/FEATURES_REGISTRY.md`).
  1. The wizard "language set" step must actually **show the languages selector** — it is
     currently missing / not rendered on that step (note prior wizard work hid the language
     slide on SKIP; here it must appear when the step is shown).
  2. Render the selector as **two tables side by side**:
     - **Left = all available languages** (the full supported set — en, da, sv, de, fr, es, …;
       source of truth is the `writingSystems/registry.json` language partition).
     - **Right = selected languages** (the user's chosen subset). Move entries left↔right to
       add/remove.
  3. The **right (selected) table is reorderable**, and its **order sets the default language —
     the first entry in the selected list is the default**, which drives the generation /
     `meta` default language. Persist the ordered selected-language list and the derived
     default (and reflect it in Settings → Personal LanguageCard).
  Relates to WIZARD-002 (default languages + settings hand-off). Not started — documented per
  owner request as a feature to implement.

### Page breaks / pagination
- **PB-OUTCOMES-WIPE-001** — `[FIXED→VERIFYING]` A page break on SELECTED OUTCOMES
  **deleted all outcomes** (and produced no break). Same class as the HIWC bullet wipe:
  `selected-outcomes-row-controls-237` `setPage()` fired `antcv:sections-updated`, forcing
  a re-render that read the momentarily-empty outcomes editor and wrote `items:[]`. Fixed
  1.50.218 — `setPage` now fires the page-only `antcv:item-pages-changed`. Owner to confirm.
- **PB-WORKER-CONT-HEADER-001** — `[RESOLVED in the per-page model — regression-tested
  2026-06-11]` In the exported PDF/DOCX, the EXPERIENCE continuation heading on page 2
  rendered as "SELECTED OUTCOMES" instead of "EXPERIENCE (CONT.)". The 1.14.39+
  per-page two-column rework (one table per page) plus the 1.14.30 section separator
  eliminated the table-merge that stole the heading: a live worker probe (deployed
  src/index.js bundle driven in node) shows page 2's main column carrying exactly ONE
  "PROFESSIONAL EXPERIENCE (Cont.)" heading — no stray SELECTED OUTCOMES, no doubled
  plain heading. Locked by `diag-twocol-ownerlike.mjs` (payload now includes a
  SELECTED OUTCOMES section before EXPERIENCE; asserts the page-2 heading set).
  Owner export check remains a nice-to-have, no longer blocking.
- **PB-WORKER-SIDEBAR-FILL-001** — `[FIXED — worker 1.14.54, owner-confirmed mechanism]`
  The navy sidebar did not fill to the page bottom on continuation pages **in the
  export**. Fixed in the worker: every two-column body row carries an "atLeast"
  height (page 1: 13260 DXA under the header band; pages 2+: PAGE_H − 600) so the
  sidebar cell's navy shading stretches to ~0.5–1cm above the page edge. The slack
  is deliberate — exact-fill heights made LibreOffice (/generate-pdf) overflow each
  sheet by a sliver and emit blank pages / swallow sidebar lines (PDF-BLANK-PAGE-001,
  fixed 1.14.54). See `makeBodyRow` in workers/docx-worker/src/index.js.
- **PB-PREVIEW-SIDEBAR-FILL-001** — `[FIX SHIPPED 1.50.227 — owner visual verify]` In the
  **preview**, the navy sidebar still didn't run to the page bottom — the 1.50.216 approach
  relied on flex `align-items:stretch` + a fixed `min-height:1123px`, which caps it at one A4
  page and doesn't track the real main-column height. New sidecar
  `antcv-sidebar-fill-equalize-227.js` measures the main column in each `.antcv-page-row` and
  sets the sidebar height to match (inline `!important` to beat the 216 rules), re-running on
  every content mutation (line insert), section/page-break events, and resize. The DEMO
  watermark is `position:absolute; inset:0` inside the row, so it covers the full page once the
  sidebar matches main — no separate watermark move needed. **Owner to visually verify** the
  navy field reaches the content bottom on single + multi-page kernels and after edits; then
  re-check the watermark sits right (per owner's "watermark only after that"). Boot-verified
  (sidecar registers, 0 console errors); functional height match needs a real rendered preview.
- **PB-AUTO-OVERFLOW-001** — `[FIXED — rebuilt; subsumed by SALMON-AUTO-EXPORT-001]`
  Auto-overflow was built (1.50.211–214) then stood down (1.50.215: forwarding the
  sidebar auto-break into the single-row 2-column worker scrambled the PDF). The
  rebuild called for here exists: the measurer (`antcv-auto-pagebreak-block-001.js`)
  writes the two break maps (preview + Word-equivalent export), the client forwards
  the effective bucket, and the worker does group/role-aware per-page 2-column
  pagination (≥1.14.39–41). See SALMON-AUTO-EXPORT-001 above for verification.
- **PB-PREVIEW-GROUPNAME-EDIT-001** — `[FIXED 1.50.398 — superseded by PREVIEW-EDIT-PERSIST-001, verified headless]`
  A group-name edit from the preview did not persist. ROOT CAUSE (owner directive
  2026-06-12 "make sure ALL text edits in preview persist, not just groups"): preview
  inline edits are NOT committed by app.js's React onBlur (text-edit mode is off by
  default — the spans render the non-editable branch) but by
  `antcv-preview-bullets-dedup-341.js`'s blur handler, whose text-match walker only
  covered section-level strings, string arrays, and table rows. Object items
  ({b,t} outcomes, {l,v}/{group} labeled lists, {deg,sch} education), EXPERIENCE
  roles (title/company/years/bullets) and the section TITLE silently reverted on
  the next re-render. The walker now covers every text-bearing shape.
  Verified `pwa/test/diag-preview-edit-persist.mjs` — 9 edit types, each
  located → committed → survives reload → re-renders: all green.

### Kernel / generation / application history (testing is painful because of these)
- **KERNEL-REGEN-GUARD-001** — `[FIX SHIPPED 1.50.225 — owner verify]` Generating without a JD
  used to **force a brand-new kernel** every time (`_antcvGenerateKernelShowcase({force:true})`),
  silently replacing a saved kernel. `Cs()` already self-guards (it skips when a kernel exists
  unless `{force:true}`), but the main Generate button always passed `force`. Fix
  (`app.src.js`, the no-JD branch of the "Generate CV & Cover Letter" handler ~35900): if a
  kernel already exists, **default is to KEEP it** — the prompt offers OK = generate a NEW
  kernel (explicit, non-default) / Cancel = keep & open the existing one, and reminds the user
  that Settings → "Regenerate showcase" also rebuilds it. A new kernel is auto-built only when
  none exists. Verified: terser identity-safe, 0 `"use strict"`, 29/29 unit tests, boot 0
  errors. PWA-only (no worker deploy). Owner verify: with a saved kernel, Generate-without-JD
  should prompt to keep vs. rebuild rather than silently regenerating.
  **Follow-up (1.50.226):** same keep-existing guard applied to the **Editor button** no-JD
  path (`app.src.js:~34082`) — when a kernel exists it now just opens the editor (never
  regenerates); it only bootstraps a starter kernel when none exists. The wizard-close
  (`~24355`) and Settings "Regenerate showcase" (`~33873`) force-paths are intentional and
  left as-is.
  **Hardening (1.50.229) — Editor regression fixed:** owner reported "I have a kernel in
  memory, hard refresh, pressing Edit still started a new kernel generation." Root cause:
  both the Editor button guard AND `Cs()`'s own self-guard gated on the single boolean
  `kernelShowcaseGenerated` — if that flag was missing (cloud-restore lag, older sessions,
  any local-only kernel) BOTH guards failed and `Cs()` regenerated. Fix:
  (a) The Editor button **never** calls `Cs()` anymore. It opens the editor, and if any
  kernel-of-any-kind signal is present but the local copy is incomplete, hydrates from the
  dedicated cloud slot. New users get an empty editor; generation is reserved for the
  explicit (already-guarded) Generate button.
  (b) Hardened `Cs()`'s self-guard with **multi-signal detection** — `{force:true}` is now
  required if ANY of: the cloud flag, in-flight flag, **local `sections.cv`/`cl` content**,
  or **`meta.company`** is set. So no future caller can accidentally wipe a kernel.
  Verified: terser identity-safe, 0 `"use strict"`, 29/29 tests, boot 0 errors.
- **KERNEL-CLOUD-PERSIST-001** — `[FIX SHIPPED 1.50.221 — needs relay deploy + owner live-verify]`
  The generated kernel is **not saved to cloud memory** — must be regenerated every
  session/tab-switch; makes page-length testing a long regenerate cycle.
  **Trace (read-only):** the store `u` is localStorage-only (`app.src.js:296`); the showcase
  content (sections/meta/rationale) was written to localStorage only, while just the boolean
  `kernelShowcaseGenerated` synced to cloud via prefs (relay allowlist `index.js:739`). A fresh
  session has empty localStorage + a true flag → it regenerates. The old nested
  `personalInfo.showcaseBackup` field was deprecated (the `Zn` strip fn at `app.src.js:11438`
  even says "future schema uses top-level cloud key instead").
  **Fix (1.50.221) — dedicated cloud slot** (owner-chosen approach):
  - **access-relay**: new `kernel_showcase` D1 table (one row/user; `schema.sql`) + `GET`/`PUT
    /api/kernel-showcase` handler (`src/index.js`, modelled on `/api/applications`; defensive on
    missing table). **D1 migration already applied to live `ant_memory`** (`CREATE TABLE IF NOT
    EXISTS`, additive/non-destructive, verified via PRAGMA).
  - **PWA** (`app.src.js`): `oo.getShowcase()`/`putShowcase()` clients; persist on showcase
    completion (delayed read of canonical store values, fire-and-forget); restore effect on load
    (signed-in + no local copy → hydrate sections/meta/rationale via `ao`/`lo`/`bo`).
  - Verified: relay `node --check` OK; terser rebuild identity-safe, 0 `"use strict"`, 29/29 unit
    tests, browser boot 0 errors. **Graceful pre-deploy:** if the relay route isn't live yet the
    client calls throw and are caught (no UI impact).
  **Needs:** relay deploy via `deploy.yml`, then owner live-verify (generate showcase →
  hard-refresh/new tab/2nd device → it restores instead of regenerating).
- **KERNEL-SPECIALIZATION-LINE-001** — `[FIX SHIPPED 1.50.224 — owner verify]` The kernel does
  **not write to the specialization line**.
  **Trace:** the kernel/showcase generation DOES write the specialization line into meta
  (`io.subtitle`) at `app.src.js:~19793/19876` (derived from the profile headline). The real
  gap was downstream: that subtitle was **never persisted per-application** — the `application`
  D1 table had no `subtitle` column, so it was lost on save and not restored on reload (so it
  looked like the kernel "didn't write" it). Resolved by the subtitle-persistence change shared
  with APPHISTORY-SAME-LINE-001 (1.50.224 below). Owner verify: generate → save → reload, the
  specialization line should survive.
- **APPHISTORY-SAME-LINE-001** — `[FIX SHIPPED 1.50.223 — needs relay deploy + owner verify]`
  Saving to Application History writes to the **same line** rather than its own slot — owner
  confirmed 2026-06-07: "new applications are saved to the first in list — no new saves (no
  save-as upon changes)".
  **Root cause (read-only trace):** the "💾 Save current as new application" button
  (`app.src.js:~32887`) always `oo.create` with `jd_text = (zt.text) || Ut || (showcase ? ks
  : "")` and hardcoded `category:"unsolicited"`. The relay upserts on
  `(user_hash, jd_hash=SHA256(jd_text))` (`access-relay/src/index.js:~2042`, `UNIQUE` at
  `schema.sql:42`). On a kernel showcase / no-JD draft, `jd_text` is the same constant every
  time → identical `jd_hash` → every save UPSERTs the **same first row**; no new entries.
  **Fix (1.50.223):** the button now sends `save_as_new:true`; the relay, when that flag is set,
  salts the hash (`jdHashFromText(jdText + '|new|' + Date.now() + '|' + Math.random())`) so each
  save inserts a **distinct** row. Real-JD dedup (re-uploading the same JD updates its row) is
  preserved whenever the flag is off. Verified: relay `node --check`, terser identity-safe
  rebuild, 0 `"use strict"`, 29/29 unit tests, browser boot 0 errors.
  **Needs:** access-relay worker deploy (same one 1.50.221 needs), then owner verify — save a
  couple of drafts → each appears as its own entry in the list.
  **Subtitle-persistence follow-up (1.50.224):** the `application` table had no `subtitle`
  column, so the specialization line was dropped on save and not restored on load. Added
  `subtitle TEXT` to `schema.sql` + **live D1 `ALTER TABLE` applied** (additive); the relay
  POST/PUT now store it (INSERT + UPSERT + `shapeApplicationRow` read shape); the client sends
  `subtitle` on create and on the save-prior update, and both load handlers now restore
  `n.subtitle` instead of keeping the current value. Resolves the lingering subtitle half of
  SAME-LINE and KERNEL-SPECIALIZATION-LINE-001. Needs the relay deploy + owner verify.
- **APPHISTORY-RELOAD-001** — `[FIX SHIPPED 1.50.222 — owner live-verify]` Pressing a saved
  Application-History item **does not load** that saved application — forces a full regenerate.
  **Trace (read-only, owner-approved fix):** there are two load surfaces, both in `app.src.js` —
  the Settings History list (`~33143`) and the top-bar dropdown (`~37556`). Both correctly
  restore state on click — `oo.get(id)` → `ao({cv,cl})` + `lo({company,role})` + `bo(rationale)`
  + `setActive` + `Ml(id)` — but **neither switched the view to the editor**: the Settings one
  closed no panel (`q` = Settings overlay state, `[K,q]`), the top-bar one only closed its
  dropdown (`Jl(!1)`). So the CV loaded into state while the user stayed on the
  Settings/History view → looked like "nothing loaded".
  **Fix (1.50.222):** after the restore, both handlers now `$t("editor")` (surface the editor),
  and the Settings handler also `q(!1)` (close the Settings overlay) — matching the post-generate
  pattern (`app.src.js:~21324`). Added a `[APPHISTORY-RELOAD-001]` diagnostic log of what
  `oo.get` returned (cv/cl lengths, company) to confirm live whether any residual "blank load"
  is empty stored sections vs. the now-fixed view-switch. Client-only. Verified: terser
  identity-safe rebuild, 0 `"use strict"`, 29/29 unit tests, browser boot 0 errors.
  **Owner live-verify:** click a saved app in Settings History AND in the top-bar dropdown →
  editor should appear with that CV. If a load still looks blank, the console log shows whether
  the stored cv/cl sections are empty (→ SAME-LINE save follow-up).
- **KERNEL-STUCK-LAST-CMD-001** — `[FIX SHIPPED 1.50.220 — awaiting owner live-verify]`
  The kernel sometimes appears **stuck on the last command**; a **browser refresh**
  surfaces the generated kernel — i.e. the result was ready but the UI didn't update
  without a reload.
  **Trace (read-only):** the stuck UI (the fixed top "Generating kernel showcase…" banner,
  effect at app.src.js ~23577 keyed `[Pl]`, plus the "Showcase…" pill ~36999) is driven
  entirely by the React state `Pl` (`[Pl,Bl]=useState(!1)`, the reactive mirror of the
  `kernelShowcaseInProgress` store flag). The generator `vl` is `async` and the completion
  clears (`Bl(!1)`) live in `vl`'s success tail (~21204), `Cs`'s `.finally` backstop
  (~24175), and the `io.company`-change effect (~12564, **Unsolicited case only, fires only
  on change**). If a post-result step in `vl()` hangs, or `io.company` doesn't change, or an
  error path is taken, `Pl` can stay true though the result is already in state — and only a
  reload's mount-effect recovers it. This matches "result was ready, refresh fixes it."
  **Fix (1.50.220):** added an **additive UI watchdog** effect keyed `[Pl]` (right after the
  banner effect) — when `Pl` flips true it arms a 120s backstop (2× the ~60s max gen time)
  that clears `kernelShowcaseInProgress` + `Bl(!1)` if still in progress, so recovery is
  automatic with no reload. UI-only; touches **no** generation/cloud path. Verified: terser
  rebuild (identity-safe), `node --check` OK, 0 `"use strict"`, 29/29 unit tests, real-browser
  boot 0 errors. **Owner to live-verify:** trigger a kernel showcase, confirm the banner/pill
  clear on completion normally, and (if you can reproduce a stuck run) that it self-clears
  within ~2 min instead of needing a refresh. If 120s feels long, the value is a one-line tune.

---

## STATUS UPDATE — 2026-06-06 (owner live-confirmed)

### Closed ✓ (owner-confirmed on real devices)

- **DEMO-PERSIST-001** — `[FIXED✓]` The demo account was server-classified as "paid"
  (`demo_mode:false`), turning off every demo signal. Root cause: the relay's
  `getUserMode` defaulted everyone to `paid`, and a client mode-POST could overwrite it.
  Fixed by **pinning `DEMO_EMAILS` accounts to `demo`** (relay `auth-25`), so `demo_mode`
  stays reliably true (badge, setup-chip gating, watermark all correct). Owner-confirmed.
- **DEMO-BADGE-001** — `[FIXED✓]` The "🟡 DEMO" badge was hard-coded to one email. Re-gated
  to the real `B.demo_mode` (unpaid) signal (PWA 1.50.170), unblocked by DEMO-PERSIST-001
  above. Owner-confirmed.
- **PACKAGE-PALETTE-MIX-001** — `[FIXED✓]` The "mixed visual style" (e.g. Copenhagen
  structure + stale Warm-Terracotta accents) on load / mobile. Root cause: the deployed
  `app.js` had diverged and lacked the v1.50.166 derive-on-mount effect; even that ran once
  before cloud-restore. Fixed with a **self-healing effect** (PWA 1.50.180) that re-derives
  a named package's accents whenever `styleConfig` drifts from its palette — survives
  cloud-restore, works on mobile, custom configs exempt. Owner-confirmed ("finally
  resolved 🎉"). The orphan-apply workaround sidecars can now retire.
- **HARDREFRESH-001** — `[FIXED✓]` In-app Hard Refresh did not force a reload after
  clearing caches/SW. Fixed (PWA 1.50.172/1.50.180) by firing a `location.reload()`
  ~3s after the confirm passes. Owner-confirmed ("in app hard refresh works").
- **DOCX-CL-SECTION-WIDTH-001** — `[FIXED✓]` Every **titled cover-letter section**
  (WHO I AM, WHAT I BRING, WHY THIS POSITION, HOW I WOULD CONTRIBUTE, FOUNDATION) rendered
  at **~60% width** in Google Docs. Root cause: the 1.14.22 heading-repetition wrapper sized
  its column to `MAIN_W − 288 = 6982` (the CV's *main-column* width). The CL is a single
  full-width **linear** doc — its body cell content is `PAGE_W − 200 = 11706`, so 6982 is
  ~60% of the available width. 1.14.23 then mis-sized the WHAT-I-BRING competency table to
  `MAIN_W − 640 = 6630` for the same wrong reason. Fixed (**docx-worker 1.14.24**): CL
  titled-section wrappers now span the full body width (`PAGE_W − 200`) and the nested
  competency table fits just under it (`PAGE_W − 560`). CV paths unchanged.
  **Follow-up (docx-worker 1.14.25):** 1.14.24 fixed the *emitted* gridCol (11706) but
  Word + Google Docs still rendered the sections at **~80%** — the heading-repetition
  wrapper nested them THREE tables deep and both renderers mis-compute widths for
  triple-nested tables. Final fix: for the CL, emit the heading + body **directly** into
  the full-width body cell (no wrapper — that only exists for the CV's sidebar/main
  columns), so titled sections match the untitled CL paragraphs. WHAT-I-BRING drops from
  triple- to single-nested. Verified in emitted XML.
- **DOCX-HEADER-BAND-001** — `[SHIPPED, awaiting owner confirm]` The running header (which
  carries the DEMO watermark) rendered as **white "lines" above the name** in Word and
  Google Docs. Fix (**docx-worker 1.14.25**): shade the header paragraph with the
  candidate-band colour (`headerBg`, palette-responsive) and create the header for **every**
  doc — CV + CL, demo **and** non-demo — so the band colour repeats at the top of every page
  (page-break continuity, per owner request). DEMO WordArt included only when a watermark is
  requested. Name paragraph top space removed (`before:60→0`). The 12-pt strip height may
  need tuning once seen in Word/Google (render can't be verified server-side).
- **DOCX-CONFIG-404 / proxyUrl misconfig** — `[NOT A BUG / config]` Owner saw a CORS + 404
  on `GET https://docx-worker.../config` and worried a deploy "damaged the secrets". The
  docx-worker has **no `/config` route** (by design — `/config` lives on the access-relay).
  The demo-watermark sidecar calls `<localStorage.proxyUrl>/config`, and the owner's stored
  `proxyUrl` is pointed at the **docx-worker**. The 1.14.24/1.14.25 deploys only changed
  table-width logic, the header, and the VERSION string — no routes/CORS/secrets touched,
  and `wrangler deploy` never clears secrets. Confirmed via `git log -S'"/config"'`: the
  docx-worker has **never** had a `/config` route, so restoring an older deploy can't help.
  **Durable fix (PWA 1.50.182):** the demo-watermark sidecar now resolves `/config` from
  the relay (`window.ANTCV_RELAY_URL` → `localStorage.relayUrl`), falling back to `proxyUrl`
  only as a last resort, and caches only on a successful response. Relay URL (from
  `pwa/relay-config.json`): `https://antcv-access-relay.karp-gabriel-a.workers.dev`. Ships
  to production when the branch merges to `main` (Pages auto-deploys PWA from `main` only).
  Immediate workaround: reset the Proxy/Relay URL in Settings to the relay URL above.
  Document generation (`/generate`) is unaffected throughout.

### New — OPEN

- **PERSONAL-EDIT-CRASH-001** `[FIXED✓ 1.50.185]` — fixed by the **React DOM guard**
  (`antcv-react-dom-guard.js`, commit f9e9f0a): a new early-loading sidecar makes
  `Node.removeChild`/`insertBefore` defensive — when the target isn't actually a child
  of the parent (the only case the native call throws), it no-ops instead of crashing,
  converting the fatal throw into a harmless no-op. Loads after the console quieter,
  before React mounts. Set `localStorage.antcvDomGuardVerbose=1` to log the offending
  sidecar so the root mutator can later be fixed and the guard retired. This is the
  canonical React-vs-third-party-DOM mitigation and exactly matches the diagnosis below.
  Removed from open bugs. Diagnostic history retained for reference:
  Typing into a **Settings → Personal**
  subtab field (e.g. the name) **blue-screens on a real mobile device** (not in the
  simulator; no other subtab affected). The typed value **persists** (the `PUT /api/prefs`
  save succeeds — confirmed in Cloudflare worker logs), so the state update works and the
  **React render crashes** (caught by the error boundary, which swallows the error). No
  device console available. Crash capture added (PWA 1.50.181) + a remote crash logger
  (POSTs the error to the relay so it appears in exportable worker logs) — awaiting the
  captured error to pinpoint the throwing render.
  **Captured stack (owner, 2026-06-06):** `Uncaught NotFoundError: Failed to execute
  'removeChild' on 'Node': The node to be removed is not a child of this node` from
  react-dom's commit/deletion phase (`Di`/`Aa`/`Fi`). This is the signature of **a
  sidecar mutating DOM that React owns**: the Name keystroke re-renders the
  candidate/preview subtree, but a preview-editor sidecar had already moved/replaced
  nodes there, so React's `removeChild` hits a node that is no longer its child →
  unmount → blue screen (data persists because the PUT already ran). Prime suspect: the
  contenteditable Name/Specialisation wrap (`antcv-candidate-preview-editor-341.js`) or a
  newer preview-control sidecar. Fix direction: stop that sidecar mutating React-owned
  nodes (wrap/move via a portal or React-safe anchor), or guard so reconciliation can't
  trip. **On-device capture (complements the relay logger):** `antcv-debug-logger.js`
  (v1.50.182) persists the error + a breadcrumb trail to localStorage and shows them in a
  plain-DOM viewer that survives the crash + reload — open with `#antcv-debug` or a 4-tap
  top-right corner; readable on the phone with no terminal.

### Infra + features (2026-06-06, session branch)

- **BUILD-APP-BROKEN-001** `[FIXED 2026-06-12 — build:app repointed to terser]` — both
  root causes are now closed: (1) `app.src.js` already declares `window.glDemo`
  (explicit global, line ~18604) so the implicit-global double-emit is gone; (2) the
  `build:app` npm script was repointed from the unsafe esbuild `--minify` (which
  prepends `"use strict"` and broke the sloppy-mode bundle) to the proven
  `npx --yes terser pwa/app.src.js -c -m -o pwa/app.js`. **Identity round-trip gate
  PASSED:** `npm run build:app` on the unedited source produces a bundle BYTE-IDENTICAL
  to the committed `pwa/app.js` (871,787 bytes, `cmp` clean), `node --check` OK, starts
  `(()=>{`, 0 `"use strict"`. So `app.src.js` has no drift from `app.js` and source
  edits can now be rebuilt safely with the standard script. Closes APPJS-REBUILD-001.
  *(superseded — original report retained below)* `[OPEN][HIGH][infra]` — **`npm run build:app` produces a
  broken bundle.** Rebuilding `pwa/app.js` from `pwa/app.src.js` with esbuild 0.21.5
  yields `Uncaught ReferenceError: glDemo is not defined` at render (verified via the
  browser-QA `boot` gate: committed bundle = 0 JS errors, rebuilt = throws). Root
  cause: `app.src.js:16092` assigns `glDemo` as an **implicit global** inside a
  component (`((glDemo = ({proxyUrl}) => {…})`) and uses it at `28873`; the committed
  working bundle resolves this (glDemo appears once), a fresh esbuild build does not
  (appears twice, lazy global write never lands before the read). This is the
  `250ec8d` revert reproduced. **Impact: blocks every native `app.src.js` change**
  (the PERSONAL-EDIT-CRASH-001 fix sidestepped this by shipping as a standalone
  sidecar, but any future *source* edit is still blocked until this is fixed). Fix
  options: (a) declare `glDemo`
  properly (`window.glDemo`/hoisted `var` at module top) and re-verify the full boot,
  or (b) pin the exact esbuild used for the deployed bundle. Until fixed, app.js
  changes ship via surgical unique-string injection into the working bundle (the #226
  technique) + a `boot` gate.
- **FT-DEBUG-LOGGER subtab** `[SHIPPED]` — added **Settings → Advanced → Debug** (a
  native subtab in `app.src.js`, and injected into the working `app.js` at 1.50.182):
  Open debug log / Clear / "Capture typed values" toggle + the `#antcv-debug` /
  4-tap hints. Boot-verified (0 JS errors). Gives on-device access to the crash
  logger with no terminal.

### Triage round 2 — additional dispositions (owner chat 2026-06-06)

- **SETTINGS-NAV-Z-001** `[OPEN]` (canonical) — Settings subtab / Application-History
  opens BEHIND the preview (z-index trap); the preview overflow menu doesn't route to it
  either. Absorbs **APP-HISTORY-001, SETTINGS-SUBTAB-001, SETTINGS-AHZ-001, AH-001,
  VF-014, APPHIST-ZIDX-001** (owner: all the same bug). Drive with
  `antcv-apphist-zindex-probe.js`.
- **SPECIALISATION-EDIT-001** `[FIXED]` — verified in code: `wrapSpecialisation()` makes
  `meta.subtitle` contenteditable; loaded `?v=1.50.106-spec-edit`.
- **DEMO-TOGGLE-001** `[WONTFIX]` — not needed; the wizard handles demo→normal.
- **DOCX-EXPORT-REGRESSION-001** `[WONTFIX]` — redundant; the print-setup view is skipped.
- **WIZARD step 6b** `[DONE]` — already scrollable; only step 6d remains.
- **DEMO-WARN-NONDEMO-001** `[BLOCKED]` — not testable until the privacy LED renders.
- **GEN-UNSOL-002** `[OPEN, needs live JD test]` — confirm generate emits a JD-grounded
  `meta.company`/`role` so a blank Company field doesn't fall to "Unsolicited".
- **PROCESSING-QUEUE-INDICATOR-001** `[OPEN][feature]` — per-subsection **pink
  "processing"** while actively worked (language change, new JD/kernel, compress, enhance)
  and **yellow "queue"** when scheduled later in the same command (enhance-over-subsection
  → first pink, rest yellow). Plus: **CJLR** (Center/Justify/Left/Right) buttons working in
  **every** sub-subsection. Also in the feature registry.
- **AUTO-PAGEBREAK-BLOCK-001** `[OPEN][feature]` — **always** show the salmon splitter when
  content exceeds one A4 page in preview; sliding is **block-level** (a whole sub-subsection
  moves to the next page — never partial, never the whole parent subsection). Reconcile with
  PB-001..006 + EXPORT-PAGE2-001. Also in the feature registry.
- **PACKAGE-PALETTE-MIX-001** — superseded: **FIXED✓** per the status update above
  (self-healing effect, PWA 1.50.180). My earlier "still OPEN" re-verification ran against
  the stale 1.50.166 tree; the browser-QA `palette-mix` gate should be re-pointed at the
  1.50.180 self-heal (it asserts `localStorage.stylePackage` resolves to a registry id — now
  expected to pass).

---

## SESSION 2026-06-06 — visual-package/palette root fix + UX/data/console batch

Owner-driven batch (Claude Opus). Production reached **PWA 1.50.166** + **docx-worker
1.14.17**. All items below MERGED to `main` and live on `antcv.pages.dev` unless
marked otherwise. Cloudflare Pages auto-builds production from `main`; the docx
worker was deployed via `wrangler deploy`.

### Headline — package "colour mix" — partial mitigation shipped, ROOT still OPEN

- **PACKAGE-PALETTE-MIX-001 — [FIXED — root closed by APPJS-ID-SCHEME-UNIFY (1.50.387); re-verified 2026-06-13 with the owner's exact repro (pwa/test/diag-palette-orphan.mjs): seeded orphan "scandinavian" migrates in storage to "copenhagen-modern", body[data-package] agrees, sidebar renders navy not black, second reload stable]** (owner-confirmed 2026-06-06; partial
  mitigation [PR #226](https://github.com/gabrielk83/AntCV/pull/226), v1.50.166).
  **Owner directive (2026-06-06): keep this OPEN.** The default Copenhagen Modern
  palette must render on load — not the "undefined ugly mix with black". #226 is a
  render-time patch, not a close-out.
  Returning users were stuck on a mismatched palette ("colour mix"); only
  re-pressing the package in Settings fixed it, and it never persisted.
  **Root cause:** the document colour state (`styleConfig`/`ya`) only ever
  initialised from the *saved* config, never from the selected package, so the
  accents stayed stale on reload — AND the persisted package id is the legacy
  orphan `"scandinavian"`, which never gets rewritten to the registry id
  `copenhagen-modern`. **Partial fix in #226 (in `app.js` itself):** a one-time
  mount effect derives the palette from the selected package's `va[Sa].style` for
  non-custom packages (Custom keeps its saved config; `navyColor` keeps owning
  the backgrounds). Done in both `pwa/app.src.js` (the de-minified **SOURCE OF
  TRUTH**, now tracked) and the deployed `pwa/app.js` (inserted by exact unique
  string replace — only +230 bytes change; round-trip verified within ~64 bytes).
  **Why still OPEN — Chrome verification on the `fix-app-src-package-id-root`
  branch preview (2026-06-06):** seeding the returning-user orphan and reloading,
  `localStorage.stylePackage` is *still* `"scandinavian"` while
  `body[data-package]` is `copenhagen-modern` — the persisted-id mismatch that
  produces the black mix is unchanged. #226 only re-derives the render colours; it
  does not rewrite or persist the orphan id. The durable close-out is
  **APPJS-ID-SCHEME-UNIFY** (unify app.js's id scheme with the registry + persist
  the selection through cloud-restore) — tracked in the feature registry.
- **ORPHAN-DEFAULT audit (owner request) — done.** `"scandinavian"` is app.js's
  legacy umbrella default for BOTH the visual package (`stylePackage`, registry
  default `copenhagen-modern`) AND the writing tone (`toneRegister`, registry
  default `nordic-minimal`); neither registry contains it, and app.js uses a
  *different id scheme* than the registry (e.g. `copenhagen_executive` vs
  `navy-executive`). **No other orphan defaults** exist (language `en`,
  `photoPosition sidebar-top`, etc. are all valid — the "American/British" hits
  are a DOCX lang attribute + a prompt instruction, not settings).

### Fixed this session (all MERGED + live)

| ID | Item | PR | Ver |
|----|------|----|-----|
| DATA-EXPORT-001 | Download all stored data/analytics (optional AES passphrase) | [#176](https://github.com/gabrielk83/AntCV/pull/176)/[#185](https://github.com/gabrielk83/AntCV/pull/185) | 1.50.140/147 |
| DELETE-SAVE-001 | "Save my data locally first" before erase | [#176](https://github.com/gabrielk83/AntCV/pull/176)/[#181](https://github.com/gabrielk83/AntCV/pull/181) | 1.50.140/145 |
| IMPORT-COUNT-001 | Upload toast showed 0 work/edu/pubs (React split-text rewrite) | [#178](https://github.com/gabrielk83/AntCV/pull/178) | 1.50.143 |
| SHAPE-GUARD-NOISE-001 | False "missing bullets[]" warns for `{b,t}`/`{l,v}`/`{deg,sch}`/`{group}` leaves | [#186](https://github.com/gabrielk83/AntCV/pull/186)/[#189](https://github.com/gabrielk83/AntCV/pull/189) | 1.50.148/150 |
| CONSOLE-NOISE-001 | Central console quieter (~70 boot banners) | [#188](https://github.com/gabrielk83/AntCV/pull/188) | 1.50.149 |
| PRIVACY-FAB-MOBILE-001 | Privacy LED invisible on mobile (relocated pill exempt) | [#195](https://github.com/gabrielk83/AntCV/pull/195) | 1.50.152 |
| PRIVACY-FAB-FLOATING-001 | Stray privacy ⚠ FAB in Settings/Generation (desktop) | [#207](https://github.com/gabrielk83/AntCV/pull/207) | 1.50.158 |
| PHOTO-PREVIEW-001 | Alt photo positions broke under the single-table renderer (photo-anchored finders) | [#196](https://github.com/gabrielk83/AntCV/pull/196) | 1.50.153 |
| DOCX-PHOTO-BANDOVERLAP-001 | `band-overlap` not recognised by the docx worker | [#200](https://github.com/gabrielk83/AntCV/pull/200) | worker 1.14.17 |
| SIDEBAR-COLOR-001 | Sidebar stayed blue on colour styles (→ `var(--package-base)`) | [#210](https://github.com/gabrielk83/AntCV/pull/210) | 1.50.159 |
| PACKAGE-RELOAD-DESYNC-001 | Palette applied the previous style on reload (read native key) | [#212](https://github.com/gabrielk83/AntCV/pull/212) | 1.50.160 |
| PACKAGE-ORPHAN-001 | Auto-apply Copenhagen Modern for orphan `scandinavian` (sidecar) | [#217](https://github.com/gabrielk83/AntCV/pull/217) | 1.50.164 |
| TONE-ORPHAN-001 | Migrate orphan `toneRegister scandinavian` → `nordic-minimal` | [#220](https://github.com/gabrielk83/AntCV/pull/220) | 1.50.165 |

### Still OPEN (registered, not done this session)

- **PHOTO-PREVIEW-ALT-PERSIST-001 — [RESOLVED by the 1.50.370–372 native rework;
  headless-verified 2026-06-11]** — the clone/finder sidecar machinery this bug
  lived in is GONE: positions render natively from app state (`er` ←
  localStorage `photoPosition` at mount) and the cleanup shim only clears stale
  clones. Cold-boot persistence locked by `pwa/test/diag-photo-position-persist.mjs`
  (bridge-middle on the seam, main-right circular wrap, none → no image — all on
  first paint, no live switch).
- **PHOTO-SIDEBAR-BRIDGE-001 — [CLOSED 1.50.368–372 + worker 1.14.51–53]** —
  shipped: split candidate header, floating medallion mid-line on the seam,
  preview + DOCX/PDF, plus the full position family (main top/bottom L/R,
  bridge-middle/bottom). See FEATURES_REGISTRY and the 2026-06-11 section at top.
- **PRIVACY-FAB-FLICKER-MOBILE-001 — [RESOLVED — owner-confirmed 2026-06-12]** the
  top-bar pill flicker is gone. Follow-up shipped the same day:
  **PRIVACY-FAB-COLOR-001 `[FIXED 1.50.398]`** — on mobile the platform's COLOUR
  emoji shield (white+red segments) screamed against the chip; the glyph now
  renders as a single-colour silhouette on viewports ≤900px (transparent text +
  fg-coloured text-shadow), desktop keeps the native glyph. Verified
  `pwa/test/diag-privacy-mono.mjs` (mobile mono + desktop native) 2/2.
- **DEMO-WARN-NONDEMO-001 — [partly addressed]** privacy LED showed the demo-proxy
  warning for a non-demo user (workaround: Reset). A `demo-watermark`/privacy-led
  state sidecar landed in parallel; verify it covers this.
- **FEATURE-CONF-001 — [OPEN feature]** per-sentence confidence overlay (see
  feature registry). Not started.

### Workaround sidecars — KEEP (do NOT retire yet)

PACKAGE-PALETTE-MIX-001 is still OPEN, so the workaround sidecars stay in place:
`antcv-package-orphan-apply.js` (#217), the loading-gate tone migration (#220),
and `antcv-sidebar-bg-token.js` (#210) all remain load-bearing until the durable
fix lands. Only retire them once **APPJS-ID-SCHEME-UNIFY** ships — that cleanup
unifies app.js's id scheme with the registry and persists the selection through
cloud-restore (so `stylePackage` stops being the orphan `"scandinavian"`),
closing the bug at the data layer. Tracked in the feature registry.

---

## SESSION 2026-06-06 — app.js rebuild safety + page-split engine (paused)

Worklog for the on-screen page-split engine attempt and the blue-screen it caused.
Net result: the regression is reverted and live; the engine work is **paused** behind
a missing safe-rebuild path. Both items below are tracked so the next channel does not
repeat the mistake.

### Resolved this session

- **GEN-UNSOL-002** — generate_cv could omit `meta.company`/`meta.role` even with a JD
  present, so the header fell to "Unsolicited". Fix: the generation prompt now requires
  both to be filled from the JD when one is present (never empty, never "Unsolicited" when
  the JD names the employer); empty only for a true open application. Additive prompt text,
  surgical app.js edit mirrored to `app.src.js`. — FIXED✓ (1.50.169). Live-verify owed:
  generate against a real JD → header shows the real company/role.
- **PERF-002/003/004** `[OPEN][backlog-mislabel]` — DEFERRED. The backlog frames these as
  "trim consensus width" on mechanical tasks, but `ee` (app.src.js ~1146) is a **cascade**:
  it returns on the first successful provider and only advances on failure; the per-task `Z`
  map (~1110) is fallback ORDER, not a fan-out. Mechanical tasks make one call, so trimming
  `Z` cuts resilience, not latency. Real consensus is the separate `consensus_poll` path
  (~20547). NEEDS owner intent before any edit (target the consensus_poll fan-out, not `Z`).
- **WM-MOBILE-SCALE-001** — AI watermark "lost" on mobile (again). The preview paper
  renders inside a `transform: scale(ui)` zoom container (app.js preview zoom; phone
  auto-fit factor well below 1). `antcv-watermark-page-anchor-341` positioned via
  `getBoundingClientRect()` (SCALED screen coords) but wrote `style.top/left` in the
  offset parent's UNSCALED local space, so the offset was wrong by the scale factor and
  pushed the marker off the visible paper. The 1.50.160 offset-parent rewrite dropped the
  older 1.50.147 viewport clamp without accounting for the transform — that is the "again".
  Fix: `anchorToCorner` recovers the cumulative scale from the offset parent
  (`rect / offsetWidth`) and converts every screen-space delta into local space; no-op at
  scale 1 (desktop). — FIXED✓ (1.50.167). **Live mobile verification owed** (no live
  browser in the build env): on a phone, CV + CL preview should show the marker in the
  last-page corner on the visible paper at any zoom.
- **CL-UNSOL-SIGNAL-001** — An unsolicited / "Open Application" cover letter rendered the
  literal template placeholders `[WHO I AM — …]` and `[WHY THIS POSITION — …]` instead of
  content. Root cause: the CL merge reducer backfills who/why from the hardcoded `n.who`/
  `n.why`, but `n` is gated on `p` (`kernelShowcaseInProgress || io.company === "Unsolicited"`
  exact). After GEN-UNSOL-001 an unsolicited letter can carry a real extracted company, so
  `p` is false, `n = {}`, and empty `who_content`/`why_content` collapse to `""` → the
  empty field shows its template placeholder. (WHAT I BRING never shows this — it has a
  row-level fallback independent of `p`.) Fix: a grounded, candidate-anchored backstop added
  AFTER `n.who`/`n.why` in both chains — purely additive (only fires when everything before
  is empty), so a normal/solicited letter never reaches it. Done as a **surgical in-place
  edit of the minified `app.js`** (one occurrence each, verified parse) per
  `docs/deployment/app-js-source-and-rebuild.md`, mirrored into `app.src.js` — NOT an
  esbuild rebuild. First proof the surgical-minified-edit path (the sanctioned interim until
  APPJS-REBUILD-001 is solved) works. — FIXED✓ (1.50.168). **Live verification owed:**
  generate an unsolicited letter; WHO I AM + WHY THIS POSITION show grounded prose, no
  brackets, in preview + DOCX/PDF.
- **APPJS-BLUESCREEN-001** — A full blue screen on load after the page-split engine
  was shipped via `npm run build:app`. **Root cause: the esbuild round-trip is NOT
  behaviour-preserving for this bundle.** The working `app.js` begins
  `(()=>{const{useState:e,…` (sloppy-mode global-React IIFE); the esbuild rebuild begins
  `"use strict";(()=>{…` — esbuild prepends a strict-mode directive and emits other
  minifier differences, and the original bundle relies on sloppy-mode semantics, so the
  rebuilt bundle threw at boot. NOT caused by the parallel `main` merge (the
  deployed/branch-HEAD `app.js` was confirmed to be the esbuild build). **Fix:** restored
  the ORIGINAL minified `app.js` + the clean `app.src.js` from pre-rebuild commit
  `0a7c459`; cache trio bumped to **1.50.166** (1.50.165 → STALE) so the broken cached
  bundle is flushed. Deployed live (deploy.yml → deploy-pwa green). — FIXED✓ (1.50.166).

### Still OPEN after this session

- **APPJS-REBUILD-001** `[FIXED 2026-06-12 — terser is the verified rebuild]` — there is
  now a verified behaviour-preserving rebuild. The identity round-trip gate was run:
  `terser pwa/app.src.js -c -m -o /tmp/x` (and `npm run build:app`, now repointed to the
  same terser command) reproduces the committed `pwa/app.js` **byte-for-byte** (871,787
  bytes, `cmp` clean), `node --check` OK, output begins `(()=>{`, 0 `"use strict"`. Terser
  is semantics-preserving for this sloppy-mode bundle (esbuild was not — it prepends the
  strict directive, APPJS-BLUESCREEN-001). So `app.src.js` source edits can now be rebuilt
  with the standard script and deployed after the usual cache-bust. Closes with
  BUILD-APP-BROKEN-001 above. *(superseded — original below)* `[OPEN][HIGH][build]` — There was no verified behaviour-preserving
  way to rebuild `app.js` from `app.src.js`; `npm run build:app` (esbuild `--minify`)
  blue-screened (APPJS-BLUESCREEN-001). Procedure documented in
  `docs/deployment/app-js-source-and-rebuild.md` and `CLAUDE.md`.
- **ENGINE-PAGESPLIT-001** `[OPEN][PAUSED][feature]` — The real on-screen page-split
  engine — per-item pagination so a forced break actually moves content to the next page
  for all three split units: **(1) sidebar sub-subsections, (2) table rows, (3) "How I
  would contribute" bullets** (heading moves with its first part). Today the CV two-column
  page-box engine paginates only WHOLE sidebar sections (`.page`) and WHOLE experience
  roles (`role.page`); there is no per-item primitive. The export side (docx-worker
  ≥1.14.18) already honours per-item `_page`/`item_pages`; this item is the matching
  on-screen render. **Paused — blocked on APPJS-REBUILD-001** (the change lives in
  `pwa/app.src.js` ~line 35574 and needs a working rebuild). Design notes:
  `docs/plan/PB-007-two-column-pagination.md`. A first cut was built (commit `636cda7`)
  and reverted with the blue-screen fix.
  **UN-PAUSED REVIEW 2026-06-12 → CLOSED, SUPERSEDED BY IMPLEMENTATION.** Both the
  blocker and the goal resolved while paused: (a) APPJS-REBUILD-001 is FIXED
  (`npm run build:app` = terser, identity round-trip gate PASSED), and (b) per-item
  on-screen pagination ships via the dual-map measurer + page-box renderers reading
  the EFFECTIVE bucket (manual `antcv:itemPages` ∪ auto `antcv:autoPagesPreview`):
  (1) sidebar sub-subsections split group-aware (verified diag-sidebar-cont-e2e),
  (2) table rows split with the header re-cloned (verified diag-table-split: 30-row
  table splits at row 26, no dup/loss), (3) HWIC/Foundation parts split via
  `__antcvBreaks`. The 📄 buttons now display the EFFECTIVE page (R37 "ᵃ" suffix).
  Residual owner check: tap 📄→2 on one sidebar item + one table row and confirm
  the on-screen move — same bucket the verified auto path uses.

---

## SESSION 2026-06-05/06 — Analysis report, JD ingestion, demo mode, generate fixes

Worklog for the analysis-PDF + JD-extraction + demo-mode + generate-flow engagement.
Newest registry section; individual IDs below. Live owner-acceptance still owed on
items marked VERIFYING.

### Resolved this session

- **ANALYSIS-PDF-001** — Branded, downloadable Analysis report (AntCV icon, slogan,
  app name, date, application name, low/medium-confidence statements, assumptions,
  recommendations, diagonal AI-ASSISTED watermark + AI notice). New sidecar
  `antcv-analysis-report-pdf-360.js`; client-side print-to-PDF. jd-analysis worker
  (cv-proxy + demo-proxy) extended to return `assumptions`/`recommendations`/
  `confidence_notes`. — FIXED✓ (1.50.146, workers deployed).
- **JD-OCR-001** — Image-based PDF (LinkedIn "Save as PDF": ~18 chars text, 98 images)
  failed with "no usable text" in the Analyse-JD block. Root cause: the block had its
  own pdf.js-text-only extractor. Fix: delegate to app.js's hardened `extractPDFText`
  cascade (pdf.js → garbled-detect → LLM text → vision OCR), exposed as
  `window.AntcvExtractPDFText`. Reuse, not a duplicate. — FIXED✓ (1.50.152).
- **JD-UPLOAD-001** — JD panel's PDF/Word/Image trio → single "⬆ Upload JD" button
  (accepts .pdf/.doc/.docx/.txt/.json/image; JSON parsed locally for jd_text). —
  FIXED✓ (1.50.153).
- **PERF-CB-001** — Provider circuit-breaker: a quota/auth-failed provider is dropped
  for the session instead of being re-hit + retried on every one of ~23 generate
  tasks (the ~7-minute-run cause). — FIXED✓ (1.50.155).
- **PERF-WARN-001** — OpenAI `429 "exceeded your current quota"` (classed rate_limit,
  not billing) never surfaced. Broadened the credit-banner trigger to fire on
  rate_limit-with-quota with a "using fallback providers, this run is slower" note. —
  FIXED✓ (1.50.154).
- **SW-SHELL-001** — `sw.js` SHELL precached `./antcv-mobile-controls.js` (+
  `antcv-tone-custom-slots.js`) which 404'd, so `cache.addAll` rejected and the shell
  never precached (offline broken). Removed stale entries; made install resilient
  (per-asset `cache.add().catch()`). — FIXED✓ (1.50.149/151).
- **DEMO-SETUP-001** — "⚠ Setup needed" wrongly shown to demo users. Gated it on
  `!(B&&B.demo_mode)`. (Note: a first attempt at 1.50.156 reverted M() too broadly and
  hid the "🟡 Use demo" cost chip — regression fixed at 1.50.157 by gating only the
  Setup-needed chip.) — FIXED✓ (1.50.157).
- **DEMO-CONFIG-001** — `/config` never returned `demo_mode`, so `B.demo_mode` was
  always false → ALL demo UI dead. The PWA reads the **relay** `/config`, which only
  returned `user_mode`. Added `demo_mode` to cv-proxy + demo-proxy `handleConfig`, and
  (the real fix) `demo_mode: userMode === 'demo'` to the **access-relay** `/config`.
  Workers deployed. — FIXED✓ (worker-side).
- **DEMO-WM-001** — DEMO watermark. Export path already stamps when `demo_mode`;
  added a preview overlay sidecar `antcv-demo-watermark.js` (tiled diagonal DEMO,
  pointer-events:none, prints). — Mechanism FIXED✓ (1.50.159), but **BLOCKED by
  DEMO-PERSIST-001**: a real demo account reads `demo_mode:false`, so the watermark
  appears in neither preview, export preview, nor DOCX/PDF until that is fixed.
  Not owner-confirmable yet.
- **GEN-EMPTY-001** — Empty Analysis panel after Generate ("Detailed analysis was not
  returned by the model" placeholder + empty fit/gaps). The 1.50.154 generate_cv
  fold-in enlarged the rationale → JSON truncation dropped it. Reverted the fold-in. —
  FIXED✓ (1.50.163).
- **GEN-UNSOL-001** — A known posting ("Optics/Camera Engineer at Sigma Connectivity")
  was stamped "Open Application — Unsolicited". The showcase guard forced Unsolicited
  whenever the Company field was blank, discarding the company the model extracted
  (`D.company = T.meta.company`). Fix: force Unsolicited only when the Company field is
  blank AND no real `D.company` was extracted. — FIXED✓ (1.50.164).
- **GEN-REPORT-001** — Full analysis report now appears on **Generate** (auto, via
  `merge-344` running `/api/jd-analysis` on the active JD) **and** Analyse JD (jd-block),
  both merging recruiter/red_flags/questions/assumptions/confidence/recommendations.
  Unblocked by GEN-EMPTY-001 + GEN-UNSOL-001. — FIXED✓ (1.50.163/164).

### Still OPEN after this session

- **HARDREFRESH-001** `[FIXED✓ verified headless 2026-06-11]` — In-app Hard Refresh
  shows the confirm but did nothing after OK. The in-source hardening (fire-and-forget
  cleanup + 1.2s forced reload + `location.replace` fallback, app.src.js ~28892)
  verifies green: `pwa/test/diag-hardrefresh.mjs` clicks the button with a CONTROLLING
  service worker and observes the reload. Likely explanation for the report: pre-1.50.355
  the Settings modal did not mount in the editor route at all (SETTINGS-NAV-Z-001), so
  the whole settings surface was unreachable/stale there. Owner to re-confirm on device.
- **DEMO-PERSIST-001** `[OPEN][HIGH][console][worker]` — **A demo user is server-
  classified as "paid".** Confirmed live: `51pegasib@gmail.com` (who carries the demo
  "⚠ Setup needed" chip) reads relay `/config` → `user_mode:"paid"`, `demo_mode:false`.
  `AntcvSetUserMode("demo")` + reload does **not** flip it (still `"paid"`). Because the
  account is treated as paid, every demo behaviour is wrong for them:
    - **"⚠ Setup needed"** chip shows (it should not for a demo account);
    - **no "DEMO" watermark** anywhere — **preview, export preview, and DOCX/PDF**
      (export stamping is gated on `demo_mode`, which is false here).
  This is the master demo bug; DEMO-SETUP-001 and DEMO-WM-001 are correct in mechanism
  but **cannot manifest until this is fixed** (a real demo account never reaches
  `demo_mode:true`). Relay write/read logic *looks* correct; suspects: the client POST
  (`/api/user/mode`, fire-and-forget, relies on `antcv-auth.js` header injection) silently
  failing, OR the account is pinned to "paid" by an admin/allowlist default. Decisive
  probe: the `SET-MODE` console snippet (POST status 401 vs 200+stale read), then check
  how the relay assigns the initial mode for this email.
  UPDATE 2026-06-10: addressed by the relay `auth-25` deploy — `getUserMode` now PINS
  `DEMO_EMAILS` (wrangler.toml: `51pegasib@gmail.com`) to `'demo'` regardless of any
  stored/POSTed mode (DEMO-PERSIST-001 mechanism, index.js getUserMode), so that account
  reaches `demo_mode:true` and every demo treatment (badge, watermark, export stamp) now
  has a true signal to render from. Needs the owner to confirm live on `51pegasib@gmail.com`
  (sign in → expect the 🟡 DEMO badge + DEMO watermark on preview AND export). If a NEW
  demo account is needed that isn't in DEMO_EMAILS, the in-app toggle (DEMO-TOGGLE-001)
  is the remaining gap.
- **DEMO-BADGE-001** `[STALE — already fixed in source, verified 2026-06-10]` — the "🟡
  DEMO" badge is NO LONGER hardcoded to an email. In the current source it renders via
  `__antcvDemoActive()` (app.src.js:1033 = `!!(B && B.demo_mode) && !__antcvHasOwnKey()`),
  the real signal, at app.src.js:39778/39801. Every other demo treatment (export-watermark
  notice 28734/43048, preview band 38874) uses the same gate. No code change needed; the
  "mix" the owner saw is explained by REGULAR-MODE-STALE-SETUP-001 (stale render until
  refresh — fixed 1.50.340) + DEMO-PERSIST-001 (server mode, addressed by the relay
  auth-25 DEMO_EMAILS pin). Closing as stale.
- **PRIVACY-DEMO-001** `[OPEN]` — Privacy LED not visible in demo mode (desktop +
  mobile). Not investigated; may overlap the parallel `fix/label-mobile-privacy-audit`.
- **SETTINGS-SUBTAB-001** `[OPEN]` — Pressing "EN"/applications-history doesn't open the
  relevant settings subtab; the settings panel renders **behind the preview** (z-index).
- **GEN-UNSOL-002** `[OPEN]` (follow-up to GEN-UNSOL-001) — The fix keeps `D.company`
  *if the model returns it*; the generation output schema doesn't explicitly request
  company/role, so if the model omits `meta.company` for a JD the header still falls to
  Unsolicited. Prompt-side: have generate_cv extract+emit company/role grounded in the
  JD.
- **DEMO-TOGGLE-001** `[PARKED — owner declined 2026-06-12 ("not interested")]` — No in-app Demo⇄Paid toggle (only the wizard).
  Proposed: a Settings toggle calling `AntcvSetUserMode`.
- **HOWCONTRIBUTE-001** `[OPEN]` — "How I would contribute" bullets are **missing in the
  template preview** (the section renders without its bullet list). Check the
  `text_bullets`/contribute renderer + the `mergeHowContributeFromLocalStorage` path
  (docx-client has the export-side merge; the preview side is dropping the bullets).
  Verify parity Preview ↔ DOCX/PDF (GEN-001).
- **LOGIN-GATE-001** `[OPEN][HIGH]` — The change that **forces default settings and hides
  the wizard when no wizard is needed landed badly**: on load the user gets a **blue
  screen instead of the loader**, then the wizard, then the set menu (wrong order, broken
  first paint). Candidate fix branch already exists:
  `feat/login-loading-gate` —
  https://github.com/gabrielk83/AntCV/compare/main...feat/login-loading-gate
  (review + verify the loader→app sequence before merge; this is the app-shell boot path —
  diagnostic-first, prior blue-screen incidents on this path).
- **APP-HISTORY-001** `[OPEN]` — **Application History is still not reachable from the
  preview's pop/overflow menu.** (Related to SETTINGS-SUBTAB-001 but distinct: this is the
  preview-side menu entry, not the Settings subtab.) The history control either isn't in
  that menu or its handler doesn't open the history view.

### Optimization roadmap (see `docs/perf/Generate_Cycle_and_Optimisation.md`)

- **PERF-002** `[OPEN]` — Consensus quorum/timeout: a consensus waits for ALL providers
  (`allSettled`), so one slow/retrying provider stalls it. Proceed on 2–3 of 4, or cap
  per-provider wait. (Note: consensus is already parallel; this is the real lever.)
- **PERF-003** `[OPEN][owner-confirmed split]` — Trim consensus width to 1–2 providers
  on the **mechanical** tasks only: `extract`/`extract_pdf`, `parse_jd`, `compress`,
  `fix_orphans`. Keep wide on `generate_cv`, `consensus_poll`, `consensus_reinforce`,
  `fuse`, `analyze_fit`, `long_context`, **`enrich`**, **`apply_correction`**, and all
  translation (DA/ES/ZH) — owner: these are quality-critical.
- **PERF-004** `[OPEN]` — enrich↔compress convergence skip: if a cycle produced no
  material change (or further compression loses signal), skip the next cycle instead of
  running a fixed 3×.
- **PERF-005** `[PARTIAL]` — Retire the redundant `/api/jd-analysis` cycle for generated
  docs. `merge-344` already reuses it; a full fold into generate was tried (1.50.154) and
  reverted (GEN-EMPTY-001), so the separate pass stays for now.

---

## DELETE-SAVE-001 — "Save my data locally first" tick not appearing — FIXED (v1.50.145)

**Owner (screenshot):** the DANGER ZONE "Are you sure?" confirm card showed
"🗑 Yes, erase everything" / "Cancel" but **no save-data checkbox and no Download
button**.

**Root cause:** the v1.50.142 injector anchored on button text `/delete my
account/i`. The live card uses different labels — the confirm button is "🗑 Yes,
erase everything" and the trigger is "🗑 Delete user" — so `findDeleteButton`
returned null and nothing injected. (The `AntcvFullErase` save-first wrap still
fired, since `saveFirst` defaults on, but the user had no visible control.)

**Card structure (app.js):** DANGER ZONE section → "⚠ DANGER ZONE" header →
always-visible description ("…Logs you out. No undo.") → `sn ? confirmCard :
"🗑 Delete user"`; confirmCard = "Are you sure?" + warning + flex button row
["🗑 Yes, erase everything", "Cancel"].

**Fix (v1.50.145):**
- `findEraseButton` now matches `/erase everything|delete my account/i`.
- **Checkbox** injects above the confirm card's button row (appears when armed).
- **Download button** anchors to the always-visible description leaf
  (`/Logs you out\. No undo\./`) and is inserted right after it, so it shows
  whether or not the confirm card is open.
- Both idempotent (marker-guarded). `?v=1.50.145`; cache trio → 1.50.145
  (1.50.144 → STALE).

**Verified (Node harness, 7/7):** Download lands directly after the description;
checkbox lands directly above the button row; both finders match the live labels;
re-inject is idempotent (one of each).

**Live verification owed:** open Settings → DANGER ZONE, click "Delete user",
confirm the "Save my data locally first" checkbox shows above the buttons and the
"⬇ Download my data" button shows under the description; unchecking it skips the
backup; checked → a backup downloads before erase.

---

## IMPORT-COUNT-001 — upload extract count wrong — FIXED (v1.50.143; live verification owed)

**Symptom:** after a CV upload the wizard toast read "✓ Found 0 work · 0
education · N certifications · 0 publications" even though the data imported
fine (real 6 work / 3 education / 2 publications).

**Root cause (diagnosed in app.js, fixed in the existing sidecar):**
- The toast counts come from a separate import-**preview** object (`On`), not
  from `personalInfo`. In the `_direct` upload path app.js persists the full
  profile via `le(t)` but sets the preview to **identity + certifications only**
  → work/education/publications show 0. (The toast also reads `On.work_history`,
  snake_case, which nothing ever populates — the data is under
  `experience`/`workHistory`.) So the count line was structurally wrong while the
  data was correct in `personalInfo`.
- `antcv-upload-recount-339.js` already recomputes the right counts from
  `personalInfo` (workHistory||experience, education, certifications,
  publicationsStructured||publications) and normalises the dual keys — but its
  **DOM rewrite silently no-opped**: app.js emits the line as many sibling React
  text nodes (`"✓ Found ", count, " work entr", "ies", " · ", …`), so the
  container's `textContent` matched the regex but no SINGLE child text node did,
  and the TreeWalker found nothing to rewrite.

**Fix:** added a split-text branch to `recountUploadSummary` — when a matching
element's children are ALL text nodes (the React leaf holding the split line),
collapse it to the corrected string. The styled wrapper above it (element child)
is correctly skipped, and the idempotency guard (`textContent` already equals the
expected string) prevents re-writes. `?v=1.50.143-multinode`; cache trio →
1.50.143 (1.50.142 → STALE).

**Verified (Node harness, 5/5):** split-text toast "0/0/6/0" rewritten to real
"6/3/6/2"; wrapper reflects it; experience→workHistory and
publications→publicationsStructured normalised; second tick idempotent (single
text node, no growth).

**Live verification owed:** upload a real CV (Anita persona), confirm the toast
shows the true work/education/publication counts (not 0), on the `_direct` JSON
path and the worker `extract-kernel` path, desktop + mobile.

---

## DATA-EXPORT-001 + DELETE-SAVE-001 — v1.50.142 (built; live verification owed)

New readable sidecar `pwa/antcv-data-export-360.js` (loaded in index.html after
`cloud-delete-296` + app.js). No app.js / fetch-wrapper change — reads
localStorage only, wraps the documented `AntcvFullErase` hook additively.

### What it does
- **DATA-EXPORT-001** — `window.AntcvDataExport(opts)` serialises every
  localStorage key (personalInfo, sections / cv_pwa_sections, meta, antcv:prefs,
  `antcv:analytics:counts`, antcv:apply:*, writing prefs, ...) into a downloadable
  JSON backup. Credential-looking keys (token/secret/jwt/apikey/...) and transient
  erase markers are excluded from a plain file. "Protected" = optional passphrase
  → WebCrypto **AES-GCM** (PBKDF2-SHA256, 250k iters); falls back to a plain file
  with a console warning if WebCrypto is unavailable (non-secure context).
  Filenames: `antcv-backup-YYYY-MM-DD.json` / `…encrypted.json`.
- A **"⬇ Download my data"** button is injected into the red Delete-account card
  (anchored by the "Delete my account" button text); clicking it prompts for an
  optional passphrase.
- **DELETE-SAVE-001** — a **"Save my data locally first"** checkbox (default ON,
  protective) is injected into the same card; when checked, the `AntcvFullErase`
  wrapper takes a fast unencrypted backup BEFORE deferring to the original erase.
  Backup failure never blocks the erase.

### Verified (Node harness, 13/13)
collectData includes user data + analytics and parses JSON values; excludes
apiKey/authToken/transient markers from a plain backup; `includeSecrets` re-includes
them; AES-GCM encrypt→decrypt round-trips; tampered IV fails (authenticated
encryption); plain export emits a dated filename; UI injection adds both nodes and
is idempotent (no dupes on re-sweep).

### Live verification owed (desktop + mobile, after deploy)
- [ ] Delete-account card shows the Download button + checkbox; styling reads native.
- [ ] Download (plain) yields a JSON file containing personalInfo + analytics; no
      api keys/tokens in the plain file.
- [ ] Download with a passphrase yields `…encrypted.json` that decrypts back.
- [ ] With the box checked, clicking "Delete my account" downloads a backup, THEN
      the existing erase + cloud-delete + reload runs (compose with cloud-delete-296).
- [ ] Escape hatch `localStorage['antcv:disable-data-export']='1'` removes the UI
      and the erase wrap.

### Decisions / follow-ups
- Default-CHECKED on the save-first box (protect irreversible loss); change to OFF
  if the owner prefers opt-in.
- Download button is anchored to the delete card (a stable, co-located data/privacy
  spot). If the owner wants it elsewhere in the Personal menu, give the target
  container and I'll re-anchor.
- **Import/restore is NOT implemented** (owner asked for download only). Reading a
  backup back in is a natural follow-up (DATA-IMPORT-001).

---

## 2026-06-04 (session) — mobile UI + page-break + HIWC editability (v1.50.102 → v1.50.119)

Branch `claude/antcv-roadmap-bugs-L9Sqa`. All items below are shipped to that
branch (PRs merged into `main` through the session). Live verification on
desktop AND mobile still owed except where "owner-confirmed".

### Status

| ID | Item | Layer | Version | Status |
|----|------|-------|---------|--------|
| MOB-TOPBAR-001 | Hide Ant icon + leftover table control (`CL`/`30%` = `.antcv-top-sliders`) on mobile | sidecar CSS | 1.50.112 | FIXED (verify live) |
| MOB-TOPBAR-002 | Privacy pill clipped off-screen — crop filename, single-row topbar | sidecar CSS | 1.50.114→115 | FIXED (verify live) |
| MOB-ALT-001 | Alt-circles palette → tap-to-open dropdown (one circle, opens the rest) | new sidecar | 1.50.113 | FIXED (verify live) |
| MOB-ALT-002 | Dropdown must open DOWN and escape the topbar overflow clip | sidecar | 1.50.116 | FIXED (verify live) |
| MOB-BOTTOMNAV-001 | Bottom-nav buttons clipped — shrink text/padding on mobile | new sidecar | 1.50.108 | FIXED (verify live) |
| HIWC-EDIT-001 | "How I would contribute" bullets not editable (esp. mobile) — inputs injected into React tree were wiped by the re-render storm; switched edit surface to the native textarea | sidecar | 1.50.117 | **FIXED (owner-confirmed working)** |
| HIWC-EDIT-002 | Per-bullet control strip squeezed the textarea — moved strip to its own row below | sidecar | 1.50.118 | FIXED (owner-confirmed) |
| HIWC-EDIT-003 | Control strip buttons clipped on phone — wrap the row | sidecar | 1.50.119 | **FIXED (owner-confirmed working)** |
| PAGEBREAK-SIDEBAR-001 | Page breaks for ALL sidebar sub/subsections (was wrongly narrowed in a revert) → PB-001 | sidecar `329` | 1.50.115 | FIXED (verify live export) |
| SETTINGS-AHZ-001 / **AH-001 / VF-014 / APPHIST-ZIDX-001** | "Open in Settings" Application-history subtab opens BEHIND preview | sidecar `327` | 1.50.109 | **STILL BROKEN per owner — blind ancestor-lift did not beat the trap. Reproduce → run `antcv-apphist-zindex-probe.js` → targeted patch. RE-OPEN.** |
| VF-005 / CA-002 | Application "Role - Company" sentence editable + follows package style | sidecar `341` | (main) | FIXED (owner-confirmed) |
| CA-001 (spec line) | `[Specialisation — …]` editable in preview (meta.subtitle) | sidecar `341` | (main) | FIXED (owner-confirmed) |
| SETTINGS-HEAD-002 | WRITING STYLE + LANGUAGES headers match ADVANCED TONE font/size; tighten gap | sidecar | 1.50.110 | FIXED (verify live) |
| LAYOUT-NOTES-001 | "Within-package style" notes: shrink, drop package name, relocate (Quick-alt under packages, Custom onto the Custom button) | island source (vite) | 1.50.111 | FIXED (verify live) |

### Reverted / parked this session
- **TABLE-PAGEBREAK-001 (Core/WIB per-row `↧`) — REVERTED at 1.50.103.** The
  reliable per-row toggle wrote to the wrong section: the WIB control falls back
  to `sid:'core_competencies'`, and `pageBreakRows`/`itemPages` are keyed by
  section id only, so the CL "What I Bring" and the CV "Core Competencies"
  collide across documents — pressing WIB's ↧ corrupted Core. Restored to the
  known-good `📄` page system. **A correct per-row table break needs per-doc
  keying that also reaches the DOCX worker — a deliberate redesign, not a hotfix.**

### Canonical page-break family (PB-001..006) — reconciled with the v4 index
Owner: "page break in general" still not right. The locked requirements:
- **PB-001** — manual Page Break from BOTH main area and sidebar (sidebar partly via `329`/1.50.115; main-area + on-entry manual control unverified).
- **PB-002** — first sub-subsection moves the WHOLE subsection with its original heading (no dup).
- **PB-003** — continuation heading: duplicate heading + localized "Cont." 18pt from top.
- **PB-004** — table rules: first row moves the table; a later row splits it and repeats headers. (TABLE-PAGEBREAK-001 is the per-row toggle, parked — see above.)
- **PB-005** — replace the down-arrow icon + "Compress" text (semantic page glyph; "Fit"). (`page-break-icon-357` / `help-text-wording-357` — VERIFYING.)
- **PB-006** — preserve the Professional Experience pattern (reference, VF-018).
- **EXPORT-PAGE2-001** `[FIXED 1.50.374 — headless-verified]` — export PREVIEW shows only page 1 / breaks not applied. Driven with a headless variant of the probe: the iframe CLONE was never the problem (it carries every native `.antcv-page-row` + all page-2 content). The defect was the PRINT path — the srcdoc print CSS keyed breaks on legacy marker attributes (`data-antcv-page-break-284` etc.) that the native page-row pagination never sets, so the print engine re-paginated the tall paper arbitrarily; and the title counted PAPERS (always 1 now). FIX (`antcv-pdf-preview-gate.js` 1.50.374-page2-print): print CSS breaks on `.antcv-page-row + .antcv-page-row` + one-sheet clamp; `@page` margin 0 when native rows present (10mm spilled a sliver per row onto blank pages); title + CV/CL rebuild count page-rows. BONUS: page-selector chips (EXPORT-PREVIEW-FEATURES-001(c)). Locked by `pwa/test/diag-export-preview-pages.mjs` (8/8).

### Still OPEN from earlier in the engagement (not addressed this session)
- **RERENDER-STORM-001 [RESOLVED — probe-verified 2026-06-11, regression-locked]** —
  the mutation-source probe now runs headlessly as `pwa/test/diag-rerender-storm.mjs`
  (5s steady-state tally by source + rAF rate, thresholds total<30/s, worst<10/s).
  Current build measures: desktop 3 mutations/s, 7.2 rAF/s; mobile-390px 8.2
  mutations/s, 28.2 rAF/s; worst single source 1.8/s; 0 errors — versus the historic
  150+/s storm. The 1.50.80–85 idempotency + central-damper rounds hold. Residual
  ~1/s writers (altcircle, watermark-corner, page-fit-applied) are far below problem
  level. If the owner's mobile console still floods, re-run the committed probe on
  that device's content set.
- **APP-SENTENCE-STYLE-001 [FIXED✓ verified headless 2026-06-11]** — the candidate
  "Application: Role - Company" sentence follows the chosen package style: the
  v1.50.105 fix prefers the hidden ORIGINAL sentence anchor's computed style (the
  template's exact color/font for that slot). Verified: host color
  rgba(255,255,255,0.9) === anchor color on the dark header, template font adopted,
  all three spans contenteditable. Locked by `pwa/test/diag-candidate-header-edit.mjs`.
- **SPECIALISATION-EDIT-001 [FIXED✓ verified headless 2026-06-11]** — the
  `[Specialisation — …]` line IS wrapped contenteditable (v1.50.106
  `wrapSpecialisation`); an edit persists to `meta.subtitle` and survives. Locked by
  the same diag test.
- **DOCX-EXPORT-REGRESSION-001 [OPEN]** — see batch triage below (export from the
  print-setup view doesn't call `exportDocxViaWorker`).

---

## VISUAL-SETTINGS PLACEMENT — v1.50.95 (built, NOT yet deployed; live verification owed)

Addresses the **placement** of visual settings across the STANDARD Personal / Layout subtabs — the placement aspects of `VISUAL-PKG-003`, `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001` (see the 2026-06-04 batch triage below). Some behavioural sub-items of those IDs remain (see Deferred). Source-only (React islands + protocol version bumps); `pwa/antcv-react-islands.js` rebuilt via `npm run build`. Not committed/deployed yet — deploy + live acceptance gate owed.

Context found this session: local `main` was **70 commits behind** `origin/main` (prod v1.50.93); synced via fast-forward to `160ccd2` before editing. The earlier "Visual-package Layout move" (`75911dc`) had been a hand-edit to the minified bundle only and was silently reverted when the bundle was later rebuilt from un-updated source.

### What changed (source)
- **VISUAL PACKAGE (PackagePicker) moved out of Personal → Layout.** Mount gates on `isLayoutSubtab`, anchored immediately after the native STYLE PACKAGE section. Rendered with `context="layout"`: the redundant 7-package grid is hidden (native STYLE PACKAGE buttons own selection); surfaces the **Quick-alternative** selector + explanation and the **Custom** explanation (auto-engages via the existing `window.AntcvCustomMode` tolerance evaluator). Personal carries no visual-package control. (VISUAL-PKG-001..003)
- **LANGUAGES (LanguageCard)** re-anchored into the Personal order-based flex column at `order:35` → after the writing-style/tone group, immediately before Banned Words.
- **SECTION LAYOUT (LayoutPicker)** re-anchored into the same column at `order:45` → after Banned Words. (SECTION-LAYOUT-001)
- **Styling:** the three injected cards' headers use the shared native register `NATIVE_SECTION_HEADER_STYLE` (Georgia 11px / 600 / .4px / rgba(255,255,255,.55)) so they read as native sections. (SETTINGS-HEAD-001)
- Helpers added to `src/lib/settings-dom.ts`: `findSettingsFlexColumn` (Personal order-column), `findSectionBlockBeforeNext` (Layout block-flow), `NATIVE_SECTION_HEADER_STYLE`.

### Verification (run on live, desktop AND mobile, after deploy)
- [ ] Personal: Languages after WRITING STYLE/Advanced Tone, immediately before Banned Words; Section layout immediately after Banned Words. No cramped bottom 3-column row.
- [ ] Personal: NO Visual-package control present (no duplicate/orphan).
- [ ] Layout: "Within-package style" card (Quick-alt + Custom) sits directly under the STYLE PACKAGE buttons, before SIDEBAR POSITION. Quick-alt Default/Alt 1/Alt 2 apply; Custom explanation shown.
- [ ] The three injected card headers match the native section register (font/size/colour).
- [ ] Native STYLE PACKAGE buttons and Quick-alt both apply to the preview; no Preview-only / after-hard-refresh-only behaviour.

### Anchoring mechanics (so a future session doesn't re-derive)
Personal subtab = `display:flex; flex-direction:column` ordered by CSS `order` (WRITING STYLE 25 / ADVANCED TONE 30 / BANNED WORDS 40). Layout subtab = block flow. Both placement helpers were prototyped against the live deployed DOM and confirmed to land in the correct slots before the source was finalised.

### Deferred follow-up (remaining sub-items of the same IDs)
- **VISUAL-PKG-001** — rename the native app.js panel label "STYLE PACKAGE" → "Visual package" (app.js; fold into the MERGE-DUP pass).
- **VISUAL-PKG-002** — enrich each native STYLE PACKAGE button with the package-card detail (palette / font / shape / photo-size icons).
- **VISUAL-PKG-003** — move the "Segoe UI · circle · 120px" descriptor out of the package card to sit next to the Alt circles (the caption wording is now aligned; descriptor relocation pending).
- **SECTION-LAYOUT-001** — make the whole Section-layout island collapsible + collapsed by default, refresh it when the writing style changes, and route out-of-definition edits into a custom writing style.
- Fold Quick-alt + Custom natively into the Layout STYLE PACKAGE section in `app.js` and delete the PackagePicker island (the "deprecated afterwards" end state). Wire the native Advanced → Style colour/font/image pickers to `window.AntcvCustomMode` so Custom auto-engages on out-of-tolerance edits.
- WritingStylePicker island renders empty (width 0) on production and sits inert in Personal — separate pre-existing issue, not addressed here.

---

## 2026-06-04 (batch) — owner feature + bug dump triaged

Full triage with per-item IDs, layer, and sidecar-vs-app.js verdict lives in
`docs/plan/Batch_2026-06-04_feature-and-bug-triage.md`. Summary:

- **Landed (sidecar):** `JD-TEXTAREA-001` (JD textarea halved + host panels
  scrollable, incl. mobile); `PRIVACY-FAB-FLICKER-001` (top-bar pill background
  bleep — see below).
- **New feature, NOT in locked docs:** `FEATURE-CONF-001` — per-sentence
  confidence overlay (Application-tab toggle, default off; red=low/yellow=medium;
  hover shows issue). Locked docs use "confidence" only in the tone sense. Needs
  a WORKER self-check pass + app.js toggle/store + preview renderer. Spec'd in the
  triage doc; raise as a new Writing-System "verification/confidence" section.
- **Priority regression:** `DOCX-EXPORT-REGRESSION-001` — DOCX export was wired to
  the preview-panel button only; export now runs from the print-setup view, which
  doesn't call `exportDocxViaWorker`. Needs branch-archaeology (find the prior
  fix) + re-wire the print-setup export handler in app.js.
- **Registered (app.js / React / worker):** `PAGEBREAK-001..005` (export-preview
  marker, on-entry + A4-overflow detection, continuation header, cascade colour
  across all sections + CL), `VISUAL-PKG-001..003`, `MERGE-DUP-001..003`,
  `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001`, `LOCATION-001`, `DEMO-WARN-001`,
  `PRIVACY-SETTINGS-001`, `WIZARD-001..002`, `IMPORT-COUNT-001`,
  `PHOTO-PLACEMENT-001` (only sidebar photo positions render in the preview;
  header/main/bridge placements are no-ops — app.js render gap, format-prefs
  sidecar only stores the pref).

---

## 2026-06-04 (later) — section-layout help text trimmed + CL-HEADER-001 DOM captured

### Fixed — LAYOUT help-text overflow
- Owner: the Per-section-overrides help paragraph is too long. Replaced the §4.4 wall of text in `src/islands/LayoutPicker/LayoutPicker.tsx` with "Per-section overrides — pick a layout and set a length hint, or reset (↺) to use the style default." Rebuilt `pwa/antcv-react-islands.js` (Vite); bundle `?v=` → 1.50.70, `sw.js` → `antcv-1.50.70`, `version-override` TARGET → 1.50.70 (1.50.69 added to STALE).

### PUB-ROW-LAYOUT-001 — Publications & Patent per-item row layout (partial fix shipped)
- Owner: the per-item row has a blank gap that pushes the buttons aside; delete (✕) should sit right after the Journal/details input (not pushed away over the name input); the eye (👁) should be leftmost; the ▲▼ move buttons are completely hidden.
- **Root:** app.js renders the per-item row as a 4-col CSS grid (`30px minmax(120px,1.2fr) minmax(160px,2.8fr) 28px`). Sidecar **273** (strict-row-layout) owns the per-item row and lays it out as **flex** with `order`/fixed input widths; sidecar **278** (section-header row-fix) was *also* re-classifying the per-item eye/delete (walked up to a high ancestor) and stamping them `kind=on`/`del` at order 50/60 — fighting 273's order 40/50. The captured eye carried BOTH `data-antcv-pub273-eye` and `data-antcv-pubrow-kind-278="on"`. When 273 doesn't convert the container to flex in time, its flex-oriented children land in the app's grid → blank columns (inputs forced to 48/138px inside 1.2fr/2.8fr columns) and the move buttons (in a sibling `justify-content:flex-end` div) get clipped.
- **Shipped (safe, exclusion-only):** 278 v1.40.278-excl273 now SKIPS any button 273 owns (`data-antcv-pub273-*` / inside `[data-antcv-pub273-row]`), so it no longer fights 273 on per-item rows. `?v=1.40.278-excl273`, sw → `antcv-1.50.76`, TARGET → 1.50.76 (1.50.75 → STALE).
- **Still owed (needs live-tested 273 pass — registered):** (1) guarantee 273 converts the per-item row container from grid→flex so the blank gap can't appear; (2) re-order to the owner's spec — **👁 leftmost**, then name, then journal, then **✕ adjacent to journal**, with page/cjlr/compress/enhance + ▲▼ placed deliberately; (3) make the ▲▼ move buttons visible (their sibling flex div is clipped by the row width clamp). Diagnose live (the owner can't log into the branch preview — no relay configured there — so this needs prod or a relay-configured session).

### HIWC-BULLET-EDIT-001 — FIXED (1.50.86): debounce per-keystroke write + edit-safety
- After the loop damper (1.50.85) HIWC was still "not typable". Direct cause: every keystroke in a bullet input ran `inp.oninput → syncFromInputs → syncSectionField → pulse()` (`antcv:sections-updated`) → personality `forceRebuild` → React re-renders the HIWC section → the input being typed in is re-created → focus lost.
- **Fix (1.50.86, `how-contribute-controls-245`):** (a) the bullet input's section write is now **debounced 600ms** (and flushed on blur) instead of firing per keystroke, so typing no longer pulses a forceRebuild mid-word; (b) `run()` bails when `document.activeElement` is a HIWC bullet input (`isTypingInHiwc`), so the sidecar won't rebuild the row while the user is typing. Cache-bust `?v=1.50.86-typable`, sw → `antcv-1.50.86`, TARGET → 1.50.86 (1.50.85 → STALE).

### HIWC-EMPTY-PREVIEW-001 — empty bullet template must stay visible (verify on 1.50.86)
- Owner: the HIWC bullet template placeholder must remain visible in the preview as long as nothing has been typed into the bullet (or until deleted via ×). `syncPreviewBulletNodes` already returns early when there are no real values (`!vals.length`), so the sidecar does not inject/clobber the template; `preview-bullets-dedup-341` (prv-bullets3) is designed to keep a template-only list when there is no real-data sibling. The churn (now damped + the per-keystroke rebuild removed in 1.50.86) was a likely cause of the template flickering away. Re-check on 1.50.86: empty → template shown; typing → replaced; delete-× → template returns. If it still hides, the culprit is prv-bullets3's sibling check or `applyPreview` reconciling-down — fix there.

### HIWC-RERENDER-LOOP-001 — round 8 (1.50.85): CENTRAL DAMPER (whole class, one file)
- Owner directive: stop the per-round whack-a-mole, kill the loop decisively, ship. Privacy blip confirmed fixed (1.50.84); HIWC still hard to edit + preview→panel sync still broken (both downstream of the churn).
- **Fix:** new `pwa/antcv-loop-damper.js` (loaded FIRST, before all sidecars + app.js) wraps `MutationObserver` so callbacks for BROAD observers (target = body/documentElement + `subtree:true` — i.e. the ~60-sidecar herd) are coalesced + throttled to ~6.7/sec (150ms). Narrow/targeted observers pass through unchanged (contenteditable/focused widgets keep normal latency). A sidecar can still react, just not at frame rate, so it can't sustain a frame-rate feedback loop. React 18 doesn't use MutationObserver, so it's unaffected. Disable hatch: `localStorage['antcvDisableLoopDamper']='1'`. Risk acknowledged (global API wrap) per owner's "no matter the risk"; single-file revert if needed. `sw.js` → `antcv-1.50.85`, TARGET → 1.50.85 (1.50.84 → STALE).
- **Expected:** the mutation/rAF storm caps at ~6.7/sec regardless of how many writers exist → preview stops churning, HIWC inputs keep focus (editable), and prior per-screen pumps (align-cycler ping-pong, etc.) can no longer run hot. Re-run the rAF + mutation-source probes — totals should be a fraction of before. This is meant to END the loop sessions.

### PRIVACY-FAB-FLICKER-001 — FIXED at source (1.50.84) + loop round 8
- **mutation-source probe on 1.50.83 (Preview + panel):** round-7 worked (panel-action/label-206/207 dropped 296→39/sec). New top: `style on BUTTON.antcv-align-cycler` (156/sec) + `childList on DIV` (156) + `align-cycler-injected` (156) + `preview-cjlr-hidden` (78) + `align-sid` (78) … and `style on BUTTON.antcv-fab` (29/sec) = the privacy blip.
- **Privacy blip root + fix:** `topbar-tools-347.stylePrivacyForTopbar` re-asserted `display/visibility/opacity !important` on the FAB **every sweep** to fight the islands PreviewToolbar's periodic inline hide — a JS ping-pong that mutated the FAB style ~29/sec (the blip). Fix (1.50.84): force the relocated FAB visible with a **passive CSS `!important` rule** (`injectPrivacyVisibilityCss`) that beats the island's non-important inline hide, and **remove the per-sweep JS display/visibility/opacity writes**. CSS wins passively → no counter-write, no blip. `?v=1.50.84-fab-css`, sw → `antcv-1.50.84`, TARGET → 1.50.84 (1.50.83 → STALE).
- **Still pumping (registered, next round): ALIGN-CYCLER-PINGPONG** — `section-align` keeps creating per-section `antcv-align-cycler` buttons while `antcv-section-main-panel-fix.removePreviewCjlrGhosts` keeps removing them as "ghosts" (`preview-cjlr-hidden` + `btn.remove()`) → ~156/sec create/remove churn. Resolve by stopping section-align from injecting the preview cyclers that main-panel-fix immediately deletes (feature-level — confirm which cycler is canonical before disabling). `align-sid` (78/sec) is written by app.js on section rows (downstream of its re-render; not sidecar-fixable).

### PREVIEW-PANEL-EDIT-SYNC-001 (registered)
- Owner: after editing inputs in the preview, the section panel isn't editable / doesn't pick up the change (preview→panel reverse sync). Same family as CL-HEADER-001 (panel↔preview share a store via candidate-preview-editor); register for the candidate-editing pass once the loop is flat.

### HIWC-RERENDER-LOOP-001 — round 7 (1.50.83): section-panel-206/207/208 attribute storm (Preview + panel open)
- **mutation-source probe on 1.50.82, Preview with sections panel open:** the pump is `data-antcv-panel-action/label-207` (296/sec), `-206` (228/sec), `-208` (202/sec) on BUTTON — **~726/sec combined** — plus align-cycler style/childList (~167/sec, downstream). Earlier rounds didn't see these because that screen wasn't probed; the prior `forceRebuild`/HIWC writes were a different facet.
- **Root:** THREE section-panel sidecars (`antcv-section-panel-206/207/208.js` — iterative versions, all still loaded) each loop over the panel buttons every sweep and `setAttribute` `data-antcv-panel-action/label-NNN` + `style.order` **unconditionally** (208 also stamps 207's; 207 also stamps 206's). Each `setAttribute` to the same value emits a mutation record → wakes every body-observer → they re-run → re-stamp = the storm.
- **Fix (1.50.83):** idempotency guards in all three button loops — write `data-antcv-panel-action/label-*` and `style.order` only when the value differs. Stable state → zero panel mutations. Cache-bust: 3 tags → `?v=1.50.83-idem`, sw → `antcv-1.50.83`, TARGET → 1.50.83 (1.50.82 → STALE).
- **Note:** 206/207/208 are layered versions all active — a future cleanup should retire the superseded ones, but idempotency is the safe immediate fix. The ~167/sec align-cycler churn is downstream of these re-renders; re-probe after deploy — if it persists, guard section-align's `injectPanelCyclersInto`/cycler restyle next.

### HIWC-RERENDER-LOOP-001 — round 6 (1.50.82): the HIWC section-write loop (residual)
- **Progress confirmed (owner, 1.50.81):** privacy FAB gone from Settings ✅ (PRIVACY-SETTINGS-001 fixed by the sticky back-off); top-bar flicker "slower" (back-off working, residual driven by the loop below).
- **Residual loop named in console:** repeated `[antcv] sections refreshed from external write {source: 'how-contribute-controls'}` → `[antcv-personality] forceRebuild antcv:sections-updated how-contribute-controls` → `[shape-guard] eager-normalized`. `how-contribute-controls-245.syncSectionField` wrote sections + `pulse()` (dispatch `antcv:sections-updated`) on EVERY call → personality forceRebuild re-renders the section → the sidecar re-runs → writes again. This is also why HIWC was "very hard to type" and the preview bullets duplicated (`g,gr,g,gr` for 2 inputs — the loop re-injecting).
- **Fix (1.50.82):** `syncSectionField` is now idempotent — compares intro/closing/bullets against the stored values and only `writeJson`/`writeDocSpecificSections`/`pulse()` when something actually changed. No change → no write → no pulse → no forceRebuild → loop dies. Cache-bust `?v=1.50.82-idem`, sw → `antcv-1.50.82`, TARGET → 1.50.82 (1.50.81 → STALE).
- **Expected:** HIWC typable, preview bullets no longer duplicated, and the residual privacy flicker stops (the forceRebuilds that re-triggered the overlay toggle are gone). If the preview still shows duplicate bullets after this, that's a separate app-renders-bullets + sidecar-injects-bullets dedup (HIWC-EMPTY-PREVIEW-001) — re-check after deploy.

### HIWC-RERENDER-LOOP-001 — round 5 (1.50.81): overlay hide/show ping-pong (privacy flicker) + log noise
- **Post-1.50.80 console named the residual churners:** `preview-shell-sticky:128 unhid <div class="antcv-overlay antcv-overlay-bottom-right"> flex` spamming, + `lang-bar-filter:223 wanted=en,da shown=2 hidden=2` spamming. The align-attr storm (round 4) is gone.
- **Root (privacy flicker + "FAB visible on the side in Settings"):** `antcv-overlay.js:413` toggles `antcv-overlay-hidden` from `isContentReady()` (false in Settings / during cloud-sync). `preview-shell-sticky` strips that class via a MutationObserver. Both observe the overlay → they re-trigger each other at frame rate (the flicker + rAF churn). And sticky forcing the overlay visible in Settings is exactly why the FAB shows "on the side" there.
- **Fix (1.50.81):** `preview-shell-sticky` — (a) anti-ping-pong **back-off**: distinguish a single transient hide (correct once — its real job in preview) from a persistent hide (Settings / not-ready — yield 5s so antcv-overlay wins → no flicker + FAB stays hidden in Settings, satisfying PRIVACY-SETTINGS-001); (b) narrow its observer to class changes ON an overlay root (was every class mutation in the body). `lang-bar-filter` — log only on actual change (was idempotent but logged every woken run = console flood). Cache-bust: `?v=1.50.81-backoff` / `?v=1.50.81-quietlog`, sw → `antcv-1.50.81`, TARGET → 1.50.81 (1.50.80 → STALE).
- **Expected:** privacy flicker stops, FAB hidden in Settings, rAF flood drops further. Re-run the rAF + mutation-source probes; if residue remains (`style on BUTTON` ~21/sec), that's the next target.

### HIWC-RERENDER-LOOP-001 — round 4 (1.50.80): PUMP FOUND + fixed
- **mutation-source probe (1.50.79) named the pump:** `attr:data-antcv-profile-workstyle-align on SPAN` = **765/5s ≈ 153/sec** — by far the dominant mutation. Then `data-antcv-aligned on SPAN` ~33/sec (section-align), `data-antcv-core-row-preview-align on TR` ~25/sec + `data-antcv-core-row-align` (core-competencies-234), `style on BUTTON` ~21/sec, pub273 attrs, `style on BUTTON.antcv-fab` ~10/sec.
- **Root:** four sidecars wrote `style.textAlign` + their align ATTRIBUTE **unconditionally on every sweep** (~12 spans × ~13 sweeps/sec). `setAttribute` to the same value still emits a MutationObserver record, so this generated ~236 attribute-mutations/sec — the storm that woke every body-observer in the app (the ~13/sec herd + the island mount reactors = the re-render loop). NOT React; a sidecar attribute storm.
- **Fix (1.50.80) — idempotency guards (write only when the value differs):** `antcv-profile-workstyle-cjlr-238` (applyEditors + applyPreview, the 153/sec), `antcv-section-align` (applyAlignmentToSection, data-antcv-aligned), `antcv-core-competencies-row-controls-234` (applyEditor + table applyAlign). Stable state now produces ZERO align mutations. Cache-bust: 3 tags → `?v=1.50.80-idem`, sw → `antcv-1.50.80`, TARGET → 1.50.80 (1.50.79 → STALE).
- **Expected:** rafPerSec should drop sharply; HIWC editing, empty-preview, privacy flicker, and pub-multi-row should settle (all were downstream of this storm). Re-run the rAF + mutation-source probes to confirm; secondary residue (`style on BUTTON` 21/sec, pub273) addressed next if still present.

### Mobile + label batch (owner, 1.50.80-era) — registered
- **MOBILE-FUSE-001:** the Fuse (🔀) button is not visible in the mobile bottom panel — surface it there.
- **MOBILE-TABLEWIDTH-001:** the table-width controls from the top panel are only partly visible on mobile — hide them entirely on mobile (acceptable per owner).
- **MOBILE-EXTRACTION-001:** the document-Extraction button can hover in the grey area on mobile — re-anchor it.
- **LABEL-HISTORY-001:** rename the top-panel "Application history" button to "History" to save space. (app.js-rendered label; candidate for a sections-icon-style text rewrite or app.js.)

### HIWC-RERENDER-LOOP-001 — round 3 (need mutation-source probe for the pump)
- **Probe on 1.50.79:** round-2 confirmed — `section-align` GONE from the top. Remaining: `react-islands.js:1` ~42/sec (209/5s), then the ~13/sec herd (66/5s each).
- **Finding by source inspection:** the ~42/sec react-islands rAF is the island `mount.tsx` MutationObservers (PackagePicker/LayoutPicker/WritingStylePicker/LanguageCard/ExportOptions/etc.) each watching `document.body {childList,subtree}` and rAF→`applyOnce` on every mutation. `applyOnce` is idempotent (renders only if unmounted), so they're cheap REACTORS, not the pump. Every 13/sec herd entry (`data-importer:978`, `personality:597`, `candidate-preview-editor:408`, …) is likewise a body-observer→rAF→idempotent-sweep REACTOR. So a single source mutates the DOM ~13/sec and everything reacts; the rAF probe structurally can't show it (mutators don't rAF).
- **Next datum:** `docs/qa/probes/mutation-source-probe.js` records the top mutated targets (element/attr) — names WHAT changes 13/sec → the pump (a sidecar emitter to gate, or app.js-internal). Until then, do not throttle the 8 island mount observers blind (Vite rebuild, untestable here, and only reduces amplification not the root).

### SETTINGS-OVER-PREVIEW-001 — "Open in Settings →" / Application history must lay OVER the preview (after the loop)
- Owner: the `Open in Settings →` button (Applications) should open Settings → Application history ABOVE the preview, not behind it. `antcv-settings-front-327.js` already z-indexes settings roots to 2147483600 + clicks STANDARD → Application history; verify why the panel still lands behind preview (likely the preview/paper has its own stacking context or the settings root isn't matched). Do AFTER the loop is resolved (settings-front was just throttled; confirm interaction).
- **Round-1 confirmed working (probe on 1.50.78):** `settings-front`, `wizard-step10`, `row-controls` all dropped out of the top; the personality gate held (forceRebuild logged once, not looping). But ~798→ still flooding; new top: `react-islands.js:1` **39/sec** (React re-rendering), `section-align.js:1117` **24/sec** + `:1021` 12/sec, then the ~12/sec herd.
- **Round-2 fix (section-align, 1.50.79):** (1) the role-cycler `rAF` at line 1117 was UNGUARDED — fired on every `schedule()` (~24/sec) running a `querySelectorAll` reflow for an INERT feature (no `[data-role-id]` in app.js); now skipped when none exist + guarded. (2) throttled the main reapply pass to ≥300ms (was ~12/sec). Net ~33/sec of rAF + forced-reflow removed. `?v=1.50.79-throttle`, sw → `antcv-1.50.79`, TARGET → 1.50.79 (1.50.78 → STALE).
- **Remaining engine:** `react-islands.js` re-rendering ~39/sec — a React state loop inside the islands (src/islands), which churns the DOM and wakes the 12/sec herd. The rAF probe can't name the island (all map to bundle :1). Next: the new `docs/qa/probes/event-rate-probe.js` counts dispatched event types — if `antcv:sections-updated`/`input`/`storage` fires ~12-39/sec, that names the trigger the islands re-render on, and I gate the emitter. Do NOT blind-edit the islands bundle.

### Row-control batch (owner, 2026-06-04) — gated on the loop, registered
All three are in the contended row-control zone that HIWC-RERENDER-LOOP-001 is actively churning; implement after the loop is confirmed dead (otherwise unverifiable + risks worsening the oscillator).
- **PUB-ROW-MULTIROW-001:** in Publications & Patent the `273` controls attach only to the FIRST row; rows 2-3 show just input + delete (owner screenshot). `273.rows()` does pair name+detail for every row, so the most likely cause is the loop re-creating rows 2-3 before `273` re-wires them (row 1 stays wired). Re-check after the loop fix; if it persists, debug `273` per-row `wire()`/`host()` attachment.
- **MERGED-MOVE-CONTROL-001:** replace the big separate up/down buttons (23px, bordered, `data-antcv-pub273-move`) with the COMPACT STACKED control used elsewhere — `<div style="display:flex;flex-direction:column;gap:1px"><button 8px borderless>▲</button><button 8px borderless>▼</button></div>` — across ALL list subsubsections (HIWC bullets, pub rows, tables). Add drag-to-move (snap). The move result MUST reflect in the preview. Tables: do NOT move the table header row (it is duplicated only when the table spans a page break). Owners: `273` (pub), `how-contribute-controls-245` (bullets), `table-row-page-controls-328`/`table-page-splits-327` (tables).
- **CL-BODY-CONTROLS-001:** in the cover letter, Body subsections are missing the ▶ first button (before Enhance) that the CV main rows have; and the designated `data-antcv-cl-body-move-button="greeting"` (☰ "Move Greeting to the candidate area") does not work. Owner: `antcv-cl-body-move-button-341.js`. Verify the move handler wiring + add the ▶ control to parallel the CV rows.

### Loop still flooding after 1.50.77 (owner, with rAF flood) — gate everything on the probe
Owner reports the `requestAnimationFrame` violation flood persists, AND: HIWC bullets not editable in the section panel, HIWC empty-template bullets not visible in preview, privacy FAB still flickers.
- **All four are downstream of HIWC-RERENDER-LOOP-001, not separate bugs:**
  - **HIWC-BULLET-EDIT-001:** `how-contribute-controls-245.renderBulletList` IS guarded (binds the input once per textarea via `data-antcv-hiwc-bullets-bound`). The guard is defeated when the loop re-creates the textarea ELEMENT each cycle → fresh unbound textarea → input rebuilt → focus lost → typing doesn't stick. Fixing the loop fixes editability.
  - **HIWC-EMPTY-PREVIEW-001:** the empty template can't settle while the section re-renders ~12/sec (prv-bullets3 + the loop racing).
  - **PRIVACY-FAB still flickers:** the loop re-mounts the topbar → `topbar-tools-347` re-parents the FAB each cycle (the v1.50.74 transition/guard fix only addressed the FAB's own repaint, not topbar re-mounting under the loop).
- **Blocker / next step:** confirm the owner is actually on ≥1.50.77 (`window.ANTCV_VERSION`; stale SW would serve the old bundle) and re-run the rAF-attribution probe for the new top-of-table. Round-1 (1.50.77) hit settings-front/wizard-step10/personality/row-controls; if a 12/sec residue remains, gate the next pump (candidate-preview-editor emit or the React-islands 39/sec re-render). Do NOT blind-patch more sidecars without the fresh table — the ~50-sidecar coupled oscillator can worsen.

### DATA-EXPORT-001 + DELETE-SAVE-001 — owner feature requests (APP.JS, registered)
- **DATA-EXPORT-001:** in the Personal menu, let the user download their stored data + personal analytics to a protected file. Layer: APP.JS (the data lives in `localStorage.personalInfo` + analytics keys; the menu is app.js). Plan: serialize the relevant localStorage keys (personalInfo, writingPrefs, analytics) to a JSON blob, offer download; "protected" = at minimum a clear filename + optional passphrase-encrypted variant (AES via WebCrypto) — confirm with owner whether encryption is required or just a local file.
- **DELETE-SAVE-001:** in the "Are you sure?" erase sequence (the red confirm card), add a checkbox "Save my data locally first" that triggers the DATA-EXPORT-001 download before `AntcvFullErase`. Layer: APP.JS (the delete card + `window.AntcvFullErase`/`AntcvAuth.signOut`). Shares the export serializer with DATA-EXPORT-001.

### PREVIEW-ICON-001 + MOBILE-NAV-OVERLAP-001 (1.50.78)
- **Preview tab icon (done):** the bottom-nav Preview tab had no icon while Section (¶) and Analysis (🎯) did. Extended `antcv-sections-icon-346.js` (one self-healing decorator, no new observer) to also prefix Preview with 👁 — groups: `[¶ Section] [🎯 Analysis] [👁 Preview]`. EN verified; DA Preview label matched on common forms.
- **Mobile bottom-nav overlap (done):** the fixed bottom nav (`.antcv-react-bottom-nav`, `left/right:10px`) is a flex row of ~8 controls; on narrow viewports the right-most (CV/CL) clipped off-screen (owner screenshot). Added a mobile rule: `flex-wrap:wrap; justify-content:center; max-height:38vh; overflow-y:auto` so every control stays visible. `antcv-mobile-controls.css?v=1.50.78-navwrap`.
- **Top-bar overlap (REGISTERED, not blind-patched):** owner also reports top-panel buttons folding. The top header left cluster (ant, EN, "Application history", CV/SB toggles, ↵) is app.js-rendered + the right tools are `topbar-tools-347`/`mobile-fab-cleanup-351`. Needs the specific clipped elements identified live (which button disappears at which width) before a safe wrap/scroll fix — risk of disturbing the contended FAB relocation. Cache-bust this batch: sw → `antcv-1.50.78`, TARGET → 1.50.78 (1.50.77 → STALE).

### HIWC-RERENDER-LOOP-001 — diagnosed via rAF probe + first round of fixes (1.50.77)
- **Measured (rAF-attribution probe, owner's prod session):** 798 rAF/sec. Top schedulers: `settings-front-327:20` and `wizard-section-format-step10:92` at ~61/sec (every frame), then ~50 sidecars all at exactly 12.2/sec — a herd reacting to a shared ~12/sec re-render storm. `personality:597` (forceRebuild) and `candidate-preview-editor:408` both in the 12/sec herd.
- **Mechanism:** (a) the two 61/sec sidecars each run a `documentElement` MutationObserver watching `style`/`class` whose callback WRITES style — so they fire every frame off their own writes + the herd's style churn; (b) `personality.forceRebuild` removes+appends its block on every `antcv:sections-updated`, a DOM mutation that wakes all ~50 body-observing sidecars, one of which re-emits → the 12/sec loop; (c) `row-controls-wording` rewrote button title/text and re-triggered its own title/childList observer ("rewrote 1 button(s)" flood).
- **Round-1 fixes (all behaviour-preserving), shipped 1.50.77:**
  - `personality` v…-loopgate: forceRebuild skips the remove+append when the block data signature is unchanged AND a single connected block already exists (identical-DOM rebuild = visual no-op) → removes the per-cycle mutation pump.
  - `settings-front-327` + `wizard-section-format-step10`: throttle their observer-driven scheduler to ≤2/sec (was per-frame) → removes the two top amplifiers; reactivity preserved via the existing timers/click/hashchange paths.
  - `row-controls-wording` v…-p1b3: disconnect the observer during its own sweep + 500 ms throttle → stops the self-feed.
- **Next:** owner re-runs `docs/qa/probes/raf-attribution-probe.js` after deploy; expect rafPerSec to drop sharply. If a 12/sec residue remains, the next pump is in the herd (candidate-preview-editor emit or another section-panel sidecar) — gate that emit on a real diff. Systemic root: ~50 sidecars each running a body-wide MutationObserver that also mutates the DOM (coupled oscillator); long-term they need shared-scheduler/observer hygiene.

### BLEEP-MULTI-001 — name + location + privacy all bleep together (video 2026-06-04)
- Owner attached a video: the candidate **Name**, **Location**, and the **Privacy** pill all pulse/"bleep" in sync.
- **Read:** three unrelated elements bleeping in lock-step is one global driver, not three bugs — the preview/topbar **re-render loop (HIWC-RERENDER-LOOP-001)** repaints the header and re-mounts the topbar. Under that loop: (a) `topbar-tools-347` re-parents the privacy FAB each tick → flicker (my v1.50.74 transition/guard fix stops the FAB's *own* repaint but not re-parenting under a topbar re-mount); (b) Location is re-rendered by app.js; (c) the Name oscillated because `antcv-name-align-fix` re-applied `text-align` inline on every re-render, fighting app.js's `left`.
- **Action this round:** hardened `antcv-name-align-fix` v1.1.0 — removed the per-render inline writes; alignment is now a single injected `!important` **stylesheet rule** that wins passively, so the Name no longer races app.js (no oscillation). `?v=1.1.0-norace`, sw → `antcv-1.50.75`, TARGET → 1.50.75 (1.50.74 → STALE).
- **Still root:** the loop itself. Location + privacy bleep until HIWC-RERENDER-LOOP-001 is fixed. Probe `docs/qa/probes/rerender-loop-probe.js` measures the loop rate, the `antcv:sections-updated` emit rate, and whether the FAB/name nodes are being recreated — run it live, then patch the emit at source.

### PRIVACY-FAB-FLICKER-001 — FIXED (the "bleeping" background)
- Owner (high priority): the privacy 🛡 pill in the top bar pulses ("bleeps") its background.
- **Diagnosis:** `worst` (the privacy level) is read from a stable localStorage key, so it does not legitimately flap. The only periodic actor is `antcv-privacy-led.js`'s **2 s `setInterval` → `refreshFabAppearance`**, which every tick rewrote `textContent`, detached/re-appended the `.antcv-privacy-dot`, and re-asserted `background … !important`. The element carried `transition: background-color 0.15s`, so each re-assert cross-faded the fill — a periodic repaint seen as a pulse. (`topbar-tools-347` restyles size/visibility only — no background; `mobile-fab-cleanup-351` uses a translucent fill but only on the separate mobile FAB, which privacy-led's `FAB_MARKER` selector does not match — so no cross-sidecar background contention on the desktop pill.)
- **Fix (v1.50.74):** (1) dropped `background-color` from the FAB's `transition` so the fill can never animate; (2) added an idempotency guard in `refreshFabAppearance` — a `data-antcv-pl-sig` (worst|glyph|calls) short-circuits all DOM writes when the visible appearance is unchanged, so the 2 s tick stops repainting. Border/glyph colour still fade on a real level change. Cache-bust: `?v=1.50.74-nobleep`, `sw.js` → `antcv-1.50.74`, `version-override` TARGET → `1.50.74` (1.50.73 → STALE).

### NAME-ALIGN-001 — FIXED (sidecar)
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". Confirmed the editor's `wrapEditable` does NOT touch text-align — the `left` comes from app.js rendering the Name with `text-align: y("name")`, which is desynced from the CJLR control. Pure app.js-internal state desync (the control's displayed value and `y("name")` disagree).
- **Fix:** new sidecar `pwa/antcv-name-align-fix.js` (v1.0.0) keeps the Name line's text-align in lock-step with its CJLR control: reads the control's `current: <align>`, persists it to `localStorage:antcv:nameLineAlign` (so it survives the panel being closed / reloads), and applies it `!important` to `[data-antcv-candidate-edit="name"]`, re-applying on re-render + on a CJLR click + a 1.2s backstop. Disable hatch `antcvDisableNameAlignFix`. Cache-bust: new tag `?v=1.0.0`, `sw.js` → `antcv-1.50.73`, `version-override` TARGET → `1.50.73` (1.50.72 → STALE).

### Candidate panel ↔ preview sync — TRIAGE (2026-06-04)
Owner reported, after the role/company fix landed: preview→panel input doesn't refresh; the Name panel input isn't connected to the preview Name; contact/Location fields aren't connected; the preview Specialisation line isn't editable; and the panel has a redundant combined "Location line" alongside city + country.
- **Root:** the contact/name/specialisation panel, the line-alignment store, and the "Location line" field all live in **minified `app.js`** (not the readable React islands). Each candidate field writes its own in-app state object and `app.js` owns the rendering, so a per-field sidecar bridge is the wrong shape (high-risk, untestable here, will conflict). The role/company fix only worked because that store was a clean top-level localStorage key (`meta`).
- **Recommendation:** treat the candidate panel↔preview two-way sync + field cleanup as one app.js/React task (plan CA-001..005), done with live testing — not a growing stack of blind sidecars.
- **Owner decisions captured (queued):** drop the redundant combined "Location line" input and relabel the city field to "Location" (keep country) — implementable as a safe hide/relabel sidecar next.

### CL-HEADER-001 — panel↔preview store mismatch FIXED (p0d-fix7)
- **Found via the panel + screenshot:** the Set-panel "Application — Role/Company" inputs and the top-bar chip use the localStorage **`meta`** object (chip renders `` `${meta.role} @ ${meta.company}` ``, app.js `setItem("meta")`). The preview sentence read `personalInfo.role/company` — a DIFFERENT store — so panel edits (`Gt`/`dfdf`) updated the chip but the sentence kept showing the showcase fallback (`Ideal: [Role] - That Company`, where `That Company` = `pi.targetCompany`).
- **Fix (`p0d-fix7`):** `candidate-preview-editor-341` now reads role/company from `meta` first (falling back to the legacy personalInfo keys) and writes preview edits back to `meta`, so the panel, the chip, and the preview sentence share one source of truth. Added a `storage`-event listener for the `meta` key to re-sweep. Cache-bust: `?v=p0d-fix7`, `sw.js` → `antcv-1.50.72`, `version-override` TARGET → `1.50.72` (1.50.71 → STALE).
- **Still owed (app.js, out of sidecar scope):** the panel exposes only Role + Company inputs, not the "Application" label word (CA-002 wants applicationLabel in the panel too); the label IS editable in the preview. Reverse sync (preview edit → live panel-input value) updates `meta` + chip but the panel input reads app in-memory state, so it refreshes on the app's next render, not instantly.

### CL-HEADER-001 — edit-safety guard (p0d-fix6, shipped #107)
- On 1.50.70 the host DOES attach: `<div data-antcv-candidate-application-sentence="1">` with three `contenteditable` spans (`applicationLabel` "Application", `role` "[Role]", `company` "[Company]"). The fields read are correct — the editor reads `pi.role`/`pi.company`, which the probe confirmed the panel writes.
- **Real root cause:** `wrapApplicationSentence` ran `host.innerHTML = ''` and rebuilt the spans on EVERY sweep. With the preview re-rendering constantly (HIWC-RERENDER-LOOP-001), each sweep destroyed the span the user was typing into → focus lost, text reverted to placeholder. So the line was un-editable and never showed the entered role/company (only the app-name chip updated).
- **Fix (`p0d-fix6`):** edit-safety + idempotency guard — skip the teardown when focus is inside the host (user is editing) or when the existing spans already match label/role/company. Cache-bust: `?v=p0d-fix6`, `sw.js` → `antcv-1.50.71`, `version-override` TARGET → `1.50.71` (1.50.70 added to STALE). Verify on 1.50.71: typing in Application/Role/Company spans sticks; panel edits flow into the sentence.
- **Still open sub-items:** the `nowrap; overflow:hidden` on the header line is CL-LAYOUT-002 (clips to page width). NAME-ALIGN-001 (below).

### OPEN — NAME-ALIGN-001
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". The center alignment is not applied to the Name line. Captured: `<div data-antcv-candidate-edit="name" style="...text-align: left;...">` with a CJLR button titled "CJLR for Name line — current: center". Fix: apply the stored CJLR value to the name node. Needs to confirm whether the alignment writer is `candidate-preview-editor-341`, a CJLR sidecar, or app.js.

### PRIVACY-FAB update (2026-06-04, on 1.50.71-era capture)
- The button itself now renders visible in the panel-open state (the captured node no longer carries `display:none`/`visibility:hidden`). What remains is the inner `<span class="antcv-privacy-dot">` blinking — likely a CSS pulse "live" indicator and possibly intentional. The "invisible when section tabs are closed" state was not captured; still needs the closed-state DOM + the style-mutation watch (capture B) to decide if any patch is warranted.

### Still-not-fixed reports (need version confirm / further work)
- **HIWC template still hidden in CL (owner):** `prv-bullets3` keeps the template when no real-data sibling exists; if it is still blank, either 1.50.70 had not loaded yet, or the empty template is not emitted by the app render at all (not a dedup case). Confirm `ANTCV_VERSION` = 1.50.70 after hard refresh; if still blank, this is an app-render gap, not the dedup.
- **PRIVACY-FAB-FLICKER-001 worse:** now invisible when section tabs are closed, flickers when the section panel is open; should be a persistent topbar pill. Captured node still carries `display:none !important` + `opacity:1 !important` + `data-antcv-topbar-moved="1"` — `mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led` fighting. Needs a mutation-source probe before patching.

---

## 2026-06-04 — HIWC bullet-dedup console flood (fixed) + re-render loop (new, OPEN)

Owner report: in the cover-letter "How I Would Contribute" the second group of three bullets pops in and out continuously, and the console is flooded so a probe readout can't be taken.

### Fixed — console flood from `antcv-preview-bullets-dedup-341.js`
- **Root cause:** a re-render loop elsewhere keeps re-mounting the template `<ul data-antcv-hiwc-list="1">` as FRESH DOM nodes (without the `data-antcv-prv-bullets-hidden` marker), so the dedup re-hides each new node and logged a per-node `console.debug` every time — thousands of lines that drown the console.
- **Fix (v1.40.341-prv-bullets2):** collapse the per-node log into one debounced summary (`hid N template-only list(s) since last report`, ≤1 / 2s). Behaviour-preserving — hide/show logic unchanged. Cache-bust: `index.html ?v`, `sw.js CACHE` → `antcv-1.50.68`, `version-override` TARGET → `1.50.68` (+ 1.50.42..67 added to STALE). The reported count now doubles as a re-render-rate signal.

### Fixed — empty HIWC section rendered blank (`prv-bullets3`)
- **Symptom (owner):** after the flood fix, the HIWC bullets were fully hidden unless text was typed in the section panel; the empty template placeholders should stay visible.
- **Root cause:** `hideTemplateLists` hid EVERY template-only `<ul>`/`<ol>` unconditionally — including when no real-data render existed to fall back to — so an empty section went blank. The module header always intended a sibling check ("hide only when a sibling editable-text span shows the same text") that the code never implemented.
- **Fix (v1.40.341-prv-bullets3):** added `hasRealDataSibling(list)` — a bounded (≤4-ancestor) search for a `[data-antcv-editable-text="true"]` span with real, non-placeholder content outside the list. Hide the template only when such a sibling exists; otherwise keep the template visible. Worst case degrades to the prior duplicate render, never a blank section. Cache-bust: `?v=prv-bullets3`, `sw.js` → `antcv-1.50.69`, `version-override` TARGET → `1.50.69` (1.50.68 added to STALE; invariant preserved).

### OPEN — PRIVACY-FAB-FLICKER-001
- **Status:** OPEN — note only; not yet diagnosed.
- **Symptom (owner):** the Privacy 🛡 FAB "bleeps" (flickers). Captured node carries conflicting inline styles — `display:none !important; visibility:hidden !important; pointer-events:none !important` AND `opacity:1 !important` AND `data-antcv-topbar-moved="1"` — i.e. competing sidecars (`mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led`) fighting over its visibility/placement (PRV-005). Needs a probe of which sidecar writes the style last on each tick before any patch.

### OPEN — HIWC-RERENDER-LOOP-001 (the actual flicker)
- **Status:** OPEN — needs a targeted probe before any patch (diagnostic-first; do not blind-patch a central sidecar).
- **Symptom:** the template HIWC bullet list re-mounts on a loop, so the dedup is in a perpetual race (visible flash → hidden → visible …).
- **Suspected driver:** `antcv-candidate-preview-editor-341` writes sections (`source: 'candidate-preview-editor-341'`) → `antcv-personality` `forceRebuild` on `antcv:sections-updated` → React re-mounts the section → editor's observer fires → writes again. Console shows this chain repeating.
- **Next step:** instrument which sidecar re-fires `antcv:sections-updated` without a real data change, then gate that emit on an actual diff. Candidate fix sits in `candidate-preview-editor-341` (and/or the personality forceRebuild trigger), both readable sidecars.
- **Related QA-spec IDs:** CL-003 (HIWC modelled as Intro + per-bullet rows + Closing), GEN-UI-003 (endless controls under generation), PRV.

---

## 2026-06-03 — test-infrastructure landing + roadmap status audit (branch `claude/antcv-roadmap-bugs-L9Sqa`)

Scope this entry covers: automated tests and status tracking only. No sidecar,
`app.js`, or React-island behaviour changed — the open UI/UX items below are
untouched and still owe live verification per the DoD gate.

### Landed
- **Proxy writing-engine unit tests (40, `node:test`).** `workers/proxy/test/writing-style-engine.test.mjs` (32) + `workers/proxy/test/registry-sync.test.mjs` (8). Pure logic, no Cloudflare bindings, no network — every LLM call is injected. `npm test` in `workers/proxy/` is now `node --test`. All 40 pass locally on Node 22.
- **Registry-drift guard.** `registry-sync.test.mjs` ties the worker's inline style + banned-list subset back to the canonical `writingSystems/registry.json` (style-id set, default, language partition, shared banned words + phrases exact, per-style active / allowed length / tone chips / glyph density, every legacy alias resolves, active-at-cut roster). The "keep in sync" comment in `writing-style-engine.js` is now enforced, not advisory.
- **CI gains a functional check.** `.github/workflows/deploy.yml` adds a `unit-tests` job (Node 22, `node --test`, no install step) and a `pull_request` trigger so `lint` + `unit-tests` run pre-merge. Deploy jobs stay gated on push-to-main / workflow_dispatch — a PR never deploys.
- **Docs updated:** `TESTING.md` (Unit row, new "Proxy worker" subsection, §8.4 row marked seeded, CI section), `README.md` Tests list.

### Roadmap status audit — confirmed implemented in code (live/visual verification per DoD is separate)
- **§4.7 writing-engine pipeline** — `workers/proxy/src/writing-style-engine.js`: request parse + normalisation, preamble enrichment, SCE banned-list filter, ≤2-retry loop with flagged third draft, ATS glyph conversion, telemetry. Now unit-covered.
- **§4.5 language-partitioned banned lists** — object keyed by ISO code in both registry and worker; a Danish output is never filtered against English bans. Now unit-covered (preamble + SCE partition tests).
- **§4.10 glyph rules** — `src/lib/glyph-rules.ts` (PWA) + worker copy; allowed bullets and ATS labels agree across both.
- **Registries present and driving output** — `packages/registry.json` (CSS bundle + DOCX palette), `writingSystems/registry.json` (12-style engine).
- **Pass-1 React islands** — present under `src/islands/` (LanguageCard, PreviewToolbar, SettingsRouter, PackagePicker, WritingStylePicker, ExportOptionsCard, LayoutPicker, Breadcrumbs, wizard pickers).
- **docx-worker per-package palette (v1.50.8)** — `workers/docx-worker/src/palette.js`, legacy-ATS Calibri fallback; baseline smoke (`test/smoke.js`) passes locally.

### Known environmental gap (not a product bug)
- `workers/access-relay/tests/*.mjs` hardcode the sql.js wasm at `/home/claude/work/sqljs/sql-wasm.{cjs,wasm}`, which is absent here, so both relay suites error on load (`MODULE_NOT_FOUND`) until that path is provisioned. They are not in CI for this reason. Candidate follow-up: make the wasm path overridable via env var and vendor or fetch sql.js so the relay suites can join the `unit-tests` job.

---

## SESSION LANDED — shipped to `main`, LIVE VERIFICATION OWED (highest priority)

Everything in this block is committed to `main` (code complete) but went straight to `main` **without passing the acceptance gate** (see DoD below). None of it has been confirmed on the live site. Treat live verification as the top open task — bias to short, careful checks, and do not mark any item FIXED until it passes in Preview + PDF + DOCX (where applicable) on **desktop and mobile**, with no Preview-only, wrong-item, or after-hard-refresh-only behaviour.

Deploy anchor: islands bundle rebuild + Export-options move landed at commit `c475c4b` on `main`. Verify Cloudflare Pages has built that commit, then `?hardReset=1` before testing (clears the service worker + caches).

### What landed this session
- **QA spec v4 ingest.** Memory pointer added; canonical index committed at `docs/qa/AntCV_QA_backlog_index_v4.md`; this `ACTIVE_BUGS.md` folds in the v4 backlog. (Documentation — no live behaviour to verify, but it is the source of the IDs referenced below.)
- **357 sidecars + loader.** `antcv-validation-severity-consumer-357.js` (VAL-001 / VF-016 — stamps Set-menu validation nodes by severity so warnings render yellow, errors red), `antcv-help-text-wording-357.js` (PB-005 / TB-003 — rewrites "Compress" to "Fit" on non-button help/legend/caption nodes), `antcv-page-break-icon-357.js` (PB-005 / GEN-003 — swaps the down-arrow glyph for the semantic next-page glyph U+2398 on identified page-break controls only), and `antcv-357-loader.js` (runtime registrar; index.html also carries direct tags — double-registration is a no-op via per-file version guards + the loader's already-present skip).
- **Analysis-panel JD block — clean v1.40.358.** `antcv-analysis-panel-jd-block-356.js` rewritten after the branch copy was found corrupted (two conflicting `findAnalysisPanel` definitions merged from parallel worktrees → syntax error that stopped the whole sidecar parsing). The clean version (a) attaches to the EMPTY-state panel — keyed on the "Generate a CV first to see the analysis" text, not just the "Application Analysis" heading that the empty state never renders — and (b) uses a TIGHTENED ancestor climb (stop at the app shell, stop when the candidate begins to contain shell controls / the Advanced-Style button, stop past ~2.2x the marker width) so the block lands in the panel column, not an oversized wrapper. Hides the native placeholder once attached.
- **Export-options → Layout subtab.** React-island source change (not a sidecar): `ExportOptionsCard` is now collapsible and **collapsed by default** (open state persists in `localStorage:antcv:exportOptionsOpen`; header shows an "N on" badge when collapsed). Its mount (`src/islands/ExportOptions/mount.tsx`) is gated on the new `isLayoutSubtab()` and anchored immediately ABOVE the "Open Advanced → Style" hand-off button via the new `findAdvancedStyleButton()` (both in `src/lib/settings-dom.ts`). Requires the rebuilt `antcv-react-islands.js` (shipped at `c475c4b`); source changes alone do nothing until that bundle is built + the bundle `?v=` is bumped.

### Verification checklist (run on live, desktop AND mobile)
- [ ] **Analysis panel (empty state):** shows the JD paste/upload + "Analyse JD" block instead of only "Generate a CV first to see the analysis." Block sits in the panel column (not an oversized wrapper). Console shows `[analysis-panel-jd-block-356] installed v1.40.358`. Run completes both /api/recheck-fit and /api/jd-analysis and renders in-panel.
- [ ] **Export-options in Layout subtab:** appears collapsed by default, immediately above the "Open Advanced → Style" button; caret expands/collapses; "N on" badge reflects active toggles. Both ATS-safe and Legacy-tier toggles work and PERSIST across Settings close/reopen (write to `personalInfo.exportPrefs`).
- [ ] **Export-options removed from Personal subtab** (no duplicate, no orphan).
- [ ] **VAL-001 / VF-016:** validation warnings render yellow, errors red, with distinct labels.
- [ ] **PB-005 / TB-003:** no user-facing "Compress" wording in help/legend/caption text; page-break control shows the semantic page glyph, never a down arrow.
- [ ] Confirm none of the above is Preview-only, wrong-item, or only-after-hard-refresh.

### Known follow-ups if verification fails
- `anchorForButton` (Export-options) climb is a heuristic (max 2 single-child wrappers). If the card lands in an odd spot, report the Advanced-Style button's parent structure and tighten.
- Empty-state panel selector: if the JD block attaches to an oversized container, report `window.AntcvAnalysisPanelJdBlock356._findPanel()` (className + width) and tighten `maxW`.
- **Relay CORS mismatch (unresolved):** access-relay returns `Access-Control-Allow-Origin: https://antcv.pages.dev`, but testing was done on `cv-generator-det.pages.dev`, which is CORS-blocked at `/config` ("no relay access"). Decide the canonical live domain first, then patch the allowed origin(s) in `workers/access-relay/src/index.js`. Do not patch before the domain is settled.
- `LayoutPicker/mount.tsx` comment is now stale (it still says "between WritingStylePicker and ExportOptionsCard"); its anchor falls back correctly so it is doc-drift only.

---

## OPEN (session-level, highest priority)

### CL-HEADER-001 — Cover-letter "Application: [Role] — [Company]" header not editable, wrong font/colour
- **Status:** OPEN — not yet touched.
- **Symptom:** The header line "Application: [Role] — [Company]" cannot be edited in the CL preview, and renders in the wrong font/colour versus the rest of the document.
- **Root cause (CONFIRMED 2026-06-04 via `antcv-cl-header-probe.js` watch):** Panel Role/Company edits DO reach storage — the probe logged `piRole` and `piCompany` changing on each panel keystroke, each firing `candidate-preview-editor-341` → `antcv-personality` forceRebuild. The break is the OTHER direction: the snapshot showed `visible sentence hosts (0)` and the `sentence` fingerprint never changed. So `personalInfo.role/company` update fine, but `candidate-preview-editor-341`'s `wrapApplicationSentence` never attaches an editable host (its anchor/block search returns nothing on the CL), so the visible "Application:" line is neither editable nor re-rendered from the updated personalInfo. The old "writes to a hidden anchor" theory is wrong — panel→storage works; storage→visible line is the gap.
- **Next:** capture the visible "Application:" line's DOM (why `findCandidateBlock`/anchor search misses it), then fix the attach in `candidate-preview-editor-341` so the sentence renders from `personalInfo.role/company` and is editable. Verify Preview + PDF + DOCX.
- **Fix direction:** Bridge panel Role/Company edits to the visible sentence spans (or make the visible sentence the single source of truth); correct font/colour to document tokens. Verify in Preview, PDF, and DOCX.
- **Diagnostic (next step):** `pwa/antcv-cl-header-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Paste it into the live console on the CL Preview; it snapshots which `personalInfo` key holds role/company, the visible-sentence host text + computed style vs the name leaf, the hidden anchor, and the Settings-panel Role/Company field values, then `__clHeaderProbe.watch()` attributes a panel edit to a storage write and/or a re-render. Run reproduce → probe → targeted patch per CLAUDE.md; do not patch before the probe output identifies the key/render path.
- **Related QA-spec IDs:** CA-002 (Application sentence sync), CL-LAYOUT-002 (Application line width).

### APPHIST-ZIDX-001 — "Open in Settings →" opens Settings behind the preview
- **Status:** OPEN — needs live DOM evidence on fresh code before fixing.
- **Symptom:** From Application History, clicking "Open in Settings →" opens the Settings panel BEHIND the preview (z-index / stacking-context issue); user can't see/reach it.
- **Context:** app.js handler (v1.40.326) sets settingsTab + `window._antcvOpenSettingsRoute({tier:"standard",subtab:"apps"})`. Related sidecars: `antcv-app-history-zfix-291`, `antcv-app-history-back-to-preview-341`, `antcv-preview-shell-sticky-341`.
- **Fix direction:** Capture the stacking order live on current deployed code, then raise the Settings route above the preview shell (or lower the preview while Settings is foregrounded). Do not fix blind.
- **Diagnostic (next step):** `pwa/antcv-apphist-zindex-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). After clicking "Open in Settings →" so the mis-stacked panel is on screen, paste it into the console. It reports the chosen Settings panel + its full stacking-context chain (every ancestor that establishes a stacking context, with z-index), the preview-shell candidates and their chains, and — the ground truth — `paintOrderAtPanelCentre`: what `document.elementFromPoint` actually paints on top where the panel should be, and whether that topmost node is inside the preview or the panel. Distinct from `app-history-zfix-291` (which only raises the history dropdown above the slider). Run reproduce → probe → targeted patch.
- **Related QA-spec IDs:** AH-001 (Open in Settings foregrounds Application History).

### EXPORT-PAGE2-001 — Document-export preview: page 2 missing / no page breaks
- **Status:** OPEN — re-verify on fresh code.
- **Symptom:** Export preview shows only page 1 / page breaks not applied; page 2 content missing from the rendered preview.
- **Context:** Gate collects all `.antcv-preview-paper`; `antcv-pdf-page-mismatch.js` chips on count mismatch. Page-break sidecars: `antcv-page-breaks-everywhere-284`, `antcv-table-page-splits-327`, `antcv-sidebar-subsection-pagebreaks-329`. Watermark: `antcv-watermark-page-anchor-341`.
- **Fix direction:** Re-test on fresh deployed code. If still broken, determine whether the break is dropped in the preview render path or only in PDF/DOCX export; confirm against PB-001..006 gates.
- **Narrowed (2026-06-04):** the docx-worker page-break engine is healthy — `test/smoke-pagebreak.js` and `test/smoke-jd-questions-page2.js` pass 10/10 each, so the `.docx` export emits page 2 for the covered cases. That points the remaining defect at the CLIENT export-preview path: `antcv-pdf-preview-gate.js` builds `#antcv-pdf-preview-modal-iframe` and clones every `.antcv-preview-paper` into it (a v1.50.31 bug carried only page 1; v1.50.32 claims the fix). Preview page count = `[data-antcv-page-break="1"]` markers + 1.
- **Diagnostic (next step):** `pwa/antcv-export-page2-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Open the export/PDF preview, paste it in. It compares the source `.antcv-preview-paper` papers + page-break markers against what the gate iframe actually carries (`paperCountSourceVsIframe`, `markerCountSourceVsIframe`), reports whether `break-before` is computed on the iframe markers, and flags any paper that overflows one page with no marker. That isolates whether page 2 is dropped in the clone, in the marker injection, or in the break CSS.
- **Related QA-spec IDs:** PB-001..006, WM-005.

---

## QA SPEC BACKLOG (merged from AntCV_UI_UX_Spec_and_QA_Plan_v4.docx)

Status legend: `[ ]` open · `[~]` partially addressed · `[x]` believed fixed (verify). Update as work lands.
Full ID list with severities: `docs/qa/AntCV_QA_backlog_index_v4.md`.

### Core rules / Definition of Done (GEN)
- **GEN-001..011** — [~] Preview/DOCX/PDF parity; control locality (a button acts only on its own item); standard control order = Page Break, CJLR, Enhance, Fit, Delete; "Compress" renamed "Fit" everywhere; edit persistence; no clipped/hidden controls; drag-drop parity; a11y labels; preview-utility responsive parity; warning = yellow, error = red; CL generation must capture table data.
- **Acceptance gate (DoD):** no fix accepted if it works in Preview but not DOCX/PDF; affects the wrong item; lands a drag-drop at the end when the indicator showed elsewhere; attaches the watermark to text flow instead of the page box; hides/clips controls; or only works after a hard refresh. Every fix verified in Preview + PDF + DOCX, desktop and mobile where relevant. Page Break icon must be a semantic page-change glyph, never a down arrow.

### Cover Letter (CL)
- **CL-001** — [ ] Remove duplicate Preview action-button overlay.
- **CL-002** — [ ] Make Closure directly editable + persist.
- **CL-003** — [ ] Model "How I Would Contribute" as Intro + per-bullet rows + Closing (closing never a bullet; +Add at end).
- **CL-004** — [ ] Attach one control group per Foundation textbox.
- **CL-005** — [ ] Normalize CL body controls + add section-move button. (Partially via `cl-body-move-button-341` ☰ Move — VERIFYING.)
- **CL-006** — [ ] Capture table data in CL generation.
- **CL-LAYOUT-002** — [ ] (High) Constrain Application line to usable page width in Preview/PDF/DOCX.

### Page Break (PB)
- **PB-001** — [ ] Manual break from main + sidebar updates state, page model, numbering, all outputs.
- **PB-002** — [ ] Break on first sub-subsection moves whole subsection to next page with original heading, no dup.
- **PB-003** — [ ] Non-first sub-subsection duplicates heading + localized "Cont." label 18pt from top.
- **PB-004** — [ ] Table: first row moves whole table; later row splits and repeats headers.
- **PB-005** — [~] Replace down-arrow icon and "Compress" text. (Semantic page glyph via `page-break-icon-357`; "Fit" wording via `help-text-wording-357`/`row-controls-wording-341` — VERIFYING this session.)
- **PB-006** — [ ] Keep Professional Experience CONT pattern.

### Watermark + Candidate (WM / CA)
- **WM-001** — [ ] Anchor watermark to last-page corner, page-level not text flow.
- **WM-002** — [ ] Avoid collision; lower corner by clearance.
- **WM-003** — [ ] Text-only, no border/fill/shadow.
- **WM-004** — [ ] CL watermark page-anchored.
- **WM-005** — [ ] PDF watermark last page only.
- **CA-001..005** — [ ] Candidate Preview editing; Application sentence sync (panel Role/Company vs rendered sentence, no dup label) [see CL-HEADER-001]; section-move on movable rows; insertion-point drag-drop; destination styling and Restore.

### Tables / Outcomes / Publications (TB / SO / PP)
- **TB-001** — [ ] Per-line CJLR on Core Competencies.
- **TB-002** — [ ] Page Break per row per PB-004.
- **TB-003** — [~] Fix "What I Bring" help text; no "Compress" or down arrow. (Help-text wording via `help-text-wording-357` — VERIFYING this session.)
- **SO-001** — [ ] Add Page Break, CJLR, Enhance, Fit before Delete on each Selected Outcome row.
- **SO-002** — [ ] New rows identical.
- **PP-001** — [ ] Expose hidden Publications controls in row layout.
- **PP-002** — [ ] Single input acts on whole entry.
- **PP-003** — [~] HIGH-RISK; shared row-control model only; buttons row-anchored and stable in generation. (Stale injected Enhance/Fit buttons addressed by `pub-injected-reaper-352` — VERIFYING.)

### Preview shell + validation (PRV / AH / VAL)
- **PRV-001** — [ ] Restore 3 desktop lower-right Preview utility buttons.
- **PRV-002** — [ ] Restore Privacy and Fuse CL-CV desktop placement, no hidden dups.
- **PRV-003** — [ ] PDF and DOCX buttons persistent in top Preview area, route-independent.
- **PRV-004** — [ ] Loading status not click-dismissable while a job runs.
- **PRV-005** — [ ] Circular buttons viewport-specific; mobile bottom-right kept. (Mobile FAB cleanup via `mobile-fab-cleanup-351` — VERIFYING.)
- **AH-001** — [ ] "Open in Settings" foregrounds Application History [see APPHIST-ZIDX-001].
- **VAL-001** — [~] Errors red, warnings yellow, distinct labels. (Token sidecar `validation-severity-341` + consumer `validation-severity-consumer-357` that stamps the rendered Set-menu nodes — VERIFYING this session. Overlaps GEN-011 / VF-016.)

### Onboarding / generation / layout / export / responsive (third + fourth pass)
- **LANG-001** — [ ] (Med) Settings vs top-bar language mismatch (Chinese ticked, not in bar); fallback EN+DA, wizard is source of truth.
- **IMPORT-001** — [~] (High) Import reports 0 work entries despite valid JSON; map experience/education/certifications/publicationsStructured lengths. Shipped fixes: `antcv-upload-recount-339.js` (dual-key normalise + toast recount) and the importer's experience→sections.cv bridge. The contract is now codified + regression-covered in `pwa/lib/import-normalize.js` + `pwa/test/unit/import-normalize.test.mjs` (18 tests, incl. a static drift guard over both sidecars and the Anita persona as fixture). Live verification of the in-app import still owed; adopting the shared module inside the sidecars is a follow-up (touches loaded scripts → needs browser verification).
- **ONBOARD-001** — [ ] (High) Step 3B writing-register list not scrollable on mobile; Next unreachable (dvh, sticky footer).
- **GEN-001b** — [ ] (High, §14.2) Kernel generation leaves major CV sections empty/underfilled; add unsolicited fallback + warnings.
- **GEN-002b** — [ ] (High, §14.2) CL generation drops What I Bring table signals + Why This Position bullets.
- **GEN-UI-001** — [ ] (Med) Redundant Enhance/Fit buttons under generation Cancel action.
- **GEN-UI-002** — [ ] (Med) Generation time estimate too optimistic; almost-done shown too early (use ~4 min default).
- **GEN-UI-003** — [ ] (High) Repeated/endless Fit controls under "Cancel & return to editor"; hard rendering guard when generation view active.
- **LAYOUT-001** — [ ] (High) Sidebar background does not extend to page bottom in Preview/PDF/DOCX.
- **EXPORT-001** — [ ] (Med) Missing download-start indicator for PDF/DOCX export.
- **EXPORT-002** — [ ] (Critical) PDF export fails; needs visible recovery + retry, must not corrupt current doc.
- **RESPONSIVE-001** — [ ] (High) Mobile Preview loads desktop split-pane layout; Section/Analysis/Preview must be mobile bottom modes.
- **PDF-LAYOUT-001** — [ ] (High) PDF page 2 shows stray Selected Outcomes heading before Professional Experience continuation.

---

## VERIFYING (shipped, confirm on fresh code)

- **export-options → Layout subtab (islands `c475c4b`)** — moved from Personal; collapsible, collapsed by default, above the Advanced-Style button. See SESSION LANDED checklist. (Export-options relocation.)
- **analysis-panel-jd-block-356 → v1.40.358** — clean rewrite; attaches to the empty-state panel + tightened ancestor selection; index.html tag + loader registered. See SESSION LANDED checklist. (Analysis panel empty-state usability.)
- **validation-severity-consumer-357** — stamps Set-menu validation nodes by severity (VAL-001 / VF-016). See SESSION LANDED checklist.
- **help-text-wording-357** — "Compress" → "Fit" on non-button help/legend/caption nodes (PB-005 / TB-003).
- **page-break-icon-357** — down-arrow → semantic page glyph U+2398 on identified page-break controls (PB-005 / GEN-003).
- **357-loader** — runtime registrar for the four sidecars above; skips any already present via a direct index.html tag.
- **section-panel-211 v1.40.350** — endless Publications mini-button flicker / re-injection. Idempotent attribute writes + observer guard + attribute-first classification.
- **pub-injected-reaper-352** — removes the two stale `data-antcv-pub-injected` Enhance/Fit buttons wherever they appear. (PP-003)
- **mobile-fab-cleanup-351** — hides mobile JD/Fusion FABs; relocates mobile Privacy into the top bar as a compact higher-contrast pill. (PRV-005)
- **cl-body-move-button-341 v1.40.350** — ☰ Move button mounts on CL body rows (`data-antcv-align-sid` selector fix). (CL-005)
- **personal-info-anti-thinning-353 → v1.40.354** — blocks load-time near-total wipe of local personalInfo; narrowed so it never touches generation/editing writes.
- **cloud-put-shrink-guard-355** — compares a thin /api/prefs PUT against a fresh cloud GET; blocks a large shrink. (Committed; wiring/verification pending.)

---

## NOTES / DEPENDENCIES

- Deployed app.js does NOT yet render `recruiter` / `red_flags` from `rationale`. The 356 block renders those in-panel itself (Option A). Native panel render of those fields needs an app.js push (manual; minified bundle).
- React-island changes (e.g. the Export-options move) require a Vite rebuild of `pwa/antcv-react-islands.js` and a bundle `?v=` bump — source edits alone never reach the live site. Last islands rebuild: `c475c4b`.
- Housekeeping (raised to MEDIUM): prune stale `.claude/worktrees/*`. These caused repeated git trouble this session — `main` advancing under local work, a recurring merge conflict on `antcv-analysis-panel-jd-block-356.js`, and an accidental push of `fix/validation-severity` (283 unpushed commits) from inside a worktree. Remove the ones not actively used before the next work session; confirm none is running an automated agent that pushes to `main`.
- The QA-spec IDs above are summarized from `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`; consult that doc for full per-ID prose, screenshots, and acceptance detail. The retrievable ID index is `docs/qa/AntCV_QA_backlog_index_v4.md`.

### LOOP-DAMPER REVERTED + HIWC focus-restore (1.50.89)
- **Owner test result:** disabling the loop damper (`localStorage.antcvDisableLoopDamper=1`) STOPPED the WIB/Experience/Core-Competencies control multiplying → the global `MutationObserver` wrap (1.50.85) regressed those per-row injectors' self-cleanup. **Reverted:** removed the `antcv-loop-damper.js` script tag from index.html (file kept in repo, not loaded). Loop now handled only by the targeted per-sidecar idempotency fixes (rounds 1-7), which were safe + converging.
- **HIWC still hard to type (damper OFF too):** the app re-renders the HIWC section and re-creates the bullet input, dropping the caret. Added focus preservation to `how-contribute-controls-245`: track the last-focused bullet index + caret (`noteHiwcFocus` on focus/keyup/click/input), and after the editor is rebuilt restore focus + caret to the same input (`restoreHiwcFocus`, sync + setTimeout(0)). Combined with the 600ms debounce (1.50.86) + edit-safety guard (1.50.87), typing should be uninterrupted. `?v=1.50.89-focus`, sw → `antcv-1.50.89`, TARGET → 1.50.89 (1.50.88 → STALE).
- **Net for release:** privacy blip fixed at source (CSS), HIWC double-bullets gone (app owns bullets), empty template preserved, panel/align attribute storms idempotent, and the multiplying regression removed. Remaining loop rAF is back (damper gone) but is far lower than the original after rounds 1-7; the visible user bugs (blip, multiply, double bullets) are resolved.

### DOCX-EXPORT-REGRESSION-001 — hardened the preview-modal export (1.50.90)
- Root: the preview/print-setup modal's "Save as DOCX" only did `document.querySelector('button[title^="Export as .docx"]').click()` and, if that app button wasn't reachable in the current view, alerted "isn't ready" and nothing downloaded (commit 0eaee37 added it; it was the single export surface per 1.50.49).
- Fix (`antcv-pdf-preview-gate.js` 1.50.90): `triggerDocxExport()` now (1) finds the app DOCX button via several selectors (title prefix/contains + text/Word match) and clicks it; (2) if it truly can't be found, calls `window.exportDocxViaWorker` DIRECTLY with a payload rebuilt from localStorage (sections/meta/doc/personalInfo/photo/styleConfig/fontSizes/language/navyColor) — the same worker path the app uses; (3) logs which path it took (`[pdf-preview-gate] DOCX: …`) so the failure mode is visible if it still fails. `?v=1.50.90-docx`, sw → `antcv-1.50.90`, TARGET → 1.50.90 (1.50.89 → STALE).
- Verify: open preview → export → Save as DOCX → file downloads. If not, the console line says whether it delegated, called the worker, or the worker URL is missing (Settings → Account).

### Remaining QA-pass items (registered, post-DOCX)
- CORE-COMP / WIB tables: 2 redundant page-break buttons per row; textarea/cell sizes too small; pressing the page button only flickers it (doesn't advance the row to the next page). Owners: table-row-page-controls-328 / core/wib row-control sidecars + page-cascade store.
- HIWC still reported not-editable + no preview template on 1.50.89 for the owner — recheck after the table/loop work; if persistent, the app re-render rate is still high enough to defeat the focus-restore (needs the editor's own rebuild gated harder).
