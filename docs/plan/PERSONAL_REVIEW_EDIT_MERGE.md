# Architecture Plan — Merge the data reviewer into Settings → Personal ("Review & Edit")

Status: ALL 7 BUNDLES SHIPPED on branch `feat/personal-review-edit-merge` (2026-06-24), 1.50.848 → 1.50.854. Each bundle is e2e/unit-verified (pwa/test/diag-personal-merge*.mjs). NOT yet merged to main / not pushed. Owner spot-check still pending on the bundle-4 Languages prefer-richer merge (live data).

Shipped bundles: 1 launcher Account→Personal · 2 collapsible cards + role collapse · 3 editable tone editors (hosts WritingStylePicker sub-editors) · 4 Languages/Interests/Accessibility Additional sub-blocks · 5 FAB removal + personality results/Retake · 6 hide native dupes (coverage-proven CSS sidecar) · 7 account-locked import verified. Plus: repaired the e2e harness gate-seed and fixed two latent bugs it surfaced (AntcvReactIslands namespace clobber; personality card stale anchor).

---

Owner brief: move the high-quality "Review my data" reviewer and merge its functionality into the Personal tab; complete the gaps; make every sub-panel editable, collapsible, language-aware; retire the duplicate native Personal controls.

### Owner decisions (2026-06-24) — these govern the design
1. **The modal IS the presentation.** "Review my data is the new modal from my point of view, this is how I want things presented." So we KEEP the modal layout as the review/edit surface — we do NOT inline it into the Personal flex column. The Personal-tab native inline editors go away; the modal's **launch button moves from Account (privacy zone) → Personal tab**. The modal itself gets the gaps/edit/collapse work.
2. **Languages:** `sections.cv.languages` is canonical; one-time prefer-richer merge from the Additional-info rows. (Owner spot-check gated.)
3. **FABs:** remove the floating 🔒 Export / 📥 Import FABs entirely — controls live in the Personal tab (and the modal footer) only.

---

## 0. Current state (verified)

Three independent surfaces today edit the SAME `personalInfo` store but look and behave differently:

| Surface | Built in | Loaded by | Quality |
|---|---|---|---|
| **"Review my data" modal** | `pwa/antcv-data-export-360.js` (vanilla DOM, `openReview()` → `window.AntcvReviewData`) | index.html:972 | HIGH read layout; only Identity/Summary/Experience/Sidebar/Visibility are editable. Tone + Languages are **read-only chips** that explicitly say "Edit these in Settings → Personal" (`:424-425`). |
| **Settings → Personal native controls** | `pwa/app.src.js` ~22270-23000 (flex column, order-based) | app.js | Name, Headline, Quick contact, Background, CV Sidebar — duplicate the reviewer, lower fidelity. |
| **Personal React islands** | `src/islands/*.tsx` → `pwa/antcv-react-islands.js` (vite build) | index.html:989 | WritingStylePicker (banned words/phrases per-language + bank + bulk-paste + semantic-constraint editor, **export/import-correct**), LanguageCard, JobSearchTargeting. |

Plus standalone sidecars already in Personal: `antcv-personality-quiz-439.js` (Personality kernel card with Take/Retake), `antcv-sections-normalize-415.js` (explodes Additional → `languages`/`interests`/`accessibility` sidebar sections), `antcv-additional-info-row-controls-247.js`.

### The core problem
The best-looking surface (the modal) has two read-only panels; the full tone/language editors live elsewhere; and the Personal tab duplicates identity/contact at lower fidelity. The owner wants the modal to be THE review/edit surface, launched from Personal, with editing everywhere — and the Personal tab stripped of the duplicates.

### Canonical data model (single source of truth — do NOT add parallel write paths)

| Data | Store | Canonical writer | Notes |
|---|---|---|---|
| Identity, summary, experience, sidebar (tools/edu/cert/regulatory/additional), visibilityControls | `personalInfo.*` | reviewer `rdSavePI` / app.js | reviewer already edits these |
| Banned words/phrases (cross-lang) | `personalInfo.stylePrefs.banned_words` / `banned_phrases` (csv) | WritingStylePicker `writeWritingPrefs` | |
| Banned words/phrases (per-lang) | `personalInfo.writingPrefs.extraBannedWords[lang]` / `extraBannedPhrases[lang]` (`en/da/es/zh`) | WritingStylePicker | "All languages" = union across buckets |
| Semantic constraints (canonical) | `personalInfo.stylePrefs.semanticConstraintsV2[]` | WritingStylePicker `writeSemRules` | also regenerates flat `bannedContextual[]` for the prompt — keep both in parity |
| Languages | `personalInfo.languages[]` AND exploded `sections.cv[{id:'languages'}]` | LanguageCard / 415 | **two sources; reconcile — see W2; section is canonical (owner)** |
| Interests / Accessibility | `sections.cv[{id:'interests'|'accessibility'}]` | 415 normalize | |
| Personality kernel | `personalInfo.personality` | `antcv-personality-quiz-439.js` | traits[] + work_style_line |
| Job-search targeting | localStorage prefs | JobSearchTargeting island | |
| Account-locked export | `.locked.json` `{_antcvBackupUserBound, owner, iv, ciphertext}` AES-256-GCM, server key `/api/export-key` | export-360 `exportUserBound` | import-331 already decrypts (`:250`) |

**Design principle:** every editor writes through the EXISTING canonical writer for its store. We relocate/host editors; we do not duplicate write logic. This is what guarantees export/import parity for the tone controls for free.

---

## 1. Target architecture (modal = presentation; Personal = lean launcher)

**A. Relocate the launcher.** The `Review my data` button (renamed **"Review & Edit my data"**) moves from the Account/privacy zone into Settings → Personal. The `Export (account-locked)` control also lives in Personal (it already sits in the modal footer too).

**B. Strip the Personal tab down.** The native inline editors the modal already covers are hidden, and the WritingStylePicker island's Banned/Phrases/Semantic sub-sections are hidden in Personal (they become editable inside the modal).

```
Settings -> Personal  (lean launcher tab)
|- [Review & Edit my data]   -> opens the modal (moved from Account)
|- [Export (account-locked)] (moved from Account; FABs removed)
|- Writing style selector    (WritingStylePicker - KEEP; un-stuck, W8)
|     |- Advanced tone + embedded Languages    (KEEP)
|     '- Banned words / Banned phrases / Semantic constraints   (HIDDEN here -> live in modal)
|- Personality               (collapsible: results + Retake - already a sidecar card, W9)
'- Job search targeting       (single island instance, un-stuck)
```

```
Review & Edit modal  (the presentation the owner wants - all editing happens here)
|- intro blurb (kept)
|- [>] Identity & contact            (already editable)
|- [>] Professional summary          (already editable)
|- [>] Work history (N roles)        (editable; each role collapses to title.company.years - W4)
|- [>] Banned words                  (NEW editable + All/EN/DA scope + bank + bulk paste - W3)
|- [>] Banned phrases                (NEW editable + All/EN/DA scope - W3)
|- [>] Semantic constraints          (NEW editable, lang-aware - W3)
|- [>] Tools / Education / Certs / Regulatory   (already editable)
|- [>] Additional info               (editable) -- sub-blocks: Languages, Interests, Accessibility (W2)
|- [>] What's shown on the CV        (already editable toggles)
'- footer: [Export (account-locked)] [Done]
```

### Mount strategy for the modal's editable tone panels (W3)
The modal rebuilds fresh on each `openReview()` (it removes the stale node first). Host the tone editors by **mounting a fresh island instance into the modal panel on open, unmounting on close** — reusing the existing `WritingStylePicker` banned/phrases/semantic sub-editors (which own the canonical writes + language scope + bank + bulk-paste). To make those sub-editors mountable standalone, extract them as their own island mount points (small `.tsx` refactor + vite build) so BOTH the Personal-tab island and the modal can mount them. Canonical writes stay single-sourced → export/import parity is automatic. (Alternative — modal-native editors writing the same stores — rejected: parity-drift risk.)

### Build discipline (mixed — important)
- `antcv-data-export-360.js`, `antcv-data-importer.js`, `antcv-personality-quiz-439.js` = **direct vanilla JS edits** (+ `app.src.js` mirror only if app.js is touched).
- Island changes (extracting sub-editors, hiding sub-sections in Personal, un-sticky CSS) = **`src/islands/*.tsx` + `npm run build`** → `pwa/antcv-react-islands.js`. Never app.js surgery. The esbuild app.js rebuild stays gated/forbidden; islands have their own safe vite build.
- After every change: cache-bust protocol (`?v=` on changed file in index.html, `sw.js` CACHE, `antcv-version-override.js` TARGET + STALE, `window.ANTCV_VERSION` seed).

---

## 2. Work items

Each is independently shippable. Risk noted. "Verify-first" items may already be done.

### W1 — Rename to "Review & Edit my data" + relocate launcher
Rename the button (`buildReviewButton`) and modal heading. Move the launcher injection from the Account/privacy zone (`injectDownload`) into the Settings → Personal column (reuse the islands' `findSettingsFlexColumn` selector + MutationObserver). Risk: LOW-MED. Files: `antcv-data-export-360.js`.

### W2 — Complete the gaps: Languages + Interests + Accessibility as Additional sub-blocks; reconcile Languages
- Add **Languages**, **Interests** and **Accessibility** editor blocks nested inside the modal's Additional-info card (Languages is a sub-block here, NOT a standalone top-level card). Source of truth stays `sections.cv[{id:'languages'|'interests'|'accessibility'}]` (415). Extend `rdSidebarSection` to surface these exploded sections as labelled sub-editors reading/writing the section items (`{l,v}`), dispatching `antcv:sections-updated`.
- Remove the standalone read-only Languages card from the modal; it becomes the Additional-info Languages sub-block.
- **Languages reconciliation (owner: section is canonical; Additional-info content is richer):** make `sections.cv.languages` canonical with a one-time prefer-richer merge from `personalInfo.languages` / Additional-info rows; the Languages sub-block edits the section. **Owner spot-check gated** on live data.
Risk: MED (two stores, live-data migration). Files: `antcv-data-export-360.js`, coordinate with `antcv-sections-normalize-415.js`.

### W3 — Make the modal's tone + languages panels editable (host the islands)
Replace the read-only Semantic / Banned-words / Banned-phrases chip renders with the live editors:
- Remove the `Edit these in Settings → Personal …` tip line from each panel.
- Mount the extracted `WritingStylePicker` sub-editors into the modal cards on open. **Banned words AND banned phrases are both language-aware** (`extraBannedWords[lang]` / `extraBannedPhrases[lang]` already exist per-language). Each provides **All/EN/DA/ES/ZH** scope, add form, **Bulk paste**, **Clear all**, **Pick from the bank**, and writes the canonical store → **export/import parity is automatic** (W7 cycle round-trips `semanticConstraintsV2`, `extraBannedWords`, `extraBannedPhrases`, `banned_*`).
Risk: MED (mount/unmount React into a transient modal; lifecycle/observer interplay). Files: `src/islands/WritingStylePicker/*` (extract standalone sub-mounts) + island build; `antcv-data-export-360.js` (host shells + mount/unmount hooks).

### W4 — Collapsible cards, collapsed by default
- Every modal sub-panel becomes a `[>] header / body` disclosure, collapsed on first paint (persist open/closed per card in localStorage).
- **Work history collapses to role level:** collapsed role shows only `title · company · years` (+ shown checkbox); expanding reveals bullets/outcomes. Implement as a per-role disclosure in `rdWorkHistory`.
Risk: LOW. Files: `antcv-data-export-360.js`.

### W5 — Controls placement; single Job-search instance; remove FABs
- `Export (account-locked)` sits in the Personal tab (and stays in the modal footer). Remove the floating 🔒/📥 FABs entirely (owner decision #3) — confirm nothing else depends on them.
- Job-search targeting already lives only in Personal — ensure exactly ONE instance after the hide pass (W7). Owner noted a possible duplicate sticky trigger across Personal/User tabs; collapse to one.
Risk: LOW-MED. Files: `antcv-data-export-360.js` (FAB removal, Export placement), `antcv-data-importer.js` (FAB removal), `src/islands/JobSearchTargeting/mount.tsx` + build.

### W6 — Import handles account-locked encrypted export  **(VERIFY-FIRST — likely already done)**
`antcv-data-import-331.js` already detects `_antcvBackupUserBound===1` → `decryptUserBound` (`/api/export-key`, owner match) (`:250`, `:270`). Confirm in `antcv-data-importer.js`: (a) the file `accept` list / `detectKind` accepts a `.locked.json` and routes it as a backup envelope; (b) the JSON path recognizes the user-bound envelope and hands to `AntcvDataImport`. Add only the missing routing if a gap exists; otherwise this is a round-trip test, not a build.
Risk: LOW. Files: `antcv-data-importer.js` (routing only).

### W7 — Hide duplicate native Personal controls (COVERAGE-PROVEN, LAST)
Hide ONLY after the modal demonstrably covers each (store + readers). Per the "don't hide controls as duplicates" rule, prove coverage first — a speculative de-dup once destroyed the banned-words feature (reverted 1.50.545).

| Native control to hide (in Personal) | Covered by | Coverage proof |
|---|---|---|
| Name input | modal Identity card | same `personalInfo.name` |
| Headline input (+ variants) | modal Identity card | same `personalInfo.headline`/`headlines` |
| Quick contact details (`data-antcv-quick-contact-hdr`) | modal Identity card | email/phone/location/citizenship/linkedin parity |
| Background (`<details>` order:10) | modal Summary card | `personalInfo.background` parity |
| CV Sidebar Content (`<details>` order:15) | modal sidebar cards | per-section parity |
| Banned words / phrases / Semantic (WritingStylePicker sub-sections) | modal tone cards | SAME canonical store; hide the Personal sub-sections, not a second store |
| Job search targeting (duplicate trigger) | single island | ensure one instance |

Hide mechanism: prefer CSS `display:none` from the sidecar / a conditional render flag in the island (`.tsx`) over deleting app.src code — so a regression is a one-line revert. For the WritingStylePicker tone sub-sections, gate them off in Personal via the island (they now render in the modal).
Risk: HIGH (regression surface). Mitigate with the coverage matrix + live value-diff test before each hide.

### W8 — Nothing sticky (esp. writing-style-picker)
Audit for `position:sticky|fixed` / pinned behavior in the islands (WritingStylePicker, tone-helper) and remove/neutralize it so they scroll with the page. Risk: LOW. Files: `src/islands/WritingStylePicker/*` + build.

### W9 — Personality box (VERIFY-FIRST — card already exists)
`antcv-personality-quiz-439.js` already renders a collapsible "Personality kernel" card in Personal with Take/Retake, storing `personalInfo.personality`. Work: (a) show the RESULTS (traits + `work_style_line`) when a kernel exists, not just the button; (b) collapsed-by-default; (c) Retake reopens the quiz. Mostly integration + a results readout. Risk: LOW. Files: `antcv-personality-quiz-439.js`.

---

## 3. Sequencing (named bundles)

Ship tight, named, independently-revertable bundles:

1. **PERSONAL-MERGE-1 / launcher** — W1 rename + relocate the Review-&-Edit launcher Account → Personal; keep everything else. Verifiable alone.
2. **PERSONAL-MERGE-2 / collapse** — W4 collapsible modal cards + role-level collapse.
3. **PERSONAL-MERGE-3 / editable tone** — W3 extract + host the island tone editors in the modal; drop the "edit in Settings" tips; W8 sticky audit.
4. **PERSONAL-MERGE-4 / gaps** — W2 Interests + Accessibility sub-blocks + Languages reconciliation (owner spot-check gate).
5. **PERSONAL-MERGE-5 / controls + personality** — W5 Export placement + FAB removal + single job-search; W9 personality results.
6. **PERSONAL-MERGE-6 / hide duplicates** — W7, one control at a time behind its coverage proof. LAST (highest regression).
7. **PERSONAL-MERGE-7 / import verify** — W6 confirm/round-trip the account-locked import.

Each bundle: surgical edits → boot-smoke (headless Playwright past the sign-in gate, `headless-pwa-testing` memory) → live render check → cache-bust → commit → push (sync-first, never force).

---

## 4. Risks & test matrix

- **Mount/unmount React into the transient modal (W3):** the modal is destroyed on close; the hosted island must mount on open and clean up on close (no leaked observers / double mounts). Test: open modal → edit a banned word → confirm `personalInfo.writingPrefs.extraBannedWords` updates and export round-trips; close/reopen → no duplicate instance.
- **Hiding native controls (W7):** the 1.50.545 banned-words regression precedent. Test each hide with a before/after value-diff on the underlying store; keep hides reversible (CSS / island flag).
- **Languages two-source migration (W2):** live-data only; owner spot-check required (Additional-info languages are richer than `personalInfo.languages`).
- **Stale SW masking (cross-cutting):** verify the REAL loaded `?v=` after each deploy (`stale-sw-version-mask-hazard`); run `scripts/check-cache-bust.mjs`.
- **Export/import parity (W3/W6):** full cycle — edit tone in modal → `Export (account-locked)` → wipe → `Import` the `.locked.json` → confirm banned words, per-language buckets, semantic constraints, interests, accessibility, personality all restore.
- **Sync discipline:** `git pull --rebase origin main` before every push; single-line app.js merge-conflicts (`template-derive-and-worktree-contention`) — use a `git worktree` for app.src.js work.

---

## 5. Resolved decisions (owner 2026-06-24)

1. **Modal fate:** KEEP the modal as the presentation; do not inline. Move only its launcher Account → Personal. (Decision #1)
2. **Languages canonical:** `sections.cv.languages`, prefer-richer merge from Additional-info. Owner spot-check gated. (Decision #2)
3. **FABs:** removed entirely; controls live in Personal tab + modal footer. (Decision #3)

---

## 6. Files touched (index)

- `pwa/antcv-data-export-360.js` — rename, relocate launcher, collapsibles, role-collapse, host tone-editor shells, Interests/Accessibility sub-blocks, Export placement, FAB removal. (vanilla edit)
- `pwa/antcv-data-importer.js` — `.locked.json` routing (W6, if gap); FAB removal. (vanilla edit)
- `pwa/antcv-personality-quiz-439.js` — results readout + collapsed-by-default integration (W9). (vanilla edit)
- `pwa/antcv-sections-normalize-415.js` — Languages reconciliation coordination (W2). (vanilla edit)
- `src/islands/WritingStylePicker/*` — extract standalone banned/phrases/semantic sub-mounts; hide them in Personal; un-sticky → `npm run build` → `pwa/antcv-react-islands.js`. (island build, NOT app.js surgery)
- `src/islands/JobSearchTargeting/mount.tsx` — single instance + un-sticky → build. (island build)
- `pwa/app.src.js` + `pwa/app.js` — only if native Personal controls (Name/Headline/contact/Background/Sidebar) are hidden in-place (W7); prefer CSS hide from the sidecar to avoid app.js surgery.
- `pwa/index.html`, `pwa/sw.js`, `pwa/antcv-version-override.js` — cache-bust per changed file.
